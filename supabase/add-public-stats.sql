-- Run once in Supabase → SQL Editor: makes stats and badges visible to everyone.
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
