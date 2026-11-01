import { describe, expect, it } from 'vitest';
import { endTurn, newCombat, pickSlot, setUsed, slotForCastingTime, spendSlot } from '../src/rules/combat';

describe('combat', () => {
  it('ends the turn into the next round with a fresh economy', () => {
    const c = setUsed(setUsed(newCombat(), 'action'), 'reaction');
    const n = endTurn(c);
    expect(n.round).toBe(2);
    expect(n.eco).toEqual({ action: false, bonus: false, reaction: false });
  });
  it('maps casting times to economy slots', () => {
    expect(slotForCastingTime('Action')).toBe('action');
    expect(slotForCastingTime('Bonus Action')).toBe('bonus');
    expect(slotForCastingTime('Reaction')).toBe('reaction');
    expect(slotForCastingTime('1 minute')).toBeNull();
  });
  it('picks the lowest free slot at or above the spell level', () => {
    const max = [4, 3, 2];
    expect(pickSlot(0, [0, 0, 0], max)).toBe(0);
    expect(pickSlot(1, [0, 0, 0], max)).toBe(1);
    expect(pickSlot(1, [4, 0, 0], max)).toBe(2);
    expect(pickSlot(2, [4, 3, 1], max)).toBe(3);
    expect(pickSlot(1, [4, 3, 2], max)).toBeNull();
  });
  it('spends a slot', () => {
    expect(spendSlot([1, 0, 0], 1)).toEqual([2, 0, 0]);
    expect(spendSlot([1, 0, 0], 0)).toEqual([1, 0, 0]);
  });
});
