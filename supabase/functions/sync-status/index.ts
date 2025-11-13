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

    console.log('Fetching sync status metrics...');

    // Get active sync jobs
    const { count: activeCount } = await supabase
      .from('sync_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    // Get failed jobs in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: failedCount } = await supabase
      .from('sync_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', oneDayAgo);

    // Get stuck jobs (processing for > 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: stuckCount } = await supabase
      .from('sync_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing')
      .lte('updated_at', tenMinutesAgo);

    // Get average sync time for completed jobs in last 24 hours
    const { data: completedJobs } = await supabase
      .from('sync_jobs')
      .select('started_at, completed_at')
      .eq('status', 'completed')
      .gte('created_at', oneDayAgo)
      .not('started_at', 'is', null)
      .not('completed_at', 'is', null);

    let averageSyncTime = 0;
    if (completedJobs && completedJobs.length > 0) {
      const totalTime = completedJobs.reduce((sum, job) => {
        const start = new Date(job.started_at!).getTime();
        const end = new Date(job.completed_at!).getTime();
        return sum + (end - start);
      }, 0);
      averageSyncTime = Math.round(totalTime / completedJobs.length / 1000); // in seconds
    }

    // Get webhook queue status
    const { count: pendingWebhooks } = await supabase
      .from('webhook_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: failedWebhooks } = await supabase
      .from('webhook_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    // Get total messages synced today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todayJobs } = await supabase
      .from('sync_jobs')
      .select('messages_synced')
      .gte('created_at', today.toISOString());

    const totalMessagesSynced = todayJobs?.reduce((sum, job) => sum + (job.messages_synced || 0), 0) || 0;

    const metrics = {
      activeSyncJobs: activeCount || 0,
      failedJobsLast24h: failedCount || 0,
      stuckJobs: stuckCount || 0,
      averageSyncTimeSeconds: averageSyncTime,
      pendingWebhooks: pendingWebhooks || 0,
      failedWebhooks: failedWebhooks || 0,
      totalMessagesSyncedToday: totalMessagesSynced,
      timestamp: new Date().toISOString(),
    };

    console.log('Sync status metrics:', metrics);

    return new Response(
      JSON.stringify(metrics),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching sync status:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});