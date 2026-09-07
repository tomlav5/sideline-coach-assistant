import { supabase } from '@/integrations/supabase/client';

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
): Promise<void> {
  const { playerOut, playerIn } = pair;
  const { currentMinute, totalMatchMinute, durationMinute } = minutes;

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

  // Ensure a row exists for the player going OUT.
  const outRow = await step('time log: read out row', async () => {
    const { data, error } = await supabase
      .from('player_time_logs')
      .select('player_id')
      .eq('fixture_id', fixtureId)
      .eq('player_id', playerOut)
      .eq('period_id', period.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

  if (!outRow) {
    await step('time log: insert out row', async () => {
      const { error } = await supabase.from('player_time_logs').insert({
        fixture_id: fixtureId,
        player_id: playerOut,
        period_id: period.id,
        time_on_minute: 0,
        is_starter: true,
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
}

export async function submitSubstitutions(
  args: SubmitSubstitutionsArgs,
): Promise<SubmitSubstitutionsResult> {
  const { fixtureId, pairs, currentMinute, totalMatchMinute, currentSeconds } = args;
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
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await applyPair(fixtureId, period, pair, {
          currentMinute,
          totalMatchMinute,
          durationMinute,
        });
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
  }

  return { committedPairIds };
}
