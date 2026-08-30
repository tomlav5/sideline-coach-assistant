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

## Performance

### PERF-001 — xlsx library bundled into the Reports page `OPEN`
Reports chunk is 310 kB (101 kB gzipped), the largest in the build, driven by the
SheetJS xlsx dependency used only by ExportDialog. Convert to a dynamic import so it
loads on export rather than on page view. Matters most for parents on mobile data.
Relates to UX-001.

---

## Technical debt

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

Remaining: RLS enforcement (a parent must not be able to write to `match_events`) and
the substitution integration path (one `player_time_logs` row closes as another opens).
Both need a real database rather than mocks, so they follow staging.
**Blocked by:** ENV-001.

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

### ENV-001 — Staging Supabase project `IN PROGRESS`
Second Supabase project as staging, so schema changes are tested before touching live
match data. No longer blocked — DEBT-001 and DEBT-002 are both DONE as of Session 8.

Staging project `xszbopufqchbfbqwvqbb` created in West EU (London). Both migrations
applied cleanly via `supabase db push`; `supabase migration list` confirms local and
remote are in sync. `.env.staging` and a `dev:staging` script added locally; switching
between production and staging confirmed working in both directions. Discovered
ONBOARD-001 while seeding staging.

Remaining: seed staging with a fake match, then commit. **30 Aug 2026.**

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

## Onboarding

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
