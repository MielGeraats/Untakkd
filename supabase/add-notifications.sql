-- Run once in Supabase → SQL Editor.
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
