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
    
    if (!code) {
      throw new Error("Authorization code is required");
    }

    if (!redirectUri) {
      throw new Error("Redirect URI is required");
    }

    const MICROSOFT_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID");
    const MICROSOFT_CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET");

    console.log("Exchanging code for tokens...");

    // Exchange code for tokens
    const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: MICROSOFT_CLIENT_ID!,
        client_secret: MICROSOFT_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/User.Read offline_access",
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("Token exchange failed:", error);
      throw new Error("Failed to exchange authorization code");
    }

    const tokens = await tokenResponse.json();
    console.log("Tokens received, fetching user info...");

    // Get user info from Microsoft Graph
    const userInfoResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      const error = await userInfoResponse.text();
      console.error("Failed to fetch user info:", error);
      throw new Error("Failed to fetch user info");
    }

    const userInfo = await userInfoResponse.json();
    console.log("User info received:", userInfo.mail || userInfo.userPrincipalName);

    // Get current user from auth header
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token || "");

    if (!user) {
      throw new Error("Unauthorized");
    }

    const userEmail = userInfo.mail || userInfo.userPrincipalName;
    const userName = userInfo.displayName || userEmail;

    // Check if account already exists
    const { data: existingAccount } = await supabase
      .from("email_accounts")
      .select("id")
      .eq("email", userEmail)
      .eq("user_id", user.id)
      .single();

    let accountId;

    if (existingAccount) {
      accountId = existingAccount.id;
      console.log("Updating existing account:", accountId);
      
      // Update existing account
      await supabase
        .from("email_accounts")
        .update({
          name: userName,
          is_active: true,
        })
        .eq("id", accountId);
    } else {
      console.log("Creating new account for:", userEmail);
      
      // Insert new account
      const { data: newAccount, error: accountError } = await supabase
        .from("email_accounts")
        .insert({
          user_id: user.id,
          provider: "outlook",
          email: userEmail,
          name: userName,
        })
        .select()
        .single();

      if (accountError) {
        console.error("Account creation error:", accountError);
        throw accountError;
      }
      accountId = newAccount.id;
    }

    // Store tokens
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    
    console.log("Storing OAuth tokens...");
    const { error: tokenError } = await supabase
      .from("oauth_tokens")
      .upsert({
        account_id: accountId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        scope: tokens.scope,
      });

    if (tokenError) {
      console.error("Token storage error:", tokenError);
      throw tokenError;
    }

    // Queue initial sync
    console.log("Queuing initial sync job...");
    const { error: syncError } = await supabase
      .from("sync_jobs")
      .insert({
        account_id: accountId,
        status: "pending",
      });

    if (syncError) {
      console.error("Sync job creation error:", syncError);
    }

    console.log("Outlook OAuth completed successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        account: {
          id: accountId,
          email: userEmail,
          name: userName,
          provider: "outlook"
        }
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Outlook OAuth error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
