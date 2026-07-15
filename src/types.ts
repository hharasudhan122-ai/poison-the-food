export type Phase = 'lobby' | 'waiting' | 'poison_placement' | 'playing' | 'finished';

export type Slot = 'player1' | 'player2';

export interface RevealedTile {
  position: number;
  food: string;
  result: 'safe' | 'poison';
}

export interface MatchState {
  matchId: string;
  code: string;
  secret: string;
  mySlot: Slot;
  status: Phase;
  currentTurn: Slot | null;
  heartsP1: number;
  heartsP2: number;
  round: number;
  winner: Slot | null;
  p1Ready: boolean;
  p2Ready: boolean;
  foodPack: string;
  myPoisonPositions: number[];
  allFood: string[]; // 25 entries, index = grid position
  revealed: Record<number, RevealedTile>;
}
