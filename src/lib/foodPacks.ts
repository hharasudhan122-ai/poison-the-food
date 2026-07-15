export interface FoodPackOption {
  id: string;
  label: string;
  /** Path under /public — null means use the emoji fallback (no GLB yet). */
  glbPath: string | null;
  thumbnail: string;
}

// Placeholder registry. Once you send the 2 GLB files, drop them in
// public/models/ using these exact filenames (or tell me the names you'd
// rather use and I'll update the paths) and these two options go live —
// no other code changes needed.
export const FOOD_PACKS: FoodPackOption[] = [
  { id: 'classic', label: 'Classic', glbPath: null, thumbnail: '🍎' },
  { id: 'food-a', label: 'Food A', glbPath: '/models/food-a.glb', thumbnail: '🍔' },
  { id: 'food-b', label: 'Food B', glbPath: '/models/food-b.glb', thumbnail: '🍩' },
];

export function getFoodPack(id: string): FoodPackOption {
  return FOOD_PACKS.find((p) => p.id === id) ?? FOOD_PACKS[0];
}
