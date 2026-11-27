-- Run once in Supabase → SQL Editor.
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
update public.profiles set special_badges = array['maker', 'og']
  where username = 'mielgerbaaps' and not ('maker' = any(special_badges));
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
