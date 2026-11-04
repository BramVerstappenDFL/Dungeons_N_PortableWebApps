import type { Ability, Character, CharacterSpell, ClassData } from '../types';
import { classById, speciesById } from '../data';
import { ABILITIES, abilityMod, proficiencyBonus, skillBonus } from './abilities';
import { multiclassSlots } from './slots';
import { hitDicePools, primaryClass, totalLevel } from './classes';

export const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible',
  'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
];

export interface Casting { classId: string | null; ability: Ability; mod: number; dc: number; attack: number }

/** Values computed from a character's stored data. */
export function derive(c: Character) {
  const cls = primaryClass(c);
  const classes = c.classes
    .map((x) => ({ ...x, data: classById(x.id) }))
    .filter((x): x is typeof x & { data: ClassData } => !!x.data);
  const species = speciesById(c.speciesId);
  const level = totalLevel(c);
  const pb = proficiencyBonus(level);
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, abilityMod(c.abilities[a])])) as Record<Ability, number>;
  const makeCasting = (classId: string | null, ability: Ability): Casting => ({
    classId, ability, mod: mods[ability], dc: 8 + pb + mods[ability], attack: pb + mods[ability],
  });
  // One entry per spellcasting class. Characters without Spellcasting (e.g. via feats)
  // fall back to their best mental ability.
  const casters = classes.filter((x) => x.data.spellAbility).map((x) => makeCasting(x.id, x.data.spellAbility!));
  const casting = casters.length
    ? casters
    : [makeCasting(null, (['int', 'wis', 'cha'] as Ability[]).reduce((best, a) => (mods[a] > mods[best] ? a : best), 'int'))];
  const main = casting[0];
  const { slots, pact } = multiclassSlots(classes.map((x) => ({ casterType: x.data.casterType, level: x.level })));
  const hitDice = hitDicePools(c);
  // 2024 Exhaustion: d20 tests take -2 per level.
  const d20Penalty = -2 * c.exhaustion;
  return {
    cls,
    classes,
    species,
    level,
    pb,
    mods,
    casting,
    /** Distinct casting abilities, for display. */
    castingAbilities: casting.filter((x, i) => casting.findIndex((y) => y.ability === x.ability) === i),
    castingFor: (ref?: CharacterSpell) => casting.find((x) => x.classId === ref?.classId) ?? main,
    spellAbility: main.ability,
    spellMod: main.mod,
    spellDC: main.dc,
    spellAttack: main.attack,
    slotsMax: slots,
    pact,
    hitDice,
    speed: Math.max(0, (c.speedOverride ?? species?.speed ?? 30) - 5 * c.exhaustion),
    initiative: mods.dex + d20Penalty,
    passivePerception: 10 + skillBonus(c.abilities, level, 'perception', c.skills, c.expertise),
    // Multiclassing does not grant the saving throws of later classes.
    saveBonus: (a: Ability) => mods[a] + (cls?.saves.includes(a) ? pb : 0) + d20Penalty,
    skill: (id: string) => skillBonus(c.abilities, level, id, c.skills, c.expertise) + d20Penalty,
    check: (a: Ability) => mods[a] + d20Penalty,
    d20Penalty,
  };
}
export type Derived = ReturnType<typeof derive>;
