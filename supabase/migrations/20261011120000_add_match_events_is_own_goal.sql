-- UX-042: record own goals.
--
-- An own goal is an ordinary 'goal' event with is_own_goal = true — a flag, not a
-- new event_type, because every score calculation (client and the fixture views)
-- counts event_type = 'goal' by is_our_team, and must keep doing so unchanged.
-- is_our_team keeps its meaning: the side the goal counted FOR.
--
-- Non-breaking: NOT NULL with a default, so existing rows need no backfill and
-- every existing insert (which never names the column) keeps working.
ALTER TABLE public.match_events
  ADD COLUMN is_own_goal boolean NOT NULL DEFAULT false;

-- An own goal credits nobody and is never a penalty. Every existing row has
-- is_own_goal = false, so this validates trivially against current data.
-- is_penalty is nullable, hence IS NOT TRUE rather than = false.
ALTER TABLE public.match_events
  ADD CONSTRAINT match_events_own_goal_check CHECK (
    NOT is_own_goal
    OR (
      event_type = 'goal'
      AND player_id IS NULL
      AND assist_player_id IS NULL
      AND is_penalty IS NOT TRUE
    )
  );

COMMENT ON COLUMN public.match_events.is_own_goal IS
  'UX-042: goal put into their own net by a player of the side that conceded. is_our_team is the side it counted for. player_id and assist_player_id must be null.';
