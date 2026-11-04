import { describe, expect, it } from 'vitest';
import {
  applyBoosts, boostsValid, buildCharacter, defaultBoosts, isStandardArray, keyAbility, kitGold, kitItems,
  languagesValid, startingArmorClass, suggestedScores, swapScores,
} from '../src/rules/create';
import { BACKGROUNDS, CLASSES, SPECIES, SUBCLASSES, backgroundById, classById, lineagesFor, subclassesFor } from '../src/data';
import type { KitItem, StartingKit } from '../src/types';
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

describe('creation helpers', () => {
  it('suggests a standard array led by the key ability', () => {
    const s = suggestedScores('int');
    expect(s.int).toBe(15);
    expect(s.con).toBe(14);
    expect(s.dex).toBe(13);
    expect(isStandardArray(s)).toBe(true);
    expect(isStandardArray({ ...s, int: 14 })).toBe(false);
  });
  it('swaps two scores', () => {
    const s = swapScores(suggestedScores('str'), 'str', 'cha');
    expect(s.cha).toBe(15);
    expect(isStandardArray(s)).toBe(true);
  });
  it('reads the key ability from the class data', () => {
    expect(keyAbility('wizard')).toBe('int');
    expect(keyAbility('paladin')).toBe('str');
    expect(keyAbility('unknown')).toBe('str');
  });
  it('puts +2 on the key ability when the background allows it', () => {
    expect(defaultBoosts(['con', 'int', 'wis'], 'int', base)).toEqual({ int: 2, con: 1 });
    expect(defaultBoosts(['str', 'dex', 'con'], 'int', base)).toEqual({ dex: 2, con: 1 });
  });
  it('needs exactly two languages besides Common', () => {
    expect(languagesValid(['elvish', 'draconic'])).toBe(true);
    expect(languagesValid(['elvish'])).toBe(false);
    expect(languagesValid(['elvish', 'elvish'])).toBe(false);
    expect(languagesValid(['common', 'elvish'])).toBe(false);
  });
  it('turns kits into equipped weapons, gear and gold', () => {
    const kit: StartingKit = { id: 'a', gp: 5, items: [
      { name: 'Dagger', qty: 2, weight: 1, weaponId: 'dagger' }, { name: 'Robe', qty: 1, weight: 4 },
    ] };
    let n = 0;
    const items = kitItems([kit, { id: 'a', gp: 3, items: [{ name: 'Dagger', qty: 1, weight: 1, weaponId: 'dagger' }] }], () => `i${n++}`);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ name: 'Dagger', qty: 3, kind: 'weapon', weaponId: 'dagger', equipped: true });
    expect(items[1]).toMatchObject({ name: 'Robe', kind: 'gear', equipped: false });
    expect(kitGold([kit, undefined, { id: 'b', items: [], gp: 50 }])).toBe(55);
  });
  it('works out starting armour class', () => {
    const scores = { str: 15, dex: 14, con: 14, int: 8, wis: 12, cha: 10 };
    const chain: KitItem = { name: 'Chain Mail', qty: 1, weight: 55, armor: { category: 'heavy', ac: 16 } };
    const shirt: KitItem = { name: 'Chain Shirt', qty: 1, weight: 20, armor: { category: 'medium', ac: 13 } };
    const leather: KitItem = { name: 'Leather', qty: 1, weight: 10, armor: { category: 'light', ac: 11 } };
    const shield: KitItem = { name: 'Shield', qty: 1, weight: 6, armor: { category: 'shield', ac: 2 } };
    expect(startingArmorClass('fighter', scores, [chain])).toBe(16);
    expect(startingArmorClass('cleric', { ...scores, dex: 18 }, [shirt, shield])).toBe(17);
    expect(startingArmorClass('rogue', scores, [leather])).toBe(13);
    expect(startingArmorClass('barbarian', scores, [])).toBe(14);
    expect(startingArmorClass('monk', scores, [shield])).toBe(13);
    expect(startingArmorClass('wizard', scores, [])).toBe(12);
  });
  it('builds a character with kits, lineage and languages', () => {
    const wizard = classById('wizard')!, sage = backgroundById('sage')!;
    const c = buildCharacter({
      id: 'w', name: 'Ilya', speciesId: 'elf', backgroundId: 'sage', classId: 'wizard', base,
      boosts: { int: 2, con: 1 }, classSkills: [], backgroundSkills: sage.skills, now: 1,
      lineageId: 'wood-elf', subclassId: 'abjurer', originFeat: 'magic-initiate', originFeatNote: 'Wizard',
      languages: ['elvish', 'draconic'], kits: [wizard.kits![0], sage.kits![0]],
    });
    expect(c.lineageId).toBe('wood-elf');
    expect(c.languages).toEqual(['common', 'elvish', 'draconic']);
    expect(c.inventory.some((i) => i.name === 'Spellbook')).toBe(true);
    expect(c.inventory.find((i) => i.name === 'Quarterstaff')?.kind).toBe('weapon');
    expect(c.currency.gp).toBe(13);
    expect(new Set(c.inventory.map((i) => i.id)).size).toBe(c.inventory.length);
  });
});

describe('creation data', () => {
  it('has every class with kits and at least four paths', () => {
    expect(CLASSES).toHaveLength(12);
    for (const k of CLASSES) {
      expect(k.kits?.length).toBeGreaterThanOrEqual(2);
      expect(subclassesFor(k.id).length).toBeGreaterThanOrEqual(4);
    }
    expect(SUBCLASSES).toHaveLength(48);
  });
  it('has 16 backgrounds with three abilities, two skills and an origin feat', () => {
    expect(BACKGROUNDS).toHaveLength(16);
    for (const b of BACKGROUNDS) {
      expect(b.abilities).toHaveLength(3);
      expect(b.skills).toHaveLength(2);
      expect(b.feat).toBeTruthy();
    }
  });
  it('gives lineages to the species that need one', () => {
    expect(SPECIES).toHaveLength(10);
    for (const s of SPECIES) expect(lineagesFor(s.id).length > 0).toBe(!!s.lineage);
    expect(lineagesFor('elf').map((l) => l.id).sort()).toEqual(['drow', 'high-elf', 'wood-elf']);
  });
  it('keeps PHB entries free of rules text', () => {
    for (const x of [...SPECIES, ...BACKGROUNDS, ...SUBCLASSES]) if (x.source === 'PHB 2024') expect(x.description).toBe('');
  });
});

describe('migrateCharacter', () => {
  it('gives older characters Common', () => {
    expect(migrateCharacter({ id: 'a', level: 1 }).languages).toEqual(['common']);
    expect(migrateCharacter({ id: 'a', level: 1, languages: ['common', 'orc'] }).languages).toEqual(['common', 'orc']);
  });
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
