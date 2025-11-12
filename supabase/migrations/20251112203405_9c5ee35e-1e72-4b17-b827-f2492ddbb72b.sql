-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Create enum types
CREATE TYPE public.app_role AS ENUM ('viewer', 'responder', 'admin');
CREATE TYPE public.sync_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE public.account_provider AS ENUM ('gmail');

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Email accounts table
CREATE TABLE public.email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.account_provider NOT NULL DEFAULT 'gmail',
  email TEXT NOT NULL,
  name TEXT,
  picture_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email, provider)
);

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view email accounts"
  ON public.email_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert email accounts"
  ON public.email_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their email accounts"
  ON public.email_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their email accounts"
  ON public.email_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- OAuth tokens table (encrypted storage)
CREATE TABLE public.oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id)
);

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Only edge functions can access tokens (via service role)
CREATE POLICY "Service role can manage tokens"
  ON public.oauth_tokens FOR ALL
  USING (true)
  WITH CHECK (true);

-- Cached messages table
CREATE TABLE public.cached_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  thread_id TEXT,
  subject TEXT,
  snippet TEXT,
  sender_name TEXT,
  sender_email TEXT NOT NULL,
  recipient_emails TEXT[],
  body_html TEXT,
  body_text TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  has_attachments BOOLEAN NOT NULL DEFAULT false,
  attachment_count INTEGER NOT NULL DEFAULT 0,
  labels TEXT[],
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, message_id)
);

ALTER TABLE public.cached_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from their accounts"
  ON public.cached_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.email_accounts
      WHERE email_accounts.id = cached_messages.account_id
      AND email_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage messages"
  ON public.cached_messages FOR ALL
  USING (true)
  WITH CHECK (true);

-- Sync jobs table (background processing queue)
CREATE TABLE public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  status public.sync_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  messages_synced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage sync jobs"
  ON public.sync_jobs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_email_accounts_user_id ON public.email_accounts(user_id);
CREATE INDEX idx_email_accounts_email ON public.email_accounts(email);
CREATE INDEX idx_cached_messages_account_id ON public.cached_messages(account_id);
CREATE INDEX idx_cached_messages_received_at ON public.cached_messages(received_at DESC);
CREATE INDEX idx_cached_messages_thread_id ON public.cached_messages(thread_id);
CREATE INDEX idx_cached_messages_is_read ON public.cached_messages(is_read);
CREATE INDEX idx_sync_jobs_status ON public.sync_jobs(status);
CREATE INDEX idx_sync_jobs_account_id ON public.sync_jobs(account_id);

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_accounts_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON public.oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cached_messages_updated_at
  BEFORE UPDATE ON public.cached_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sync_jobs_updated_at
  BEFORE UPDATE ON public.sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  
  -- Assign default viewer role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();