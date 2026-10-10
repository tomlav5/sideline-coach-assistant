// Per-player scorer and assist totals for the Match Report (REPORT-004).
//
// Built from the match_events rows MatchReport already loads (with the `players`
// and `assist_players` joins) — no query of its own. The same tally is the input
// REPORT-003's shareable text will need.

export interface TallyPlayer {
  first_name: string;
  last_name: string;
}

export interface TallyEvent {
  event_type: string;
  is_our_team: boolean;
  player_id?: string | null;
  assist_player_id?: string | null;
  players?: TallyPlayer | null;
  assist_players?: TallyPlayer | null;
}

export interface TallyEntry {
  player_id: string;
  first_name: string;
  last_name: string;
  count: number;
}

export interface MatchTally {
  scorers: TallyEntry[];
  assists: TallyEntry[];
}

// Same rendering as the rest of the report: last_name already holds initials.
export const tallyName = (entry: Pick<TallyEntry, 'first_name' | 'last_name'>): string =>
  `${entry.first_name} ${entry.last_name}`.trim();

const addTo = (
  totals: Map<string, TallyEntry>,
  playerId: string,
  player: TallyPlayer | null | undefined,
) => {
  const existing = totals.get(playerId);
  if (existing) {
    existing.count += 1;
    return;
  }
  totals.set(playerId, {
    player_id: playerId,
    first_name: player?.first_name ?? 'Unknown',
    last_name: player?.last_name ?? '',
    count: 1,
  });
};

// Count descending, then first name ascending — stable regardless of event order.
// Last name and id break any remaining tie so the order is fully deterministic.
const byCountThenName = (a: TallyEntry, b: TallyEntry) =>
  b.count - a.count ||
  a.first_name.localeCompare(b.first_name) ||
  a.last_name.localeCompare(b.last_name) ||
  a.player_id.localeCompare(b.player_id);

export const buildMatchTally = (events: TallyEvent[]): MatchTally => {
  const scorers = new Map<string, TallyEntry>();
  const assists = new Map<string, TallyEntry>();

  for (const event of events) {
    if (event.event_type !== 'goal' || !event.is_our_team) continue;
    if (event.player_id) addTo(scorers, event.player_id, event.players);
    if (event.assist_player_id) addTo(assists, event.assist_player_id, event.assist_players);
  }

  return {
    scorers: [...scorers.values()].sort(byCountThenName),
    assists: [...assists.values()].sort(byCountThenName),
  };
};

const formatTallyLine = (label: string, entries: TallyEntry[]): string | null =>
  entries.length === 0
    ? null
    : `${label}: ${entries.map(e => `${tallyName(e)} ${e.count}`).join(', ')}`;

// Plain-text tally for pasting into FA Full-Time. The caller passes the team
// names and score exactly as the report header shows them.
export const formatTallyText = (
  ourTeamName: string,
  opponentName: string,
  ourGoals: number,
  opponentGoals: number,
  tally: MatchTally,
): string =>
  [
    `${ourTeamName} ${ourGoals}-${opponentGoals} ${opponentName}`,
    formatTallyLine('Scorers', tally.scorers),
    formatTallyLine('Assists', tally.assists),
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
