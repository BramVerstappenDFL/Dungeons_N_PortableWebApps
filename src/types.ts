export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type AbilityScores = Record<Ability, number>;
export type CasterType = 'full' | 'half' | 'pact' | 'none';

export interface ClassData {
  id: string;
  name: string;
  hitDie: number;
  saves: Ability[];
  skillCount: number;
  skillOptions: string[] | null;
  spellAbility: Ability | null;
  casterType: CasterType;
}
export interface SpeciesData { id: string; name: string; speed: number; size: string; description: string }
export interface BackgroundData { id: string; name: string; skills: string[]; abilities: Ability[]; description: string }
export interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  classes: string[];
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  description: string;
  material?: string;
  concentration?: boolean;
  ritual?: boolean;
  save?: Ability;
  attack?: 'melee' | 'ranged';
  damage?: string;
  damageType?: string;
  damageBonus?: number;
  damageAddsMod?: boolean;
  upcastDice?: number;
  heal?: string;
  healBonus?: number;
  healAddsMod?: boolean;
  upcastHealDice?: number;
  upcastHealBonus?: number;
  cantripScaling?: boolean;
}

export interface Item {
  id: string;
  name: string;
  qty: number;
  weight: number; // lb per item
  notes: string;
  equipped: boolean;
}
export interface Currency { cp: number; sp: number; ep: number; gp: number; pp: number }

export interface CharacterSpell {
  id: string;
  prepared: boolean;
  /** Class whose spellcasting ability the spell uses (multiclass). Defaults to the first caster class. */
  classId?: string;
}

export interface ClassLevel { id: string; level: number; subclass?: string }

export interface RollLogEntry {
  id: string;
  label: string;
  expression: string;
  total: number;
  detail: string;
  time: number;
  crit?: 'hit' | 'miss';
}

export type ScoreMethod = 'standard' | 'pointbuy' | 'manual';
export interface CreationInfo {
  method: ScoreMethod;
  base: AbilityScores;
  boosts: Partial<Record<Ability, number>>;
  hpAuto: boolean;
  /** Scores came from another app and already include every bonus; background increases are not asked. */
  imported?: boolean;
}

export interface Character {
  id: string;
  name: string;
  /** First entry is the starting class (saving throws, skill choices, level 1 HP). */
  classes: ClassLevel[];
  speciesId: string;
  backgroundId: string;
  abilities: AbilityScores; // final scores incl. background boosts
  skills: string[]; // proficient skills
  expertise: string[];
  armorClass: number;
  speedOverride?: number;
  hp: { max: number; current: number; temp: number };
  /** Spent Hit Dice keyed by die size, e.g. { 10: 1, 8: 2 }. */
  hitDiceUsed: Record<number, number>;
  deathSaves: { successes: number; failures: number };
  exhaustion: number;
  conditions: string[];
  spellSlotsUsed: number[]; // index 0 = level 1 slots used (Spellcasting slots)
  pactSlotsUsed: number; // Warlock Pact Magic slots used
  spells: CharacterSpell[];
  /** Spells that are not in the SRD list, stored on the character. Ids start with "custom-". */
  customSpells: Spell[];
  concentration: string | null; // spell id
  inventory: Item[];
  currency: Currency;
  rollLog: RollLogEntry[];
  notes: string;
  creation?: CreationInfo;
  createdAt: number;
  updatedAt: number;
}
