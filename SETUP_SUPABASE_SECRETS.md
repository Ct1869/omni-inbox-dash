# 🔐 Setup Supabase Edge Function Secrets

## Problem
Edge Function returns 500 error because Google OAuth credentials are not configured in Supabase.

## Solution

### Step 1: Get Your Google OAuth Credentials

If you don't have them yet, follow `SETUP_OAUTH.md` first.

You need:
- **Google Client ID** (looks like: `123456789-abc...xyz.apps.googleusercontent.com`)
- **Google Client Secret** (looks like: `GOCSPX-abc...xyz`)
- **Google Project ID** (looks like: `omni-inbox-123456`)

### Step 2: Set Secrets in Supabase Dashboard

1. **Go to Supabase Dashboard:**
   https://supabase.com/dashboard/project/vntkvhmpnvnqxdprgvjk/settings/functions

2. **Click on "Edge Functions" in the left sidebar**

3. **Click on "Secrets" tab**

4. **Add these secrets:**

   Click "Add new secret" for each:

   ```
   Name: GOOGLE_CLIENT_ID
   Value: YOUR_GOOGLE_CLIENT_ID_HERE
   ```

   ```
   Name: GOOGLE_CLIENT_SECRET
   Value: YOUR_GOOGLE_CLIENT_SECRET_HERE
   ```

   ```
   Name: GOOGLE_PROJECT_ID
   Value: YOUR_GOOGLE_PROJECT_ID_HERE
   ```

   ```
   Name: SUPABASE_URL
   Value: https://vntkvhmpnvnqxdprgvjk.supabase.co
   ```

   ```
   Name: SUPABASE_SERVICE_ROLE_KEY
   Value: (Get this from Settings > API > service_role key)
   ```

5. **Click "Save" for each secret**

### Step 3: Verify Secrets Are Set

After setting the secrets, wait 1-2 minutes for them to propagate, then test again.

### Step 4: Test Sync

1. Go back to http://localhost:8080/test-sync.html
2. Click "Check Auth Status"
3. Click "Load Accounts"
4. Click "Test Sync"
5. Should work now!

---

## Alternative: Deploy Edge Functions Locally (For Testing)

If you want to test locally without deploying to Supabase:

1. **Install Supabase CLI:**
   ```bash
   brew install supabase/tap/supabase
   ```

2. **Create `.env` file in `supabase/` directory:**
   ```bash
   cd supabase
   cat > .env << 'EOF'
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_PROJECT_ID=your_project_id
   SUPABASE_URL=https://vntkvhmpnvnqxdprgvjk.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   EOF
   ```

3. **Start Supabase locally:**
   ```bash
   supabase start
   ```

4. **Serve Edge Functions locally:**
   ```bash
   supabase functions serve
   ```

---

## Troubleshooting

### Error: "Failed to refresh token"
- Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are correct
- Check that they match the credentials in Google Cloud Console

### Error: "OAuth tokens not found"
- The account exists but has no OAuth tokens
- Need to reconnect the Gmail account
- Click "Connect Gmail" in the app

### Error: "Account not found"
- The account ID doesn't exist
- Check the account ID in the test page

### Still not working?
1. Check Supabase Edge Function logs:
   https://supabase.com/dashboard/project/vntkvhmpnvnqxdprgvjk/logs/edge-functions

2. Look for the specific error message

3. Share the error with me

---

## Quick Check: Are Secrets Set?

Unfortunately, Supabase doesn't show secret values in the dashboard for security reasons.
But you can check if they exist by looking at the "Secrets" tab.

You should see:
- ✅ GOOGLE_CLIENT_ID
- ✅ GOOGLE_CLIENT_SECRET
- ✅ GOOGLE_PROJECT_ID
- ✅ SUPABASE_URL
- ✅ SUPABASE_SERVICE_ROLE_KEY

If any are missing, add them!

