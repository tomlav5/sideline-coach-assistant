import { supabase } from '@/integrations/supabase/client';
import { decideMissingStarterLog } from '@/lib/missingStarterLog';
import { isPeriodOpen } from '@/lib/periodOpen';

/**
 * Step 2 of `EnhancedMatchTracker`'s period-transition effect: open a
 * `player_time_logs` spell in the new period for every player currently on the
 * pitch. Moved here unchanged from the effect so it can be tested, with one
 * addition — the BUG-041 guard below.
 *
 * `elapsedSeconds` is the freshest elapsed time the timer has reported for the
 * new period (the effect passes `currentSecondsRef.current`).
 *
 * BUG-041 (defence in depth): the effect also runs on mount, with the period
 * number the timer loaded. After a reload during a break, or after the final
 * whistle, that is a period that has ENDED. No code path may open a spell in a
 * finished period, so if the resolved period has `actual_end_time` set, warn
 * and insert nothing.
 */
export async function openSpellsForNewPeriod(
  fixtureId: string,
  newPeriodNumber: number,
  elapsedSeconds: number,
): Promise<void> {
  const { data: nextPeriod } = await supabase
    .from('match_periods')
    .select('*')
    .eq('fixture_id', fixtureId)
    .eq('period_number', newPeriodNumber)
    .single();

  if (!nextPeriod) return;

  if (!isPeriodOpen(nextPeriod)) {
    console.warn(
      `[runPeriodTransitions] period ${nextPeriod.id} (number ${newPeriodNumber}) has already ` +
        `ended — not opening any player_time_logs spells in it (BUG-041).`,
    );
    return;
  }

  const { data: onFieldPlayers } = await supabase
    .from('player_match_status')
    .select('player_id')
    .eq('fixture_id', fixtureId)
    .eq('is_on_field', true);

  if (onFieldPlayers && onFieldPlayers.length > 0) {
    // Elapsed minutes in the new period, from the freshest value the
    // timer has reported. Mirrors initMissingStarterLogs —
    // decideMissingStarterLog needs this to place a returning
    // player's un-recorded spell without fabricating one from
    // minute 0 (BUG-011).
    const durationMinute =
      elapsedSeconds > 0 ? Math.floor(elapsedSeconds / 60) : null;

    for (const row of onFieldPlayers) {
      // Read EVERY row for (fixture, player, period), active and
      // closed — an is_active-only check is blind to a CLOSED row,
      // so a player already substituted off in this period reads as
      // missing and a duplicate starter row gets fabricated
      // (BUG-034).
      const { data: rows, error: readErr } = await supabase
        .from('player_time_logs')
        .select('id, is_active')
        .eq('fixture_id', fixtureId)
        .eq('player_id', row.player_id)
        .eq('period_id', nextPeriod.id);
      if (readErr) {
        console.warn(
          `[runPeriodTransitions] could not read time logs for player ${row.player_id} ` +
            `in period ${nextPeriod.id}; skipping`,
          readErr,
        );
        continue;
      }

      const decision = decideMissingStarterLog(rows ?? [], durationMinute);
      if (decision.insert === false) {
        if (decision.reason === 'missing-spell-no-duration') {
          console.error(
            `[runPeriodTransitions] player ${row.player_id} has closed player_time_logs ` +
              `rows in period ${nextPeriod.id} but no active one, and no elapsed time is ` +
              `available to place the spell — skipping insert. This player's minutes may ` +
              `be understated; check Match Data Editor.`,
          );
        }
        continue;
      }
      if (decision.missingSpell) {
        console.error(
          `[runPeriodTransitions] player ${row.player_id} is on the pitch in period ` +
            `${nextPeriod.id} with closed time logs but no active one; their current spell ` +
            `was never recorded. Opening an interval from minute ${decision.timeOnMinute} ` +
            `(is_starter=false) — the un-recorded earlier minutes are lost, so this ` +
            `player's total is understated rather than over-counted (BUG-011).`,
        );
      }
      await supabase
        .from('player_time_logs')
        .insert({
          fixture_id: fixtureId,
          player_id: row.player_id,
          period_id: nextPeriod.id,
          time_on_minute: decision.timeOnMinute,
          is_starter: decision.isStarter,
          is_active: true,
          total_period_minutes: 0,
        });
    }
  }
}
