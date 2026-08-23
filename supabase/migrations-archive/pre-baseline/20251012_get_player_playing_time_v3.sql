-- Versioned RPC for player time calculation using period caps from match_periods
-- New function: public.get_player_playing_time_v3()

begin;

create or replace function public.get_player_playing_time_v3()
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
with base as (
  select
    ptl.fixture_id,
    ptl.player_id,
    ptl.period_id,
    mp.planned_duration_minutes as cap_minutes,
    case when coalesce(ptl.is_starter, false) then 0 else ptl.time_on_minute end as start_min,
    ptl.time_off_minute
  from public.player_time_logs ptl
  left join public.match_periods mp on mp.id = ptl.period_id
),
period_contrib as (
  select
    fixture_id,
    player_id,
    period_id,
    case
      when cap_minutes is null then 0
      else greatest(0, least(coalesce(time_off_minute, cap_minutes), cap_minutes) - coalesce(start_min, 0))
    end as minutes_in_period
  from base
),
fixture_sums as (
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

commit;
