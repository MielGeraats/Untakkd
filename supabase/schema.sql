-- =====================================================================
--  Untakkd — database schema
--  Paste this whole file into Supabase → SQL Editor → "Run".
--  Safe to run once on a fresh project.
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  username     text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) <= 40),
  avatar_url   text,
  bio          text check (char_length(bio) <= 160),
  created_at   timestamptz not null default now()
);

create table public.friendships (
  id           bigint generated always as identity primary key,
  requester_id uuid not null default auth.uid() references public.profiles on delete cascade,
  addressee_id uuid not null references public.profiles on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
-- one friendship row per pair, regardless of who asked
create unique index friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table public.strains (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(trim(name)) between 1 and 60),
  type       text not null default 'unknown' check (type in ('indica', 'sativa', 'hybrid', 'unknown')),
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
create unique index strains_name_idx on public.strains (lower(trim(name)));

create table public.checkins (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  strain_id  bigint not null references public.strains on delete restrict,
  method     text not null default 'joint'
             check (method in ('joint', 'blunt', 'spliff', 'bong', 'pipe', 'vape', 'edible', 'other')),
  rating     numeric(2,1) not null check (rating between 0.5 and 5 and rating * 2 = floor(rating * 2)),
  bought_at  text check (char_length(bought_at) <= 80),
  smoked_at  text check (char_length(smoked_at) <= 80),
  notes      text check (char_length(notes) <= 500),
  photo_path text,
  created_at timestamptz not null default now()
);
create index checkins_created_idx on public.checkins (created_at desc);
create index checkins_user_idx    on public.checkins (user_id);
create index checkins_strain_idx  on public.checkins (strain_id);

-- who rolled it / who you smoked with: either a tagged app user OR a free-text name
create table public.checkin_people (
  id         bigint generated always as identity primary key,
  checkin_id bigint not null references public.checkins on delete cascade,
  role       text not null check (role in ('roller', 'buddy')),
  user_id    uuid references public.profiles on delete cascade,
  name       text check (char_length(name) between 1 and 40),
  check ((user_id is null) <> (name is null))
);
create index checkin_people_checkin_idx on public.checkin_people (checkin_id);
create index checkin_people_user_idx    on public.checkin_people (user_id);

create table public.likes (
  checkin_id bigint not null references public.checkins on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (checkin_id, user_id)
);

create table public.comments (
  id         bigint generated always as identity primary key,
  checkin_id bigint not null references public.checkins on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  body       text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_checkin_idx on public.comments (checkin_id);

-- ---------- Helper functions -----------------------------------------

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;

create or replace function public.is_tagged_in(cid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from checkin_people p where p.checkin_id = cid and p.user_id = auth.uid());
$$;

-- You can see a check-in if it's yours, a friend's, or you were tagged in it.
create or replace function public.can_see_checkin(cid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from checkins c
    where c.id = cid
      and (c.user_id = auth.uid() or are_friends(auth.uid(), c.user_id) or is_tagged_in(c.id))
  );
$$;

-- Global per-strain averages (counts every check-in, not just your friends').
create or replace function public.strain_stats()
returns table (strain_id bigint, checkin_count bigint, avg_rating numeric)
language sql stable security definer set search_path = public as $$
  select strain_id, count(*), round(avg(rating), 2) from checkins group by strain_id;
$$;

revoke execute on function public.are_friends(uuid, uuid)  from public, anon;
revoke execute on function public.can_see_checkin(bigint)  from public, anon;
revoke execute on function public.is_tagged_in(bigint)     from public, anon;
revoke execute on function public.strain_stats()           from public, anon;
grant  execute on function public.are_friends(uuid, uuid)  to authenticated;
grant  execute on function public.can_see_checkin(bigint)  to authenticated;
grant  execute on function public.is_tagged_in(bigint)     to authenticated;
grant  execute on function public.strain_stats()           to authenticated;

-- Create a profile automatically when someone signs in for the first time.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name',
                  split_part(new.email, '@', 1)), 40),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ---------------------------------------

alter table public.profiles       enable row level security;
alter table public.friendships    enable row level security;
alter table public.strains        enable row level security;
alter table public.checkins       enable row level security;
alter table public.checkin_people enable row level security;
alter table public.likes          enable row level security;
alter table public.comments       enable row level security;

-- profiles: any logged-in user can find people; you edit only yourself
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- friendships: only the two people involved
create policy "friendships visible to members" on public.friendships for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));
create policy "friendships request" on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
create policy "friendships accept" on public.friendships for update to authenticated
  using (addressee_id = auth.uid()) with check (addressee_id = auth.uid() and status = 'accepted');
create policy "friendships remove" on public.friendships for delete to authenticated
  using (auth.uid() in (requester_id, addressee_id));

-- strains: shared catalogue
create policy "strains readable" on public.strains for select to authenticated using (true);
create policy "strains add" on public.strains for insert to authenticated
  with check (created_by = auth.uid());

-- checkins
-- (checks the row's own columns, so `insert ... returning` works on brand-new rows)
create policy "checkins visible" on public.checkins for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id) or public.is_tagged_in(id));
create policy "checkins create" on public.checkins for insert to authenticated
  with check (user_id = auth.uid());
create policy "checkins edit own" on public.checkins for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "checkins delete own" on public.checkins for delete to authenticated
  using (user_id = auth.uid());

-- checkin_people: only the check-in owner tags, and only themselves or friends
create policy "people visible" on public.checkin_people for select to authenticated
  using (public.can_see_checkin(checkin_id));
create policy "people add" on public.checkin_people for insert to authenticated
  with check (
    exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid())
    and (user_id is null or user_id = auth.uid() or public.are_friends(auth.uid(), user_id))
  );
create policy "people remove" on public.checkin_people for delete to authenticated
  using (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()));

-- likes ("🔥")
create policy "likes visible" on public.likes for select to authenticated
  using (public.can_see_checkin(checkin_id));
create policy "likes add" on public.likes for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_checkin(checkin_id));
create policy "likes remove" on public.likes for delete to authenticated
  using (user_id = auth.uid());

-- comments
create policy "comments visible" on public.comments for select to authenticated
  using (public.can_see_checkin(checkin_id));
create policy "comments add" on public.comments for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_checkin(checkin_id));
create policy "comments remove" on public.comments for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid())
  );

-- ---------- Photo storage --------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and owner = auth.uid());

-- ---------- Table access for logged-in users --------------------------
-- Newer Supabase projects don't expose new tables to the API automatically.
-- These grants let logged-in users reach the tables; the row-level security
-- policies above still decide which rows they can see or change.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

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
