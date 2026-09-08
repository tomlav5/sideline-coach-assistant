# Backlog

Known issues and planned work. Newest findings at the top of each section.

**Status key:** `OPEN` · `IN PROGRESS` · `DONE` · `DEFERRED`

---

## Bugs

### BUG-016 — Intermittent app-wide scroll lock `DONE 8 Sep 2026`
**Found:** 6 Sep 2026 during staging testing of `feat/match-staged-subs`. Pre-existing on
`main`; not introduced by UX-007. Fixed 8 Sep 2026 on `fix/app-scroll-and-footer-overflow`
(PR TBD).

Reported as "intermittent, occasionally the whole app can't scroll until reload". Two
distinct mechanisms, and they compound — fixing either one alone leaves the symptom partly
present:

- **A duplicate hand-rolled body scroll lock in `src/components/ui/dialog.tsx`.** A
  `React.useEffect` at the top of `DialogContent` maintained its own lock via a
  `data-dialog-count` DOM attribute, setting `document.body.style.overflow = 'hidden'` on
  the first open and restoring it on the last close. Radix's `react-remove-scroll` already
  locks body scroll for modal dialogs, so this was a second, competing lock whose state
  lived in a DOM attribute rather than in React. Any `DialogContent` whose cleanup did not
  run (StrictMode double-invoke, an unmount race, a portal torn down out of order) left
  `overflow: hidden` orphaned on `<body>` with no owner — and nothing to ever remove it
  short of a reload. It also captured `originalStyle` from `getComputedStyle`, which
  returns `"visible"` not `""`, so even the happy path wrote back an inline style that was
  never there. Fixed by deleting the effect entirely and relying on Radix's lock. The fix
  removes the duplicate lock rather than patching its counter.
- **The match screen's `min-h-screen` root.** `EnhancedMatchTracker`'s outer div was
  `min-h-screen flex flex-col`, so the root grew with its content and the
  `flex-1 overflow-y-auto` child never actually scrolled — the document body did. Changed
  to `h-[100dvh] … overflow-hidden` with `min-h-0` on the scroll child so the inner
  container is the scroller, as intended.

Previously worked on by Lovable and Windsurf without resolution.

Also added a one-time self-heal in `src/App.tsx` that clears any orphaned
`data-dialog-count` / `data-original-overflow` / `overflow` / `padding-right` left on
`<body>`, so a session already stuck unlocks itself on next load rather than needing a
manual reload.

Confirmed `dialog.tsx` was the only file under `src/components/ui/` touching
`document.body.style`; `sheet.tsx`, `alert-dialog.tsx` and `drawer.tsx` have no equivalent
lock.

Checks: `tsc --noEmit -p tsconfig.app.json` clean; `npm run lint` unchanged (pre-existing
errors only); vitest — see note; `npm run build` clean. Not tested on a device. No database
writes, no changes to match recording, timers or player-time logic.

### BUG-015 — Footer stack overruns the viewport on iPhone `DONE 8 Sep 2026`
**Found:** 6 Sep 2026, same staging testing session as BUG-016. Pre-existing on `main`.
Fixed 8 Sep 2026 on `fix/app-scroll-and-footer-overflow` (PR TBD).

The variable-height footer introduced by UX-007 branch 3 (the `footerExtrasRef` block —
pending-subs panel plus events summary, `fixed left-0 right-0` with `bottom: actionBarH`)
had no height limit and no internal scroll. With several pending substitutions plus the
events summary it grew *upwards* past the top of the viewport, with no way to scroll it —
reported on staging as navigation elements sitting off-screen on an iPhone.

Fixed by capping that div at `max-h-[45dvh]` with `overflow-y-auto overscroll-contain`, and
clamping the derived scroll-area padding (`setFooterPad` in the measuring `useLayoutEffect`)
to `min(ab + ex + 16, round(window.innerHeight * 0.55))` so a tall footer can never eat the
whole viewport.

Checks: `tsc --noEmit -p tsconfig.app.json` clean; `npm run lint` unchanged (pre-existing
errors only); vitest — see note; `npm run build` clean. Not tested on a device.

### BUG-013 — Heartbeat failures are silent, so a coach on poor signal can lose the lock while recording `OPEN`
**Found:** 7 Sep 2026, reviewing multi-coach safety.

Tracker liveness rests on a 30-second heartbeat: `useRealtimeMatchSync.tsx:101` calls
`update_tracking_activity`, which sets `fixtures.last_activity_at = NOW()`. `claim_match_tracking`
lets anyone claim once that timestamp is older than five minutes.

Two ways that fails a coach who is actively tracking:

- **The heartbeat swallows its own errors** (`catch { console.error }`). On poor mobile data
  ten consecutive heartbeats can fail silently, the timestamp goes stale, and another coach can
  take control from someone mid-match. The coach with the worse signal loses the lock — exactly
  backwards, since they are least able to recover.
- **The heartbeat stops when the phone sleeps.** A coach pockets the phone at half time, iOS
  suspends the tab, and five minutes later the lock is free. This is precisely the scenario the
  timestamp-derived match clock was designed to survive (see `CLAUDE.md` critical rules); the
  lock has no equivalent protection, and half time is longer than five minutes at most
  grassroots matches.

Same failure class as BUG-008 — a silent write failure with match-day consequences.

**Fix shape.** Count consecutive heartbeat failures and warn the coach that they may lose
control, rather than failing silently. Consider a second liveness signal that does not depend on
the heartbeat at all: a match with a `match_events` row written two minutes ago is obviously
live, whatever `last_activity_at` says. See DESIGN-005 for the timeout itself.

### BUG-014 — Losing the tracker lock while holding staged substitutions strands them `OPEN`
**Found:** 7 Sep 2026, reviewing multi-coach safety.

The pending substitutions stack (UX-007 branch 3) lives in one device's React state and is
invisible to any other device. When another coach claims the match, the first coach's
`matchTracker.isActiveTracker` flips via realtime and their UI locks out — including the Submit
button — while their staged pairs are still held in memory and now cannot be committed.

`docs/UX-007-MATCH-SCREEN.md` anticipated two coaches diverging and gated the pending panel on
`active_tracker_id`, which is right. What it did not cover is losing the lock *while already
holding a pending stack*.

**Fix shape.** On losing the lock with a non-empty stack, say so loudly and unambiguously, and
keep the staged pairs so they can be submitted if the coach reclaims the match. Do not discard
them silently — a staged substitution represents a change that has already happened on the pitch.

### BUG-012 — Ending a period blanks every player tile to 0m `DONE`
**Found:** 7 Sep 2026, live-tracking test. Fixed 7 Sep 2026 on
`fix/bug-012-tile-reset-between-periods` (PR TBD).

When a period ends, every player tile drops to `0m` — except a player whose spell had
already been closed by a substitution during that period, whose tile keeps its total. The
database and the Match Report are correct throughout; this is a display-only regression in
the live tiles.

**Cause.** `useEnhancedMatchTimer` sets its clock to 0 the moment a period ends, so the
`currentPeriodSeconds` the tiles derive from drops to zero. `usePlayerTimers` does not
reload at that instant: its load was keyed only on `currentPeriodId` (unchanged — the next
period has not started) and its poll runs only while `isTimerRunning` (now false). So the
hook keeps the summary built during the period, in which every on-pitch player has an OPEN
interval and no closed one, and `playerMinutesPlayed` folds that against a zero clock →
`0m`. A player subbed off earlier already has a *closed* interval in the summary from the
reload that followed that substitution, so their `closedMinutes` total survives — which is
why exactly those tiles were unaffected.

**Fix** — `src/hooks/usePlayerTimers.tsx` only:

1. The effect that calls `loadPlayerTimes` now also depends on `isTimerRunning`, so it
   reloads when the timer stops as well as when it starts — picking up the closed
   intervals written by the period-end handler.
2. The period-end handler closes those logs asynchronously, so the immediate reload can
   read before the writes land (the same race the fast poll covers at kick-off and
   half-time). After a stop, one delayed re-check (~2s) is scheduled as well, cleared on
   unmount and on any further state change.

The existing fast/slow poll and `needsFastPoll` phase logic are unchanged — they still
cover the kick-off and half-time starter-row races. `src/lib/playerMinutes.ts` is
unchanged: its arithmetic was correct, it was being handed a stale summary and a zeroed
clock.

**Checks:** `npx tsc --noEmit -p tsconfig.app.json` clean; `npm run lint` unchanged; `npm
test` — see summary; `npm run build` — see summary. No new `playerMinutes.test.ts` case:
this is a reload-timing bug with no new pure input to `playerMinutes.ts`, and the
zeroed-clock arithmetic is already covered by the BUG-007 half-time test. Not tested on a
device.

**Update — 7 Sep 2026: the fix above did not work, confirmed on staging.** The
reload-on-`isTimerRunning`-change was correct, but the props feeding `usePlayerTimers` from
`EnhancedMatchTracker.tsx` could never carry the change:

- `isTimerRunning` was `timerRunning || isMatchRunning || false`, and `isMatchRunning`
  derived from `fixture` / `periods` — state loaded once on mount and never refreshed. When
  a period ends the DB row goes `is_active: false` but the page's copy still says `true`, so
  `isMatchRunning` stayed `true`, `isTimerRunning` never flipped, and the new effect never
  re-fired.
- `currentPeriodId` was `timerPeriodId ?? currentPeriod?.id ?? null`. On period end
  `timerPeriodId` becomes `null`, and `??` fell straight through to the stale mount-time
  period id — so `currentPeriodId` didn't change either and `loadPlayerTimes`' identity was
  unchanged.

Both fallbacks were left over from the DEFECT 1 fix, when the live timer values weren't yet
available; they only ever pinned the hook in the wrong state.

**Real fix:**

1. `src/pages/EnhancedMatchTracker.tsx` — the timer is now the sole source of truth for
   both props. `isTimerRunning` is passed as `timerRunning` alone; `isMatchRunning` is
   removed (nothing else used it). `timerPeriodId` is typed `string | null | undefined` and
   initialised `undefined`; the prop is
   `timerPeriodId !== undefined ? timerPeriodId : (currentPeriod?.id ?? null)`, so a
   reported `null` reaches the hook as `null` while the mount-time fallback still covers the
   window before the timer's first update. DEFECT 1 cannot regress: while a period runs the
   timer reports `isRunning: true` every tick, so `timerRunning` is true within ~1s of mount
   and the load effect re-fires on that change.
