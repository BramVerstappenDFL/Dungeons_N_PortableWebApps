import type { CasterType } from '../types';

// Spell slots per character level for full casters (levels 1-9 slots).
const FULL: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
// 2024 half casters (Paladin, Ranger) get slots from level 1.
const HALF: number[][] = [
  [2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3],
  [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
];
// Warlock Pact Magic: [slot count, slot level].
const PACT: [number, number][] = [
  [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5],
  [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5],
];

/** Returns max slots indexed by spell level - 1 (length 9). */
export function maxSlots(type: CasterType, level: number): number[] {
  const lv = Math.min(20, Math.max(1, level)) - 1;
  const out = Array(9).fill(0);
  if (type === 'full') FULL[lv].forEach((n, i) => (out[i] = n));
  if (type === 'half') HALF[lv].forEach((n, i) => (out[i] = n));
  if (type === 'pact') { const [n, l] = PACT[lv]; out[l - 1] = n; }
  return out;
}

export const pactSlotLevel = (level: number) => PACT[Math.min(20, Math.max(1, level)) - 1][1];

/** Highest spell level the character can cast (0 = cantrips only). */
export function maxSpellLevel(type: CasterType, level: number) {
  const s = maxSlots(type, level);
  for (let i = 8; i >= 0; i--) if (s[i] > 0) return i + 1;
  return 0;
}

/** Cantrip damage dice multiplier: x1, x2 at 5, x3 at 11, x4 at 17. */
export const cantripDiceMultiplier = (level: number) => (level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1);
