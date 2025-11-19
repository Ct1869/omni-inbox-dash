import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vntkvhmpnvnqxdprgvjk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudGt2aG1wbnZucXhkcHJndmprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NzYxOTksImV4cCI6MjA3ODU1MjE5OX0._piwgNuyHE1VAP8a4cv_NczqYyJs2lyStBkir-5jX58';

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
