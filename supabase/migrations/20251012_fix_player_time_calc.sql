-- Fix playing time calculation to only count minutes when players are on-field
-- Creates or replaces RPC: public.get_player_playing_time()
-- This function aggregates minutes per player based on player_time_logs intervals
-- Assumptions:
--  - time_on_minute = 0 for starters, else set when subbed on
--  - time_off_minute = minute subbed off; if NULL, player played until end of period
--  - total_period_minutes is the configured length of the period (cap)

create or replace function public.get_player_playing_time()
returns table (
  player_id uuid,
  first_name text,
  last_name text,
  team_name text,
  club_name text,
  total_minutes_played integer,
  matches_played integer,
  avg_minutes_per_match integer
)
language sql
stable
as $$
with interval_minutes as (
  select
    ptl.fixture_id,
    ptl.player_id,
    ptl.period_id,
    -- compute start and end bounds for the interval within the period
    case when coalesce(ptl.is_starter, false) then 0 else ptl.time_on_minute end as start_min,
    least(coalesce(ptl.time_off_minute, ptl.total_period_minutes), ptl.total_period_minutes) as end_min,
    ptl.total_period_minutes
  from public.player_time_logs ptl
),
period_contrib as (
  select
    fixture_id,
    player_id,
    period_id,
    case
      when start_min is null then 0
      else greatest(0, end_min - start_min)
    end as minutes_in_period
  from interval_minutes
),
fixture_sums as (
  -- minutes per player per fixture (sum across periods)
  select
    pc.fixture_id,
    pc.player_id,
    sum(pc.minutes_in_period)::int as minutes_in_fixture
  from period_contrib pc
  group by pc.fixture_id, pc.player_id
),
player_totals as (
  select
    fs.player_id,
    sum(fs.minutes_in_fixture)::int as total_minutes_played,
    count(*) filter (where fs.minutes_in_fixture > 0) as matches_played
  from fixture_sums fs
  group by fs.player_id
)
select
  pt.player_id,
  pl.first_name,
  pl.last_name,
  tm.name as team_name,
  c.name as club_name,
  pt.total_minutes_played,
  pt.matches_played,
  case when pt.matches_played > 0 then round(pt.total_minutes_played::numeric / pt.matches_played)::int else 0 end as avg_minutes_per_match
from player_totals pt
join public.players pl on pl.id = pt.player_id
left join public.team_players tp on tp.player_id = pl.id
left join public.teams tm on tm.id = tp.team_id
left join public.clubs c on c.id = tm.club_id
order by pt.total_minutes_played desc, pl.last_name asc, pl.first_name asc;
$$;

-- Optional: Refresh reports helper (if you already have an RPC doing this, keep it separate)
-- You may already have triggers on player_time_logs to refresh materialized views.
