# OAuth Setup Guide for Omni Inbox

## 🚨 Current Issue
**Error:** "Edge Function returned a non-2xx status code"  
**Cause:** Google OAuth credentials are not configured

---

## 📋 Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name: **Omni Inbox**
4. Click **Create**

### 2. Enable Gmail API

1. Go to **APIs & Services** → **Library**
2. Search for **"Gmail API"**
3. Click **Enable**

### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. User Type: **External** → Click **Create**
3. Fill in:
   - App name: **Omni Inbox**
   - User support email: Your email
   - Developer contact: Your email
4. Click **Save and Continue**
5. **Scopes:** Click **Add or Remove Scopes**, add these:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
6. Click **Save and Continue**
7. **Test users:** Add your Gmail address (e.g., stemmagazine12@gmail.com)
8. Click **Save and Continue**

### 4. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: **Omni Inbox Web Client**
5. **Authorized JavaScript origins:**
   ```
   http://localhost:8080
   https://vntkvhmpnvnqxdprgvjk.supabase.co
   ```
6. **Authorized redirect URIs:**
   ```
   http://localhost:8080/dashboard
   https://vntkvhmpnvnqxdprgvjk.supabase.co/functions/v1/gmail-oauth
   ```
7. Click **Create**
8. **IMPORTANT:** Copy the **Client ID** and **Client Secret**

### 5. Update Local .env File

Replace the placeholders in `.env`:

```env
VITE_GOOGLE_CLIENT_ID="YOUR_CLIENT_ID_HERE"
```

Example:
```env
VITE_GOOGLE_CLIENT_ID="123456789-abcdefghijklmnop.apps.googleusercontent.com"
```

### 6. Update Supabase Edge Function Secrets

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/vntkvhmpnvnqxdprgvjk/settings/functions)
2. Click **Edge Functions** → **Secrets**
3. Add these secrets:

```
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_PROJECT_ID=YOUR_GOOGLE_CLOUD_PROJECT_ID
```

To get your Google Cloud Project ID:
- Go to Google Cloud Console
- Click on the project dropdown at the top
- Copy the **Project ID** (not the name)

### 7. Restart Dev Server

```bash
# Stop the server (Ctrl+C)
# Start it again
npm run dev
```

---

## ✅ Testing

1. Refresh browser: http://localhost:8080/
2. Click **"Connect Gmail"** button
3. You should be redirected to Google OAuth consent screen
4. Grant permissions
5. You'll be redirected back to the dashboard
6. Click **"Sync Now"** to fetch emails

---

## 🔍 Troubleshooting

### Error: "redirect_uri_mismatch"
- Make sure the redirect URI in Google Cloud Console matches exactly:
  - `http://localhost:8080/dashboard` (for local dev)
  
### Error: "Access blocked: This app's request is invalid"
- Make sure you added your email as a test user in OAuth consent screen

### Error: "Edge Function returned a non-2xx status code"
- Check Supabase Edge Function logs
- Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in Supabase

### Still not working?
- Open browser console (F12)
- Share the error messages
- Check Supabase Edge Function logs in the dashboard

---

## 📝 Next Steps After Setup

Once OAuth is working:
1. Connect your Gmail accounts
2. Click "Sync Now" to fetch messages
3. Test the application
4. Deploy to Hetzner with Coolify (we'll do this together)

