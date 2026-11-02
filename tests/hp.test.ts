import { describe, expect, it } from 'vitest';
import { applyDamage, applyDeathSave, applyHealing, setTempHp } from '../src/rules/hp';
import { makeCharacter } from './helpers';

describe('hp', () => {
  it('temp HP absorbs damage first', () => {
    const c = applyDamage(makeCharacter({ hp: { max: 30, current: 20, temp: 5 } }), 8);
    expect(c.hp).toEqual({ max: 30, current: 17, temp: 0 });
  });
  it('does not go below 0', () => {
    expect(applyDamage(makeCharacter({ hp: { max: 30, current: 5, temp: 0 } }), 10).hp.current).toBe(0);
  });
  it('massive damage kills outright', () => {
    const c = applyDamage(makeCharacter({ hp: { max: 10, current: 5, temp: 0 } }), 15);
    expect(c.deathSaves.failures).toBe(3);
  });
  it('damage while down adds failed death saves', () => {
    const down = makeCharacter({ hp: { max: 30, current: 0, temp: 0 } });
    expect(applyDamage(down, 3).deathSaves.failures).toBe(1);
    expect(applyDamage(down, 3, true).deathSaves.failures).toBe(2);
  });
  it('healing caps at max and resets death saves', () => {
    const c = applyHealing(makeCharacter({ hp: { max: 30, current: 0, temp: 0 }, deathSaves: { successes: 1, failures: 2 } }), 50);
    expect(c.hp.current).toBe(30);
    expect(c.deathSaves).toEqual({ successes: 0, failures: 0 });
  });
  it('temp HP keeps the higher value', () => {
    const c = makeCharacter({ hp: { max: 30, current: 30, temp: 6 } });
    expect(setTempHp(c, 4).hp.temp).toBe(6);
    expect(setTempHp(c, 9).hp.temp).toBe(9);
  });
  it('death saves', () => {
    const down = makeCharacter({ hp: { max: 30, current: 0, temp: 0 } });
    expect(applyDeathSave(down, 12).deathSaves.successes).toBe(1);
    expect(applyDeathSave(down, 5).deathSaves.failures).toBe(1);
    expect(applyDeathSave(down, 1).deathSaves.failures).toBe(2);
    expect(applyDeathSave(down, 20).hp.current).toBe(1);
  });
});
