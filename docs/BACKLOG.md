# Backlog

Known issues and planned work. Newest findings at the top of each section.

**Status key:** `OPEN` · `IN PROGRESS` · `DONE` · `DEFERRED`

---

## Bugs

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

### BUG-001 — Broken navigation in MatchReport `OPEN`
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

Kept open on purpose after ENV-002 (Vercel cutover, DONE 31 Aug 2026): the Lovable
deployment is retained as a DNS rollback target until 3 September. Disconnect after that.
**Blocked ENV-002** (now DONE — proceeded ahead, keeping Lovable live as rollback).

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

### DESIGN-001 — Floodlight adopted as the app's direction `DONE 1 Sep 2026`
Cool light ground (#EEF1F4), deep navy ink (#101724), blue for on-pitch state (#0B5FCC),
amber for the primary action (#F5A524). Chosen for outdoor legibility — a light ground
because dark screens become mirrors in daylight — and because blue/amber survives every
common form of colour vision deficiency. Layout validated at real size on a phone: whole
squad, score, clock, both actions and undo on one screen with no scrolling.
Dark theme remains available for evening fixtures; it is no longer the default.

### DESIGN-002 — Club-configurable palette `DEFERRED — post-season`
Future requirement: a club sets its own colours. Not built now, but it constrains how the
Floodlight rollout is done — every colour must come from a semantically named token
(--action-primary, not --amber), never a hard-coded Tailwind class. The 258 existing
hard-coded classes are the only real obstacle, and removing them is the same work as
adopting Floodlight.
Guardrail for when it is built: club colours drive identity (headers, badges, accents)
only. Functional colours — on-pitch/bench, primary action, destructive — stay fixed or
are contrast-checked against the ground before being accepted, or a club with pale
colours gets an unreadable match screen.
Relates to UX-005 (the 258 hard-coded classes are also the layout-consistency obstacle).

---

## UX

### UX-008 — "Restart Match" is a data wipe sitting on the live match screen `OPEN`
**Found:** 4 Sep 2026

`restart_match()` deletes all `match_events`, `player_time_logs` and `match_periods`
for the fixture and resets it to `scheduled`. The confirmation dialog is honest about
what it does — the risk is adjacency, not deception. A coach who mis-taps "End Match"
during play will find "Restart Match" the most inviting control right next to it on
screen, and a single confirm away from destroying an irreplaceable match record.

Rename it to something unmistakable (e.g. "Delete Match Data"), or move it off the
live screen entirely into a less-reachable settings/admin path. Minutes of work either
way. Relates to BUG-003, UX-002.

### UX-007 — Match screen rebuild for one-handed touchline use `OPEN`
**Found:** 31 Aug 2026, from the match screen interaction review

The live match screen is the only screen that matters under time pressure, and it
currently requires scrolling to find a player and moving between views to record a
substitution. Planned changes: jersey-number tiles instead of a name list, substitution
completed on one screen, larger score/clock header, and the event history collapsed into
a pull-up sheet rather than stacked cards.

**Constraint:** the undo affordance must not be a floating card — this is a
mobile-first app and floating windows are being removed entirely (UX-006). Attach undo
to the most recent event row instead, with the countdown rendered as a draining
underline on that row: larger thumb target, no occlusion of the screen underneath, and
it generalises cleanly to substitution undo later.

Target: weekend of 5–6 September. Relates to UX-002, UX-005, DEBT-004.

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

## Design

### DESIGN-004 — Brand marks are raster with no vector master `OPEN`
Both the app icon and the favicon are 1024px rasters. That is exactly the App Store's
minimum, so there is no headroom, and neither can be resharpened or recoloured cleanly.
The `og-image.png` wordmark is also set in Poppins rather than Archivo. Rework from
vector in the off-season.

### DESIGN-003 — Club-configurable colour palettes `DEFERRED`
So the app can be themed to a club's own colours if it's ever offered beyond this club.
Requires semantic token names (`--action-primary`, not `--amber`) throughout.
**Blocked by:** DESIGN-002.

### DESIGN-002 — 258 hard-coded colour classes bypass the design tokens `OPEN`
`src/index.css` defines a complete shadcn token set, but 258 Tailwind colour utilities
across the app (116 green, 76 yellow, 66 blue) set colours directly. Until these route
through semantic tokens, a palette change means a find-and-replace rather than editing
one file.
**Blocks:** DESIGN-003.

### DESIGN-001 — Floodlight palette adopted `DONE 1 Sep 2026`
Navy `#101724`, Signal Amber `#F5A524`, Pitch Blue `#0B5FCC`, with Paper/Card/Slate/Edge
neutrals. Chosen for outdoor legibility over the previous dark green. Preferred pairing
is amber on navy (8.8:1). Full spec, contrast pairs and regeneration steps in
`docs/brand/BRAND.md`.

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
