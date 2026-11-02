import type { Ability, AbilityScores } from '../types';

export const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

export const SKILLS: { id: string; name: string; ability: Ability }[] = [
  { id: 'acrobatics', name: 'Acrobatics', ability: 'dex' },
  { id: 'animal-handling', name: 'Animal Handling', ability: 'wis' },
  { id: 'arcana', name: 'Arcana', ability: 'int' },
  { id: 'athletics', name: 'Athletics', ability: 'str' },
  { id: 'deception', name: 'Deception', ability: 'cha' },
  { id: 'history', name: 'History', ability: 'int' },
  { id: 'insight', name: 'Insight', ability: 'wis' },
  { id: 'intimidation', name: 'Intimidation', ability: 'cha' },
  { id: 'investigation', name: 'Investigation', ability: 'int' },
  { id: 'medicine', name: 'Medicine', ability: 'wis' },
  { id: 'nature', name: 'Nature', ability: 'int' },
  { id: 'perception', name: 'Perception', ability: 'wis' },
  { id: 'performance', name: 'Performance', ability: 'cha' },
  { id: 'persuasion', name: 'Persuasion', ability: 'cha' },
  { id: 'religion', name: 'Religion', ability: 'int' },
  { id: 'sleight-of-hand', name: 'Sleight of Hand', ability: 'dex' },
  { id: 'stealth', name: 'Stealth', ability: 'dex' },
  { id: 'survival', name: 'Survival', ability: 'wis' },
];
export const skillName = (id: string) => SKILLS.find((s) => s.id === id)?.name ?? id;

export const abilityMod = (score: number) => Math.floor((score - 10) / 2);
export const proficiencyBonus = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4);

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const POINT_BUY_BUDGET = 27;
export const pointBuySpent = (s: AbilityScores) =>
  ABILITIES.reduce((sum, a) => sum + (POINT_BUY_COST[s[a]] ?? 99), 0);

export function skillBonus(scores: AbilityScores, level: number, skill: string, proficient: string[], expertise: string[]) {
  const ab = SKILLS.find((s) => s.id === skill)!.ability;
  const pb = proficiencyBonus(level);
  return abilityMod(scores[ab]) + (expertise.includes(skill) ? 2 * pb : proficient.includes(skill) ? pb : 0);
}

/** Default max HP: max hit die at level 1, then the fixed average (die/2 + 1) per level, plus CON each level. */
export function defaultMaxHp(hitDie: number, level: number, con: number) {
  const mod = abilityMod(con);
  return Math.max(1, hitDie + mod + (level - 1) * (hitDie / 2 + 1 + mod));
}
