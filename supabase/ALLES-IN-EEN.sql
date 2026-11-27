-- ALLES IN ÉÉN: draai dit één keer in Supabase → SQL Editor. Veilig om vaker te draaien.
-- Supabase waarschuwt voor 'destructive operations': dat zijn alleen 'drop policy if exists'-regels
-- die meteen opnieuw worden aangemaakt. Er wordt geen data verwijderd.

-- ===================== fix-permissions.sql =====================
-- One-time fix: run this in Supabase → SQL Editor if the app says
-- "permission denied for table ...". Safe to run more than once.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ===================== add-friends-of.sql =====================
-- Someone's friends list, visible to themselves and to their friends (so you can add each other).
create or replace function public.friends_of(uid uuid)
returns setof public.profiles language sql stable security definer set search_path = public as $$
  select p.*
  from friendships f
  join profiles p on p.id = case when f.requester_id = uid then f.addressee_id else f.requester_id end
  where f.status = 'accepted'
    and uid in (f.requester_id, f.addressee_id)
    and (uid = auth.uid() or public.are_friends(auth.uid(), uid))
  order by lower(coalesce(p.display_name, p.username, ''));
$$;
revoke execute on function public.friends_of(uuid) from public, anon;
grant  execute on function public.friends_of(uuid) to authenticated;

-- Make the API see new functions right away.
notify pgrst, 'reload schema';

-- ===================== add-rolled-count.sql =====================
-- How many times someone rolled, without double counting a joint that several people checked in.
-- Roller tags for the same strain less than 3 hours apart count as one session. Within a session,
-- each check-in by the same person is a separate joint, so the session counts as the most
-- check-ins any one person posted in it.
create or replace function public.rolled_count(uid uuid)
returns integer language sql stable security definer set search_path = public as $$
  with tags as (
    select c.user_id as poster, c.strain_id, c.created_at
    from checkin_people cp
    join checkins c on c.id = cp.checkin_id
    where cp.user_id = uid and cp.role = 'roller'
      and (uid = auth.uid() or public.are_friends(auth.uid(), uid))
  ),
  marked as (
    select *, case when created_at - lag(created_at) over (partition by strain_id order by created_at)
                        <= interval '3 hours' then 0 else 1 end as new_session
    from tags
  ),
  sessions as (
    select *, sum(new_session) over (partition by strain_id order by created_at rows unbounded preceding) as session
    from marked
  ),
  per_poster as (
    select strain_id, session, poster, count(*) as n from sessions group by strain_id, session, poster
  ),
  per_session as (
    select strain_id, session, max(n) as n from per_poster group by strain_id, session
  )
  select coalesce(sum(n), 0)::integer from per_session;
$$;
revoke execute on function public.rolled_count(uuid) from public, anon;
grant  execute on function public.rolled_count(uuid) to authenticated;

-- ===================== add-public-stats.sql =====================
create or replace function public.rolled_count(uid uuid)
returns integer language sql stable security definer set search_path = public as $$
  with tags as (
    select c.user_id as poster, c.strain_id, c.created_at
    from checkin_people cp
    join checkins c on c.id = cp.checkin_id
    where cp.user_id = uid and cp.role = 'roller'
  ),
  marked as (
    select *, case when created_at - lag(created_at) over (partition by strain_id order by created_at)
                        <= interval '3 hours' then 0 else 1 end as new_session
    from tags
  ),
  sessions as (
    select *, sum(new_session) over (partition by strain_id order by created_at rows unbounded preceding) as session
    from marked
  ),
  per_poster as (
    select strain_id, session, poster, count(*) as n from sessions group by strain_id, session, poster
  ),
  per_session as (
    select strain_id, session, max(n) as n from per_poster group by strain_id, session
  )
  select coalesce(sum(n), 0)::integer from per_session;
$$;
revoke execute on function public.rolled_count(uuid) from public, anon;
grant  execute on function public.rolled_count(uuid) to authenticated;

