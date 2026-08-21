#!/usr/bin/env node
/**
 * Apply the materialized view refresh directly via SQL
 * This clears the stale data from the views
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

console.log('🔄 Refreshing Materialized Views\n');

async function refreshViews() {
  try {
    console.log('📊 Calling refresh_report_views() function...');
    
    const { data, error } = await supabase.rpc('refresh_report_views');
    
    if (error) {
      console.error('❌ Error:', error.message);
      console.log('\n💡 You may need to run this SQL directly in Supabase dashboard:');
      console.log('   SELECT refresh_report_views();');
      console.log('\n   Or run the migration file:');
      console.log('   supabase/migrations/20251207_refresh_stale_views.sql\n');
      return;
    }

    console.log('✅ Views refreshed successfully!\n');

    // Verify the refresh worked
    console.log('🔍 Verifying view refresh...\n');

    const { data: scorers, error: scorersError } = await supabase.rpc('get_goal_scorers');
    console.log(`   Goal Scorers: ${scorers?.length || 0} players`);

    const { data: matches, error: matchesError } = await supabase.rpc('get_completed_matches');
    console.log(`   Completed Matches: ${matches?.length || 0} matches`);

    if ((scorers?.length || 0) === 0 && (matches?.length || 0) === 0) {
      console.log('\n✅ Perfect! Views are now in sync with empty database.');
      console.log('   Ready for fresh match data.\n');
    } else {
      console.log('\n⚠️  Views still contain data. May need manual refresh via dashboard.\n');
    }

  } catch (error) {
    console.error('❌ Exception:', error.message);
  }
}

refreshViews();
