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
  provider?: string;
  change_type?: string;
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
    // Increased limit to process more items in parallel
    const { data: queueItems, error: fetchError } = await supabase
      .from('webhook_queue')
      .select('*')
      .eq('status', 'pending')
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
      .order('created_at', { ascending: true })
      .limit(100); // Increased from 10 to 100 to handle more webhooks

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

    // Group webhooks by account for better processing
    const byAccount = new Map<string, WebhookQueueItem[]>();
    queueItems.forEach(item => {
      if (!byAccount.has(item.account_id)) {
        byAccount.set(item.account_id, []);
      }
      byAccount.get(item.account_id)!.push(item);
    });

    console.log(`Grouped into ${byAccount.size} accounts`);

    let successCount = 0;
    let errorCount = 0;

    // Process up to 10 accounts in parallel
    const CONCURRENT_ACCOUNTS = 10;
    const accountBatches = Array.from(byAccount.entries());

    for (let i = 0; i < accountBatches.length; i += CONCURRENT_ACCOUNTS) {
      const batch = accountBatches.slice(i, i + CONCURRENT_ACCOUNTS);

      await Promise.allSettled(
        batch.map(async ([accountId, items]) => {
          // Process all webhooks for this account sequentially (to preserve order)
          for (const item of items) {
            try {
              // Mark as processing
              await supabase
                .from('webhook_queue')
                .update({ status: 'processing' })
                .eq('id', item.id);

              console.log(`Processing ${item.provider || 'gmail'} webhook for ${item.email_address}, history_id: ${item.history_id}`);

              // Route to appropriate webhook handler based on provider
              const provider = item.provider || 'gmail';
              const functionName = provider === 'outlook' ? 'outlook-webhook' : 'gmail-webhook';

              const webhookPayload = provider === 'outlook'
                ? {
                    value: [{
                      subscriptionId: item.history_id,
                      changeType: item.change_type || 'created,updated',
                      resourceData: { id: item.history_id }
                    }]
                  }
                : {
                    message: {
                      data: btoa(JSON.stringify({
                        emailAddress: item.email_address,
                        historyId: item.history_id,
                      })),
                    },
                  };

              const { error: webhookError } = await supabase.functions.invoke(functionName, {
                body: webhookPayload,
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

            } catch (error) {
              errorCount++;
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';

              const retryCount = item.retry_count + 1;
              const maxRetries = 3;

              if (retryCount >= maxRetries) {
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
                const delaySeconds = Math.pow(2, retryCount) * 60;
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
              }
            }
          }
        })
      );

      // Small delay between batches to avoid overwhelming the system
      if (i + CONCURRENT_ACCOUNTS < accountBatches.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
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