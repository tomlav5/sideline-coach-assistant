/**
 * Duplicate-row guard for `player_time_logs` (BUG-009).
 *
 * `unique_player_period_fixture` used to be the only thing stopping a second
 * row for the same (fixture_id, player_id, period_id) — see
 * docs/BUG-009-PLAYER-TIME-LOGS.md §5/§7. This is the pure lookup those
 * app-level guards are built on: "does this player already have a row for
 * this period?"
 */

export interface PlayerPeriodKey {
  player_id: string;
  period_id: string;
}

export function hasExistingPlayerTimeLog<T extends PlayerPeriodKey>(
  existing: readonly T[],
  playerId: string,
  periodId: string,
): boolean {
  return existing.some((row) => row.player_id === playerId && row.period_id === periodId);
}
