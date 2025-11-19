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

    console.log("Starting background sync job...");

    // Get all active email accounts that need syncing
    // Only sync accounts that haven't been synced in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: accounts, error: accountsError } = await supabase
      .from("email_accounts")
      .select("id, email, last_synced_at, provider")
      .eq("is_active", true)
      .or(`last_synced_at.is.null,last_synced_at.lt.${fiveMinutesAgo}`)
      .limit(5); // Process max 5 accounts per run to avoid rate limits

    if (accountsError) {
      console.error("Error fetching accounts:", accountsError);
      throw accountsError;
    }

    if (!accounts || accounts.length === 0) {
      console.log("No accounts need syncing at this time");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No accounts need syncing",
          accountsProcessed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${accounts.length} accounts to sync`);

    const syncResults = [];

    // Process accounts with rate limiting (one at a time)
    for (const account of accounts) {
      try {
        console.log(`Syncing account: ${account.email}`);

        // Check if there's already a sync job running for this account
        const { data: existingJob } = await supabase
          .from("sync_jobs")
          .select("id, status")
          .eq("account_id", account.id)
          .eq("status", "processing")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (existingJob) {
          console.log(`Sync already in progress for ${account.email}, skipping`);
          syncResults.push({
            accountId: account.id,
            email: account.email,
            status: "skipped",
            reason: "sync_in_progress"
          });
          continue;
        }

        // Trigger sync for this account (max 200 messages per sync)
        const functionName = account.provider === 'outlook' ? 'sync-outlook-messages' : 'sync-messages';
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { 
            accountId: account.id,
            maxMessages: 200 // Limit to 200 messages per background sync
          }
        });

        if (error) {
          console.error(`Error syncing ${account.email}:`, error);
          syncResults.push({
            accountId: account.id,
            email: account.email,
            status: "error",
            error: error.message
          });
        } else {
          console.log(`Successfully synced ${account.email}: ${data.synced} messages`);
          syncResults.push({
            accountId: account.id,
            email: account.email,
            status: "success",
            messagesSynced: data.synced
          });
        }

        // Rate limiting: wait 2 seconds between accounts to avoid hitting Gmail API limits
        if (accounts.indexOf(account) < accounts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`Failed to sync account ${account.email}:`, error);
        syncResults.push({
          accountId: account.id,
          email: account.email,
          status: "error",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const successCount = syncResults.filter(r => r.status === "success").length;
    const errorCount = syncResults.filter(r => r.status === "error").length;
    const skippedCount = syncResults.filter(r => r.status === "skipped").length;

    console.log(`Background sync completed: ${successCount} success, ${errorCount} errors, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        accountsProcessed: accounts.length,
        results: {
          success: successCount,
          errors: errorCount,
          skipped: skippedCount
        },
        details: syncResults
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Background sync error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error) 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
