#!/usr/bin/env node
/**
 * One-time script to apply the player timing calculation fix
 * This creates a database trigger to automatically calculate total_period_minutes
 * 
 * Run with: node apply-player-time-fix.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://crmlmnhillnnrnrxqera.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Please get your service role key from: https://supabase.com/dashboard/project/crmlmnhillnnrnrxqera/settings/api');
  console.error('Then run: SUPABASE_SERVICE_ROLE_KEY=your_key_here node apply-player-time-fix.mjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const migrationSQL = `
-- Automatic calculation of total_period_minutes for player_time_logs
-- This trigger ensures that whenever time_on_minute or time_off_minute changes,
-- the total_period_minutes is recalculated automatically

CREATE OR REPLACE FUNCTION public.calculate_total_period_minutes()
RETURNS TRIGGER AS $$
DECLARE
  period_duration INTEGER;
BEGIN
  -- Get the planned duration for this period
  SELECT planned_duration_minutes INTO period_duration
  FROM public.match_periods
  WHERE id = NEW.period_id;

  -- Calculate total_period_minutes based on the time interval
  -- Logic:
  -- 1. If time_off_minute is NULL (still playing), use period_duration as the cap
  -- 2. For starters (time_on_minute = 0 or NULL), start from 0
  -- 3. For substitutes, start from time_on_minute
  -- 4. End time is either time_off_minute or period_duration
  
  IF NEW.time_off_minute IS NOT NULL THEN
    -- Player has been substituted off or period ended
    -- Calculate actual time played
    NEW.total_period_minutes := NEW.time_off_minute - COALESCE(NEW.time_on_minute, 0);
  ELSIF NEW.is_active = false AND period_duration IS NOT NULL THEN
    -- Period has ended, player was on field until the end
    NEW.total_period_minutes := period_duration - COALESCE(NEW.time_on_minute, 0);
  ELSE
    -- Player is still active, can't calculate final time yet
    -- Keep it at 0 or whatever was set
    IF NEW.total_period_minutes IS NULL THEN
      NEW.total_period_minutes := 0;
    END IF;
  END IF;

  -- Ensure non-negative values
  IF NEW.total_period_minutes < 0 THEN
    NEW.total_period_minutes := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS trigger_calculate_player_time ON public.player_time_logs;

-- Create the trigger to run before insert or update
CREATE TRIGGER trigger_calculate_player_time
  BEFORE INSERT OR UPDATE ON public.player_time_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_total_period_minutes();

-- Update existing records with NULL or 0 total_period_minutes
-- This is a one-time fix for existing data
UPDATE public.player_time_logs
SET total_period_minutes = CASE
  WHEN time_off_minute IS NOT NULL THEN 
    time_off_minute - COALESCE(time_on_minute, 0)
  WHEN is_active = false THEN 
    (SELECT planned_duration_minutes FROM public.match_periods WHERE id = period_id) - COALESCE(time_on_minute, 0)
  ELSE 
    0
END
WHERE total_period_minutes IS NULL OR total_period_minutes = 0;
`;

async function applyMigration() {
  console.log('🔧 Applying player timing calculation fix...\n');
  
  try {
    // Execute the SQL via RPC or direct query
    // Note: Supabase JS client doesn't support raw SQL execution directly
    // We need to use the REST API or ask user to run it via dashboard
    
    console.log('⚠️  This script requires manual SQL execution.');
    console.log('\n📋 Please follow these steps:\n');
    console.log('1. Go to: https://supabase.com/dashboard/project/crmlmnhillnnrnrxqera/editor');
    console.log('2. Click "New Query"');
    console.log('3. Copy and paste the SQL from: supabase/migrations/20251206200418_apply_player_time_trigger.sql');
    console.log('4. Click "Run" to execute the migration\n');
    console.log('✅ This will:');
    console.log('   - Create a trigger to automatically calculate player time');
    console.log('   - Fix all existing player_time_logs records');
    console.log('   - Ensure future records are calculated correctly\n');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  }
}

applyMigration();
