-- Run once in Supabase → SQL Editor: normal / inside-out rolling + the iso badge.
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
