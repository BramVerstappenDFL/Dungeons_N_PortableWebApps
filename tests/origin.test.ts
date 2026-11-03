import { describe, expect, it } from 'vitest';
import {
  allSpells, applyResistance, armorClassFrom, armorClassOf, breathWeapon, castingFor, originOf, restoreFeatures, spendFeature, usesLeft,
} from '../src/rules/origin';
import { derive } from '../src/rules/derived';
import { applyXp } from '../src/rules/xp';
import { finishShortRest, longRest } from '../src/rules/rest';
import { buildCharacter } from '../src/rules/create';
import { classById } from '../src/data';
import { migrateCharacter } from '../src/store/characters';
import { makeCharacter } from './helpers';

const lvl1 = (over: Parameters<typeof makeCharacter>[0]) => makeCharacter({ level: 1, xp: 0, ...over });
const feature = (c: ReturnType<typeof makeCharacter>, id: string) => originOf(c).features.find((f) => f.id === id)!;

describe('originOf', () => {
  it('gives dwarves poison resistance, darkvision 120 and +1 HP per level', () => {
    const o = originOf(lvl1({ speciesId: 'dwarf' }));
    expect(o.resistances).toEqual(['poison']);
    expect(o.darkvision).toBe(120);
    expect(o.hpPerLevel).toBe(1);
  });
  it('takes darkvision and spells from the lineage', () => {
    const drow = originOf(lvl1({ speciesId: 'elf', lineageId: 'drow' }));
    expect(drow.darkvision).toBe(120);
    expect(drow.grantedSpells.map((s) => s.id)).toEqual(['dancing-lights']);
    const drow5 = originOf(makeCharacter({ speciesId: 'elf', lineageId: 'drow', level: 5 }));
    expect(drow5.grantedSpells.map((s) => s.id)).toEqual(['dancing-lights', 'faerie-fire', 'darkness']);
  });
  it('makes Wood Elves faster', () => {
    const c = lvl1({ speciesId: 'elf', lineageId: 'wood-elf' });
    expect(originOf(c).speed).toBe(35);
    expect(derive(c).speed).toBe(35);
  });
  it('gives Dragonborn resistance and breath of their ancestry', () => {
    const c = lvl1({ speciesId: 'dragonborn', lineageId: 'red-dragon', abilities: { str: 15, dex: 10, con: 14, int: 8, wis: 10, cha: 12 } });
    expect(originOf(c).resistances).toContain('fire');
    expect(breathWeapon(c)).toEqual({ damage: '1d10', dc: 12, type: 'fire' });
    expect(breathWeapon({ ...c, level: 11 }).damage).toBe('3d10');
    expect(feature(c, 'breath-weapon').uses).toEqual({ max: 2, recharge: 'long' });
  });
  it('unlocks level-gated traits', () => {
    expect(originOf(lvl1({ speciesId: 'goliath', lineageId: 'fire-giant' })).features.some((f) => f.id === 'large-form')).toBe(false);
    expect(originOf(makeCharacter({ speciesId: 'goliath', lineageId: 'fire-giant', level: 5 })).features.some((f) => f.id === 'large-form')).toBe(true);
  });
  it('applies origin feats', () => {
    const alert = lvl1({ originFeat: 'alert' });
    expect(derive(alert).initiative).toBe(derive(lvl1({})).initiative + 2);
    expect(originOf(lvl1({ originFeat: 'tough' })).hpPerLevel).toBe(2);
    expect(feature(lvl1({ speciesId: 'human', originFeat: 'skilled', extraFeat: 'lucky' }), 'lucky').uses).toEqual({ max: 2, recharge: 'long' });
  });
  it('collects picked skills and the background tool', () => {
    const o = originOf(lvl1({ backgroundId: 'sage', originPicks: { keenSenses: 'perception', skillful: 'stealth', skilled: ['arcana', 'athletics', 'insight'] } }));
    expect(o.skills).toEqual(['perception', 'stealth', 'arcana', 'athletics', 'insight']);
    expect(o.tools).toEqual(["Calligrapher's Supplies"]);
  });
  it('lists path features once the level reaches them', () => {
    expect(originOf(lvl1({ classId: 'fighter', subclassId: 'champion' })).features.some((f) => f.source === 'Path')).toBe(false);
    const names = originOf(makeCharacter({ classId: 'fighter', subclassId: 'champion', level: 7 })).features.filter((f) => f.source === 'Path').map((f) => f.name);
    expect(names).toEqual(['Improved Critical', 'Remarkable Athlete', 'Additional Fighting Style']);
  });
});

