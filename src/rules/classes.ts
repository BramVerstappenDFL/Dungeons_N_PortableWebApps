// Class progression numbers (SRD 5.2.1): spells known, class resources and the class features in play.
import type { Character, EconomySlot } from '../types';
import { classById } from '../data';
import { abilityMod } from './abilities';

export type Recharge = 'short' | 'long' | 'short-one';
export interface FeatureDef {
  id: string;
  name: string;
  source: 'Species' | 'Lineage' | 'Feat' | 'Path' | 'Class';
  text: string; // SRD text; empty for PHB entries (name only)
  /** Limited uses. `short-one`: a short rest regains one use, a long rest all. */
  uses?: { max: number; recharge: Recharge };
  /** A pool of points (Lay on Hands, Focus, Sorcery Points): shown as a counter, not pips. */
  pool?: boolean;
  slot?: EconomySlot; // how it is used in combat, if it takes an action
}

/** Picks the value for a level from [fromLevel, value] steps, ascending. */
const step = (level: number, steps: [number, number][]) => steps.reduce((v, [from, n]) => (level >= from ? n : v), 0);
const dieStep = (level: number, steps: [number, number][]) => `d${step(level, steps)}`;

// ---- Spells known and prepared (2024 class tables) ----
const CANTRIPS: Record<string, [number, number][]> = {
  bard: [[1, 2], [4, 3], [10, 4]], cleric: [[1, 3], [4, 4], [10, 5]], druid: [[1, 2], [4, 3], [10, 4]],
  sorcerer: [[1, 4], [4, 5], [10, 6]], warlock: [[1, 2], [4, 3], [10, 4]], wizard: [[1, 3], [4, 4], [10, 5]],
};
const FULL_PREP = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const HALF_PREP = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];
const PREPARED: Record<string, number[]> = {
  bard: FULL_PREP, cleric: FULL_PREP, druid: FULL_PREP, paladin: HALF_PREP, ranger: HALF_PREP,
  sorcerer: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  wizard: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25],
};
const clampLevel = (level: number) => Math.min(20, Math.max(1, level));
export const cantripsKnown = (classId: string, level: number) => step(clampLevel(level), CANTRIPS[classId] ?? []);
export const preparedSpells = (classId: string, level: number) => PREPARED[classId]?.[clampLevel(level) - 1] ?? 0;

// ---- Numbers that scale with level ----
export const rages = (level: number) => step(level, [[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]]);
export const rageDamage = (level: number) => step(level, [[1, 2], [9, 3], [16, 4]]);
export const sneakAttackDice = (level: number) => Math.ceil(level / 2);
export const martialArtsDie = (level: number) => dieStep(level, [[1, 6], [5, 8], [11, 10], [17, 12]]);
export const bardicDie = (level: number) => dieStep(level, [[1, 6], [5, 8], [10, 10], [15, 12]]);
export const invocations = (level: number) => step(level, [[1, 1], [2, 3], [5, 5], [7, 6], [9, 7], [12, 8], [15, 9], [18, 10]]);
/** Attacks per Attack action: Extra Attack at 5 (Fighter 3 at 11, 4 at 20). */
export function attacksPerAction(classId: string, level: number): number {
  if (classId === 'fighter') return step(level, [[1, 1], [5, 2], [11, 3], [20, 4]]);
  return ['barbarian', 'monk', 'paladin', 'ranger'].includes(classId) && level >= 5 ? 2 : 1;
}

