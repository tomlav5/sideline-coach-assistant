# Migrations archive

This directory holds historical migrations retained for reference only. **Nothing in this
directory is ever run.** `supabase/migrations/` contains the single live baseline migration;
these files exist purely as a record of how the schema got there.

## `lovable-era/`

The Lovable-generated migrations the remote database recorded as applied between
29 Aug 2025 and 29 Sep 2025, back when the project was edited primarily through Lovable's
own sync. Kept as a historical record of the base schema's origin.

## `pre-baseline/`

The 17 hand-maintained migrations that followed the Lovable era, tracked in
`supabase/migrations/` up until the baseline reset (see `docs/SCHEMA_BASELINE.md` for why:
the remote migration history and this folder had fully diverged, and reconstructing a
replayable history wasn't possible, so a new baseline was declared instead).

**`pre-baseline/20260131_fix_rogue_assist_events.sql` must never be applied.** It narrows
the `match_events.event_type` CHECK constraint to values (`'goal'`, `'substitution'`) that
the application does not write — the live client inserts `'substitution_on'` and
`'substitution_off'`. Applying this migration as written would cause every substitution
recorded at a live match to fail to insert.
