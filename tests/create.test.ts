import { describe, expect, it } from 'vitest';
import { applyBoosts, boostsValid, buildCharacter } from '../src/rules/create';
import { migrateCharacter } from '../src/store/characters';

const base = { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 8 };

describe('character creation', () => {
  it('validates background increases', () => {
    expect(boostsValid({ int: 2, wis: 1 }, ['con', 'int', 'wis'])).toBe(true);
    expect(boostsValid({ con: 1, int: 1, wis: 1 }, ['con', 'int', 'wis'])).toBe(true);
    expect(boostsValid({ int: 3 }, ['con', 'int', 'wis'])).toBe(false);
    expect(boostsValid({ int: 2, str: 1 }, ['con', 'int', 'wis'])).toBe(false);
    expect(boostsValid({ int: 2 }, ['con', 'int', 'wis'])).toBe(false);
  });
  it('caps boosted scores at 20', () => {
    expect(applyBoosts({ ...base, int: 19 }, { int: 2 }).int).toBe(20);
  });
  it('builds a level-1 character', () => {
    const c = buildCharacter({
      id: 'x', name: '  Mirelle ', speciesId: 'elf', backgroundId: 'sage', classId: 'wizard', base,
      boosts: { int: 2, con: 1 }, classSkills: ['arcana', 'history'], backgroundSkills: ['arcana', 'history'], now: 1,
    });
    expect(c.name).toBe('Mirelle');
    expect(c.abilities.int).toBe(17);
    expect(c.abilities.con).toBe(14);
    expect(c.hp.max).toBe(8); // d6 + 2
    expect(c.armorClass).toBe(12);
    expect(c.skills).toEqual(['arcana', 'history']);
    expect(c.xp).toBe(0);
    expect(c.notes).toEqual([]);
  });
});

describe('migrateCharacter', () => {
  it('upgrades version-1 characters', () => {
    const old = {
      id: 'a', name: 'Old', level: 3, notes: 'Owes 5 gp to Bran', updatedAt: 5,
      inventory: [{ id: 'i', name: 'Rope', qty: 1, weight: 10, notes: '', equipped: false }],
      abilities: base, hp: { max: 10, current: 10, temp: 0 },
    };
    const c = migrateCharacter(old);
    expect(c.xp).toBe(900);
    expect(c.notes).toHaveLength(1);
    expect(c.notes[0].body).toBe('Owes 5 gp to Bran');
    expect(c.inventory[0].kind).toBe('gear');
    expect(c.combat.round).toBe(1);
    expect(c.inspiration).toBe(false);
  });
  it('drops empty string notes', () => {
    expect(migrateCharacter({ id: 'a', level: 1, notes: '  ' }).notes).toEqual([]);
  });
});
