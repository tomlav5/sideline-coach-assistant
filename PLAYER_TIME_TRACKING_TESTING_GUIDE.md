# Player Time Tracking - Testing Guide

## Overview
This guide provides step-by-step testing scenarios to verify the player time tracking fixes are working correctly.

---

## Pre-Test Setup

### 1. Start the Application
```bash
npm run dev
```

### 2. Access Supabase Studio
Navigate to: `http://localhost:54323` (if using local Supabase)
Or: Your cloud Supabase dashboard

### 3. Prepare Test Data
- Create a test team with at least 11 players
- Assign jersey numbers (1-11) for easy identification
- Schedule a test fixture (friendly match)
- Select all 11 players for the squad
- Select starting 11 formation

---

## Test Scenarios

### ✅ Test 1: Basic Full Period Play (Baseline)
**Objective:** Verify starters who play full period get correct time.

**Steps:**
1. Start the match
2. Start Period 1 (30 minutes planned)
3. Wait or fast-forward 5 seconds
4. End Period 1

**Expected Results:**
- ✅ All 11 starters show 30 minutes in `player_time_logs`
- ✅ Real-time timers showed increasing minutes during play
- ✅ All logs have `time_on_minute: 0` and `time_off_minute: 30`
- ✅ All logs have `is_active: false` after period ends

**Database Query:**
```sql
SELECT 
  pl.first_name, pl.last_name,
  ptl.time_on_minute, ptl.time_off_minute,
  ptl.is_active, ptl.is_starter
FROM player_time_logs ptl
JOIN players pl ON pl.id = ptl.player_id
WHERE ptl.fixture_id = '[YOUR_FIXTURE_ID]'
ORDER BY pl.jersey_number;
```

---

### ✅ Test 2: Single Substitution (Mid-Period)
**Objective:** Verify player subbed off and replacement get correct times.

**Steps:**
1. Start the match
2. Start Period 1 (30 minutes planned)
3. Wait for timer to reach ~10 minutes (can manually advance)
4. Make a substitution:
   - Player #7 OFF
   - Player #12 ON (from bench)
5. Continue to period end (30 minutes)

**Expected Results:**
- ✅ Player #7: `time_on: 0, time_off: 10` → **10 minutes**
- ✅ Player #12: `time_on: 10, time_off: 30` → **20 minutes**
- ✅ Other 10 starters: `time_on: 0, time_off: 30` → **30 minutes each**
- ✅ Real-time timer for Player #12 started at 0 and counted up during play
- ✅ Real-time timer for Player #7 stopped when subbed off

**Database Query:**
```sql
SELECT 
  pl.first_name, pl.last_name, pl.jersey_number,
  ptl.time_on_minute, ptl.time_off_minute,
  (ptl.time_off_minute - ptl.time_on_minute) as minutes_played,
  ptl.is_active
FROM player_time_logs ptl
JOIN players pl ON pl.id = ptl.player_id
WHERE ptl.fixture_id = '[YOUR_FIXTURE_ID]'
ORDER BY pl.jersey_number;
```

---

### 🔴 Test 3: Multiple Substitutions - Same Player (CRITICAL)
**Objective:** Verify the MAJOR BUG FIX - player subbed off then back on in same period.

**Steps:**
1. Start the match
2. Start Period 1 (30 minutes planned)
3. At minute 10:
   - Player #7 OFF
   - Player #12 ON
4. At minute 20:
   - Player #12 OFF (going back to bench)
   - Player #7 ON (returning to field)
5. End period at minute 30

**Expected Results (FIXED):**
- ✅ Player #7 has **TWO** `player_time_logs` entries:
  - Entry 1: `time_on: 0, time_off: 10` → **10 minutes**
  - Entry 2: `time_on: 20, time_off: 30` → **10 minutes**
  - **Total: 20 minutes** ✅
  
- ✅ Player #12 has **ONE** `player_time_logs` entry:
  - Entry 1: `time_on: 10, time_off: 20` → **10 minutes** ✅

**Expected Results (OLD BUGGY BEHAVIOR - Should NOT happen):**
- ❌ Player #7 has only one entry (second overwrote first)
- ❌ Player #7 total: 10 minutes (lost first interval)

