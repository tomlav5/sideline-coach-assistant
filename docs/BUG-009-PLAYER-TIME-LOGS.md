# BUG-009 investigation: can `unique_player_period_fixture` be dropped?

Investigation only, no code/schema changes. See `docs/BACKLOG.md` BUG-009 for the
reported symptom (Submit fails with `23505` on a returning player) and prior context.

Every writer of `player_time_logs` (25 call sites in `src/`, one in the database) and
every reader that could assume one-row-per-player-per-period was read in full. SQL was
read from `supabase/migrations/20260824000408_baseline.sql`, which `CLAUDE.md` and
`docs/SCHEMA_BASELINE.md` both state is the complete live schema.

---

## 1. Every writer of `player_time_logs`

25 call sites in `src/`, plus one `DELETE` inside a database function. No Edge Function
touches this table. No call site anywhere uses `.upsert()` — the constraint's stated
purpose ("to support upsert operations", `supabase/migrations-archive/lovable-era/20250915190202_*.sql`)
is confirmed obsolete.

| # | File:line | Operation | Guarded by unique constraint today? | Correct if a player can hold >1 row per period? |
|---|---|---|---|---|
| 1 | `src/lib/submitSubstitutions.ts:165-172` (read) → `:178-188` (insert) | insert "out row" if none found | Yes — the gating read at 165 would itself error first | **No.** Gating read has no `is_active` filter; breaks before the insert ever runs (§2 finding A) |
| 2 | `src/lib/submitSubstitutions.ts:193-202` | update, closes active interval | No | **Yes.** Filtered on `.eq('is_active', true)` — closes exactly the one open row regardless of how many closed rows already exist |
| 3 | `src/lib/submitSubstitutions.ts:205-213` (read) → `:218-230` (insert) | insert new "in" interval if none active | No | **Yes.** Gating read filters `is_active=true`; this is the one path in the codebase already written for the interval model (comment: "unless one is already active") |
| 4 | `src/hooks/useEnhancedMatchTimer.tsx:369-377` | bulk update, closes all active logs in a period (period end) | No | **Yes.** Filtered on `period_id` + `is_active=true`, no `.single()` |
| 5 | `src/pages/EnhancedMatchTracker.tsx:727-737` | bulk update, closes all active logs in a period (period-transition effect) | No | **Yes.** Same pattern as #4 |
| 6 | `src/pages/EnhancedMatchTracker.tsx:759-766` (read) → `:770-781` (insert) | insert starter row for new period if none active | No | **Yes.** Gating read filters `is_active=true`; comment explicitly says "allows multiple intervals per period" |
| 7 | `src/pages/EnhancedMatchTracker.tsx:830-837` (read) → `:839-849` (insert) | "safety net" insert of missing starter log | Yes — the gating read at 830 would itself error first | **No.** Gating read has no `is_active` filter; breaks before the insert ever runs (§2 finding B) |
| 8 | `src/components/match-editor/PlayerTimesTable.tsx:88-95` | update by `id` (coach edits a row in the match editor) | N/A (keyed by PK) | Yes — operates on one known row, unaffected by how many other rows exist |
| 9 | `src/components/match-editor/PlayerTimesTable.tsx:119-126` | delete by `id` | N/A (keyed by PK) | Yes |
| 10 | `src/components/match-editor/PlayerTimesTable.tsx:144-172` ("Add Player Time") | plain insert, **no existing-row check at all** | **Yes — currently the only thing stopping a coach adding two rows for the same player+period** | **This is a masked bug — see §5.** |
| 11 | `src/hooks/useEditMatchData.tsx:82-107` (`updatePlayerTime`) | update by `id` | N/A (keyed by PK) | Yes |
| 12 | `src/hooks/useEditMatchData.tsx:109-129` (`deletePlayerTime`) | delete by `id` | N/A (keyed by PK) | Yes |
| 13 | `src/hooks/useRetrospectiveMatch.tsx:133-172` (`saveRetrospectiveMatch`) | bulk insert, **no existing-row check** (unlike the sibling `periods` insert two blocks above it, which does check `existingPeriodNumbers`) | **Yes — silently relied on** | **This is a masked bug — see §5.** |
| 14 | `public.restart_match()` DB function, baseline line 1207 | `DELETE FROM player_time_logs WHERE fixture_id = fixture_id_param` | N/A (bulk delete by fixture) | Yes — unaffected by row count |
| 15 | `src/pages/Reports.tsx:97-104` (delete-match admin action) | `DELETE ... WHERE fixture_id = matchId` | N/A (bulk delete by fixture) | Yes |

