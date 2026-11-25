-- One-time fix: run this in Supabase → SQL Editor if the app says
-- "permission denied for table ...". Safe to run more than once.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
