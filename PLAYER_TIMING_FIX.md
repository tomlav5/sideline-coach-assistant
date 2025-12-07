# Player Timing Calculation Fix

## Problem
The `total_period_minutes` field in the `player_time_logs` table was never being calculated. It remained at 0 for all records, causing player timing reports to show incorrect data.

## Solution
A database trigger has been created that automatically calculates `total_period_minutes` whenever a player time log is created or updated. The calculation works as follows:

- **Starter who played full period**: `total_period_minutes = planned_duration_minutes`
- **Starter substituted off**: `total_period_minutes = time_off_minute - 0`
- **Substitute who came on and stayed**: `total_period_minutes = planned_duration_minutes - time_on_minute`
- **Substitute who came on and went off**: `total_period_minutes = time_off_minute - time_on_minute`

## How to Apply the Fix

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase SQL Editor: https://supabase.com/dashboard/project/crmlmnhillnnrnrxqera/editor
2. Click **"New Query"**
3. Copy the entire contents of: `supabase/migrations/20251206200418_apply_player_time_trigger.sql`
4. Paste into the SQL editor
5. Click **"Run"** to execute the migration

### Option 2: Supabase CLI (If you can resolve migration history)

```bash
supabase db push
```

If this fails due to migration history conflicts, use Option 1 instead.

## What This Does

1. **Creates a database function**: `calculate_total_period_minutes()` that performs the calculation
2. **Creates a trigger**: Automatically runs before every INSERT or UPDATE on `player_time_logs`
3. **Fixes existing data**: Updates all records where `total_period_minutes` is NULL or 0

## Verification

After applying the migration, you can verify it worked by:

1. **Check the trigger exists**:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trigger_calculate_player_time';
   ```

2. **Check existing data was fixed**:
   ```sql
   SELECT 
     player_id, 
     time_on_minute, 
     time_off_minute, 
     total_period_minutes
   FROM player_time_logs
   WHERE total_period_minutes > 0
   LIMIT 10;
   ```

3. **Test with new match**: Start a new match and track player time - it should now calculate automatically

## Files Changed

- `supabase/migrations/20251206200418_apply_player_time_trigger.sql` - The migration file
- `PLAYER_TIMING_FIX.md` - This documentation
- `apply-player-time-fix.mjs` - Helper script (instructions only)

## Support

If you encounter any issues applying this fix, contact your database administrator or check the Supabase dashboard logs for error messages.
