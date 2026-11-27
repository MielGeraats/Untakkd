-- Reset ALL De Baapring stats: deletes every saved game and, with it, every score (ELO, poffen, Jilla, ...).
-- Check-ins, friends, badges from check-ins and your own questions are NOT touched. Cannot be undone.
-- First see what will be deleted:
select (select count(*) from public.baapring_games) as potjes, (select count(*) from public.baapring_results) as scores;

-- Then delete (the scores go along automatically):
delete from public.baapring_games;
