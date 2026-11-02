import { describe, expect, it } from 'vitest';
import { weaponById } from '../src/data';
import { weaponAttack } from '../src/rules/weapons';
import { makeCharacter } from './helpers';

// Level 5 (+3), STR 8 (-1), DEX 14 (+2)
const c = makeCharacter();

describe('weaponAttack', () => {
  it('uses STR for melee weapons and shows versatile damage', () => {
    const a = weaponAttack(c, weaponById('quarterstaff')!);
    expect(a.ability).toBe('str');
    expect(a.toHit).toBe(2);
    expect(a.damage).toBe('1d6-1');
    expect(a.versatile).toBe('1d8-1');
    expect(a.rangeText).toBe('5 feet');
  });
  it('uses the better ability for finesse weapons and shows thrown range', () => {
    const a = weaponAttack(c, weaponById('dagger')!);
    expect(a.ability).toBe('dex');
    expect(a.toHit).toBe(5);
    expect(a.damage).toBe('1d4+2');
    expect(a.rangeText).toBe('5 feet · thrown 20/60');
  });
  it('uses DEX for ranged weapons', () => {
    const a = weaponAttack(c, weaponById('longbow')!);
    expect(a.ability).toBe('dex');
    expect(a.damage).toBe('1d8+2');
    expect(a.rangeText).toBe('150/600 ft');
  });
  it('applies the exhaustion penalty to the attack roll', () => {
    expect(weaponAttack({ ...c, exhaustion: 1 }, weaponById('dagger')!).toHit).toBe(3);
  });
  it('gives reach weapons 10 feet', () => {
    expect(weaponAttack(c, weaponById('glaive')!).rangeText).toBe('10 feet');
  });
});
