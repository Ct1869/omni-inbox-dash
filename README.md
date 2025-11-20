# Omni Inbox Dashboard

A modern, unified email management system for managing multiple Gmail and Outlook accounts with a sleek, cyberpunk-inspired UI.

![Status](https://img.shields.io/badge/status-active-success)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/Ct1869/omni-inbox-dash.git
cd omni-inbox-dash

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
# Opens at http://localhost:8080 (or 8081 if 8080 is in use)
```

---

## 📋 Features

### ✅ Implemented
- **Unified Inbox** - View emails from all accounts in one place
- **Multi-Account Support** - Connect unlimited Gmail and Outlook accounts
- **Email Search** - Search across subject, sender, and body text
- **Compose & Send** - Send new emails with both Gmail and Outlook
- **Reply & Forward** - Reply to or forward emails with pre-filled content
- **Folder Management** - Inbox, Sent, Starred, Archive, Trash
- **OAuth Authentication** - Secure login with Google and Microsoft
- **Real-time Sync** - Manual sync with progress indicators
- **Modern UI** - Cyberpunk-inspired design with dark mode

### 🎨 UI Components
- Responsive sidebar with account management
- Email list with checkboxes for bulk actions
- Email detail view with quick actions
- Compose modal with rich text support
- Add account modal for OAuth flow

---

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** - Fast build tool
- **TailwindCSS** - Utility-first CSS
- **Lucide React** - Icon library
- **Sonner** - Toast notifications
- **React Router** - Client-side routing

### Backend
- **Supabase** - PostgreSQL database, Auth, Edge Functions
- **Deno** - Edge Functions runtime
- **Gmail API** - Gmail integration
- **Microsoft Graph API** - Outlook integration

### Database Tables
- `email_accounts` - Email account metadata
- `oauth_tokens` - OAuth credentials
- `cached_messages` - Email storage
- `sync_jobs` - Sync operation tracking

---

## 📁 Project Structure

```
omni-inbox-dash/
├── src/
│   ├── components/
│   │   └── frontomni/          # UI components
│   │       ├── Sidebar.tsx     # Account sidebar
│   │       ├── EmailList.tsx   # Email list view
│   │       ├── EmailDetail.tsx # Email detail view
│   │       ├── ComposeModal.tsx # Compose dialog
│   │       └── AddAccountModal.tsx # Add account dialog
│   ├── pages/
│   │   ├── Auth.tsx            # Login/signup page
│   │   └── UnifiedInbox.tsx    # Main inbox page
│   ├── types/
│   │   └── frontomni.ts        # TypeScript types
│   ├── constants/
│   │   └── frontomni.ts        # UI constants
│   └── App.tsx                 # Main app & routing
├── supabase/
│   ├── functions/
│   │   ├── sync-messages/      # Gmail sync
│   │   ├── sync-outlook-messages/ # Outlook sync
│   │   ├── send-reply/         # Gmail send
│   │   └── send-outlook-reply/ # Outlook send
│   └── migrations/             # Database schema
└── .env                        # Environment variables
```

---

## ⚙️ Environment Setup

Create a `.env` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key

# OAuth Configuration (optional for local dev)
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_MICROSOFT_CLIENT_ID=your_microsoft_client_id
```

### Getting Credentials

1. **Supabase:**
   - Create a project at https://supabase.com
   - Get URL and anon key from Settings → API

2. **Google OAuth:**
   - Create credentials at https://console.cloud.google.com/apis/credentials
   - Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`
   - Required scopes: `gmail.readonly`, `gmail.send`, `gmail.modify`

3. **Microsoft OAuth:**
   - Register app at https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps
   - Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`
   - Required scopes: `Mail.Read`, `Mail.Send`, `Mail.ReadWrite`, `offline_access`

---

## 🔧 Development

### Available Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Key Features Implementation

#### Email Search
- Searches across `subject`, `sender_name`, `sender_email`, and `body_text`
- Uses Supabase `or` and `ilike` filters
- Real-time filtering as you type

#### Folder Filtering
- **Inbox:** Default view
- **Sent:** Emails with 'sent' label
- **Starred:** Emails marked as starred
- **Trash:** Emails with 'trash' label
- **Archive:** Emails with 'archive' label

#### Compose Email
- New email composition
- Reply with quoted text
- Forward with original message
- Provider-specific send functions

#### Sync Functionality
- Manual sync via sidebar button
- Provider-specific sync functions
- Auth error handling (401) with reconnect prompt
- Progress indicators and toast notifications

---

## 🚀 Deployment

### Supabase Edge Functions

Deploy the backend functions:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy all functions
supabase functions deploy sync-messages
supabase functions deploy sync-outlook-messages
supabase functions deploy send-reply
supabase functions deploy send-outlook-reply
```

### Frontend Deployment

Build and deploy the frontend:

```bash
# Build for production
npm run build

# Deploy to your hosting provider (Vercel, Netlify, etc.)
# The build output is in the `dist/` directory
```

---

## 🐛 Troubleshooting

### Sync Returns 500 Error
- **Cause:** Expired OAuth tokens
- **Solution:** The app will show a "Session expired" toast. Click "Reconnect" to re-authenticate.

### Emails Not Loading
1. Check browser console for errors
2. Verify Supabase credentials in `.env`
3. Check that Edge Functions are deployed
4. Verify OAuth tokens are valid

### Dev Server Port Conflict
- If port 8080 is in use, Vite will automatically try 8081
- Check the terminal output for the actual port

### Import Errors After Update
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 🔐 Security

- **Authentication:** Supabase Auth with JWT tokens
- **Row Level Security:** All database tables have RLS enabled
- **OAuth Tokens:** Stored securely in Supabase, never exposed to client
- **API Keys:** Environment variables, not committed to git

---

## 📊 Performance

### Sync Performance
- Gmail: ~2-3 seconds per account
- Outlook: ~3-4 seconds per account
- Batch processing with error handling

### Database
- Efficient indexing on `account_id`, `message_id`, `received_at`
- Incremental sync using `historyId` (Gmail) and `deltaLink` (Outlook)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m "feat: your feature description"`
6. Push: `git push origin feature/your-feature`
7. Create a Pull Request

---

## 📝 License

This project is private and proprietary.

---

## 📞 Support

- **Repository:** https://github.com/Ct1869/omni-inbox-dash
- **Issues:** Create an issue on GitHub

---

**Last Updated:** 2025-11-20  
**Version:** 2.0.0  
**Status:** Production Ready
