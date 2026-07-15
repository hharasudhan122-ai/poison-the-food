import { useEffect, useState } from 'react';
import type { Slot } from '../types';
import { role, roleClass } from '../lib/theme';

interface Props {
  winner: Slot;
  mySlot: Slot;
  onDone: () => void;
}

export function CoinToss({ winner, mySlot, onDone }: Props) {
  const [settled, setSettled] = useState(false);
  const winnerRole = role(winner);
  const winnerClass = roleClass(winner);
  const isMe = winner === mySlot;

  useEffect(() => {
    const settle = setTimeout(() => setSettled(true), 1100);
    const finish = setTimeout(() => onDone(), 2500);
    return () => {
      clearTimeout(settle);
      clearTimeout(finish);
    };
  }, [onDone]);

  return (
    <div className="card toss-card">
      <h2 className="phase-heading">Coin Toss</h2>
      <p className="phase-sub">Deciding who moves first…</p>

      <div className={`coin ${settled ? `settled to-${winnerClass}` : ''}`}>
        <div className="coin-face host">H</div>
        <div className="coin-face guest">G</div>
      </div>

      <div className={`toss-result ${settled ? winnerClass : ''}`}>
        {settled ? `${winnerRole} ${isMe ? '(You)' : '(Opponent)'} goes first!` : ''}
      </div>
    </div>
  );
}
