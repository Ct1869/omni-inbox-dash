import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAuth() {
  console.log('🔐 Checking Authentication...\n');
  
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  if (!session) {
    console.log('❌ No active session - User is NOT logged in');
    console.log('👉 This is why email_accounts returns 0 (RLS blocks unauthenticated queries)');
    console.log('👉 Messages might be visible due to different RLS policy');
  } else {
    console.log('✅ User is logged in:', session.user.email);
    console.log('User ID:', session.user.id);
  }
}

checkAuth().catch(console.error);
