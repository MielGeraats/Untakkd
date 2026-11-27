-- Badge "The One Ringbaap to Rule Them All" 💍 for everyone who was at the very first Ringbaap check-in.
-- NOT NEEDED ANYMORE: ALLES-IN-EEN.sql hands this badge out automatically. Keep this only for adding someone by hand
-- (bottom of this file) or to check who has it.
-- Who counts: whoever posted a check-in in that first Ringbaap's rotation, plus everyone tagged in those check-ins.

-- 1. Preview: who gets it?
with first_ring as (
  select coalesce(session_of, id) as s from public.checkins where method = 'ringbaap' order by created_at limit 1
), session_checkins as (
  select c.id, c.user_id from public.checkins c, first_ring f where c.id = f.s or c.session_of = f.s
), people as (
  select user_id from session_checkins
  union
  select cp.user_id from public.checkin_people cp join session_checkins sc on sc.id = cp.checkin_id where cp.user_id is not null
)
select p.username, p.display_name from public.profiles p where p.id in (select user_id from people);

-- 2. Hand out the badge (safe to run twice; nobody gets it double)
with first_ring as (
  select coalesce(session_of, id) as s from public.checkins where method = 'ringbaap' order by created_at limit 1
), session_checkins as (
  select c.id, c.user_id from public.checkins c, first_ring f where c.id = f.s or c.session_of = f.s
), people as (
  select user_id from session_checkins
  union
  select cp.user_id from public.checkin_people cp join session_checkins sc on sc.id = cp.checkin_id where cp.user_id is not null
)
update public.profiles set special_badges = array_append(special_badges, 'ringbaap1')
where id in (select user_id from people) and not ('ringbaap1' = any(special_badges));

-- Someone was there but not in the app? Add them by username:
-- update public.profiles set special_badges = array_append(special_badges, 'ringbaap1')
--   where username = 'VUL_IN' and not ('ringbaap1' = any(special_badges));
