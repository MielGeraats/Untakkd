-- Run once in Supabase → SQL Editor: adds "aansluiten bij sessie".
-- Sessions: a check-in can join a friend's check-in. session_of points to the first check-in
-- of the session (no foreign key, so a session stays together if that first one is deleted).
alter table public.checkins add column if not exists session_of bigint;
create index if not exists checkins_session_idx on public.checkins (session_of);

-- you can only join a session you can actually see
drop policy if exists "checkins create" on public.checkins;
create policy "checkins create" on public.checkins for insert to authenticated
  with check (user_id = auth.uid() and (session_of is null or public.can_see_checkin(session_of)));