2. `src/hooks/usePlayerTimers.tsx` — `loadPlayerTimes` now handles a `null`
   `currentPeriodId` (the legitimate between-periods state) instead of early-returning: it
   skips the `match_periods` kick-off check, still reads all `player_time_logs` for the
   fixture, and folds with `currentPeriodId = null` so every interval is closed — correct
   fixture totals, nothing accruing. The transient-read-error guard, the BUG-012
   reload-on-stop + ~2s re-check, and the fast/slow poll are all unchanged.
3. `src/lib/playerMinutes.test.ts` — added a `summarisePlayerMinutes` case for
   `currentPeriodId = null`: every interval closed, totals summed, no player `isActiveNow`.

**Checks (real fix):** `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`, `npm test`,
`npm run build` — see session summary for which ran and their results. Not tested on a
device.

### BUG-011 — Fallback time-log inserts will over-count once the constraint is dropped `DONE`
**Found:** 7 Sep 2026, review of `fix/bug-009-prepare-rolling-subs`.

`submitSubstitutions.applyPair` and `EnhancedMatchTracker.initMissingStarterLogs` both kept
an `if (!row) insert { time_on_minute: 0, is_starter: true, is_active: true }` fallback
beneath their (now `is_active`-filtered) read. The fallback fires when a player has no
*open* interval in the period — which includes a returning player whose state is
inconsistent, the exact condition a partially-failed Submit produces.

While `unique_player_period_fixture` stood, that insert failed loudly with `23505`. Once it
is dropped it succeeds, creating a second interval from minute 0 and double-counting the
player's earlier spell. The migration would have converted a loud failure into a silent
wrong number here.

**Done — ships with the BUG-009 migration on `fix/bug-009-drop-unique-constraint` (PR
TBD).** Both fallbacks now read *every* row for `(fixture_id, player_id, period_id)`, active
and closed, and route the decision through a new pure function
`src/lib/missingStarterLog.ts` (`decideMissingStarterLog`, 9 unit tests) that distinguishes
three cases:

1. **No rows at all** — a genuine starter whose log was never written. Insert
   `time_on_minute: 0, is_starter: true`. Unchanged.
2. **Rows exist but none active** — the record of the player's current spell is missing and
   its start minute is unknown. Insert `time_on_minute` = the current elapsed duration in
   the period (the same value that closes the outgoing interval) with `is_starter: false`.
   The caller closes it at the same minute, so it is a **zero-length spell**: the player is
   credited *nothing* for the missing spell. This deliberately **under-states** rather than
   over-states — over-crediting hands the player less time in later matches than they are
   owed, the exact outcome this app exists to prevent. A `console.error` names the player,
   period and values. In `submitSubstitutions` only, a non-blocking `toast.warning` names
   the player and points at Match Data Editor; the pair is *not* failed (a lost
   substitution desyncs the on-screen pitch from the real one — worse than approximate
   minutes, per the UX-007 risk section). In `initMissingStarterLogs`, if the elapsed
   duration is not available at that point (timer has not ticked since mount), the insert
   is skipped entirely and logged — it never falls back to 0.
3. **An active row exists** — no insert; the caller's existing logic closes/extends it.

**Was blocking:** BUG-009's constraint-dropping migration — now resolved in the same PR.

### BUG-010 — `get_player_playing_time_v3` is a dead client code path, not schema drift `DONE`
Found 7 Sep 2026 during the BUG-009 investigation; resolved 7 Sep 2026 on
`fix/bug-009-drop-unique-constraint`.

Read-only SQL was run against **both** databases —
production (`crmlmnhillnnrnrxqera`) and staging (`xszbopufqchbfbqwvqbb`) — for two objects:
`unique_player_period_fixture` and `get_player_playing_time_v3`. Result: the constraint
exists on both with the identical definition `UNIQUE (fixture_id, player_id, period_id)`,
and **`get_player_playing_time_v3` exists in neither**. So this was never schema drift —
DEBT-013's stronger claim ("v3 was never deployed") was correct. The repository's baseline
is not stale here; it matches both live databases.

Reframed: `src/hooks/useReports.tsx` calls `get_player_playing_time_v3` first on every
Reports load and only falls back to `v2` in the `catch`. That first call has always failed
(function not found) and always will — a dead round-trip on every load, plus the
already-noted problem of three disagreeing "minutes played" formulas. The fix is the same
one DEBT-013 already describes: pick one implementation, deploy it as the only RPC the
client calls, drop the others. **Folded into DEBT-013** — see there; this item exists only
to record that the live check was run and settled the "drift vs. dead code" question.

**Scope of the check:** these two objects only, by name, on both databases. Not a full
schema diff — DEBT-002 covers that, and it reported local/remote reconciled as of Session 8.

Relates to DEBT-013, ENV-006.

### BUG-009 — Rolling substitutions are impossible: unique constraint contradicts the interval model `DONE`
**Found:** 7 Sep 2026, dev testing of `feat/match-staged-subs` — first Submit failed with
`23505 duplicate key value violates unique constraint "unique_player_period_fixture"`.

`player_time_logs` carries `UNIQUE (fixture_id, player_id, period_id)`, added in the Lovable
era (`supabase/migrations-archive/lovable-era/20250915190202_*.sql`) with the comment "to
support upsert operations". It permits exactly one row per player per period.

The application's model is intervals: a player may come on, go off, and come back on within
one period. `submitSubstitutions.applyPair` opens an interval for the incoming player unless
one is already *active* — it does not consider a *closed* row for the same player in the same
period. When a player who has already been substituted off returns, the insert violates the
constraint and the pair fails. The retry added under BUG-006 cannot help: the failure is
deterministic, not transient.

The period-transition effect in `EnhancedMatchTracker` and `submitSubstitutions` both carry
comments stating that multiple intervals per period are supported. The schema has forbidden it
since before the constraint was inherited.

**Impact.** UK grassroots youth football uses rolling substitutions as the normal pattern, not
an exception. This fails repeatedly in a real match. Blocks the 12 Sep 2026 season start.

**Two further consequences.**
- Submit is neither atomic nor idempotently retryable for this failure. Both `player_match_status`
  rows and the outgoing player's closed interval are written before the insert fails, leaving the
  incoming player marked on-field with no time log while the UI still shows the pair as pending.
  Contradicts the risk section of `docs/UX-007-MATCH-SCREEN.md`.
- `src/lib/playerMinutes.ts` (BUG-007) sums multiple intervals per player per period. Under the
  constraint that path is unreachable, and a returning player's single row spans both spells —
  counting bench time as playing time.

**Likely fix:** drop the constraint, since the data model is intervals and the constraint was
added for an upsert that no longer describes how these rows are written. Verify against every
other writer of `player_time_logs` first — the constraint may be masking duplicate-insert bugs
elsewhere (`ensurePlayerStatuses`, the period-transition insert, `useEditMatchData`,
`useRetrospectiveMatch`). Requires a migration on staging then production before 12 Sep 2026.

**Done — `fix/bug-009-drop-unique-constraint` (PR TBD).** Two stages:

- **Preparatory code changes (shipped earlier, `fix/bug-009-prepare-rolling-subs`).** The
  two unguarded reads in `submitSubstitutions.ts` and `EnhancedMatchTracker.tsx`
  (`initMissingStarterLogs`) were changed to filter on `is_active` instead of assuming one
  row per player/period, and `useRetrospectiveMatch.tsx` / `PlayerTimesTable.tsx` were
  given duplicate guards against an existing `(player_id, period_id)` row instead of
  relying on the constraint. Shipping these first was deliberate — it stops those reads
  throwing once duplicate rows become possible.
- **This branch.** Migration
  `supabase/migrations/20260907213545_drop_unique_player_period_fixture.sql` drops
  `unique_player_period_fixture` (`ALTER TABLE ... DROP CONSTRAINT IF EXISTS`), with a
  comment block explaining the interval model, the obsolete Lovable-era upsert rationale,
  and that the analytics layer already sums per row. **No** partial `WHERE is_active` index
  is added — non-blocking, and the minimal change wins this close to the season. Ships
  alongside the BUG-011 fix (the fallback-insert over-count), which had to land in or
  before this PR. Migration application is a **manual step** — `supabase db push` was not
  run.

Read-only SQL against both databases (see BUG-010) confirmed the constraint exists on
production and staging with the identical definition, and that no duplicate rows can exist
(a UNIQUE constraint cannot have been satisfied by duplicates), so there is no data
migration.

### BUG-008 — Match-state writes fail silently, and the timer worker may outlive the page `OPEN`
**Found:** 7 Sep 2026, dev testing on a poor connection while verifying the BUG-007 fix.

Navigating away from the match screen and back produced a repeating console error:

    useEnhancedMatchTimer.tsx:167 Error saving match state:
    {message: 'TypeError: Failed to fetch', ...}

Stack: `EnhancedMatchControls.tsx:104` → `useEnhancedMatchTimer.tsx:209` posts to a Web Worker →
the worker's `setInterval` (lines 108-109) posts back each tick → the handler at 136 writes match
state at 167.

**Confirmed: the write fails silently.** Line 167 catches and `console.error`s. No retry, no
queue, no user-visible warning. If the payload includes `total_paused_seconds`, a failed save
while pausing means the pause is never recorded — and the match clock is derived from
`actual_start_time` minus paused seconds, so it would over-count for the rest of the match.
Grassroots pitches have poor mobile data; this is the normal case, not an edge case.

**Unconfirmed: the worker may not be terminated on unmount.** The errors recurred after leaving
and returning to the page, suggesting the interval kept running. If so, each visit spawns another
worker writing match state on a timer. Needs verification — not established.

Pre-existing. Not introduced by UX-007, which only extended `onTimerUpdate`'s arguments, not the
worker loop. The `Failed to fetch` itself was a genuine connectivity failure (testing on a train),
not a code fault.

### BUG-007 — Tile minutes reset to 0m at half time `DONE 6 Sep 2026`
**Found:** 6 Sep 2026, code review of `usePlayerTimers` while fixing DEFECT 1.

