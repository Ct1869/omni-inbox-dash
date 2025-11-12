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

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

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
