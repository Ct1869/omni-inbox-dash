#!/bin/bash

echo "🔍 Checking Environment Variables..."
echo ""

# Load .env file
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check Supabase variables
echo "✅ Supabase Configuration:"
echo "   VITE_SUPABASE_URL: ${VITE_SUPABASE_URL:-❌ NOT SET}"
echo "   VITE_SUPABASE_PROJECT_ID: ${VITE_SUPABASE_PROJECT_ID:-❌ NOT SET}"
echo "   VITE_SUPABASE_PUBLISHABLE_KEY: ${VITE_SUPABASE_PUBLISHABLE_KEY:0:20}... (${#VITE_SUPABASE_PUBLISHABLE_KEY} chars)"
echo ""

# Check Google OAuth variables
echo "🔐 Google OAuth Configuration:"
if [ -z "$VITE_GOOGLE_CLIENT_ID" ] || [ "$VITE_GOOGLE_CLIENT_ID" = "YOUR_GOOGLE_CLIENT_ID_HERE" ]; then
  echo "   ❌ VITE_GOOGLE_CLIENT_ID: NOT CONFIGURED"
  echo "   👉 Follow SETUP_OAUTH.md to get your Google Client ID"
else
  echo "   ✅ VITE_GOOGLE_CLIENT_ID: ${VITE_GOOGLE_CLIENT_ID:0:30}..."
fi

if [ -z "$VITE_OAUTH_REDIRECT_URI" ]; then
  echo "   ⚠️  VITE_OAUTH_REDIRECT_URI: NOT SET (will use default)"
else
  echo "   ✅ VITE_OAUTH_REDIRECT_URI: $VITE_OAUTH_REDIRECT_URI"
fi
echo ""

# Check Microsoft OAuth variables (optional)
echo "🔐 Microsoft OAuth Configuration (Optional):"
if [ -z "$VITE_MICROSOFT_CLIENT_ID" ] || [ "$VITE_MICROSOFT_CLIENT_ID" = "YOUR_MICROSOFT_CLIENT_ID_HERE" ]; then
  echo "   ⚠️  VITE_MICROSOFT_CLIENT_ID: NOT CONFIGURED"
  echo "   👉 Only needed if you want to connect Outlook accounts"
else
  echo "   ✅ VITE_MICROSOFT_CLIENT_ID: ${VITE_MICROSOFT_CLIENT_ID:0:30}..."
fi
echo ""

# Summary
echo "📋 Summary:"
if [ -z "$VITE_GOOGLE_CLIENT_ID" ] || [ "$VITE_GOOGLE_CLIENT_ID" = "YOUR_GOOGLE_CLIENT_ID_HERE" ]; then
  echo "   ❌ Gmail connection will NOT work"
  echo "   👉 Please follow SETUP_OAUTH.md to configure Google OAuth"
else
  echo "   ✅ Gmail connection should work"
  echo "   👉 Make sure to also set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Supabase Edge Functions"
fi
echo ""
echo "📖 For detailed setup instructions, see: SETUP_OAUTH.md"

