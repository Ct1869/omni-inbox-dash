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

    // Insert webhook into queue for processing
    const { error: queueError } = await supabase
      .from('webhook_queue')
      .insert({
        email_address: emailAddress,
        history_id: historyId,
        account_id: account.id,
        status: 'pending',
      });

    if (queueError) {
      console.error('Error inserting webhook into queue:', queueError);
      throw queueError;
    }

    console.log(`Webhook queued for processing: ${emailAddress}`);

    // Return 200 immediately - processing will happen asynchronously via webhook-processor
    return new Response(
      JSON.stringify({ success: true, message: 'Webhook queued for processing' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in gmail-webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});