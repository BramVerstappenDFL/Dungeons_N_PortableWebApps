import type { Character, ClassData, ClassLevel } from '../types';
import { classById } from '../data';
import { abilityMod } from './abilities';
import { pactSlotLevel } from './slots';

/** Total character level across all classes. */
export const totalLevel = (c: Pick<Character, 'classes'>) => c.classes.reduce((n, x) => n + x.level, 0) || 1;

/** The starting class: it sets saving throws and skill choices. */
export const primaryClass = (c: Pick<Character, 'classes'>): ClassData | undefined => classById(c.classes[0]?.id ?? '');

/** "Paladin 3 / Warlock 3", or just "Wizard" for a single class. */
export function classLabel(c: Pick<Character, 'classes'>) {
  const parts = c.classes.map((x) => classById(x.id)?.name ?? x.id);
  if (c.classes.length === 1) return parts[0] ?? '';
  return c.classes.map((x, i) => `${parts[i]} ${x.level}`).join(' / ');
}

export interface HitDicePool { die: number; total: number; used: number }

/** Hit Dice grouped by die size, largest die first. */
export function hitDicePools(c: Pick<Character, 'classes' | 'hitDiceUsed'>): HitDicePool[] {
  const totals = new Map<number, number>();
  for (const x of c.classes) {
    const die = classById(x.id)?.hitDie ?? 8;
    totals.set(die, (totals.get(die) ?? 0) + x.level);
  }
  return [...totals.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([die, total]) => ({ die, total, used: Math.min(total, c.hitDiceUsed[die] ?? 0) }));
}

/** Default max HP: max die of the first class at level 1, then the fixed average per level, plus CON per level. */
export function multiclassMaxHp(classes: ClassLevel[], con: number) {
  const mod = abilityMod(con);
  let hp = 0;
  classes.forEach((x, i) => {
    const die = classById(x.id)?.hitDie ?? 8;
    for (let lv = 0; lv < x.level; lv++) hp += (i === 0 && lv === 0 ? die : die / 2 + 1) + mod;
  });
  return Math.max(1, hp);
}

/** Upgrades a stored character from the single-class format (version 1) to the current shape. */
export function migrateCharacter(raw: unknown): Character {
  const c = raw as Character & { classId?: string; level?: number; hitDiceUsed: unknown };
  const out = { ...c } as Character & { classId?: string; level?: number };
  if (!Array.isArray(c.classes)) {
    out.classes = [{ id: c.classId ?? 'fighter', level: Math.max(1, Math.min(20, c.level ?? 1)) }];
  }
  delete out.classId;
  delete out.level;
  out.spellSlotsUsed = Array.isArray(c.spellSlotsUsed) ? [...c.spellSlotsUsed] : Array(9).fill(0);
  if (typeof c.pactSlotsUsed !== 'number') {
    out.pactSlotsUsed = 0;
    // Version 1 stored a Warlock's pact slots in the regular slot array.
    const cls = classById(out.classes[0].id);
    if (!Array.isArray(c.classes) && cls?.casterType === 'pact') {
      const i = pactSlotLevel(out.classes[0].level) - 1;
      out.pactSlotsUsed = out.spellSlotsUsed[i] ?? 0;
      out.spellSlotsUsed = Array(9).fill(0);
    }
  }
  if (typeof c.hitDiceUsed === 'number') {
    const die = classById(out.classes[0].id)?.hitDie ?? 8;
    out.hitDiceUsed = c.hitDiceUsed ? { [die]: c.hitDiceUsed } : {};
  } else if (!c.hitDiceUsed || typeof c.hitDiceUsed !== 'object') {
    out.hitDiceUsed = {};
  }
  if (!Array.isArray(c.customSpells)) out.customSpells = [];
  return out;
}