`usePlayerTimers` scoped its `player_time_logs` query to the current period
(`.eq('period_id', currentPeriodId).eq('is_active', true)`), so every tile read 0m for the
first minute of the second half and only climbed from there — the first half's minutes were
gone from the display. Playing time on the tile is meant to be a whole-match total (it is
the app's most defensible feature, per `docs/UX-007-MATCH-SCREEN.md`), not a per-period
count.

Fixed in this commit alongside the DEFECT 1 rewrite (BUG-006): the query now pulls every
`player_time_logs` row for the fixture and `src/lib/playerMinutes.ts` folds them into a
per-player total — closed intervals from every period contribute their duration
(`time_off_minute - time_on_minute`), the still-open interval in the *current* period
accrues live from the period's elapsed seconds, and an open interval orphaned in a period
that already ended contributes 0 (its duration is not recoverable client-side). Every
contribution is clamped at ≥ 0. Both columns are durations, not timestamps — the
`matchMinute.ts` "+1 minute in progress" convention is deliberately not applied here
(BUG-005).

Checks: `tsc --noEmit -p tsconfig.app.json` clean; vitest — added `src/lib/playerMinutes.test.ts`
(16 cases covering the fold and the render-time arithmetic, including an explicit half-time
regression case); `npm run build` clean; lint unchanged (pre-existing errors only). Not
tested on a device. The `usePlayerTimers` DB wiring itself is not covered — no supabase mock
harness in the repo — but the arithmetic it depends on is pure and tested.

### BUG-006 — Staged-substitutions branch: four defects + two rendering bugs found on staging `DONE 6 Sep 2026`
**Found:** 6 Sep 2026, staging test of `feat/match-staged-subs` (UX-007 branch 3).

Six issues, fixed together on the branch (not yet merged):

- **Player minutes stuck at 0m on the tiles.** `usePlayerTimers` was fed `currentPeriodId`
  / `isTimerRunning` derived from `EnhancedMatchTracker`'s `periods` + `fixture` state,
  which is only loaded in `loadMatchData` — on mount, never when the timer starts a period.
  A period started while the screen was open left `currentPeriod = null`, so the hook's
  per-second interval returned early and every tile read 0m until a remount. Fix:
  `EnhancedMatchControls`' `onTimerUpdate` now also passes the live `periodId` + `isRunning`
  from `useEnhancedMatchTimer` (fresh every second); the page prefers those, falling back to
  the old derivation. The hook is read-only, so this was only ever a wrong number, not data.
  **This fix did not resolve the defect.** Staging testing on 6 Sep 2026 failed the "player
  minutes stuck at 0m" check twice — once before this pass and once after it. Passing a live
  `periodId` actually fired `loadPlayerTimes` *earlier*, tightening a race that was the real
  cause: the load runs on the same tick `currentPeriodId` becomes non-null, which is when
  `EnhancedMatchTracker`'s period-transition effect starts its ~23 sequential Supabase writes
  creating the starter `player_time_logs` rows for an 11-a-side squad. The hook read zero
  rows, set an empty map, and its per-second interval only iterated the keys already in the
  map — so an empty map never repopulated until half time. Fixed separately in this commit
  under BUG-007: `usePlayerTimers` was rewritten to derive minutes from the period's elapsed
  seconds at render (no interval), reload on a fast poll while the map is empty, and sum
  playing time across the whole fixture rather than the current period.
- **Substituted-off player back on the pitch after leaving and returning.** `ensurePlayerStatuses`
  ran on every mount and, whenever status rows existed, unconditionally reset `is_on_field`
  to the pre-match starting lineup — wiping every substitution from a prior session. Fix:
  the reconcile-to-starters step is now skipped once the match is under way (fixture status
  in_progress/live/paused/completed, or any `match_periods` row exists); missing rows are
  still healed. Also `submitSubstitutions` now upserts `player_match_status` on
  `(fixture_id, player_id)` and asserts a row came back, instead of a bare `.update()` that
  returns success on zero matched rows.
- **First Submit failed "N still pending", second worked.** `applyPair` makes ~7 sequential
  Supabase writes per pair with no retry and no logging of which one failed; a lone transient
  error failed the whole batch, and the retry succeeded because the writes are idempotent
  (`client_event_id` upserts, insert-only-if-no-active-log). Fix: each step is now wrapped
  with a labelled `console.error` on failure, and each pair gets one automatic retry before
  the batch stops. The failure toast now includes the underlying error message.
  **Correction, 7 Sep 2026:** this diagnosis was wrong. The root cause was subsequently
  identified as BUG-009 — the `unique_player_period_fixture` constraint rejecting a second
  interval for a player returning to the pitch within the same period. The failure is
  deterministic, not transient, and the retry added here cannot resolve it: the second
  attempt hits the same constraint and fails the same way. The labelled per-step logging
  added by this same fix is what made BUG-009 diagnosable.
- **Pending sub counted but invisible.** The old `effectiveLineup` filtered staged players
  against "still in the committed pitch/bench list I expect"; after a partial submit or an
  Edit-Squad the committed lists shift and the staged player passed neither filter, so it
  had no tile while the guard still counted it. Fixed by FIX 6 below (no more filtering) plus
  `PendingSubsPanel` hardening: the header count is taken from the exact list it maps, and an
  unresolvable name renders as "Unknown", never as a blank row.
- **FIX 5 — `LiveEventsSummary` blank card per `substitution_on`.** It looked the "on" player
  up via `assist_player_id`, which is null on those rows (`player_id` holds the player). Now
  the `substitution_off` / `substitution_on` pair collapses into one row — "Kai on · Milo
  off" — keyed by period + minute, paired before the 5-item cut-off.
- **FIX 6 — staged players jumped to the end of the grid.** `effectiveLineup` appended the
  staged-in player to the pitch and the staged-out player to the bench. Now staged pairs do
  not move anyone: both hold their committed slot (flagged pending) and the grid only
  reshuffles when Submit commits and the lineup reloads.

Checks: `tsc --noEmit -p tsconfig.app.json` clean; vitest 56/56 (added `PendingSubsPanel.test.tsx`,
`LiveEventsSummary.test.tsx`, rewrote the `effectiveLineup` block of `pendingSubs.test.ts`);
`npm run build` clean; lint unchanged (pre-existing errors only). Not tested on a device.
Not covered by automated tests: the `usePlayerTimers` wiring, the `ensurePlayerStatuses`
guard, and the `submitSubstitutions` retry/upsert (no supabase mock harness in the repo).

### BUG-005 — Event minutes counted elapsed minutes, not the minute in progress `DONE 6 Sep 2026`
**Found:** 6 Sep 2026

Minutes were derived with `Math.floor(seconds / 60)`, so a goal at 0:30 was recorded as
0' and one at 34:47 as 34'. There is no minute zero in football: 0:00–0:59 is the 1st
minute.

Fixed in PR #70 ("fix: count event minutes as the minute in progress, not minutes
elapsed") via a new `src/lib/matchMinute.ts` helper whose comment sets out the rule — a
TIMESTAMP is the minute you are in (`floor + 1`), a DURATION is minutes elapsed
(`floor`). The nine other floor sites are durations and were deliberately left alone. A
first pass introduced a skew by feeding a timestamp into `time_off_minute` and
`time_on_minute`, which are durations; both now use a plain floor. Seven boundary tests.

**Note for future readers:** records created before 6 Sep 2026 use the old convention
and read one minute lower than equivalent records after it.

### BUG-004 — Undo was removed from the live match screen `DONE 4 Sep 2026`
**Found:** 31 Aug 2026, during the match screen interaction review
**File:** `src/pages/EnhancedMatchTracker.tsx:703`

`onUndo: () => {}, // Undo functionality removed` — the handler is stubbed, so the
control does nothing. A coach who mis-taps during play has no way back; the event has
to be corrected after the match, if it's noticed at all.

Fixed in PR #61: `useUndoStack`, `UndoButton` and the Ctrl+Z binding were all already
intact but never wired up — `onUndo` was stubbed at `EnhancedMatchTracker.tsx:703`.
Undo now deletes only the just-created row by id; the score is derived from
`match_events`, so it self-corrects. Also fixed two latent bugs found in the
previously-unused code along the way: the progress bar divided by 30 against a 5s
window, and the button was a 40px touch target (below the 44px minimum). The undo
window was raised from 5s to 10s. Relates to UX-002.

### BUG-003 — Reopen-a-match doesn't reliably return the match to a trackable state `OPEN`
**Found:** 31 Aug 2026

the function to reopen a match was introduced some time back, so that match tracking could
resume if a user mistakenly ended a match (e.g. ending the entire match vs ending a
period). This doesn't always work - i.e. the state in which the match is returned to
doesn't reliably allow match tracking to resume

**Diagnosed 4 Sep 2026:** `reopenMatch()` sets the fixture to `in_progress`, nulls
`current_period_id`, and leaves `match_periods` untouched. That causes three separate
problems: (a) no live period — `match_periods` rows keep `is_active=false`, so
`isMatchRunning` stays false and the clock is dead until a new period is explicitly
started; (b) controls arrive disabled because `active_tracker_id` is deliberately not
set on reopen; (c) playing time stays closed, because the `player_time_logs` intervals
were already finalised when the match ended.

A decision is needed before fixing this: resume the period that was running when the
match was ended, or always start a fresh one. Estimated ~2-3 hours; do alongside
UX-007 (`EnhancedMatchTracker.tsx` is already being touched there, so surface the
resume-vs-fresh-period choice as part of that same pass rather than editing the same
file twice).

Relates to BUG-001.

### BUG-002 — Duplicate club-creator trigger caused club creation to fail `DONE 30 Aug 2026`
**Found:** 30 Aug 2026, while seeding test data on staging — the first bug the staging
environment caught.

Creating a club failed with `duplicate key value violates unique constraint
club_members_club_id_user_id_key`. Cause: two identical `AFTER INSERT` triggers on
`public.clubs`, both calling `add_club_creator_as_admin()`, so the creator was inserted
into `club_members` twice.

Fixed in migration `20260830111038` (PR #47): dropped `add_club_creator_as_admin_trigger`
and added `ON CONFLICT DO NOTHING` to `add_club_creator_as_admin()`. Applied to staging via
`supabase db push`, and to production via the dashboard SQL editor on 30 August, then
recorded in production's migration history. Verified on both databases: three triggers
remain on `clubs`, and both databases list the same three migrations as the repo.

### BUG-001 — Broken navigation in MatchReport `DONE 4 Sep 2026`
**Found:** 20 Aug 2026, during orphan-page cleanup
**File:** `src/pages/MatchReport.tsx:332`

Calls `navigate('/match-tracker/${fixtureId}')`. No such route exists in `App.tsx` — the
live route is `/match-day/:fixtureId`. Any user tapping this control lands on the 404 page.

Predates the Session 1 cleanup; the route has never matched.

**Diagnosed 4 Sep 2026:** the call at `MatchReport.tsx:332` sits inside
`getBackNavigation()` — it's the "Back to Live Tracking" button, not a reopen control.
`reopenMatch()`, twelve lines below, already navigates to the correct `/match-day/`
route. This is a one-word fix, not a design question. Note the practical impact: this
404s a coach who checks the report screen while the match is still in progress.

Fixed in PR #63: `MatchReport.tsx:332` now points at `/match-day/:fixtureId`, matching
`reopenMatch()`. Verified on staging — View Report during a live match, then Back to
Live Tracking, now lands on the match screen instead of the 404. Three other
`'match-tracker'` references were deliberately left alone: they are navigation-state
markers matching `state.from` set in `EnhancedMatchTracker.tsx:821`, not paths, and a
code comment now says so.

---

## Performance

### PERF-001 — xlsx library bundled into the Reports page `OPEN`
Reports chunk is 310 kB (101 kB gzipped), the largest in the build, driven by the
SheetJS xlsx dependency used only by ExportDialog. Convert to a dynamic import so it
loads on export rather than on page view. Matters most for parents on mobile data.
Relates to UX-001.

---

## Technical debt

### DEBT-023 — Redundant `sideline_app` Supabase project should be retired `OPEN`
**Found:** 7 Sep 2026, while enumerating Supabase projects for the BUG-009 migration.

There is a third Supabase project, `sideline_app` (ref `pngbyspcczhzkccjxupo`, created
23 Aug 2025), alongside the two in use — production `crmlmnhillnnrnrxqera` (`coach-asst`)
and staging `xszbopufqchbfbqwvqbb` (`sideline-staging`). The project owner has confirmed it
is a redundant first attempt and nothing points at it (no `.env*` in this repo references
that ref; `config.toml` and `.temp/linked-project.json` name the other two).

Before deleting: log in to the Supabase dashboard for `pngbyspcczhzkccjxupo` and check what
it actually holds — any real rows, storage objects, edge functions, or auth users — and
export anything worth keeping. Then delete the project. **Do this after 12 Sep 2026**, not
during season-start week, so it cannot possibly disturb the launch.

Relates to ENV-008, ENV-005.

### DEBT-020 — Lovable leftovers and repo hygiene `OPEN`
**Found:** 4 Sep 2026

Dead weight now that DEBT-007 is done: `lovable-tagger` in `package.json` and
`vite.config.ts` (dev-mode only, harmless but pointless), the `.lovable/` directory,
and a Lovable reference in `src/integrations/supabase/client.ts`.

Separately, a stale `.CLAUDE.md.swp` vim swap file dated 30 August sits in the repo
root and is not gitignored — delete it and add `*.swp` to `.gitignore`.

All cosmetic; do after the season.

### DEBT-019 — Auth email hook depends on two Lovable npm packages `OPEN`
**Found:** 4 Sep 2026

`supabase/functions/auth-email-hook/index.ts` imports `npm:@lovable.dev/email-js` and
`npm:@lovable.dev/webhooks-js` for webhook signature verification and payload parsing,
and reads a secret named `LOVABLE_API_KEY`. Nothing breaks today — these are public npm
packages doing local HMAC verification, independent of the Lovable account — but the
auth email path for every signup, invite and magic link now depends on packages
maintained by a vendor no longer involved in this project.

Replace with standard HMAC verification and rename the secret when there is time.
Relates to DEBT-007.

### DEBT-018 — Orphaned `public/favicon.png` `OPEN`
Leftover path from the Lovable export. Overwritten with current artwork so nothing stale
is served, but nothing references it. One-line deletion.

### DEBT-001 — `.env` committed to the repository `DONE 20 Aug 2026`
Untracked via `git rm --cached`; `.gitignore` updated; `.env.example` added. PR #33.
Keys were the Supabase URL, project ID and publishable key — public by design, so no
rotation required. Motivation was environment separation, not secrecy.

### DEBT-002 — Schema drift between git and production `DONE 24 Aug 2026`
`supabase db pull` could not run: remote `schema_migrations` recorded ~70 Lovable-era
migrations (20250829–20250929) with no local files, and none of the 17 local migrations
were recorded remotely — the two histories had fully diverged and could not be reconciled by
the CLI. Worked around by dumping the live schema directly
(`supabase/production_schema.sql`, via `supabase db dump`) and diffing it against
`supabase/migrations/` by hand — see `docs/SCHEMA_BASELINE.md` for the full comparison.
Confirmed: the schema in git was *not* the schema in production (`profiles.email` still
exists despite a migration removing it, `get_player_playing_time_v3` doesn't exist despite
being the client's first-choice RPC, `email_queue`/`email_send_log` exist in prod with no
local migration at all). PR #43 established the baseline locally: `supabase/migrations/`
now contains a single file, `20260824000408_baseline.sql` (formerly
`production_schema.sql`), and everything that predates it moved to
`supabase/migrations-archive/` (`pre-baseline/`, `lovable-era/`). Session 8 completed the
remaining step: the remote `supabase_migrations.schema_migrations` table was reset via the
Supabase CLI to match this new baseline, verified by `supabase db pull` reporting no
changes. Local and remote schema history are reconciled.
**Unblocks:** ENV-001 (jointly with DEBT-001, also DONE). **Session 5, Session 8.**

### DEBT-003 — Test coverage for critical match paths `IN PROGRESS`
Vitest harness landed in PR #39. Pure-logic tests landed in PR #40: 11 tests covering
period timing (running, paused, ended, unstarted), pause arithmetic, multi-period
totals, per-side scoring, and a guard asserting every event_type the app writes is
permitted by the database constraint.

Match minute convention fixed and pinned on branch `fix/match-minute-convention`:
`getCurrentMinute` / `getTotalMatchMinute` in `useEnhancedMatchTimer.tsx` derived event
minutes with `Math.floor(seconds / 60)` (completed minutes), recording a 34:47 goal as
34'. They now return the minute *in progress* (`floor + 1`) via a new pure helper
`src/lib/matchMinute.ts`, with `src/lib/matchMinute.test.ts` covering 0:00 / 0:30 /
0:59 / 1:00 / 34:47 / 45:00 plus the negative/NaN guard (7 tests). The other nine
`Math.floor(seconds / 60)` call sites (period durations, `usePlayerTimers` elapsed
time, `formatTime` clock display) are durations and were deliberately left alone;
comments at each changed function record the TIMESTAMP-vs-DURATION distinction.

Follow-up for the UX-007 / UX-009 rebuild: `EnhancedMatchTracker.tsx` reuses the
`currentMinute` state for both event timestamps (correctly `floor + 1` now) and
substitution `player_time_logs.time_off_minute` / `time_on_minute` boundaries
(lines ~1243, ~1268), which are duration boundaries and now carry the extra minute.
Effect is bounded at ≤1 min per substitution and largely self-cancelling across the
off/on pair; no rows dropped. Untangle when the screen's three conflated minute needs
are separated.

Remaining: RLS enforcement (a parent must not be able to write to `match_events`) and
the substitution integration path (one `player_time_logs` row closes as another opens).
Both need a real database rather than mocks, so they follow staging.
**Blocked by:** ~~ENV-001~~ — unblocked, ENV-001 DONE 30 Aug 2026; staging is available to
run these against.

### DEBT-004 — `EnhancedMatchTracker.tsx` is ~1,370 lines `OPEN`
The most important screen in the app, used live under pressure, is a single monolith.
Also the file we most need to change for the coach UX work. Extract recording controls,
substitution flow and timer panel into separate components — as its own PR, nothing else in it.

### DEBT-005 — Four lockfiles `DONE 20 Aug 2026`
bun lockfiles deleted; npm is authoritative; `deno.lock` retained for Edge Functions;
`engines` field added. `package-lock.json` deliberately NOT regenerated, to avoid version
drift before the season.

### DEBT-006 — ~30 historical markdown files in repo root `DONE 20 Aug 2026`
29 files moved to `docs/archive/`, 7 loose scripts moved to `scripts/` with a README.
PR #34.

### DEBT-010 — npm audit warnings unreviewed `OPEN`
Present before the npm consolidation. Likely dev-dependency and transitive only, so not
reaching users' browsers. Review before the Vercel production deploy; do not chase
pre-season.

### DEBT-011 — Migration filenames don't follow Supabase convention `DONE 24 Aug 2026`
15 of 17 migrations used 8-digit date prefixes (`20251012_name.sql`) rather than Supabase's
expected 14-digit timestamp (`YYYYMMDDHHMMSS_name.sql`). Confirmed by the schema baseline
(`docs/SCHEMA_BASELINE.md` §6): three date prefixes were each reused across multiple files
(`20251012` ×4, `20251208` ×4, `20260110` ×3). Since the CLI keys its migration history by
that prefix, this wasn't just a style issue — a `supabase db push` against a project
tracking these files would have collided on the reused version and aborted partway. The
baseline reset (DEBT-012) moved all 17 files to `supabase/migrations-archive/pre-baseline/`,
so their duplicate/short prefixes no longer matter for `supabase db push`.
`supabase/migrations/` now has a single 14-digit-prefixed file
(`20260824000408_baseline.sql`), CLAUDE.md states new migrations must use the full 14-digit
format, and Session 8's remote history reset (DEBT-002) confirmed a real `supabase db push`
now works cleanly against this history. PR #43; remote reset in Session 8.

### DEBT-012 — Decide the go-forward migration strategy `DONE 24 Aug 2026`
`docs/SCHEMA_BASELINE.md` §7 surfaced a fork that blocks real cleanup: the 17 active
migrations have **no `CREATE TABLE` for any of the 11 core tables** (`fixtures`, `clubs`,
`match_events`, `teams`, `players`, `match_periods`, `player_time_logs`, `club_members`,
`profiles`, `team_players`, `player_match_status`) — those only exist in
`supabase/migrations-disabled/`. Two options, with opposite consequences for
`migrations-disabled/` and `cloud_full.sql`:
1. Keep `migrations/` as a replay-from-scratch history (Supabase's normal model) —
   requires reconciling `migrations-disabled/` into the active folder rather than deleting
   it.
2. Treat `supabase/production_schema.sql` as the new baseline for seeding fresh
   environments, and only track changes from here forward — makes the old history
   (`migrations-disabled/`, and the unrecorded remote Lovable-era migrations) irrelevant
   for schema rebuilds.

**Decision made: option 2.** The baseline was established locally in PR #43 — `git mv`s
only, no `supabase` CLI commands run at that point. `supabase/production_schema.sql` became
`supabase/migrations/20260824000408_baseline.sql`, the single live migration.
`supabase/migrations-disabled/` no longer exists; its contents moved to
`supabase/migrations-archive/lovable-era/`, and the 17 former active migrations moved to
`supabase/migrations-archive/pre-baseline/` (see that directory's `README.md`). Session 8
completed the remaining step: the remote `supabase_migrations.schema_migrations` table was
reconciled against this baseline via the Supabase CLI, verified by `supabase db pull`
reporting no changes. A future `supabase db push` now works against this baseline.
**Unblocked:** DEBT-002, DEBT-011 (both DONE). **Unblocks:** ENV-001 (jointly with
DEBT-001).

### DEBT-013 — `get_player_playing_time_v3` doesn't exist in production `OPEN`
The client (`src/hooks/useReports.tsx:147`) calls `get_player_playing_time_v3` first on
every reports page load and only falls back to `v2` in the `catch` block. `v3` was never
deployed (`docs/SCHEMA_BASELINE.md` §3) — every load silently eats a failed RPC round-trip.

**Confirmed 7 Sep 2026 by read-only SQL against both databases:** `get_player_playing_time_v3`
exists in neither production (`crmlmnhillnnrnrxqera`) nor staging (`xszbopufqchbfbqwvqbb`).
BUG-010 (which raised the possibility that the baseline was merely stale) is folded into
this item — it was a dead client code path, not schema drift. Check covered this function
and `unique_player_period_fixture` only, not a full schema diff.
Worse: there are now three different formulas for the same "minutes played" number in
production (`get_player_playing_time`/`_v2`, the never-deployed `_v3`, and
`analytics.mv_player_playing_time`, which is refreshed on every match write but read by
nothing) that disagree on how to cap an open-ended period (missing `time_off_minute`).
Given player time calculation is already a repeat source of bugs (`CLAUDE.md`), pick one
implementation, deploy it as the only RPC the client calls, and drop the other two.
**Blocks on:** DEBT-012 (need a working migration path before adding a new migration).

### DEBT-014 — `20260131_fix_rogue_assist_events.sql` would break substitution recording if run `OPEN`
This migration rewrites the `match_events` event-type CHECK constraint to only allow
`'goal'` and `'substitution'`. Production's real constraint (and the client's actual event
model, `EnhancedMatchTracker.tsx:1235,1253`) uses `'substitution_on'`/`'substitution_off'`
as two distinct types. If this migration is ever applied as currently written, every
substitution recorded live at a match will fail the CHECK constraint. The migration never
reached production (confirmed via schema diff), so this hasn't happened yet, but the file
needs rewriting — not just applying — before it's usable. Its actual purpose (deleting
rogue standalone `'assist'` events from an old UI bug) also never ran; those rows, if any
existed, are likely still in `match_events` today (unverified — needs a live query, not
just the schema dump) and would be quietly skewing assist stats in `mv_goal_scorers`.

**Mitigated (not resolved) by the now-complete DEBT-012 baseline reset:** the file moved to
`supabase/migrations-archive/pre-baseline/20260131_fix_rogue_assist_events.sql`, which is
never run, and the archive's `README.md` explicitly calls out that it must not be applied.
It has not been deleted or rewritten — the underlying rogue-`'assist'`-rows cleanup this
migration was meant to do still hasn't happened, and the constraint-rewrite bug is still
uncorrected in the file itself. A working migration path now exists (DEBT-012 is DONE), so
the actual fix — a live query for rogue `'assist'` rows plus a corrected migration — is
unblocked whenever this is picked up.

### DEBT-015 — Two debug RPCs exposed to anonymous callers `OPEN`
`test_auth_context()` and `test_current_user()` exist in production, granted to `anon`,
`authenticated`, and `service_role`, and are unreferenced anywhere in `src/` or
`supabase/functions/` (`docs/SCHEMA_BASELINE.md` §8). `test_current_user()` echoes back
`auth.jwt()` to whoever calls it. Low severity (a caller only ever sees their own JWT), but
they're dead, undocumented, and callable without authentication. Drop both once there's a
working migration path (DEBT-012).

### DEBT-016 — `email_queue` and `email_send_log` have no local migration `OPEN`
Both tables are live in production and actively used (`supabase/functions/auth-email-hook/index.ts`
calls the `enqueue_email` RPC, which inserts into `email_queue`), but neither table appears
in `supabase/migrations/` or `supabase/migrations-disabled/` — not even the disabled/
historical record. Production's own comment on `email_queue`
(`'Queue for async email processing via Lovable email service'`) points to these having
been created directly by Lovable's sync, consistent with DEBT-007. Once DEBT-012 is
resolved, backfill a migration (or note in the new baseline) capturing these two tables so
the schema can actually be rebuilt from git.

### DEBT-017 — MatchEventsList.tsx is orphaned `OPEN`
Not imported anywhere. Its event_type union declares six values the database constraint
has never permitted (throw_in, corner, free_kick, penalty, goal_kick, substitution),
which is how it drifted unnoticed. Delete, same as the Session 1 orphans.

### DEBT-021 — `ActivePlayerCard.tsx` is orphaned `OPEN`
**Found:** 6 Sep 2026, during UX-007 branch 2. `src/components/match/ActivePlayerCard.tsx`
was the on-field player row on the match screen; branch 2 replaced it with
`PlayerTileGrid` and nothing else imports it. Delete once branch 2 is merged (kept for
now only so the branch is a clean single-purpose diff).

### DEBT-022 — `EnhancedSubstitutionDialog.tsx` is orphaned `OPEN`
**Found:** 6 Sep 2026, during UX-007 branch 3. `src/components/match/EnhancedSubstitutionDialog.tsx`
was the tap-to-open substitution flow on the match screen; branch 3 replaced it with the
staged model (tile taps → pending stack → Submit) and nothing else imports it. Its write
sequence was extracted to `src/lib/submitSubstitutions.ts` rather than reimplemented. Left
in place so the branch is a clean single-purpose diff (same treatment as DEBT-021 /
`ActivePlayerCard.tsx` in branch 2); delete once branch 3 is merged. The older sibling
`src/components/match/SubstitutionDialog.tsx` looks orphaned too — check and sweep both
together.

### DEBT-007 — Lovable bidirectional sync still active `DONE 4 Sep 2026`
Pushes to this repo sync to Lovable and vice versa. Now that development happens through
Claude Code, two tools have write access to the same branch with no awareness of each
other. Treat Lovable as read-only immediately; disconnect properly when moving to Vercel.

Kept open on purpose after ENV-002 (Vercel cutover, DONE 31 Aug 2026): the Lovable
deployment is retained as a DNS rollback target until 3 September. Disconnect after that.
**Blocked ENV-002** (now DONE — proceeded ahead, keeping Lovable live as rollback).

**4 Sep 2026:** the rollback window (until 3 September) has now passed, and the Vercel
deployment is confirmed serving `sidelineassist.club`, so the Lovable deployment is no
longer needed as a rollback target. Disconnecting is the next action, and it is now the
priority before the UX-007 rebuild begins, because two tools currently hold write
access to the same branch.

**Done 4 Sep 2026:** disconnected via Lovable Project settings → Git → GitHub →
Disconnect (no PR — an account-settings action, not a code change). The GitHub
repository remains intact with full history; the Lovable project retains a frozen copy
that now syncs nowhere. Verified afterwards: `sidelineassist.club` still serves from
Vercel, an auth email (OTP) still sends, and no commits landed on `main` as a result of
the disconnect. The Lovable subscription is being cancelled — nothing operational
depends on the account, since `LOVABLE_API_KEY` is a local HMAC secret in Supabase with
no call to Lovable's servers, and the `@lovable.dev` packages are public npm (see
DEBT-019, DEBT-020 for what that leaves behind).

### DEBT-008 — Capacitor `appId` is a placeholder `OPEN`
`capacitor.config.ts` has `appId: 'com.yourorg.sidelinecoach'`. This becomes the permanent
App Store bundle identifier and **cannot be changed after first submission**. Set before
any TestFlight build.
**Blocks:** NATIVE-001.

### DEBT-009 — Committing directly to `main`, uninformative commit messages `OPEN`
Several recent commits are named "Changes". Enable branch protection requiring a PR.
**Session 7.**

---

## Security

### SEC-001 — Storage policy grants every authenticated user full access to every bucket `OPEN`
**Found:** 24 Aug 2026, during the Session 8 baseline reconciliation

The `storage.objects` policy `"Allow all storage operations for authenticated users"` is
defined as `using (true) with check (true)` for every operation, granted to
`authenticated`. Postgres RLS combines multiple permissive policies with OR, so this
overrides the four narrower club-admin-scoped policies on the same table — any logged-in
user, including a parent account, can read, overwrite, or delete any club's storage
objects (badges, kit photos, etc.), not just their own club's.

Fix is a migration dropping (or correctly narrowing) the blanket policy so the four
club-admin policies are the actual effective boundary. No longer blocked on a migration
path — DEBT-012 is DONE, so this can be picked up directly.

---

## Environments & delivery

### ENV-008 — `supabase/config.toml` default project is production; linking must be explicit `OPEN`
**Found:** 7 Sep 2026, during the BUG-009 migration work.

`supabase/config.toml` sets `project_id = "crmlmnhillnnrnrxqera"` — that is
**production** (`coach-asst`). All schema work is done against **staging**,
`xszbopufqchbfbqwvqbb` (`sideline-staging`). A `supabase link` that accepts the config
default, or any CLI command that falls back to it, points the local toolchain at the live
match database. `supabase db push` in particular would apply migrations to production.

The linked project is stored in `supabase/.temp/linked-project.json` (currently staging,
correctly), but that is easy to overwrite and not obvious. Rule going forward: every
`supabase link` / `supabase db …` invocation must pass `--project-ref` explicitly —
`xszbopufqchbfbqwvqbb` for staging, `crmlmnhillnnrnrxqera` for production — and never rely
on the `config.toml` default. Consider changing the `config.toml` default to staging, or
removing it so the CLI always demands `--project-ref`.

Both refs are now recorded in `CLAUDE.md`'s Supabase section. Relates to ENV-005, ENV-001.

### ENV-007 — Auth emails send from Resend's shared sandbox domain `OPEN`
**Found:** 4 Sep 2026

`supabase/functions/send-email/index.ts` sends from `'SideLine <onboarding@resend.dev>'`.
That is Resend's shared test domain, not a verified sender. Acceptable for two coaches
who know to look for it; a deliverability and credibility problem for parents, since
shared sender domains attract spam filtering and a club email arriving from
`resend.dev` does not read as legitimate.

Fix is to verify `sidelineassist.club` with Resend and send from it — a DNS job, so do
it well before parent rollout.
Relates to ENV-002, PWA-003.

### ENV-006 — Report views are created unpopulated and the refresh fails silently `OPEN`
**Found:** 4 Sep 2026

Completed matches rendered a report on staging but never appeared in the Reports list,
while production was fine. The Reports page reads four materialized views in the
`analytics` schema (`mv_completed_matches`, `mv_goal_scorers`, `mv_player_playing_time`,
`mv_competitions`). The baseline migration creates all four `WITH NO DATA`, and
`refresh_report_views()` refreshes them with `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
Postgres refuses `CONCURRENTLY` on a view that has never been populated, and the
function catches every error with `EXCEPTION WHEN OTHERS THEN RAISE WARNING` — so on
any freshly built database the refresh fails silently and permanently, with nothing
surfaced to the user. Production works only because its views were populated during
the Lovable era. Staging, created 30 August from the baseline, never was.

Unblocked on 4 Sep by running a non-concurrent `REFRESH MATERIALIZED VIEW` on each of
the four; `CONCURRENTLY` succeeds normally afterwards. Still open as a permanent fix: a
migration performing that initial non-concurrent refresh, so any database built from
this repo has working reports — without it a rebuilt production loses Reports
silently. Also consider whether `refresh_report_views()` should surface failures
rather than swallow them.
Relates to ONBOARD-001, ENV-004.

### ENV-005 — Production and staging use different Supabase key formats `OPEN`
**Found:** 31 Aug 2026, while splitting Vercel environment variables (ENV-002)

Production uses the legacy anon JWT keys (the `eyJ...` format); the staging project,
created 30 August, uses the newer `sb_publishable_...` format. Both keys are correct for
their own project and `src/integrations/supabase/client.ts` accepts either — the schema is
identical, only the platform default differs by project age. Recorded so the mismatch
isn't mistaken for a misconfiguration later; no action needed unless the projects are
ever standardised.

### ENV-004 — Staging lacks edge functions and auth hook configuration `OPEN`
**Found:** 31 Aug 2026, while testing a preview deployment.

`supabase db push` applies migrations only. The `auth-email-hook` and `send-email` edge
functions are not deployed to the staging project, and the Auth "send email" hook isn't
configured there, so staging sends Supabase's default auth templates rather than the app's
own. Schema fidelity is good; project-configuration fidelity is not. Deploy the functions
with `supabase functions deploy` and set the hook when staging needs to exercise email
flows.
**Blocked by:** ENV-001 (staging project — DONE 30 Aug 2026).

### ENV-003 — Visible environment banner `DONE`
**Found:** 30 Aug 2026 — `npm run dev:staging` silently served production because
`.env.staging` was missing and Vite fell back to `.env` with no warning; two hours lost.

`src/components/layout/EnvironmentBanner.tsx` renders a thin, fixed, non-dismissible bar
at the top of the viewport reporting the Supabase project the app is *actually* connected
to, derived from the same env values as `src/integrations/supabase/client.ts`
(`VITE_SUPABASE_PROJECT_ID`, else the `VITE_SUPABASE_URL` subdomain) — never from
`import.meta.env.MODE`. Red when a dev server is connected to the production database,
blue for any non-production project, amber when no ref resolves. Renders nothing in the
normal production build. Mounted in `App.tsx` above `BrowserRouter` so it covers every
route including auth pages. Tests in `EnvironmentBanner.test.tsx`.

### ENV-001 — Staging Supabase project `DONE 30 Aug 2026`
Second Supabase project as staging, so schema changes are tested before touching live
match data. Was blocked on DEBT-001 and DEBT-002, both DONE as of Session 8.

Staging project `xszbopufqchbfbqwvqbb` created in West EU (London). Both migrations
applied cleanly via `supabase db push`; `supabase migration list` confirms local and
remote are in sync. `.env.staging` and a `dev:staging` script added; switching between
production and staging confirmed working in both directions. Discovered ONBOARD-001 while
seeding staging. Staging was then seeded end to end with a fake match (club, team,
players, fixture, live match tracked to completion) — the run that produced the UX-003
to UX-006 observations. PR #46.
**Unblocks:** DEBT-003 (RLS and substitution integration tests can now run against a real
non-production database).

### ENV-002 — Move hosting from Lovable to Vercel `DONE 31 Aug 2026`
Free at this scale. Per-branch preview deployments become the test environment at no extra
setup cost. Point `sidelineassist.club` (registered at Namecheap) at Vercel.

Done (PR #54 for the routing fix; hosting/DNS changes made in the Vercel and Namecheap
dashboards):
- Vercel Hobby project created and connected to the GitHub repo.
- Environment variables split so Production uses the production Supabase project while
  Preview and Development use staging — every branch preview is therefore safe against
  live match data.
- `vercel.json` added so client-side routes are served `index.html` rather than 404ing
  (PR #54).
- `sidelineassist.club` and `www` cut over from Lovable at Namecheap: apex is primary,
  `www` redirects to it. Only the two A records changed; all TXT and MX (email) records
  left intact.
- Verified with a full login flow end to end.

DEBT-007 (disconnecting Lovable) is deliberately still `OPEN`: the Lovable deployment is
being kept as a DNS rollback target until 3 September.
**Was blocked by:** DEBT-007 — proceeded ahead of it by design, keeping Lovable live as
rollback.

### PWA-001 — Make the app installable `IN PROGRESS`
Web app manifest, icons, service worker, offline shell. Target for 12 September.

Manifest, icon set and link previews shipped 1 September (PR #57): `manifest.webmanifest`
with name "Sideline Assist" / short name "Sideline", navy theme colour, and both `any` and
`maskable` icons; a full icon set derived from a single 1024px master; a simplified favicon
built from the app icon's "A" element; and a 1200×630 Open Graph card replacing the
Lovable-branded one. Verified live on sidelineassist.club — the manifest serves correctly
and the meta tags are clean.

Outstanding: service worker and offline shell (S11b). That is the change most able to
strand a coach on a stale build mid-match, so it needs a tested update path rather than a
default install. Caching must never cover Supabase responses — the match timer derives
elapsed time from `actual_start_time` read from Postgres, and a cached response would make
the clock lie.


### PWA-002 — Install prompt for non-technical users `OPEN`
iOS only permits web push for PWAs added to the home screen, so "Add to Home Screen" gates
the entire notification feature. Needs a guided install screen that assumes no technical
knowledge. Coaches can be walked through in person; parents cannot.
**Blocks:** PWA-003.

### PWA-003 — Push notifications for parents `OPEN`
Goal and full-time notifications to parents following remotely. Supabase database trigger
on `match_events` → web push.
**Blocked by:** PWA-002.

---

## Onboarding

### ONBOARD-003 — Resend-code button failed silently when rate-limited `DONE 8 Sep 2026`
**Found:** 8 Sep 2026, reviewing the first-sign-in path ahead of the 13 Sep coaches.
Fixed 8 Sep 2026 on `fix/onboard-003-otp-resend-feedback` (PR TBD).

Supabase rate-limits one-time-code requests to roughly one per 30 seconds. In
`src/pages/Auth.tsx`, `handleResendOtp` called `signInWithOtp(otpEmail)` and discarded the
returned error entirely — no destructure, no check, no UI. When the request was refused the
button spun briefly and nothing else happened: no email, no message, no explanation. A user
who couldn't find the email tapped Resend again, got the same silence, and concluded the app
was broken.

The rate limit itself is correct and is unchanged — without it the endpoint is an
email-bombing tool aimed at any address someone types. The defect was purely that nothing
told the user it had been hit.

Compounds with ENV-007: auth emails currently send from Resend's shared sandbox domain, so
they can land in junk. A coach who can't find the email is exactly the person who taps
Resend repeatedly and trips the limit — then gets no feedback.

Relates to ONBOARD-002: with no password-reset flow in the UI, the emailed 6-digit code is
the only recovery route for a user who set a password at signup and forgot it. That route
failing quietly is the difference between "check your junk folder" and a lockout.

Fix (Auth.tsx only, no auth-logic or schema changes):
- `handleResendOtp` now destructures `{ error }` and shows a destructive toast on failure.
  A rate-limit error (`status === 429` or a matching message) gets a plain, actionable
  message — "Wait 30 seconds, then try again — and check your junk folder." Any other error
  shows its own message rather than being swallowed.
- A visible 30-second cooldown, tracked in component state and counted down by an interval
  cleared on unmount. It starts after *any* successful send, including the first one on the
  email step (that request counts against the limit too), so the countdown is already
  running when the user lands on the code-entry step.
- While the cooldown runs the Resend button is disabled and its label shows the wait
  ("Resend in 24s"), so the delay is visible in advance rather than discovered by failure.
- Button relabelled "Resend Link" → "Resend Code" — this flow sends a 6-digit code, not a
  link.

Checks: `tsc --noEmit -p tsconfig.app.json` clean; `npm run lint` unchanged (pre-existing
errors only); vitest — see note; `npm run build` clean. Not tested on a device and not
tested against a live rate-limit response.

### ONBOARD-002 — No password reset flow `OPEN`
**Found:** 4 Sep 2026, while verifying auth after the Lovable disconnect

`useAuth.tsx` exposes `signUp` (with password), `signInWithPassword`, `signInWithOtp`
and `verifyOtp`, so users do set a password at signup — but nothing anywhere in the
codebase calls `resetPasswordForEmail`. A user who forgets their password has no route
back through the UI. Not a lockout, because the emailed OTP code still works, but they
will not know that.

Workaround for the 12 September coaches: brief them to sign in with the email code
rather than a password. This becomes a genuine blocker at parent rollout — forty
parents will forget passwords and most will give up rather than ask.
Relates to ONBOARD-001, PWA-002.

### ONBOARD-001 — First user of a fresh database is permanently stuck as pending `OPEN`
**Found:** 30 Aug 2026, while seeding the new staging project

Approving a registration requires an existing super admin. On a brand-new database there
is no super admin yet, so the first user to register can never be approved through the
app — there's no one with permission to approve them. Production was bootstrapped by hand
via `20260110_set_initial_super_admin.sql`; staging hit the same wall and had to be
unblocked with direct SQL rather than through the app.

Not urgent — both existing databases are already past this point — but it matters if
production is ever rebuilt from scratch, or if the app is offered to a second club with
its own fresh database. Needs either a documented bootstrap step or a proper first-run
path (e.g. the first registered user on an empty `profiles` table is auto-approved as
super admin).

---

## Design

### DESIGN-005 — The five-minute tracker timeout serves two incompatible purposes `OPEN`
**Found:** 7 Sep 2026, reviewing multi-coach safety.

`claim_match_tracking`'s five-minute window is doing two different jobs: recovering a match from
a crashed or closed session, and arbitrating live contention between two coaches who both want
to record. Those want opposite answers. Recovery wants a short window so a match is not stuck.
Contention wants a long one, because the common real case is a pocketed phone at half time, not
an abandoned session.

Tuned for contention it is currently too short — five minutes of silence is normal mid-match
behaviour, not evidence of abandonment.

**Fix shape.** Separate the two. Lengthen the automatic window (fifteen minutes or so) so a
live coach is not displaced by a pocketed phone, and put deliberate take-over behind the
explicit confirmation described in UX-012 rather than behind a timer. Depends on UX-012 and
relates to BUG-013.

### DESIGN-004 — Brand marks are raster with no vector master `OPEN`
Both the app icon and the favicon are 1024px rasters. That is exactly the App Store's
minimum, so there is no headroom, and neither can be resharpened or recoloured cleanly.
The `og-image.png` wordmark is also set in Poppins rather than Archivo. Rework from
vector in the off-season.

### DESIGN-003 — Club-configurable colour palettes `DEFERRED — post-season`
Future requirement: a club sets its own colours, so the app can be themed to a club's
own palette if it is ever offered beyond this club. Not built now, but it constrains how
the Floodlight rollout is done — every colour must come from a semantically named token
(`--action-primary`, not `--amber`), never a hard-coded Tailwind class. The 258 existing
hard-coded classes (DESIGN-002) are the only real obstacle, and removing them is the
same work as adopting Floodlight.
Guardrail for when it is built: club colours drive identity (headers, badges, accents)
only. Functional colours — on-pitch/bench, primary action, destructive — stay fixed or
are contrast-checked against the ground before being accepted, or a club with pale
colours gets an unreadable match screen.
Relates to UX-005 (the 258 hard-coded classes are also the layout-consistency obstacle).
**Blocked by:** DESIGN-002.

### DESIGN-002 — 258 hard-coded colour classes bypass the design tokens `OPEN`
`src/index.css` defines a complete shadcn token set, but 258 Tailwind colour utilities
across the app (116 green, 76 yellow, 66 blue) set colours directly. Until these route
through semantic tokens, a palette change means a find-and-replace rather than editing
one file.

**6 Sep 2026:** the Floodlight palette is currently declared locally inside
`FixedMatchHeader.tsx` and `PlayerTileGrid.tsx` rather than in the shared theme tokens.
That was deliberate for the UX-007 branches, but it means the eventual token migration
now has two extra call sites to reconcile, and every further Floodlight component adds
one.
**Blocks:** DESIGN-003.

### DESIGN-001 — Floodlight adopted as the app's direction `DONE 1 Sep 2026`
Cool light ground (#EEF1F4), deep navy ink (#101724), blue for on-pitch state (#0B5FCC),
amber for the primary action (#F5A524). Chosen for outdoor legibility — a light ground
because dark screens become mirrors in daylight — and because blue/amber survives every
common form of colour vision deficiency. Layout validated at real size on a phone: whole
squad, score, clock, both actions and undo on one screen with no scrolling.
Dark theme remains available for evening fixtures; it is no longer the default.
Full spec, contrast pairs and regeneration steps in `docs/brand/BRAND.md`.

---

## UX

### UX-011 — No confirmation of which match is being tracked `OPEN`
**Found:** 7 Sep 2026, reviewing multi-coach safety before adding two more coaches.

A coach who opens the wrong fixture takes an *unlocked* match and records real events into it.
No amount of tracker locking prevents this — the lock is working correctly and the data is
still wrong. It is also the most likely error in practice: a phone in cold hands, a list of
fixtures, a mis-tap, and by the time anyone notices there are goals and substitutions in
another team's match.

**Fix shape.** A confirmation before the first recordable tap: our team, the opponent, the
date and the kick-off time, large enough to read at a glance in daylight. Cheap, and it
addresses a failure the locking model cannot.

Cheapest and highest-value item in the multi-coach group (UX-011, UX-012, BUG-013, BUG-014,
DESIGN-005). Do this one first.

These five are one group. None is required before 12 Sep 2026 — the two additional coaches
will be tracking different matches, so live contention cannot occur — and the recommended
order is UX-011, UX-012, BUG-013, BUG-014, DESIGN-005.

### UX-012 — Taking over a match from another coach happens silently `OPEN`
**Found:** 7 Sep 2026, same review.

`claim_match_tracking` returns a clear refusal while another coach's `last_activity_at` is
within five minutes. After five minutes it simply succeeds — no confirmation, no indication
that anyone else was ever tracking. The second coach is never told what they are about to do,
and the first learns only when their UI locks out.

**Fix shape.** When the claim would displace a previous tracker, name them and say how long
ago they were last active, and require an explicit confirmation. The RPC already returns
`current_tracker` and `tracking_started_at` on the refusal path; the same information should
be surfaced on the take-over path.

### UX-009 — Match clock shows seconds but only moves once a minute `DONE 6 Sep 2026`
**Found:** 4 Sep 2026, during BUG-001 testing
**File:** `src/pages/EnhancedMatchTracker.tsx`

`EnhancedMatchTracker.tsx` renders `formatTime(currentMinute * 60)` and
`formatTime(totalMatchMinute * 60)` into `FixedMatchHeader`. Both inputs are integer
minutes, so the seconds digits are always `:00` and the display only changes on the
minute roll-over. The timer itself is correct — `useEnhancedMatchTimer` ticks every
1000ms from wall-clock timestamps, and second-level values already exist in
`timerState.currentTime` and `timerState.totalMatchTime` — they are simply never
passed to the header, because `handleTimerUpdate(minute, totalMinute, periodNumber)`
carries minutes only.

**IMPORTANT:** do not fix by converting the existing values. `currentMinute` and
`totalMatchMinute` feed `match_events.minute_in_period` and `total_match_minute`,
which must stay whole minutes. Seconds must be passed alongside, not instead. Solve in
the rebuild rather than patching — the screen has three distinct needs (elapsed time
in the current period, elapsed across the match, whole minutes for event records)
currently conflated into one pair of numbers.

Estimated ~30-45 min standalone. Relates to UX-007.

**Fixed in PR #69** ("feat: rebuild the match header in Floodlight and make the clock
tick"): the header was receiving integer minutes, so the seconds digits were permanently
`:00`. `handleTimerUpdate` now carries second-level values alongside the minutes rather
than instead of them — `currentMinute` and `totalMatchMinute` still feed
`match_events.minute_in_period` and `total_match_minute`, which must stay whole minutes.

### UX-008 — "Restart Match" is a data wipe sitting on the live match screen `DONE 4 Sep 2026`
**Found:** 4 Sep 2026

`restart_match()` deletes all `match_events`, `player_time_logs` and `match_periods`
for the fixture and resets it to `scheduled`. The confirmation dialog is honest about
what it does — the risk is adjacency, not deception. A coach who mis-taps "End Match"
during play will find "Restart Match" the most inviting control right next to it on
screen, and a single confirm away from destroying an irreplaceable match record.

Rename it to something unmistakable (e.g. "Delete Match Data"), or move it off the
live screen entirely into a less-reachable settings/admin path. Minutes of work either
way. Relates to BUG-003, UX-002.

Fixed in PR #63: relabelled "Delete Match Data" with a bin icon, dialog title "Delete
all match data?", confirm "Yes, delete everything". The `restart_match` RPC and
internal identifiers are unchanged, so no migration was needed.

### UX-010 — Guard period and match end against unsubmitted substitutions `DONE 6 Sep 2026`
**Found:** 5 Sep 2026, while designing the staged substitution model (UX-007)

**Done 6 Sep 2026 (UX-007 branch 3, `feat/match-staged-subs`):** `EnhancedMatchControls`
now takes `pendingSubCount` + submit/discard callbacks from `EnhancedMatchTracker` (the
pending stack is not lifted). "End Period" and "End Match" route through
`requestEndPeriod` / `requestEndMatch`: with subs staged they open a controlled
`AlertDialog` that forces Submit-&-end or Discard-&-end — Cancel just keeps tracking,
there is no click-past. If Submit fails mid-batch the dialog stays open (nothing is
ended) and the committed pairs drop off the stack while the rest stay pending.

Staged substitutions do not reach the database until Submit, so a coach who stages a
change and walks away loses it — and the pitch on screen stops matching the pitch in
front of them. The pending panel shows a waiting timer and turns critical at 60 seconds,
but that only nudges.

The guard is what actually prevents the loss: ending a period or ending the match with
substitutions still pending must stop and ask, offering Submit or Discard. It fires at
the exact moment the substitution would otherwise vanish. Roughly 15 lines against the
existing end-period handler.

**Ship in the same branch as the staging model — that model is not safe without it.**
Relates to UX-007, UX-006.

### UX-007 — Match screen rebuild for one-handed touchline use `OPEN`
**Found:** 31 Aug 2026, from the match screen interaction review

**Full design specification: `docs/UX-007-MATCH-SCREEN.md`** — settled 5 September 2026
against an interactive prototype, covering the live-match risk statement, every locked
design decision with its reasoning, the palette addition, and the four-branch split.
Read it before starting any branch.

The live match screen is the only screen that matters under time pressure, and it
currently requires scrolling to find a player and moving between views to record a
substitution. Planned changes: player tiles carrying **first name and minutes played**,
substitution completed on one screen, larger score/clock header, and the event history
collapsed into a pull-up sheet rather than stacked cards.

Two decisions changed during design and supersede the original note. Tiles carry the
player's **first name, not a jersey number** — grassroots shirt numbers are unreliable
week to week, and surnames are kept off a live screen because these are minors.
Substitutions are **staged rather than committed on tap**: a coach stacks several, peels
back the newest with undo, and commits the batch with Submit, stamped at submit time
because a change is often prepared and then held until the referee allows it. Playing
time does not accrue while a substitution is pending.

**Constraint:** the undo affordance must not be a floating card — this is a
mobile-first app and floating windows are being removed entirely (UX-006). Attach undo
to the most recent event row instead, with the countdown rendered as a draining
underline on that row: larger thumb target, no occlusion of the screen underneath, and
it generalises cleanly to substitution undo later.

Target: weekend of 5–6 September. Relates to UX-002, UX-005, DEBT-004.

**Progress:**
- Branch 1 (`feat/match-header-clocks`) — header rebuilt in Floodlight, clocks tick
  seconds (UX-009). Merged #69.
- Branch 2 (`feat/match-player-tiles`) — merged #71, 6 Sep 2026. Active-player list and substitutes
  bench replaced with the adaptive tile grid: new `PlayerTileGrid`
  (`src/components/match/PlayerTileGrid.tsx`) with sizing helper `gridSizeForSquad`
  (`src/lib/matchGrid.ts`, unit-tested). First name + minutes only — no surname, no
  shirt number. Columns/name size derived from combined squad count (2col/1.2rem ≤4,
  3col/1.05rem 5–9, 3col/0.95rem ≥10). Pitch tiles Pitch Blue on white text, bench
  tiles Card white with Edge border, same 80px-min footprint. Palette scoped locally
  to the component (DESIGN-002). Tap behaviour unchanged — bench tile still opens the
  existing substitution dialog; staging is branch 3. `ActivePlayerCard.tsx` is now
  unused (see DEBT note below).
- Branch 3 (`feat/match-staged-subs`) — done 6 Sep 2026. Substitutions are staged, not
  committed on tap: tap a pitch player (amber ring), tap a bench player, and the pair
  joins a pending stack in component state — nothing is written until Submit. New pure
  module `src/lib/pendingSubs.ts` (staging, peel-back order, effective-lineup calc,
  already-staged lockout — unit-tested) with a `usePendingSubs` state wrapper. Staged
  players hold their committed slot (they do not move until Submit — see BUG-006 FIX 6);
  they get a dashed amber border + PENDING tag and are locked out. New `PendingSubsPanel`
  above the action
  bar on Floodlight Navy with an amber top rule: count, a waiting timer for the oldest
  pair, and "Undo last" (pops the newest). At 60s it goes critical — deep red
  (`#B4232C` / `#E5484D`), "NOT SUBMITTED", a ~1.6s breathe (`.pending-critical-breathe`
  in `src/index.css`, static glow under `prefers-reduced-motion`, never a flash). The
  action bar's primary becomes "Submit (N)" in amber while subs are pending; the Submit
  button does not move and gets a static amber halo. Submit reuses the old dialog write
  sequence, extracted to `src/lib/submitSubstitutions.ts` (period resolution,
  `player_time_logs`, `client_event_id`-keyed `match_events` upserts) — stamped at Submit
  time (timestamp minute for events, `floor(currentSeconds/60)` duration for time logs);
  a mid-batch failure surfaces a toast and leaves the rest pending. Panel + Submit gated
  on `active_tracker_id`. Footer scroll padding now derived from a measured footer
  (ResizeObserver) since it grows per pending row. Includes the UX-010 guard (see that
  item). `EnhancedSubstitutionDialog.tsx` now orphaned — DEBT-022.