-- Public stats: any logged-in user can see anyone's stats and badges.
-- The check-ins themselves stay friends-only; this only returns what the stats need.
create or replace function public.profile_stats_data(uid uuid)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', c.id, 'user_id', c.user_id, 'strain_id', c.strain_id, 'method', c.method, 'rating', c.rating,
    'bought_at', c.bought_at, 'smoked_at', c.smoked_at, 'created_at', c.created_at,
    'strain', json_build_object('id', s.id, 'name', s.name, 'type', s.type),
    'people', coalesce((
      select json_agg(json_build_object(
        'id', cp.id, 'role', cp.role, 'user_id', cp.user_id, 'name', cp.name,
        'profile', case when p.id is null then null else json_build_object(
          'id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url) end))
      from checkin_people cp left join profiles p on p.id = cp.user_id
      where cp.checkin_id = c.id), '[]'::json)
  ) order by c.created_at desc), '[]'::json)
  from checkins c join strains s on s.id = c.strain_id
  where c.user_id = uid;
$$;
revoke execute on function public.profile_stats_data(uuid) from public, anon;
grant  execute on function public.profile_stats_data(uuid) to authenticated;

-- ===================== fix-rotation.sql =====================
-- "Zelfde rotation" fix. Safe to run more than once (also adds the column if add-sessions.sql never ran).
alter table public.checkins add column if not exists session_of bigint;
create index if not exists checkins_session_idx on public.checkins (session_of);

-- You may join a session when you can see at least one check-in in it. The first check-in of a
-- rotation can belong to someone you're not friends with (a friend of a friend), or be deleted.
create or replace function public.can_join_session(sid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from checkins c
    where (c.id = sid or c.session_of = sid)
      and (c.user_id = auth.uid() or are_friends(auth.uid(), c.user_id) or is_tagged_in(c.id))
  );
$$;
revoke execute on function public.can_join_session(bigint) from public, anon;
grant  execute on function public.can_join_session(bigint) to authenticated;

drop policy if exists "checkins create" on public.checkins;
create policy "checkins create" on public.checkins for insert to authenticated
  with check (user_id = auth.uid() and (session_of is null or public.can_join_session(session_of)));

-- ===================== add-badges.sql =====================
-- Badges: hand-out badges on profiles, and badge data in the public stats. Safe to run more than once.
alter table public.profiles add column if not exists special_badges text[] not null default '{}';

-- Users may edit their own profile, but not hand themselves badges.
revoke update on public.profiles from authenticated;
grant update (username, display_name, bio, avatar_url) on public.profiles to authenticated;

-- The first 5: OG badge for everyone, and the maker badge for the maker.
-- (adds to the existing badges instead of overwriting them, so re-running never takes a badge away)
update public.profiles set special_badges = array(select distinct unnest(special_badges || array['og']))
  where username in ('baapturner1989', 'blownouts', 'victorrastabos', 'larry', 'mielgerbaaps');
update public.profiles set special_badges = array(select distinct unnest(special_badges || array['maker']))
  where username = 'mielgerbaaps';

create or replace function public.profile_stats_data(uid uuid)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', c.id, 'user_id', c.user_id, 'strain_id', c.strain_id, 'method', c.method, 'rating', c.rating,
    'bought_at', c.bought_at, 'smoked_at', c.smoked_at, 'created_at', c.created_at,
    -- for badges: whether there's a photo / notes (not the content), and rotations
    'photo_path', case when c.photo_path is not null then 'hidden' end,
    'notes', case when c.notes is not null then 'hidden' end,
    'session_of', c.session_of,
    'strain', json_build_object('id', s.id, 'name', s.name, 'type', s.type),
    'people', coalesce((
      select json_agg(json_build_object(
        'id', cp.id, 'role', cp.role, 'user_id', cp.user_id, 'name', cp.name,
        'profile', case when p.id is null then null else json_build_object(
          'id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url) end))
      from checkin_people cp left join profiles p on p.id = cp.user_id
      where cp.checkin_id = c.id), '[]'::json)
  ) order by c.created_at desc), '[]'::json)
  from checkins c join strains s on s.id = c.strain_id
  where c.user_id = uid;
$$;

-- Ringbaap as a method.
alter table public.checkins drop constraint if exists checkins_method_check;
alter table public.checkins add constraint checkins_method_check
  check (method in ('joint', 'voorie', 'ringbaap', 'blunt', 'spliff', 'bong', 'pipe', 'vape', 'edible', 'other'));

notify pgrst, 'reload schema';

-- ===================== add-gummies.sql =====================
alter table public.checkins drop constraint if exists checkins_method_check;
alter table public.checkins add constraint checkins_method_check
  check (method in ('joint', 'voorie', 'ringbaap', 'blunt', 'spliff', 'bong', 'pipe', 'vape', 'edible', 'gummy', 'other'));

