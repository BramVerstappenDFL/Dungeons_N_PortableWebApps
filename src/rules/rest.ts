import type { Character } from '../types';
import { abilityMod } from './abilities';
import { rollDie } from './dice';
import { originOf, restoreFeatures } from './origin';
import { hitDicePools } from './classes';

/** Spends one Hit Die of a size during a short rest (default: the largest left): roll it + CON mod (min 0) and heal. */
export function spendHitDie(c: Character, die?: number): { character: Character; roll: number; healed: number; die: number } | null {
  const pools = hitDicePools(c);
  const pool = die ? pools.find((p) => p.die === die) : pools.find((p) => p.used < p.total);
  if (!pool || pool.used >= pool.total) return null;
  const roll = rollDie(pool.die);
  const healed = Math.max(0, roll + abilityMod(c.abilities.con));
  const current = Math.min(c.hp.max, c.hp.current + healed);
  return {
    die: pool.die,
    character: { ...c, hitDiceUsed: { ...c.hitDiceUsed, [pool.die]: pool.used + 1 }, hp: { ...c.hp, current } },
    roll,
    healed: current - c.hp.current,
  };
}

/** Finishes a short rest: short-rest features and all Pact Magic slots come back. */
export function finishShortRest(c: Character): Character {
  const rested = restoreFeatures(c, 'short');
  return rested.pactSlotsUsed ? { ...rested, pactSlotsUsed: 0 } : rested;
}

/**
 * Long rest (2024 rules): regain all HP and all spent Hit Dice, restore spell slots,
 * temp HP end, death saves reset, Exhaustion level drops by 1, concentration ends,
 * and every limited feature use comes back.
 */
export function longRest(c: Character): Character {
  // Human Resourceful: Heroic Inspiration whenever you finish a long rest.
  const resourceful = originOf(c).features.some((f) => f.id === 'resourceful');
  return {
    ...restoreFeatures(c, 'long'),
    inspiration: c.inspiration || resourceful,
    hp: { ...c.hp, current: c.hp.max, temp: 0 },
    hitDiceUsed: {},
    spellSlotsUsed: Array(9).fill(0),
    pactSlotsUsed: 0,
    deathSaves: { successes: 0, failures: 0 },
    exhaustion: Math.max(0, c.exhaustion - 1),
    concentration: null,
  };
}
