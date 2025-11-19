import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
    console.log(`     Created: ${acc.created_at}`);
    console.log('');
  });
  
  // Check tokens for each account
  for (const account of accounts) {
    const { data: token, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('access_token, refresh_token, expires_at, scope')
      .eq('account_id', account.id)
      .single();
    
    if (tokenError) {
      console.log(`   ⚠️  No OAuth token found for ${account.email}`);
    } else {
      const expiresAt = new Date(token.expires_at);
      const isExpired = expiresAt < new Date();
      console.log(`   🔑 OAuth token for ${account.email}:`);
      console.log(`      Access token: ${token.access_token.substring(0, 20)}...`);
      console.log(`      Refresh token: ${token.refresh_token ? token.refresh_token.substring(0, 20) + '...' : 'None'}`);
      console.log(`      Expires: ${token.expires_at} ${isExpired ? '(EXPIRED)' : '(Valid)'}`);
      console.log(`      Scope: ${token.scope}`);
      console.log('');
    }
  }
  
  // Check messages
  const { data: messages, error: msgError } = await supabase
    .from('cached_messages')
    .select('id, account_id, subject, received_at')
    .order('received_at', { ascending: false })
    .limit(5);
  
  if (msgError) {
    console.error('❌ Error fetching messages:', msgError);
    return;
  }
  
  console.log(`\n📨 Found ${messages.length} messages in database (showing latest 5):`);
  if (messages.length > 0) {
    messages.forEach(msg => {
      const account = accounts.find(a => a.id === msg.account_id);
      console.log(`   - "${msg.subject}"`);
      console.log(`     Account: ${account?.email || 'Unknown'}`);
      console.log(`     Received: ${msg.received_at}`);
      console.log('');
    });
  } else {
    console.log('   ⚠️  No messages found. Need to sync!');
  }
  
  // Check sync jobs
  const { data: syncJobs, error: syncError } = await supabase
    .from('sync_jobs')
    .select('id, account_id, status, messages_synced, created_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (!syncError && syncJobs.length > 0) {
    console.log(`\n🔄 Recent sync jobs (latest 5):`);
    syncJobs.forEach(job => {
      const account = accounts.find(a => a.id === job.account_id);
      console.log(`   - Account: ${account?.email || 'Unknown'}`);
      console.log(`     Status: ${job.status}`);
      console.log(`     Messages synced: ${job.messages_synced || 0}`);
      console.log(`     Created: ${job.created_at}`);
      console.log(`     Completed: ${job.completed_at || 'In progress'}`);
      console.log('');
    });
  }
}

checkDatabase().catch(console.error);
