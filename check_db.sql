-- Check email accounts
SELECT id, email, provider, is_active, last_synced_at FROM email_accounts;

-- Check cached messages count
SELECT COUNT(*) as message_count FROM cached_messages;

-- Check sync jobs
SELECT id, account_id, status, messages_synced, created_at FROM sync_jobs ORDER BY created_at DESC LIMIT 5;
