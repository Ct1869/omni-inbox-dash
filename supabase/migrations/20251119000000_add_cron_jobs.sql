-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule background sync to run every 5 minutes
-- This will sync all accounts that need syncing
SELECT cron.schedule(
  'background-sync-all-accounts',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://vntkvhmpnvnqxdprgvjk.supabase.co/functions/v1/background-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Schedule webhook processor to run every 1 minute
-- This processes queued webhook notifications
SELECT cron.schedule(
  'process-webhook-queue',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
      url := 'https://vntkvhmpnvnqxdprgvjk.supabase.co/functions/v1/webhook-processor',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Schedule cleanup of stuck jobs every 10 minutes
-- This handles jobs that got stuck in processing state
SELECT cron.schedule(
  'cleanup-stuck-sync-jobs',
  '*/10 * * * *', -- Every 10 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://vntkvhmpnvnqxdprgvjk.supabase.co/functions/v1/cleanup-stuck-jobs',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Schedule renewal of Gmail watches every 6 hours
-- Gmail watch subscriptions expire after 7 days, renew proactively
SELECT cron.schedule(
  'renew-gmail-watches',
  '0 */6 * * *', -- Every 6 hours
  $$
  SELECT
    net.http_post(
      url := 'https://vntkvhmpnvnqxdprgvjk.supabase.co/functions/v1/renew-gmail-watches',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Schedule renewal of Outlook subscriptions every 12 hours
-- Outlook subscriptions expire after 3 days, renew proactively
SELECT cron.schedule(
  'renew-outlook-subscriptions',
  '0 */12 * * *', -- Every 12 hours
  $$
  SELECT
    net.http_post(
      url := 'https://vntkvhmpnvnqxdprgvjk.supabase.co/functions/v1/renew-outlook-subscriptions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Create a view to easily see all scheduled jobs
CREATE OR REPLACE VIEW cron_jobs AS
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
ORDER BY jobid;

-- Grant access to view cron jobs
GRANT SELECT ON cron_jobs TO authenticated;
GRANT SELECT ON cron_jobs TO service_role;

-- Add comment with instructions
COMMENT ON VIEW cron_jobs IS 'View all scheduled cron jobs. To set the service role key, run: ALTER DATABASE postgres SET app.settings.service_role_key TO ''your_service_role_key_here'';';

