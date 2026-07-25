import { useEffect, useRef, useState } from 'react';
import { useMatch } from './hooks/useMatch';
import { BackgroundVideo } from './components/BackgroundVideo';
import { Lobby } from './components/Lobby';
import { WaitingRoom } from './components/WaitingRoom';
import { PoisonPhase } from './components/PoisonPhase';
import { PlayPhase } from './components/PlayPhase';
import { GameOverScreen } from './components/GameOverScreen';
import { CoinToss } from './components/CoinToss';
import { ResumePrompt } from './components/ResumePrompt';
import type { Phase, Slot } from './types';

export default function App() {
  const {
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
  } = useMatch();

  const prevPhaseRef = useRef<Phase>(phase);
  const [tossWinner, setTossWinner] = useState<Slot | null>(null);

  // Show a coin toss any time we cross from poison_placement into playing
  // (this fires on match start, and again on every reshuffle round).
  useEffect(() => {
    if (prevPhaseRef.current === 'poison_placement' && phase === 'playing' && state?.currentTurn) {
      setTossWinner(state.currentTurn);
    }
    prevPhaseRef.current = phase;
  }, [phase, state?.currentTurn]);

  const showToss = phase === 'playing' && tossWinner !== null;

  return (
    <>
      <BackgroundVideo />
      <div className="shell">
      <div className="brand">
        <h1>
          Poison<span className="drip">Plate</span>
        </h1>
      </div>

      {pendingSession ? (
        <ResumePrompt busy={busy} onResume={resumeSession} onDiscard={discardSession} />
      ) : (
        <>
          {phase !== 'lobby' && (
            <button className="btn-ghost" style={{ marginBottom: 16 }} onClick={leaveMatch}>
              Leave match
            </button>
          )}

          {phase === 'lobby' && (
            <Lobby busy={busy} error={error} onCreate={createMatch} onJoin={joinMatch} />
          )}

          {phase === 'waiting' && state && <WaitingRoom code={state.code} onLeave={leaveMatch} />}

          {phase === 'poison_placement' && state && (
            <PoisonPhase state={state} busy={busy} onConfirm={placePoison} />
          )}

          {phase === 'playing' && state && showToss && (
            <CoinToss winner={tossWinner!} mySlot={state.mySlot} onDone={() => setTossWinner(null)} />
          )}

          {phase === 'playing' && state && !showToss && (
            <PlayPhase state={state} busy={busy} onPick={pickTile} />
          )}

          {phase === 'finished' && state && (
            <GameOverScreen state={state} onPlayAgain={createMatch} onLeave={leaveMatch} />
          )}

          {error && phase !== 'lobby' && <div className="error-banner">{error}</div>}
        </>
      )}
      </div>
    </>
  );
}
