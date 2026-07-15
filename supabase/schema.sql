-- =========================================================
-- Poison Plate — Supabase schema
-- Run this whole file once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New Query -> paste -> Run)
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- Tables
-- ---------------------------------------------------------

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  status text not null default 'waiting'
    check (status in ('waiting','poison_placement','playing','finished')),
  player1_id text not null,
  player2_id text,
  p1_secret text not null,
  p2_secret text,
  p1_ready boolean not null default false,
  p2_ready boolean not null default false,
  hearts_p1 int not null default 2,
  hearts_p2 int not null default 2,
  current_turn text check (current_turn in ('player1','player2')),
  round int not null default 1,
  winner text,
  food_pack text not null default 'classic',
  created_at timestamptz not null default now()
);

-- Defensive: CREATE TABLE IF NOT EXISTS above is a no-op when the table
-- already exists, so it silently skips new columns added later. This makes
-- re-running the whole file safe even on an existing database.
alter table matches add column if not exists food_pack text not null default 'classic';

create table if not exists tiles (
  id bigint generated always as identity primary key,
  match_id uuid not null references matches(id) on delete cascade,
  round int not null,
  position int not null check (position >= 0 and position <= 24),
  food_type text not null,
  poisoned_by_p1 boolean not null default false,
  poisoned_by_p2 boolean not null default false,
  revealed boolean not null default false,
  unique (match_id, round, position)
);

