import type { MatchState } from '../types';

interface Props {
  state: MatchState;
  onPlayAgain: (foodPack: string) => void;
  onLeave: () => void;
}

export function GameOverScreen({ state, onPlayAgain, onLeave }: Props) {
  const won = state.winner === state.mySlot;

  return (
    <div className="card result-screen">
      <div className={`result-title ${won ? 'win' : 'lose'}`}>{won ? 'You survived' : 'You ate poison'}</div>
      <p className="phase-sub">
        {won ? 'Your opponent ran out of hearts.' : "You're out of hearts."}
      </p>

      <div className="result-actions">
        <button className="btn-primary" onClick={() => onPlayAgain(state.foodPack)}>
          New Match
        </button>
        <button className="btn-ghost" onClick={onLeave}>
          Back to lobby
        </button>
      </div>
    </div>
  );
}