- Branch 4 (`feat/match-history-sheet`) — pull-up history sheet and undo relocation —
  remains, not started as of 6 Sep 2026.

### UX-001 — Split the parent view from the coach view `OPEN`
Currently one interface with permissions applied. They are different design problems:
coaches record one-handed outdoors under time pressure; parents glance at a score for one
second, often not at the ground. Parent view needs its own route and layout.

### UX-002 — Coach UI touch-target audit `OPEN`
Used one-handed, outdoors, possibly in rain, possibly with gloves, eyes mostly on the
pitch. Minimum 44x44pt targets, thumb-reachable placement, unambiguous tap feedback.
Failure mode is a mis-tap during a goalmouth scramble.

---

## Coach UX observations (30 Aug, from seeding staging)

Raw notes from running the app end to end as a coach would — creating a club, teams and
players and setting up a fixture — while seeding the staging project. Filed as individual
UX items below; continues the `UX-` series.

### UX-003 — Bulk player entry, and distinct flows for roster setup vs. new club player `OPEN`
**Found:** 30 Aug 2026, while seeding staging

Players can only be added one at a time. Setting up a squad this way is slow — there
should be a table/grid entry mode to add a whole squad in one pass.

Underneath that, three flows are currently collapsed into the same one-by-one form and
shouldn't be:
1. Building a team's roster from scratch.
2. Forking a new team from an existing one (carrying players across).
3. Adding a genuinely new player to the club.