Rows 8-13 are consumers of `src/hooks/useEditMatchData.tsx`; that hook is actually used by
`src/components/match/EditMatchDialog.tsx` (not `MatchDataEditor.tsx`/`PlayerTimesTable.tsx`,
which call Supabase directly with their own inline logic). Both editors end up with the same
by-`id` safety, so the duplicate UI paths don't change the analysis.

The remaining ~10 call sites are pure reads, covered in §2.

**Summary:** two writers (#1 and #7 above) are already broken by a *read* that has no
`is_active` filter and will error the moment a player has two rows in the same period —
this is the exact mechanism in the bug report, and it exists in a second place beyond
`submitSubstitutions.ts`. Two writers (#10 and #13) have no duplicate protection of their
own and are currently saved only by the constraint. Every other writer is already
interval-safe by construction.

## 2. Every reader that assumes uniqueness

Hunted for `.single()`/`.maybeSingle()` on `player_time_logs` filtered by
fixture/player/period without an `is_active` (or other) discriminator. Two exist, both
already listed in §1 as the gating read for an insert:

**Finding A — `src/lib/submitSubstitutions.ts:165-172`** (`applyPair`, "time log: read out row"):
```ts
const { data, error } = await supabase
  .from('player_time_logs')
  .select('player_id')
  .eq('fixture_id', fixtureId)
  .eq('player_id', playerOut)
  .eq('period_id', period.id)
  .maybeSingle();
```
No `is_active` filter. This is the exact bug in the report: a player who has already had
one interval in this period (came on, went off) and is now going off *again* has two rows
for `(fixtureId, playerOut, period.id)`. PostgREST's `.maybeSingle()` throws when more than
one row matches, regardless of what the unique constraint would otherwise have prevented at
insert time — **so today this can never actually happen, because the constraint guarantees
at most one row exists to begin with.** Drop the constraint and this throws on exactly the
"player returns a second time" case, i.e. it does not fix BUG-009 by itself; the read must
be changed too (see §7).

**Finding B — `src/pages/EnhancedMatchTracker.tsx:830-837`** (`initMissingStarterLogs`
safety net, mounted on `[fixtureId, currentPeriod?.id]`):
```ts
const { data: existing } = await supabase
  .from('player_time_logs')
  .select('id')
  .eq('fixture_id', fixtureId)
  .eq('player_id', row.player_id)
  .eq('period_id', activeP.id)
  .maybeSingle();
```
Same pattern, same break. This runs inside a `for` loop over every on-field player, wrapped
in one outer `try/catch` (line 851-853) that only `console.warn`s. A throw on one player
aborts the loop for every player after them in iteration order, silently. This effect isn't
named in the backlog item but is the same class of bug and must be fixed alongside
`submitSubstitutions.ts` — fixing one and not the other leaves an intermittent crash
depending on which code path happens to run first for a given player.

**Everything else, confirmed individually, as requested:**

| File | Verdict | Why |
|---|---|---|
| `src/pages/MatchReport.tsx:177-198` | **Safe** | No `.single()`. Loops all rows, keys by `player_id`, accumulates `total_minutes += pt.total_period_minutes \|\| 0` (line 236) — sums every row. Minor nuance: `time_on`/`time_off` shown to the user are the *earliest on* / *latest off* across all a player's intervals (lines 219-233), which for a multi-interval player would visually span their bench time in between. Not a crash, but worth a follow-up UX ticket once multi-interval players are possible. |
| `src/pages/Reports.tsx` | **Safe** | Only touches `player_time_logs` via a bulk `DELETE ... WHERE fixture_id = matchId` (admin "delete match"). No aggregation, no `.single()`. |
| `src/pages/MatchDataEditor.tsx:177-203` | **Safe** | Fetches all rows for the fixture with no `.single()`/`.maybeSingle()`, passes the array straight to `PlayerTimesTable`. |
| `src/hooks/useEditMatchData.tsx` (all four functions) | **Safe** | `updatePlayerTime`/`deletePlayerTime` act by `id` (PK). `deletePeriod`'s existence check (`.limit(1)`, line 170-174) only needs "does at least one row exist", not "does exactly one" — unaffected. `validateMatchData` (line 207-246) iterates `playerTimes?.forEach(...)` with no uniqueness assumption. |
| `src/hooks/useRetrospectiveMatch.tsx` | **Safe as a reader** (it has no reads of `player_time_logs`); **not safe as a writer** — see §1 row 13 and §5. |
| `src/components/reports/ExportDialog.tsx:79-88, 166-184` | **Safe, but changes shape.** No `.single()`; `.filter()` + `.forEach()` over every row, pushing one export row per `player_time_logs` row (line 176-182). Once a player can have two rows in one period, the exported spreadsheet gets two "Minutes Played" lines for that match/player instead of one — correct data, different (currently un-summed) presentation. Worth a one-line note to whoever owns the export format, not a blocker. |
| `src/components/match-editor/PlayerTimesTable.tsx` | **Safe as a reader/by-id writer**; **not safe as the "Add Player Time" writer** — see §1 row 10 and §5. |
| `src/components/reports/TimeDebugPanel.tsx:117-165` | **Safe** | `.select('*')` with no `.single()`, `.reduce()`s `minutes_in_period` across every row returned (line 163) — this is in fact the closest thing in the codebase to a manual re-implementation of the SQL in `get_player_playing_time_v2` (§3), and it's already interval-correct. |
| `src/hooks/usePlayerTimers.tsx:59-66` | **Safe** | No `.single()`, explicitly documented as "Not scoped to ... `is_active`" (comment, line 39-41), feeds `summarisePlayerMinutes` (§ next). |
| `src/lib/playerMinutes.ts` | **Safe, already interval-correct.** Confirmed per the groundwork claim: sums `closedMinutes` across every closed row, tracks the earliest `openOnMinute` only among rows matching the *current* period, ignores stray open rows from past periods. This is the BUG-007 fix and it was written assuming multiple rows per period were possible. |

## 3. The analytics layer

The client calls `get_player_playing_time_v3` first and falls back to `get_player_playing_time_v2`
on error (`src/hooks/useReports.tsx:144-154`). **`get_player_playing_time_v3` does not exist
in the live schema.** It exists only in
`supabase/migrations-archive/pre-baseline/20251012_get_player_playing_time_v3.sql`, which was
not carried into `supabase/migrations/20260824000408_baseline.sql` — grep confirms zero
occurrences of `v3` anywhere in the baseline. Per `CLAUDE.md`/`docs/SCHEMA_BASELINE.md`, the
baseline file is declared the full live schema, so in practice **every call always falls
back to v2** (a `PGRST202`-style "function not found" is what triggers the `catch`). This is
tangential to BUG-009 but matters for reasoning about "the analytics layer" — v2 is the one
that runs in production today, not v3, and it's the one to check.

`get_player_playing_time_v2` (baseline lines 846-898) sums, and does so per-row without
first collapsing by `period_id`:

```sql
with interval_minutes as (
  select
    ptl.fixture_id, ptl.player_id, ptl.period_id,
    case when coalesce(ptl.is_starter, false) then 0 else ptl.time_on_minute end as start_min,
    least(coalesce(ptl.time_off_minute, ptl.total_period_minutes), ptl.total_period_minutes) as end_min,
    ptl.total_period_minutes
  from public.player_time_logs ptl
),
period_contrib as (
  select fixture_id, player_id, period_id,
    case when start_min is null then 0 else greatest(0, end_min - start_min) end as minutes_in_period
  from interval_minutes
),
fixture_sums as (
  select pc.fixture_id, pc.player_id, sum(pc.minutes_in_period)::int as minutes_in_fixture
  from period_contrib pc
  group by pc.fixture_id, pc.player_id
), ...
```

`period_contrib` is one row *per `player_time_logs` row*, not per `(fixture_id, player_id,
period_id)` — the `group by` that collapses rows only happens in `fixture_sums`, grouped by
`(fixture_id, player_id)`, which sums across *all* periods **and all rows within a period**.
Two rows for the same player in the same period both get summed. This is correct **only**
because `applyPair` (see §1 row 3) sets `is_starter: false` on every "came back on" interval,
so `start_min` for a second interval is that row's own `time_on_minute`, not 0. If that
invariant were ever violated, this SQL would silently double-count from `time_on_minute=0`
for the second interval too — worth a comment in the SQL itself if the constraint is
dropped, but not a blocker.

`analytics.mv_player_playing_time` (baseline lines 1710-1735) has the same shape — a
`LEFT JOIN player_time_logs ptl ON ptl.player_id = p.id` with no intermediate grouping by
period, then `sum(...)` per row in the outer `GROUP BY p.id, ...`:
```sql
COALESCE(sum(
    CASE
        WHEN ptl.time_off_minute IS NOT NULL THEN ptl.time_off_minute - COALESCE(ptl.time_on_minute, 0)
        ELSE mp.planned_duration_minutes - COALESCE(ptl.time_on_minute, 0)
    END), 0) AS total_minutes_played
```
Same conclusion: sums every row, not one row per period. **Neither analytics path assumes
uniqueness — this is not a blocker.**

## 4. Other triggers — `trigger_player_time_logs_refresh_reports`

The task brief frames this as "fires per row on INSERT/DELETE/UPDATE and calls
`refresh_report_views()`." **That is not what the trigger does**, and the correction matters
for the volume question. The trigger function (baseline lines 1325-1338):

```sql
CREATE OR REPLACE FUNCTION "public"."trigger_refresh_reports"() RETURNS "trigger" ...
BEGIN
    PERFORM pg_notify('refresh_reports', json_build_object(
        'table', TG_TABLE_NAME, 'operation', TG_OP,
        'timestamp', extract(epoch from now()), 'record_id', COALESCE(NEW.id::text, OLD.id::text)
    )::text);
    RETURN COALESCE(NEW, OLD);
END;
```

It only does `pg_notify`. Grepped the whole repo (`src/`, `supabase/functions/`,
`supabase/migrations*`) for anything that `LISTEN`s on the `refresh_reports` channel or
otherwise consumes it: **nothing does.** There is no Edge Function, no `pg_cron` job (none
exists in the baseline), and Supabase Realtime's `postgres_changes` mechanism (which
`useReportRefresh.tsx` and `usePlayerTimers.tsx` actually use) is logical-replication-based,
not `NOTIFY`-based, so it doesn't pick this up either. This channel appears to be dead —
plausibly a Lovable-era leftover per `CLAUDE.md`'s note about inherited artefacts.

The actual `REFRESH MATERIALIZED VIEW CONCURRENTLY` calls (`refresh_report_views()`,
baseline lines 1048-1097) only happen from **explicit client-side RPC calls**, all outside
the hot path of a live match:
- `useEnhancedMatchTimer.tsx:430`, inside `endMatch()` — once, at full time.
- `useEditMatchData.tsx:14`, `useRetrospectiveMatch.tsx:176` — once per retrospective/edit save.
- `useReportRefresh.tsx:22` — only mounted on `Reports.tsx` (line 77), **not** on
  `EnhancedMatchTracker`, debounced 2s, and only fires from a Realtime subscription to
  `player_time_logs` changes — i.e. only relevant if a parent/coach has the Reports page
  open on another device while a match is live.

**Conclusion:** allowing multiple intervals per period does not multiply
`refresh_report_views()` calls during a live match — that RPC isn't wired to per-row writes
at all in this codebase. The row-level triggers that *do* fire per write
(`calculate_total_period_minutes`, `trigger_player_time_logs_refresh_reports`,
`update_player_time_logs_updated_at`) are all cheap, single-row operations; even a match
with heavy rolling subs (a normal 11-a-side match already writes ~22 starter rows across two
halves, plus 2 writes per substitution pair) adds a few dozen trivial trigger firings, not a
few dozen materialized view refreshes. **Not a concern.**

## 5. What the constraint might currently be masking

Three insert paths were checked by name per the brief:

- **`ensurePlayerStatuses`** (`EnhancedMatchTracker.tsx:391-515`) — does not touch
  `player_time_logs` at all; it only reads/writes `player_match_status`. Not implicated.
- **The period-transition effect** (`EnhancedMatchTracker.tsx:698-795`) — its insert at
  line 770-781 is gated by an `is_active`-filtered read (§1 row 6) and its own comment says
  "allows multiple intervals per period." This path was already written for the interval
  model and needs no new guard.
- **`useRetrospectiveMatch`** (`saveRetrospectiveMatch`, `useRetrospectiveMatch.tsx:133-172`)
  — **this one is a real masked risk.** Unlike the `periods` insert immediately above it in
  the same function (which explicitly checks `existingPeriodNumbers` before inserting, lines
  56-66), the `player_time_logs` insert has no equivalent check. `RetrospectiveMatchDialog.tsx`
  builds its `playerTimes` state from `useState<PlayerTime[]>([])` (line 67) with no fetch of
  any existing rows — so if a coach opens this dialog a second time for the same fixture
  (e.g. to add a correction after an earlier save) and hits Save, every row from the first
  save is submitted again verbatim. Today the second `.insert()` fails outright on the first
  duplicate and — because it's one bulk insert — the whole batch is rejected, surfaced as a
  generic toast error, blocking even the genuinely new rows the coach was trying to add. If
  the constraint is dropped, this same scenario **succeeds silently** and doubles every
  previously-saved player's minutes for that fixture. This needs its own guard regardless of
  what happens to the constraint (see §7).

One more found by direct inspection, not on the brief's list:

- **`PlayerTimesTable.tsx`'s "Add Player Time" dialog** (`addPlayerTime`, lines 144-200) —
  a coach-facing manual insert with a player/period picker and no existing-row check. Today,
  picking a player+period that already has a row fails with the constraint's error message
  surfaced via toast ("Failed to add player time"). Drop the constraint and a coach can
  create a second, genuinely duplicate row for a player/period that was never actually
  substituted — indistinguishable in the analytics sum (§3) from a legitimate second
  interval, and undetectable without cross-checking against `match_events`.

## 6. Existing data

**No risk.** A `UNIQUE` constraint cannot be added over data that already violates it —
Postgres rejects the `ALTER TABLE ... ADD CONSTRAINT` outright. The migration that added it
(`supabase/migrations-archive/lovable-era/20250915190202_*.sql`) contains no dedup step, and
it exists in the applied baseline today, which means it succeeded when it ran — i.e. no
duplicate `(fixture_id, player_id, period_id)` rows existed at that point. Every insert since
has gone through this constraint (confirmed in §1 — no writer bypasses Postgres, no direct
SQL writer exists outside the app and `restart_match`), so **no duplicate rows can exist in
staging or production today**, and dropping a `UNIQUE` constraint never rewrites or
invalidates existing rows regardless. Nothing needs to be checked or migrated on the data
side before dropping it.

## 7. Recommendation

**(a) Drop the constraint.** The data model is intervals, nothing legitimate depends on the
constraint for upsert semantics (§1), and the analytics layer already sums correctly across
multiple rows per period (§3) — it was written assuming exactly that.

Exact list of code changes that must ship in the same PR as the migration:

1. **`src/lib/submitSubstitutions.ts:165-172`** — the "read out row" query must filter on
   `is_active` (or fetch and pick the one active row / most recent row) instead of expecting
   at most one row for `(fixture, player, period)`. This is the fix for the reported crash.
2. **`src/pages/EnhancedMatchTracker.tsx:830-837`** — same fix, same reason, in
   `initMissingStarterLogs`. Missing this leaves an intermittent duplicate of BUG-009 that
   depends on effect ordering/timing rather than the substitution flow specifically.
3. **`src/hooks/useRetrospectiveMatch.tsx:133-172`** — add a duplicate guard for
   `player_times`, mirroring the existing `existingPeriodNumbers` pattern used for `periods`
   two blocks above it (fetch existing `(player_id, period_id)` pairs for the fixture first,
   skip or `upsert` on conflict). Without this, reopening the retrospective dialog for an
   already-saved fixture silently doubles minutes once the constraint no longer blocks it.
4. **`src/components/match-editor/PlayerTimesTable.tsx:144-172`** (`addPlayerTime`) — add an
   existing-row check (or at minimum a confirmation) before inserting for a player+period
   that already has a row, so a coach's manual entry can't silently create a phantom
   duplicate that inflates reported minutes.
5. Migration should drop `unique_player_period_fixture` and, given #1-#3 above are about to
   change, is a good moment to also review whether a *partial* unique index —
   `UNIQUE (fixture_id, player_id, period_id) WHERE is_active` — is worth adding in its
   place. That would enforce "at most one **open** interval per player per period" at the DB
   layer (which every writer in §1 already maintains by convention) without blocking closed
   historical intervals. Not required for correctness (the app-level `is_active` guards
   already do this), but it converts an app-level invariant into a DB-enforced one for near
   zero cost, and Postgres partial unique indexes support exactly this. Flagging as optional,
   not blocking — six days out, prefer the minimal change (drop the constraint,
   ship 1-4 above) over adding a new index you haven't tested.

No RLS, analytics function, or materialized view changes are required (§3), and there is no
data migration step (§6).

---

**Verification.** Documentation only — no files under `src/` or `supabase/migrations*`
were modified, no migration was written, no `git` command was run against this repository
except one read-only `git log -1 -- supabase/cloud_full.sql` used to confirm that file's
age (it predates the current baseline and was not used as evidence above); it created no
lock file. This file is valid CommonMark/GitHub-flavored Markdown — tables, fenced code
blocks (` ```sql `/` ```ts `), and headings only, no unclosed fences.

What was read: every one of the 25 `player_time_logs` call sites in `src/` (full file reads
for `submitSubstitutions.ts`, `usePlayerTimers.tsx`, `playerMinutes.ts`, `useEditMatchData.tsx`,
`useRetrospectiveMatch.tsx`, `PlayerTimesTable.tsx`, `TimeDebugPanel.tsx`; targeted reads for
`EnhancedMatchTracker.tsx`, `MatchReport.tsx`, `ExportDialog.tsx`, `MatchDataEditor.tsx`,
`Reports.tsx`, `useEnhancedMatchTimer.tsx`, `useReportRefresh.tsx`, `EditMatchDialog.tsx`,
`RetrospectiveMatchDialog.tsx`); the full `player_time_logs`-related SQL in
`supabase/migrations/20260824000408_baseline.sql` (table, constraint, both triggers, both
trigger functions, `get_player_playing_time_v2`, `mv_player_playing_time`, `restart_match`);
the original constraint migration and the archived `get_player_playing_time_v3` migration
under `supabase/migrations-archive/`; and `docs/BACKLOG.md` BUG-009.

What was not read/checked: the live database itself (no DB credentials/access from this
environment — §3's "v3 doesn't exist live" and §6's "no duplicate rows exist" conclusions
are inferred from the checked-in baseline and migration history, which `CLAUDE.md` states is
authoritative, not from a direct query); `docs/UX-007-MATCH-SCREEN.md`'s risk section
(referenced by the backlog item but not needed to answer the question asked); the iOS/
Capacitor project (out of scope per `CLAUDE.md`); and any staging/production data directly.
