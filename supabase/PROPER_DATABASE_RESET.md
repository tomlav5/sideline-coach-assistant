# Proper Database Reset Procedure

## ⚠️ Important
When clearing database data, you must **refresh materialized views** to prevent stale data from appearing in reports.

## The Problem
Materialized views cache aggregated data. If you delete source data without refreshing the views, reports will show phantom/stale data that no longer exists.

## Proper Reset Steps

### Option 1: Full Database Reset (Recommended)

Use Supabase CLI to properly reset everything:

```bash
# This will reset the database to match migrations
supabase db reset
```

This automatically:
- Drops all tables
- Re-runs all migrations
- Recreates materialized views
- Ensures everything is in sync

### Option 2: Manual Data Clearing (When you need to keep structure)

If you need to clear data but keep the schema:

1. **Delete data from source tables:**
   ```sql
   -- Delete in correct order to respect foreign keys
   DELETE FROM match_events;
   DELETE FROM player_time_logs;
   DELETE FROM match_periods;
   DELETE FROM player_match_status;
   DELETE FROM fixtures;
   DELETE FROM team_players;
   DELETE FROM players;
   DELETE FROM teams;
   -- Add other tables as needed
   ```

2. **Immediately refresh materialized views:**
   ```sql
   REFRESH MATERIALIZED VIEW analytics.mv_completed_matches;
   REFRESH MATERIALIZED VIEW analytics.mv_goal_scorers;
   REFRESH MATERIALIZED VIEW analytics.mv_player_playing_time;
   REFRESH MATERIALIZED VIEW analytics.mv_competitions;
   ```

   Or use the built-in function:
   ```sql
   SELECT refresh_report_views();
   ```

### Option 3: Delete Specific Match Data

To clear just one match or fixture:

```sql
-- 1. Delete the match data
DELETE FROM match_events WHERE fixture_id = 'YOUR_FIXTURE_ID';
DELETE FROM player_time_logs WHERE fixture_id = 'YOUR_FIXTURE_ID';
DELETE FROM match_periods WHERE fixture_id = 'YOUR_FIXTURE_ID';
DELETE FROM player_match_status WHERE fixture_id = 'YOUR_FIXTURE_ID';
DELETE FROM fixtures WHERE id = 'YOUR_FIXTURE_ID';

-- 2. Refresh views
SELECT refresh_report_views();
```

## Quick Reference Script

Save this as a SQL snippet in Supabase dashboard:

```sql
-- Clear all match data and refresh views
BEGIN;

-- Delete match data
TRUNCATE match_events CASCADE;
TRUNCATE player_time_logs CASCADE;
TRUNCATE match_periods CASCADE;
TRUNCATE player_match_status CASCADE;
TRUNCATE fixtures CASCADE;

-- Refresh materialized views
REFRESH MATERIALIZED VIEW analytics.mv_completed_matches;
REFRESH MATERIALIZED VIEW analytics.mv_goal_scorers;
REFRESH MATERIALIZED VIEW analytics.mv_player_playing_time;
REFRESH MATERIALIZED VIEW analytics.mv_competitions;

COMMIT;

-- Verify
SELECT 'Completed Matches' as view_name, COUNT(*) as count FROM analytics.mv_completed_matches
UNION ALL
SELECT 'Goal Scorers', COUNT(*) FROM analytics.mv_goal_scorers
UNION ALL
SELECT 'Player Time', COUNT(*) FROM analytics.mv_player_playing_time
UNION ALL
SELECT 'Competitions', COUNT(*) FROM analytics.mv_competitions;
```

## Verification

After any data deletion, verify views are in sync:

```sql
-- Check source vs materialized view counts
SELECT 
  'match_events' as table_name,
  COUNT(*) as source_count,
  (SELECT COUNT(*) FROM analytics.mv_goal_scorers) as mv_count
FROM match_events;
```

## Why This Matters

**Without refreshing views:**
- ❌ Reports show players with goals that don't exist
- ❌ Statistics are completely wrong
- ❌ Dashboard shows incorrect data
- ❌ Users see phantom matches

**After refreshing views:**
- ✅ Reports accurately reflect current data
- ✅ All statistics are correct
- ✅ Dashboard shows real data
- ✅ System is consistent

## Automatic Refresh

The database is configured to auto-refresh materialized views when:
- New match events are inserted
- Match periods are updated
- Player time logs are modified

However, **DELETE operations don't trigger auto-refresh**, so you must manually refresh after deletions.

## Future Enhancement

Consider adding a "Reset Match Data" button in the admin panel that:
1. Asks for confirmation
2. Deletes the data
3. Automatically refreshes views
4. Shows success message

This would prevent manual database clearing issues.
