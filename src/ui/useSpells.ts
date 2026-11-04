import { useEffect, useMemo, useState } from 'react';
import { getCachedSpells, loadSpells } from '../data';
import type { Character, Spell } from '../types';

/** The SRD spell list, loaded on first use, plus the character's custom spells when one is given. */
export function useSpells(c?: Pick<Character, 'customSpells'>): Spell[] | null {
  const [spells, setSpells] = useState<Spell[] | null>(getCachedSpells());
  useEffect(() => {
    if (!spells) loadSpells().then(setSpells);
  }, [spells]);
  const custom = c?.customSpells;
  return useMemo(() => (spells && custom?.length ? [...spells, ...custom] : spells), [spells, custom]);
}
