-- Run once in Supabase → SQL Editor: lets you see a friend's friends.
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
