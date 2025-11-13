-- Add unique constraint on message_id for upserts to work correctly
ALTER TABLE cached_messages ADD CONSTRAINT cached_messages_message_id_key UNIQUE (message_id);