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
  onPick: (position: number) => void;
}

export function PlayPhase({ state, busy, onPick }: Props) {
  const myTurn = state.currentTurn === state.mySlot;
  const poisonSet = new Set(state.myPoisonPositions);
  const pack = getFoodPack(state.foodPack);
  const revealedPositions = Object.keys(state.revealed).map(Number);
  const [modelFailed, setModelFailed] = useState(false);
  const show3D = !!pack.glbPath && !modelFailed;

  return (
    <div className="card">
      <HeartsBar mySlot={state.mySlot} heartsP1={state.heartsP1} heartsP2={state.heartsP2} />

      <div className={`turn-banner ${myTurn ? 'mine' : 'theirs'}`}>
        {myTurn ? 'Your turn — pick a tile' : "Opponent's turn"}
      </div>

      <div className="game-wrap">
        {state.round > 1 && <div className="round-tag">Round {state.round}</div>}
        {show3D && (
          <GLBErrorBoundary onError={() => setModelFailed(true)}>
            <FoodGrid3D glbPath={pack.glbPath!} hiddenPositions={revealedPositions} />
          </GLBErrorBoundary>
        )}
        <div className="grid">
          {state.allFood.map((food, i) => (
            <Tile
              key={i}
              food={food}
              isMyPoison={poisonSet.has(i)}
              selected={false}
              revealed={state.revealed[i]}
              clickable={myTurn && !busy && !state.revealed[i]}
              onClick={() => onPick(i)}
              hideFront={show3D}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