interface Res { max: (c: Character) => number; recharge: Recharge | ((c: Character) => Recharge); slot?: EconomySlot; pool?: boolean; label?: (c: Character) => string }
/** Limited uses of class features, keyed by `<class>:<feature id>`. */
const RESOURCES: Record<string, Res> = {
  'barbarian:rage': { max: (c) => rages(c.level), recharge: 'short-one', slot: 'bonus', label: (c) => `Rage (+${rageDamage(c.level)} damage)` },
  'bard:bardic-inspiration': {
    max: (c) => Math.max(1, abilityMod(c.abilities.cha)), recharge: (c) => (c.level >= 5 ? 'short' : 'long'), slot: 'bonus',
    label: (c) => `Bardic Inspiration (${bardicDie(c.level)})`,
  },
  'cleric:channel-divinity': { max: (c) => step(c.level, [[2, 2], [6, 3], [18, 4]]), recharge: 'short-one', slot: 'action' },
  'paladin:channel-divinity': { max: (c) => step(c.level, [[3, 2], [11, 3]]), recharge: 'short-one', slot: 'action' },
  'druid:wild-shape': { max: (c) => step(c.level, [[2, 2], [6, 3], [17, 4]]), recharge: 'short-one', slot: 'bonus' },
  'fighter:second-wind': { max: (c) => step(c.level, [[1, 2], [4, 3], [10, 4]]), recharge: 'short-one', slot: 'bonus' },
  'fighter:action-surge': { max: (c) => step(c.level, [[2, 1], [17, 2]]), recharge: 'short' },
  'fighter:indomitable': { max: (c) => step(c.level, [[9, 1], [13, 2], [17, 3]]), recharge: 'long' },
  'monk:monks-focus': { max: (c) => c.level, recharge: 'short', pool: true, label: () => 'Focus Points' },
  'monk:uncanny-metabolism': { max: () => 1, recharge: 'long' },
  'paladin:lay-on-hands': { max: (c) => 5 * c.level, recharge: 'long', pool: true, slot: 'bonus', label: () => 'Lay on Hands (HP pool)' },
  'ranger:favored-enemy': { max: (c) => step(c.level, [[1, 2], [5, 3], [9, 4], [13, 5], [17, 6]]), recharge: 'long', label: () => 'Favored Enemy (free Hunter’s Mark)' },
  'sorcerer:font-of-magic': { max: (c) => c.level, recharge: 'long', pool: true, label: () => 'Sorcery Points' },
  'sorcerer:innate-sorcery': { max: () => 2, recharge: 'long', slot: 'bonus' },
  'wizard:arcane-recovery': { max: () => 1, recharge: 'long' },
};
/** Names that show a level-dependent number. */
const LABELS: Record<string, (c: Character) => string> = {
  'rogue:sneak-attack': (c) => `Sneak Attack (${sneakAttackDice(c.level)}d6)`,
  'monk:martial-arts': (c) => `Martial Arts (${martialArtsDie(c.level)})`,
  'warlock:eldritch-invocations': (c) => `Eldritch Invocations (${invocations(c.level)} known)`,
};
/** Features handled by the level-up flow rather than listed. */
const HIDDEN = new Set(['ability-score-improvement', 'epic-boon']);

/** Class features the character has at its level, with uses for limited ones. */
export function classFeatures(c: Character): FeatureDef[] {
  const cls = classById(c.classId);
  return (cls?.features ?? [])
    .filter((f) => f.level <= c.level && !HIDDEN.has(f.id))
    .map((f) => {
      const key = `${c.classId}:${f.id}`;
      const r = RESOURCES[key];
      const max = r?.max(c) ?? 0;
      const name = r?.label?.(c) ?? LABELS[key]?.(c) ?? f.name;
      return {
        id: `class-${f.id}`, name, source: 'Class' as const, text: f.description,
        ...(r && max > 0 ? { uses: { max, recharge: typeof r.recharge === 'function' ? r.recharge(c) : r.recharge }, slot: r.slot, pool: r.pool } : {}),
      };
    });
}

/** Class features first gained at exactly this level. */
export const featuresAtLevel = (classId: string, level: number) =>
  (classById(classId)?.features ?? []).filter((f) => f.level === level && !HIDDEN.has(f.id));

/** Levels that give an Ability Score Improvement (or a feat); 19 gives an Epic Boon. */
export const asiLevels = (classId: string) => classById(classId)?.asiLevels ?? [4, 8, 12, 16];
/** Classes that pick a Fighting Style, and when. */
export const FIGHTING_STYLE_LEVEL: Record<string, number> = { fighter: 1, paladin: 2, ranger: 2 };
