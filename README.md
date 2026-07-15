# Poison Plate

1v1 bluffing game. 5×5 grid of food tiles, each player secretly poisons 3, then you take turns picking tiles. Two hearts each. First to zero loses. Grid runs dry → reshuffle, hearts carry over.

## How the security works

All poison logic lives in Postgres functions (`supabase/schema.sql`), not in the browser. The `tiles` table itself is completely locked down — no direct read access for anyone. The only way to get game state is through `get_match_state`, which is coded to return **your own** poison positions and never your opponent's. So there's no way to open devtools and peek at the network tab to see where the opponent poisoned — the server just never sends that data to you.

Realtime sync uses a Supabase Broadcast channel per match (same pattern as Flag Rush): after any move, your client sends a tiny "something changed" ping, and your opponent's client refetches full state from `get_match_state`. No Postgres Realtime table subscriptions needed, which is what let the RLS lockdown be this strict.

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, and wait for it to finish provisioning.

### 2. Run the schema

Dashboard → **SQL Editor** → **New query** → paste the entire contents of `supabase/schema.sql` → **Run**.

This creates the `matches`/`tiles` tables and all the game-logic functions. Nothing else needed — no manual RLS policy setup, the script handles it.

### 3. Get your API keys

Dashboard → **Project Settings** → **API**. You need:
- **Project URL**
- **anon public** key (NOT the service_role key — never expose that one client-side)

### 4. Configure the app

```bash
cp .env.example .env
```

Fill in:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 5. Run it

```bash
npm install
npm run dev
```

Open two browser windows (or one normal + one incognito, since sessions are stored in `localStorage`) to test both sides of a match.

## Deploy (GitHub + Vercel, your usual flow)

1. Push this folder to a new GitHub repo
2. Import it in Vercel
3. Add the two env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in Vercel's Project Settings → Environment Variables
4. Deploy

## How to play

1. **Create Match** → share the 6-character code (or the link) with a friend
2. Both players secretly pick 3 of the 25 tiles to poison
3. Turns alternate — coin flip decides who goes first. Pick any unrevealed tile:
   - Safe → tile flips green, turn passes
   - Poison → tile flips red, you lose a heart, turn passes
4. First to 0 hearts loses. If all 19 safe tiles get cleared first, the board reshuffles (hearts carry over) and you re-poison for a new round.

## Known limitations / things worth hardening later

- No real auth — a player's identity is just a random ID + secret token stored in `localStorage`. Fine for a casual game with friends, not bulletproof against someone deliberately messing with their own browser storage to reconnect as themselves later.
- No rate limiting on match creation/joining — someone could spam `create_match` calls. Not a concern at hobby-project scale, but worth an eye if this gets real traffic.
- No reconnect-after-close-tab UI polish beyond localStorage session resume — if a player closes the tab mid-poison-placement and reopens, they'll resume fine, but there's no "opponent disconnected" detection/timeout yet.

## File structure

```
src/
  types.ts              Match state shape
  lib/supabase.ts        Supabase client + player ID helper
  hooks/useMatch.ts       All RPC calls + realtime sync + session persistence
  components/
    Lobby.tsx             Create/join screen
    WaitingRoom.tsx        Host waiting for opponent
    PoisonPhase.tsx        Secret 3-tile poison selection
    PlayPhase.tsx           Turn-based picking
    Tile.tsx                 Single grid cell + flip animation
    HeartsBar.tsx             Hearts display
    GameOverScreen.tsx        Win/lose screen
supabase/schema.sql       Full DB schema + secure game-logic functions
```
