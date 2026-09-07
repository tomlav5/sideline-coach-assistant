import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { decideMissingStarterLog } from '@/lib/missingStarterLog';

/**
 * Commits a batch of staged substitutions (UX-007 branch 3).
 *
 * This is the write sequence that used to live inline in
 * `EnhancedSubstitutionDialog`'s `onConfirm` handler in `EnhancedMatchTracker`.
 * It is moved here unchanged in substance so the staged-subs Submit path and any
 * remaining caller run exactly the same DB work: resolve the current period,
 * then for each pair update `player_match_status`, open/close `player_time_logs`
 * intervals, and upsert the `substitution_off` / `substitution_on`
 * `match_events`.
 *
 * Stamping (see src/lib/matchMinute.ts):
 *  - `match_events.minute_in_period` / `total_match_minute` take the TIMESTAMP
 *    minute (the minute in progress) — passed in as `currentMinute` /
 *    `totalMatchMinute`, stamped by the caller at Submit time.
 *  - `player_time_logs.time_on_minute` / `time_off_minute` take a DURATION —
 *    `Math.floor(currentSeconds / 60)`, computed here.
 *
 * Idempotency: each pair carries its own `offEventId` / `onEventId`
 * (`match_events.client_event_id`, which is UNIQUE). They are generated once when
 * the pair is staged and reused on every attempt, so re-submitting a pair after
 * a partial failure upserts instead of duplicating.
 *
 * Failure handling: pairs are applied in order. On the first failure the
 * function stops and returns — `committedPairIds` lists the pairs fully written,
 * `failedPairId` and `error` describe the stop. The caller drops the committed
 * pairs from the pending stack and leaves the rest staged; it does not silently
 * continue.
 *
 * Missing time log (BUG-011): if the player going off has closed
 * `player_time_logs` rows in this period but no open one, their current spell
 * was never recorded and its start minute is unknown. Rather than fabricate a
 * spell from minute 0 (which counts bench time as playing time now that the
 * BUG-009 unique constraint is gone), a zero-length spell is written — the
 * player is credited nothing for the missing spell, so their total is
 * understated, not overstated — and a non-blocking `toast.warning` names the
 * player. The pair is NOT failed: a lost substitution desyncs the on-screen
 * pitch from the real one, which is worse than approximate minutes.
 */

export interface SubmitSubPair {
  id: string;
  playerOut: string;
  playerIn: string;
  offEventId: string;
  onEventId: string;
}

export interface SubmitSubstitutionsArgs {
  fixtureId: string;
  pairs: SubmitSubPair[];
  /** TIMESTAMP minute (minute in progress) for match_events. Stamped at Submit time. */
  currentMinute: number;
  /** TIMESTAMP whole-match minute for match_events. Stamped at Submit time. */
  totalMatchMinute: number;
  /** Elapsed seconds in the current period; floored to a minute for player_time_logs. */
  currentSeconds: number;
  /**
   * Resolves a player id to a display name, for the BUG-011 "minutes may be
   * understated" toast. Optional — the raw id is used if it is not supplied.
   */
  resolvePlayerName?: (playerId: string) => string;
}

export interface SubmitSubstitutionsResult {
  /** Pairs whose full write sequence completed. */
  committedPairIds: string[];
  /** The pair that failed, if the batch stopped early. */
  failedPairId?: string;
  /** The underlying error, if any. */
  error?: unknown;
}

interface PeriodRow {
  id: string;
  [key: string]: unknown;
}

/**
 * Flip a player's `player_match_status.is_on_field`.
 *
 * A bare `.update()` that matches no rows returns success with no error, so a
 * player with no `player_match_status` row would let a substitution silently
 * no-op and the pitch on screen would drift from the real one (DEFECT 2).
 * Upsert on the `(fixture_id, player_id)` unique key instead — it heals the
 * missing row — and assert a row came back so a no-op cannot pass unnoticed.
 */
async function setOnField(
  fixtureId: string,
  playerId: string,
  isOnField: boolean,
): Promise<void> {
  const { data, error } = await supabase
    .from('player_match_status')
    .upsert(
      { fixture_id: fixtureId, player_id: playerId, is_on_field: isOnField },
      { onConflict: 'fixture_id,player_id' },
    )
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      `player_match_status upsert affected no rows for player ${playerId} (fixture ${fixtureId})`,
    );
  }
}

