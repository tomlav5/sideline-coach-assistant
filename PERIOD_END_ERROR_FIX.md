# Period End Error Fix - "Failed to save match state"

## Issue
Red toast error "Failed to save match state" appears when closing a game period, despite data being saved correctly to the database.

## Root Cause

### Database Constraint Violation
The `fixtures` table has a `match_status` enum column with only these valid values:
- `scheduled`
- `in_progress`
- `completed`
- `cancelled`

### Internal State Mismatch
The `useEnhancedMatchTimer` hook uses internal state values that don't match the database enum:
- `not_started` ❌ (not in database enum)
- `in_progress` ✅
- `paused` ❌ (not in database enum)
- `completed` ✅

### The Bug Flow

1. **User closes a period** → `endCurrentPeriod()` is called
2. **State update** (line 358-364):
   ```typescript
   setTimerState(prev => ({
     ...prev,
     isRunning: false,
     currentPeriod: undefined,
     currentTime: 0,
     matchStatus: isFinalizingRef.current ? prev.matchStatus : 'paused', // ⚠️ Sets to 'paused'
   }));
   ```
3. **useEffect triggers** (line 162-166) because `matchStatus` changed
4. **saveMatchState() attempts to save** (line 168-194):
   ```typescript
   await supabase
     .from('fixtures')
     .update({
       status: timerState.matchStatus as any,        // 'paused' ❌
       match_status: timerState.matchStatus,          // 'paused' ❌
     })
     .eq('id', fixtureId);
   ```
5. **Database rejects** the update because 'paused' is not a valid enum value
6. **Error toast displays** "Failed to save match state"

## Why Data Appears Correct

The period itself is saved successfully by `endCurrentPeriod()` BEFORE the state update. The error only occurs when trying to update the fixture's `match_status` field with an invalid enum value.

## Solution

Map internal state values to valid database enum values in `saveMatchState()`:

```typescript
const mapMatchStatusToDbEnum = (status: string): string => {
  switch (status) {
    case 'not_started':
      return 'scheduled';
    case 'paused':
      return 'in_progress'; // Period paused but match is still in progress
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    default:
      return 'scheduled';
  }
};
```

Then use this mapping in the update:

```typescript
const dbStatus = mapMatchStatusToDbEnum(timerState.matchStatus);

await supabase
  .from('fixtures')
  .update({
    match_state: {
      status: timerState.matchStatus, // Keep internal state in JSON
      total_time_seconds: timerState.totalMatchTime,
    },
    current_period_id: timerState.currentPeriod?.id || null,
    status: dbStatus as any,        // Use mapped value
    match_status: dbStatus,         // Use mapped value
  })
  .eq('id', fixtureId);
```

## Additional Considerations

### Race Condition Prevention
The current code has a timing issue where:
1. State updates set `currentPeriod: undefined`
2. useEffect fires immediately
3. `saveMatchState()` runs with transitional state
4. `loadMatchState()` resyncs afterward

This can be improved by:
- Adding debouncing to the save effect
- Making saveMatchState check if state is in a valid save condition
- Consider moving the save call to specific action handlers rather than relying solely on useEffect

### Better State Management
Consider separating:
- **UI state** (not_started, paused) - for display purposes
- **Database state** (scheduled, in_progress, completed) - for persistence

## Files to Modify
- `/src/hooks/useEnhancedMatchTimer.tsx` (primary fix)
- Consider adding TypeScript types to enforce valid status values

## Testing Checklist
- [ ] Start a new period
- [ ] Pause a period - verify no error
- [ ] Resume a period - verify no error
- [ ] End a period - verify no error toast
- [ ] End match - verify proper completion
- [ ] Check database fixtures table shows correct status
- [ ] Verify Reports page shows completed match
- [ ] Test with multiple periods (full match flow)
