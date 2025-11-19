const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMessages() {
  console.log('Checking database...\n');
  
  // Check accounts
  const { data: accounts, error: accError } = await supabase
    .from('email_accounts')
    .select('id, email, provider, is_active, last_synced_at');
  
  if (accError) {
    console.error('Error fetching accounts:', accError);
    return;
  }
  
  console.log(`Found ${accounts.length} email accounts:`);
  accounts.forEach(acc => {
    console.log(`  - ${acc.email} (${acc.provider}) - Active: ${acc.is_active} - Last synced: ${acc.last_synced_at || 'Never'}`);
  });
  
  // Check messages
  const { data: messages, error: msgError } = await supabase
    .from('cached_messages')
    .select('id, account_id, subject, received_at')
    .limit(10);
  
  if (msgError) {
    console.error('Error fetching messages:', msgError);
    return;
  }
  
  console.log(`\nFound ${messages.length} messages in database`);
  if (messages.length > 0) {
    console.log('Sample messages:');
    messages.forEach(msg => {
      console.log(`  - ${msg.subject} (${msg.received_at})`);
    });
  } else {
    console.log('No messages found. You need to click "Sync Now" to fetch emails.');
  }
}

checkMessages().catch(console.error);
