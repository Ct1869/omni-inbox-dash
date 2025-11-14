import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(refreshToken: string) {
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
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

    // Get current user from auth header
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token || "");

    if (!user) {
      throw new Error("Unauthorized");
    }

    console.log("Setting up Gmail watches for user:", user.id);

    const GOOGLE_PROJECT_ID = Deno.env.get("GOOGLE_PROJECT_ID");
    
    if (!GOOGLE_PROJECT_ID) {
      throw new Error("GOOGLE_PROJECT_ID not configured");
    }

    // Fetch all GMAIL accounts for this user
    const { data: accounts, error: accountsError } = await supabase
      .from("email_accounts")
      .select("id, email, name")
      .eq("user_id", user.id)
      .eq("provider", "gmail")
      .eq("is_active", true);

    if (accountsError) throw accountsError;

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No accounts to setup",
          results: [] 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${accounts.length} accounts to setup watches for`);

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
          
          // Update token in database
          const newExpiresAt = new Date(Date.now() + refreshedTokens.expires_in * 1000);
          await supabase
            .from("oauth_tokens")
            .update({
              access_token: refreshedTokens.access_token,
              expires_at: newExpiresAt.toISOString(),
            })
            .eq("account_id", account.id);
          
          console.log(`Token refreshed for ${account.email}`);
        }

        // Create Gmail watch
        console.log(`Creating Gmail watch for ${account.email}...`);
        
        const watchResponse = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/watch",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              topicName: `projects/${GOOGLE_PROJECT_ID}/topics/gmail-notifications`,
              labelIds: ["INBOX", "SENT", "DRAFT", "SPAM", "TRASH"],
            }),
          }
        );

        if (!watchResponse.ok) {
          const error = await watchResponse.text();
          console.error(`Failed to create watch for ${account.email}:`, error);
          
          results.push({
            accountId: account.id,
            email: account.email,
            success: false,
            message: `Gmail API error: ${error.substring(0, 100)}`
          });
          continue;
        }

        const watchData = await watchResponse.json();
        console.log(`Watch created for ${account.email}:`, watchData);

        // Store watch info in database
        const expirationDate = new Date(Number(watchData.expiration));
        
        const { error: watchError } = await supabase
          .from("gmail_watches")
          .upsert({
            account_id: account.id,
            history_id: watchData.historyId,
            expiration: expirationDate.toISOString(),
            is_active: true,
          });

        if (watchError) {
          console.error(`Failed to store watch for ${account.email}:`, watchError);
          results.push({
            accountId: account.id,
            email: account.email,
            success: false,
            message: "Watch created but failed to store in database"
          });
          continue;
        }

        console.log(`Watch successfully registered for ${account.email}`);
        
        results.push({
          accountId: account.id,
          email: account.email,
          success: true,
          message: "Push notifications enabled",
          watchExpiration: expirationDate.toISOString()
        });

      } catch (accountError) {
        console.error(`Error processing account ${account.email}:`, accountError);
        results.push({
          accountId: account.id,
          email: account.email,
          success: false,
          message: accountError instanceof Error ? accountError.message : "Unknown error"
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Setup complete: ${successCount} successful, ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Setup complete: ${successCount} successful, ${failCount} failed`,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Setup Gmail watches error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
