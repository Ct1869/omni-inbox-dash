import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle Microsoft Graph validation token (GET request during subscription setup)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const validationToken = url.searchParams.get('validationToken');
      
      if (validationToken) {
        console.log('Validation token received:', validationToken);
        return new Response(validationToken, {
          headers: { 
            'Content-Type': 'text/plain',
            ...corsHeaders 
          },
        });
      }
    }

    // Handle webhook notification (POST request)
    if (req.method === 'POST') {
      const payload = await req.json();
      console.log('Received webhook:', JSON.stringify(payload, null, 2));

      // Microsoft Graph sends an array of notifications
      const notifications = payload.value || [];

      for (const notification of notifications) {
        const { subscriptionId, changeType, resource, resourceData } = notification;
        
        console.log(`Processing notification for subscription: ${subscriptionId}`);

        // Find the account associated with this subscription
        const { data: subscription } = await supabase
          .from('outlook_subscriptions')
          .select('account_id, account:email_accounts!outlook_subscriptions_account_id_fkey(email)')
          .eq('subscription_id', subscriptionId)
          .eq('is_active', true)
          .single();

        if (!subscription) {
          console.error(`No active subscription found for ID: ${subscriptionId}`);
          continue;
        }

        const accountId = subscription.account_id;
        const emailAddress = (subscription.account as any)?.email;

        if (!emailAddress) {
          console.error(`No email address found for account ID: ${accountId}`);
          continue;
        }

        console.log(`Found account ${accountId} for ${emailAddress}`);

        // Queue the webhook for processing
        const { error: queueError } = await supabase
          .from('webhook_queue')
          .insert({
            account_id: accountId,
            email_address: emailAddress,
            history_id: resourceData?.id || 'outlook-notification',
            provider: 'outlook',
            change_type: changeType,
            status: 'pending',
          });

        if (queueError) {
          console.error('Error queuing webhook:', queueError);
          throw queueError;
        }

        console.log(`Webhook queued for processing: ${emailAddress}`);
      }

      // Return 202 Accepted immediately (Microsoft expects quick response)
      return new Response(
        JSON.stringify({ message: 'Webhook received', processed: notifications.length }),
        {
          status: 202,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
