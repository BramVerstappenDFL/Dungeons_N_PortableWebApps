import { useEffect, useState } from 'react';
import { getCachedSpells, loadSpells } from '../data';
import type { Spell } from '../types';

/** The SRD spell list, loaded on first use. */
export function useSpells(): Spell[] | null {
  const [spells, setSpells] = useState<Spell[] | null>(getCachedSpells());
  useEffect(() => {
    if (!spells) loadSpells().then(setSpells);
  }, [spells]);
  return spells;
}
