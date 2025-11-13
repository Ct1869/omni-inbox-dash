-- Create webhook queue table
CREATE TABLE IF NOT EXISTS public.webhook_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  history_id text NOT NULL,
  email_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  next_retry_at timestamp with time zone
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_webhook_queue_status ON public.webhook_queue(status);
CREATE INDEX IF NOT EXISTS idx_webhook_queue_account_id ON public.webhook_queue(account_id);
CREATE INDEX IF NOT EXISTS idx_webhook_queue_next_retry ON public.webhook_queue(next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status_updated ON public.sync_jobs(status, updated_at);

-- Enable RLS
ALTER TABLE public.webhook_queue ENABLE ROW LEVEL SECURITY;

-- Service role can manage queue
CREATE POLICY "Service role can manage webhook queue"
ON public.webhook_queue
FOR ALL
USING (true)
WITH CHECK (true);

-- Add timeout column to sync_jobs
ALTER TABLE public.sync_jobs ADD COLUMN IF NOT EXISTS timeout_at timestamp with time zone;

-- Function to cleanup stuck sync jobs
CREATE OR REPLACE FUNCTION cleanup_stuck_sync_jobs()
RETURNS void AS $$
BEGIN
  -- Mark jobs as failed if they've been processing for more than 10 minutes
  UPDATE public.sync_jobs
  SET 
    status = 'failed',
    error_message = 'Job timeout: exceeded maximum processing time',
    completed_at = now(),
    updated_at = now()
  WHERE 
    status = 'processing' 
    AND updated_at < now() - interval '10 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;