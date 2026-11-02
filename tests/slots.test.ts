import { describe, expect, it } from 'vitest';
import { maxSlots, maxSpellLevel, pactSlotLevel } from '../src/rules/slots';
import { spellRolls } from '../src/rules/spells';
import { abilityMod, defaultMaxHp, proficiencyBonus } from '../src/rules/abilities';
import type { Spell } from '../src/types';

describe('slots', () => {
  it('full caster tables', () => {
    expect(maxSlots('full', 1).slice(0, 2)).toEqual([2, 0]);
    expect(maxSlots('full', 5).slice(0, 4)).toEqual([4, 3, 2, 0]);
    expect(maxSlots('full', 20)).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
  });
  it('half casters get slots at level 1 (2024)', () => {
    expect(maxSlots('half', 1)[0]).toBe(2);
    expect(maxSpellLevel('half', 9)).toBe(3);
  });
  it('warlock pact magic', () => {
    expect(maxSlots('pact', 5)).toEqual([0, 0, 2, 0, 0, 0, 0, 0, 0]);
    expect(pactSlotLevel(11)).toBe(5);
  });
  it('non-casters have none', () => {
    expect(maxSpellLevel('none', 20)).toBe(0);
  });
});

describe('spell rolls', () => {
  const fireball = { name: 'Fireball', level: 3, damage: '8d6', damageType: 'fire', upcastDice: 1 } as Spell;
  const fireBolt = { name: 'Fire Bolt', level: 0, damage: '1d10', damageType: 'fire', cantripScaling: true } as Spell;
  const cure = { name: 'Cure Wounds', level: 1, heal: '2d8', healAddsMod: true, upcastHealDice: 2 } as Spell;
  it('upcasts damage', () => expect(spellRolls(fireball, 4, 7, 3)[0].expression).toBe('9d6'));
  it('scales cantrips', () => expect(spellRolls(fireBolt, 0, 11, 3)[0].expression).toBe('3d10'));
  it('heals with modifier', () => expect(spellRolls(cure, 2, 3, 3)[0].expression).toBe('4d8+3'));
});

describe('abilities', () => {
  it('modifiers and proficiency', () => {
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(15)).toBe(2);
    expect(proficiencyBonus(1)).toBe(2);
    expect(proficiencyBonus(5)).toBe(3);
    expect(proficiencyBonus(17)).toBe(6);
  });
  it('default max HP', () => {
    expect(defaultMaxHp(6, 1, 14)).toBe(8);
    expect(defaultMaxHp(6, 5, 14)).toBe(8 + 4 * 6);
  });
});
