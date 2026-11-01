import { afterEach, describe, expect, it } from 'vitest';
import { finishShortRest, longRest, spendHitDie } from '../src/rules/rest';
import { setRng } from '../src/rules/dice';
import { classById } from '../src/data';
import { makeCharacter } from './helpers';

afterEach(() => setRng(Math.random));
const wizard = classById('wizard')!;
const warlock = classById('warlock')!;

describe('rests', () => {
  it('spending a hit die heals die + CON mod', () => {
    setRng(() => 3 / 6 + 1e-9); // rolls a 4 on d6
    const r = spendHitDie(makeCharacter({ hp: { max: 32, current: 10, temp: 0 } }), wizard)!;
    expect(r.roll).toBe(4);
    expect(r.healed).toBe(6); // CON 14 => +2
    expect(r.character.hitDiceUsed).toBe(1);
  });
  it('cannot spend more hit dice than level', () => {
    expect(spendHitDie(makeCharacter({ hitDiceUsed: 5 }), wizard)).toBeNull();
  });
  it('short rest restores pact slots only for warlocks', () => {
    const used = makeCharacter({ spellSlotsUsed: [0, 2, 0, 0, 0, 0, 0, 0, 0] });
    expect(finishShortRest(used, warlock).spellSlotsUsed[1]).toBe(0);
    expect(finishShortRest(used, wizard).spellSlotsUsed[1]).toBe(2);
  });
  it('long rest restores everything (2024: all hit dice)', () => {
    const c = longRest(makeCharacter({
      hp: { max: 32, current: 3, temp: 4 }, hitDiceUsed: 5, exhaustion: 2, concentration: 'bless',
      spellSlotsUsed: [4, 3, 2, 0, 0, 0, 0, 0, 0], deathSaves: { successes: 1, failures: 1 },
    }));
    expect(c.hp).toEqual({ max: 32, current: 32, temp: 0 });
    expect(c.hitDiceUsed).toBe(0);
    expect(c.exhaustion).toBe(1);
    expect(c.spellSlotsUsed.every((n) => n === 0)).toBe(true);
    expect(c.concentration).toBeNull();
  });
});
