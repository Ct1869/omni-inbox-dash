import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vntkvhmpnvnqxdprgvjk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudGt2aG1wbnZucXhkcHJndmprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NzYxOTksImV4cCI6MjA3ODU1MjE5OX0._piwgNuyHE1VAP8a4cv_NczqYyJs2lyStBkir-5jX58';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('🔍 Checking Database...\n');
  
  // Check accounts
  const { data: accounts, error: accError } = await supabase
    .from('email_accounts')
    .select('id, email, provider, is_active, last_synced_at, created_at');
  
  if (accError) {
    console.error('❌ Error fetching accounts:', accError);
    return;
  }
  
  console.log(`📧 Found ${accounts.length} email accounts:`);
  accounts.forEach(acc => {
    console.log(`   - ${acc.email} (${acc.provider})`);
    console.log(`     ID: ${acc.id}`);
    console.log(`     Active: ${acc.is_active}`);
    console.log(`     Last synced: ${acc.last_synced_at || 'Never'}`);
    console.log('');
  });
  
  // Check tokens for each account
  for (const account of accounts) {
    const { data: token, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('account_id', account.id)
      .single();
    
    if (tokenError) {
      console.log(`   ⚠️  No OAuth token found for ${account.email}`);
    } else {
      const expiresAt = new Date(token.expires_at);
      const isExpired = expiresAt < new Date();
      console.log(`   🔑 OAuth token for ${account.email}:`);
      console.log(`      Expires: ${token.expires_at} ${isExpired ? '(EXPIRED)' : '(Valid)'}`);
      console.log(`      Has refresh token: ${token.refresh_token ? 'Yes' : 'No'}`);
    }
  }
  
  // Check messages
  const { data: messages, error: msgError } = await supabase
    .from('cached_messages')
    .select('id, account_id, subject')
    .limit(5);
  
  if (msgError) {
    console.error('❌ Error fetching messages:', msgError);
  } else {
    console.log(`\n📨 Total messages in database: ${messages.length > 0 ? 'At least ' + messages.length : '0'}`);
    if (messages.length === 0) {
      console.log('   ⚠️  No messages found. Need to sync!');
    }
  }
}

checkDatabase().catch(console.error);