(1) and (2) are bulk/selection tasks; only (3) is really "create a new person". Separate
the roster-building UX from the add-a-club-player UX.
Relates to UX-002.

### UX-004 — Views don't refresh after a mutation; likely app-wide `OPEN`
**Found:** 30 Aug 2026, while seeding staging

Creating a team doesn't update the teams list — a manual browser refresh is needed before
the new team appears. Treat this as a pattern audit, not a one-off: the query cache is
probably not being invalidated/refetched after create/update/delete in multiple places.
Go through every create/edit/delete flow in the app and confirm the relevant lists and
detail views update without a reload.

### UX-005 — Inconsistent screen sizing and framing makes the UI look amateur `OPEN`
**Found:** 30 Aug 2026, while seeding staging

Container widths and screen framing vary from page to page. For a market-ready product the
app needs one layout system — consistent max-widths, gutters and framing — so moving
between screens feels like a single continuous interface rather than a set of separately
built pages.
Relates to UX-001, DEBT-004.

### UX-006 — Consider removing modal / floating windows entirely `OPEN`
**Found:** 30 Aug 2026, while seeding staging

Floating dialogs add to the inconsistent feel in UX-005 and are awkward one-handed
outdoors (UX-002). Evaluate replacing them with full-screen routes or inline panels.
This is a design decision that needs making before the layout-consistency work in UX-005,
since it changes the target.

