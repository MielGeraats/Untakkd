-- Run once in Supabase → SQL Editor: adds gummies as a method.
alter table public.checkins drop constraint if exists checkins_method_check;
alter table public.checkins add constraint checkins_method_check
  check (method in ('joint', 'voorie', 'ringbaap', 'blunt', 'spliff', 'bong', 'pipe', 'vape', 'edible', 'gummy', 'other'));
