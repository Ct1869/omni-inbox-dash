-- Enable real-time updates for cached_messages table
ALTER TABLE public.cached_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cached_messages;