#!/usr/bin/env node

/**
 * Test OAuth Token Validator
 * 
 * This script helps you validate OAuth tokens before bulk importing.
 * It checks if tokens are valid and can access Gmail/Outlook APIs.
 * 
 * Usage:
 *   node scripts/test-oauth-tokens.mjs test-tokens.csv
 * 
 * CSV Format:
 *   email,provider,access_token,refresh_token,expires_at
 */

import { readFileSync } from 'fs';

async function testGmailToken(accessToken) {
  try {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, email: data.emailAddress };
    } else if (response.status === 401) {
      return { valid: false, error: 'Token expired or invalid' };
    } else {
      return { valid: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function testOutlookToken(accessToken) {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, email: data.mail || data.userPrincipalName };
    } else if (response.status === 401) {
      return { valid: false, error: 'Token expired or invalid' };
    } else {
      return { valid: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function validateTokens(csvPath) {
  console.log('🔍 Reading CSV file...\n');
  
  const csvContent = readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    console.error('❌ CSV file is empty or has no data rows');
    process.exit(1);
  }

  // Parse header
  const header = lines[0].toLowerCase().split(',').map(h => h.trim());
  const emailIdx = header.indexOf('email');
  const providerIdx = header.indexOf('provider');
  const accessTokenIdx = header.indexOf('access_token');

  if (emailIdx === -1 || providerIdx === -1 || accessTokenIdx === -1) {
    console.error('❌ CSV must have columns: email, provider, access_token, refresh_token, expires_at');
    process.exit(1);
  }

  console.log(`📊 Found ${lines.length - 1} accounts to validate\n`);

  let validCount = 0;
  let invalidCount = 0;
  const errors = [];

  // Test each token (limit to first 10 for quick validation)
  const testLimit = Math.min(10, lines.length - 1);
  console.log(`🧪 Testing first ${testLimit} accounts...\n`);

  for (let i = 1; i <= testLimit; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const email = values[emailIdx];
    const provider = values[providerIdx];
    const accessToken = values[accessTokenIdx];

    process.stdout.write(`[${i}/${testLimit}] Testing ${email} (${provider})... `);

    let result;
    if (provider === 'gmail') {
      result = await testGmailToken(accessToken);
    } else if (provider === 'outlook') {
      result = await testOutlookToken(accessToken);
    } else {
      result = { valid: false, error: `Invalid provider: ${provider}` };
    }

    if (result.valid) {
      console.log(`✅ Valid (${result.email})`);
      validCount++;
    } else {
      console.log(`❌ Invalid (${result.error})`);
      invalidCount++;
      errors.push({ email, provider, error: result.error });
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📈 Validation Summary');
  console.log('='.repeat(60));
  console.log(`✅ Valid tokens:   ${validCount}/${testLimit}`);
  console.log(`❌ Invalid tokens: ${invalidCount}/${testLimit}`);
  console.log(`📝 Total accounts: ${lines.length - 1}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(({ email, provider, error }) => {
      console.log(`   - ${email} (${provider}): ${error}`);
    });
  }

  console.log('\n💡 Next Steps:');
  if (invalidCount === 0) {
    console.log('   ✅ All tested tokens are valid!');
    console.log('   ✅ You can proceed with bulk import');
  } else {
    console.log('   ⚠️  Some tokens are invalid');
    console.log('   ⚠️  Fix the invalid tokens before importing');
    console.log('   ⚠️  Common issues:');
    console.log('      - Tokens expired (need to refresh)');
    console.log('      - Wrong token format');
    console.log('      - Insufficient OAuth scopes');
  }

  console.log('\n📖 To import accounts:');
  console.log('   1. Go to http://localhost:5173/settings');
  console.log('   2. Click "Import Accounts"');
  console.log('   3. Select your CSV file');
  console.log('   4. Wait for import to complete\n');
}

// Main
const csvPath = process.argv[2];

if (!csvPath) {
  console.error('Usage: node scripts/test-oauth-tokens.mjs <csv-file>');
  console.error('Example: node scripts/test-oauth-tokens.mjs accounts.csv');
  process.exit(1);
}

validateTokens(csvPath).catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

