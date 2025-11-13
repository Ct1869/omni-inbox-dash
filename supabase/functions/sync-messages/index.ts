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
    throw new Error("Failed to refresh token");
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

    const { accountId } = await req.json();

    // Create sync job
    const { data: syncJob } = await supabase
      .from("sync_jobs")
      .insert({
        account_id: accountId,
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Get account and tokens
    const { data: account } = await supabase
      .from("email_accounts")
      .select("*, oauth_tokens(*)")
      .eq("id", accountId)
      .single();

    if (!account || !account.oauth_tokens) {
      if (syncJob) {
        await supabase
          .from("sync_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: "Account or tokens not found",
          })
          .eq("id", syncJob.id);
      }
      throw new Error("Account or tokens not found");
    }

    const tokens = account.oauth_tokens;
    
    // Check if token is expired
    let accessToken = tokens.access_token;
    const expiresAt = new Date(tokens.expires_at);
    
    if (expiresAt < new Date()) {
      console.log("Token expired, refreshing...");
      const newTokens = await refreshAccessToken(tokens.refresh_token);
      accessToken = newTokens.access_token;
      
      // Update stored tokens
      await supabase
        .from("oauth_tokens")
        .update({
          access_token: newTokens.access_token,
          expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        })
        .eq("account_id", accountId);
    }

    // Fetch messages from Gmail (last 100) - ALL messages, not just INBOX
    const gmailResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!gmailResponse.ok) {
      throw new Error("Failed to fetch messages from Gmail");
    }

    const { messages } = await gmailResponse.json();
    
    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let syncedCount = 0;

    // Fetch full message details in batches
    for (const message of messages.slice(0, 50)) { // Limit to 50 for now
      try {
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!detailResponse.ok) continue;

        const detail = await detailResponse.json();
        const headers = detail.payload.headers;

        const getHeader = (name: string) => 
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

        const subject = getHeader("Subject");
        const from = getHeader("From");
        const to = getHeader("To");
        const date = getHeader("Date");

        // Parse sender email and name
        const fromMatch = from.match(/(.+?)\s*<(.+?)>/) || [null, from, from];
        const senderName = fromMatch[1]?.trim() || "";
        const senderEmail = fromMatch[2]?.trim() || from;

        // Get message body - handle nested parts recursively
        let bodyHtml = "";
        let bodyText = "";
        
        function extractBody(payload: any) {
          if (payload.body?.data) {
            const decoded = atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
            if (payload.mimeType === "text/html") {
              bodyHtml = bodyHtml || decoded;
            } else if (payload.mimeType === "text/plain") {
              bodyText = bodyText || decoded;
            }
          }
          
          if (payload.parts) {
            for (const part of payload.parts) {
              extractBody(part);
            }
          }
        }
        
        extractBody(detail.payload);
        
        // Fallback to snippet if no body found
        if (!bodyHtml && !bodyText) {
          bodyText = detail.snippet || "";
        }

        const isUnread = detail.labelIds?.includes("UNREAD") || false;
        const isStarred = detail.labelIds?.includes("STARRED") || false;
        const hasAttachments = detail.payload.parts?.some((p: any) => p.filename) || false;
        const attachmentCount = detail.payload.parts?.filter((p: any) => p.filename).length || 0;

        // Upsert message
        await supabase
          .from("cached_messages")
          .upsert({
            account_id: accountId,
            message_id: detail.id,
            thread_id: detail.threadId,
            subject,
            snippet: detail.snippet,
            sender_name: senderName,
            sender_email: senderEmail,
            recipient_emails: [to],
            body_html: bodyHtml,
            body_text: bodyText,
            is_read: !isUnread,
            is_starred: isStarred,
            has_attachments: hasAttachments,
            attachment_count: attachmentCount,
            labels: detail.labelIds || [],
            received_at: new Date(date || Date.now()).toISOString(),
          }, {
            onConflict: "account_id,message_id",
          });

        syncedCount++;

        // Update sync job progress
        if (syncJob) {
          await supabase
            .from("sync_jobs")
            .update({
              messages_synced: syncedCount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", syncJob.id);
        }
      } catch (err) {
        console.error("Error syncing message:", err);
      }
    }

    // Update account last synced time and unread count
    const { data: unreadMessages } = await supabase
      .from("cached_messages")
      .select("id", { count: "exact" })
      .eq("account_id", accountId)
      .eq("is_read", false);

    await supabase
      .from("email_accounts")
      .update({
        last_synced_at: new Date().toISOString(),
        unread_count: unreadMessages?.length || 0,
      })
      .eq("id", accountId);

    // Mark sync job as completed
    if (syncJob) {
      await supabase
        .from("sync_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          messages_synced: syncedCount,
        })
        .eq("id", syncJob.id);
    }

    return new Response(
      JSON.stringify({ success: true, synced: syncedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);

    // Mark sync job as failed
    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      
      const requestBody = await req.clone().json();
      const { accountId } = requestBody;
      
      const { data: recentJob } = await supabaseClient
        .from("sync_jobs")
        .select("id")
        .eq("account_id", accountId)
        .eq("status", "running")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (recentJob) {
        await supabaseClient
          .from("sync_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", recentJob.id);
      }
    } catch (err) {
      console.error("Error updating sync job on failure:", err);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