The undo card shipped with the BUG-004 fix (PR #61) is a worked example of the
problem this item is about: a floating card sitting over the live match screen. UX-007
already commits to replacing it with a row-attached affordance instead — treat that as
the reference pattern when deciding what replaces floating dialogs elsewhere.
**Blocks:** UX-005.

---

## Reporting & analytics

### REPORT-001 — Fixtures have no season, so reports cannot be scoped to one `OPEN`
**Found:** 6 Sep 2026

Nothing in the schema knows about seasons; the word does not appear in the baseline.
`analytics.mv_goal_scorers` aggregates every completed fixture for all time, grouped
only by player and club with no date filter, and `mv_player_playing_time` is the same
shape. Once this season has a few matches, top scorers and playing time silently blend
2025/26 with 2026/27 with no way to separate them.

Deriving the season from `scheduled_date` is not sufficient on its own: off-season
tournaments and summer friendlies would be misfiled, and the user needs to be able to
choose. Split into capture and reporting:

- **Capture (this item, time-sensitive)** — fixtures carry a season, defaulted from the
  date on creation and editable by the user, so every fixture is classified correctly
  from the first match of the season rather than backfilled later. ~45–60 min. Open
  decision: a plain text field on `fixtures` (cheapest, but typos fragment the data and
  it would likely be rebuilt as a table later) versus a minimal `seasons` table scoped
  to club (`id`, `club_id`, `name`, start/end dates, `current` flag) with a `season_id`
  on `fixtures`. The table is the better shape if the app is ever offered to other clubs
  or other sports.
- **Reporting** — tracked as REPORT-002.

Relates to REPORT-002, ENV-006.

### REPORT-002 — Season selector on Reports `OPEN`
**Found:** 6 Sep 2026 — deferrable past 12 September.

Add the season dimension to the analytics matviews' `GROUP BY` and a season selector on
the Reports page, defaulting to the current season. ~2–3 hours, mostly the matview
migration and re-verifying the views still populate afterwards (see ENV-006).
**Blocked by:** REPORT-001.

---

## Deferred past 12 September

### NATIVE-001 — iOS via Capacitor and TestFlight `DEFERRED — October`
Capacitor 7 and `ios/App` already scaffolded. Apple Developer account paid, awaiting
confirmation. Note TestFlight builds expire after 90 days and need re-uploading mid-season.
**Blocked by:** DEBT-008.

### NATIVE-002 — Android build `DEFERRED`
After iOS is proven in the field.

### STORE-001 — Public App Store release `DEFERRED`
Not needed. TestFlight covers up to 10,000 testers with no App Review. At ~5 coaches and
~50 users, a public listing has no purpose.

---

## Done

### DONE-001 — `CLAUDE.md` project brief `DONE 20 Aug 2026`
PR #31. Auto-generated by `/init`, then corrected by hand: the generated version had the
Reports routing backwards (`/reports` renders `Reports.tsx`, not `OptimizedReports.tsx`)
and had no project context.

### DONE-002 — Remove orphan pages `DONE 20 Aug 2026`
PR #32. Deleted `MatchTracker.tsx`, `OptimizedDashboard.tsx`, `OptimizedReports.tsx` and
the orphaned `useDashboard.tsx` hook — 786 lines. Surfaced BUG-001 in the process.
