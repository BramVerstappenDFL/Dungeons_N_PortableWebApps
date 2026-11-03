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
  primary?: Ability[];
  kits?: StartingKit[];
  features?: ClassFeature[];
  asiLevels?: number[];
}
export interface ClassFeature { id: string; name: string; level: number; description: string }
/** Where an entry comes from. PHB 2024 entries carry names and mechanics only, never rules text. */
export type Source = 'SRD 5.2.1' | 'PHB 2024';
export interface KitItem { name: string; qty: number; weight: number; weaponId?: string; armor?: ArmorInfo }
export interface StartingKit { id: string; items: KitItem[]; gp: number }
/** Rules effects the app applies, extracted from the SRD (or listed for PHB entries). */
export interface Mechanics {
  resistances?: string[];
  darkvision?: number;
  hpPerLevel?: number;
  speedBonus?: number;
  spells?: { id: string; minLevel: number }[];
  abilityChoice?: boolean; // int/wis/cha spellcasting ability for granted spells
}
export interface TraitData extends Mechanics { id: string; name: string; description: string }
export type Size = 'small' | 'medium';
export interface SpeciesData {
  id: string; name: string; speed: number; size: string; description: string;
  sizes?: Size[]; lineage?: boolean; traits?: TraitData[]; source?: Source;
}
export interface BackgroundData {
  id: string; name: string; skills: string[]; abilities: Ability[]; description: string;
  feat?: string; featNote?: string; tool?: string; kits?: StartingKit[]; source?: Source;
}
export interface LineageData extends Mechanics { id: string; name: string; speciesId: string; damageType?: string; description: string; source?: Source }
export interface SubclassFeature { id: string; name: string; level: number; description: string }
export interface SubclassData { id: string; name: string; classId: string; description: string; features?: SubclassFeature[]; source?: Source }
export interface FeatData {
  id: string; name: string; category: string; description: string; source?: Source;
  prerequisiteLevel?: number; abilities?: Ability[]; repeatable?: boolean;
}
export interface LanguageData { id: string; name: string; rare: boolean }
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

export interface WeaponData {
  id: string;
  name: string;
  category: 'simple' | 'martial';
  range: 'melee' | 'ranged';
  damage: string; // e.g. "1d8" or "1"
  damageType: string;
  versatileDamage?: string;
  normalRange?: number;
  longRange?: number;
  properties: string[];
  mastery?: string;
  weight: number;
}

export interface ArmorInfo { category: 'light' | 'medium' | 'heavy' | 'shield'; ac: number }
export type ItemKind = 'weapon' | 'gear' | 'consumable';
export interface Item {
  id: string;
  name: string;
  qty: number;
  weight: number; // lb per item
  notes: string;
  equipped: boolean;
  kind: ItemKind;
  weaponId?: string; // SRD weapon this item uses
  armor?: ArmorInfo; // body armour or shield; equipped armour sets AC
  effect?: string; // dice expression rolled on Use, e.g. "2d4+2"
}
export interface Currency { cp: number; sp: number; ep: number; gp: number; pp: number }

/** A known spell. `source` marks spells from a feat (cast with their own `ability`, one free cast per long rest). */
export interface CharacterSpell { id: string; prepared: boolean; source?: 'feat' | 'lineage'; ability?: Ability }

export interface RollLogEntry {
  id: string;
  label: string;
  expression: string;
  total: number;
  detail: string;
  time: number;
  crit?: 'hit' | 'miss';
}

export type NoteTag = 'Session' | 'NPC' | 'Quest' | 'Loot';
export interface Note {
  id: string;
  tag: NoteTag;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: number;
}

export type EconomySlot = 'action' | 'bonus' | 'reaction';
export interface CombatState {
  round: number;
  initiative: number | null;
  eco: Record<EconomySlot, boolean>; // true = used
}

export type ScoreMethod = 'standard' | 'pointbuy' | 'manual';
export interface CreationInfo {
  method: ScoreMethod;
  base: AbilityScores;
  boosts: Partial<Record<Ability, number>>;
  hpAuto: boolean;
  acAuto?: boolean; // AC follows equipped armour
}

export interface TakenFeat { id: string; level: number; ability?: Ability; note?: string }
/** One level gained, with what it changed, so it can be undone. */
export interface LevelRecord {
  level: number; // the level reached
  hp: number; // max HP gained
  rolled?: number; // the hit die roll, if rolled
  before: Pick<Character, 'abilities' | 'subclassId' | 'skills' | 'expertise' | 'spells' | 'feats' | 'saveProficiencies' | 'speedOverride'>;
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
  xp: number;
  inspiration: boolean;
  notes: Note[];
  combat: CombatState;
  creation?: CreationInfo;
  lineageId?: string;
  size?: Size;
  subclassId?: string; // chosen path; the subclass itself starts at level 3
  originFeat?: string; // feat id, with an optional note such as "Wizard"
  originFeatNote?: string;
  languages?: string[];
  tools?: string[];
  originAbility?: Ability; // spellcasting ability for lineage spells
  extraFeat?: string; // Human Versatile origin feat
  extraFeatNote?: string;
  originPicks?: { keenSenses?: string; skillful?: string; skilled?: string[] };
  featureUses?: Record<string, number>; // uses spent, by feature id
  feats?: TakenFeat[]; // feats from level-ups (ASI, Fighting Style, Epic Boon)
  saveProficiencies?: Ability[]; // extra saves (Resilient)
  levelHistory?: LevelRecord[];
  createdAt: number;
  updatedAt: number;
}
