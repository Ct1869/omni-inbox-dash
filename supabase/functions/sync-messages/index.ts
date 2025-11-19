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
        const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`${operation}: Waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw new Error(`${operation} failed after ${maxRetries} attempts: ${lastError!.message}`);
}

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

// Batch fetch message details with rate limiting
// Gmail API quota: 250 units/second per user (1 message fetch = 5 units = 50 messages/sec max)
// Using 5 concurrent requests with 200ms delay = ~25 msg/sec to stay well under quota
async function batchFetchMessages(messageIds: string[], accessToken: string) {
  const limiter = new RateLimiter(5, 200); // 5 concurrent, 200ms delay = ~25 msg/sec
  const allMessages = [];

  console.log(`Rate-limited batch fetch starting for ${messageIds.length} messages...`);

  for (const id of messageIds) {
    const message = await limiter.execute(async () => {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!response.ok) {
        console.error(`Failed to fetch message ${id}: ${response.status}`);
        return null;
      }
      return response.json();
    });

    if (message) {
      allMessages.push(message);
    }

    // Log progress every 50 messages
    if (allMessages.length % 50 === 0) {
      console.log(`Fetched ${allMessages.length}/${messageIds.length} messages...`);
    }
  }

  return allMessages;
}

// Parse message headers
function parseHeaders(headers: any[]) {
  const headerMap: Record<string, string> = {};
  headers.forEach((h: any) => {
    headerMap[h.name.toLowerCase()] = h.value;
  });
  return headerMap;
}

// Parse message body
function parseBody(payload: any): { text: string; html: string } {
  let text = "";
  let html = "";

  function extractParts(part: any) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      text += atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
    } else if (part.mimeType === "text/html" && part.body?.data) {
      html += atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
    }

    if (part.parts) {
      part.parts.forEach(extractParts);
    }
  }

  if (payload.body?.data) {
    const decoded = atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
    if (payload.mimeType === "text/html") {
      html = decoded;
    } else {
      text = decoded;
    }
  }

  if (payload.parts) {
    payload.parts.forEach(extractParts);
  }

  return { text, html };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Read request body once at the start and store values for use throughout the function
  let accountId: string | undefined;
  let pageToken: string | null = null;
  let maxMessages = 1000;
  
  try {
    // Parse body once
    const body = await req.json();
    accountId = body.accountId;
    pageToken = body.pageToken || null;
    maxMessages = body.maxMessages || 1000;
    
    // Set timeout for this function (5 minutes)
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

    // Create sync job with timeout
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

    // Check if this is a Gmail account
    if (account.provider !== 'gmail') {
      if (syncJob) {
        await supabase
          .from("sync_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: `This sync function only supports Gmail accounts. Account provider is: ${account.provider}`,
          })
          .eq("id", syncJob.id);
      }
      throw new Error(`This sync function only supports Gmail accounts. Account provider is: ${account.provider}`);
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

    let allMessageIds = [];
    let nextPageToken = pageToken;
    let totalFetched = 0;

    // Fetch messages with pagination
    console.log(`Starting sync for account ${accountId}, max messages: ${maxMessages}`);
    
    while (totalFetched < maxMessages) {
      checkTimeout(); // Check if we've exceeded timeout
      
      const pageSize = Math.min(100, maxMessages - totalFetched); // Reduced from 500 to 100 to prevent WORKER_LIMIT
      let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${pageSize}`;
      
      if (nextPageToken) {
        url += `&pageToken=${nextPageToken}`;
      }

      const gmailResponse = await retryWithBackoff(
        async () => {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
            console.log(`Rate limited. Waiting ${waitMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
            throw new Error('Rate limited, retrying...');
          }

          if (!response.ok) {
            throw new Error("Failed to fetch messages from Gmail");
          }

          return response;
        },
        3,
        'Fetch messages from Gmail'
      );

      const data = await gmailResponse.json();
      
      if (!data.messages || data.messages.length === 0) {
        console.log("No more messages to fetch");
        break;
      }

      allMessageIds.push(...data.messages);
      totalFetched += data.messages.length;
      
      console.log(`Fetched ${data.messages.length} message IDs (total: ${totalFetched})`);

      if (!data.nextPageToken) {
        console.log("No more pages available");
        break;
      }

      nextPageToken = data.nextPageToken;
    }

    if (allMessageIds.length === 0) {
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

    console.log(`Fetching full details for ${allMessageIds.length} messages using batch API...`);

    // Batch fetch all message details
    const messageIds = allMessageIds.map((m: any) => m.id);
    const messages = await batchFetchMessages(messageIds, accessToken);
    
    console.log(`Successfully fetched ${messages.length} full messages`);

    let syncedCount = 0;
    let unreadCount = 0;

    // Process and upsert messages
    for (const msgData of messages) {
      try {
        const headers = parseHeaders(msgData.payload.headers);
        const body = parseBody(msgData.payload);

        const isUnread = msgData.labelIds?.includes("UNREAD") || false;
        const isStarred = msgData.labelIds?.includes("STARRED") || false;
        const isPinned = msgData.labelIds?.includes("PINNED") || false;

        if (isUnread) unreadCount++;

        // Extract recipient emails
        const toHeader = headers["to"] || "";
        const ccHeader = headers["cc"] || "";
        const bccHeader = headers["bcc"] || "";
        const allRecipients = [toHeader, ccHeader, bccHeader]
          .filter(Boolean)
          .join(", ");
        const recipientEmails = allRecipients
          .split(",")
          .map(email => email.trim().match(/<(.+)>/)?.[1] || email.trim())
          .filter(Boolean);
        // Check for attachments
        let hasAttachments = false;
        let attachmentCount = 0;

        function countAttachments(part: any) {
          if (part.filename && part.body?.attachmentId) {
            hasAttachments = true;
            attachmentCount++;
          }
          if (part.parts) {
            part.parts.forEach(countAttachments);
          }
        }

        if (msgData.payload.parts) {
          msgData.payload.parts.forEach(countAttachments);
        }

        const messageRecord = {
          account_id: accountId,
          message_id: msgData.id,
          thread_id: msgData.threadId,
          subject: headers["subject"] || "(No Subject)",
          sender_name: headers["from"]?.split("<")[0].trim() || "",
          sender_email: headers["from"]?.match(/<(.+)>/)?.[1] || headers["from"] || "",
          recipient_emails: recipientEmails,
          snippet: msgData.snippet || "",
          body_text: body.text || "",
          body_html: body.html || "",
          received_at: new Date(parseInt(msgData.internalDate)).toISOString(),
          labels: msgData.labelIds || [],
          is_read: !isUnread,
          is_starred: isStarred,
          is_pinned: isPinned,
          has_attachments: hasAttachments,
          attachment_count: attachmentCount,
          updated_at: new Date().toISOString(),
        };

        await supabase
          .from("cached_messages")
          .upsert(messageRecord, { onConflict: "message_id" });

        syncedCount++;

        // Update sync job progress every 50 messages
        if (syncedCount % 50 === 0) {
          await supabase
            .from("sync_jobs")
            .update({
              messages_synced: syncedCount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", syncJob.id);
          
          console.log(`Progress: ${syncedCount}/${messages.length} messages synced`);
        }
      } catch (error) {
        console.error(`Error processing message ${msgData.id}:`, error);
      }
    }

    // Update sync job as completed
    await supabase
      .from("sync_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        messages_synced: syncedCount,
      })
      .eq("id", syncJob.id);

    // Update account's last synced time and unread count
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
        hasMore: !!nextPageToken,
        nextPageToken: nextPageToken,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Try to update sync job if possible (use accountId from outer scope)
    if (accountId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        
        // Find the most recent processing job for this account
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
