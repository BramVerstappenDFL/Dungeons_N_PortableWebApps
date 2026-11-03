// What a character gets from its species, lineage, origin feats and path: the one place these effects live.
import type { Ability, AbilityScores, ArmorInfo, Character, CharacterSpell, EconomySlot, Mechanics, Size } from '../types';
import { backgroundById, featById, lineageById, speciesById, subclassById } from '../data';
import { abilityMod, proficiencyBonus } from './abilities';

import { classFeatures, type FeatureDef, type Recharge } from './classes';
export type { FeatureDef, Recharge } from './classes';

/** Limited uses and action costs, keyed by SRD/PHB trait or feat id. `pb` = Proficiency Bonus uses. */
const USES: Record<string, { max: 'pb' | number; recharge: Recharge; minLevel?: number; slot?: EconomySlot }> = {
  'breath-weapon': { max: 'pb', recharge: 'long', slot: 'action' },
  'giant-ancestry': { max: 'pb', recharge: 'long' },
  'large-form': { max: 1, recharge: 'long', minLevel: 5, slot: 'bonus' },
  'draconic-flight': { max: 1, recharge: 'long', minLevel: 5, slot: 'bonus' },
  'relentless-endurance': { max: 1, recharge: 'long' },
  'adrenaline-rush': { max: 'pb', recharge: 'short', slot: 'bonus' },
  stonecunning: { max: 'pb', recharge: 'long', slot: 'bonus' },
  'healing-hands': { max: 1, recharge: 'long', slot: 'action' },
  'celestial-revelation': { max: 1, recharge: 'long', minLevel: 3, slot: 'bonus' },
  lucky: { max: 'pb', recharge: 'long' },
};
/** Traits that only matter from a given level. */
const MIN_LEVEL: Record<string, number> = { 'large-form': 5, 'draconic-flight': 5, 'celestial-revelation': 3 };

/** Origin feats with a direct number effect. */
const FEAT_HP_PER_LEVEL: Record<string, number> = { tough: 2 };

/** Ability used for granted spells: the stored choice, else the best of INT, WIS and CHA. */
export function originAbilityOf(scores: AbilityScores, chosen?: Ability): Ability {
  if (chosen) return chosen;
  return (['int', 'wis', 'cha'] as Ability[]).reduce((best, a) => (scores[a] > scores[best] ? a : best), 'int');
}

export interface Origin {
  size: Size;
  speed: number;
  darkvision: number;
  resistances: string[];
  hpPerLevel: number;
  initiativeBonus: number;
  skills: string[];
  tools: string[];
  feats: { id: string; name: string; note?: string }[];
  features: FeatureDef[];
  /** Lineage and trait spells known at this level; always prepared. */
  grantedSpells: CharacterSpell[];
  /** Damage type of a Dragonborn's breath and resistance. */
  ancestryType?: string;
}

export function originOf(c: Character): Origin {
  const species = speciesById(c.speciesId);
  const lineage = lineageById(c.lineageId);
  const pb = proficiencyBonus(c.level);
  const traits = (species?.traits ?? []).filter((t) => (MIN_LEVEL[t.id] ?? 1) <= c.level);
  const sources: Mechanics[] = [...traits, ...(lineage ? [lineage] : [])];

  const resistances = new Set<string>();
  let darkvision = 0, hpPerLevel = 0;
  for (const m of sources) {
    m.resistances?.forEach((r) => resistances.add(r));
    darkvision = Math.max(darkvision, m.darkvision ?? 0);
    hpPerLevel += m.hpPerLevel ?? 0;
  }
  if (lineage?.damageType) resistances.add(lineage.damageType); // Dragonborn Damage Resistance

  const featIds = [c.originFeat, c.extraFeat, ...(c.feats ?? []).map((f) => f.id)].filter((f): f is string => !!f);
  const notes = [c.originFeatNote, c.extraFeatNote, ...(c.feats ?? []).map((f) => f.note)];
  const feats = featIds.map((id, i) => ({ id, name: featById(id)?.name ?? id, note: notes[i] }));
  for (const f of featIds) hpPerLevel += FEAT_HP_PER_LEVEL[f] ?? 0;

  const features: FeatureDef[] = [];
  const use = (id: string) => {
    const u = USES[id];
    return u && (u.minLevel ?? 1) <= c.level ? { uses: { max: u.max === 'pb' ? pb : u.max, recharge: u.recharge }, slot: u.slot } : {};
  };
  for (const t of traits) features.push({ id: t.id, name: t.name, source: 'Species', text: t.description, ...use(t.id) });
  if (lineage) features.push({ id: `lineage-${lineage.id}`, name: lineage.name, source: 'Lineage', text: lineage.description });
  feats.forEach((f, i) => features.push({
    id: featIds.indexOf(f.id) === i ? f.id : `${f.id}-${i}`, name: f.note ? `${f.name} (${f.note})` : f.name, source: 'Feat',
    text: (featById(f.id)?.description ?? '').replace(/^Origin Feat\s*/, ''), ...use(f.id),
  }));
  const sub = subclassById(c.subclassId);
  for (const pf of sub?.features ?? []) {
    if (pf.level <= c.level) features.push({ id: `path-${pf.id}`, name: pf.name, source: 'Path', text: pf.description });
  }

  const ability = originAbilityOf(c.abilities, c.originAbility);
  const grantedSpells: CharacterSpell[] = [];
  for (const m of sources) for (const s of m.spells ?? []) {
    if (s.minLevel <= c.level && !grantedSpells.some((g) => g.id === s.id)) grantedSpells.push({ id: s.id, prepared: true, source: 'lineage', ability });
  }

  const picks = c.originPicks ?? {};
  const bg = backgroundById(c.backgroundId);
  return {
    size: c.size ?? ((species?.size as Size) || 'medium'),
    speed: (species?.speed ?? 30) + (lineage?.speedBonus ?? 0) + (featIds.includes('speedy') ? 10 : 0),
    darkvision,
    resistances: [...resistances],
    hpPerLevel,
    initiativeBonus: featIds.includes('alert') ? pb : 0,
    skills: [picks.keenSenses, picks.skillful, ...(picks.skilled ?? [])].filter((s): s is string => !!s),
    tools: [...new Set([...(bg?.tool ? [bg.tool] : []), ...(c.tools ?? [])])],
    feats,
    features,
    grantedSpells,
    ancestryType: lineage?.damageType,
  };
}

