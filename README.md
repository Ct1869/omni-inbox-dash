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
