import type { CombatState, EconomySlot } from '../types';

export const freshEconomy = (): Record<EconomySlot, boolean> => ({ action: false, bonus: false, reaction: false });
export const newCombat = (): CombatState => ({ round: 1, initiative: null, eco: freshEconomy() });

/** Ends your turn: with only you in the order, the next turn is yours in the next round. */
export function endTurn(c: CombatState): CombatState {
  return { ...c, round: c.round + 1, eco: freshEconomy() };
}

export function setUsed(c: CombatState, slot: EconomySlot, used = true): CombatState {
  return { ...c, eco: { ...c.eco, [slot]: used } };
}

/** Maps a spell's casting time to the economy slot it uses (null = not usable in combat). */
export function slotForCastingTime(castingTime: string): EconomySlot | null {
  // Accepts the older "1 action" / "1 bonus action" wording too.
  const t = castingTime.toLowerCase().trim().replace(/^1\s+/, '');
  if (t.startsWith('bonus')) return 'bonus';
  if (t.startsWith('reaction')) return 'reaction';
  if (t.startsWith('action')) return 'action';
  return null;
}

/**
 * Picks the slot level to cast a spell of `spellLevel` with: the lowest level at or above it with a
 * free slot. `used`/`max` are indexed from level 1 at index 0. Returns null when none is free.
 */
export function pickSlot(spellLevel: number, used: number[], max: number[]): number | null {
  if (spellLevel <= 0) return 0;
  for (let l = spellLevel; l <= max.length; l++) {
    if ((max[l - 1] ?? 0) - (used[l - 1] ?? 0) > 0) return l;
  }
  return null;
}

/** Marks one slot of `level` used. */
export function spendSlot(used: number[], level: number): number[] {
  if (level <= 0) return used;
  const next = [...used];
  next[level - 1] = (next[level - 1] ?? 0) + 1;
  return next;
}
