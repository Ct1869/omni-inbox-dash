-- Create table to track Gmail watch subscriptions
CREATE TABLE gmail_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES email_accounts(id) ON DELETE CASCADE,
  history_id text NOT NULL,
  expiration timestamp with time zone NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE gmail_watches ENABLE ROW LEVEL SECURITY;

-- Service role can manage watches
CREATE POLICY "Service role can manage watches"
  ON gmail_watches
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for quick lookups
CREATE INDEX idx_gmail_watches_account ON gmail_watches(account_id);
CREATE INDEX idx_gmail_watches_expiration ON gmail_watches(expiration) WHERE is_active = true;

-- Add trigger for updated_at
CREATE TRIGGER update_gmail_watches_updated_at
  BEFORE UPDATE ON gmail_watches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();