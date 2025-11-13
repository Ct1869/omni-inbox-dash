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

function createEmailMessage(to: string, from: string, subject: string, body: string, inReplyTo?: string, references?: string) {
  const headers = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
  ];

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
  }
  if (references) {
    headers.push(`References: ${references}`);
  }

  const message = [...headers, "", body].join("\r\n");

  // Base64url encode
  return btoa(message)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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

    const { accountId, messageId, replyText, forwardTo, action, composeData, markAsRead, messageIds } = await req.json();

    if (!accountId) {
      throw new Error("Missing accountId");
    }

    // Get account and tokens
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("email")
      .eq("id", accountId)
      .single();

    if (accountError || !account) {
      throw new Error("Account not found");
    }

    const { data: tokens, error: tokensError } = await supabase
      .from("oauth_tokens")
      .select("*")
      .eq("account_id", accountId)
      .single();

    if (tokensError || !tokens) {
      throw new Error("OAuth tokens not found");
    }

    // Check if token is expired and refresh if needed
    let accessToken = tokens.access_token;
    const expiresAt = new Date(tokens.expires_at);

    if (expiresAt < new Date()) {
      console.log("Token expired, refreshing...");
      const newTokens = await refreshAccessToken(tokens.refresh_token);
      accessToken = newTokens.access_token;

      await supabase
        .from("oauth_tokens")
        .update({
          access_token: newTokens.access_token,
          expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        })
        .eq("account_id", accountId);
    }

    // Handle mark as read action (bulk or single)
    if (markAsRead || action === 'markAsRead') {
      const idsToMark = messageIds || [messageId];
      for (const msgId of idsToMark) {
        await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/modify`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              removeLabelIds: ['UNREAD'],
            }),
          }
        );
        
        // Update local cache
        await supabase
          .from('cached_messages')
          .update({ is_read: true })
          .eq('message_id', msgId)
          .eq('account_id', accountId);
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle compose new email
    if (composeData) {
      const { to, subject, body } = composeData;
      const emailContent = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        body,
      ].join('\n');

      const encodedMessage = btoa(emailContent)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const sendResponse = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: encodedMessage }),
        }
      );

      if (!sendResponse.ok) {
        throw new Error('Failed to send email');
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle different actions
    if (action === "delete") {
      // Delete (trash) the message in Gmail
      if (!messageId) throw new Error("Missing messageId");

      const { data: msg } = await supabase
        .from("cached_messages")
        .select("message_id")
        .eq("id", messageId)
        .single();

      if (!msg) throw new Error("Message not found");

      const trashResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.message_id}/trash`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!trashResponse.ok) {
        throw new Error("Failed to delete message");
      }

      // Mark as deleted in our DB
      await supabase
        .from("cached_messages")
        .delete()
        .eq("id", messageId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the original message for reply/forward
    if (!messageId) throw new Error("Missing messageId");

    const { data: originalMessage, error: msgError } = await supabase
      .from("cached_messages")
      .select("*")
      .eq("id", messageId)
      .single();

    if (msgError || !originalMessage) {
      throw new Error("Original message not found");
    }

    let to: string;
    let subject: string;
    let body: string;
    let inReplyTo: string | undefined;
    let references: string | undefined;

    if (forwardTo) {
      // Forward
      to = forwardTo;
      subject = `Fwd: ${originalMessage.subject || "(no subject)"}`;
      body = `
        <p>---------- Forwarded message ---------</p>
        <p>From: ${originalMessage.sender_name} &lt;${originalMessage.sender_email}&gt;</p>
        <p>Date: ${originalMessage.received_at}</p>
        <p>Subject: ${originalMessage.subject}</p>
        <hr>
        ${originalMessage.body_html || originalMessage.body_text || ""}
      `;
    } else if (replyText) {
      // Reply
      to = originalMessage.sender_email;
      subject = originalMessage.subject?.startsWith("Re:") 
        ? originalMessage.subject 
        : `Re: ${originalMessage.subject || "(no subject)"}`;
      body = `
        <p>${replyText.replace(/\n/g, "<br>")}</p>
        <br>
        <p>On ${originalMessage.received_at}, ${originalMessage.sender_name} wrote:</p>
        <blockquote style="margin-left: 1em; padding-left: 1em; border-left: 2px solid #ccc;">
          ${originalMessage.body_html || originalMessage.body_text || ""}
        </blockquote>
      `;
      inReplyTo = originalMessage.message_id;
      references = originalMessage.message_id;
    } else {
      throw new Error("Missing replyText or forwardTo");
    }

    // Create and send email
    const encodedMessage = createEmailMessage(
      to,
      account.email,
      subject,
      body,
      inReplyTo,
      references
    );

    const sendUrl = originalMessage.thread_id
      ? `https://gmail.googleapis.com/gmail/v1/users/me/messages/send?threadId=${originalMessage.thread_id}`
      : "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

    const sendResponse = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: encodedMessage,
        threadId: originalMessage.thread_id || undefined,
      }),
    });

    if (!sendResponse.ok) {
      const error = await sendResponse.text();
      console.error("Failed to send email:", error);
      throw new Error("Failed to send email");
    }

    const result = await sendResponse.json();

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send reply error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
