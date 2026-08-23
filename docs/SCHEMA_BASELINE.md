# Schema Baseline (August 2026)

Comparison of `supabase/migrations/20260824000408_baseline.sql` (a `supabase db dump` taken directly against
the live database — authoritative for what production actually contains) against
`supabase/migrations/` (17 files, the tracked local migration history).

**Context:** `supabase db pull` could not run — the remote `supabase_migrations.schema_migrations`
table records ~70 Lovable-era migrations (20250829–20250929) that have no local `.sql` files,
and none of the 17 local migrations are recorded in that remote history. The two histories have
fully diverged. This document works entirely from static file comparison — grepping table/function/policy
definitions in the dump against the migration files — not from any live query. Nothing here was
inferred from naming or intent; every claim below is either a direct match/mismatch of SQL text,
or marked **unknown**.

---

## 1. Production tables (16) vs local migration coverage

| Table | Created by a local migration? | Notes |
|---|---|---|
| `fixtures` | No — only in `migrations-disabled/` | Core table, base schema |
| `clubs` | No — only in `migrations-disabled/` | Core table |
| `match_events` | No — only in `migrations-disabled/` | Core table; later migrations `ALTER` it |
| `teams` | No — only in `migrations-disabled/` | Core table |
| `players` | No — only in `migrations-disabled/` | Core table |
| `match_periods` | No — only in `migrations-disabled/` | Core table |
| `player_time_logs` | No — only in `migrations-disabled/` | Core table |
| `club_members` | No — only in `migrations-disabled/` | Core table |
| `profiles` | No — only in `migrations-disabled/` | Core table; see §2 for the `email` column drift |
| `team_players` | No — only in `migrations-disabled/` | Core table |
| `player_match_status` | No — only in `migrations-disabled/` | Core table |
| `admin_notifications` | **Yes** — `20260110_registration_system.sql` | |
| `club_invitations` | **Yes** — `20260110_registration_system.sql` | |
| `pending_registrations` | **Yes** — `20260110_registration_system.sql` | |
| `email_queue` | **No — not in any local file, including `migrations-disabled/`** | See below |
| `email_send_log` | **No — not in any local file, including `migrations-disabled/`** | See below |

**Key finding:** the 17 active migrations in `supabase/migrations/` contain **zero**
`CREATE TABLE` statements for the 11 core/base tables (`fixtures`, `clubs`, `match_events`,
`teams`, `players`, `match_periods`, `player_time_logs`, `club_members`, `profiles`,
`team_players`, `player_match_status`). They only exist in `supabase/migrations-disabled/`
(specifically `20250829212815_*.sql`, which has 9 `CREATE TABLE` statements, and
`20250913220229_*.sql`, which has 4 more). The active migrations folder is not
self-sufficient to rebuild the schema from scratch — it assumes a base schema that today
only lives in the "disabled, reference only" folder. This matters directly for §7.

**`email_queue` and `email_send_log` have no local migration at all**, disabled folder
included. Production's `email_queue` carries the comment `'Queue for async email
processing via Lovable email service'` — consistent with these tables having been created
directly against production by Lovable's own sync (see `CLAUDE.md`'s note on bidirectional
Lovable sync, and backlog item DEBT-007), not through anything ever committed to this repo.
Both tables are live and in use: `supabase/functions/auth-email-hook/index.ts:253` calls
the `enqueue_email` RPC, which inserts into `email_queue` (function body confirmed present
in the dump, `20260824000408_baseline.sql:566`).

---

## 2. Local migrations with no effect visible in production

The dump is schema-only (`grep -c "^COPY \|^INSERT INTO"` → 0), so only *schema-level*
traces (tables, columns, constraints, function bodies, comments, grants) are checkable.
Pure data migrations are marked unknown where no schema trace exists.

