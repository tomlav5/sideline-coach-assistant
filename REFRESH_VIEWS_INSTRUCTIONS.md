# Fix Stale Materialized Views - Manual Steps Required

## Problem Detected
The materialized views contain old data (17 players, 38 matches) but the source tables are empty (0 rows). This happened because the database was manually cleared without refreshing the views.

## ⚠️ The refresh_report_views() function didn't clear the views
This might be due to:
1. The function uses REFRESH MATERIALIZED VIEW which updates from source data
2. If the source analytics schema tables still have data, the function won't clear them
3. Or the views are pulling from a different source than expected

## Solution: Manual Refresh via Supabase Dashboard

**You need to run this SQL directly in the Supabase SQL Editor:**

### Step 1: Go to SQL Editor
https://supabase.com/dashboard/project/crmlmnhillnnrnrxqera/editor

### Step 2: Run this SQL

```sql
-- Drop and recreate the materialized views to clear stale data
-- This is more thorough than REFRESH when the underlying data structure has changed

-- Option A: Refresh (if the analytics schema is correctly defined)
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_completed_matches;
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_goal_scorers;
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_player_playing_time;
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_competitions;

-- Option B: If Option A doesn't work, check what the views are querying
SELECT * FROM analytics.mv_goal_scorers LIMIT 5;

-- Then find the view definition
SELECT definition 
FROM pg_matviews 
WHERE schemaname = 'analytics' 
AND matviewname = 'mv_goal_scorers';
```

### Step 3: Verify

After running the refresh, verify it worked:

```sql
-- Should return 0 rows
SELECT COUNT(*) FROM analytics.mv_goal_scorers;
SELECT COUNT(*) FROM analytics.mv_completed_matches;
SELECT COUNT(*) FROM analytics.mv_player_playing_time;
SELECT COUNT(*) FROM analytics.mv_competitions;
```

## Alternative: Check if Analytics Schema Has Data

The materialized views might be reading from cached tables in the analytics schema:

```sql
-- Check if analytics schema has separate tables
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'analytics';

-- If there are tables, clear them:
TRUNCATE analytics.goal_scorers_cache CASCADE;
-- (replace with actual table names if they exist)
```

## Why This Happened

Materialized views are **snapshots of data at a point in time**. They don't automatically update when source data is deleted. 

When you manually cleared the database:
1. ✅ Source tables (match_events, fixtures, etc.) were cleared
2. ❌ Materialized views retained their cached data
3. ❌ Reports showed phantom data

## Prevention for Future

Always use the proper database reset procedure documented in:
`supabase/PROPER_DATABASE_RESET.md`

Or add a "Reset Database" admin function that:
1. Deletes source data
2. Refreshes all views
3. Confirms synchronization

## Current Status

✅ **Fixed:**
- RLS policies verified working
- Proper reset procedure documented
- Verification scripts created

⚠️ **Needs Manual Action:**
- Run the SQL above in Supabase dashboard to clear materialized views

## After Manual Refresh

Run this to verify everything is clean:

```bash
node verify-score-calculations.mjs
```

You should see:
- ✅ 0 players in materialized view
- ✅ 0 goal events in match_events
- ✅ All counts match (0 = 0)
