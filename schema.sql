-- ============================================================
--  World Cup 2026 Prediction Pool — Supabase schema
--  Paste this whole file into: Supabase Dashboard
--    -> SQL Editor -> New query -> Run
--  Safe to run once on a fresh project.
-- ============================================================

-- 1. PROFILES -------------------------------------------------
-- One row per player. display_name is the "name" they log in with.
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- When someone signs up, auto-create their profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Player'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. STAGE POINTS --------------------------------------------
-- Your scoring tiers. Edit these rows any time (Table Editor) to retune.
create table public.stage_points (
  stage  text primary key,
  label  text not null,
  points int  not null
);

insert into public.stage_points (stage, label, points) values
  ('GROUP_STAGE',    'Group stage',          1),
  ('LAST_32',        'Round of 32',          2),
  ('LAST_16',        'Round of 16',          4),
  ('QUARTER_FINALS', 'Quarter-finals',       6),
  ('SEMI_FINALS',    'Semi-finals',          8),
  ('THIRD_PLACE',    'Third-place play-off', 0),  -- left unscored
  ('FINAL',          'Final',               10);

-- 3. ROUNDS ---------------------------------------------------
-- A "week" / lock window. Predictions for its fixtures close at lock_at.
create table public.rounds (
  key     text primary key,        -- e.g. GROUP_MD1, LAST_16, FINAL
  name    text not null,
  lock_at timestamptz,             -- null = not locked yet
  sort    int not null default 0
);

-- 4. FIXTURES -------------------------------------------------
-- Filled automatically by the sync-fixtures function from football-data.org.
create table public.fixtures (
  id         bigint primary key,            -- football-data.org match id
  round_key  text references public.rounds(key),
  stage      text references public.stage_points(stage),
  home_team  text not null,
  away_team  text not null,
  kickoff_at timestamptz,
  matchday   int,
  result     text,                          -- HOME_TEAM | DRAW | AWAY_TEAM | null
  finished   boolean not null default false
);

-- 5. PREDICTIONS ---------------------------------------------
create table public.predictions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid   not null references public.profiles(id) on delete cascade,
  fixture_id bigint not null references public.fixtures(id) on delete cascade,
  pick       text   not null check (pick in ('HOME_TEAM','DRAW','AWAY_TEAM')),
  created_at timestamptz not null default now(),
  unique (user_id, fixture_id)
);

-- Reject any pick made/changed after that round has locked.
-- (The app already hides locked rounds; this enforces it server-side too.)
create or replace function public.enforce_lock()
returns trigger
language plpgsql
as $$
declare lock_time timestamptz;
begin
  select r.lock_at into lock_time
  from public.fixtures f
  join public.rounds r on r.key = f.round_key
  where f.id = new.fixture_id;

  if lock_time is not null and now() >= lock_time then
    raise exception 'This round is locked — predictions can no longer be changed.';
  end if;
  return new;
end;
$$;

create trigger predictions_lock_guard
  before insert or update on public.predictions
  for each row execute function public.enforce_lock();

-- 6. LEADERBOARD ---------------------------------------------
-- Runs server-side so it can tally everyone without exposing raw picks.
--   + stage points for each correct pick (only locked, finished matches)
--   - 3 for every locked round a player did NOT enter at all
-- A player is only penalised for rounds that locked AFTER they joined.
create or replace function public.get_leaderboard()
returns table (display_name text, points bigint, correct bigint)
language sql
security definer set search_path = public
as $$
  with locked_rounds as (
    select key, lock_at from public.rounds
    where lock_at is not null and now() >= lock_at
  ),
  hits as (
    select pr.user_id,
           sum(sp.points)::bigint as pts,
           count(*)::bigint       as correct
    from public.predictions pr
    join public.fixtures    f  on f.id = pr.fixture_id
    join public.stage_points sp on sp.stage = f.stage
    where f.finished and f.result is not null and pr.pick = f.result
    group by pr.user_id
  ),
  misses as (
    select p.id as user_id, count(*)::bigint as skipped
    from public.profiles p
    cross join locked_rounds lr
    where p.created_at < lr.lock_at
      and not exists (
        select 1
        from public.predictions pr
        join public.fixtures f on f.id = pr.fixture_id
        where pr.user_id = p.id and f.round_key = lr.key
      )
    group by p.id
  )
  select p.display_name,
         coalesce(h.pts,0) - coalesce(m.skipped,0) * 3 as points,
         coalesce(h.correct,0) as correct
  from public.profiles p
  left join hits   h on h.user_id = p.id
  left join misses m on m.user_id = p.id
  order by points desc, correct desc, p.display_name;
$$;

grant execute on function public.get_leaderboard() to authenticated;

-- 7. ROW LEVEL SECURITY --------------------------------------
alter table public.profiles     enable row level security;
alter table public.stage_points enable row level security;
alter table public.rounds       enable row level security;
alter table public.fixtures     enable row level security;
alter table public.predictions  enable row level security;

-- Names readable by all players (for the leaderboard); edit only yourself.
create policy "profiles readable"  on public.profiles
  for select to authenticated using (true);
create policy "update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- Reference + fixture data: readable by all signed-in players.
create policy "stage_points readable" on public.stage_points
  for select to authenticated using (true);
create policy "rounds readable"       on public.rounds
  for select to authenticated using (true);
create policy "fixtures readable"     on public.fixtures
  for select to authenticated using (true);

-- Predictions: you can only see and change your OWN.
create policy "read own predictions"   on public.predictions
  for select to authenticated using (auth.uid() = user_id);
create policy "insert own predictions" on public.predictions
  for insert to authenticated with check (auth.uid() = user_id);
create policy "update own predictions" on public.predictions
  for update to authenticated using (auth.uid() = user_id);

-- (The sync function uses the service-role key, which bypasses RLS,
--  so it can write rounds and fixtures.)
