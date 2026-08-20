# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Sideline Coach Assistant — a React/Vite web app (also packaged for iOS via Capacitor) for grassroots football/soccer coaches to manage teams, players, fixtures, and live match tracking (timers, substitutions, goals, player playing-time). Backend is entirely Supabase (Postgres + RLS + edge functions). The project originates from and is still edited via **Lovable** (lovable.dev) — pushes from this repo sync back to the Lovable project, and vice versa, so be aware changes here may be overwritten by Lovable-side edits and vice versa.

## Commands

```sh
npm run dev        # start Vite dev server on port 8080
npm run build       # production build
npm run build:dev   # development-mode build (unminified, used for staging-style builds)
npm run preview     # preview a production build locally
npm run lint         # eslint over the whole repo
```

There is no test framework configured (no Jest/Vitest/etc. in `package.json`) — do not assume `npm test` works, and don't add tests unless asked.

Package manager: `npm` (package-lock.json is authoritative); `bun.lock`/`bun.lockb`/`deno.lock` also exist in the repo but npm/Vite is the actual dev workflow.

### Supabase

- Project is managed via the Supabase CLI (`supabase/config.toml`, project id `crmlmnhillnnrnrxqera`).
- Migrations live in `supabase/migrations/` (applied) — apply new ones with `supabase db push` or via the Supabase dashboard SQL editor. `supabase/migrations-disabled/` holds an old/superseded migration history kept for reference only; don't run those.
- `src/integrations/supabase/types.ts` is generated (`supabase gen types typescript`) — don't hand-edit; regenerate after schema changes.
- Two edge functions in `supabase/functions/`: `auth-email-hook` (customizes auth emails — magic link, OTP, invite, recovery, etc. from `_shared/email-templates/*.tsx`) and `send-email`. Redeploy after changing templates.
- Env vars (see `.env`): `VITE_SUPABASE_URL`/`VITE_SUPABASE_PROJECT_ID` and `VITE_SUPABASE_ANON_KEY`/`VITE_SUPABASE_PUBLISHABLE_KEY` — `src/integrations/supabase/client.ts` accepts either pair and derives the URL from the project ID if needed.

## Architecture

### Routing & layout
`src/App.tsx` defines all routes with `react-router-dom`, lazy-loading every page. Most routes are wrapped in `Layout` (sidebar nav, `src/components/layout/`); auth-related routes (`/auth`, `/auth/callback`, `/invite/:token`, `/pending-approval`, `/registration-success`) are not. `AuthProvider` (`src/hooks/useAuth.tsx`) wraps the whole router.

Several pages have both a plain and "Optimized" variant (`Index`/`OptimizedIndex`, `Dashboard`/`OptimizedDashboard`, `Reports`/`OptimizedReports`) — the app currently routes through the Optimized versions; the non-optimized ones may be legacy/unused. Check `App.tsx` before assuming a page is live.

### Auth
Email OTP / magic-link based (`useAuth.tsx`, backed by `supabase.auth.signInWithOtp` / `verifyOtp`), plus password auth as a fallback. Supabase sends both a magic link and a 6-digit code in the same email; `src/pages/Auth.tsx` surfaces both. New users typically go through an approval flow (`PendingApproval`, `AdminApprovals`, `AcceptInvitation` for club invites) — club membership/roles are enforced through RLS, not just UI checks.

### Domain model
Core entities: **clubs → teams → players**, and **fixtures** (scheduled matches) tracked against a team. A fixture progresses through a squad-selection step (`SquadSelection.tsx`) before match tracking begins.

### Live match tracking (the most complex part of the codebase)
`EnhancedMatchTracker.tsx` (the live "match day" screen, ~1400 lines) drives the whole flow through several cooperating hooks:

- **`useEnhancedMatchTimer`** — server-authoritative timer. Match time is *derived from wall-clock timestamps* stored in `match_periods` (`actual_start_time`, `pause_time`, `total_paused_seconds`, `actual_end_time`), not from a client-side counter, so it stays correct across refresh/backgrounding/multiple devices. It re-syncs from the DB on tab visibility change and periodically (every 30s) while running, to correct drift. A fixture has a JSON `match_state` snapshot column *and* a normalized `status`/`match_status` enum column that are kept in sync — always update both when changing match state directly in SQL/RPC.
- **`usePlayerTimers`** — tracks individual player time-on-pitch, backed by `player_time_logs` rows keyed by match period. Player time calculation has been a recurring source of bugs (see migrations named `*fix_player_time_calc*`, `*get_player_playing_time_v2/v3*`, `*apply_player_time_trigger*`) — when touching this, check `player_time_logs.is_active`/`time_off_minute` semantics and the corresponding SQL functions/triggers in `supabase/migrations/`, not just the client hook.
- **`useRealtimeMatchSync`** — single-tracker-at-a-time coordination via `fixtures.active_tracker_id`, claimed/released through `claim_match_tracking`/`release_match_tracking`/`update_tracking_activity` RPCs, with a 30s heartbeat, plus Supabase Realtime subscriptions on `fixtures`, `match_events`, `match_periods`, and `player_match_status` so a second viewer sees live updates (and gets kicked out if another user claims tracking).
- **`useMatchStorage`** + `matchStorageCleanup.ts` — offline/resilience layer: match state is mirrored to `localStorage` under `match_<fixtureId>` for recovery after a crash/reload, with expiry (12h) and cleanup of orphaned/completed entries scheduled from `App.tsx` on load.
- **`useUndoStack`** and `useOptimisticUpdate` — support undo of recent match events and optimistic UI updates while writes are in flight.
- **`useAutoSave`**, **`useSmartSuggestions`**, **`useLiveMatchDetection`**, **`useKeyboardShortcuts`**, **`useWakeLock`** — supporting concerns for the same screen (autosave, suggested actions, detecting a match already in progress, keyboard shortcuts, keeping the screen awake during a live match).

