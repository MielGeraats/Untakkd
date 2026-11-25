-- Run once in Supabase → SQL Editor.
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