**Database Query:**
```sql
-- Check for multiple intervals per player
SELECT 
  pl.first_name, pl.last_name, pl.jersey_number,
  COUNT(*) as log_count,
  STRING_AGG(
    'ON:' || COALESCE(ptl.time_on_minute::text, 'null') || 
    ' OFF:' || COALESCE(ptl.time_off_minute::text, 'null'), 
    ' | '
  ) as intervals,
  SUM(ptl.time_off_minute - ptl.time_on_minute) as total_minutes
FROM player_time_logs ptl
JOIN players pl ON pl.id = ptl.player_id
WHERE ptl.fixture_id = '[YOUR_FIXTURE_ID]'
GROUP BY pl.id, pl.first_name, pl.last_name, pl.jersey_number
ORDER BY pl.jersey_number;
```

---

### ✅ Test 4: Multi-Period Match
**Objective:** Verify time tracking across multiple periods.

**Steps:**
1. Start the match
2. Start Period 1 (30 minutes)
3. End Period 1 at 30 minutes
4. Start Period 2 (30 minutes)
5. Make substitution at minute 10 of Period 2:
   - Player #5 OFF
   - Player #13 ON
6. End Period 2 at 30 minutes

**Expected Results:**

**Period 1:**
- ✅ All 11 starters: 30 minutes each

**Period 2:**
- ✅ Player #5: `time_on: 0, time_off: 10` → **10 minutes in Period 2**
- ✅ Player #13: `time_on: 10, time_off: 30` → **20 minutes in Period 2**
- ✅ Other 9 continuing players: 30 minutes each in Period 2

**Total (both periods):**
- ✅ Player #5: **40 minutes** (30 + 10)
- ✅ Player #13: **20 minutes** (0 + 20)
- ✅ Others: **60 minutes** (30 + 30)

**Database Query:**
```sql
SELECT 
  pl.first_name, pl.last_name,
  mp.period_number,
  ptl.time_on_minute, ptl.time_off_minute,
  (ptl.time_off_minute - ptl.time_on_minute) as minutes_in_period
FROM player_time_logs ptl
JOIN players pl ON pl.id = ptl.player_id
JOIN match_periods mp ON mp.id = ptl.period_id
WHERE ptl.fixture_id = '[YOUR_FIXTURE_ID]'
ORDER BY pl.jersey_number, mp.period_number;
```

---

### ✅ Test 5: Real-Time Timer Display
**Objective:** Verify UI shows live running timers.

**Steps:**
1. Start the match
2. Start Period 1
3. Watch the "Players On Field" section

**Expected Visual Behavior:**
- ✅ Green-highlighted cards for each player on field
- ✅ Timer badge shows "Xm" (minutes) next to each player
- ✅ Timers increment every ~60 seconds
- ✅ Timer icon (⏱️) visible on each card
- ✅ When player subbed off, card disappears from active list
- ✅ When player subbed on, new card appears with timer starting at 0m

**Example Display:**
```
┌─────────────────────────────────────────┐
│ Players On Field (11)                   │
├─────────────────────────────────────────┤
│ [10] John Smith         ⏱️ 15m          │
│ [7]  Mike Jones         ⏱️ 15m          │
│ [9]  Alex Brown         ⏱️ 15m          │
│ ...                                     │
└─────────────────────────────────────────┘
```

---

### ✅ Test 6: Reports Page Accuracy
**Objective:** Verify reports show correct total minutes.

**Steps:**
1. Complete a full test match with substitutions
2. Navigate to Reports page
3. Check "Player Playing Time" section

**Expected Results:**
- ✅ Player totals match sum of all `player_time_logs` intervals
- ✅ Matches played count is accurate
- ✅ Average minutes calculation is correct
- ✅ Breakdown by game category (friendly/league/cup) works

**Manual Calculation Example:**
```
Player #7 (from Test 3):
- Period 1: Interval 1: 10 min, Interval 2: 10 min
- Total: 20 minutes
- Matches: 1
- Average: 20 minutes per match
```

---

## Database Verification Queries

### Check All Player Time Logs
```sql
SELECT 
  f.home_team_name,
  mp.period_number,
  pl.jersey_number,
  pl.first_name || ' ' || pl.last_name as player_name,
  ptl.time_on_minute,
  ptl.time_off_minute,
  (ptl.time_off_minute - ptl.time_on_minute) as minutes_played,
  ptl.is_starter,
  ptl.is_active
FROM player_time_logs ptl
JOIN players pl ON pl.id = ptl.player_id
JOIN match_periods mp ON mp.id = ptl.period_id
JOIN fixtures f ON f.id = ptl.fixture_id
WHERE ptl.fixture_id = '[YOUR_FIXTURE_ID]'
ORDER BY mp.period_number, pl.jersey_number, ptl.time_on_minute;
```