async function resolveCurrentPeriod(fixtureId: string): Promise<PeriodRow | null> {
  const { data: activePeriod } = await supabase
    .from('match_periods')
    .select('*')
    .eq('fixture_id', fixtureId)
    .eq('is_active', true)
    .single();

  if (activePeriod) return activePeriod as PeriodRow;

  // Fallback 1: the fixture's recorded current period.
  const { data: fixtureData } = await supabase
    .from('fixtures')
    .select('current_period_id')
    .eq('id', fixtureId)
    .single();

  if (fixtureData?.current_period_id) {
    const { data: periodById } = await supabase
      .from('match_periods')
      .select('*')
      .eq('id', fixtureData.current_period_id)
      .single();
    if (periodById) return periodById as PeriodRow;
  }

  // Fallback 2: the most recent period.
  const { data: latestPeriod } = await supabase
    .from('match_periods')
    .select('*')
    .eq('fixture_id', fixtureId)
    .order('period_number', { ascending: false })
    .limit(1)
    .single();

  return (latestPeriod as PeriodRow) ?? null;
}

async function applyPair(
  fixtureId: string,
  period: PeriodRow,
  pair: SubmitSubPair,
  minutes: { currentMinute: number; totalMatchMinute: number; durationMinute: number },
  resolvePlayerName?: (playerId: string) => string,
): Promise<{ understatedPlayerIds: string[] }> {
  const { playerOut, playerIn } = pair;
  const { currentMinute, totalMatchMinute, durationMinute } = minutes;
  const nameOf = (id: string) => resolvePlayerName?.(id) ?? id;
  const understatedPlayerIds: string[] = [];

  // Run one step of the pair's write sequence, tagging any failure with the step
  // that failed and the pair it belongs to. DEFECT 3: a lone transient error on
  // one of these seven round-trips used to fail the whole batch with no record
  // of where — the retry in submitSubstitutions() then succeeded, so the coach
  // saw a spurious "still pending". Now the failing step is always logged.
  const step = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      console.error(
        `[submitSubstitutions] pair ${pair.id} (${playerOut} -> ${playerIn}) ` +
          `failed at step "${label}" in period ${period.id}`,
        error,
      );
      throw error;
    }
  };

  // Player statuses (upsert + zero-row assertion — see setOnField / DEFECT 2).
  await step('status: player out', () => setOnField(fixtureId, playerOut, false));
  await step('status: player in', () => setOnField(fixtureId, playerIn, true));

  // Ensure a row exists for the player going OUT — i.e. their currently active
  // interval in this period. Read EVERY row for (fixture, player, period),
  // active and closed, not just the active ones (BUG-011): once the unique
  // constraint is gone (BUG-009), an is_active-only read that finds nothing
  // cannot tell a genuine missing starter from a returning player whose
  // current spell was never recorded, and the old
  // `insert { time_on_minute: 0, is_starter: true }` fallback would then
  // silently fabricate a spell from minute 0 and double-count the bench time
  // between the player's spells.
  const outRows = await step('time log: read out rows', async () => {
    const { data, error } = await supabase
      .from('player_time_logs')
      .select('id, is_active')
      .eq('fixture_id', fixtureId)
      .eq('player_id', playerOut)
      .eq('period_id', period.id);
    if (error) throw error;
    return data ?? [];
  });

  const outDecision = decideMissingStarterLog(outRows, durationMinute);
  if (outDecision.insert) {
    if (outDecision.missingSpell) {
      // Case 2: the player has closed rows in this period but no open one, so
      // the app cannot know when their current spell began. Insert a
      // zero-length spell (closed at the same minute it opens, just below) so
      // the player is credited NOTHING for the missing spell — their total is
      // under-stated, not over-stated. That is deliberate: over-crediting a
      // player here hands them less playing time in later matches than they
      // are actually owed, which is the exact thing this app exists to
      // prevent. The substitution itself is still recorded in full.
      console.error(
        `[submitSubstitutions] pair ${pair.id}: ${nameOf(playerOut)} (${playerOut}) ` +
          `has closed player_time_logs rows in period ${period.id} but no active one — ` +
          `their current spell was never recorded. Inserting a zero-length spell at ` +
          `minute ${outDecision.timeOnMinute} (is_starter=false); this player's minutes ` +
          `for this match will be understated and should be checked in Match Data Editor.`,
      );
      understatedPlayerIds.push(playerOut);
    }
    await step('time log: insert out row', async () => {
      const { error } = await supabase.from('player_time_logs').insert({
        fixture_id: fixtureId,
        player_id: playerOut,
        period_id: period.id,
        time_on_minute: outDecision.timeOnMinute,
        is_starter: outDecision.isStarter,
        is_active: true,
      });
      if (error) throw error;
    });
  }

  // Finalize the time log for the player going OUT.
  // DURATION, not timestamp: minutes elapsed in the period (plain floor).
  await step('time log: close out interval', async () => {
    const { error } = await supabase
      .from('player_time_logs')
      .update({ time_off_minute: durationMinute, is_active: false })
      .eq('fixture_id', fixtureId)
      .eq('player_id', playerOut)
      .eq('period_id', period.id)
      .eq('is_active', true);
    if (error) throw error;
  });

  // Open a time log for the player coming IN, unless one is already active.
  const activeInLog = await step('time log: read in interval', async () => {
    const { data, error } = await supabase
      .from('player_time_logs')
      .select('id, is_active')
      .eq('fixture_id', fixtureId)
      .eq('player_id', playerIn)
      .eq('period_id', period.id)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

  if (!activeInLog) {
    await step('time log: open in interval', async () => {
      const { error } = await supabase.from('player_time_logs').insert({
        fixture_id: fixtureId,
        player_id: playerIn,
        period_id: period.id,
        // DURATION, not timestamp: minutes elapsed in the period (plain floor).
        time_on_minute: durationMinute,
        is_starter: false,
        is_active: true,
      });
      if (error) throw error;
    });
  }

  // Substitution events. client_event_id upsert so a retry cannot duplicate.
  await step('event: substitution_off', async () => {
    const { error } = await supabase.from('match_events').upsert(
      {
        fixture_id: fixtureId,
        period_id: period.id,
        event_type: 'substitution_off',
        player_id: playerOut,
        minute_in_period: currentMinute,
        total_match_minute: totalMatchMinute,
        is_our_team: true,
        notes: null,
        is_retrospective: false,
        client_event_id: pair.offEventId,
      },
      { onConflict: 'client_event_id' },
    );
    if (error) throw error;
  });

  await step('event: substitution_on', async () => {
    const { error } = await supabase.from('match_events').upsert(
      {
        fixture_id: fixtureId,
        period_id: period.id,
        event_type: 'substitution_on',
        player_id: playerIn,
        minute_in_period: currentMinute,
        total_match_minute: totalMatchMinute,
        is_our_team: true,
        notes: null,
        is_retrospective: false,
        client_event_id: pair.onEventId,
      },
      { onConflict: 'client_event_id' },
    );
    if (error) throw error;
  });

  return { understatedPlayerIds };
}

export async function submitSubstitutions(
  args: SubmitSubstitutionsArgs,
): Promise<SubmitSubstitutionsResult> {
  const { fixtureId, pairs, currentMinute, totalMatchMinute, currentSeconds, resolvePlayerName } =
    args;
  const committedPairIds: string[] = [];

  if (pairs.length === 0) return { committedPairIds };

  let period: PeriodRow | null;
  try {
    period = await resolveCurrentPeriod(fixtureId);
  } catch (error) {
    return { committedPairIds, error };
  }
  if (!period) {
    return {
      committedPairIds,
      error: new Error('No match period is open — cannot record a substitution.'),
    };
  }

  const durationMinute = Math.floor(currentSeconds / 60);

  for (const pair of pairs) {
    // One automatic retry before giving up. Every write in applyPair is
    // idempotent (client_event_id upserts, "insert only if no active log",
    // player_match_status upsert), so a lone transient failure — a dropped
    // request on one of seven round-trips — self-heals on the second attempt
    // instead of surfacing to the coach as a spurious "still pending"
    // (DEFECT 3). A persistent failure still stops the batch.
    let lastError: unknown;
    // Players whose spell we could not reconstruct on any attempt of this pair.
    // Collected across attempts because a retry that heals the missing row sees
    // it as active and no longer reports it — the coach should still be warned.
    const understatedThisPair = new Set<string>();
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const { understatedPlayerIds } = await applyPair(
          fixtureId,
          period,
          pair,
          { currentMinute, totalMatchMinute, durationMinute },
          resolvePlayerName,
        );
        understatedPlayerIds.forEach((id) => understatedThisPair.add(id));
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (attempt === 1) {
          console.warn(
            `[submitSubstitutions] pair ${pair.id} attempt 1 failed — retrying once`,
            error,
          );
        }
      }
    }

    if (lastError) {
      console.error(
        `[submitSubstitutions] pair ${pair.id} failed after retry — stopping batch ` +
          `(${committedPairIds.length}/${pairs.length} committed)`,
        lastError,
      );
      return { committedPairIds, failedPairId: pair.id, error: lastError };
    }

    committedPairIds.push(pair.id);

    // Non-blocking: the substitution IS recorded. Warn once per affected player
    // that their minutes are understated because their spell had no open time
    // log — failing the pair instead would desync the on-screen pitch from the
    // real one, which is worse than approximate minutes (BUG-011, UX-007 risk
    // section).
    for (const playerId of understatedThisPair) {
      const name = resolvePlayerName?.(playerId) ?? playerId;
      toast.warning(`${name}'s minutes may be understated`, {
        description:
          'The substitution was recorded, but this player had no open time log. ' +
          'Check their minutes in Match Data Editor.',
      });
    }
  }

  return { committedPairIds };
}
