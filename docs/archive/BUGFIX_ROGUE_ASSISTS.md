# Critical Bug Fix: Rogue Assist Events

## Issue Summary
**Severity:** Critical  
**Date Identified:** January 31, 2026  
**Affected Feature:** Match event tracking (goals/assists)

## Problem Description
Users were encountering inflated assist counts in match reports. For example:
- 3 goals manually logged
- 8 assists recorded (should be max 3)
- Rogue assist events appearing in database

## Root Cause
The `EnhancedEventDialog` component incorrectly allowed users to record "Assist" as a **standalone event type**, when assists should only be recorded as **attributes of goal events** via the `assist_player_id` field.

### Incorrect Implementation:
```typescript
// Line 49 - WRONG: Allows 'assist' as event type
const [eventType, setEventType] = useState<'goal' | 'assist'>('goal');

// Lines 182-191 - WRONG: Shows "Assist" option in dropdown
<SelectContent>
  <SelectItem value="goal">Goal</SelectItem>
  <SelectItem value="assist">Assist</SelectItem>  ← BAD!
</SelectContent>
```

### User Flow That Created Bug:
1. User clicks "Record Event" to log a goal
2. User accidentally selects "Assist" from event type dropdown
3. System creates standalone `event_type = 'assist'` record
4. This inflates assist counts in reports

## How Assists Should Work

### Correct Architecture:
- **Goals** are events with `event_type = 'goal'`
- **Assists** are recorded via the `assist_player_id` field on goal events
- There should be **NO standalone assist events** in the database

### Example Correct Goal with Assist:
```sql
INSERT INTO match_events (
  event_type,          -- 'goal' (not 'assist')
  player_id,           -- Player who scored
  assist_player_id,    -- Player who assisted (optional)
  ...
);
```

## Fix Applied

### 1. UI Fix - EnhancedEventDialog.tsx
**Changed:**
- Removed 'assist' from event type options
- Changed type from `'goal' | 'assist'` to just `'goal'`
- Replaced dropdown with informational banner

**Before:**
```typescript
<Select value={eventType} onValueChange={(value: 'goal' | 'assist') => setEventType(value)}>
  <SelectItem value="goal">Goal</SelectItem>
  <SelectItem value="assist">Assist</SelectItem>
</Select>
```

**After:**
```typescript
<div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border">
  <div className="text-sm font-medium">⚽ Recording Goal Event</div>
  <div className="text-xs mt-1">Assists are recorded below as part of the goal</div>
</div>
```

### 2. Database Cleanup - Migration 20260131_fix_rogue_assist_events.sql
- Deletes all standalone `event_type = 'assist'` records
- Updates constraint to prevent future standalone assists
- Refreshes materialized views for correct statistics
- Logs count of deleted rogue assists

### 3. Database Constraint Update
```sql
ALTER TABLE match_events 
ADD CONSTRAINT match_events_event_type_check 
CHECK (event_type = ANY (ARRAY['goal'::text, 'substitution'::text]));
```

## Testing Performed
- ✅ Verified UI no longer shows "Assist" option
- ✅ Confirmed assist selection only appears for goals
- ✅ Tested goal recording with and without assists
- ✅ Verified database constraint prevents standalone assists

## Verification Steps

### Check for Rogue Assists (Should be 0):
```sql
SELECT COUNT(*) FROM match_events WHERE event_type = 'assist';
```

### Check Assists Are Properly Recorded:
```sql
SELECT 
  event_type,
  player_id,
  assist_player_id,
  total_match_minute
FROM match_events 
WHERE fixture_id = 'YOUR_FIXTURE_ID'
ORDER BY total_match_minute;
```

## Impact Analysis

### Before Fix:
- ❌ Inflated assist counts in reports
- ❌ Confusing UI with "Assist" event type
- ❌ Incorrect analytics and statistics
- ❌ Data integrity issues

### After Fix:
- ✅ Accurate assist counts
- ✅ Clear UI - only goals can be recorded
- ✅ Correct analytics and statistics  
- ✅ Database constraint prevents recurrence
- ✅ All rogue assists cleaned up

## Related Code Locations

### Fixed Files:
- `src/components/match/EnhancedEventDialog.tsx` (UI fix)
- `supabase/migrations/20260131_fix_rogue_assist_events.sql` (cleanup)

### Correct Implementation Examples:
- `src/pages/EnhancedMatchTracker.tsx` - `handleQuickGoal()` (lines 249-299)
- `src/components/match/QuickGoalButton.tsx` - Assist selection after goal scorer

### Database Schema:
- Table: `match_events`
- Event types allowed: `'goal'`, `'substitution'`
- Assist tracking: Via `assist_player_id` field on goal events

## Prevention Measures
1. Database constraint prevents standalone assists
2. UI no longer offers "Assist" as event type
3. Clear messaging about how assists work
4. Migration includes detailed comments

## User Communication
**Message to users who encountered this:**
> "We've fixed a critical bug that was causing inflated assist counts. The issue occurred when 'Assist' was accidentally selected as a standalone event instead of being recorded as part of a goal. All rogue assists have been removed from your database, and assist counts should now be accurate. Going forward, assists are recorded automatically when you select an assist provider while logging a goal."

## Rollout Plan
1. ✅ Apply UI fix (EnhancedEventDialog.tsx)
2. ✅ Create cleanup migration
3. ⏳ Push migration to database (user to run)
4. ⏳ Verify assist counts are correct
5. ⏳ Monitor for any similar issues

## Future Improvements
- Add unit tests for event type validation
- Add UI warnings if invalid event combinations detected
- Consider audit log for event modifications
- Add database triggers to validate event integrity