-- ---------------------------------------------------------
-- Lock the tables down completely.
-- No policies = no direct anon SELECT/INSERT/UPDATE at all.
-- The ONLY way in or out is through the functions below,
-- which run as SECURITY DEFINER and decide exactly what
-- each player is allowed to see (crucially: never the
-- opponent's poison tiles).
-- ---------------------------------------------------------

alter table matches enable row level security;
alter table tiles enable row level security;

revoke all on matches from anon, authenticated;
revoke all on tiles from anon, authenticated;

-- ---------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------

create or replace function gen_match_code() returns text
language sql as $$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
$$;

create or replace function gen_secret() returns text
language sql as $$
  select encode(gen_random_bytes(16), 'hex');
$$;

-- Fixed cosmetic food set. Purely visual — has no effect on poison logic.
create or replace function food_set() returns text[]
language sql immutable as $$
  select array['🍎','🍌','🍇','🍕','🍔','🍟','🍩','🍪','🍫','🍭','🥕','🍉','🧀','🍓','🥨'];
$$;

create or replace function seed_round_tiles(p_match_id uuid, p_round int) returns void
language plpgsql as $$
declare
  v_foods text[] := food_set();
  i int;
begin
  for i in 0..24 loop
    insert into tiles(match_id, round, position, food_type)
    values (p_match_id, p_round, i, v_foods[1 + floor(random() * array_length(v_foods,1))]);
  end loop;
end;
$$;

-- ---------------------------------------------------------
-- create_match: host creates a room, gets back a shareable
-- code and their own secret (their proof-of-identity for
-- every future call).
-- ---------------------------------------------------------

drop function if exists create_match(text);

create or replace function create_match(p_player_id text, p_food_pack text default 'classic')
returns table(match_id uuid, code text, secret text)
language plpgsql security definer as $$
declare
  v_id uuid;
  v_code text;
  v_secret text;
begin
  v_code := gen_match_code();
  v_secret := gen_secret();

  insert into matches(id, code, player1_id, p1_secret, food_pack)
  values (gen_random_uuid(), v_code, p_player_id, v_secret, coalesce(p_food_pack, 'classic'))
  returning id into v_id;

  return query select v_id, v_code, v_secret;
end;
$$;

grant execute on function create_match(text, text) to anon;

-- ---------------------------------------------------------
-- join_match: second player joins by code, round 1 tiles
-- get seeded, phase moves to poison_placement.
-- ---------------------------------------------------------

create or replace function join_match(p_code text, p_player_id text)
returns table(match_id uuid, secret text)
language plpgsql security definer as $$
declare
  v_match matches%rowtype;
  v_secret text;
begin
  select * into v_match from matches where code = upper(p_code) and status = 'waiting' for update;
  if not found then
    raise exception 'Match not found or already started';
  end if;

  v_secret := gen_secret();

  update matches
    set player2_id = p_player_id,
        p2_secret = v_secret,
        status = 'poison_placement'
    where id = v_match.id;

  perform seed_round_tiles(v_match.id, 1);

  return query select v_match.id, v_secret;
end;
$$;

grant execute on function join_match(text, text) to anon;

-- ---------------------------------------------------------
-- place_poison: each player secretly submits exactly 3
-- tile positions. Once both have submitted, phase flips to
-- playing and a coin flip decides who goes first.
-- ---------------------------------------------------------

create or replace function place_poison(p_match_id uuid, p_secret text, p_positions int[])
returns table(status text, current_turn text)
language plpgsql security definer as $$
declare
  v_match matches%rowtype;
  v_slot text;
  v_pos int;
  v_distinct_count int;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status <> 'poison_placement' then raise exception 'Not in poison placement phase'; end if;

  if p_secret = v_match.p1_secret then v_slot := 'p1';
  elsif p_secret = v_match.p2_secret then v_slot := 'p2';
  else raise exception 'Invalid credentials'; end if;

  if (v_slot = 'p1' and v_match.p1_ready) or (v_slot = 'p2' and v_match.p2_ready) then
    raise exception 'You already placed your poison this round';
  end if;

  if array_length(p_positions,1) is distinct from 3 then
    raise exception 'Must choose exactly 3 tiles';
  end if;

  select count(*) into v_distinct_count from (select distinct unnest(p_positions)) t;
  if v_distinct_count <> 3 then
    raise exception 'Tiles must be unique';
  end if;

  foreach v_pos in array p_positions loop
    if v_slot = 'p1' then
      update tiles set poisoned_by_p1 = true
        where match_id = p_match_id and round = v_match.round and position = v_pos;
    else
      update tiles set poisoned_by_p2 = true
        where match_id = p_match_id and round = v_match.round and position = v_pos;
    end if;
  end loop;

  if v_slot = 'p1' then
    update matches set p1_ready = true where id = p_match_id;
  else
    update matches set p2_ready = true where id = p_match_id;
  end if;

  select * into v_match from matches where id = p_match_id;

  if v_match.p1_ready and v_match.p2_ready then
    update matches
      set status = 'playing',
          current_turn = (array['player1','player2'])[1 + floor(random() * 2)]
      where id = p_match_id;
    select * into v_match from matches where id = p_match_id;
  end if;

  return query select v_match.status, v_match.current_turn;
end;
$$;

grant execute on function place_poison(uuid, text, int[]) to anon;

-- ---------------------------------------------------------
-- pick_tile: the core turn action. Reveals a tile, applies
-- damage if poisoned, checks win condition, and reshuffles
-- a fresh grid (keeping hearts) if the board runs dry.
-- ---------------------------------------------------------

create or replace function pick_tile(p_match_id uuid, p_secret text, p_position int)
returns table(
  result text,
  food_type text,
  hearts_p1 int,
  hearts_p2 int,
  status text,
  current_turn text,
  round int,
  winner text
)
language plpgsql security definer as $$
declare
  v_match matches%rowtype;
  v_slot text;
  v_tile tiles%rowtype;
  v_is_poison boolean;
  v_remaining int;
begin
  select * into v_match from matches m where m.id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status <> 'playing' then raise exception 'Not in playing phase'; end if;

  if p_secret = v_match.p1_secret then v_slot := 'player1';
  elsif p_secret = v_match.p2_secret then v_slot := 'player2';
  else raise exception 'Invalid credentials'; end if;

  if v_match.current_turn <> v_slot then raise exception 'Not your turn'; end if;

  select * into v_tile from tiles t
    where t.match_id = p_match_id and t.round = v_match.round and t.position = p_position
    for update;
  if not found then raise exception 'Tile not found'; end if;
  if v_tile.revealed then raise exception 'Tile already revealed'; end if;

  v_is_poison := v_tile.poisoned_by_p1 or v_tile.poisoned_by_p2;

  update tiles t set revealed = true where t.id = v_tile.id;

  if v_is_poison then
    if v_slot = 'player1' then
      update matches m set hearts_p1 = m.hearts_p1 - 1 where m.id = p_match_id;
    else
      update matches m set hearts_p2 = m.hearts_p2 - 1 where m.id = p_match_id;
    end if;
  end if;

  select * into v_match from matches m where m.id = p_match_id;

  if v_match.hearts_p1 <= 0 then
    update matches m set status = 'finished', winner = 'player2' where m.id = p_match_id;
  elsif v_match.hearts_p2 <= 0 then
    update matches m set status = 'finished', winner = 'player1' where m.id = p_match_id;
  else
    select count(*) into v_remaining from tiles t
      where t.match_id = p_match_id and t.round = v_match.round and t.revealed = false;

    if v_remaining = 0 then
      update matches m
        set round = m.round + 1, p1_ready = false, p2_ready = false, status = 'poison_placement'
        where m.id = p_match_id;
      select * into v_match from matches m where m.id = p_match_id;
      perform seed_round_tiles(p_match_id, v_match.round);
    else
      update matches m
        set current_turn = case when m.current_turn = 'player1' then 'player2' else 'player1' end
        where m.id = p_match_id;
    end if;
  end if;

  select * into v_match from matches m where m.id = p_match_id;

  return query select
    (case when v_is_poison then 'poison' else 'safe' end),
    v_tile.food_type,
    v_match.hearts_p1,
    v_match.hearts_p2,
    v_match.status,
    v_match.current_turn,
    v_match.round,
    v_match.winner;
end;
$$;

grant execute on function pick_tile(uuid, text, int) to anon;

-- ---------------------------------------------------------
-- get_match_state: full resync for a reconnect/refresh.
-- Returns the caller's OWN poison positions but never the
-- opponent's — that's the whole game.
-- ---------------------------------------------------------

drop function if exists get_match_state(uuid, text);

create or replace function get_match_state(p_match_id uuid, p_secret text)
returns table(
  status text,
  current_turn text,
  hearts_p1 int,
  hearts_p2 int,
  round int,
  winner text,
  my_slot text,
  p1_ready boolean,
  p2_ready boolean,
  food_pack text,
  my_poison_positions int[],
  revealed_positions int[],
  revealed_food text[],
  revealed_results text[],
  all_food text[]
)
language plpgsql security definer as $$
declare
  v_match matches%rowtype;
  v_slot text;
begin
  select * into v_match from matches m where m.id = p_match_id;
  if not found then raise exception 'Match not found'; end if;

  if p_secret = v_match.p1_secret then v_slot := 'player1';
  elsif p_secret = v_match.p2_secret then v_slot := 'player2';
  else raise exception 'Invalid credentials'; end if;

  return query
  select
    v_match.status,
    v_match.current_turn,
    v_match.hearts_p1,
    v_match.hearts_p2,
    v_match.round,
    v_match.winner,
    v_slot,
    v_match.p1_ready,
    v_match.p2_ready,
    v_match.food_pack,
    (select coalesce(array_agg(t.position), '{}') from tiles t
       where t.match_id = p_match_id and t.round = v_match.round
       and ((v_slot = 'player1' and t.poisoned_by_p1) or (v_slot = 'player2' and t.poisoned_by_p2))),
    (select coalesce(array_agg(t.position order by t.position), '{}') from tiles t
       where t.match_id = p_match_id and t.round = v_match.round and t.revealed = true),
    (select coalesce(array_agg(t.food_type order by t.position), '{}') from tiles t
       where t.match_id = p_match_id and t.round = v_match.round and t.revealed = true),
    (select coalesce(array_agg(
        case when t.poisoned_by_p1 or t.poisoned_by_p2 then 'poison' else 'safe' end
        order by t.position), '{}') from tiles t
       where t.match_id = p_match_id and t.round = v_match.round and t.revealed = true),
    (select coalesce(array_agg(t.food_type order by t.position), '{}') from tiles t
       where t.match_id = p_match_id and t.round = v_match.round);
end;
$$;

grant execute on function get_match_state(uuid, text) to anon;