Ending a match (`endMatch`) sets the fixture to `completed`, clears tracker/localStorage state, and calls the `refresh_report_views` RPC to refresh materialized views used by reports — if you add new report data, make sure it's covered by that refresh path (see `supabase/migrations/2025120*_*materialized_views*` and `*refresh_stale_views*`/`*update_refresh_function*`).

### Post-match editing & reporting
`MatchDataEditor.tsx` + `useEditMatchData.tsx` allow retrospective correction of a completed match's periods/events/player-times (components in `src/components/match-editor/`), including a `ValidationPanel` for sanity-checking edits. `Reports.tsx`/`OptimizedReports.tsx` and `MatchReport.tsx` read from the materialized views / `get_player_playing_time` RPC family rather than raw event tables, for performance.

### UI layer
shadcn/ui components (Radix primitives + Tailwind) live in `src/components/ui/` — treat these as generated/vendored; prefer composing them over editing, unless fixing a genuine bug. Path alias `@/*` maps to `src/*` (configured in `tsconfig*.json` and `vite.config.ts`).

## Notes on repo hygiene

- The repo root has many historical `*.md` investigation/fix-summary/PR-description files (e.g. `BUGFIX_*.md`, `PLAYER_TIME_TRACKING_*.md`, `PHASE_*.md`). These are point-in-time notes from past debugging sessions, not living documentation — useful as archaeology for *why* a particular SQL migration or workaround exists, but don't treat them as current instructions, and don't add new ones for routine work.
- Several one-off `.mjs`/`.sql` scripts at the repo root (`apply-*.mjs`, `investigate-*.mjs`, `verify-*.mjs`, `refresh-views-now.sql`, `quick-test.sh`) were ad hoc debugging/migration-verification tools, not part of the app or a maintained CLI — don't assume they still run against current schema without checking.

---

# Verified project context (August 2026)

**Anything in this section overrides the sections above.** It was written by the project
owner and verified against the live codebase, not inferred.

## What this project is for

Grassroots youth football club. Coaches record match events live from the touchline;
parents follow scores remotely, often without attending. Season starts **12 September 2026**.
Scale: ~5 active coaches, ~50 total users, mostly occasional parent viewers.

## Delivery target

Shipping as an **installable PWA hosted on Vercel** for the 12 September season start.
Capacitor 7 and the `ios/` project are scaffolded but deliberately **not** part of the
September scope — do not modify them without being asked. Native iOS via TestFlight is an
October project.

## Critical rules

- **The match timer must stay timestamp-derived.** Elapsed time = `now - actual_start_time`
  minus `total_paused_seconds`, read from `match_periods`. Never convert it to a
  client-side tick counter — it breaks the moment iOS suspends the app.
- **Match data is irreplaceable.** A match happens once. Never write a code path that can
  silently drop or overwrite rows in `match_events`, `player_time_logs` or `match_periods`.
- **Coach UI is used one-handed, outdoors, in bad weather, while watching the pitch.**
  Minimum 44x44pt touch targets. Destructive actions always confirm.
- **Parent UI is glanceable and read-only.** Score and recent events legible in under a
  second. It is a separate design problem from the coach UI, not the coach UI with buttons
  hidden.
- **All tables use RLS.** Any new table needs policies before it ships.
- **npm only.** Never bun or yarn.

## Corrections to the auto-generated sections above

1. **Dead pages.** `src/pages/MatchTracker.tsx`, `OptimizedDashboard.tsx` and
   `OptimizedReports.tsx` are confirmed dead. `MatchTracker` is lazy-imported in `App.tsx`
   but no `<Route>` renders it; the other two are not imported anywhere. The live pages are
   `OptimizedIndex` (routed as `/`), `Reports` (routed as `/reports` — **not**
   `OptimizedReports`), and `EnhancedMatchTracker` (routed as `/match-day/:fixtureId`).
2. **`.env` is committed to this repository** and is not in `.gitignore`. It holds only the
   Supabase URL, project ID and publishable key — public by design — but it must be
   untracked before staging and production can point at different Supabase projects.
3. **The `.env` file uses `VITE_SUPABASE_PUBLISHABLE_KEY`**, not `VITE_SUPABASE_ANON_KEY`.
   `client.ts` accepts either.
4. **Tests are being added.** The instruction above to not add tests is superseded: vitest
   plus a small critical-path suite is planned for this repo. Do not remove test scaffolding.

## Working agreement

- Work on a feature branch, never directly on `main`.
- One task per session.
- When a change touches match recording, say explicitly what could go wrong at a live match
  before writing code.
