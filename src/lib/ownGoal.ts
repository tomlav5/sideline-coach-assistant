// Own goals (UX-042). An own goal is an ordinary `event_type: 'goal'` row with
// `is_own_goal = true` — deliberately a flag, not a new event type, because every
// score calculation counts `event_type === 'goal'` by `is_our_team`, and that must
// keep working untouched. `is_our_team` still means the side the goal COUNTED FOR.
//
// An own goal credits nobody: no scorer, no assist, and it is never a penalty. The
// match_events_own_goal_check constraint enforces the same rule in the database.

export const OWN_GOAL_FIELDS = {
  is_own_goal: true,
  player_id: null,
  assist_player_id: null,
  is_penalty: false,
} as const;

// Applied last to a goal's write payload. When `isOwnGoal` is false the payload is
// returned as-is — same object, no `is_own_goal` key added — so an ordinary goal
// writes exactly what it wrote before own goals existed.
export function applyOwnGoal<T extends object>(
  payload: T,
  isOwnGoal: boolean,
): T | Omit<T, keyof typeof OWN_GOAL_FIELDS> & typeof OWN_GOAL_FIELDS {
  return isOwnGoal ? { ...payload, ...OWN_GOAL_FIELDS } : payload;
}

export interface ScorerLabelEvent {
  is_our_team: boolean;
  is_own_goal?: boolean | null;
}

// What to show in place of a scorer's name when a goal has no credited player.
// Before UX-042 an our-team goal with no player had no legitimate meaning, so it
// read "Unknown"; now that only happens for genuinely bad data.
export const goalScorerFallback = (event: ScorerLabelEvent): string =>
  event.is_own_goal ? 'Own goal' : event.is_our_team ? 'Unknown' : 'Opposition';
