-- Vocab Quest database schema.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- Word / expression pairs ---------------------------------------------------
create table if not exists public.words (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  en          text not null,
  hu          text not null,
  kind        text not null default 'word' check (kind in ('word', 'expression')),
  -- normalized English, used to detect "same word again" when a new photo is scanned
  en_key      text generated always as (lower(btrim(en))) stored,
  -- Leitner spaced repetition: box 1 = learn often, box 5 = mastered
  box         int  not null default 1 check (box between 1 and 5),
  due_at      timestamptz not null default now(),
  correct     int  not null default 0,
  wrong       int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, en_key)
);

create index if not exists words_due_idx on public.words (user_id, due_at);

-- Player profile: XP, streak, badges ------------------------------------------
create table if not exists public.profiles (
  user_id      uuid primary key default auth.uid() references auth.users on delete cascade,
  xp           int  not null default 0,
  streak       int  not null default 0,
  best_streak  int  not null default 0,
  last_played  date,
  badges       text[] not null default '{}',
  updated_at   timestamptz not null default now()
);

-- One row per finished game round, for history and stats ---------------------
create table if not exists public.rounds (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  game        text not null,
  score       int  not null,
  total       int  not null,
  xp          int  not null,
  seconds     int,
  created_at  timestamptz not null default now()
);

-- Row level security: every user only ever sees their own rows ---------------
alter table public.words    enable row level security;
alter table public.profiles enable row level security;
alter table public.rounds   enable row level security;

create policy "own words"    on public.words    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own profile"  on public.profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rounds"   on public.rounds   for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists words_touch on public.words;
create trigger words_touch before update on public.words
  for each row execute function public.touch_updated_at();
