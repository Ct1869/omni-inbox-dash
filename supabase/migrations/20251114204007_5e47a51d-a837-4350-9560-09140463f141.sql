-- Create outlook_subscriptions table (similar to gmail_watches)
CREATE TABLE IF NOT EXISTS public.outlook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  expiration TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  client_state TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_outlook_subs_account ON public.outlook_subscriptions(account_id);
CREATE INDEX IF NOT EXISTS idx_outlook_subs_expiration ON public.outlook_subscriptions(expiration);
CREATE INDEX IF NOT EXISTS idx_outlook_subs_active ON public.outlook_subscriptions(is_active) WHERE is_active = true;

-- Add provider and change_type columns to webhook_queue if not exists
ALTER TABLE public.webhook_queue ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'gmail';
ALTER TABLE public.webhook_queue ADD COLUMN IF NOT EXISTS change_type TEXT;

-- Enable RLS
ALTER TABLE public.outlook_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for outlook_subscriptions (service role only)
CREATE POLICY "Service role can manage outlook subscriptions"
  ON public.outlook_subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_outlook_subscriptions_updated_at
  BEFORE UPDATE ON public.outlook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.outlook_subscriptions IS 'Stores Microsoft Graph API webhook subscriptions for Outlook email accounts';