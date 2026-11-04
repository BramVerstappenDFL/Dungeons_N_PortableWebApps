import { afterEach, describe, expect, it } from 'vitest';
import { finishShortRest, longRest, spendHitDie } from '../src/rules/rest';
import { setRng } from '../src/rules/dice';
import { makeCharacter } from './helpers';

afterEach(() => setRng(Math.random));

describe('rests', () => {
  it('spending a hit die heals die + CON mod', () => {
    setRng(() => 3 / 6 + 1e-9); // rolls a 4 on d6
    const r = spendHitDie(makeCharacter({ hp: { max: 32, current: 10, temp: 0 } }), 6)!;
    expect(r.roll).toBe(4);
    expect(r.healed).toBe(6); // CON 14 => +2
    expect(r.character.hitDiceUsed).toEqual({ 6: 1 });
  });
  it('cannot spend more hit dice than level', () => {
    expect(spendHitDie(makeCharacter({ hitDiceUsed: { 6: 5 } }), 6)).toBeNull();
  });
  it('cannot spend a die size the character does not have', () => {
    expect(spendHitDie(makeCharacter(), 10)).toBeNull();
  });
  it('short rest restores pact slots only', () => {
    const used = makeCharacter({ spellSlotsUsed: [0, 2, 0, 0, 0, 0, 0, 0, 0], pactSlotsUsed: 2 });
    const after = finishShortRest(used);
    expect(after.pactSlotsUsed).toBe(0);
    expect(after.spellSlotsUsed[1]).toBe(2);
  });
  it('long rest restores everything (2024: all hit dice)', () => {
    const c = longRest(makeCharacter({
      hp: { max: 32, current: 3, temp: 4 }, hitDiceUsed: { 6: 5 }, exhaustion: 2, concentration: 'bless',
      spellSlotsUsed: [4, 3, 2, 0, 0, 0, 0, 0, 0], pactSlotsUsed: 1, deathSaves: { successes: 1, failures: 1 },
    }));
    expect(c.hp).toEqual({ max: 32, current: 32, temp: 0 });
    expect(c.hitDiceUsed).toEqual({});
    expect(c.exhaustion).toBe(1);
    expect(c.spellSlotsUsed.every((n) => n === 0)).toBe(true);
    expect(c.pactSlotsUsed).toBe(0);
    expect(c.concentration).toBeNull();
  });
});
