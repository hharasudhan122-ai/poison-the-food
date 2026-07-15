import { useCallback, useRef, useState } from 'react';
import { supabase, getPlayerId } from '../lib/supabase';
import type { MatchState, Phase, RevealedTile, Slot } from '../types';

const SESSION_KEY = 'pp_session';

interface Session {
  matchId: string;
  code: string;
  secret: string;
}

function saveSession(s: Session | null) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

function loadSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function useMatch() {
  const [state, setState] = useState<MatchState | null>(null);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingSession, setPendingSession] = useState<Session | null>(() => loadSession());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const teardownChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const nudgeOpponent = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'sync', payload: {} });
  }, []);

  const refresh = useCallback(async (matchId: string, secret: string, code: string) => {
    const { data, error: rpcError } = await supabase
      .rpc('get_match_state', { p_match_id: matchId, p_secret: secret })
      .single();

    if (rpcError || !data) {
      setError(rpcError?.message ?? 'Could not load match');
      return;
    }

    const d = data as any;
    const revealed: Record<number, RevealedTile> = {};
    const positions: number[] = d.revealed_positions ?? [];
    const foods: string[] = d.revealed_food ?? [];
    const results: ('safe' | 'poison')[] = d.revealed_results ?? [];
    positions.forEach((pos, i) => {
      revealed[pos] = { position: pos, food: foods[i], result: results[i] };
    });

    const next: MatchState = {
      matchId,
      code,
      secret,
      mySlot: d.my_slot as Slot,
      status: d.status as Phase,
      currentTurn: d.current_turn as Slot | null,
      heartsP1: d.hearts_p1,
      heartsP2: d.hearts_p2,
      round: d.round,
      winner: d.winner as Slot | null,
      p1Ready: d.p1_ready,
      p2Ready: d.p2_ready,
      foodPack: d.food_pack ?? 'classic',
      myPoisonPositions: d.my_poison_positions ?? [],
      allFood: d.all_food ?? [],
      revealed,
    };

    setState(next);
    setPhase(next.status);
  }, []);

  const connectChannel = useCallback(
    (code: string, matchId: string, secret: string) => {
      teardownChannel();
      const ch = supabase.channel(`match-${code}`);
      ch.on('broadcast', { event: 'sync' }, () => {
        refresh(matchId, secret, code);
      });
      ch.subscribe();
      channelRef.current = ch;
    },
    [refresh, teardownChannel]
  );

  const resumeSession = useCallback(async () => {
    if (!pendingSession) return;
    setBusy(true);
    await refresh(pendingSession.matchId, pendingSession.secret, pendingSession.code);
    connectChannel(pendingSession.code, pendingSession.matchId, pendingSession.secret);
    setBusy(false);
    setPendingSession(null);
  }, [pendingSession, refresh, connectChannel]);

  const discardSession = useCallback(() => {
    saveSession(null);
    setPendingSession(null);
  }, []);

  const createMatch = useCallback(async (foodPack: string = 'classic') => {
    setBusy(true);
    setError(null);
    const playerId = getPlayerId();
    const { data, error: rpcError } = await supabase
      .rpc('create_match', { p_player_id: playerId, p_food_pack: foodPack })
      .single();

    setBusy(false);
    if (rpcError || !data) {
      setError(rpcError?.message ?? 'Could not create match');
      return;
    }
    const d = data as any;
    saveSession({ matchId: d.match_id, code: d.code, secret: d.secret });
    connectChannel(d.code, d.match_id, d.secret);
    setState({
      matchId: d.match_id,
      code: d.code,
      secret: d.secret,
      mySlot: 'player1',
      status: 'waiting',
      currentTurn: null,
      heartsP1: 2,
      heartsP2: 2,
      round: 1,
      winner: null,
      p1Ready: false,
      p2Ready: false,
      foodPack,
      myPoisonPositions: [],
      allFood: [],
      revealed: {},
    });
    setPhase('waiting');
  }, [connectChannel]);

  const joinMatch = useCallback(
    async (code: string) => {
      setBusy(true);
      setError(null);
      const playerId = getPlayerId();
      const cleanCode = code.trim().toUpperCase();
      const { data, error: rpcError } = await supabase
        .rpc('join_match', { p_code: cleanCode, p_player_id: playerId })
        .single();

      setBusy(false);
      if (rpcError || !data) {
        setError(rpcError?.message ?? 'Could not join match — check the code');
        return;
      }
      const d = data as any;
      saveSession({ matchId: d.match_id, code: cleanCode, secret: d.secret });
      connectChannel(cleanCode, d.match_id, d.secret);
      await refresh(d.match_id, d.secret, cleanCode);
      nudgeOpponent();
    },
    [connectChannel, refresh, nudgeOpponent]
  );

  const placePoison = useCallback(
    async (positions: number[]) => {
      if (!state) return;
      setBusy(true);
      setError(null);
      const { error: rpcError } = await supabase.rpc('place_poison', {
        p_match_id: state.matchId,
        p_secret: state.secret,
        p_positions: positions,
      });
      setBusy(false);
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      await refresh(state.matchId, state.secret, state.code);
      nudgeOpponent();
    },
    [state, refresh, nudgeOpponent]
  );

  const pickTile = useCallback(
    async (position: number) => {
      if (!state) return;
      setBusy(true);
      setError(null);
      const { error: rpcError } = await supabase.rpc('pick_tile', {
        p_match_id: state.matchId,
        p_secret: state.secret,
        p_position: position,
      });
      setBusy(false);
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      await refresh(state.matchId, state.secret, state.code);
      nudgeOpponent();
    },
    [state, refresh, nudgeOpponent]
  );

  const leaveMatch = useCallback(() => {
    teardownChannel();
    saveSession(null);
    setState(null);
    setPhase('lobby');
    setError(null);
  }, [teardownChannel]);

  return {
    state,
    phase,
    error,
    busy,
    pendingSession,
    resumeSession,
    discardSession,
    createMatch,
    joinMatch,
    placePoison,
    pickTile,
    leaveMatch,
  };
}
