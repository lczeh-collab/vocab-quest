-- Vocab Quest: family player profiles (name + 4-digit PIN, avatar, colour).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run on a database that already has words: the first player created
-- takes over all existing words, XP and badges.

create extension if not exists pgcrypto with schema extensions;

-- Players: several per family (= per login account) ---------------------------
create table if not exists public.players (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 20),
  avatar       text not null default '🦄',
  color        text not null default 'grape',
  xp           int  not null default 0,
  streak       int  not null default 0,
  best_streak  int  not null default 0,
  last_played  date,
  badges       text[] not null default '{}',
  created_at   timestamptz not null default now()
);
create unique index if not exists players_name_idx on public.players (user_id, lower(btrim(name)));

-- PINs live in their own table that the website can never read directly;
-- only the functions below (running inside the database) can check them.
create table if not exists public.player_pins (
  player_id     uuid primary key references public.players on delete cascade,
  pin_hash      text not null,
  failed_tries  int  not null default 0,
  locked_until  timestamptz
);

alter table public.players     enable row level security;
alter table public.player_pins enable row level security; -- no policies: no direct access

-- Players are created only through create_player(), so there is no insert policy.
drop policy if exists "own players read"   on public.players;
drop policy if exists "own players update" on public.players;
drop policy if exists "own players delete" on public.players;
create policy "own players read"   on public.players for select using (user_id = auth.uid());
create policy "own players update" on public.players for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own players delete" on public.players for delete using (user_id = auth.uid());

-- Words and rounds now belong to a player ------------------------------------
alter table public.words  add column if not exists player_id uuid references public.players on delete cascade;
alter table public.rounds add column if not exists player_id uuid references public.players on delete cascade;

-- The same English word may now exist once per player instead of once per account.
alter table public.words drop constraint if exists words_user_id_en_key_key;
create unique index if not exists words_player_en_key on public.words (player_id, en_key);
create index if not exists words_player_due_idx on public.words (player_id, due_at);

-- Rows may only point at a player of the same family.
create or replace function public.owns_player(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is null or exists (select 1 from public.players where id = p and user_id = auth.uid())
$$;

drop policy if exists "own words"  on public.words;
drop policy if exists "own rounds" on public.rounds;
create policy "own words"  on public.words  for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_player(player_id));
create policy "own rounds" on public.rounds for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_player(player_id));

-- create_player: validates input, stores a hashed PIN --------------------------
create or replace function public.create_player(p_name text, p_pin text, p_avatar text, p_color text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  first_player boolean;
  new_id uuid;
begin
  if uid is null then raise exception 'not logged in'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN must be exactly 4 digits'; end if;

  first_player := not exists (select 1 from players where user_id = uid);

  insert into players (user_id, name, avatar, color)
  values (uid, btrim(p_name), p_avatar, p_color)
  returning id into new_id;

  insert into player_pins (player_id, pin_hash) values (new_id, crypt(p_pin, gen_salt('bf')));

  -- The first player inherits everything created before profiles existed.
  if first_player then
    update words  set player_id = new_id where user_id = uid and player_id is null;
    update rounds set player_id = new_id where user_id = uid and player_id is null;
    update players p
       set xp = pr.xp, streak = pr.streak, best_streak = pr.best_streak,
           last_played = pr.last_played, badges = pr.badges
      from profiles pr
     where pr.user_id = uid and p.id = new_id;
  end if;

  return new_id;
end $$;

-- verify_pin: 5 wrong tries lock the player for 1 minute -----------------------
create or replace function public.verify_pin(p_player uuid, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  rec player_pins%rowtype;
begin
  select pp.* into rec
    from player_pins pp join players p on p.id = pp.player_id
   where pp.player_id = p_player and p.user_id = auth.uid()
   for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'unknown player'); end if;

  if rec.locked_until is not null and rec.locked_until > now() then
    return jsonb_build_object('ok', false, 'locked_seconds', ceil(extract(epoch from rec.locked_until - now())));
  end if;

  if rec.pin_hash = crypt(p_pin, rec.pin_hash) then
    update player_pins set failed_tries = 0, locked_until = null where player_id = p_player;
    return jsonb_build_object('ok', true);
  end if;

  if rec.failed_tries + 1 >= 5 then
    update player_pins set failed_tries = 0, locked_until = now() + interval '1 minute' where player_id = p_player;
    return jsonb_build_object('ok', false, 'locked_seconds', 60);
  end if;

  update player_pins set failed_tries = rec.failed_tries + 1 where player_id = p_player;
  return jsonb_build_object('ok', false, 'tries_left', 4 - rec.failed_tries);
end $$;

-- change_pin: needs the current PIN -------------------------------------------
create or replace function public.change_pin(p_player uuid, p_old text, p_new text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_new !~ '^[0-9]{4}$' then raise exception 'PIN must be exactly 4 digits'; end if;
  update player_pins pp set pin_hash = crypt(p_new, gen_salt('bf'))
    from players p
   where p.id = pp.player_id and pp.player_id = p_player and p.user_id = auth.uid()
     and pp.pin_hash = crypt(p_old, pp.pin_hash);
  return found;
end $$;

revoke all on function public.create_player(text, text, text, text) from public, anon;
revoke all on function public.verify_pin(uuid, text)               from public, anon;
revoke all on function public.change_pin(uuid, text, text)         from public, anon;
grant execute on function public.create_player(text, text, text, text) to authenticated;
grant execute on function public.verify_pin(uuid, text)               to authenticated;
grant execute on function public.change_pin(uuid, text, text)         to authenticated;

-- Forgot a PIN? Run this with the player's name and a new PIN:
--   update public.player_pins set pin_hash = extensions.crypt('1234', extensions.gen_salt('bf')),
--          failed_tries = 0, locked_until = null
--    where player_id = (select id from public.players where name = 'Anna');
