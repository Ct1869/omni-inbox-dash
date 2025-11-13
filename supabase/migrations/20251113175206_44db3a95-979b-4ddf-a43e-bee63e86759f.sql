-- Enable realtime for sync_jobs table
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_jobs;

-- Add RLS policy for users to view their sync jobs
CREATE POLICY "Users can view their sync jobs"
ON public.sync_jobs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM email_accounts
    WHERE email_accounts.id = sync_jobs.account_id
    AND email_accounts.user_id = auth.uid()
  )
);