/** Uses left of a limited feature. */
export const usesLeft = (c: Character, f: FeatureDef) => Math.max(0, (f.uses?.max ?? 0) - (c.featureUses?.[f.id] ?? 0));

/** Every feature the character has: species, lineage, feats, path and class. */
export const featuresOf = (c: Character): FeatureDef[] => [...classFeatures(c), ...originOf(c).features];

/** Spends (delta 1) or restores (delta -1) one use, within 0..max. */
export function spendFeature(c: Character, f: FeatureDef, delta = 1): Character {
  // delta can be more than 1 for pools (Lay on Hands, Focus, Sorcery Points).
  if (!f.uses) return c;
  const used = Math.max(0, Math.min(f.uses.max, (c.featureUses?.[f.id] ?? 0) + delta));
  return { ...c, featureUses: { ...c.featureUses, [f.id]: used } };
}

/** Feature uses that come back on a rest. A long rest restores everything, a short rest only short-rest features. */
export function restoreFeatures(c: Character, rest: Recharge): Character {
  if (!c.featureUses) return c;
  if (rest === 'long') return { ...c, featureUses: {} };
  // Short rest: `short` features come back in full, `short-one` features regain one use.
  const byId = new Map(featuresOf(c).map((f) => [f.id, f]));
  const uses: Record<string, number> = {};
  for (const [id, used] of Object.entries(c.featureUses)) {
    const r = byId.get(id)?.uses?.recharge;
    const left = r === 'short' ? 0 : r === 'short-one' ? used - 1 : used;
    if (left > 0) uses[id] = left;
  }
  return { ...c, featureUses: uses };
}

/** Breath Weapon: 1d10 rising at levels 5, 11 and 17; Dex save DC 8 + CON + PB. */
export function breathWeapon(c: Character) {
  const dice = c.level >= 17 ? 4 : c.level >= 11 ? 3 : c.level >= 5 ? 2 : 1;
  return { damage: `${dice}d10`, dc: 8 + abilityMod(c.abilities.con) + proficiencyBonus(c.level), type: originOf(c).ancestryType ?? '' };
}

/** All spells a character can cast: learned spells plus spells granted by lineage and traits. */
export function allSpells(c: Character): CharacterSpell[] {
  const granted = originOf(c).grantedSpells.filter((g) => !c.spells.some((s) => s.id === g.id));
  return [...c.spells, ...granted];
}

/** Key for the once-per-long-rest free cast of a feat or lineage spell. */
export const freeCastKey = (spellId: string) => `free-${spellId}`;
export const hasFreeCast = (c: Character, cs: CharacterSpell) => !!cs.source && !(c.featureUses?.[freeCastKey(cs.id)]);

/** Spellcasting numbers for one spell: feat and lineage spells use their own ability. */
export function castingFor(c: Character, cs: CharacterSpell | undefined, classAbility: Ability) {
  const ability = cs?.ability ?? classAbility;
  const mod = abilityMod(c.abilities[ability]);
  const pb = proficiencyBonus(c.level);
  return { ability, mod, dc: 8 + pb + mod, attack: pb + mod };
}

/** Halves damage of a type the character resists (rounded down). */
export function applyResistance(amount: number, type: string, resistances: string[]): number {
  return resistances.includes(type.toLowerCase()) ? Math.floor(amount / 2) : amount;
}

/** AC from equipped armour: best body armour (light + DEX, medium + DEX up to 2, heavy flat), else Unarmored Defense or 10 + DEX; a shield adds its bonus. */
export function armorClassFrom(classId: string, scores: AbilityScores, worn: { armor?: ArmorInfo }[]): number {
  const dex = abilityMod(scores.dex);
  const body = worn.filter((i) => i.armor && i.armor.category !== 'shield').map((i) => {
    const a = i.armor!;
    return a.category === 'heavy' ? a.ac : a.category === 'medium' ? a.ac + Math.min(2, dex) : a.ac + dex;
  });
  const shieldItem = worn.find((i) => i.armor?.category === 'shield');
  const shield = classId !== 'monk' && shieldItem ? shieldItem.armor!.ac : 0;
  if (body.length) return Math.max(...body) + shield;
  if (classId === 'barbarian') return 10 + dex + abilityMod(scores.con) + shield;
  if (classId === 'monk') return 10 + dex + abilityMod(scores.wis);
  return 10 + dex + shield;
}

/** The character's AC: worked out from equipped armour while automatic, else the number set by hand. */
export function armorClassOf(c: Character): number {
  if (!c.creation?.acAuto) return c.armorClass;
  const worn = c.inventory.filter((i) => i.equipped);
  // Defense fighting style: +1 AC while wearing body armour.
  const defense = c.feats?.some((f) => f.id === 'defense') && worn.some((i) => i.armor && i.armor.category !== 'shield') ? 1 : 0;
  return armorClassFrom(c.classId, c.abilities, worn) + defense;
}
