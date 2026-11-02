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

export interface CharacterSpell { id: string; prepared: boolean }

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
}

export interface Character {
  id: string;
  name: string;
  classId: string;
  level: number;
  speciesId: string;
  backgroundId: string;
  abilities: AbilityScores; // final scores incl. background boosts
  skills: string[]; // proficient skills
  expertise: string[];
  armorClass: number;
  speedOverride?: number;
  hp: { max: number; current: number; temp: number };
  hitDiceUsed: number;
  deathSaves: { successes: number; failures: number };
  exhaustion: number;
  conditions: string[];
  spellSlotsUsed: number[]; // index 0 = level 1 slots used (pact slots for warlocks)
  spells: CharacterSpell[];
  concentration: string | null; // spell id
  inventory: Item[];
  currency: Currency;
  rollLog: RollLogEntry[];
  notes: string;
  creation?: CreationInfo;
  createdAt: number;
  updatedAt: number;
}
