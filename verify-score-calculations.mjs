#!/usr/bin/env node
/**
 * Script to verify score tally calculations
 * Checks if goals and assists are being counted correctly
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

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🔍 Verifying Score Calculations\n');

async function verifyScores() {
  try {
    // 1. Get materialized view definition
    console.log('📊 Step 1: Checking materialized view...');
    const { data: mvData, error: mvError } = await supabase
      .rpc('get_goal_scorers');
    
    if (mvError) {
      console.error('❌ Error fetching goal scorers:', mvError);
    } else {
      console.log(`✅ Found ${mvData?.length || 0} players in goal scorers view`);
      if (mvData && mvData.length > 0) {
        console.log('\nTop 5 from materialized view:');
        mvData.slice(0, 5).forEach((player, i) => {
          console.log(`  ${i + 1}. ${player.first_name} ${player.last_name}: ${player.goals} goals, ${player.assists} assists`);
        });
      }
    }

    // 2. Count goals directly from match_events
    console.log('\n📊 Step 2: Counting goals directly from match_events...');
    const { data: events, error: eventsError } = await supabase
      .from('match_events')
      .select(`
        id,
        event_type,
        player_id,
        assist_player_id,
        is_our_team,
        players!fk_match_events_player_id (
          id,
          first_name,
          last_name
        )
      `)
      .eq('event_type', 'goal')
      .eq('is_our_team', true);

    if (eventsError) {
      console.error('❌ Error fetching events:', eventsError);
    } else {
      console.log(`✅ Found ${events?.length || 0} goal events in match_events table`);
      
      // Count goals per player
      const goalCounts = {};
      const assistCounts = {};
      
      events?.forEach(event => {
        if (event.player_id) {
          goalCounts[event.player_id] = (goalCounts[event.player_id] || 0) + 1;
        }
        if (event.assist_player_id) {
          assistCounts[event.assist_player_id] = (assistCounts[event.assist_player_id] || 0) + 1;
        }
      });

      console.log(`\n📈 Direct count from match_events:`);
      console.log(`   ${Object.keys(goalCounts).length} unique goal scorers`);
      console.log(`   ${Object.keys(assistCounts).length} unique assist providers`);

      // Compare with materialized view
      console.log('\n🔄 Comparing counts...\n');
      
      let discrepancies = 0;
      
      // Check each player in the materialized view
      mvData?.forEach(mv => {
        const directGoals = goalCounts[mv.player_id] || 0;
        const directAssists = assistCounts[mv.player_id] || 0;
        const mvGoals = mv.goals || 0;
        const mvAssists = mv.assists || 0;

        if (directGoals !== mvGoals || directAssists !== mvAssists) {
          discrepancies++;
          console.log(`⚠️  MISMATCH: ${mv.first_name} ${mv.last_name}`);
          console.log(`   Goals - MV: ${mvGoals}, Direct: ${directGoals} ${mvGoals !== directGoals ? '❌' : '✅'}`);
          console.log(`   Assists - MV: ${mvAssists}, Direct: ${directAssists} ${mvAssists !== directAssists ? '❌' : '✅'}`);
          console.log('');
        }
      });

      // Check for players with goals but not in MV
      Object.entries(goalCounts).forEach(([playerId, count]) => {
        const inMV = mvData?.find(mv => mv.player_id === playerId);
        if (!inMV) {
          discrepancies++;
          console.log(`⚠️  Player with ${count} goals NOT in materialized view`);
          console.log(`   Player ID: ${playerId}`);
        }
      });

      if (discrepancies === 0) {
        console.log('✅ All calculations match! No discrepancies found.');
      } else {
        console.log(`\n❌ Found ${discrepancies} discrepancies`);
      }
    }

    // 3. Check if materialized view needs refresh
    console.log('\n📊 Step 3: Checking view freshness...');
    console.log('💡 If discrepancies found, try refreshing the materialized view:');
    console.log('   SELECT refresh_report_views();');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyScores();
