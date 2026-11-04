import { describe, expect, it } from 'vitest';
import {
  applyAsi, applyLevelUp, asiComplete, choicesComplete, levelUpPlan, pendingLevels, undoLastLevel,
} from '../src/rules/progression';
import { cantripsKnown, classFeatures, preparedSpells, rages } from '../src/rules/classes';
import { featuresOf, restoreFeatures, spendFeature, armorClassOf } from '../src/rules/origin';
import { derive } from '../src/rules/derived';
import { FEATS } from '../src/data';
import { migrateCharacter } from '../src/store/characters';
import { makeCharacter } from './helpers';

const fighter = (over = {}) => makeCharacter({
  classId: 'fighter', level: 1, xp: 0, speciesId: 'human',
  abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 }, hp: { max: 12, current: 12, temp: 0 }, ...over,
});
const avg = { hp: { mode: 'average' as const } };

describe('level-up plan', () => {
  it('lists what level 2 brings a fighter', () => {
    const p = levelUpPlan(fighter());
    expect(p.level).toBe(2);
    expect(p.hpAverage).toBe(6);
    expect(p.classFeatures.map((f) => f.name)).toEqual(['Action Surge', 'Tactical Mind']);
    expect(p.fightingStyle).toBe(true); // creation never asked
    expect(p.asi).toBe(false);
  });
  it('asks for a subclass at 3 and an ASI on class ASI levels', () => {
    expect(levelUpPlan(fighter({ level: 2 })).subclass).toBe(true);
    expect(levelUpPlan(fighter({ level: 3 })).asi).toBe(true);
    expect(levelUpPlan(fighter({ level: 5 })).asi).toBe(true); // Fighter: 6
    expect(levelUpPlan(makeCharacter({ classId: 'wizard', level: 5 })).asi).toBe(false);
    expect(levelUpPlan(makeCharacter({ classId: 'rogue', level: 9 })).asi).toBe(true); // Rogue: 10
    expect(levelUpPlan(fighter({ level: 18 })).epicBoon).toBe(true);
  });
  it('shows path features and resource changes', () => {
    const p = levelUpPlan(fighter({ level: 2 }), 'champion');
    expect(p.pathFeatures.map((f) => f.name)).toEqual(['Improved Critical', 'Remarkable Athlete']);
    const b = levelUpPlan(makeCharacter({ classId: 'barbarian', level: 2 }));
    expect(b.resources).toEqual([{ name: 'Rage', from: 2, to: 3 }]);
  });
  it('counts spells', () => {
    expect(cantripsKnown('wizard', 3)).toBe(3);
    expect(cantripsKnown('wizard', 4)).toBe(4);
    expect(preparedSpells('wizard', 5)).toBe(9);
    expect(preparedSpells('paladin', 1)).toBe(2);
    expect(levelUpPlan(makeCharacter({ classId: 'wizard', level: 3 })).newCantrips).toBe(1);
  });
});

