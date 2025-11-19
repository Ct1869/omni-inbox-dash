# Omni Inbox - Multi-Account Email Management System

> **Purpose:** Manage 800 email accounts (400 Gmail + 400 Outlook) under a single user with bulk import, automatic syncing, and unified inbox.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Current Status](#current-status)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Key Features](#key-features)
- [What's Implemented](#whats-implemented)
- [What Needs to Be Done](#what-needs-to-be-done)
- [Environment Setup](#environment-setup)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## 📊 Project Overview

### Use Case
- **Single user** managing 800 email accounts
- **Scale:** 400 Gmail + 400 Outlook accounts
- **Email volume:** 10-20 emails per account (16,000 total)
- **Storage:** ~320 MB
- **Deployment:** Self-hosted on Hetzner (16 CPU, 30GB RAM, 320GB storage)

### Current Setup
- **Development:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Production:** Will migrate to Coolify + self-hosted PostgreSQL (later)
- **Repository:** https://github.com/Ct1869/omni-inbox-dash.git

---

## ✅ Current Status

### What's Working
- ✅ OAuth authentication (Gmail + Outlook)
- ✅ Email syncing with incremental updates
- ✅ Webhook-based real-time notifications
- ✅ Unified inbox UI (read, compose, search, delete)
- ✅ **NEW:** Bulk account import from CSV
- ✅ Background sync (processes 5 accounts every 5 minutes)

### What Needs Work
- ⏳ Speed up background sync (5 → 20 accounts) - **5 minutes**
- ⏳ Obtain OAuth tokens for 800 accounts - **User task**
- ⏳ Test bulk import with real accounts - **30 minutes**
- ⏳ Monitor initial sync (3.3 hours) - **One-time**

---

## 🛠 Tech Stack

### Frontend
- **React 18** + TypeScript
- **Vite** (build tool)
- **TailwindCSS** + **Shadcn UI** (components)
- **React Router** (routing)
- **TanStack Query** (server state)

### Backend
- **Supabase** (PostgreSQL + Auth + Edge Functions)
- **Deno** (Edge Functions runtime)
- **Gmail API** + **Microsoft Graph API**

### Database
- **PostgreSQL** with Row Level Security (RLS)
- **Tables:** `email_accounts`, `oauth_tokens`, `cached_messages`, `sync_jobs`, `webhook_queue`

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Google OAuth credentials
- Microsoft OAuth credentials

### Installation

```bash
# Clone repository
git clone https://github.com/Ct1869/omni-inbox-dash.git
cd omni-inbox-dash

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials (see Environment Setup section)

# Start development server
npm run dev
# Opens at http://localhost:8080
```

### First-Time Setup

1. **Get Supabase credentials:**
   - URL: `https://ymqnyhkxfbzsshnyqycl.supabase.co`
   - Get anon key from: https://supabase.com/dashboard/project/ymqnyhkxfbzsshnyqycl/settings/api

2. **Set up OAuth:**
   - Google: https://console.cloud.google.com/apis/credentials
   - Microsoft: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps

3. **Test with 1 account:**
   - Open http://localhost:8080
   - Sign up / log in
   - Click "+" → "Connect Gmail"
   - Verify emails sync

---

## 📁 Project Structure

```
omni-inbox-dash-new/
├── src/
│   ├── components/
│   │   └── dashboard/
│   │       ├── AccountsSidebar.tsx      # Account list + navigation
│   │       ├── MessageList.tsx          # Email list view
│   │       ├── MessageDetail.tsx        # Email detail view
│   │       ├── BulkAccountImport.tsx    # ✨ NEW: CSV import
│   │       └── ComposeDialog.tsx        # Compose email
│   ├── pages/
│   │   ├── Auth.tsx                     # Login/signup
│   │   ├── GmailInbox.tsx               # Gmail inbox view
│   │   ├── OutlookInbox.tsx             # Outlook inbox view
│   │   └── Settings.tsx                 # ✨ NEW: Settings page
│   ├── hooks/
│   │   ├── useMessages.ts               # Email fetching
│   │   └── useSyncStatus.ts             # Sync status tracking
│   └── App.tsx                          # Main app + routing
├── supabase/
│   ├── functions/
│   │   ├── background-sync/             # ⚠️ NEEDS UPDATE: 5→20 accounts
│   │   ├── sync-messages/               # Gmail sync logic
│   │   ├── sync-outlook-messages/       # Outlook sync logic
│   │   ├── gmail-webhook/               # Gmail push notifications
│   │   ├── outlook-webhook/             # Outlook webhooks
│   │   └── webhook-processor/           # Queue-based processing
│   └── migrations/                      # Database schema (9 files)
├── scripts/
│   └── test-oauth-tokens.mjs            # ✨ NEW: Token validator
└── .env                                 # Environment variables
```

---

## 🎯 Key Features

### 1. Multi-Account Management
- Connect unlimited Gmail and Outlook accounts
- OAuth 2.0 authentication with automatic token refresh
- Per-account sync status indicators

### 2. Unified Inbox
- View emails from all accounts in one place
- Filter by provider (Gmail/Outlook)
- Search across all accounts
- Mark as read/unread, star, delete

### 3. Real-Time Sync
- **Webhooks:** Gmail push notifications + Outlook webhooks
- **Background sync:** Processes accounts every 5 minutes
- **Incremental sync:** Only fetches new emails (historyId/deltaLink)

### 4. Bulk Account Import ✨ NEW
- Import 800 accounts from CSV in ~8 minutes
- Batch processing (10 accounts at a time)
- Error handling and progress tracking
- CSV template download

---

## ✅ What's Implemented

### Core Features
- ✅ OAuth authentication (Gmail + Outlook)
- ✅ Email syncing with rate limiting
- ✅ Webhook handlers (real-time updates)
- ✅ Unified inbox UI
- ✅ Compose and send emails
- ✅ Search functionality
- ✅ Background sync (Supabase cron)

### Scalability Features
- ✅ Incremental sync (historyId/deltaLink)
- ✅ Rate limiting (2-second delays, exponential backoff)
- ✅ Queue-based webhook processing
- ✅ Automatic OAuth token refresh
- ✅ Batch processing for bulk operations

### Recent Additions
- ✅ Bulk account import UI (`/settings`)
- ✅ OAuth token validator script
- ✅ Settings page with navigation

---

## ⏳ What Needs to Be Done

### Critical (Required)
1. **Speed up background sync** (5 minutes)
   - File: `supabase/functions/background-sync/index.ts`
   - Change: Line 31, `.limit(5)` → `.limit(20)`
   - Deploy: `supabase functions deploy background-sync`
   - Impact: Reduces initial sync from 13 hours → 3.3 hours

2. **Obtain OAuth tokens for 800 accounts** (User task)
   - Create CSV with format: `email,provider,access_token,refresh_token,expires_at`
   - Use `scripts/test-oauth-tokens.mjs` to validate tokens
   - Import via `/settings` page

3. **Test bulk import** (30 minutes)
   - Test with 3 fake accounts first
   - Test with 10-20 real accounts
   - Verify sync works for imported accounts

### Optional (Nice-to-Have)
- ⚠️ Global dashboard (aggregate stats across 800 accounts)
- ⚠️ Account health monitoring (which accounts are failing)
- ⚠️ Bulk operations (mark all as read, delete old emails)

---

## 🔧 Environment Setup

### Required Environment Variables

Create `.env` file with:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://ymqnyhkxfbzsshnyqycl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your_supabase_anon_key>
VITE_SUPABASE_PROJECT_ID=ymqnyhkxfbzsshnyqycl

# OAuth Configuration
VITE_GOOGLE_CLIENT_ID=<your_google_client_id>
VITE_MICROSOFT_CLIENT_ID=<your_microsoft_client_id>
```

### Where to Get Credentials

1. **Supabase Anon Key:**
   - https://supabase.com/dashboard/project/ymqnyhkxfbzsshnyqycl/settings/api
   - Copy "anon public" key

2. **Google OAuth Client ID:**
   - https://console.cloud.google.com/apis/credentials
   - Create OAuth 2.0 Client ID
   - Add redirect URI: `http://localhost:8080/auth/callback`
   - Scopes: `gmail.readonly`, `gmail.send`, `gmail.modify`

3. **Microsoft OAuth Client ID:**
   - https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps
   - Register new application
   - Add redirect URI: `http://localhost:8080/auth/callback`
   - Scopes: `Mail.Read`, `Mail.Send`, `Mail.ReadWrite`, `offline_access`

---

## 📦 Bulk Account Import

### How to Import 800 Accounts

#### Step 1: Prepare CSV File

Create a CSV file with this format:

```csv
email,provider,access_token,refresh_token,expires_at
account1@gmail.com,gmail,ya29.a0...,1//0g...,2025-12-31T23:59:59Z
account2@outlook.com,outlook,EwB4A8...,M.C5...,2025-12-31T23:59:59Z
```

**Columns:**
- `email` - Email address
- `provider` - Either `gmail` or `outlook`
- `access_token` - OAuth access token
- `refresh_token` - OAuth refresh token
- `expires_at` - Token expiration (ISO 8601 format)

#### Step 2: Validate Tokens (Optional)

```bash
node scripts/test-oauth-tokens.mjs your-accounts.csv
```

This tests the first 10 accounts to verify tokens are valid.

#### Step 3: Import via UI

1. Start dev server: `npm run dev`
2. Open http://localhost:8080/settings
3. Click "Download Template" to see format
4. Click "Choose File" and select your CSV
5. Click "Import Accounts"
6. Wait ~8 minutes for 800 accounts

#### Step 4: Monitor Sync

- Check sidebar for sync status indicators
- Spinning icon = syncing
- Checkmark = completed
- Red X = failed

---

## 🚀 Deployment

### Current: Development (Supabase)
- Database: Supabase PostgreSQL
- Edge Functions: Supabase (Deno runtime)
- Frontend: Local dev server (Vite)

### Future: Production (Hetzner + Coolify)
- Server: Hetzner dedicated (16 CPU, 30GB RAM, 320GB storage)
- Database: Self-hosted PostgreSQL via Coolify
- Edge Functions: Migrate to self-hosted Deno or Node.js
- Frontend: Static build deployed via Coolify

**Note:** Production deployment will be done after development is complete.

---

## 🔍 Database Schema

### Core Tables

**`email_accounts`**
- Stores email account metadata
- Columns: `id`, `user_id`, `email`, `provider`, `name`, `picture_url`, `is_active`, `last_synced_at`, `unread_count`

**`oauth_tokens`**
- Stores OAuth access/refresh tokens
- Columns: `id`, `account_id`, `access_token`, `refresh_token`, `expires_at`, `scope`

**`cached_messages`**
- Stores email metadata and content
- Columns: `id`, `account_id`, `message_id`, `thread_id`, `subject`, `snippet`, `sender_name`, `sender_email`, `body_html`, `body_text`, `is_read`, `is_starred`, `received_at`

**`sync_jobs`**
- Tracks sync operations
- Columns: `id`, `account_id`, `status`, `started_at`, `completed_at`, `error_message`, `messages_synced`

**`webhook_queue`**
- Queue for webhook processing
- Columns: `id`, `account_id`, `email_address`, `history_id`, `provider`, `status`, `retry_count`, `next_retry_at`

---

## 🐛 Troubleshooting

### Dev Server Won't Start
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Settings Page Not Loading
1. Hard refresh: `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows)
2. Check browser console (F12) for errors
3. Verify you're logged in

### Bulk Import Fails
1. Verify CSV format matches template exactly
2. Check OAuth tokens are valid: `node scripts/test-oauth-tokens.mjs your-file.csv`
3. Check browser console for errors
4. Check Supabase logs: https://supabase.com/dashboard/project/ymqnyhkxfbzsshnyqycl/logs

### Emails Not Syncing
1. Check account sync status in sidebar (red X = failed)
2. Check Supabase Edge Function logs
3. Verify OAuth tokens haven't expired
4. Re-authorize account via UI

### Background Sync Too Slow
- Edit `supabase/functions/background-sync/index.ts`
- Change `.limit(5)` to `.limit(20)` on line 31
- Deploy: `supabase functions deploy background-sync`

---

## 📊 Performance Expectations

### For 800 Accounts

**Initial Sync (One-Time):**
- Time: 3.3 hours (after optimization)
- Storage: ~320 MB
- Emails: ~16,000

**Daily Sync (Ongoing):**
- Time: ~45 minutes
- New emails: 10-20 per account
- Storage growth: Minimal

**API Quotas:**
- Gmail: 1 billion quota units/day (well within limits)
- Outlook: 10,000 requests/10 minutes (well within limits)

**Database:**
- Size: ~320 MB (16,000 emails)
- Max: ~500 MB (with growth)
- Supabase free tier: 500 MB (sufficient)

---

## 🔐 Security

### Authentication
- Supabase Auth with JWT tokens
- Row Level Security (RLS) on all tables
- User can only access their own data

### OAuth Tokens
- Stored encrypted in database
- Automatic refresh before expiration
- Never exposed to client-side code

### API Keys
- Environment variables (not committed to git)
- Supabase anon key (safe for client-side)
- Service role key (server-side only, not used in frontend)

---

## 📚 Additional Resources

### Supabase Dashboard
- Project: https://supabase.com/dashboard/project/ymqnyhkxfbzsshnyqycl
- Database: https://supabase.com/dashboard/project/ymqnyhkxfbzsshnyqycl/editor
- Edge Functions: https://supabase.com/dashboard/project/ymqnyhkxfbzsshnyqycl/functions
- Logs: https://supabase.com/dashboard/project/ymqnyhkxfbzsshnyqycl/logs

### API Documentation
- Gmail API: https://developers.google.com/gmail/api
- Microsoft Graph: https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview

---

## 🤝 Contributing

### For New Developers

1. **Read this README first** - Everything you need is here
2. **Set up environment** - Follow Quick Start section
3. **Test with 1 account** - Verify everything works
4. **Check open issues** - See what needs work

### Development Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes
# ...

# Test locally
npm run dev

# Commit and push
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature

# Create pull request on GitHub
```

---

## 📝 License

This project is private and proprietary.

---

## 📞 Support

- **Repository:** https://github.com/Ct1869/omni-inbox-dash.git
- **Supabase Project:** ymqnyhkxfbzsshnyqycl
- **Issues:** Create an issue on GitHub

---

## ✅ Quick Reference

### Essential Commands
```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:8080)
npm run build        # Build for production
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
```

### Essential Files
- `.env` - Environment variables (copy from `.env.example`)
- `src/App.tsx` - Main app component and routing
- `supabase/functions/background-sync/index.ts` - ⚠️ Needs update (5→20)
- `src/components/dashboard/BulkAccountImport.tsx` - Bulk import UI
- `scripts/test-oauth-tokens.mjs` - Token validator

### Essential URLs
- Dev server: http://localhost:8080
- Settings page: http://localhost:8080/settings
- Supabase dashboard: https://supabase.com/dashboard/project/ymqnyhkxfbzsshnyqycl

---

## 🎯 Next Steps for New Developer

1. ✅ Read this README completely
2. ✅ Set up environment (`.env` file)
3. ✅ Start dev server and test with 1 account
4. ✅ Update background-sync limit (5→20)
5. ✅ Test bulk import with fake CSV
6. ✅ Help obtain OAuth tokens for 800 accounts
7. ✅ Import and monitor sync

**Estimated time to get up to speed:** 2-3 hours

---

**Last Updated:** 2025-11-19
**Version:** 1.0.0
**Status:** Development (ready for bulk import testing)