| Migration | Verified against production | Applied? |
|---|---|---|
| `20250110_add_penalties_period_type.sql` | `period_type` enum contains `'penalties'` (`20260824000408_baseline.sql:111-114`) | **Yes** |
| `20251012_cleanup_client_event_id_constraint.sql` | `match_events_client_event_id_key` UNIQUE constraint exists (`:1975`) | **Yes** |
| `20251012_fix_player_time_calc.sql` | `get_player_playing_time()` exists in production | **Yes** (see §3 — but its logic doesn't match the RPC the app actually calls) |
| `20251012_get_player_playing_time_v2.sql` | Function body in production is byte-for-byte identical | **Yes** |
| `20251012_get_player_playing_time_v3.sql` | **No `get_player_playing_time_v3` function anywhere in the dump** | **No — never applied** (critical, see §3) |
| `20251115_remove_email_from_profiles.sql` | `profiles.email` column **still exists** in production; `handle_new_user()` in production **still inserts** `email` (`:1014-1020`); production still `GRANT ALL ON profiles TO anon` and `TO authenticated` (`:3353-3354`), the exact broad grant this migration tried to revoke | **No — never applied**, beyond its Step 1 (creating `find_user_by_email`), which was itself immediately superseded (see next row) |
| `20251206200418_apply_player_time_trigger.sql` | `calculate_total_period_minutes()` trigger function present | **Yes** |
| `20251207_refresh_stale_views.sql` | Pure `REFRESH MATERIALIZED VIEW` statements, no schema trace | **Unknown** |
| `20251208_create_analytics_schema.sql` | `analytics` schema exists | **Yes** |
| `20251208_create_materialized_views.sql` | Superseded in part by the next migration (see below) | **Yes**, with the fix layered on top |
| `20251208_fix_completed_matches_view.sql` | Production's `mv_completed_matches` has the `id`/`location`/`fixture_type` columns this migration adds | **Yes** |
| `20251208_update_refresh_function.sql` | Production's `refresh_report_views()` body is byte-for-byte identical | **Yes** |
| `20251213021656_6924d2cb-*.sql` | Production's `find_user_by_email()` body is byte-for-byte identical to *this* version, not the `20251115` version | **Yes** — this is the version actually live |
| `20260110_add_super_admin.sql` | `is_super_admin()` function, `profiles.is_super_admin` column present | **Yes** |
| `20260110_registration_system.sql` | `pending_registrations`, `club_invitations`, `admin_notifications` tables present | **Yes** |
| `20260110_set_initial_super_admin.sql` | Production's `COMMENT ON COLUMN profiles.is_super_admin` reads exactly `'Initial super admin set via migration 20260110_set_initial_super_admin'` — the literal string this migration sets, overwriting the comment `add_super_admin.sql` had set | **Yes** (comment text is a reliable schema-level fingerprint here even though the actual `UPDATE` it performs isn't otherwise checkable from a schema-only dump) |
| `20260131_fix_rogue_assist_events.sql` | **Does not match production at all** — see below | **No — never applied, and would be actively harmful if it were** |

### `20260131_fix_rogue_assist_events.sql` — do not apply as-is

This migration rewrites `match_events_event_type_check` to
`CHECK (event_type = ANY (ARRAY['goal', 'substitution']))`. Production's actual constraint
(`20260824000408_baseline.sql:1558`) is
`CHECK (event_type = ANY (ARRAY['goal', 'assist', 'substitution_on', 'substitution_off']))`
— confirming this migration never ran — but also revealing the migration itself is now
**wrong relative to the live app**. The client
(`src/pages/EnhancedMatchTracker.tsx:1235,1253`) inserts `event_type: 'substitution_on'`
and `'substitution_off'`, not `'substitution'`. If this migration were applied today, every
substitution recorded live at a match would violate the CHECK constraint and fail to
insert. Given `CLAUDE.md`'s rule that match data is irreplaceable, this migration needs to
be rewritten (matching the constraint already in production) before it's ever run, not
just applied.

