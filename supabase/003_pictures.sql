-- Vocab Quest: AI pictures for words.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- One picture per English word per family, so siblings with the same word share it.
create table if not exists public.word_pictures (
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  en_key      text not null,              -- lower(trim(english)), same as words.en_key
  path        text not null,              -- file in the "pictures" storage bucket
  scene       text not null,              -- what the picture shows (the drawing prompt)
  example     text,                       -- simple expression for words that are hard to draw
  created_at  timestamptz not null default now(),
  primary key (user_id, en_key)
);

-- Every picture made, to cap daily spending on image generation.
create table if not exists public.picture_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists picture_log_user_time on public.picture_log (user_id, created_at);

alter table public.word_pictures enable row level security;
alter table public.picture_log   enable row level security;

drop policy if exists "own pictures" on public.word_pictures;
drop policy if exists "own picture log" on public.picture_log;
create policy "own pictures"    on public.word_pictures for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own picture log" on public.picture_log   for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Private storage bucket; each family can only use its own folder "<user id>/...".
insert into storage.buckets (id, name, public)
values ('pictures', 'pictures', false)
on conflict (id) do nothing;

drop policy if exists "own picture files read"   on storage.objects;
drop policy if exists "own picture files insert" on storage.objects;
drop policy if exists "own picture files delete" on storage.objects;
create policy "own picture files read" on storage.objects for select to authenticated
  using (bucket_id = 'pictures' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own picture files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'pictures' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own picture files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'pictures' and (storage.foldername(name))[1] = auth.uid()::text);
