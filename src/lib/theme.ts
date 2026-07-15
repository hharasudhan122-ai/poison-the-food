import type { Slot } from '../types';

export function role(slot: Slot): 'HOST' | 'GUEST' {
  return slot === 'player1' ? 'HOST' : 'GUEST';
}

export function roleClass(slot: Slot): 'host' | 'guest' {
  return slot === 'player1' ? 'host' : 'guest';
}
