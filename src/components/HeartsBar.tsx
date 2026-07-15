import { role, roleClass } from '../lib/theme';
import type { Slot } from '../types';

interface Props {
  mySlot: Slot;
  heartsP1: number;
  heartsP2: number;
}

function Hearts({ count }: { count: number }) {
  return (
    <div className="heart-icons">
      {[0, 1].map((i) => (
        <span key={i} className={i < count ? '' : 'lost'}>
          ❤️
        </span>
      ))}
    </div>
  );
}

export function HeartsBar({ mySlot, heartsP1, heartsP2 }: Props) {
  const myHearts = mySlot === 'player1' ? heartsP1 : heartsP2;
  const theirHearts = mySlot === 'player1' ? heartsP2 : heartsP1;
  const opponentSlot: Slot = mySlot === 'player1' ? 'player2' : 'player1';

  return (
    <div className="hearts-row">
      <div className="player-panel">
        <span className="player-label me">
          You
          <span className={`role-badge ${roleClass(mySlot)}`}>{role(mySlot)}</span>
        </span>
        <Hearts count={myHearts} />
      </div>
      <div className="player-panel right">
        <span className="player-label">
          Opponent
          <span className={`role-badge ${roleClass(opponentSlot)}`}>{role(opponentSlot)}</span>
        </span>
        <Hearts count={theirHearts} />
      </div>
    </div>
  );
}
