import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry function with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  operation = 'operation'
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`${operation}: Attempt ${attempt}/${maxRetries}`);
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.error(`${operation}: Attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000;
        console.log(`${operation}: Waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw new Error(`${operation} failed after ${maxRetries} attempts: ${lastError!.message}`);
}

// Rate limiter class to prevent hitting API quotas
class RateLimiter {
  private queue: (() => Promise<any>)[] = [];
  private running = 0;
  private maxConcurrent: number;
  private minDelay: number;

  constructor(maxConcurrent: number, minDelayMs: number) {
    this.maxConcurrent = maxConcurrent;
    this.minDelay = minDelayMs;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.running++;
    try {
      const result = await fn();
      await new Promise(resolve => setTimeout(resolve, this.minDelay));
      return result;
    } finally {
      this.running--;
    }
  }
}

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
    throw new Error("Failed to refresh token");
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let accountId: string | undefined;
  let skipToken: string | null = null;
  let maxMessages = 1000;
  
  try {
    const body = await req.json();
    accountId = body.accountId;
    skipToken = body.skipToken || null;
    maxMessages = body.maxMessages || 1000;
    
    const timeoutMs = 5 * 60 * 1000;
    const startTime = Date.now();
    
    const checkTimeout = () => {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('Sync operation timeout: exceeded 5 minutes');
      }
    };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: syncJob } = await supabase
      .from("sync_jobs")
      .insert({
        account_id: accountId,
        status: "processing",
        started_at: new Date().toISOString(),
        timeout_at: new Date(Date.now() + timeoutMs).toISOString(),
      })
      .select()
      .single();

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

    if (account.provider !== 'outlook') {
      if (syncJob) {
        await supabase
          .from("sync_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: `This sync function only supports Outlook accounts. Account provider is: ${account.provider}`,
          })
          .eq("id", syncJob.id);
      }
      throw new Error(`This sync function only supports Outlook accounts. Account provider is: ${account.provider}`);
    }

    const tokens = account.oauth_tokens;
    
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

    let allMessages = [];
    let nextSkipToken = skipToken;
    let totalFetched = 0;

    // Microsoft Graph API quota: 60 requests per minute per app
    // Using 3 concurrent with 1 sec delay = ~3 req/sec = 180 req/min (well under quota)
    const limiter = new RateLimiter(3, 1000);

    console.log(`Starting Outlook sync for account ${accountId}, max messages: ${maxMessages}`);
    console.log(`Rate limiting: 3 concurrent requests, 1 second delay between requests`);

    while (totalFetched < maxMessages) {
      checkTimeout();

      const pageSize = Math.min(100, maxMessages - totalFetched); // Reduced from 500 to 100 to prevent WORKER_LIMIT
      let url = `https://graph.microsoft.com/v1.0/me/messages?$top=${pageSize}&$select=id,subject,from,toRecipients,ccRecipients,bccRecipients,bodyPreview,body,receivedDateTime,isRead,categories,hasAttachments,conversationId&$orderby=receivedDateTime desc`;

      if (nextSkipToken) {
        url += `&$skiptoken=${nextSkipToken}`;
      }

      const outlookResponse = await limiter.execute(async () => {
        return await retryWithBackoff(
          async () => {
            const response = await fetch(url, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            });

            if (response.status === 429) {
              const retryAfter = response.headers.get('Retry-After');
              const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
              console.log(`Rate limited. Waiting ${waitMs}ms...`);
              await new Promise(resolve => setTimeout(resolve, waitMs));
              throw new Error('Rate limited, retrying...');
            }

            if (!response.ok) {
              throw new Error("Failed to fetch messages from Outlook");
            }

            return response;
          },
          3,
          'Fetch messages from Outlook'
        );
      });

      const data = await outlookResponse.json();

      if (!data.value || data.value.length === 0) {
        console.log("No more messages to fetch");
        break;
      }

      allMessages.push(...data.value);
      totalFetched += data.value.length;

      console.log(`Fetched ${data.value.length} messages (total: ${totalFetched})`);

      if (!data['@odata.nextLink']) {
        console.log("No more pages available");
        break;
      }

      // Extract skip token from nextLink
      const nextLinkUrl = new URL(data['@odata.nextLink']);
      nextSkipToken = nextLinkUrl.searchParams.get('$skiptoken');
    }

    if (allMessages.length === 0) {
      await supabase
        .from("sync_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          messages_synced: 0,
        })
        .eq("id", syncJob.id);

      return new Response(
        JSON.stringify({ success: true, synced: 0, hasMore: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${allMessages.length} messages...`);

    let syncedCount = 0;
    let unreadCount = 0;

    for (const msgData of allMessages) {
      try {
        const isUnread = !msgData.isRead;
        const isStarred = msgData.categories?.includes("Starred") || false;
        const isPinned = msgData.categories?.includes("Pinned") || false;

        if (isUnread) unreadCount++;

        const toEmails = msgData.toRecipients?.map((r: any) => r.emailAddress.address) || [];
        const ccEmails = msgData.ccRecipients?.map((r: any) => r.emailAddress.address) || [];
        const bccEmails = msgData.bccRecipients?.map((r: any) => r.emailAddress.address) || [];
        const recipientEmails = [...toEmails, ...ccEmails, ...bccEmails];

        const messageRecord = {
          account_id: accountId,
          message_id: msgData.id,
          thread_id: msgData.conversationId,
          subject: msgData.subject || "(No Subject)",
          sender_name: msgData.from?.emailAddress?.name || "",
          sender_email: msgData.from?.emailAddress?.address || "",
          recipient_emails: recipientEmails,
          snippet: msgData.bodyPreview || "",
          body_text: msgData.body?.contentType === "text" ? msgData.body?.content : "",
          body_html: msgData.body?.contentType === "html" ? msgData.body?.content : "",
          received_at: new Date(msgData.receivedDateTime).toISOString(),
          labels: msgData.categories || [],
          is_read: !isUnread,
          is_starred: isStarred,
          is_pinned: isPinned,
          has_attachments: msgData.hasAttachments || false,
          attachment_count: msgData.hasAttachments ? 1 : 0,
          updated_at: new Date().toISOString(),
        };

        await supabase
          .from("cached_messages")
          .upsert(messageRecord, { onConflict: "message_id" });

        syncedCount++;

        if (syncedCount % 50 === 0) {
          await supabase
            .from("sync_jobs")
            .update({
              messages_synced: syncedCount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", syncJob.id);
          
          console.log(`Progress: ${syncedCount}/${allMessages.length} messages synced`);
        }
      } catch (error) {
        console.error(`Error processing message ${msgData.id}:`, error);
      }
    }

    await supabase
      .from("sync_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        messages_synced: syncedCount,
      })
      .eq("id", syncJob.id);

    await supabase
      .from("email_accounts")
      .update({
        last_synced_at: new Date().toISOString(),
        unread_count: unreadCount,
      })
      .eq("id", accountId);

    console.log(`Sync completed: ${syncedCount} messages synced, ${unreadCount} unread`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        hasMore: !!nextSkipToken,
        nextSkipToken: nextSkipToken,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (accountId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        
        const { data: jobs } = await supabase
          .from("sync_jobs")
          .select("id")
          .eq("account_id", accountId)
          .eq("status", "processing")
          .order("created_at", { ascending: false })
          .limit(1);

        if (jobs && jobs.length > 0) {
          await supabase
            .from("sync_jobs")
            .update({
              status: "failed",
              completed_at: new Date().toISOString(),
              error_message: errorMessage,
            })
            .eq("id", jobs[0].id);
        }
      } catch (updateError) {
        console.error("Failed to update sync job:", updateError);
      }
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
