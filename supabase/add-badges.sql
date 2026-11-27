-- Run once in Supabase → SQL Editor.
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
