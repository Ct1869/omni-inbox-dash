import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vntkvhmpnvnqxdprgvjk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudGt2aG1wbnZucXhkcHJndmprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NzYxOTksImV4cCI6MjA3ODU1MjE5OX0._piwgNuyHE1VAP8a4cv_NczqYyJs2lyStBkir-5jX58';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSync() {
  console.log('Testing sync function...\n');
  
  const accountId = '2ed481f1-a55d-4575-8970-87700d914d7e';
  
  try {
    console.log(`Calling sync-messages for account ${accountId}...`);
    
    const { data, error } = await supabase.functions.invoke('sync-messages', {
      body: { accountId, maxMessages: 10 }
    });
    
    if (error) {
      console.error('❌ Error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Try to get more details
      if (error.context) {
        console.error('Context:', error.context);
      }
    } else {
      console.log('✅ Success!');
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('❌ Exception:', err);
  }
}

testSync();
