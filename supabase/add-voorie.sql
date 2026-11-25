-- Run once in Supabase → SQL Editor: adds "voorie" (pre-roll) as a method.
alter table public.checkins drop constraint if exists checkins_method_check;
alter table public.checkins add constraint checkins_method_check
  check (method in ('joint', 'voorie', 'blunt', 'spliff', 'bong', 'pipe', 'vape', 'edible', 'other'));
