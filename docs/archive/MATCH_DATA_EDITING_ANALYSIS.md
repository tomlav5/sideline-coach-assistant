# Match Data Editing - Current State & Enhancement Plan

## Current Capabilities ✅

### 1. **Retrospective Match Entry**
**Location:** `src/components/fixtures/RetrospectiveMatchDialog.tsx`
**Hook:** `src/hooks/useRetrospectiveMatch.tsx`

**Features:**
- ✅ Enter complete match data after the fact
- ✅ Define match periods and durations
- ✅ Add goals and assists
- ✅ Record player time logs (who played when)
- ✅ Mark match as completed
- ✅ Automatically refreshes materialized views

**Use Cases:**
- Backdating historical matches
- Recording matches that weren't tracked live
- Bulk data entry for season statistics

**Access:** Available in the EnhancedMatchTracker via button

### 2. **Reopen Completed Match**
**Location:** `src/pages/MatchReport.tsx` (lines 292-317)

**Features:**
- ✅ Reopen a completed match to resume tracking
- ✅ Preserves existing periods and events
- ✅ Can continue adding new periods/events

**Use Cases:**
- Match was ended prematurely
- Need to add extra time
- Resume tracking after technical issues

---

## Missing Capabilities ❌

### 1. **Edit Individual Match Events**
**What's Missing:**
- ❌ Cannot edit an existing goal (change player, minute, penalty status)
- ❌ Cannot delete a wrongly recorded event
- ❌ Cannot change assist attribution
- ❌ Cannot fix event timing

**Impact:**
- User must delete all data and re-enter if mistake is made
- No way to correct referee decisions
- Scoring errors persist in reports

### 2. **Edit Player Time Logs**
**What's Missing:**
- ❌ Cannot adjust substitution times
- ❌ Cannot fix incorrect starter/substitute designation
- ❌ Cannot correct time_on or time_off values
- ❌ No way to remove players who didn't actually play

**Impact:**
- Playing time statistics permanently incorrect
- Can't fix timing mistakes made during live tracking

### 3. **Edit Match Periods**
**What's Missing:**
- ❌ Cannot change period duration after created
- ❌ Cannot delete empty periods
- ❌ Cannot reorder periods

**Impact:**
- Wrong period lengths stuck in database
- Empty test periods clutter match report

### 4. **Bulk Match Data Management**
**What's Missing:**
- ❌ No "Edit Match" page/interface
- ❌ Cannot see all match data in one editable view
- ❌ No validation warnings for data inconsistencies

---

## Proposed Solution

### Phase 1: Edit Match Events ⭐ Priority
Create an "Edit Match Data" interface accessible from MatchReport page.

**Features to Add:**
1. **Edit Event Dialog**
   - Update goal/assist player
   - Change event minute
   - Toggle penalty status
   - Update period assignment
   - Delete event

2. **Batch Event Management**
   - View all events in a table
   - Quick edit via inline forms
   - Bulk delete option

**UI Location:**
- Add "Edit Match Data" button on MatchReport page
- Opens comprehensive edit dialog/page

### Phase 2: Edit Player Times
**Features to Add:**
1. **Player Time Editor**
   - Adjust time_on_minute
   - Adjust time_off_minute
   - Toggle is_starter
   - View calculated total_period_minutes
   - Delete incorrect entries

2. **Time Validation**
   - Warn if times exceed period duration
   - Highlight overlapping times
   - Auto-calculate totals

### Phase 3: Edit Match Metadata
**Features to Add:**
1. **Period Editor**
   - Change duration
   - Delete unused periods
   - Add new periods retrospectively

2. **Match Score Override**
   - Manual score adjustment
   - Useful if events don't match final score

---

## Implementation Plan

### Step 1: Create EditMatchDialog Component ✅ Start Here
**File:** `src/components/match/EditMatchDialog.tsx`

**Tabs:**
1. Events - Edit/delete goals, assists, cards
2. Player Times - Adjust playing time logs  
3. Periods - Edit period durations
4. Validation - Show data consistency warnings

### Step 2: Add to MatchReport Page
Add "Edit Match Data" button next to "Reopen Match"

### Step 3: Create Edit Hooks
- `useEditMatchEvents` - Update/delete events
- `useEditPlayerTimes` - Update player time logs
- `useEditMatchPeriods` - Update periods

### Step 4: Add Validation
- Time consistency checks
- Player availability checks
- Event timing validation

---

## Database Operations Needed

### Update Operations:
```sql
-- Update match event
UPDATE match_events 
SET player_id = ?, minute_in_period = ?, is_penalty = ?
WHERE id = ?;

-- Update player time log
UPDATE player_time_logs
SET time_on_minute = ?, time_off_minute = ?, is_starter = ?
WHERE id = ?;
-- Note: total_period_minutes will auto-update via trigger

-- Update period
UPDATE match_periods
SET planned_duration_minutes = ?
WHERE id = ?;
```

### Delete Operations:
```sql
-- Delete event (cascade should handle related data)
DELETE FROM match_events WHERE id = ?;

-- Delete player time log
DELETE FROM player_time_logs WHERE id = ?;
```

### After Edits:
```sql
-- Refresh materialized views
SELECT refresh_report_views();
```

---

## Benefits

### For Users:
✅ Fix mistakes without restarting match
✅ Accurate historical records
✅ Correct player statistics
✅ Professional data management

### For Data Quality:
✅ Eliminates permanent errors
✅ Maintains data integrity
✅ Enables post-match corrections
✅ Supports referee decision changes

---

## Next Steps

1. ✅ Review this analysis with user
2. 🔨 Implement EditMatchDialog component
3. 🔨 Add edit buttons to MatchReport
4. 🧪 Test with real match data
5. 📚 Document editing workflow for users
