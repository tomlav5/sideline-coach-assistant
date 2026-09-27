/**
 * Match Report playing-time aggregation (BUG-036).
 *
 * `time_on_minute` / `time_off_minute` on `player_time_logs` are PERIOD-RELATIVE
 * durations (see src/lib/matchMinute.ts), so they are only meaningful alongside
 * the period they belong to. Never take a min/max across periods — keep each
 * row as its own spell, labelled with its period number.
 */

export interface PlayerSpell {
  period_number: number | null;
  time_on_minute: number | null;
  /** null while the spell is still open (period running, or never closed). */
  time_off_minute: number | null;
}

export interface PlayerTimeLogRow {
  player_id: string;
  time_on_minute: number | null;
  time_off_minute: number | null;
  total_period_minutes: number | null;
  is_starter: boolean;
  players: {
    first_name: string;
    last_name: string;
    jersey_number?: number | null;
  };
  match_periods: { period_number: number } | null;
}

export interface PlayerTime {
  player_id: string;
  spells: PlayerSpell[];
  total_minutes: number;
  is_starter: boolean;
  players: PlayerTimeLogRow['players'];
}

// Nulls sort last for periods (a row with no period can't be placed) and first
// for on-minutes (an unknown start is treated as the start of the period).
const comparePeriod = (a: number | null, b: number | null) =>
  (a ?? Number.POSITIVE_INFINITY) - (b ?? Number.POSITIVE_INFINITY);
const compareOn = (a: number | null, b: number | null) => (a ?? -1) - (b ?? -1);

type RowWithSpell = { row: PlayerTimeLogRow; spell: PlayerSpell };

const compareSpells = (a: PlayerSpell, b: PlayerSpell) =>
  comparePeriod(a.period_number, b.period_number) || compareOn(a.time_on_minute, b.time_on_minute);

/**
 * Group raw `player_time_logs` rows into one entry per player, each carrying
 * every spell in period order then time order. Does not depend on the order
 * the rows arrive in.
 */
export const buildPlayerTimes = (rows: PlayerTimeLogRow[]): PlayerTime[] => {
  const byPlayer = new Map<string, RowWithSpell[]>();

  for (const row of rows) {
    const spell: PlayerSpell = {
      period_number: row.match_periods?.period_number ?? null,
      time_on_minute: row.time_on_minute,
      time_off_minute: row.time_off_minute,
    };
    const list = byPlayer.get(row.player_id);
    if (list) list.push({ row, spell });
    else byPlayer.set(row.player_id, [{ row, spell }]);
  }

  const result: PlayerTime[] = [];
  for (const [playerId, entries] of byPlayer) {
    entries.sort((a, b) => compareSpells(a.spell, b.spell));
    const first = entries[0];
    result.push({
      player_id: playerId,
      spells: entries.map((e) => e.spell),
      // total_period_minutes is already correct per row; summing it is unchanged.
      total_minutes: entries.reduce((sum, e) => sum + (e.row.total_period_minutes || 0), 0),
      // Starter means "on the pitch at kick-off": only the earliest period's
      // first spell counts, not a starter row in any later period.
      is_starter: first.row.is_starter,
      players: first.row.players,
    });
  }

  return result.sort((a, b) => {
    if (a.is_starter !== b.is_starter) return a.is_starter ? -1 : 1;
    return b.total_minutes - a.total_minutes;
  });
};

/**
 * "P1 13'-25'". An open spell renders as "P1 13'-" — never a fabricated off
 * minute. A zero-length spell renders as-is so bad data stays visible.
 */
export const formatSpell = (spell: PlayerSpell): string => {
  const period = spell.period_number ?? '?';
  const on = spell.time_on_minute ?? '?';
  const off = spell.time_off_minute === null ? '' : `${spell.time_off_minute}'`;
  return `P${period} ${on}'-${off}`;
};
