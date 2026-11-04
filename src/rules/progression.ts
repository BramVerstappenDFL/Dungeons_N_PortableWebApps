// Levelling up (2024 rules): what a new level brings, and applying the player's choices.
import type { Ability, Character, ClassFeature, LevelRecord, SubclassFeature } from '../types';
import { classById, featById, subclassById } from '../data';
import { abilityMod, proficiencyBonus } from './abilities';
import type { PactSlots } from './slots';
import { levelForXp } from './xp';
import { originOf } from './origin';
import {
  FIGHTING_STYLE_LEVEL, asiLevels, cantripsKnown, classFeatures, classLevelOf, classLevels, featuresAtLevel, preparedSpells,
  slotsOf, withClassLevel,
} from './classes';

export const MAX_LEVEL = 20;

/** Levels the character's XP has earned but not yet taken. */
export const pendingLevels = (c: Character) => Math.max(0, levelForXp(c.xp) - c.level);

/** Fixed hit points per level: half the die plus one. */
export const hpAverage = (hitDie: number) => hitDie / 2 + 1;

export interface LevelUpPlan {
  level: number; // the character level being reached
  classId: string; // the class taking the level
  classLevel: number; // the level reached in that class
  newClass: boolean; // multiclassing into this class now
  hitDie: number;
  hpAverage: number;
  conMod: number;
  bonusPerLevel: number; // Dwarven Toughness, Tough
  subclass: boolean; // choose a subclass now
  asi: boolean; // Ability Score Improvement or a feat
  epicBoon: boolean;
  fightingStyle: boolean;
  classFeatures: ClassFeature[];
  pathFeatures: SubclassFeature[];
  newCantrips: number;
  prepared: [number, number];
  slots: [number[], number[]];
  pact: [PactSlots | null, PactSlots | null];
  pb: [number, number];
  resources: { name: string; from: number; to: number }[];
}

export const hasFightingStyle = (c: Character) => (c.feats ?? []).some((f) => featById(f.id)?.category === 'fighting-style');

/** The subclass a class has on this character. */
export const subclassOf = (c: Character, classId: string) => classLevels(c).find((x) => x.id === classId)?.subclassId;

/** What reaching the next level brings, taken in `classId` (default: the starting class). */
export function levelUpPlan(c: Character, subclassId?: string, classId = c.classId): LevelUpPlan {
  const level = c.level + 1;
  const from = classLevelOf(c, classId);
  const classLevel = from + 1;
  const sub = subclassId ?? subclassOf(c, classId);
  const cls = classById(classId);
  const hitDie = cls?.hitDie ?? 8;
  const styleAt = FIGHTING_STYLE_LEVEL[classId];
  const after = withClassLevel(c, classId, sub);
  const [slotsBefore, slotsAfter] = [slotsOf(c), slotsOf(after)];
  const known = (n: number, f: (id: string, l: number) => number) => (n > 0 ? f(classId, n) : 0);
  const before = new Map(classFeatures(c).map((f) => [f.id, f]));
  const resources = classFeatures(after)
    .filter((f) => f.uses && before.get(f.id)?.uses && before.get(f.id)!.uses!.max !== f.uses.max)
    .map((f) => ({ name: f.name.replace(/ \(.*\)$/, ''), from: before.get(f.id)!.uses!.max, to: f.uses!.max }));
  return {
    level,
    classId,
    classLevel,
    newClass: from === 0,
    hitDie,
    hpAverage: hpAverage(hitDie),
    conMod: abilityMod(c.abilities.con),
    bonusPerLevel: originOf(c).hpPerLevel,
    subclass: classLevel === 3,
    asi: asiLevels(classId).includes(classLevel),
    epicBoon: classLevel === 19,
    fightingStyle: !!styleAt && classLevel >= styleAt && !hasFightingStyle(c),
    classFeatures: featuresAtLevel(classId, classLevel),
    pathFeatures: (subclassById(sub)?.features ?? []).filter((f) => f.level === classLevel),
    newCantrips: Math.max(0, known(classLevel, cantripsKnown) - known(from, cantripsKnown)),
    prepared: [known(from, preparedSpells), known(classLevel, preparedSpells)],
    slots: [slotsBefore.slots, slotsAfter.slots],
    pact: [slotsBefore.pact, slotsAfter.pact],
    pb: [proficiencyBonus(c.level), proficiencyBonus(level)],
    resources,
  };
}

export type AsiChoice =
  | { kind: 'plus2'; ability: Ability }
  | { kind: 'plus1'; abilities: [Ability, Ability] }
  | { kind: 'feat'; featId: string; ability?: Ability; skill?: string; expertise?: string };

export interface LevelUpChoices {
  hp: { mode: 'average' } | { mode: 'roll'; roll: number };
  classId?: string; // the class taking the level (default: the starting class)
  subclassId?: string;
  asi?: AsiChoice; // also used for the Epic Boon (a feat)
  fightingStyle?: string;
  cantrips?: string[];
}

