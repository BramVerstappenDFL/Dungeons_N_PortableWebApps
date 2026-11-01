import type { Character, ClassData } from '../types';
import { abilityMod } from './abilities';
import { rollDie } from './dice';

/** Spends one Hit Die during a short rest: roll the die + CON mod (min 0) and heal. */
export function spendHitDie(c: Character, cls: ClassData): { character: Character; roll: number; healed: number } | null {
  if (c.hitDiceUsed >= c.level) return null;
  const roll = rollDie(cls.hitDie);
  const healed = Math.max(0, roll + abilityMod(c.abilities.con));
  const current = Math.min(c.hp.max, c.hp.current + healed);
  return {
    character: { ...c, hitDiceUsed: c.hitDiceUsed + 1, hp: { ...c.hp, current } },
    roll,
    healed: current - c.hp.current,
  };
}

/** Finishes a short rest: Warlocks regain all Pact Magic slots. */
export function finishShortRest(c: Character, cls: ClassData): Character {
  if (cls.casterType !== 'pact') return c;
  return { ...c, spellSlotsUsed: Array(9).fill(0) };
}

/**
 * Long rest (2024 rules): regain all HP and all spent Hit Dice, restore spell slots,
 * temp HP end, death saves reset, Exhaustion level drops by 1, concentration ends.
 */
export function longRest(c: Character): Character {
  return {
    ...c,
    hp: { ...c.hp, current: c.hp.max, temp: 0 },
    hitDiceUsed: 0,
    spellSlotsUsed: Array(9).fill(0),
    deathSaves: { successes: 0, failures: 0 },
    exhaustion: Math.max(0, c.exhaustion - 1),
    concentration: null,
  };
}
