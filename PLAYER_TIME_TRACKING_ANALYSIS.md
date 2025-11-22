# Player Time Tracking Analysis & Issues

## Investigation Summary
Comprehensive analysis of player time tracking in the SideLine Coach Assistant application.

## Current System Architecture

### Database Schema: `player_time_logs`
```typescript
{
  id: string
  fixture_id: string
  player_id: string
  period_id: string
  time_on_minute: number | null
  time_off_minute: number | null
  is_starter: boolean
  is_active: boolean
  total_period_minutes: number | null  // ⚠️ NOT BEING USED
  created_at: string
  updated_at: string
}
```

### Time Calculation Functions

#### V3 (Current - Uses Period Caps) 
**File:** `supabase/migrations/20251012_get_player_playing_time_v3.sql`

```sql
-- Logic:
- start_min = is_starter ? 0 : time_on_minute
- cap_minutes = match_periods.planned_duration_minutes
- minutes_in_period = least(coalesce(time_off_minute, cap_minutes), cap_minutes) - start_min
```

**Key Issue:** Uses `planned_duration_minutes` as the cap, which may not match actual period duration if there was injury time or early stoppage.

#### V2 (Fallback - Uses total_period_minutes)
**File:** `supabase/migrations/20251012_get_player_playing_time_v2.sql`

```sql
-- Logic:
- Uses ptl.total_period_minutes as the cap
- Fallback calculation if time_off_minute is null
```

**Key Issue:** `total_period_minutes` field is written but calculation logic is unclear.

---

## Critical Issues Identified

### 1. ❌ No Real-Time Player Timer Display in UI
**Location:** `EnhancedMatchTracker.tsx`

**Problem:** 
- Players on the pitch don't show a live running counter
- No visual feedback showing "Player has been on for X minutes"
- PlayerTimesList component exists but is NOT being used

**Expected Behavior:**
```
Active Players Section:
┌─────────────────────────────┐
│ #10 John Smith             │
│ ⏱️  25:34 (running)         │
└─────────────────────────────┘
```

**Current Behavior:**
```
Active Players Section:
┌─────────────────────────────┐
│ #10 John Smith             │
│ (no timer shown)           │
└─────────────────────────────┘
```

### 2. ❌ Period Transition Logic Issues
**Location:** `EnhancedMatchTracker.tsx` lines 374-447

**Problems:**

#### A. Previous Period Finalization
```typescript
// Sets ALL open logs to planned_duration_minutes
await supabase
  .from('player_time_logs')
  .update({
    time_off_minute: prevPeriod.planned_duration_minutes, // ⚠️ WRONG
    is_active: false,
  })
  .eq('period_id', prevPeriod.id)
  .is('time_off_minute', null);
```

**Issue:** If a player was subbed on at minute 15 of a 30-minute period, they'll incorrectly get credited with 30 minutes (time_off_minute = 30), when they should only get 15 minutes (30 - 15).

**Correct Logic Should Be:**
```typescript
// Only close logs that are ACTUALLY open (player still on field)
// Should use actual_period_duration, not planned_duration
const actualDuration = calculateActualPeriodDuration(prevPeriod);
await supabase
  .from('player_time_logs')
  .update({
    time_off_minute: actualDuration,
    is_active: false,
  })
  .eq('period_id', prevPeriod.id)
  .eq('is_active', true)  // ✅ Only update active logs
  .is('time_off_minute', null);
```

#### B. New Period Initialization
```typescript
// Creates logs with time_on = 0 for all on-field players
await supabase
  .from('player_time_logs')
  .upsert({
    fixture_id: fixtureId,
    player_id: row.player_id,
    period_id: nextPeriod.id,
    time_on_minute: 0,
    is_starter: true,  // ⚠️ Not accurate after first period
    is_active: true,
    total_period_minutes: 0,  // ⚠️ Never updated
  }, { onConflict: 'fixture_id,player_id,period_id' });
```

**Issue:** 
- `is_starter: true` is incorrect for players who weren't actually period starters
- `total_period_minutes: 0` is set but never calculated or updated

### 3. ❌ Substitution Time Logging Issues
**Location:** `EnhancedMatchTracker.tsx` lines 900-956

**Problems:**

#### A. Player Going OUT
```typescript
// Sets time_off_minute to currentMinute
await supabase
  .from('player_time_logs')
  .update({
    time_off_minute: currentMinute,  // ✅ Correct
    is_active: false,
  })
  .eq('period_id', currentPeriod.id);
```
This part looks correct ✅

#### B. Player Coming IN
```typescript
await supabase
  .from('player_time_logs')
  .insert({
    fixture_id: fixtureId,
    player_id: playerIn,
    period_id: currentPeriod.id,
    time_on_minute: currentMinute,  // ✅ Correct
    is_starter: false,              // ✅ Correct
    is_active: true,
  });
```
This part also looks correct ✅

### 4. ❌ End Period Finalization Issues
**Location:** `useEnhancedMatchTimer.tsx` lines 358-377

```typescript
// Closes all open logs to planned_duration_minutes
await supabase
  .from('player_time_logs')
  .update({
    time_off_minute: periodRow.planned_duration_minutes,  // ⚠️ WRONG
    is_active: false,
  })
  .eq('period_id', periodRow.id)
  .is('time_off_minute', null);
```

