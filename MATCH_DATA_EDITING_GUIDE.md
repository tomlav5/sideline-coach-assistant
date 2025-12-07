# Match Data Editing - User Guide

## Overview

You can now **edit and correct match data** after matches are completed or during live tracking. This allows you to fix mistakes, update incorrect information, and backdate historical matches.

## Accessing the Editor

### From Match Report Page

1. Navigate to any match report
2. Click **"Edit Match Data"** button (top right, next to "Reopen Match")
3. The comprehensive editing dialog opens

## Features

### 1. Edit Match Events 🎯

**What you can edit:**
- Goal scorer
- Assist provider
- Event timing (minute in period)
- Penalty status
- Delete incorrect events

**How to edit an event:**
1. Go to **Events** tab
2. Click the **Edit** icon on any event
3. Update the fields you need to change
4. Click **Save**

**How to delete an event:**
1. Go to **Events** tab
2. Click the **Trash** icon on any event
3. Confirm deletion

**Use cases:**
- ✅ Wrong player recorded for a goal
- ✅ Incorrect assist attribution
- ✅ Goal timing was wrong
- ✅ Accidentally recorded opponent's goal as yours
- ✅ Need to mark/unmark as penalty

---

### 2. Edit Player Times ⏱️

**What you can edit:**
- Time On (when player entered pitch)
- Time Off (when player left pitch)
- Starter status
- Delete incorrect time logs

**How to edit player time:**
1. Go to **Player Times** tab
2. Click the **Edit** icon on any player time log
3. Update times or starter status
4. Click **Save**
5. **Total period minutes automatically recalculates!** ✨

**How to delete a time log:**
1. Go to **Player Times** tab
2. Click the **Trash** icon
3. Confirm deletion

**Use cases:**
- ✅ Substitution time was recorded incorrectly
- ✅ Player marked as starter but came on as sub
- ✅ Player time needs adjustment for late arrival
- ✅ Remove player who didn't actually play

**Important:** 
- The `total_period_minutes` is **automatically calculated** by the database trigger
- You only need to set `time_on` and `time_off` - the system does the math!

---

### 3. Edit Match Periods 📅

**What you can edit:**
- Period duration (in minutes)
- Delete empty periods

**How to edit a period:**
1. Go to **Periods** tab
2. Click the **Edit** icon
3. Update duration
4. Click **Save**

**How to delete a period:**
1. Go to **Periods** tab
2. Click the **Trash** icon (only available if period has no events or times)
3. Confirm deletion

**Use cases:**
- ✅ Period was shorter/longer than expected
- ✅ Remove test period created by mistake
- ✅ Correct duration after match rule changes

**Note:** You can only delete periods that have no associated events or player times.

---

### 4. Data Validation ✓

**What it checks:**
- Player times don't exceed period duration
- Time_off is after time_on
- Data consistency across tables

**How to check:**
1. Go to **Validation** tab
2. See list of warnings (if any)
3. Fix issues by editing data in other tabs

**Use cases:**
- ✅ Verify data quality before generating reports
- ✅ Find inconsistencies after bulk edits
- ✅ Ensure accurate statistics

---

## Complete Workflows

### Scenario 1: Fix Wrong Goal Scorer

**Problem:** Goal was recorded for Player A but it was actually Player B

**Solution:**
1. Open Match Report
2. Click "Edit Match Data"
3. Go to **Events** tab
4. Find the goal event
5. Click **Edit** icon
6. Change player from dropdown
7. Click **Save**
8. ✅ Reports automatically update!

---

### Scenario 2: Correct Substitution Time

**Problem:** Substitution recorded at 15' but actually happened at 20'

**Solution:**
1. Open Match Report
2. Click "Edit Match Data"  
3. Go to **Player Times** tab
4. Find player's time log
5. Click **Edit** icon
6. Change **Time Off** to 20
7. Click **Save**
8. ✅ Total minutes automatically recalculates!

---

### Scenario 3: Remove Test Data

**Problem:** Created a test period during setup

**Solution:**
1. Open Match Report
2. Click "Edit Match Data"
3. Go to **Events** tab → Delete all events in that period
4. Go to **Player Times** tab → Delete all time logs in that period
5. Go to **Periods** tab → Delete the empty period
6. ✅ Clean match data!

---

### Scenario 4: Backdate Historical Match

**Problem:** Need to enter a match that wasn't tracked live

**Solution:**
1. Create fixture for the past date
2. Go to Match Tracker for that fixture
3. Click **"Log Retrospective Data"**
4. Enter all match data (periods, events, times)
5. Save
6. If you need to correct anything → Use **"Edit Match Data"**!

---

## Important Notes

### Auto-Refresh
- All edits **immediately refresh materialized views**
- Reports update in real-time
- No need to manually refresh

### Undo
- ⚠️ **There is no undo!**
- Deleted data is permanently removed
- Edit carefully and confirm before deleting

### Validation
- Always check the **Validation** tab after major edits
- Fix any warnings to ensure data quality

### Live Matches
- You can edit data even during live matches
- Changes are saved immediately
- Be careful not to disrupt live tracking

---

## Best Practices

### ✅ Do:
- Check validation tab after bulk edits
- Edit one item at a time to avoid confusion
- Use retrospective entry for backdating
- Double-check player names before saving

### ❌ Don't:
- Delete periods with events/times (won't work anyway)
- Edit during live tracking unless necessary
- Rush through edits - take your time
- Forget to save after editing

---

## Keyboard Shortcuts

- **Tab** - Navigate between fields
- **Enter** - Save current edit
- **Escape** - Cancel current edit

---

## Troubleshooting

### "Cannot delete period"
**Cause:** Period has events or player times associated with it  
**Fix:** Delete all events and times in that period first

### "Time exceeds period duration"
**Cause:** time_on or time_off is greater than period's planned duration  
**Fix:** Check period duration and adjust times accordingly

### Changes not appearing
**Cause:** Browser cache or query cache  
**Fix:** Close and reopen the edit dialog, or refresh the page

### Player not in dropdown
**Cause:** Player not assigned to the team  
**Fix:** Go to Players page → Add player to team first

---

## Technical Details

### What Happens Behind the Scenes

**When you edit an event:**
- Updates `match_events` table
- Refreshes `analytics.mv_goal_scorers` view
- Invalidates React Query cache
- UI updates automatically

**When you edit player time:**
- Updates `player_time_logs` table
- Database trigger **automatically recalculates** `total_period_minutes`
- Refreshes `analytics.mv_player_playing_time` view
- UI updates automatically

**When you edit a period:**
- Updates `match_periods` table
- May affect player time calculations
- Refreshes all views
- UI updates automatically

---

## Future Enhancements

Planned features:
- Bulk edit mode
- Undo/redo functionality  
- Edit history log
- Import/export match data
- Validation warnings in edit mode

---

## Support

**Questions or Issues?**
- Check the Validation tab for hints
- Review this guide for common scenarios
- Contact support with specific error messages

**Found a bug?**
- Note what you were editing
- Check browser console for errors
- Report with steps to reproduce
