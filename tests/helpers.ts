import type { Character } from '../src/types';
export function makeCharacter(over: Partial<Character> = {}): Character {
  return {
    id: 'c1', name: 'Test', classes: [{ id: 'wizard', level: 5 }], speciesId: 'elf', backgroundId: 'sage',
    abilities: { str: 8, dex: 14, con: 14, int: 17, wis: 12, cha: 10 },
    skills: [], expertise: [], armorClass: 12,
    hp: { max: 32, current: 32, temp: 0 }, hitDiceUsed: {},
    deathSaves: { successes: 0, failures: 0 }, exhaustion: 0, conditions: [],
    spellSlotsUsed: Array(9).fill(0), pactSlotsUsed: 0, spells: [], customSpells: [], concentration: null,
    inventory: [], currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, rollLog: [], notes: '',
    createdAt: 0, updatedAt: 0, ...over,
  };
}
