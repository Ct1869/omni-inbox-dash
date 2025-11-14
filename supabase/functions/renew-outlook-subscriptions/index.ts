import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Refresh Microsoft OAuth access token
async function refreshAccessToken(refreshToken: string) {
  const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID');
  const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET');

  const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID!,
      client_secret: MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting Outlook subscription renewal process...');

    // Find subscriptions expiring within 24 hours
    const twentyFourHoursFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const { data: expiringSubscriptions, error: fetchError } = await supabase
      .from('outlook_subscriptions')
      .select('*, account:email_accounts(id, email, oauth_tokens(*))')
      .eq('is_active', true)
      .lt('expiration', twentyFourHoursFromNow.toISOString());

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      throw fetchError;
    }

    if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
      console.log('No subscriptions need renewal');
      return new Response(
        JSON.stringify({ message: 'No subscriptions need renewal', renewed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiringSubscriptions.length} subscriptions to renew`);

    let renewedCount = 0;
    let failedCount = 0;

    for (const subscription of expiringSubscriptions) {
      try {
        const account = subscription.account;
        if (!account || !account.oauth_tokens) {
          console.error(`No account or tokens for subscription ${subscription.subscription_id}`);
          failedCount++;
          continue;
        }

        const tokens = account.oauth_tokens;

        // Check if token is expired and refresh if needed
        let accessToken = tokens.access_token;
        const expiresAt = new Date(tokens.expires_at);
        
        if (expiresAt < new Date()) {
          console.log(`Refreshing access token for ${account.email}`);
          const newTokens = await refreshAccessToken(tokens.refresh_token);
          accessToken = newTokens.access_token;
          
          // Update stored tokens
          await supabase
            .from('oauth_tokens')
            .update({
              access_token: newTokens.access_token,
              expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
            })
            .eq('account_id', account.id);
        }

        // Renew the subscription (extend expiration by 3 days - max for personal accounts)
        const newExpiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        
        const renewResponse = await fetch(
          `https://graph.microsoft.com/v1.0/subscriptions/${subscription.subscription_id}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              expirationDateTime: newExpiration.toISOString(),
            }),
          }
        );

        if (!renewResponse.ok) {
          const error = await renewResponse.text();
          console.error(`Failed to renew subscription ${subscription.subscription_id}:`, error);
          
          // Mark subscription as inactive if renewal fails
          await supabase
            .from('outlook_subscriptions')
            .update({ is_active: false })
            .eq('id', subscription.id);
          
          failedCount++;
          continue;
        }

        // Update subscription expiration in database
        await supabase
          .from('outlook_subscriptions')
          .update({ 
            expiration: newExpiration.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);

        console.log(`Successfully renewed subscription for ${account.email}`);
        renewedCount++;

      } catch (error) {
        console.error(`Error renewing subscription:`, error);
        failedCount++;
      }
    }

    console.log(`Renewal complete: ${renewedCount} renewed, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        message: 'Renewal process complete',
        renewed: renewedCount,
        failed: failedCount,
        total: expiringSubscriptions.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Renewal error:', error);
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
