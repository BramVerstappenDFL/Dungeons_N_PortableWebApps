// Player's Handbook (2024) entries that are not in the SRD.
// Hand-maintained. Names and game mechanics only: no rules or flavour text from the book.
import type { BackgroundData, FeatData, SpeciesData, SubclassData } from '../types';

const SRC = 'PHB 2024' as const;
const gold = [{ id: 'b', items: [], gp: 50 }];

const bg = (id: string, name: string, abilities: BackgroundData['abilities'], skills: string[], feat: string, tool: string, featNote?: string): BackgroundData =>
  ({ id, name, abilities, skills, feat, featNote, tool, kits: gold, description: '', source: SRC });

export const PHB_BACKGROUNDS: BackgroundData[] = [
  bg('artisan', 'Artisan', ['str', 'dex', 'int'], ['investigation', 'persuasion'], 'crafter', "Artisan's Tools"),
  bg('charlatan', 'Charlatan', ['dex', 'con', 'cha'], ['deception', 'sleight-of-hand'], 'skilled', 'Forgery Kit'),
  bg('entertainer', 'Entertainer', ['str', 'dex', 'cha'], ['acrobatics', 'performance'], 'musician', 'Musical Instrument'),
  bg('farmer', 'Farmer', ['str', 'con', 'wis'], ['animal-handling', 'nature'], 'tough', "Carpenter's Tools"),
  bg('guard', 'Guard', ['str', 'int', 'wis'], ['athletics', 'perception'], 'alert', 'Gaming Set'),
  bg('guide', 'Guide', ['dex', 'con', 'wis'], ['stealth', 'survival'], 'magic-initiate', "Cartographer's Tools", 'Druid'),
  bg('hermit', 'Hermit', ['con', 'wis', 'cha'], ['medicine', 'religion'], 'healer', 'Herbalism Kit'),
  bg('merchant', 'Merchant', ['con', 'int', 'cha'], ['animal-handling', 'persuasion'], 'lucky', "Navigator's Tools"),
  bg('noble', 'Noble', ['str', 'int', 'cha'], ['history', 'persuasion'], 'skilled', 'Gaming Set'),
  bg('sailor', 'Sailor', ['str', 'dex', 'wis'], ['acrobatics', 'perception'], 'tavern-brawler', "Navigator's Tools"),
  bg('scribe', 'Scribe', ['dex', 'int', 'wis'], ['investigation', 'perception'], 'skilled', "Calligrapher's Supplies"),
  bg('wayfarer', 'Wayfarer', ['dex', 'wis', 'cha'], ['insight', 'stealth'], 'lucky', "Thieves' Tools"),
];

const trait = (name: string) => ({ id: name.toLowerCase().replace(/\s+/g, '-'), name, description: '' });
export const PHB_SPECIES: SpeciesData[] = [
  {
    id: 'aasimar', name: 'Aasimar', speed: 30, size: 'medium', sizes: ['medium', 'small'], lineage: false, description: '', source: SRC,
    traits: ['Celestial Resistance', 'Darkvision', 'Healing Hands', 'Light Bearer', 'Celestial Revelation'].map(trait),
  },
];

const feat = (id: string, name: string): FeatData => ({ id, name, category: 'origin', description: '', source: SRC });
export const PHB_FEATS: FeatData[] = [
  feat('crafter', 'Crafter'), feat('healer', 'Healer'), feat('lucky', 'Lucky'),
  feat('musician', 'Musician'), feat('tavern-brawler', 'Tavern Brawler'), feat('tough', 'Tough'),
];

const SUBCLASS_NAMES: Record<string, string[]> = {
  barbarian: ['Path of the Wild Heart', 'Path of the World Tree', 'Path of the Zealot'],
  bard: ['College of Dance', 'College of Glamour', 'College of Valor'],
  cleric: ['Light Domain', 'Trickery Domain', 'War Domain'],
  druid: ['Circle of the Moon', 'Circle of the Sea', 'Circle of the Stars'],
  fighter: ['Battle Master', 'Eldritch Knight', 'Psi Warrior'],
  monk: ['Warrior of Mercy', 'Warrior of Shadow', 'Warrior of the Elements'],
  paladin: ['Oath of Glory', 'Oath of the Ancients', 'Oath of Vengeance'],
  ranger: ['Beast Master', 'Fey Wanderer', 'Gloom Stalker'],
  rogue: ['Arcane Trickster', 'Assassin', 'Soulknife'],
  sorcerer: ['Aberrant Sorcery', 'Clockwork Sorcery', 'Wild Magic Sorcery'],
  warlock: ['Archfey Patron', 'Celestial Patron', 'Great Old One Patron'],
  wizard: ['Abjurer', 'Diviner', 'Illusionist'],
};
export const PHB_SUBCLASSES: SubclassData[] = Object.entries(SUBCLASS_NAMES).flatMap(([classId, names]) =>
  names.map((name) => ({ id: name.toLowerCase().replace(/\s+/g, '-'), name, classId, description: '', source: SRC })));
