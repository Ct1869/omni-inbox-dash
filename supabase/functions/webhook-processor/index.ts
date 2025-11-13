import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookQueueItem {
  id: string;
  account_id: string;
  history_id: string;
  email_address: string;
  retry_count: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting webhook queue processor...');

    // Fetch pending queue items, including those ready for retry
    const { data: queueItems, error: fetchError } = await supabase
      .from('webhook_queue')
      .select('*')
      .eq('status', 'pending')
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('Error fetching queue items:', fetchError);
      throw fetchError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No pending items in queue');
      return new Response(
        JSON.stringify({ message: 'No pending items', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${queueItems.length} queue items`);

    let successCount = 0;
    let errorCount = 0;

    // Process items one at a time with rate limiting
    for (const item of queueItems as WebhookQueueItem[]) {
      try {
        // Mark as processing
        await supabase
          .from('webhook_queue')
          .update({ status: 'processing' })
          .eq('id', item.id);

        console.log(`Processing webhook for ${item.email_address}, history_id: ${item.history_id}`);

        // Invoke gmail-webhook function with the webhook data
        const { error: webhookError } = await supabase.functions.invoke('gmail-webhook', {
          body: {
            message: {
              data: btoa(JSON.stringify({
                emailAddress: item.email_address,
                historyId: item.history_id,
              })),
            },
          },
        });

        if (webhookError) {
          throw webhookError;
        }

        // Mark as completed
        await supabase
          .from('webhook_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        successCount++;
        console.log(`Successfully processed webhook for ${item.email_address}`);

        // Rate limit: 1 second delay between processing
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing webhook for ${item.email_address}:`, errorMessage);

        const retryCount = item.retry_count + 1;
        const maxRetries = 3;

        if (retryCount >= maxRetries) {
          // Max retries reached, mark as failed
          await supabase
            .from('webhook_queue')
            .update({
              status: 'failed',
              error_message: errorMessage,
              retry_count: retryCount,
              processed_at: new Date().toISOString(),
            })
            .eq('id', item.id);
        } else {
          // Schedule retry with exponential backoff
          const delaySeconds = Math.pow(2, retryCount) * 60; // 2min, 4min, 8min
          const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

          await supabase
            .from('webhook_queue')
            .update({
              status: 'pending',
              retry_count: retryCount,
              error_message: errorMessage,
              next_retry_at: nextRetryAt.toISOString(),
            })
            .eq('id', item.id);

          console.log(`Scheduled retry for ${item.email_address} at ${nextRetryAt.toISOString()}`);
        }
      }
    }

    console.log(`Webhook processing completed: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: queueItems.length,
        succeeded: successCount,
        failed: errorCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fatal error in webhook processor:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});