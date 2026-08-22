# Backlog

Known issues and planned work. Newest findings at the top of each section.

**Status key:** `OPEN` · `IN PROGRESS` · `DONE` · `DEFERRED`

---

## Bugs

### BUG-001 — Broken navigation in MatchReport `OPEN`
**Found:** 20 Aug 2026, during orphan-page cleanup
**File:** `src/pages/MatchReport.tsx:332`

Calls `navigate('/match-tracker/${fixtureId}')`. No such route exists in `App.tsx` — the
live route is `/match-day/:fixtureId`. Any user tapping this control lands on the 404 page.

Predates the Session 1 cleanup; the route has never matched.

**Before fixing, decide what the control is *for*.** If it's meant to reopen a completed
match for further tracking, that's a design question, not a typo — reopening a completed
fixture has implications for `match_state`, the `status` enum, and the materialized report
views. If it's just a stale link, it's a one-word change.

**Branch:** `fix/match-report-navigation`

---

## Technical debt

### DEBT-001 — `.env` committed to the repository `DONE 20 Aug 2026`
Untracked via `git rm --cached`; `.gitignore` updated; `.env.example` added. PR #33.
Keys were the Supabase URL, project ID and publishable key — public by design, so no
rotation required. Motivation was environment separation, not secrecy.

### DEBT-002 — Schema drift between git and production `IN PROGRESS`
`supabase db pull` cannot run: remote `schema_migrations` records ~70 Lovable-era
migrations (20250829–20250929) with no local files, and none of the 17 local migrations
are recorded remotely — the two histories have fully diverged and cannot be reconciled by
the CLI. Worked around by dumping the live schema directly
(`supabase/production_schema.sql`, via `supabase db dump`) and diffing it against
`supabase/migrations/` by hand — see `docs/SCHEMA_BASELINE.md` for the full comparison.
Confirmed: the schema in git was *not* the schema in production (`profiles.email` still
exists despite a migration removing it, `get_player_playing_time_v3` doesn't exist despite
being the client's first-choice RPC, `email_queue`/`email_send_log` exist in prod with no
local migration at all). Remaining work is deciding a go-forward strategy — see DEBT-012 —
not just establishing the baseline, which is now done.
**Blocks:** ENV-001. **Session 5.**

### DEBT-003 — No test suite `OPEN`
No vitest, no Playwright, no `test` script. 31,000 lines, going live 12 September.
Six critical-path tests planned — see Session 6.
**Session 6.**

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

### DEBT-011 — Migration filenames don't follow Supabase convention `OPEN`
15 of 17 migrations use 8-digit date prefixes (`20251012_name.sql`) rather than Supabase's
expected 14-digit timestamp (`YYYYMMDDHHMMSS_name.sql`). Confirmed by the schema baseline
(`docs/SCHEMA_BASELINE.md` §6): three date prefixes are each reused across multiple files
(`20251012` ×4, `20251208` ×4, `20260110` ×3). Since the CLI keys its migration history by
that prefix, this isn't just a style issue — a future `supabase db push` against a project
tracking these files would collide on the reused version and abort partway. Do not rename
anything until the DEBT-012 strategy decision is made, since renaming changes the versions
the (currently nonexistent, locally) migration history would key on.

### DEBT-012 — Decide the go-forward migration strategy `OPEN`
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
`supabase/cloud_full.sql` is confirmed stale either way (missing 5 tables, no `analytics`
schema, a different `get_player_playing_time()` signature than anything in production) and
is safe to delete regardless of which option is chosen.
**Blocks:** DEBT-002, ENV-001.

### DEBT-013 — `get_player_playing_time_v3` doesn't exist in production `OPEN`
The client (`src/hooks/useReports.tsx:147`) calls `get_player_playing_time_v3` first on
every reports page load and only falls back to `v2` in the `catch` block. `v3` was never
deployed (`docs/SCHEMA_BASELINE.md` §3) — every load silently eats a failed RPC round-trip.
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
**Blocks on:** DEBT-012.

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

### DEBT-007 — Lovable bidirectional sync still active `OPEN`
Pushes to this repo sync to Lovable and vice versa. Now that development happens through
Claude Code, two tools have write access to the same branch with no awareness of each
other. Treat Lovable as read-only immediately; disconnect properly when moving to Vercel.
**Blocks:** ENV-002.

### DEBT-008 — Capacitor `appId` is a placeholder `OPEN`
`capacitor.config.ts` has `appId: 'com.yourorg.sidelinecoach'`. This becomes the permanent
App Store bundle identifier and **cannot be changed after first submission**. Set before
any TestFlight build.
**Blocks:** NATIVE-001.

### DEBT-009 — Committing directly to `main`, uninformative commit messages `OPEN`
Several recent commits are named "Changes". Enable branch protection requiring a PR.
**Session 7.**

---

## Environments & delivery

### ENV-001 — Staging Supabase project `OPEN`
Second Supabase project as staging, so schema changes are tested before touching live
match data.
**Blocked by:** DEBT-001, DEBT-002.

### ENV-002 — Move hosting from Lovable to Vercel `OPEN`
Free at this scale. Per-branch preview deployments become the test environment at no extra
setup cost. Point `sideline.assist` (registered at Namecheap) at Vercel.
**Blocked by:** DEBT-007.

### PWA-001 — Make the app installable `OPEN`
Web app manifest, icons, service worker, offline shell. Target for 12 September.

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

## UX

### UX-001 — Split the parent view from the coach view `OPEN`
Currently one interface with permissions applied. They are different design problems:
coaches record one-handed outdoors under time pressure; parents glance at a score for one
second, often not at the ground. Parent view needs its own route and layout.

### UX-002 — Coach UI touch-target audit `OPEN`
Used one-handed, outdoors, possibly in rain, possibly with gloves, eyes mostly on the
pitch. Minimum 44x44pt targets, thumb-reachable placement, unambiguous tap feedback.
Failure mode is a mis-tap during a goalmouth scramble.

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
