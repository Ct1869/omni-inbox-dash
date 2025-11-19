import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vntkvhmpnvnqxdprgvjk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudGt2aG1wbnZucXhkcHJndmprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NzYxOTksImV4cCI6MjA3ODU1MjE5OX0._piwgNuyHE1VAP8a4cv_NczqYyJs2lyStBkir-5jX58';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCurrentState() {
  console.log('🔍 Testing Current State After Pull...\n');
  
  // Check accounts
  const { data: accounts, error: accError } = await supabase
    .from('email_accounts')
    .select('id, email, provider, is_active, last_synced_at');
  
  if (accError) {
    console.error('❌ Error fetching accounts:', accError);
    return;
  }
  
  console.log(`📧 Email Accounts: ${accounts.length}`);
  accounts.forEach(acc => {
    console.log(`   - ${acc.email} (${acc.provider}) - Last synced: ${acc.last_synced_at || 'Never'}`);
  });
  
  // Check messages
  const { data: messages, error: msgError } = await supabase
    .from('cached_messages')
    .select('id, subject, received_at')
    .order('received_at', { ascending: false })
    .limit(10);
  
  if (msgError) {
    console.error('❌ Error fetching messages:', msgError);
  } else {
    console.log(`\n📨 Recent Messages: ${messages.length}`);
    messages.forEach(msg => {
      console.log(`   - ${msg.subject.substring(0, 50)}...`);
    });
  }
  
  // Test sync function if we have accounts
  if (accounts.length > 0) {
    console.log(`\n🔄 Testing sync for account: ${accounts[0].email}...`);
    const { data, error } = await supabase.functions.invoke('sync-messages', {
      body: { accountId: accounts[0].id, maxMessages: 5 }
    });
    
    if (error) {
      console.error('❌ Sync failed:', error.message);
    } else {
      console.log('✅ Sync successful!', data);
    }
  }
}

testCurrentState().catch(console.error);

