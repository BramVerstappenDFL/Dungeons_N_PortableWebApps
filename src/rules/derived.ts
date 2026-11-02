import type { Ability, Character } from '../types';
import { classById, speciesById } from '../data';
import { ABILITIES, abilityMod, proficiencyBonus, skillBonus } from './abilities';
import { maxSlots } from './slots';

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
  // Classes without Spellcasting (e.g. via feats) fall back to their best mental ability.
  const spellAbility: Ability =
    cls?.spellAbility ?? (['int', 'wis', 'cha'] as Ability[]).reduce((best, a) => (mods[a] > mods[best] ? a : best), 'int');
  const spellMod = mods[spellAbility];
  // 2024 Exhaustion: d20 tests take -2 per level.
  const d20Penalty = -2 * c.exhaustion;
  return {
    cls,
    species,
    pb,
    mods,
    spellAbility,
    spellMod,
    spellDC: 8 + pb + spellMod,
    spellAttack: pb + spellMod,
    slotsMax: maxSlots(cls?.casterType ?? 'none', c.level),
    speed: Math.max(0, (c.speedOverride ?? species?.speed ?? 30) - 5 * c.exhaustion),
    initiative: mods.dex + d20Penalty,
    passivePerception: 10 + skillBonus(c.abilities, c.level, 'perception', c.skills, c.expertise),
    saveBonus: (a: Ability) => mods[a] + (cls?.saves.includes(a) ? pb : 0) + d20Penalty,
    skill: (id: string) => skillBonus(c.abilities, c.level, id, c.skills, c.expertise) + d20Penalty,
    check: (a: Ability) => mods[a] + d20Penalty,
    hitDie: cls?.hitDie ?? 8,
    d20Penalty,
  };
}
export type Derived = ReturnType<typeof derive>;
