import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromCah, isCahCharacter, matchSubclass, parseWeight } from '../src/rules/importCah';
import { classLabel } from '../src/rules/classes';
import { derive } from '../src/rules/derived';
import spellsJson from '../src/data/spells.json';
import type { Spell } from '../src/types';

const data = JSON.parse(readFileSync(new URL('./fixtures/sample.cah', import.meta.url), 'utf8'));
let n = 0;
const { character: c, warnings } = fromCah(data, spellsJson as Spell[], () => `id${++n}`, 1000);

describe('.cah import', () => {
  it('detects the format', () => {
    expect(isCahCharacter(data)).toBe(true);
    expect(isCahCharacter({ name: 'x', abilities: {} })).toBe(false);
    expect(isCahCharacter([data])).toBe(false);
  });
  it('maps classes, subclasses, species and background', () => {
    expect(c.name).toBe('Test Goliath');
    expect(c.classId).toBe('paladin');
    expect(c.level).toBe(6);
    expect(c.subclassId).toBe(matchSubclass('paladin', 'paladin_oath_of_the_ancients'));
    expect(c.subclassId).toBeTruthy();
    expect(c.multiclass).toEqual([{ id: 'warlock', level: 3, subclassId: matchSubclass('warlock', 'warlock_the_great_old_one') }]);
    expect(c.multiclass?.[0].subclassId).toBeTruthy();
    expect(classLabel(c)).toBe('Paladin 3 / Warlock 3');
    expect(warnings.some((w) => w.includes('artificer'))).toBe(true);
    expect(c.speciesId).toBe('goliath');
    expect(c.backgroundId).toBe('acolyte');
  });
  it('maps abilities and skills', () => {
    expect(c.abilities).toEqual({ str: 14, dex: 12, con: 18, int: 10, wis: 7, cha: 14 });
    expect(c.skills).toEqual(['athletics', 'sleight-of-hand']);
    expect(c.creation).toMatchObject({ method: 'manual', base: c.abilities, acAuto: true });
    expect(c.expertise).toEqual(['sleight-of-hand']);
  });
  it('computes AC from equipped heavy armor and HP from base HP + CON', () => {
    expect(c.armorClass).toBe(18);
    expect(derive(c).ac).toBe(18); // follows the equipped plate
    expect(c.hp).toEqual({ max: 53 + 4 * 6, current: 70, temp: 5 });
    expect(c.deathSaves).toEqual({ successes: 1, failures: 0 });
  });
  it('matches SRD spells and keeps the rest as custom spells', () => {
    expect(c.spells.map((s) => s.id)).toEqual(['eldritch-blast', 'sanctuary', 'custom-id1', 'custom-id2']);
    expect(c.spells[0]).toMatchObject({ prepared: true, classId: 'warlock' });
    expect(c.spells[1]).toMatchObject({ prepared: true, classId: 'paladin' });
    const [arms, ward] = c.customSpells ?? [];
    expect(arms).toMatchObject({
      name: 'Arms of Hadar', level: 1, school: 'conjuration', classes: ['warlock'],
      damage: '2d6', damageType: 'necrotic', upcastDice: 1, save: 'str',
    });
    expect(arms.description).toContain('Using a Higher-Level Spell Slot');
    expect(arms.castingTime).toBe('Action');
    expect(ward).toMatchObject({ components: 'V, S, M', material: 'a silver ring', concentration: true, ritual: true });
    expect(warnings.some((w) => w.includes('Arms of Hadar'))).toBe(true);
  });
  it('treats every spell as prepared when the export never marks one', () => {
    const none = { ...data, spells: data.spells.map((s: object) => ({ ...s, prepared: false })) };
    const r = fromCah(none, spellsJson as Spell[], () => 'x', 0).character;
    expect(r.spells.every((s) => s.prepared)).toBe(true);
    expect(c.spells.find((s) => s.id === 'custom-id1')?.prepared).toBe(false); // the fixture marks Sanctuary only
  });
  it('maps inventory and currency', () => {
    expect(c.inventory.map((i) => [i.name, i.qty, i.weight, i.equipped])).toEqual([
      ['Plate', 1, 65, true],
      ['Leather', 1, 10, false],
      ['Greatsword', 1, 6, true],
      ['Rope', 2, 0.5, false],
    ]);
    expect(c.inventory[2].notes).toContain('2d6 slashing');
    expect(c.inventory[0].armor).toEqual({ category: 'heavy', ac: 18 });
    expect(c.inventory[2]).toMatchObject({ kind: 'weapon', weaponId: 'greatsword' });
    expect(c.currency).toEqual({ cp: 0, sp: 3, ep: 0, gp: 25, pp: 1 });
  });
  it('keeps XP and collects everything else in notes', () => {
    expect(c.xp).toBe(14000);
    const [summary, ...own] = c.notes;
    expect(summary).toMatchObject({ title: 'Imported from .cah', pinned: true });
    expect(summary.body).toContain('Lay On Hands Points: 15 left');
    expect(summary.body).toContain('Grasp of Hadar (Eldritch Invocations)');
    expect(summary.body).toContain('Half proficiency (not tracked): Stealth');
    expect(summary.body).toContain('Lawful Good');
    expect(own.map((n) => n.body)).toEqual(['I have tremorsense now']);
  });
  it('matches subclass names loosely', () => {
    expect(matchSubclass('fighter', 'fighter_champion')).toBe('champion');
    expect(matchSubclass('fighter', 'fighter_made_up')).toBeUndefined();
  });
  it('parses weights', () => {
    expect(parseWeight('65 lb.')).toBe(65);
    expect(parseWeight('1/2 lb')).toBe(0.5);
    expect(parseWeight('2.5 lb')).toBe(2.5);
    expect(parseWeight('')).toBe(0);
  });
});
