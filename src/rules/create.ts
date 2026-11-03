import type { Ability, AbilityScores, Character, CharacterSpell, Item, KitItem, Size, StartingKit } from '../types';
import { classById } from '../data';
import { armorClassFrom, originOf } from './origin';
import { ABILITIES, defaultMaxHp, STANDARD_ARRAY } from './abilities';
import { newCombat } from './combat';

/** Fallback key ability per class, when the data has no primary ability. */
const KEY_FALLBACK: Record<string, Ability> = {
  barbarian: 'str', fighter: 'str', paladin: 'str', monk: 'dex', rogue: 'dex', ranger: 'dex',
  bard: 'cha', sorcerer: 'cha', warlock: 'cha', cleric: 'wis', druid: 'wis', wizard: 'int',
};
/** The ability a class leans on most. */
export const keyAbility = (classId: string): Ability => classById(classId)?.primary?.[0] ?? KEY_FALLBACK[classId] ?? 'str';

/** A standard-array spread for a class: 15 in its key ability, then CON and DEX, ending 8. */
export function suggestedScores(key: Ability): AbilityScores {
  const order = [...new Set<Ability>([key, 'con', 'dex', 'wis', 'cha', 'int', 'str'])];
  return Object.fromEntries(order.map((a, i) => [a, STANDARD_ARRAY[i]])) as AbilityScores;
}

/** True when the six scores are exactly the standard array in some order. */
export function isStandardArray(s: AbilityScores): boolean {
  return [...ABILITIES.map((a) => s[a])].sort((x, y) => y - x).join() === STANDARD_ARRAY.join();
}

/** Swaps two abilities' scores (how the standard array is reassigned). */
export function swapScores(s: AbilityScores, a: Ability, b: Ability): AbilityScores {
  return { ...s, [a]: s[b], [b]: s[a] };
}

/** Default +2/+1: the class key ability if the background offers it, then the best other option. */
export function defaultBoosts(allowed: Ability[], key: Ability, base: AbilityScores): Partial<Record<Ability, number>> {
  if (allowed.length < 2) return {};
  const sorted = [...allowed].sort((a, b) => (a === key ? -1 : b === key ? 1 : base[b] - base[a]));
  return { [sorted[0]]: 2, [sorted[1]]: 1 };
}

/** Background languages: Common plus two others (standard ones in the 2024 rules). */
export const LANGUAGE_PICKS = 2;
export function languagesValid(picked: string[]): boolean {
  return new Set(picked).size === LANGUAGE_PICKS && !picked.includes('common');
}

/** Inventory items for the chosen starting kits. Weapons and armour start equipped. */
export function kitItems(kits: (StartingKit | undefined)[], makeId: () => string): Item[] {
  const out: Item[] = [];
  for (const k of kits) for (const i of k?.items ?? []) {
    const existing = out.find((o) => o.name === i.name && !i.armor);
    if (existing) { existing.qty += i.qty; continue; }
    out.push({
      id: makeId(), name: i.name, qty: i.qty, weight: i.weight, notes: '',
      equipped: !!(i.weaponId || i.armor), kind: i.weaponId ? 'weapon' : 'gear',
      ...(i.weaponId ? { weaponId: i.weaponId } : {}),
      ...(i.armor ? { armor: i.armor } : {}),
    });
  }
  return out;
}

/** Starting gold from the chosen kits. */
export const kitGold = (kits: (StartingKit | undefined)[]) => kits.reduce((t, k) => t + (k?.gp ?? 0), 0);

/** Armour class at level 1 from the kit armour (see `armorClassFrom`). */
export const startingArmorClass = (classId: string, scores: AbilityScores, items: KitItem[]) => armorClassFrom(classId, scores, items);

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
  method?: 'standard' | 'pointbuy';
  lineageId?: string;
  size?: Size;
  subclassId?: string;
  originFeat?: string;
  originFeatNote?: string;
  languages?: string[]; // picked besides Common
  kits?: (StartingKit | undefined)[]; // class kit, background kit
  makeId?: () => string;
  originAbility?: Ability;
  extraFeat?: string; // Human Versatile
  extraFeatNote?: string;
  originPicks?: { keenSenses?: string; skillful?: string; skilled?: string[] };
  featSpells?: CharacterSpell[]; // Magic Initiate picks
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

/** Builds a new level-1 character, with the chosen starting kits in the pack. */
export function buildCharacter(i: NewCharacterInput): Character {
  const cls = classById(i.classId);
  const abilities = applyBoosts(i.base, i.boosts);
  const kits = i.kits ?? [];
  let n = 0;
  const makeId = i.makeId ?? (() => `${i.id}-k${n++}`);
  const hitDie = cls?.hitDie ?? 8;
  const draft: Character = {
    id: i.id,
    name: i.name.trim(),
    classId: i.classId,
    level: 1,
    speciesId: i.speciesId,
    backgroundId: i.backgroundId,
    abilities,
    skills: [...new Set([...i.backgroundSkills, ...i.classSkills])],
    expertise: [],
    armorClass: startingArmorClass(i.classId, abilities, kits.flatMap((k) => k?.items ?? [])),
    hp: { max: 0, current: 0, temp: 0 },
    hitDiceUsed: 0,
    deathSaves: { successes: 0, failures: 0 },
    exhaustion: 0,
    conditions: [],
    spellSlotsUsed: Array(9).fill(0),
    spells: i.featSpells ?? [],
    concentration: null,
    inventory: kitItems(kits, makeId),
    currency: { cp: 0, sp: 0, ep: 0, gp: kitGold(kits), pp: 0 },
    rollLog: [],
    xp: 0,
    inspiration: false,
    notes: [],
    combat: newCombat(),
    creation: { method: i.method ?? 'pointbuy', base: i.base, boosts: i.boosts, hpAuto: true, acAuto: true },
    ...(i.lineageId ? { lineageId: i.lineageId } : {}),
    ...(i.size ? { size: i.size } : {}),
    ...(i.subclassId ? { subclassId: i.subclassId } : {}),
    ...(i.originFeat ? { originFeat: i.originFeat } : {}),
    ...(i.originFeatNote ? { originFeatNote: i.originFeatNote } : {}),
    ...(i.originAbility ? { originAbility: i.originAbility } : {}),
    ...(i.extraFeat ? { extraFeat: i.extraFeat } : {}),
    ...(i.extraFeatNote ? { extraFeatNote: i.extraFeatNote } : {}),
    ...(i.originPicks ? { originPicks: i.originPicks } : {}),
    languages: ['common', ...(i.languages ?? []).filter((l) => l !== 'common')],
    featureUses: {},
    createdAt: i.now,
    updatedAt: i.now,
  };
  // Species, lineage and feat effects: extra skills and tools, and HP per level (Dwarven Toughness, Tough).
  const o = originOf(draft);
  const maxHp = defaultMaxHp(hitDie, 1, abilities.con) + o.hpPerLevel;
  return {
    ...draft,
    skills: [...new Set([...draft.skills, ...o.skills])],
    tools: o.tools,
    hp: { max: maxHp, current: maxHp, temp: 0 },
  };
}
