# scripts/

One-off Node/SQL/shell scripts written during past debugging sessions. None of these
are part of the app or a maintained CLI — check they still match the current schema
before rerunning any of them.

## apply-player-time-fix.mjs

Printed instructions (it does not execute SQL itself — the Supabase JS client can't run
raw DDL) for applying a trigger that auto-calculates `player_time_logs.total_period_minutes`.
**Already applied**: the SQL it points to is `supabase/migrations/20251206200418_apply_player_time_trigger.sql`,
which is in the applied migrations directory.

## apply-view-refresh.mjs

Calls the `refresh_report_views()` RPC and checks whether `get_goal_scorers` /
`get_completed_matches` come back empty, as a way to confirm materialized views were
in sync with an emptied database. **Already applied**: the corresponding migration,
`supabase/migrations/20251207_refresh_stale_views.sql`, is in the applied migrations
directory. Diagnostic only — safe to rerun against any environment, has no destructive effect.

## investigate-goals-data.mjs

Read-only diagnostic that dumps `match_events` counts, event-type distribution, and
sample rows to track down where goals/assists data was (or wasn't) being stored during
a data investigation. No lasting effect — safe to rerun anytime for ad hoc debugging.

## verify-rls-policies.mjs

Read-only diagnostic that checks anon-key read access across the core tables
(`clubs`, `teams`, `players`, `fixtures`, `match_events`, `match_periods`,
`player_time_logs`, `player_match_status`) to sanity-check RLS wasn't blocking reads.
No lasting effect — safe to rerun anytime.

## verify-score-calculations.mjs

Read-only diagnostic that cross-checks the `get_goal_scorers` materialized-view RPC
against a direct count from `match_events`, flagging any mismatches. No lasting effect —
safe to rerun anytime, useful if goal/assist totals ever look wrong again.

## quick-test.sh

Dev convenience script — runs a production build (if `dist/` doesn't already exist)
and starts `npm run preview`, falling back to `npm run dev` on build failure. Not
tied to any specific database state; safe to run anytime during development.

## refresh-views-now.sql

Manual SQL (paste into the Supabase SQL editor) that runs `REFRESH MATERIALIZED VIEW`
on all four `analytics.mv_*` views and reports row counts. This is an operational
maintenance script, not a one-time migration — safe to rerun whenever the materialized
views need a manual refresh outside of the normal `refresh_report_views()` RPC path.
