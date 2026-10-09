-- Touchline initial relational schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 2 and 80),
  status text not null default 'upcoming' check (status in ('active', 'archived', 'upcoming')),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or end_date is null or end_date >= start_date)
);

create unique index if not exists one_active_season on public.seasons ((status)) where status = 'active';

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 70),
  manager_name text,
  ign text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, name)
);

create table if not exists public.fixtures (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  matchday integer not null check (matchday >= 1),
  home_team_id uuid not null references public.teams(id) on delete restrict,
  away_team_id uuid not null references public.teams(id) on delete restrict,
  scheduled_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'postponed', 'cancelled')),
  home_score integer,
  away_score integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint different_teams check (home_team_id <> away_team_id),
  constraint scores_nonnegative check (
    (home_score is null or home_score >= 0) and (away_score is null or away_score >= 0)
  ),
  constraint completed_has_scores check (
    status <> 'completed' or (home_score is not null and away_score is not null)
  )
);

create index if not exists teams_season_idx on public.teams(season_id);
create index if not exists fixtures_season_matchday_idx on public.fixtures(season_id, matchday);
create index if not exists fixtures_status_idx on public.fixtures(status);
create index if not exists fixtures_home_team_idx on public.fixtures(home_team_id);
create index if not exists fixtures_away_team_idx on public.fixtures(away_team_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists seasons_updated_at on public.seasons;
create trigger seasons_updated_at before update on public.seasons for each row execute function public.set_updated_at();
drop trigger if exists teams_updated_at on public.teams;
create trigger teams_updated_at before update on public.teams for each row execute function public.set_updated_at();
drop trigger if exists fixtures_updated_at on public.fixtures;
create trigger fixtures_updated_at before update on public.fixtures for each row execute function public.set_updated_at();
