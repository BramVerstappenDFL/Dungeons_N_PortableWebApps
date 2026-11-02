import type { Ability, AbilityScores, Character } from '../types';
import { classById } from '../data';
import { ABILITIES, abilityMod, defaultMaxHp } from './abilities';
import { newCombat } from './combat';

export interface NewCharacterInput {
  id: string;
  name: string;
  speciesId: string;
  backgroundId: string;
  classId: string;
  base: AbilityScores; // point-buy scores
  boosts: Partial<Record<Ability, number>>; // background increases (+2/+1 or +1/+1/+1)
  classSkills: string[];
  backgroundSkills: string[];
  now: number;
}

/** Final scores: base plus background increases, capped at 20. */
export function applyBoosts(base: AbilityScores, boosts: Partial<Record<Ability, number>>): AbilityScores {
  return Object.fromEntries(ABILITIES.map((a) => [a, Math.min(20, base[a] + (boosts[a] ?? 0))])) as AbilityScores;
}

/** Background increases are valid as +2/+1 or +1/+1/+1 among the background's abilities. */
export function boostsValid(boosts: Partial<Record<Ability, number>>, allowed: Ability[]): boolean {
  const entries = Object.entries(boosts).filter(([, v]) => (v ?? 0) > 0) as [Ability, number][];
  const total = entries.reduce((t, [, v]) => t + v, 0);
  return total === 3 && entries.every(([a, v]) => v <= 2 && allowed.includes(a));
}

/** Builds a new level-1 character. AC starts at 10 + DEX (no armour). */
export function buildCharacter(i: NewCharacterInput): Character {
  const cls = classById(i.classId);
  const abilities = applyBoosts(i.base, i.boosts);
  const hitDie = cls?.hitDie ?? 8;
  const maxHp = defaultMaxHp(hitDie, 1, abilities.con);
  return {
    id: i.id,
    name: i.name.trim(),
    classId: i.classId,
    level: 1,
    speciesId: i.speciesId,
    backgroundId: i.backgroundId,
    abilities,
    skills: [...new Set([...i.backgroundSkills, ...i.classSkills])],
    expertise: [],
    armorClass: 10 + abilityMod(abilities.dex),
    hp: { max: maxHp, current: maxHp, temp: 0 },
    hitDiceUsed: 0,
    deathSaves: { successes: 0, failures: 0 },
    exhaustion: 0,
    conditions: [],
    spellSlotsUsed: Array(9).fill(0),
    spells: [],
    concentration: null,
    inventory: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    rollLog: [],
    xp: 0,
    inspiration: false,
    notes: [],
    combat: newCombat(),
    creation: { method: 'pointbuy', base: i.base, boosts: i.boosts, hpAuto: true },
    createdAt: i.now,
    updatedAt: i.now,
  };
}
