import { afterEach, describe, expect, it } from 'vitest';
import { parseExpression, roll, setRng } from '../src/rules/dice';

// Deterministic RNG that returns faces from a queue: face f on a dN = (f-1)/N.
function queue(faces: [number, number][]) {
  let i = 0;
  setRng(() => { const [f, n] = faces[i++ % faces.length]; return (f - 1) / n + 1e-9; });
}
afterEach(() => setRng(Math.random));

describe('parseExpression', () => {
  it('parses dice, constants and signs', () => {
    expect(parseExpression('2d6+3')).toEqual([
      { kind: 'dice', sign: 1, count: 2, sides: 6 },
      { kind: 'const', sign: 1, value: 3 },
    ]);
    expect(parseExpression('d20 - 1')).toHaveLength(2);
    expect(parseExpression('4d6kh3')[0]).toMatchObject({ keep: 'h', keepN: 3 });
  });
  it('rejects garbage', () => {
    expect(() => parseExpression('2d')).toThrow();
    expect(() => parseExpression('hello')).toThrow();
    expect(() => parseExpression('')).toThrow();
    expect(() => parseExpression('2d6 3')).toThrow();
  });
});

describe('roll', () => {
  it('sums dice and modifiers', () => {
    queue([[4, 6], [5, 6]]);
    expect(roll('2d6+3').total).toBe(12);
  });
  it('applies advantage and disadvantage to the d20', () => {
    queue([[3, 20], [17, 20]]);
    const a = roll('1d20+2', 'advantage');
    expect(a.total).toBe(19);
    expect(a.natural).toBe(17);
    queue([[3, 20], [17, 20]]);
    expect(roll('1d20+2', 'disadvantage').total).toBe(5);
  });
  it('keeps highest N', () => {
    queue([[1, 6], [6, 6], [4, 6], [5, 6]]);
    expect(roll('4d6kh3').total).toBe(15);
  });
  it('stays within bounds', () => {
    setRng(Math.random);
    for (let i = 0; i < 500; i++) {
      const t = roll('3d8').total;
      expect(t).toBeGreaterThanOrEqual(3);
      expect(t).toBeLessThanOrEqual(24);
    }
  });
});
