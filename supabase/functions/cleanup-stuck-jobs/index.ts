import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Running cleanup of stuck sync jobs...');

    // Call the cleanup function
    const { error: cleanupError } = await supabase.rpc('cleanup_stuck_sync_jobs');

    if (cleanupError) {
      console.error('Error running cleanup:', cleanupError);
      throw cleanupError;
    }

    // Get count of jobs that were cleaned up
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { count } = await supabase
      .from('sync_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .eq('error_message', 'Job timeout: exceeded maximum processing time')
      .gte('updated_at', tenMinutesAgo);

    console.log(`Cleanup completed. Marked ${count || 0} stuck jobs as failed.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        cleaned_up: count || 0,
        message: 'Cleanup completed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cleanup-stuck-jobs:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});