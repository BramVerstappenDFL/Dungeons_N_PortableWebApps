import type { Character } from '../types';
import { abilityMod } from './abilities';
import { rollDie } from './dice';
import { hitDicePools } from './classes';

/** Spends one Hit Die of the given size during a short rest: roll the die + CON mod (min 0) and heal. */
export function spendHitDie(c: Character, die: number): { character: Character; roll: number; healed: number } | null {
  const pool = hitDicePools(c).find((p) => p.die === die);
  if (!pool || pool.used >= pool.total) return null;
  const roll = rollDie(die);
  const healed = Math.max(0, roll + abilityMod(c.abilities.con));
  const current = Math.min(c.hp.max, c.hp.current + healed);
  return {
    character: { ...c, hitDiceUsed: { ...c.hitDiceUsed, [die]: pool.used + 1 }, hp: { ...c.hp, current } },
    roll,
    healed: current - c.hp.current,
  };
}

/** Finishes a short rest: Pact Magic slots come back. */
export function finishShortRest(c: Character): Character {
  return c.pactSlotsUsed ? { ...c, pactSlotsUsed: 0 } : c;
}

/**
 * Long rest (2024 rules): regain all HP and all spent Hit Dice, restore spell slots,
 * temp HP end, death saves reset, Exhaustion level drops by 1, concentration ends.
 */
export function longRest(c: Character): Character {
  return {
    ...c,
    hp: { ...c.hp, current: c.hp.max, temp: 0 },
    hitDiceUsed: {},
    spellSlotsUsed: Array(9).fill(0),
    pactSlotsUsed: 0,
    deathSaves: { successes: 0, failures: 0 },
    exhaustion: Math.max(0, c.exhaustion - 1),
    concentration: null,
  };
}
