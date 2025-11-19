import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { code, redirectUri } = await req.json();
    
    if (!redirectUri) {
      throw new Error("Redirect URI is required");
    }

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

    // If no code, generate and return the auth URL
    if (!code) {
      console.log("Generating OAuth URL for redirect URI:", redirectUri);
      
      const scopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ].join(' ');

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `access_type=offline&` +
        `prompt=consent`;

      return new Response(
        JSON.stringify({ authUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("Token exchange failed:", error);
      throw new Error("Failed to exchange authorization code");
    }

    const tokens = await tokenResponse.json();

    // Get user info
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw new Error("Failed to fetch user info");
    }

    const userInfo = await userInfoResponse.json();

    // Get current user from auth header
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token || "");

    if (!user) {
      throw new Error("Unauthorized");
    }

    // Check if account already exists
    const { data: existingAccount } = await supabase
      .from("email_accounts")
      .select("id")
      .eq("email", userInfo.email)
      .eq("user_id", user.id)
      .single();

    let accountId;

    if (existingAccount) {
      accountId = existingAccount.id;
      
      // Update existing account
      await supabase
        .from("email_accounts")
        .update({
          name: userInfo.name,
          picture_url: userInfo.picture,
          is_active: true,
        })
        .eq("id", accountId);
    } else {
      // Insert new account
      const { data: newAccount, error: accountError } = await supabase
        .from("email_accounts")
        .insert({
          user_id: user.id,
          provider: "gmail",
          email: userInfo.email,
          name: userInfo.name,
          picture_url: userInfo.picture,
        })
        .select()
        .single();

      if (accountError) throw accountError;
      accountId = newAccount.id;
    }

    // Store tokens
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    
    const { error: tokenError } = await supabase
      .from("oauth_tokens")
      .upsert({
        account_id: accountId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        scope: tokens.scope,
      });

    if (tokenError) throw tokenError;

    // Set up Gmail watch for push notifications
    const GOOGLE_PROJECT_ID = Deno.env.get("GOOGLE_PROJECT_ID");
    
    if (GOOGLE_PROJECT_ID) {
      try {
        console.log("Setting up Gmail watch for push notifications...");
        
        const watchResponse = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/watch",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              topicName: `projects/${GOOGLE_PROJECT_ID}/topics/gmail-notifications`,
              labelIds: ["INBOX", "SENT", "DRAFT", "SPAM", "TRASH"],
            }),
          }
        );

        if (watchResponse.ok) {
          const watchData = await watchResponse.json();
          console.log("Gmail watch created:", watchData);

          // Store watch info in database
          const expiresAt = new Date(Number(watchData.expiration));
          
          await supabase.from("gmail_watches").upsert({
            account_id: accountId,
            history_id: watchData.historyId,
            expiration: expiresAt.toISOString(),
            is_active: true,
          });

          console.log("Watch info stored in database");
        } else {
          const error = await watchResponse.text();
          console.error("Failed to create watch:", error);
        }
      } catch (watchError) {
        console.error("Error setting up watch:", watchError);
        // Continue even if watch setup fails
      }
    } else {
      console.log("GOOGLE_PROJECT_ID not set, skipping watch setup");
    }

    // Trigger initial sync
    await supabase.from("sync_jobs").insert({
      account_id: accountId,
      status: "pending",
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        account: { id: accountId, email: userInfo.email, name: userInfo.name }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Gmail OAuth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
