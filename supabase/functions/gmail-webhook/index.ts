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

    // Parse the Pub/Sub message
    const body = await req.json();
    console.log("Received webhook:", JSON.stringify(body, null, 2));

    // Pub/Sub sends base64 encoded data
    const message = body.message;
    if (!message || !message.data) {
      console.log("No message data found, ignoring");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode the message
    const decodedData = JSON.parse(atob(message.data));
    console.log("Decoded message:", decodedData);

    const { emailAddress, historyId } = decodedData;

    if (!emailAddress || !historyId) {
      console.log("Missing emailAddress or historyId");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the account
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("id")
      .eq("email", emailAddress)
      .single();

    if (accountError || !account) {
      console.log(`Account not found for email: ${emailAddress}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found account ${account.id} for ${emailAddress}`);

    // Get watch info and OAuth tokens
    const { data: watch } = await supabase
      .from("gmail_watches")
      .select("history_id")
      .eq("account_id", account.id)
      .single();

    const { data: tokens } = await supabase
      .from("oauth_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("account_id", account.id)
      .single();

    if (!tokens) {
      console.log("No OAuth tokens found");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        .eq("account_id", account.id);
    }

    // Use History API to get only changes since last sync
    const startHistoryId = watch?.history_id || "1";
    console.log(`Fetching history from ${startHistoryId} to ${historyId}`);

    const historyResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded&historyTypes=messageDeleted`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!historyResponse.ok) {
      console.error("Failed to fetch history:", await historyResponse.text());
      return new Response(JSON.stringify({ success: false }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const historyData = await historyResponse.json();
    console.log(`Found ${historyData.history?.length || 0} history records`);

    // Process new/changed messages
    const messageIds = new Set<string>();
    
    if (historyData.history) {
      for (const record of historyData.history) {
        if (record.messagesAdded) {
          for (const added of record.messagesAdded) {
            messageIds.add(added.message.id);
          }
        }
      }
    }

    console.log(`Processing ${messageIds.size} new/changed messages`);

    // Fetch and store new messages
    let syncedCount = 0;
    for (const messageId of messageIds) {
      try {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!msgResponse.ok) continue;

        const message = await msgResponse.json();

        // Parse message details
        const headers = message.payload.headers;
        const getHeader = (name: string) =>
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

        const subject = getHeader("subject");
        const from = getHeader("from");
        const to = getHeader("to");
        const date = getHeader("date");

        // Extract sender name and email
        const fromMatch = from.match(/^(.*?)\s*<(.+?)>$/) || [null, from, from];
        const senderName = fromMatch[1]?.trim() || null;
        const senderEmail = fromMatch[2]?.trim() || from;

        // Extract recipient emails
        const recipientEmails = to
          .split(",")
          .map((email: string) => {
            const match = email.match(/<(.+?)>/) || [null, email];
            return match[1]?.trim() || email.trim();
          })
          .filter(Boolean);

        // Get body
        let bodyText = "";
        let bodyHtml = "";

        const getBody = (part: any): void => {
          if (part.mimeType === "text/plain" && part.body.data) {
            bodyText = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
          } else if (part.mimeType === "text/html" && part.body.data) {
            bodyHtml = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
          }
          if (part.parts) {
            part.parts.forEach(getBody);
          }
        };

        if (message.payload.body?.data) {
          bodyText = atob(
            message.payload.body.data.replace(/-/g, "+").replace(/_/g, "/")
          );
        } else if (message.payload.parts) {
          message.payload.parts.forEach(getBody);
        }

        const snippet = bodyText.substring(0, 200) || message.snippet || "";

        // Check for attachments
        const hasAttachments = message.payload.parts?.some(
          (part: any) => part.filename && part.body.attachmentId
        ) || false;

        const attachmentCount = hasAttachments
          ? message.payload.parts?.filter(
              (part: any) => part.filename && part.body.attachmentId
            ).length || 0
          : 0;

        // Upsert message
        await supabase.from("cached_messages").upsert({
          account_id: account.id,
          message_id: message.id,
          thread_id: message.threadId,
          subject,
          sender_name: senderName,
          sender_email: senderEmail,
          recipient_emails: recipientEmails,
          body_text: bodyText || null,
          body_html: bodyHtml || null,
          snippet,
          labels: message.labelIds || [],
          is_read: !message.labelIds?.includes("UNREAD"),
          has_attachments: hasAttachments,
          attachment_count: attachmentCount,
          received_at: new Date(date).toISOString(),
        });

        syncedCount++;
      } catch (error) {
        console.error(`Error processing message ${messageId}:`, error);
      }
    }

    // Update watch history ID
    await supabase
      .from("gmail_watches")
      .update({ history_id: historyId.toString() })
      .eq("account_id", account.id);

    // Update account unread count
    const { count } = await supabase
      .from("cached_messages")
      .select("*", { count: "exact", head: true })
      .eq("account_id", account.id)
      .eq("is_read", false);

    await supabase
      .from("email_accounts")
      .update({
        unread_count: count || 0,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    console.log(
      `Sync complete for ${emailAddress}: ${syncedCount} messages synced, ${count} unread`
    );

    return new Response(
      JSON.stringify({ success: true, synced: syncedCount }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
