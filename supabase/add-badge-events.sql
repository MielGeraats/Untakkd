-- Run once in Supabase → SQL Editor: badge history for Meldingen.
-- Badge history: one row each time you earn a badge or level up (shown in Meldingen).
-- 'silent' rows are the starting point for badges you already had before this existed.
create table if not exists public.badge_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  badge_id   text not null,
  level      int not null default 1,
  name       text not null,
  emoji      text not null,
  silent     boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, badge_id, level)
);
create index if not exists badge_events_user_idx on public.badge_events (user_id, created_at desc);
alter table public.badge_events enable row level security;
drop policy if exists "badge events own" on public.badge_events;
drop policy if exists "badge events add" on public.badge_events;
create policy "badge events own" on public.badge_events for select to authenticated using (user_id = auth.uid());
create policy "badge events add" on public.badge_events for insert to authenticated with check (user_id = auth.uid());
grant select, insert on public.badge_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;
notify pgrst, 'reload schema';
