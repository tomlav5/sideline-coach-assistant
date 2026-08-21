#!/usr/bin/env node
/**
 * Deep investigation into where goals data is stored
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

console.log('🔍 Investigating Goals Data Storage\n');

async function investigate() {
  try {
    // 1. Check ALL match events (no filters)
    console.log('📊 Step 1: Counting ALL match_events...');
    const { count: totalEvents, error: countError } = await supabase
      .from('match_events')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   Total match_events: ${totalEvents}`);

    // 2. Check goal events (no team filter)
    console.log('\n📊 Step 2: Counting goal events (any team)...');
    const { data: allGoals, error: goalsError } = await supabase
      .from('match_events')
      .select('id, event_type, is_our_team')
      .eq('event_type', 'goal');
    
    console.log(`   Goal events found: ${allGoals?.length || 0}`);
    if (allGoals && allGoals.length > 0) {
      const ourGoals = allGoals.filter(g => g.is_our_team).length;
      const theirGoals = allGoals.filter(g => !g.is_our_team).length;
      console.log(`   - Our team goals: ${ourGoals}`);
      console.log(`   - Opponent goals: ${theirGoals}`);
    }

    // 3. Check what event_types exist
    console.log('\n📊 Step 3: Checking event_types distribution...');
    const { data: allEvents, error: eventsError } = await supabase
      .from('match_events')
      .select('event_type');
    
    if (allEvents) {
      const eventTypes = {};
      allEvents.forEach(e => {
        eventTypes[e.event_type] = (eventTypes[e.event_type] || 0) + 1;
      });
      console.log('   Event type distribution:');
      Object.entries(eventTypes).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count}`);
      });
    }

    // 4. Sample some events
    console.log('\n📊 Step 4: Sample recent match events...');
    const { data: sampleEvents, error: sampleError } = await supabase
      .from('match_events')
      .select('id, event_type, is_our_team, player_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (sampleEvents && sampleEvents.length > 0) {
      console.log('   Recent events:');
      sampleEvents.forEach(e => {
        console.log(`   - ${e.event_type} | is_our_team: ${e.is_our_team} | player: ${e.player_id?.slice(0,8)}... | ${new Date(e.created_at).toISOString().split('T')[0]}`);
      });
    } else {
      console.log('   No events found or error:', sampleError);
    }

    // 5. Check if there's an analytics schema table
    console.log('\n📊 Step 5: Checking for analytics data...');
    console.log('   (Materialized view shows 17 players with goals)');
    console.log('   This suggests data exists somewhere!\n');

    // 6. Try to query the mv directly (might fail due to RLS)
    console.log('📊 Step 6: Attempting to query materialized view details...');
    try {
      // Get the first player from get_goal_scorers
      const { data: scorers } = await supabase.rpc('get_goal_scorers');
      if (scorers && scorers.length > 0) {
        const topScorer = scorers[0];
        console.log(`\n   Top scorer: ${topScorer.first_name} ${topScorer.last_name}`);
        console.log(`   Goals: ${topScorer.goals}, Assists: ${topScorer.assists}`);
        console.log(`   Player ID: ${topScorer.player_id}`);

        // Try to find their goal events
        console.log(`\n   Looking for their goal events in match_events...`);
        const { data: playerGoals, error: pgError } = await supabase
          .from('match_events')
          .select('*')
          .eq('player_id', topScorer.player_id)
          .eq('event_type', 'goal');
        
        console.log(`   Found: ${playerGoals?.length || 0} goal events`);
        if (pgError) console.log('   Error:', pgError.message);
      }
    } catch (e) {
      console.log('   Error querying:', e.message);
    }

    // 7. Check match_periods and fixtures to see if matches exist
    console.log('\n📊 Step 7: Checking if matches exist...');
    const { count: fixtureCount } = await supabase
      .from('fixtures')
      .select('*', { count: 'exact', head: true });
    console.log(`   Total fixtures: ${fixtureCount}`);

    const { count: completedCount } = await supabase
      .from('fixtures')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');
    console.log(`   Completed fixtures: ${completedCount}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

investigate();
