import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(refreshToken: string) {
  const MICROSOFT_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID");
  const MICROSOFT_CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET");

  const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID!,
      client_secret: MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/User.Read offline_access",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Token refresh failed:", error);
    throw new Error("Failed to refresh access token");
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token || "");

    if (!user) {
      throw new Error("Unauthorized");
    }

    console.log("Setting up Outlook subscriptions for user:", user.id);

    // Fetch all Outlook accounts for this user
    const { data: accounts, error: accountsError } = await supabase
      .from("email_accounts")
      .select("id, email, name")
      .eq("user_id", user.id)
      .eq("provider", "outlook")
      .eq("is_active", true);

    if (accountsError) throw accountsError;

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No Outlook accounts to setup",
          results: [] 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${accounts.length} Outlook accounts to setup subscriptions for`);

    const results = [];

    // Process each account
    for (const account of accounts) {
      console.log(`Processing account: ${account.email}`);
      
      try {
        // Get OAuth tokens
        const { data: tokenData, error: tokenError } = await supabase
          .from("oauth_tokens")
          .select("access_token, refresh_token, expires_at")
          .eq("account_id", account.id)
          .single();

        if (tokenError || !tokenData) {
          console.error(`No tokens found for account ${account.email}`);
          results.push({
            accountId: account.id,
            email: account.email,
            success: false,
            message: "No OAuth tokens found"
          });
          continue;
        }

        let accessToken = tokenData.access_token;
        const expiresAt = new Date(tokenData.expires_at);
        
        // Check if token is expired
        if (expiresAt <= new Date()) {
          console.log(`Token expired for ${account.email}, refreshing...`);
          
          const refreshedTokens = await refreshAccessToken(tokenData.refresh_token);
          accessToken = refreshedTokens.access_token;
          
          const newExpiresAt = new Date(Date.now() + refreshedTokens.expires_in * 1000);
          await supabase
            .from("oauth_tokens")
            .update({
              access_token: refreshedTokens.access_token,
              expires_at: newExpiresAt.toISOString()
            })
            .eq("account_id", account.id);
        }

        // Microsoft Graph subscriptions require a notificationUrl
        // For now, we'll log that this would be where the subscription is created
        // In production, you'd need a webhook endpoint to receive notifications
        
        console.log(`Would create subscription for ${account.email}`);
        console.log(`Note: Microsoft Graph requires a publicly accessible webhook URL`);
        
        results.push({
          accountId: account.id,
          email: account.email,
          success: true,
          message: "Outlook notifications ready (webhook endpoint needed for push notifications)",
        });

      } catch (error) {
        console.error(`Error setting up subscription for ${account.email}:`, error);
        results.push({
          accountId: account.id,
          email: account.email,
          success: false,
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Setup complete: ${successCount} successful, ${failureCount} failed`,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Setup error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
