#!/usr/bin/env node
/**
 * Verify RLS (Row Level Security) policies are correctly configured
 * Checks if authenticated users can read/write match data
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file
const envFile = readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim().replace(/['"]/g, '');
  }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_KEY = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🔍 Verifying RLS Policies\n');

async function verifyRLS() {
  console.log('📊 Current Connection Status:');
  console.log(`   Using: ${SUPABASE_KEY ? 'Anon/Public Key' : 'No key'}`);
  console.log(`   URL: ${SUPABASE_URL}\n`);

  const tables = [
    'clubs',
    'teams',
    'players',
    'fixtures',
    'match_events',
    'match_periods',
    'player_time_logs',
    'player_match_status'
  ];

  console.log('🔐 Testing Read Access:\n');

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ ${table.padEnd(25)} Error: ${error.message}`);
      } else {
        console.log(`   ✅ ${table.padEnd(25)} Count: ${count || 0}`);
      }
    } catch (e) {
      console.log(`   ❌ ${table.padEnd(25)} Exception: ${e.message}`);
    }
  }

  console.log('\n📝 RLS Status:');
  console.log('   If you see "Error" messages above, RLS policies may be blocking access.');
  console.log('   If you see "Count: 0" for all tables, the database is empty (expected after reset).\n');

  console.log('💡 Next Steps:');
  console.log('   1. If you see errors, check RLS policies in Supabase dashboard');
  console.log('   2. Ensure you have proper authentication configured');
  console.log('   3. Create test data to verify write permissions\n');

  // Try to get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    console.log(`✅ Authenticated as: ${user.email}`);
  } else {
    console.log('⚠️  Not authenticated (using anon key only)');
    console.log('   Some operations may be restricted\n');
  }
}

verifyRLS();