Separately: this migration's purpose was to `DELETE FROM match_events WHERE event_type =
'assist'` to clean up rogue standalone assist rows from a UI bug. Since the migration never
ran, and production's constraint still permits `'assist'` as a value, **any such rogue rows
from before 2026-01-31 are still in production** (unknown — not verifiable from a
schema-only dump; would need a live `SELECT count(*) FROM match_events WHERE event_type =
'assist'`). This directly affects goal/assist reporting accuracy (`mv_goal_scorers`, §5).

---

## 3. Player playing time: which calculation is actually live

Production has three independent implementations of "minutes played," and they use
**different data sources for the same edge case** (a player never subbed off):

1. **`get_player_playing_time()`** (v1) and **`get_player_playing_time_v2()`** — bodies are
   byte-for-byte identical in production (both cap open-ended minutes using
   `player_time_logs.total_period_minutes`, a stored/trigger-maintained column).
2. **`get_player_playing_time_v3()`** — defined only in
   `supabase/migrations/20251012_get_player_playing_time_v3.sql`. **Does not exist in
   production.** It caps open-ended minutes using `match_periods.planned_duration_minutes`
   instead.
3. **`analytics.mv_player_playing_time`** — a third, separate calculation, computed
   directly from `player_time_logs` joined to `match_periods`, also capping on
   `mp.planned_duration_minutes` (same idea as v3, different SQL, not the same function).

**What the client actually does** (`src/hooks/useReports.tsx:144-154`): it calls `v3` first,
and only on error falls back to `v2`. Since `v3` doesn't exist in production, **every
report load throws a "function does not exist" error internally and silently falls back**
to `get_player_playing_time_v2()`. This works today only because the `catch` block masks
the failure — but it means production is one Supabase migration/type-regen away from this
silently changing behavior, and every single reports page load pays for a failed RPC
round-trip first.

`analytics.mv_player_playing_time` is refreshed by `refresh_report_views()` (§5) and
granted `SELECT` to `authenticated` (`20260824000408_baseline.sql:3301`), but **no client code
reads from it** (`grep -rn "mv_player_playing_time" src/` → no results). It's maintained
for no consumer, computed with yet a third formula that would disagree with `v2` for any
player who was never substituted off in a period whose logged `total_period_minutes`
diverges from the period's `planned_duration_minutes`.

**Recommendation implied by the evidence (not yet acted on):** decide on one
implementation. `v3`/the materialized view's "cap on planned period duration" approach is
arguably more correct (it doesn't depend on `total_period_minutes` staying in sync via
trigger), but it was never deployed and the client's silent fallback means nobody has
noticed it's missing.

---

## 4. RLS status per table

All 16 tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in production
(`20260824000408_baseline.sql:2763-2808`). One-line summary of what each table's policies allow:

| Table | Policies allow |
|---|---|
| `clubs` | Any authenticated user can `INSERT` a club (`WITH CHECK (true)` — see note below); members can `SELECT` their clubs; admins can `UPDATE`. No `DELETE` policy. |
| `club_members` | Club admins can `INSERT`/`UPDATE`/`DELETE` memberships and approve officials; a user can always `SELECT` their own membership rows or any membership in a club they belong to. |
| `club_invitations` | Club admins can `INSERT`; a user can `SELECT` invitations addressed to their own email or that they created. No `UPDATE`/`DELETE` policy — acceptance goes through the `accept_club_invitation()` `SECURITY DEFINER` RPC instead. |
| `teams` | Club admins/officials can `INSERT`/`UPDATE`; admins can `DELETE`; club members can `SELECT`. |
| `players` | Club admins/officials can `INSERT`/`UPDATE`; admins can `DELETE`; club members can `SELECT`. |
| `team_players` | Club officials can `INSERT`/`UPDATE`/`DELETE` assignments; club members can `SELECT`. |
| `fixtures` | Club officials can `INSERT`/`UPDATE`; admins can `DELETE`; club members can `SELECT`. |
| `match_events` | One combined policy: club officials can do anything (`INSERT`/`UPDATE`/`DELETE`/`SELECT`); a second, redundant `SELECT` policy for club members generally. |
| `match_periods` | Same pattern as `match_events`. |
| `player_time_logs` | Same pattern as `match_events`. |
| `player_match_status` | Same pattern as `match_events`. |
| `profiles` | A user can `INSERT`/`UPDATE`/`SELECT` only their own row (`auth.uid() = user_id`). No policy allowing one user to view another's profile directly — cross-user lookups go through `find_user_by_email()` (`SECURITY DEFINER`). Note: the table-level `GRANT` is still `ALL` to `anon` and `authenticated` (§2) — RLS still gates actual row access, but the broad grant is stale relative to what `20251115_remove_email_from_profiles.sql` intended. |
| `admin_notifications` | Only super admins can `SELECT`/`UPDATE` (`is_super_admin()`). No `INSERT`/`DELETE` policy — rows must be inserted by a `SECURITY DEFINER` function/trigger. |
| `pending_registrations` | Only super admins can `SELECT`/`UPDATE`. No `INSERT` policy — populated by the `create_pending_registration()` trigger (`SECURITY DEFINER`), which fires on signup. |
| `email_queue` | Only `service_role` (`auth.role() = 'service_role'`) — authenticated/anon users have zero access regardless of table grants. |
| `email_send_log` | Same — `service_role` only. |

Note on `clubs`: there are two `INSERT` policies —
`"Allow authenticated club creation"` with `WITH CHECK (true)` and
`"Users can insert their own clubs"` with `WITH CHECK (created_by = auth.uid())`. Postgres
OR's permissive policies for the same command, so the unconditional `true` policy makes the
second one redundant in practice: any authenticated user can insert a `clubs` row with any
`created_by` value, not just their own `uid`. Not flagged as a live incident — just noted,
since the app's own insert path presumably always sets `created_by` correctly — but it's a
gap if that ever changes or if the RPC layer is bypassed.

---

## 5. The four `analytics.*` materialized views

| View | Refreshed by `refresh_report_views()`? | Read by the client? |
|---|---|---|
| `analytics.mv_completed_matches` | Yes | Yes — via `get_completed_matches()` RPC (`src/hooks/useReports.tsx:50`) |
| `analytics.mv_goal_scorers` | Yes | Yes — via `get_goal_scorers()` RPC (`useReports.tsx:97`) |
| `analytics.mv_competitions` | Yes | Yes — via `get_competitions()` RPC (`useReports.tsx:200`) |
| `analytics.mv_player_playing_time` | Yes | **No** — nothing in `src/` selects it or a wrapper RPC over it (§3) |

`refresh_report_views()` (`20260824000408_baseline.sql:1048-1094`) refreshes all four
`CONCURRENTLY`, each in its own sub-transaction with `EXCEPTION WHEN OTHERS` so one
view's failure doesn't block the others. Its refresh path covers all data the three
actually-read views expose.

**How refresh is triggered — client-side only, no DB-side guarantee.** The RPC is called
explicitly from `useEditMatchData.tsx`, `useEnhancedMatchTimer.tsx` (on match end),
`useRetrospectiveMatch.tsx`, `useReportRefresh.tsx` (debounced, on Realtime
`postgres_changes` events for `fixtures`/`match_events`/`player_time_logs`), and manually
from `useReports.tsx:221`. There is also a `trigger_refresh_reports()` trigger function
attached to `fixtures`, `match_events`, and `player_time_logs`
(`20260824000408_baseline.sql:2309-2317`) that calls `pg_notify('refresh_reports', ...)` — but
this is Postgres `LISTEN`/`NOTIFY`, a different mechanism from Supabase Realtime's
`postgres_changes` (which is what the client actually subscribes to). **No code in this
repo (`grep -rn "LISTEN" supabase/functions/`, `grep -rn "pg_notify" src/`) listens on that
channel.** The trigger fires, the notification goes nowhere, and it does not itself refresh
anything — the actual refresh only happens because the client separately calls the RPC.
This trigger machinery appears to be dead infrastructure from an earlier design. It's not
harmful (a no-op notify on every write), but it doesn't do what its name implies, and if
anyone changes `player_time_logs` etc. through a path that skips the client hooks above
(a script, the dashboard SQL editor, a future edge function), the materialized views will
go stale with nothing to catch it.

---

## 6. Duplicate migration version prefixes

Supabase CLI derives each migration's tracked "version" from the filename prefix up to the
first underscore. Three date prefixes are reused across multiple files:

- **`20251012`** (4 files): `cleanup_client_event_id_constraint.sql`, `fix_player_time_calc.sql`, `get_player_playing_time_v2.sql`, `get_player_playing_time_v3.sql`
- **`20251208`** (4 files): `create_analytics_schema.sql`, `create_materialized_views.sql`, `fix_completed_matches_view.sql`, `update_refresh_function.sql`
- **`20260110`** (3 files): `add_super_admin.sql`, `registration_system.sql`, `set_initial_super_admin.sql`

`supabase_migrations.schema_migrations` (the CLI's remote bookkeeping table) uses the
version string as its primary key, and expects one file per version. With four files
sharing `20251012` as their version, a `supabase db push` against a project that tracks
these migrations would apply the first one (in lexical/filename order) and record version
`20251012`, then fail to record the second file under the same already-used version —
aborting the push partway with three of the four files un-recorded (exact CLI error
behavior not verified here — not run, per instructions — but the primary-key collision is
structural and unavoidable given the filenames alone). This is the same defect flagged more
generally in the backlog as DEBT-011; this dump comparison confirms it's not just a style
issue but would break a future `db push` outright once the remote history is reconciled.

---

## 7. Are `supabase/cloud_full.sql` and `supabase/migrations-disabled/` safely deletable now?

**`supabase/cloud_full.sql` — yes, safe to delete.** It's an earlier, now-superseded dump:
11 tables only (missing `admin_notifications`, `club_invitations`, `pending_registrations`,
`email_queue`, `email_send_log`), no `analytics` schema/materialized views at all, and its
`get_player_playing_time()` has a completely different return signature (`jersey_number`,
`matches_played bigint`, `total_minutes_played numeric` — not matching any function
currently in production). It predates most of the 17 tracked migrations and is fully
subsumed by `supabase/migrations/20260824000408_baseline.sql`, which is newer and verified against the live
database.

**`supabase/migrations-disabled/` — not safely deletable without a decision first.** Per
§1, it is currently the *only* local record of how the 11 core tables were created — the
active `migrations/` folder has no `CREATE TABLE` for any of them. Two different things
could be true going forward, and they have opposite answers for this folder:

- If the intent is to keep `supabase/migrations/` as a replayable-from-scratch history
  (the normal Supabase CLI model — a fresh project rebuilt by running every migration in
  order), then `migrations-disabled/` is *not* disposable as-is: it needs to be reconciled
  into the active history (renamed, deduplicated, checked against the dump) rather than
  deleted, or the active migrations folder permanently loses the ability to build the base
  schema.
- If the intent is to treat `supabase/migrations/20260824000408_baseline.sql` itself as the new baseline
  (i.e., a fresh environment is seeded from the dump, and `migrations/` only needs to
  capture changes *from here forward*), then the old history in both
  `migrations-disabled/` and the unrecorded remote Lovable-era migrations becomes
  irrelevant for rebuilding schema, and `migrations-disabled/` could be archived or deleted
  — but that's a deliberate strategy decision, not a cleanup, and it's the same decision
  DEBT-002 is already blocked on.

Not deleting either without that decision being made explicitly.

---

## 8. Leftover debugging artifacts in production

`test_auth_context()` and `test_current_user()` (`20260824000408_baseline.sql:1297-1322`) are
present in production, `GRANT ALL`-ed to `anon`, `authenticated`, and `service_role`
(`:3178-3186`), and unreferenced anywhere in `src/` or `supabase/functions/` — only
`src/integrations/supabase/types.ts` (generated) knows about them. `test_current_user()`
returns `auth.jwt()` verbatim to whoever calls it. Low severity in isolation (a caller can
already read their own JWT client-side — this doesn't leak anyone else's), but it's dead,
undocumented, callable by anonymous (unauthenticated) requests, and has no reason to exist
in production. Candidate for a follow-up migration to `DROP FUNCTION` both, once the
migration-history situation (§6/§7) is untangled enough to safely add new migrations.

No other obvious debug/scratch objects were found in the function or table list.

---

## Summary of what's marked unknown

- Whether `20251207_refresh_stale_views.sql` and `20260131_fix_rogue_assist_events.sql`'s
  `DELETE`/data-only effects reached production — the dump carries no data, only schema,
  and `20260131`'s schema-level change (the constraint rewrite) demonstrably did *not*
  land, which is suggestive but not proof for the `DELETE` statement specifically.
- Whether rogue standalone `'assist'` rows currently exist in `match_events` — would need a
  live query against production, not just the schema dump.
- The exact `supabase db push` error/behavior on the duplicate-version-prefix files (§6) —
  not run, per instructions; the primary-key collision is inferred from how the CLI is
  documented to derive versions, not observed directly.