**Issue:** Same as period transition - doesn't account for when player actually came on.

**Example Bug:**
- Period planned: 30 minutes
- Player A: Started at 0, should get 30 ✅
- Player B: Subbed on at 20, should get 10 minutes
- **BUG**: Player B gets time_off_minute = 30, calculation thinks they played 30 - 20 = 10 ✅
- **WAIT**: This actually works correctly if calculation uses `time_off_minute - time_on_minute`

**Let me recalculate:**
```
Player B:
- time_on_minute: 20
- time_off_minute: 30 (set at period end)
- Calculation: 30 - 20 = 10 minutes ✅ CORRECT

Player A (starter):
- time_on_minute: 0 (or null if is_starter = true)
- time_off_minute: 30
- Calculation: 30 - 0 = 30 minutes ✅ CORRECT
```

**Actually, this logic might be okay** IF the calculation uses simple subtraction.

### 5. ⚠️ Calculation Logic in V3
**File:** `20251012_get_player_playing_time_v3.sql` lines 26-39

```sql
case when coalesce(ptl.is_starter, false) then 0 else ptl.time_on_minute end as start_min,
ptl.time_off_minute

-- Then:
case
  when cap_minutes is null then 0
  else greatest(0, least(coalesce(time_off_minute, cap_minutes), cap_minutes) - coalesce(start_min, 0))
end as minutes_in_period
```

**Translation:**
```
start_min = is_starter ? 0 : time_on_minute
minutes = least(time_off_minute ?? cap_minutes, cap_minutes) - start_min
```

**Problem Analysis:**

#### Scenario: Player subbed off before period end
- Player comes on at minute 5
- Player subbed off at minute 25
- Period cap: 30 minutes

```
start_min = 5
time_off_minute = 25
cap_minutes = 30

minutes = least(25, 30) - 5
        = 25 - 5
        = 20 minutes ✅ CORRECT
```

#### Scenario: Player stays on full period
- Player comes on at minute 5  
- Period ends at 30
- time_off_minute = 30 (set at period end)

```
start_min = 5
time_off_minute = 30
cap_minutes = 30

minutes = least(30, 30) - 5
        = 30 - 5
        = 25 minutes ✅ CORRECT
```

#### Scenario: Starter who plays full period
- is_starter = true
- time_off_minute = 30

```
start_min = 0 (because is_starter)
time_off_minute = 30

minutes = 30 - 0 = 30 ✅ CORRECT
```

### 6. 🔍 THE REAL ISSUE - Multiple Intervals Per Period
**This is the core problem:**

The current system assumes **ONE interval per player per period**.

**Constraint:** `onConflict: 'fixture_id,player_id,period_id'`

**But what if:**
1. Player A starts period 1 (time_on: 0)
2. Player A gets subbed OFF at minute 15 (time_off: 15)
3. Player A gets subbed BACK ON at minute 25 (time_on: 25)
4. Period ends at 30

**Current system:** UPSERT with conflict resolution means second sub overwrites the first!

```
First log:  time_on: 0,  time_off: 15  (15 minutes)
Second sub: time_on: 25, time_off: 30  (5 minutes)

UPSERT replaces: time_on: 25, time_off: 30

RESULT: Player only credited with 5 minutes instead of 20! ❌
```

---

## Root Causes Summary

### 🔴 CRITICAL ISSUES

1. **No Real-Time Timer UI** - Players on field don't show running counter
2. **Single Interval Constraint** - Can't handle multiple sub on/off per period
3. **No Visual Feedback** - Users can't see if tracking is working correctly

### 🟡 MODERATE ISSUES

4. **total_period_minutes field unused** - Field exists but never calculated
5. **is_starter field inaccurate** - After first period, all continuing players marked as starters
6. **No actual vs planned period duration** - Uses planned duration even if period ran longer/shorter

### 🟢 WORKING CORRECTLY

- ✅ Substitution ON/OFF time recording
- ✅ Basic calculation logic (when only one interval per period)
- ✅ Period end finalization (for single intervals)
- ✅ RPC calculation functions (for their intended use case)

---

## Recommended Fixes

### Priority 1: Add Real-Time Timer Display
Add live running counter for each player on the pitch during active periods.

### Priority 2: Support Multiple Intervals Per Period
Remove unique constraint, allow multiple time_logs per player per period.

### Priority 3: Fix Period Finalization
Use actual period duration based on match_periods actual_start_time and actual_end_time.

### Priority 4: Add UI Indicators
Show visual feedback when times are being tracked/calculated incorrectly.

### Priority 5: Calculation Improvements
- Capture actual period duration
- Fix is_starter logic for multi-period matches
- Use total_period_minutes or remove it

---

## Testing Scenarios Needed

1. **Simple Match** - Start period, play full period, end period
2. **Single Substitution** - One player off, one on during period
3. **Multiple Substitutions** - Several players swapped during match
4. **Player Re-Entry** - Player subbed off then back on same period ⚠️ CRITICAL TEST
5. **Multi-Period Match** - Two 30-min periods with substitutions
6. **Reports View** - Verify total minutes are accurate in analytics

---

## Next Steps

1. Verify the "multiple intervals per period" hypothesis with database query
2. Design UI for real-time player timers
3. Implement fix for interval tracking
4. Add comprehensive testing