-- ===================== add-notifications.sql =====================
-- Notifications when someone tags you. Safe to run more than once.
-- When each tag was added (old tags get the time of their check-in).
alter table public.checkin_people add column if not exists created_at timestamptz;
update public.checkin_people cp set created_at = c.created_at
  from public.checkins c where c.id = cp.checkin_id and cp.created_at is null;
alter table public.checkin_people alter column created_at set default now();
alter table public.checkin_people alter column created_at set not null;
create index if not exists checkin_people_user_created_idx on public.checkin_people (user_id, created_at desc);

-- When you last opened your notifications (everything after this counts as new).
alter table public.profiles add column if not exists notifications_seen_at timestamptz not null default now();
grant update (notifications_seen_at) on public.profiles to authenticated;

notify pgrst, 'reload schema';

-- ===================== add-baapring.sql =====================
-- De Baapring: the word-chain party game inside Untakkd. Safe to run more than once.

create table if not exists public.baapring_games (
  id         bigint generated always as identity primary key,
  host_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  maastricht boolean not null default false,
  created_at timestamptz not null default now()
);

-- one row per player per game; a player is an Untakkd user or a guest with just a name
create table if not exists public.baapring_results (
  id          bigint generated always as identity primary key,
  game_id     bigint not null references public.baapring_games on delete cascade,
  user_id     uuid references public.profiles on delete cascade,
  guest_name  text check (char_length(guest_name) between 1 and 40),
  position    int not null default 0,
  poffen      int not null default 0 check (poffen >= 0),
  beurten     int not null default 0 check (beurten >= 0),
  bouncers    int not null default 0 check (bouncers >= 0),
  palindromen int not null default 0 check (palindromen >= 0),
  jillas      int not null default 0 check (jillas >= 0),
  created_at  timestamptz not null default now(),
  check ((user_id is null) <> (guest_name is null))
);
create index if not exists baapring_results_user_idx on public.baapring_results (user_id);

-- your group's own categories: visible to you and your friends
create table if not exists public.baapring_categories (
  id         bigint generated always as identity primary key,
  text       text not null check (char_length(trim(text)) between 2 and 120),
  created_by uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists baapring_categories_creator_idx on public.baapring_categories (created_by);

alter table public.baapring_games      enable row level security;
alter table public.baapring_results    enable row level security;
alter table public.baapring_categories enable row level security;

drop policy if exists "baapring games readable" on public.baapring_games;
drop policy if exists "baapring games host"     on public.baapring_games;
drop policy if exists "baapring games delete"   on public.baapring_games;
create policy "baapring games readable" on public.baapring_games for select to authenticated using (true);
create policy "baapring games host"     on public.baapring_games for insert to authenticated with check (host_id = auth.uid());
create policy "baapring games delete"   on public.baapring_games for delete to authenticated using (host_id = auth.uid());

-- scores are public like the other stats; only the host saves them, and only for themselves, friends or guests
drop policy if exists "baapring results readable" on public.baapring_results;
drop policy if exists "baapring results save"     on public.baapring_results;
create policy "baapring results readable" on public.baapring_results for select to authenticated using (true);
create policy "baapring results save" on public.baapring_results for insert to authenticated with check (
  exists (select 1 from public.baapring_games g where g.id = game_id and g.host_id = auth.uid())
  and (user_id is null or user_id = auth.uid() or public.are_friends(auth.uid(), user_id))
);

drop policy if exists "baapring categories visible" on public.baapring_categories;
drop policy if exists "baapring categories add"     on public.baapring_categories;
drop policy if exists "baapring categories delete"  on public.baapring_categories;
-- Admin = the profile with the 'maker' badge (only settable from the SQL Editor, not from the app).
alter table public.profiles add column if not exists special_badges text[] not null default '{}';
update public.profiles set special_badges = array(select distinct unnest(special_badges || array['maker', 'og']))
  where username = 'mielgerbaaps';
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and 'maker' = any(special_badges));
$$;
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;

-- your own + your friends' questions; the admin sees and can delete everyone's
create policy "baapring categories visible" on public.baapring_categories for select to authenticated
  using (created_by = auth.uid() or public.are_friends(auth.uid(), created_by) or public.is_admin());
