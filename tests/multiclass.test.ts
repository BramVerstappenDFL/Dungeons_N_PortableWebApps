import { describe, expect, it } from 'vitest';
import { multiclassSlots } from '../src/rules/slots';
import { classLabel, hitDicePools, migrateCharacter, multiclassMaxHp, totalLevel } from '../src/rules/classes';
import { derive } from '../src/rules/derived';
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

describe('class helpers', () => {
  const pw = makeCharacter({ classes: [{ id: 'paladin', level: 3 }, { id: 'warlock', level: 3 }], abilities: { str: 14, dex: 10, con: 18, int: 10, wis: 7, cha: 14 } });
  it('total level and label', () => {
    expect(totalLevel(pw)).toBe(6);
    expect(classLabel(pw)).toBe('Paladin 3 / Warlock 3');
    expect(classLabel(makeCharacter())).toBe('Wizard');
  });
  it('hit dice pools by die size', () => {
    expect(hitDicePools({ ...pw, hitDiceUsed: { 8: 1 } })).toEqual([
      { die: 10, total: 3, used: 0 },
      { die: 8, total: 3, used: 1 },
    ]);
  });
  it('default HP uses the first class die at level 1', () => {
    // 10 + 6 + 6 (Paladin) + 5 + 5 + 5 (Warlock) + 6 × 4 CON
    expect(multiclassMaxHp(pw.classes, 18)).toBe(61);
  });
  it('derive: total level PB, first-class saves, slots and pact', () => {
    const d = derive(pw);
    expect(d.pb).toBe(3);
    expect(d.saveBonus('wis')).toBe(-2 + 3);
    expect(d.saveBonus('int')).toBe(0); // Warlock saves are not gained by multiclassing
    expect(d.pact).toEqual({ count: 2, level: 2 });
    expect(d.castingAbilities.map((x) => x.ability)).toEqual(['cha']);
    expect(d.castingFor({ id: 'x', prepared: true, classId: 'warlock' }).classId).toBe('warlock');
  });
});

describe('migrateCharacter', () => {
  it('upgrades version 1 single-class characters', () => {
    const { classes, customSpells, pactSlotsUsed, ...rest } = makeCharacter();
    void classes; void customSpells; void pactSlotsUsed;
    const v1 = { ...rest, classId: 'warlock', level: 5, hitDiceUsed: 2, spellSlotsUsed: [0, 0, 1, 0, 0, 0, 0, 0, 0] };
    const c = migrateCharacter(v1);
    expect(c.classes).toEqual([{ id: 'warlock', level: 5 }]);
    expect(c.hitDiceUsed).toEqual({ 8: 2 });
    expect(c.pactSlotsUsed).toBe(1);
    expect(c.spellSlotsUsed.every((n) => n === 0)).toBe(true);
    expect(c.customSpells).toEqual([]);
    expect('classId' in c).toBe(false);
  });
  it('leaves current characters alone', () => {
    const c = makeCharacter({ hitDiceUsed: { 6: 1 }, pactSlotsUsed: 0 });
    expect(migrateCharacter(c)).toEqual(c);
  });
});
