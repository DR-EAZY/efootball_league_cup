-- Public reads, admin-only writes. Never expose service-role keys in the browser.
alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.teams enable row level security;
alter table public.fixtures enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "Profiles: self or admin can read" on public.profiles;
create policy "Profiles: self or admin can read" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles" on public.profiles
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public can read seasons" on public.seasons;
create policy "Public can read seasons" on public.seasons
for select to anon, authenticated using (true);

drop policy if exists "Admins can manage seasons" on public.seasons;
create policy "Admins can manage seasons" on public.seasons
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public can read teams" on public.teams;
create policy "Public can read teams" on public.teams
for select to anon, authenticated using (true);

drop policy if exists "Admins can manage teams" on public.teams;
create policy "Admins can manage teams" on public.teams
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public can read fixtures" on public.fixtures;
create policy "Public can read fixtures" on public.fixtures
for select to anon, authenticated using (true);

drop policy if exists "Admins can manage fixtures" on public.fixtures;
create policy "Admins can manage fixtures" on public.fixtures
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Atomically activate one season. The partial unique index also prevents two active seasons.
create or replace function public.activate_season(target_season_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator permission required';
  end if;
  if not exists (select 1 from public.seasons where id = target_season_id) then
    raise exception 'Season not found';
  end if;

  update public.seasons set status = 'upcoming' where status = 'active' and id <> target_season_id;
  update public.seasons set status = 'active' where id = target_season_id;
end;
$$;
grant execute on function public.activate_season(uuid) to authenticated;

-- Read-only standings view. Stats are derived from completed matches, never separately stored.
create or replace view public.league_standings
with (security_invoker = true)
as
with team_results as (
  select
    t.id as team_id,
    t.season_id,
    t.name as team_name,
    t.logo_url,
    count(f.id) filter (where f.status = 'completed' and f.home_score is not null and f.away_score is not null) as played,
    count(f.id) filter (where f.status = 'completed' and (
      (f.home_team_id = t.id and f.home_score > f.away_score) or
      (f.away_team_id = t.id and f.away_score > f.home_score)
    )) as won,
    count(f.id) filter (where f.status = 'completed' and f.home_score = f.away_score) as drawn,
    count(f.id) filter (where f.status = 'completed' and (
      (f.home_team_id = t.id and f.home_score < f.away_score) or
      (f.away_team_id = t.id and f.away_score < f.home_score)
    )) as lost,
    coalesce(sum(case when f.status = 'completed' then
      case when f.home_team_id = t.id then f.home_score else f.away_score end end), 0) as goals_for,
    coalesce(sum(case when f.status = 'completed' then
      case when f.home_team_id = t.id then f.away_score else f.home_score end end), 0) as goals_against,
    coalesce(sum(case when f.status = 'completed' then
      case
        when (f.home_team_id = t.id and f.home_score > f.away_score) or (f.away_team_id = t.id and f.away_score > f.home_score) then 3
        when f.home_score = f.away_score then 1
        else 0
      end
    end), 0) as points
  from public.teams t
  left join public.fixtures f
    on f.season_id = t.season_id and (f.home_team_id = t.id or f.away_team_id = t.id)
  group by t.id, t.season_id, t.name, t.logo_url
)
select *, goals_for - goals_against as goal_difference
from team_results;

-- Enable Realtime on operational tables where supported.
do $$
begin
  alter publication supabase_realtime add table public.seasons;
exception when duplicate_object then null;
when undefined_object then raise notice 'supabase_realtime publication not found; enable Realtime in Supabase dashboard if needed.';
end $$;
do $$
begin
  alter publication supabase_realtime add table public.teams;
exception when duplicate_object then null;
when undefined_object then raise notice 'supabase_realtime publication not found; enable Realtime in Supabase dashboard if needed.';
end $$;
do $$
begin
  alter publication supabase_realtime add table public.fixtures;
exception when duplicate_object then null;
when undefined_object then raise notice 'supabase_realtime publication not found; enable Realtime in Supabase dashboard if needed.';
end $$;
