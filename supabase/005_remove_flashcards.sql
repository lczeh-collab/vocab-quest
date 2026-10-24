-- Vocab Quest: the Flashcards game was removed. This deletes its round history.
-- XP, streaks and badges already earned are kept (they live on the players).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
delete from public.rounds where game = 'flashcards';