create policy "baapring categories add"    on public.baapring_categories for insert to authenticated with check (created_by = auth.uid());
create policy "baapring categories delete" on public.baapring_categories for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

-- new tables need their own grants (the earlier grant only covered tables that existed then)
grant select, insert, delete on public.baapring_games, public.baapring_results, public.baapring_categories to authenticated;
grant usage, select on all sequences in schema public to authenticated;

notify pgrst, 'reload schema';

-- ===================== eerste ringbaap badge =====================
-- "The One Ringbaap to Rule Them All": handed out automatically to everyone in the rotation of the
-- very first Ringbaap check-in (posters + people tagged in it). Runs after every new check-in or tag.
create or replace function public.award_first_ringbaap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  with first_ring as (
    select coalesce(session_of, id) as s from checkins where method = 'ringbaap' order by created_at limit 1
  ), session_checkins as (
    select c.id, c.user_id from checkins c, first_ring f where c.id = f.s or c.session_of = f.s
  ), people as (
    select user_id from session_checkins
    union
    select cp.user_id from checkin_people cp join session_checkins sc on sc.id = cp.checkin_id where cp.user_id is not null
  )
  update profiles set special_badges = array_append(special_badges, 'ringbaap1')
  where id in (select user_id from people) and not ('ringbaap1' = any(special_badges));
  return null;
end;
$$;
drop trigger if exists award_first_ringbaap_checkins on public.checkins;
create trigger award_first_ringbaap_checkins after insert or update on public.checkins
  for each statement execute function public.award_first_ringbaap();
drop trigger if exists award_first_ringbaap_people on public.checkin_people;
create trigger award_first_ringbaap_people after insert on public.checkin_people
  for each statement execute function public.award_first_ringbaap();

-- ===================== add-roll-style.sql =====================
-- How it was rolled: normal or inside out ("iso"). Only filled when someone rolled it.
alter table public.checkins add column if not exists roll_style text check (roll_style in ('normaal', 'inside_out'));

-- Like rolled_count, but only inside-out joints (same rule: a joint checked in by several people counts once).
create or replace function public.rolled_iso_count(uid uuid)
returns integer language sql stable security definer set search_path = public as $$
  with tags as (
    select c.user_id as poster, c.strain_id, c.created_at
    from checkin_people cp
    join checkins c on c.id = cp.checkin_id
    where cp.user_id = uid and cp.role = 'roller' and c.roll_style = 'inside_out'
  ),
  marked as (
    select *, case when created_at - lag(created_at) over (partition by strain_id order by created_at)
                        <= interval '3 hours' then 0 else 1 end as new_session
    from tags
  ),
  sessions as (
    select *, sum(new_session) over (partition by strain_id order by created_at rows unbounded preceding) as session
    from marked
  ),
  per_poster as (
    select strain_id, session, poster, count(*) as n from sessions group by strain_id, session, poster
  ),
  per_session as (
    select strain_id, session, max(n) as n from per_poster group by strain_id, session
  )
  select coalesce(sum(n), 0)::integer from per_session;
$$;
revoke execute on function public.rolled_iso_count(uuid) from public, anon;
grant  execute on function public.rolled_iso_count(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ===================== check =====================
-- You should see 9 rows with "ok".
select 'friends_of' as wat, case when exists (select 1 from pg_proc where proname = 'friends_of') then 'ok' else 'MIST' end as status
union all select 'rolled_count', case when exists (select 1 from pg_proc where proname = 'rolled_count') then 'ok' else 'MIST' end
union all select 'profile_stats_data', case when exists (select 1 from pg_proc where proname = 'profile_stats_data') then 'ok' else 'MIST' end
union all select 'can_join_session', case when exists (select 1 from pg_proc where proname = 'can_join_session') then 'ok' else 'MIST' end
union all select 'special_badges', case when exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'special_badges') then 'ok' else 'MIST' end
union all select 'notifications', case when exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'notifications_seen_at') then 'ok' else 'MIST' end
union all select 'ringbaap badge', case when exists (select 1 from pg_proc where proname = 'award_first_ringbaap') then 'ok' else 'MIST' end
union all select 'inside out', case when exists (select 1 from pg_proc where proname = 'rolled_iso_count') then 'ok' else 'MIST' end
union all select 'baapring', case when exists (select 1 from information_schema.tables where table_name = 'baapring_categories') then 'ok' else 'MIST' end;
