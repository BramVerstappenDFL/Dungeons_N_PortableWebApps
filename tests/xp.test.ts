import { describe, expect, it } from 'vitest';
import { applyXp, bandPct, hpPerLevel, levelForXp, xpForNext } from '../src/rules/xp';
import { makeCharacter } from './helpers';

describe('xp', () => {
  it('maps XP to level using the 2024 table', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(299)).toBe(1);
    expect(levelForXp(300)).toBe(2);
    expect(levelForXp(6500)).toBe(5);
    expect(levelForXp(355000)).toBe(20);
    expect(levelForXp(9_999_999)).toBe(20);
  });
  it('reports the next threshold and band progress', () => {
    expect(xpForNext(5)).toBe(14000);
    expect(xpForNext(20)).toBe(355000);
    expect(bandPct(6500)).toBe(0);
    expect(bandPct(10250)).toBe(50);
    expect(bandPct(400000)).toBe(100);
  });
  it('averages HP per level with a minimum of 1', () => {
    expect(hpPerLevel(6, 14)).toBe(6);
    expect(hpPerLevel(6, 3)).toBe(1);
  });
  it('adds XP without levelling inside a band', () => {
    const c = makeCharacter({ xp: 6500, level: 5 });
    const { character, levelsGained } = applyXp(c, 1000, 6);
    expect(character.xp).toBe(7500);
    expect(levelsGained).toBe(0);
    expect(character.hp.max).toBe(32);
  });
  it('levels up (possibly several times) and grows HP', () => {
    const c = makeCharacter({ xp: 6500, level: 5, hp: { max: 32, current: 20, temp: 0 } });
    const { character, levelsGained } = applyXp(c, 16500, 6); // 23000 = level 7
    expect(levelsGained).toBe(2);
    expect(character.level).toBe(7);
    expect(character.hp).toEqual({ max: 44, current: 32, temp: 0 });
  });
  it('ignores negative amounts', () => {
    const c = makeCharacter({ xp: 6500, level: 5 });
    expect(applyXp(c, -50, 6).character.xp).toBe(6500);
  });
});
