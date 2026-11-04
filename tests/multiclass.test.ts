import { describe, expect, it } from 'vitest';
import { multiclassSlots } from '../src/rules/slots';
import {
  classFeatures, classLabel, classLevelOf, classLevels, hitDicePools, multiclassBlocker, slotsOf, topSpellLevel, withClassLevel,
} from '../src/rules/classes';
import { applyLevelUp, levelUpPlan, undoLastLevel } from '../src/rules/progression';
import { featuresOf } from '../src/rules/origin';
import { derive } from '../src/rules/derived';
import { migrateCharacter } from '../src/store/characters';
import { makeCharacter } from './helpers';

const slots = (classes: [string, number][]) =>
  multiclassSlots(classes.map(([casterType, level]) => ({ casterType: casterType as 'full' | 'half' | 'pact' | 'none', level })));

describe('multiclass spell slots (2024)', () => {
  it('keeps Pact Magic separate', () => {
    const r = slots([['half', 3], ['pact', 3]]);
    expect(r.slots.slice(0, 2)).toEqual([3, 0]); // a single Paladin 3 uses its own table
    expect(r.pact).toEqual({ count: 2, level: 2 });
  });
  it('adds full caster levels', () => expect(slots([['full', 3], ['full', 2]]).slots.slice(0, 4)).toEqual([4, 3, 2, 0]));
  it('rounds half caster levels up', () => expect(slots([['half', 3], ['half', 3]]).slots.slice(0, 3)).toEqual([4, 3, 0]));
  it('single half caster uses its own table', () => expect(slots([['half', 5]]).slots.slice(0, 3)).toEqual([4, 2, 0]));
  it('non-casters add nothing', () => {
    const r = slots([['none', 5], ['full', 1]]);
    expect(r.slots[0]).toBe(2);
    expect(r.pact).toBeNull();
  });
});

// Paladin 3 / Warlock 3 (Oath of the Ancients is not in the SRD; Devotion is).
const pw = makeCharacter({
  classId: 'paladin', level: 6, subclassId: 'oath-of-devotion', multiclass: [{ id: 'warlock', level: 3 }],
  abilities: { str: 14, dex: 10, con: 18, int: 10, wis: 7, cha: 14 },
});

describe('class levels', () => {
  it('starting class has the levels not taken elsewhere', () => {
    expect(classLevels(pw)).toEqual([{ id: 'paladin', level: 3, subclassId: 'oath-of-devotion' }, { id: 'warlock', level: 3 }]);
    expect(classLevelOf(pw, 'warlock')).toBe(3);
    expect(classLevelOf(pw, 'wizard')).toBe(0);
    expect(classLabel(pw)).toBe('Paladin 3 / Warlock 3');
    expect(classLabel(makeCharacter())).toBe('Wizard');
  });
  it('hit dice pools by die size', () => {
    expect(hitDicePools({ ...pw, hitDiceUsed: { 8: 1 } })).toEqual([
      { die: 10, total: 3, used: 0 },
      { die: 8, total: 3, used: 1 },
    ]);
  });
  it('slots and top spell level', () => {
    expect(slotsOf(pw).slots.slice(0, 2)).toEqual([3, 0]);
    expect(slotsOf(pw).pact).toEqual({ count: 2, level: 2 });
    expect(topSpellLevel(pw)).toBe(2);
  });
  it('class features per class level, with uses from that class level', () => {
    const f = classFeatures(pw);
    const loh = f.find((x) => x.id === 'class-lay-on-hands')!;
    expect(loh.uses?.max).toBe(15); // 5 × Paladin level 3, not character level 6
    expect(f.some((x) => x.id === 'class-warlock-pact-magic')).toBe(true);
    expect(f.some((x) => x.id === 'class-extra-attack')).toBe(false); // Paladin 5
  });
  it('derive: total level PB, first-class saves, castings per class', () => {
    const d = derive(pw);
    expect(d.pb).toBe(3);
    expect(d.saveBonus('wis')).toBe(-2 + 3);
    expect(d.saveBonus('int')).toBe(0);
    expect(d.attacks).toBe(1);
    expect(d.castings.map((x) => x.classId)).toEqual(['paladin', 'warlock']);
    expect(d.castingAbilities.map((x) => x.ability)).toEqual(['cha']);
    expect(d.classCasting({ id: 'x', prepared: true, classId: 'warlock' }).classId).toBe('warlock');
  });
  it('subclass features follow the class level', () => {
    const f = featuresOf(pw).filter((x) => x.source === 'Path').map((x) => x.name);
    expect(f.length).toBeGreaterThan(0);
    expect(featuresOf({ ...pw, level: 4, multiclass: [{ id: 'warlock', level: 2 }] }).filter((x) => x.source === 'Path')).toHaveLength(0);
  });
});

