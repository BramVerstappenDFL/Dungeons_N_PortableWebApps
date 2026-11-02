import type { Spell } from '../types';
import { cantripDiceMultiplier } from './slots';

function scaleDice(dice: string, extra: number, mult = 1): string {
  const m = /^(\d+)d(\d+)$/.exec(dice);
  if (!m) return dice;
  return `${Number(m[1]) * mult + extra}d${m[2]}`;
}

/** Builds damage/heal roll expressions for casting a spell at a slot level. */
export function spellRolls(spell: Spell, slotLevel: number, charLevel: number, spellMod: number) {
  const out: { label: string; expression: string }[] = [];
  const above = Math.max(0, slotLevel - spell.level);
  if (spell.damage) {
    const mult = spell.level === 0 && spell.cantripScaling ? cantripDiceMultiplier(charLevel) : 1;
    let expr = scaleDice(spell.damage, (spell.upcastDice ?? 0) * above, mult);
    if (spell.damageBonus) expr += `+${spell.damageBonus}`;
    if (spell.damageAddsMod) expr += spellMod >= 0 ? `+${spellMod}` : `${spellMod}`;
    out.push({ label: `${spell.name} damage${spell.damageType ? ` (${spell.damageType})` : ''}`, expression: expr });
  }
  if (spell.heal) {
    let expr = scaleDice(spell.heal, (spell.upcastHealDice ?? 0) * above);
    const bonus = (spell.healBonus ?? 0) + (spell.upcastHealBonus ?? 0) * above;
    if (bonus) expr += `+${bonus}`;
    if (spell.healAddsMod) expr += spellMod >= 0 ? `+${spellMod}` : `${spellMod}`;
    out.push({ label: `${spell.name} healing`, expression: expr });
  }
  return out;
}

export const SCHOOLS = ['abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion', 'necromancy', 'transmutation'];
export const levelLabel = (l: number) => (l === 0 ? 'Cantrip' : `Level ${l}`);
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
