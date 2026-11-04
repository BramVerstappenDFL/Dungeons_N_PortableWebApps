import type { Ability, Character, CharacterSpell } from '../types';
import { classById, speciesById } from '../data';
import { ABILITIES, abilityMod, proficiencyBonus, skillBonus } from './abilities';
import { armorClassOf, featuresOf, originOf } from './origin';
import { attacksPerAction, classLevels, hitDicePools, slotsOf, sneakAttackDice } from './classes';

/** Spellcasting numbers for one class. */
export interface ClassCasting { classId: string | null; ability: Ability; mod: number; dc: number; attack: number }

export const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible',
  'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
];

/** Values computed from a character's stored data. */
export function derive(c: Character) {
  const cls = classById(c.classId);
  const species = speciesById(c.speciesId);
  const pb = proficiencyBonus(c.level);
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, abilityMod(c.abilities[a])])) as Record<Ability, number>;
  const levels = classLevels(c);
  const casting = (classId: string | null, ability: Ability): ClassCasting => ({
    classId, ability, mod: mods[ability], dc: 8 + pb + mods[ability], attack: pb + mods[ability],
  });
  // One entry per spellcasting class, starting class first. Characters without Spellcasting
  // (e.g. via feats) fall back to their best mental ability.
  const casters = levels.filter((x) => classById(x.id)?.spellAbility).map((x) => casting(x.id, classById(x.id)!.spellAbility!));
  const castings = casters.length
    ? casters
    : [casting(null, (['int', 'wis', 'cha'] as Ability[]).reduce((best, a) => (mods[a] > mods[best] ? a : best), 'int'))];
  const main = castings[0];
  const spellAbility = main.ability;
  const spellMod = main.mod;
  const { slots, pact } = slotsOf(c);
  const rogue = levels.find((x) => x.id === 'rogue');
  // 2024 Exhaustion: d20 tests take -2 per level.
  const d20Penalty = -2 * c.exhaustion;
  const origin = originOf(c);
  return {
    origin,
    features: featuresOf(c),
    ac: armorClassOf(c),
    // Extra Attack from several classes does not stack: take the best.
    attacks: Math.max(...levels.map((x) => attacksPerAction(x.id, x.level))),
    sneakAttack: rogue ? `${sneakAttackDice(rogue.level)}d6` : null,
    cls,
    /** Every class with its level, starting class first. */
    classes: levels,
    species,
    pb,
    mods,
    spellAbility,
    spellMod,
    spellDC: 8 + pb + spellMod,
    spellAttack: pb + spellMod,
    /** Spellcasting classes, each with its own ability, DC and attack. */
    castings,
    /** Distinct casting abilities, for display. */
    castingAbilities: castings.filter((x, i) => castings.findIndex((y) => y.ability === x.ability) === i),
    /** Casting numbers for a class spell: the class it was learned for, else the starting caster class. */
    classCasting: (cs?: CharacterSpell) => castings.find((x) => x.classId === cs?.classId) ?? main,
    slotsMax: slots,
    /** Warlock Pact Magic slots, tracked apart from the other slots. */
    pact,
    hitDice: hitDicePools(c),
    speed: Math.max(0, (c.speedOverride ?? origin.speed) - 5 * c.exhaustion),
    initiative: mods.dex + origin.initiativeBonus + d20Penalty,
    passivePerception: 10 + skillBonus(c.abilities, c.level, 'perception', c.skills, c.expertise),
    // Saving throws come from the starting class only; multiclassing does not add any.
    saveBonus: (a: Ability) => mods[a] + (cls?.saves.includes(a) || c.saveProficiencies?.includes(a) ? pb : 0) + d20Penalty,
    skill: (id: string) => skillBonus(c.abilities, c.level, id, c.skills, c.expertise) + d20Penalty,
    check: (a: Ability) => mods[a] + d20Penalty,
    hitDie: cls?.hitDie ?? 8,
    d20Penalty,
  };
}
export type Derived = ReturnType<typeof derive>;