describe('applying a level', () => {
  it('adds average or rolled HP with CON and origin bonuses', () => {
    expect(applyLevelUp(fighter(), avg).hp.max).toBe(12 + 6 + 2 + 0);
    expect(applyLevelUp(fighter(), { hp: { mode: 'roll', roll: 1 } }).hp.max).toBe(12 + 3);
    expect(applyLevelUp(fighter({ speciesId: 'dwarf' }), avg).hp.max).toBe(12 + 8 + 1);
    const weak = fighter({ abilities: { str: 16, dex: 12, con: 3, int: 8, wis: 10, cha: 10 } });
    expect(applyLevelUp(weak, { hp: { mode: 'roll', roll: 1 } }).hp.max).toBe(13); // at least 1
  });
  it('applies ASIs within the cap, and CON gains count for earlier levels', () => {
    const c = fighter({ level: 3, abilities: { str: 19, dex: 12, con: 13, int: 8, wis: 10, cha: 10 }, hp: { max: 28, current: 28, temp: 0 } });
    const up = applyLevelUp(c, { ...avg, asi: { kind: 'plus1', abilities: ['str', 'con'] } });
    expect(up.abilities.str).toBe(20);
    expect(up.abilities.con).toBe(14);
    expect(up.hp.max).toBe(28 + 6 + 1 + 4); // +1 CON mod × 4 levels
    expect(applyAsi({ ...c.abilities, str: 20 }, { kind: 'plus2', ability: 'str' }).str).toBe(20);
    expect(applyAsi({ ...c.abilities, str: 20 }, { kind: 'feat', featId: 'boon-of-fate', ability: 'str' }).str).toBe(21);
  });
  it('takes feats with their effects', () => {
    const c = fighter({ level: 3 });
    const res = applyLevelUp(c, { ...avg, asi: { kind: 'feat', featId: 'resilient', ability: 'wis' } });
    expect(res.abilities.wis).toBe(11);
    expect(derive(res).saveBonus('wis')).toBe(0 + 2);
    const tough = applyLevelUp(c, { ...avg, asi: { kind: 'feat', featId: 'tough' } });
    expect(tough.hp.max).toBe(12 + 8 + 2 * 4); // Tough counts for every level
    const alert = applyLevelUp(c, { ...avg, asi: { kind: 'feat', featId: 'alert' } });
    expect(derive(alert).initiative).toBe(derive(c).initiative + 2);
    const speedy = applyLevelUp(c, { ...avg, asi: { kind: 'feat', featId: 'speedy', ability: 'dex' } });
    expect(derive(speedy).speed).toBe(40);
  });
  it('adds the fighting style, subclass and cantrips', () => {
    const two = applyLevelUp(fighter({ inventory: [{ id: 'm', name: 'Chain Mail', qty: 1, weight: 55, notes: '', kind: 'gear', equipped: true, armor: { category: 'heavy', ac: 16 } }],
      creation: { method: 'standard', base: fighter().abilities, boosts: {}, hpAuto: true, acAuto: true } }), { ...avg, fightingStyle: 'defense' });
    expect(armorClassOf(two)).toBe(17);
    expect(levelUpPlan(two).fightingStyle).toBe(false);
    const three = applyLevelUp(two, { ...avg, subclassId: 'champion' });
    expect(three.subclassId).toBe('champion');
    expect(featuresOf(three).some((f) => f.name === 'Improved Critical')).toBe(true);
    const wiz = applyLevelUp(makeCharacter({ classId: 'wizard', level: 3 }), { ...avg, asi: { kind: 'plus2', ability: 'int' }, cantrips: ['light'] });
    expect(wiz.spells.map((s) => s.id)).toContain('light');
  });
  it('checks that choices are complete', () => {
    const p = levelUpPlan(fighter({ level: 3 }));
    expect(choicesComplete(p, avg)).toBe(false);
    expect(choicesComplete(p, { ...avg, asi: { kind: 'plus2', ability: 'str' } })).toBe(false); // still owes a Fighting Style
    expect(choicesComplete(p, { ...avg, asi: { kind: 'plus2', ability: 'str' }, fightingStyle: 'archery' })).toBe(true);
    expect(asiComplete({ kind: 'plus1', abilities: ['str', 'str'] })).toBe(false);
    expect(asiComplete({ kind: 'feat', featId: 'resilient' })).toBe(false);
  });
  it('undoes the last level', () => {
    const c = fighter({ level: 3 });
    const up = applyLevelUp(c, { ...avg, asi: { kind: 'feat', featId: 'resilient', ability: 'wis' } });
    const back = undoLastLevel(up);
    expect(back.level).toBe(3);
    expect(back.abilities).toEqual(c.abilities);
    expect(back.hp.max).toBe(c.hp.max);
    expect(back.feats ?? []).toEqual(c.feats ?? []);
    expect(back.levelHistory).toEqual([]);
  });
  it('knows when XP has earned a level', () => {
    expect(pendingLevels(fighter({ xp: 300 }))).toBe(1);
    expect(pendingLevels(fighter({ xp: 2700 }))).toBe(3);
    expect(pendingLevels(fighter({ xp: 0, level: 3 }))).toBe(0);
  });
});

describe('class features in play', () => {
  it('scales class resources with level', () => {
    expect(rages(3)).toBe(3);
    const barb = makeCharacter({ classId: 'barbarian', level: 9 });
    expect(classFeatures(barb).find((f) => f.id === 'class-rage')).toMatchObject({ name: 'Rage (+3 damage)', uses: { max: 4, recharge: 'short-one' } });
    const rogue = makeCharacter({ classId: 'rogue', level: 5 });
    expect(classFeatures(rogue).find((f) => f.id === 'class-sneak-attack')?.name).toBe('Sneak Attack (3d6)');
    expect(derive(rogue).sneakAttack).toBe('3d6');
    expect(derive(makeCharacter({ classId: 'fighter', level: 11 })).attacks).toBe(3);
  });
  it('short rests give back one use of short-one features and all of short ones', () => {
    const f = fighter({ level: 2 });
    const wind = featuresOf(f).find((x) => x.id === 'class-second-wind')!;
    const surge = featuresOf(f).find((x) => x.id === 'class-action-surge')!;
    const used = spendFeature(spendFeature(spendFeature(f, wind), wind), surge);
    expect(restoreFeatures(used, 'short').featureUses).toEqual({ 'class-second-wind': 1 });
  });
  it('treats pools as counters', () => {
    const pal = makeCharacter({ classId: 'paladin', level: 3 });
    const loh = featuresOf(pal).find((x) => x.id === 'class-lay-on-hands')!;
    expect(loh).toMatchObject({ pool: true, uses: { max: 15 } });
  });
  it('lists PHB general feats without rules text', () => {
    const phb = FEATS.filter((f) => f.source === 'PHB 2024');
    expect(phb.length).toBeGreaterThan(40);
    for (const f of phb) expect(f.description).toBe('');
  });
  it('migrates level history onto old characters', () => {
    const c = migrateCharacter({ id: 'a', level: 2 });
    expect(c.levelHistory).toEqual([]);
    expect(c.feats).toEqual([]);
  });
});