### Check for Multiple Intervals (Bug Test)
```sql
SELECT 
  pl.jersey_number,
  pl.first_name || ' ' || pl.last_name as player_name,
  mp.period_number,
  COUNT(*) as interval_count
FROM player_time_logs ptl
JOIN players pl ON pl.id = ptl.player_id
JOIN match_periods mp ON mp.id = ptl.period_id
WHERE ptl.fixture_id = '[YOUR_FIXTURE_ID]'
GROUP BY pl.id, pl.jersey_number, pl.first_name, pl.last_name, mp.period_number
HAVING COUNT(*) > 1
ORDER BY mp.period_number, pl.jersey_number;
```
**Expected:** Rows appear for players subbed multiple times in same period ✅

### Check Total Playing Time Per Player
```sql
WITH player_totals AS (
  SELECT 
    pl.id,
    pl.jersey_number,
    pl.first_name || ' ' || pl.last_name as player_name,
    SUM(ptl.time_off_minute - ptl.time_on_minute) as total_minutes,
    COUNT(DISTINCT mp.id) as periods_played
  FROM player_time_logs ptl
  JOIN players pl ON pl.id = ptl.player_id
  JOIN match_periods mp ON mp.id = ptl.period_id
  WHERE ptl.fixture_id = '[YOUR_FIXTURE_ID]'
  GROUP BY pl.id, pl.jersey_number, pl.first_name, pl.last_name
)
SELECT * 
FROM player_totals
ORDER BY jersey_number;
```

---

## Common Issues & Troubleshooting

### Issue: Timer not updating in UI
**Fix:**
- Check browser console for errors
- Verify match status is 'in_progress'
- Verify period `is_active: true`
- Check `usePlayerTimers` hook is receiving correct data

### Issue: Player time shows 0 after period end
**Fix:**
- Check `player_time_logs` has `time_off_minute` set
- Verify period `actual_end_time` is set
- Check for errors in period finalization logic

### Issue: Multiple intervals not being created
**Fix:**
- Verify substitution logic checks for `is_active: true` before insert
- Check no database constraint blocking multiple rows per period
- Review substitution dialog completion logic

### Issue: Reports show wrong totals
**Fix:**
- Clear browser cache
- Refresh reports page
- Check RPC functions `get_player_playing_time_v3` and `v2`
- Verify `player_time_logs` data is correct in database

---

## Success Criteria

All tests PASS when:
- ✅ Players get correct minutes for simple scenarios
- ✅ Substitutions record accurate on/off times
- ✅ **CRITICAL:** Players can be subbed multiple times in same period
- ✅ Multiple intervals per player per period are preserved
- ✅ Multi-period matches calculate correctly
- ✅ Real-time timers display and update live
- ✅ Reports page shows accurate totals
- ✅ No database errors in console
- ✅ User can see clear visual feedback of who's playing and for how long

---

## What Changed (Summary)

### Fix #1: Multiple Intervals Per Period
- **Before:** `upsert` with `onConflict` overwrote previous intervals
- **After:** Check for `is_active: true` before inserting new intervals
- **Impact:** Players can now be subbed off and back on correctly

### Fix #2: Real-Time Timers
- **Before:** No visual feedback of playing time during match
- **After:** Live timer display showing minutes played for each active player
- **Impact:** Coaches can see who's playing and for how long in real-time

### Fix #3: Actual Duration
- **Before:** Used `planned_duration_minutes` even if period ran long/short
- **After:** Calculate actual duration from timestamps and paused seconds
- **Impact:** Accurate times even with injury time or early stoppage

---

## Next Steps After Testing

1. **If all tests pass:**
   - Merge `period-state-and-timers` branch to main
   - Deploy to production
   - Monitor real match usage

2. **If tests fail:**
   - Document specific failure scenarios
   - Review error logs in browser console
   - Check database logs in Supabase
   - Report findings for further debugging

3. **Future Enhancements:**
   - Add "total playing time this season" metric
   - Add visual indicators for player fatigue (e.g., color-code by minutes)
   - Export player time reports to CSV/PDF
   - Add substitution patterns analysis

---

**Good luck with testing!** 🎯⚽
