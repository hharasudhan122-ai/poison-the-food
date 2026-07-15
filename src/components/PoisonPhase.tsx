import { useState } from 'react';
import { Tile } from './Tile';
import { HeartsBar } from './HeartsBar';
import { FoodGrid3D } from './FoodGrid3D';
import { GLBErrorBoundary } from './GLBErrorBoundary';
import { getFoodPack } from '../lib/foodPacks';
import type { MatchState } from '../types';

interface Props {
  state: MatchState;
  busy: boolean;
  onConfirm: (positions: number[]) => void;
}

export function PoisonPhase({ state, busy, onConfirm }: Props) {
  const [selected, setSelected] = useState<number[]>([]);

  const alreadySubmitted =
    (state.mySlot === 'player1' && state.p1Ready) || (state.mySlot === 'player2' && state.p2Ready);

  const opponentReady =
    state.mySlot === 'player1' ? state.p2Ready : state.p1Ready;

  function toggle(pos: number) {
    if (alreadySubmitted) return;
    setSelected((prev) => {
      if (prev.includes(pos)) return prev.filter((p) => p !== pos);
      if (prev.length >= 3) return prev;
      return [...prev, pos];
    });
  }

  const pack = getFoodPack(state.foodPack);
  const [modelFailed, setModelFailed] = useState(false);
  const show3D = !!pack.glbPath && !modelFailed;

  return (
    <div className="card">
      <HeartsBar mySlot={state.mySlot} heartsP1={state.heartsP1} heartsP2={state.heartsP2} />

      {alreadySubmitted ? (
        <>
          <h2 className="phase-heading">Poison set</h2>
          <p className="phase-sub">
            {opponentReady ? 'Starting round…' : 'Waiting for your opponent to choose theirs…'}
          </p>
        </>
      ) : (
        <>
          <h2 className="phase-heading">Round {state.round}: Poison the plate</h2>
          <p className="phase-sub">Pick 3 tiles to secretly poison. Your opponent won't know which.</p>
        </>
      )}

      <div className="game-wrap">
        {show3D && (
          <GLBErrorBoundary onError={() => setModelFailed(true)}>
            <FoodGrid3D glbPath={pack.glbPath!} hiddenPositions={[]} />
          </GLBErrorBoundary>
        )}
        <div className="grid">
          {state.allFood.map((food, i) => (
            <Tile
              key={i}
              food={food}
              isMyPoison={false}
              selected={selected.includes(i)}
              clickable={!alreadySubmitted}
              onClick={() => toggle(i)}
              hideFront={show3D}
            />
          ))}
        </div>
      </div>

      {!alreadySubmitted && (
        <div className="confirm-bar">
          <span className="select-count">
            <strong>{selected.length}</strong> / 3 selected
          </span>
          <button
            className="btn-primary"
            disabled={selected.length !== 3 || busy}
            onClick={() => onConfirm(selected)}
          >
            Confirm Poison
          </button>
        </div>
      )}
    </div>
  );
}
