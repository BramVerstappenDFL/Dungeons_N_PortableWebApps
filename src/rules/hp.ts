import type { Character } from '../types';

type HpState = Pick<Character, 'hp' | 'deathSaves'>;

/** Applies damage: temp HP absorbs first. Damage at 0 HP adds a failed death save (2 on a crit). */
export function applyDamage<T extends HpState>(c: T, amount: number, crit = false): T {
  amount = Math.max(0, Math.floor(amount));
  if (amount === 0) return c;
  const wasDown = c.hp.current === 0;
  const fromTemp = Math.min(c.hp.temp, amount);
  const rest = amount - fromTemp;
  const current = Math.max(0, c.hp.current - rest);
  let deathSaves = c.deathSaves;
  if (wasDown && rest > 0) {
    deathSaves = { ...deathSaves, failures: Math.min(3, deathSaves.failures + (crit ? 2 : 1)) };
  }
  // Massive damage: remaining damage after dropping to 0 >= max HP = instant death.
  if (!wasDown && current === 0 && rest - c.hp.current >= c.hp.max) {
    deathSaves = { successes: 0, failures: 3 };
  }
  return { ...c, hp: { ...c.hp, temp: c.hp.temp - fromTemp, current }, deathSaves };
}

/** Heals up to max HP; any healing from 0 resets death saves. */
export function applyHealing<T extends HpState>(c: T, amount: number): T {
  amount = Math.max(0, Math.floor(amount));
  if (amount === 0) return c;
  const current = Math.min(c.hp.max, c.hp.current + amount);
  return { ...c, hp: { ...c.hp, current }, deathSaves: { successes: 0, failures: 0 } };
}

/** Temp HP don't stack: keep the higher value. */
export function setTempHp<T extends HpState>(c: T, amount: number): T {
  return { ...c, hp: { ...c.hp, temp: Math.max(c.hp.temp, Math.max(0, Math.floor(amount))) } };
}

/** Resolves a death saving throw roll (natural d20). */
export function applyDeathSave<T extends HpState>(c: T, natural: number): T {
  if (natural === 20) return applyHealing({ ...c, hp: { ...c.hp, current: 0 } }, 1);
  const ds = { ...c.deathSaves };
  if (natural === 1) ds.failures = Math.min(3, ds.failures + 2);
  else if (natural >= 10) ds.successes = Math.min(3, ds.successes + 1);
  else ds.failures = Math.min(3, ds.failures + 1);
  return { ...c, deathSaves: ds };
}
