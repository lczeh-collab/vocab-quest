-- Vocab Quest: keep pictures inside the word_pictures table instead of Storage.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- (Run 003_pictures.sql first if you haven't.)

alter table public.word_pictures add column if not exists image bytea;
alter table public.word_pictures alter column path drop not null;

-- Pictures saved to Storage by the earlier version can't be shown any more; remove
-- their rows so "Make pictures" creates them again.
delete from public.word_pictures where image is null;
