import type { BackgroundData, ClassData, SpeciesData, Spell, WeaponData } from '../types';
import classesJson from './classes.json';
import speciesJson from './species.json';
import backgroundsJson from './backgrounds.json';
import weaponsJson from './weapons.json';

export const CLASSES = classesJson as ClassData[];
export const SPECIES = speciesJson as SpeciesData[];
export const BACKGROUNDS = backgroundsJson as BackgroundData[];
export const WEAPONS = weaponsJson as WeaponData[];

export const classById = (id: string) => CLASSES.find((c) => c.id === id);
export const speciesById = (id: string) => SPECIES.find((s) => s.id === id);
export const weaponById = (id: string | undefined) => WEAPONS.find((w) => w.id === id);
export const backgroundById = (id: string) => BACKGROUNDS.find((b) => b.id === id);

// The spell list is large (~330 KB), so it is loaded lazily and cached.
let spellCache: Spell[] | null = null;
let spellPromise: Promise<Spell[]> | null = null;
export function loadSpells(): Promise<Spell[]> {
  if (spellCache) return Promise.resolve(spellCache);
  spellPromise ??= import('./spells.json').then((m) => (spellCache = m.default as Spell[]));
  return spellPromise;
}
export const getCachedSpells = () => spellCache;