describe('multiclass prerequisites', () => {
  it('needs 13 in the primary abilities of both classes', () => {
    expect(multiclassBlocker(pw, 'warlock')).toBeNull(); // already has it
    expect(multiclassBlocker(pw, 'wizard')).toMatch(/Wizard needs INT 13/);
    const strong = makeCharacter({ classId: 'fighter', level: 3, abilities: { str: 8, dex: 14, con: 14, int: 13, wis: 10, cha: 10 } });
    expect(multiclassBlocker(strong, 'wizard')).toBeNull(); // Fighter: STR or DEX
    expect(multiclassBlocker(makeCharacter({ classId: 'wizard', abilities: { str: 8, dex: 14, con: 14, int: 12, wis: 13, cha: 10 } }), 'cleric')).toMatch(/Wizard needs INT 13/);
  });
});

describe('levelling in another class', () => {
  const paladin = makeCharacter({ classId: 'paladin', level: 3, subclassId: 'oath-of-devotion', abilities: pw.abilities, hp: { max: 40, current: 40, temp: 0 } });
  it('plans a first level in a new class', () => {
    const p = levelUpPlan(paladin, undefined, 'warlock');
    expect(p).toMatchObject({ level: 4, classId: 'warlock', classLevel: 1, newClass: true, hitDie: 8, subclass: false, asi: false });
    expect(p.pact).toEqual([null, { count: 1, level: 1 }]);
    expect(p.newCantrips).toBe(2);
    expect(p.classFeatures.map((f) => f.id)).toContain('pact-magic');
  });
  it('class levels drive subclass and ASI timing', () => {
    expect(levelUpPlan(pw, undefined, 'warlock').asi).toBe(true); // Warlock 4
    expect(levelUpPlan({ ...pw, level: 5, multiclass: [{ id: 'warlock', level: 2 }] }, undefined, 'warlock').subclass).toBe(true);
    expect(levelUpPlan(pw).classLevel).toBe(4); // Paladin 4
  });
  it('applies and undoes a multiclass level', () => {
    const next = applyLevelUp(paladin, { hp: { mode: 'average' }, classId: 'warlock', cantrips: ['eldritch-blast'] });
    expect(next.level).toBe(4);
    expect(next.multiclass).toEqual([{ id: 'warlock', level: 1 }]);
    expect(classLevelOf(next, 'paladin')).toBe(3);
    expect(next.hp.max).toBe(40 + 5 + 4);
    expect(next.spells).toEqual([{ id: 'eldritch-blast', prepared: true, classId: 'warlock' }]);
    expect(next.levelHistory?.at(-1)?.classId).toBe('warlock');
    const back = undoLastLevel(next);
    expect(back.level).toBe(3);
    expect(back.multiclass).toBeUndefined();
    expect(back.hp.max).toBe(40);
  });
  it('withClassLevel keeps the starting class in place', () => {
    expect(withClassLevel(pw, 'paladin').multiclass).toEqual(pw.multiclass);
    expect(withClassLevel(pw, 'warlock', 'fiend-patron').multiclass).toEqual([{ id: 'warlock', level: 4, subclassId: 'fiend-patron' }]);
  });
});

describe('migration to version 6', () => {
  it('moves hit dice and warlock pact slots', () => {
    const v5 = { ...makeCharacter({ classId: 'warlock', level: 5 }), hitDiceUsed: 2, spellSlotsUsed: [0, 0, 1, 0, 0, 0, 0, 0, 0], pactSlotsUsed: undefined } as unknown;
    const c = migrateCharacter(v5);
    expect(c.hitDiceUsed).toEqual({ 8: 2 });
    expect(c.pactSlotsUsed).toBe(1);
    expect(c.spellSlotsUsed.every((n) => n === 0)).toBe(true);
    expect(c.customSpells).toEqual([]);
  });
  it('leaves current characters alone', () => {
    const c = makeCharacter({ hitDiceUsed: { 6: 1 }, pactSlotsUsed: 0, customSpells: [] });
    expect(migrateCharacter(c).hitDiceUsed).toEqual({ 6: 1 });
  });
});
