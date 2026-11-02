import type { Character, WeaponData } from '../types';
import { abilityMod, proficiencyBonus } from './abilities';

export interface WeaponAttack {
  toHit: number;
  /** Damage expression, e.g. "1d8+3". */
  damage: string;
  /** Two-handed damage for versatile weapons. */
  versatile?: string;
  damageType: string;
  ability: 'str' | 'dex';
  rangeText: string;
}

const withMod = (dice: string, mod: number) => (mod === 0 ? dice : `${dice}${mod > 0 ? '+' : ''}${mod}`);

/**
 * Attack and damage for a weapon (2024 rules): melee uses STR, ranged uses DEX,
 * finesse uses the better of the two. Proficiency is assumed for now.
 */
export function weaponAttack(c: Pick<Character, 'abilities' | 'level' | 'exhaustion'>, w: WeaponData): WeaponAttack {
  const str = abilityMod(c.abilities.str);
  const dex = abilityMod(c.abilities.dex);
  let ability: 'str' | 'dex' = w.range === 'ranged' ? 'dex' : 'str';
  if (w.properties.includes('finesse')) ability = dex > str ? 'dex' : 'str';
  const mod = ability === 'dex' ? dex : str;
  const toHit = mod + proficiencyBonus(c.level) - 2 * (c.exhaustion ?? 0);
  const reach = w.properties.includes('reach') ? 10 : 5;
  let rangeText = w.range === 'ranged' ? `${w.normalRange}/${w.longRange} ft` : `${reach} feet`;
  if (w.range === 'melee' && w.normalRange) rangeText += ` · thrown ${w.normalRange}/${w.longRange}`;
  return {
    toHit,
    damage: withMod(w.damage.includes('d') ? w.damage : `${w.damage}`, mod),
    versatile: w.versatileDamage ? withMod(w.versatileDamage, mod) : undefined,
    damageType: w.damageType,
    ability,
    rangeText,
  };
}