describe('feature uses and rests', () => {
  const orc = lvl1({ speciesId: 'orc' });
  it('spends and restores uses', () => {
    const rush = feature(orc, 'adrenaline-rush');
    const spent = spendFeature(spendFeature(spendFeature(orc, rush), rush), rush);
    expect(usesLeft(spent, rush)).toBe(0);
    expect(usesLeft(spendFeature(spent, rush, -1), rush)).toBe(1);
  });
  it('short rests restore short-rest features only', () => {
    const c = spendFeature(spendFeature(orc, feature(orc, 'adrenaline-rush')), feature(orc, 'relentless-endurance'));
    const s = finishShortRest(c, classById('wizard')!);
    expect(s.featureUses).toEqual({ 'relentless-endurance': 1 });
    expect(restoreFeatures(c, 'long').featureUses).toEqual({});
    expect(longRest(c).featureUses).toEqual({});
  });
  it('gives humans Heroic Inspiration after a long rest', () => {
    expect(longRest(lvl1({ speciesId: 'human' })).inspiration).toBe(true);
    expect(longRest(lvl1({ speciesId: 'elf' })).inspiration).toBe(false);
  });
});

describe('spells from origins', () => {
  it('merges granted spells, cast with their own ability', () => {
    const c = lvl1({ classId: 'fighter', speciesId: 'elf', lineageId: 'high-elf', originAbility: 'int', abilities: { str: 15, dex: 13, con: 14, int: 12, wis: 10, cha: 8 } });
    const list = allSpells(c);
    expect(list.map((s) => s.id)).toEqual(['prestidigitation']);
    expect(castingFor(c, list[0], 'wis')).toMatchObject({ ability: 'int', mod: 1, dc: 11, attack: 3 });
  });
});

describe('damage and armour', () => {
  it('halves resisted damage', () => {
    expect(applyResistance(9, 'Fire', ['fire'])).toBe(4);
    expect(applyResistance(9, 'Cold', ['fire'])).toBe(9);
  });
  it('works out AC from equipped armour while automatic', () => {
    const scores = { str: 15, dex: 14, con: 14, int: 8, wis: 12, cha: 10 };
    expect(armorClassFrom('fighter', scores, [{ armor: { category: 'heavy', ac: 16 } }, { armor: { category: 'shield', ac: 2 } }])).toBe(18);
    const mail = { id: 'm', name: 'Chain Mail', qty: 1, weight: 55, notes: '', kind: 'gear' as const, equipped: true, armor: { category: 'heavy' as const, ac: 16 } };
    const auto = lvl1({ classId: 'fighter', abilities: scores, inventory: [mail], armorClass: 3, creation: { method: 'standard', base: scores, boosts: {}, hpAuto: true, acAuto: true } });
    expect(armorClassOf(auto)).toBe(16);
    expect(armorClassOf({ ...auto, inventory: [{ ...mail, equipped: false }] })).toBe(12);
    expect(armorClassOf({ ...auto, creation: { ...auto.creation!, acAuto: false } })).toBe(3);
  });
});

describe('creation and level-up', () => {
  const base = { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 };
  it('builds dwarves and Tough characters with extra HP and picked skills', () => {
    const c = buildCharacter({
      id: 'd', name: 'Brom', speciesId: 'dwarf', backgroundId: 'soldier', classId: 'fighter', base, boosts: {},
      classSkills: [], backgroundSkills: ['athletics', 'intimidation'], now: 1, extraFeat: 'tough',
      originPicks: { skillful: 'perception' },
    });
    expect(c.hp.max).toBe(10 + 2 + 1 + 2);
    expect(c.skills).toContain('perception');
    expect(c.tools?.length).toBe(1);
    expect(c.creation?.acAuto).toBe(true);
  });
  it('adds per-level HP bonuses on level-up', () => {
    const c = makeCharacter({ level: 1, xp: 0, hp: { max: 10, current: 10, temp: 0 } });
    expect(applyXp(c, 300, 10, 1).character.hp.max).toBe(10 + 6 + 2 + 1);
  });
  it('migrates armour and feature uses onto old characters', () => {
    const c = migrateCharacter({ id: 'a', level: 2, inventory: [{ id: 'i', name: 'Chain Mail', qty: 1, weight: 55, notes: '', equipped: true }] });
    expect(c.inventory[0].armor).toEqual({ category: 'heavy', ac: 16 });
    expect(c.featureUses).toEqual({});
    expect(c.tools).toEqual([]);
  });
});
