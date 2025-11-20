import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(refreshToken: string) {
  const OUTLOOK_CLIENT_ID = Deno.env.get("OUTLOOK_CLIENT_ID");
  const OUTLOOK_CLIENT_SECRET = Deno.env.get("OUTLOOK_CLIENT_SECRET");
  const OUTLOOK_REDIRECT_URI = Deno.env.get("OUTLOOK_REDIRECT_URI");

  const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: OUTLOOK_CLIENT_ID!,
      client_secret: OUTLOOK_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      redirect_uri: OUTLOOK_REDIRECT_URI!,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Token refresh failed:", error);
    throw new Error("Failed to refresh Outlook token");
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

    // Handle mark as read action
    if (markAsRead || action === 'markAsRead') {
      const idsToMark = messageIds || [messageId];

      for (const msgId of idsToMark) {
        const { data: msg } = await supabase
          .from('cached_messages')
          .select('message_id')
          .eq('id', msgId)
          .eq('account_id', accountId)
          .single();

        if (msg?.message_id) {
          await fetch(
            `https://graph.microsoft.com/v1.0/me/messages/${msg.message_id}`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                isRead: true,
              }),
            }
          );

          await supabase
            .from('cached_messages')
            .update({ is_read: true })
            .eq('id', msgId)
            .eq('account_id', accountId);
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle compose new email
    if (composeData) {
      const { to, subject, body } = composeData;

      const message = {
        subject: subject,
        body: {
          contentType: "HTML",
          content: body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
      };

      const sendResponse = await fetch(
        'https://graph.microsoft.com/v1.0/me/sendMail',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message }),
        }
      );

      if (!sendResponse.ok) {
        const errorText = await sendResponse.text();
        console.error("Failed to send Outlook email:", errorText);
        throw new Error('Failed to send email');
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle delete action
    if (action === "delete") {
      const idsToDelete = messageIds || [messageId];

      if (idsToDelete.length === 0) {
        throw new Error("No message IDs provided");
      }

      console.log(`Deleting ${idsToDelete.length} Outlook messages for account ${accountId}`);

      const { data: msgs, error: fetchError } = await supabase
        .from("cached_messages")
        .select("id, message_id")
        .in("id", idsToDelete)
        .eq("account_id", accountId);

      if (fetchError) {
        console.error("Error fetching messages:", fetchError);
        throw new Error("Failed to fetch messages");
      }

      if (!msgs || msgs.length === 0) {
        throw new Error("Messages not found");
      }

      const deletePromises = msgs.map(async (msg) => {
        try {
          const deleteResponse = await fetch(
            `https://graph.microsoft.com/v1.0/me/messages/${msg.message_id}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          if (!deleteResponse.ok) {
            const errorText = await deleteResponse.text();
            console.error(`Failed to delete Outlook message ${msg.message_id}:`, errorText);
            return { id: msg.id, success: false, error: errorText };
          }

          console.log(`Successfully deleted Outlook message ${msg.message_id}`);
          return { id: msg.id, success: true };
        } catch (err) {
          console.error(`Error deleting Outlook message ${msg.message_id}:`, err);
          const errorMsg = err instanceof Error ? err.message : String(err);
          return { id: msg.id, success: false, error: errorMsg };
        }
      });

      const results = await Promise.all(deletePromises);
      const successIds = results.filter(r => r.success).map(r => r.id);

      if (successIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("cached_messages")
          .delete()
          .in("id", successIds);

        if (deleteError) {
          console.error("Error deleting from cache:", deleteError);
        } else {
          console.log(`Deleted ${successIds.length} messages from cache`);
        }
      }

      const failedCount = results.filter(r => !r.success).length;

      return new Response(
        JSON.stringify({
          success: true,
          deleted: successIds.length,
          failed: failedCount
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle reply
    if (replyText && messageId) {
      const { data: originalMsg } = await supabase
        .from("cached_messages")
        .select("message_id, subject, sender_email")
        .eq("id", messageId)
        .eq("account_id", accountId)
        .single();

      if (!originalMsg?.message_id) {
        throw new Error("Original message not found");
      }

      const replyMessage = {
        comment: replyText,
      };

      const replyResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${originalMsg.message_id}/reply`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(replyMessage),
        }
      );

      if (!replyResponse.ok) {
        const errorText = await replyResponse.text();
        console.error("Failed to reply to Outlook email:", errorText);
        throw new Error('Failed to send reply');
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle forward
    if (forwardTo && messageId) {
      const { data: originalMsg } = await supabase
        .from("cached_messages")
        .select("message_id")
        .eq("id", messageId)
        .eq("account_id", accountId)
        .single();

      if (!originalMsg?.message_id) {
        throw new Error("Original message not found");
      }

      const forwardMessage = {
        toRecipients: [
          {
            emailAddress: {
              address: forwardTo,
            },
          },
        ],
      };

      const forwardResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${originalMsg.message_id}/forward`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(forwardMessage),
        }
      );

      if (!forwardResponse.ok) {
        const errorText = await forwardResponse.text();
        console.error("Failed to forward Outlook email:", errorText);
        throw new Error('Failed to forward email');
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
    throw new Error("Invalid action");
  } catch (err: any) {
    console.error("Send Outlook reply error:", err);

    const errorMessage = err.message || "Failed to process request";
    const isAuthError = errorMessage.includes("Failed to refresh Outlook token") ||
      errorMessage.includes("invalid_grant") ||
      errorMessage.includes("unauthorized_client");

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: isAuthError ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
