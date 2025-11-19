# 🚀 Quick Start Guide - Omni Inbox (800 Accounts)

## Your Situation
- **Scale:** 800 email accounts (400 Gmail + 400 Outlook)
- **Volume:** 10-20 emails per account max
- **Total emails:** ~16,000 emails
- **Deployment:** Hetzner server (16 CPU, 320GB, 30GB RAM) with Coolify
- **Current phase:** Development & testing with Supabase

---

## ✅ Step 1: Verify Current System Works (Today - 30 minutes)

### 1.1 Set up environment
```bash
cd omni-inbox-dash-new
cp .env.example .env
```

### 1.2 Fill in `.env` with your credentials:
```env
VITE_SUPABASE_URL=https://ymqnyhkxfbzsshnyqycl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<get from Supabase dashboard>
VITE_SUPABASE_PROJECT_ID=ymqnyhkxfbzsshnyqycl
VITE_GOOGLE_CLIENT_ID=<your Google OAuth client ID>
VITE_MICROSOFT_CLIENT_ID=<your Microsoft OAuth client ID>
```

**Where to get credentials:**
- Supabase anon key: https://supabase.com/dashboard/project/ymqnyhkxfbzsshnyqycl/settings/api
- Google OAuth: https://console.cloud.google.com/apis/credentials
- Microsoft OAuth: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps

### 1.3 Start the dev server
```bash
npm install
npm run dev
```

### 1.4 Test with ONE account
1. Open http://localhost:5173
2. Sign up / log in
3. Click "+" button → "Connect Gmail"
4. Authorize 1 Gmail account
5. Wait for sync to complete
6. Verify emails appear in the UI

**Success criteria:** ✅ You can see emails from 1 account

---

## ✅ Step 2: Prepare OAuth Tokens for Bulk Import (Tomorrow - 2-4 hours)

You need to get OAuth tokens for all 800 accounts. There are two approaches:

### Option A: Manual OAuth Flow (Recommended for testing)
1. Use the UI to connect 10-20 accounts manually
2. Test that everything works before scaling

### Option B: Programmatic Token Generation (For 800 accounts)
You'll need to:
1. Create a script to generate OAuth tokens for each account
2. For Gmail: Use Google's OAuth 2.0 flow with `offline` access
3. For Outlook: Use Microsoft's OAuth 2.0 flow with `offline_access` scope
4. Save tokens to CSV file

**CSV Format:**
```csv
email,provider,access_token,refresh_token,expires_at
account1@gmail.com,gmail,ya29.a0...,1//0g...,2024-12-31T23:59:59Z
account2@outlook.com,outlook,EwB4A8...,M.C5...,2024-12-31T23:59:59Z
```

---

## ✅ Step 3: Bulk Import Accounts (Day 3 - 1 hour)

### 3.1 Access the Settings page
1. In the app, click the **Settings** icon (⚙️) in the sidebar
2. You'll see the "Bulk Account Import" card

### 3.2 Download the CSV template
Click "Download Template" to see the required format

### 3.3 Import your accounts
1. Prepare your CSV file with all 800 accounts
2. Click "Choose File" and select your CSV
3. Click "Import Accounts"
4. Wait for import to complete (processes 10 accounts at a time)

**Expected time:** ~8 minutes for 800 accounts (10 per batch, 1 second between batches)

---

## ✅ Step 4: Optimize Background Sync (Day 3 - 30 minutes)

The current background sync processes 5 accounts every 5 minutes. For 800 accounts, that's too slow.

### 4.1 Increase sync batch size
Edit `omni-inbox-dash-new/supabase/functions/background-sync/index.ts`:

**Change line 31 from:**
```typescript
.limit(5); // Process max 5 accounts per run
```

**To:**
```typescript
.limit(20); // Process 20 accounts per run (safe for your scale)
```

### 4.2 Deploy the change
```bash
cd omni-inbox-dash-new
supabase functions deploy background-sync
```

**Result:** 
- Initial sync: 800 accounts ÷ 20 per 5-min = **3.3 hours** (one-time)
- Daily sync: Only new emails = **~45 minutes** for all 800 accounts

---

## ✅ Step 5: Monitor & Test (Day 4 - ongoing)

### 5.1 Check sync status
- In the UI, each account shows a sync indicator (spinning icon = syncing, checkmark = completed, red X = failed)
- Click on any account to see its emails

### 5.2 Monitor database size
```sql
-- Run in Supabase SQL Editor
SELECT 
  pg_size_pretty(pg_database_size('postgres')) as database_size,
  (SELECT COUNT(*) FROM cached_messages) as total_emails,
  (SELECT COUNT(*) FROM email_accounts) as total_accounts;
```

**Expected:**
- Database size: ~320 MB (for 16,000 emails)
- Total emails: ~16,000
- Total accounts: 800

### 5.3 Test key features
- ✅ View emails from different accounts
- ✅ Search across all emails
- ✅ Mark as read/unread
- ✅ Star/flag emails
- ✅ Compose and send replies
- ✅ Delete emails (manual cleanup)

---

## 🎯 What's Next?

### After Testing (Week 2+)
1. **Deploy to Hetzner with Coolify**
   - Migrate Supabase database to self-hosted PostgreSQL
   - Deploy React app via Coolify
   - Configure Nginx reverse proxy

2. **Optional Enhancements** (only if needed)
   - Add global dashboard showing stats across all 800 accounts
   - Add bulk operations (mark all as read, delete old emails, etc.)
   - Add account health monitoring (which accounts are failing sync)

---

## 🚫 What to SKIP

You do NOT need:
- ❌ Worker pools or sync coordinators (overkill for 16K emails)
- ❌ Global rate limiters (current rate limiting is sufficient)
- ❌ Automated weekly cleanup (you'll delete manually)
- ❌ Complex monitoring dashboards (UI shows sync status)
- ❌ Separate metadata/content tables (current schema is fine)

---

## 💡 Key Insights

1. **Your scale is SMALL:** 16,000 emails is trivial for modern databases
2. **Current codebase works:** No major changes needed
3. **Hetzner server is overkill:** 16 CPU + 30GB RAM can handle 10x your scale
4. **Focus on testing:** Make sure OAuth tokens work for all 800 accounts

---

## 🆘 Troubleshooting

### Problem: Sync is slow
**Solution:** Increase background-sync limit from 5 to 20 accounts (Step 4)

### Problem: Some accounts fail to sync
**Solution:** Check OAuth tokens are valid. Re-authorize failed accounts.

### Problem: Database fills up
**Solution:** Manually delete old emails via SQL:
```sql
DELETE FROM cached_messages WHERE received_at < NOW() - INTERVAL '30 days';
```

### Problem: Can't import 800 accounts at once
**Solution:** Split CSV into smaller batches (100 accounts each) and import separately

---

## 📞 Need Help?

If you get stuck, check:
1. Supabase logs: https://supabase.com/dashboard/project/ymqnyhkxfbzsshnyqycl/logs
2. Browser console for errors
3. Edge Function logs for sync errors