/** Ability scores after an ASI or feat. Scores cap at 20, or 30 for Epic Boons. */
export function applyAsi(abilities: Character['abilities'], asi: AsiChoice | undefined): Character['abilities'] {
  if (!asi) return abilities;
  const out = { ...abilities };
  const cap = asi.kind === 'feat' && featById(asi.featId)?.category === 'epic-boon' ? 30 : 20;
  const add = (a: Ability, n: number) => { out[a] = Math.min(Math.max(cap, abilities[a]), out[a] + n); };
  if (asi.kind === 'plus2') add(asi.ability, 2);
  if (asi.kind === 'plus1') asi.abilities.forEach((a) => add(a, 1));
  if (asi.kind === 'feat' && asi.ability) add(asi.ability, 1);
  return out;
}

/** True when the choices cover everything the plan asks for. */
export function choicesComplete(plan: LevelUpPlan, ch: Partial<LevelUpChoices>): boolean {
  if (!ch.hp) return false;
  if (plan.subclass && !ch.subclassId) return false;
  if ((plan.asi || plan.epicBoon) && !asiComplete(ch.asi)) return false;
  if (plan.fightingStyle && !ch.fightingStyle) return false;
  if (plan.newCantrips && (ch.cantrips?.length ?? 0) < plan.newCantrips) return false;
  return true;
}
export function asiComplete(asi: AsiChoice | undefined): boolean {
  if (!asi) return false;
  if (asi.kind === 'plus1') return asi.abilities[0] !== asi.abilities[1];
  if (asi.kind === 'feat') {
    const f = featById(asi.featId);
    if (!f) return false;
    if (f.abilities?.length && !asi.ability) return false;
    if (asi.featId === 'skill-expert' && (!asi.skill || !asi.expertise)) return false;
  }
  return true;
}

/** Applies one level with the player's choices. Pure; records what changed so it can be undone. */
export function applyLevelUp(c: Character, ch: LevelUpChoices): Character {
  if (c.level >= MAX_LEVEL) return c;
  const classId = ch.classId ?? c.classId;
  const plan = levelUpPlan(c, ch.subclassId, classId);
  const level = plan.level;
  const record: LevelRecord = {
    level, hp: 0, ...(classId !== c.classId ? { classId } : {}), ...(ch.hp.mode === 'roll' ? { rolled: ch.hp.roll } : {}),
    before: {
      abilities: c.abilities, subclassId: c.subclassId, skills: c.skills, expertise: c.expertise, spells: c.spells,
      feats: c.feats, saveProficiencies: c.saveProficiencies, speedOverride: c.speedOverride, multiclass: c.multiclass,
    },
  };

  let next: Character = withClassLevel(c, classId, ch.subclassId);
  const feats = [...(c.feats ?? [])];
  const asi = plan.asi || plan.epicBoon ? ch.asi : undefined;
  next.abilities = applyAsi(c.abilities, asi);
  if (asi?.kind === 'feat') {
    feats.push({ id: asi.featId, level, ...(asi.ability ? { ability: asi.ability } : {}) });
    if (asi.featId === 'resilient' && asi.ability) next.saveProficiencies = [...new Set([...(c.saveProficiencies ?? []), asi.ability])];
    if (asi.featId === 'skill-expert') {
      if (asi.skill) next.skills = [...new Set([...c.skills, asi.skill])];
      if (asi.expertise) next.expertise = [...new Set([...c.expertise, asi.expertise])];
    }
  }
  if (plan.fightingStyle && ch.fightingStyle) feats.push({ id: ch.fightingStyle, level });
  next.feats = feats;
  if (ch.cantrips?.length) {
    const multi = classLevels(next).length > 1;
    next.spells = [...c.spells, ...ch.cantrips.filter((id) => !c.spells.some((s) => s.id === id)).map((id) => ({ id, prepared: true, ...(multi ? { classId } : {}) }))];
  }

  // Hit points: the die (rolled or average) + CON, at least 1, plus per-level bonuses. A higher CON
  // modifier or a new per-level bonus (Tough) also counts for every earlier level.
  const die = ch.hp.mode === 'roll' ? ch.hp.roll : plan.hpAverage;
  const gain = Math.max(1, die + plan.conMod) + plan.bonusPerLevel;
  const retro = (abilityMod(next.abilities.con) - plan.conMod + (originOf(next).hpPerLevel - plan.bonusPerLevel)) * level;
  record.hp = gain + retro;
  next = {
    ...next,
    hp: { ...c.hp, max: c.hp.max + record.hp, current: c.hp.current + record.hp },
    levelHistory: [...(c.levelHistory ?? []), record],
  };
  return next;
}

/** Undoes the most recent level-up. */
export function undoLastLevel(c: Character): Character {
  const rec = c.levelHistory?.at(-1);
  if (!rec || rec.level !== c.level) return c;
  const max = Math.max(1, c.hp.max - rec.hp);
  return {
    ...c,
    ...rec.before,
    // Records from before multiclassing have no `multiclass` key: those levels were all in the starting class.
    multiclass: 'multiclass' in rec.before ? rec.before.multiclass : c.multiclass,
    level: c.level - 1,
    hp: { ...c.hp, max, current: Math.min(max, Math.max(0, c.hp.current - rec.hp)) },
    levelHistory: c.levelHistory!.slice(0, -1),
  };
}
