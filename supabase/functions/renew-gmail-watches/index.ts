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
    const errorData = await response.json().catch(() => ({}));
    console.error("Google token refresh failed:", {
      status: response.status,
      statusText: response.statusText,
      error: errorData
    });
    throw new Error(`Failed to refresh token: ${errorData.error || response.statusText}`);
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

    console.log("Starting watch renewal process...");

    // Find watches expiring within 24 hours
    const expirationThreshold = new Date();
    expirationThreshold.setHours(expirationThreshold.getHours() + 24);

    const { data: expiringWatches, error: watchError } = await supabase
      .from("gmail_watches")
      .select(`
        id,
        account_id,
        expiration,
        email_accounts!inner(email)
      `)
      .eq("is_active", true)
      .lt("expiration", expirationThreshold.toISOString());

    if (watchError) {
      console.error("Error fetching watches:", watchError);
      throw watchError;
    }

    console.log(`Found ${expiringWatches?.length || 0} watches to renew`);

    let renewed = 0;
    let failed = 0;

    for (const watch of expiringWatches || []) {
      try {
        console.log(`Renewing watch for account ${watch.account_id}...`);

        // Get OAuth tokens
        const { data: tokens } = await supabase
          .from("oauth_tokens")
          .select("access_token, refresh_token, expires_at")
          .eq("account_id", watch.account_id)
          .single();

        if (!tokens) {
          console.error(`No tokens found for account ${watch.account_id}`);
          failed++;
          continue;
        }

        // Check if token needs refresh
        let accessToken = tokens.access_token;
        if (new Date(tokens.expires_at) <= new Date()) {
          console.log("Token expired, refreshing...");
          const newTokens = await refreshAccessToken(tokens.refresh_token);
          accessToken = newTokens.access_token;

          const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
          await supabase
            .from("oauth_tokens")
            .update({
              access_token: newTokens.access_token,
              expires_at: expiresAt.toISOString(),
            })
            .eq("account_id", watch.account_id);
        }

        // Renew watch
        const GOOGLE_PROJECT_ID = Deno.env.get("GOOGLE_PROJECT_ID");
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
          console.error(`Failed to renew watch: ${error}`);
          failed++;
          continue;
        }

        const watchData = await watchResponse.json();
        console.log("Watch renewed:", watchData);

        // Update watch in database
        const expiresAt = new Date(Number(watchData.expiration));
        await supabase
          .from("gmail_watches")
          .update({
            history_id: watchData.historyId,
            expiration: expiresAt.toISOString(),
          })
          .eq("id", watch.id);

        renewed++;
        console.log(`Successfully renewed watch for account ${watch.account_id}`);
      } catch (error) {
        console.error(`Error renewing watch for account ${watch.account_id}:`, error);
        failed++;
        
        // If token refresh failed with invalid_grant, mark account as inactive
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("invalid_grant") || errorMessage.includes("Token has been expired or revoked")) {
          console.log(`Marking account ${watch.account_id} as inactive due to auth error`);
          await supabase
            .from("email_accounts")
            .update({ is_active: false })
            .eq("id", watch.account_id);
          
          // Deactivate the watch
          await supabase
            .from("gmail_watches")
            .update({ is_active: false })
            .eq("id", watch.id);
        }
      }
    }

    console.log(`Renewal complete: ${renewed} renewed, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        renewed,
        failed,
        total: (expiringWatches?.length || 0),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Watch renewal error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
