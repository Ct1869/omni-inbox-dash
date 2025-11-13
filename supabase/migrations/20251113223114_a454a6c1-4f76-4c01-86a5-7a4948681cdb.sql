-- Add indexes for better query performance on cached_messages table
CREATE INDEX IF NOT EXISTS idx_cached_messages_account_id ON cached_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_cached_messages_received_at ON cached_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_cached_messages_sender_email ON cached_messages(sender_email);
CREATE INDEX IF NOT EXISTS idx_cached_messages_account_received ON cached_messages(account_id, received_at DESC);

-- Add index on labels array for faster filtering
CREATE INDEX IF NOT EXISTS idx_cached_messages_labels ON cached_messages USING GIN(labels);