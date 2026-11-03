import type {
  ArmorInfo,  BackgroundData, ClassData, FeatData, LanguageData, LineageData, SpeciesData, Spell, SubclassData, WeaponData,
} from '../types';
import classesJson from './classes.json';
import speciesJson from './species.json';
import backgroundsJson from './backgrounds.json';
import weaponsJson from './weapons.json';
import lineagesJson from './lineages.json';
import subclassesJson from './subclasses.json';
import featsJson from './feats.json';
import languagesJson from './languages.json';
import armorJson from './armor.json';
import { PHB_BACKGROUNDS, PHB_FEATS, PHB_SPECIES, PHB_SUBCLASSES } from './phb';

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
const srd = <T>(list: T[]) => list.map((x) => ({ source: 'SRD 5.2.1' as const, ...x }));

export const CLASSES = classesJson as ClassData[];
export const SPECIES = [...srd(speciesJson as SpeciesData[]), ...PHB_SPECIES].sort(byName);
export const BACKGROUNDS = [...srd(backgroundsJson as BackgroundData[]), ...PHB_BACKGROUNDS].sort(byName);
export const WEAPONS = weaponsJson as WeaponData[];
export const LINEAGES = srd(lineagesJson as LineageData[]);
export const SUBCLASSES = [...srd(subclassesJson as SubclassData[]), ...PHB_SUBCLASSES].sort(byName);
export const FEATS = [...srd(featsJson as FeatData[]), ...PHB_FEATS].sort(byName);
export const LANGUAGES = languagesJson as LanguageData[];
export const ARMOR = armorJson as (ArmorInfo & { id: string; name: string; weight: number })[];
export const armorByName = (name: string) => ARMOR.find((a) => a.name.toLowerCase() === name.trim().toLowerCase());
export const STANDARD_LANGUAGES = LANGUAGES.filter((l) => !l.rare && l.id !== 'common');

export const classById = (id: string) => CLASSES.find((c) => c.id === id);
export const speciesById = (id: string) => SPECIES.find((s) => s.id === id);
export const weaponById = (id: string | undefined) => WEAPONS.find((w) => w.id === id);
export const backgroundById = (id: string) => BACKGROUNDS.find((b) => b.id === id);
export const lineageById = (id: string | undefined) => LINEAGES.find((l) => l.id === id);
export const subclassById = (id: string | undefined) => SUBCLASSES.find((s) => s.id === id);
export const featById = (id: string | undefined) => FEATS.find((f) => f.id === id);
export const languageById = (id: string) => LANGUAGES.find((l) => l.id === id);
/** "Wood Elf", or "Dragonborn (Red Dragon)" when the lineage name does not include the species. */
export function originName(speciesId: string, lineageId?: string): string {
  const s = speciesById(speciesId)?.name ?? '';
  const l = lineageById(lineageId)?.name;
  if (!l) return s;
  return l.toLowerCase().includes(s.toLowerCase()) ? l : `${s} (${l})`;
}
/** Walking speed, including a lineage that changes it (Wood Elf: 35 ft). */
export const speciesSpeed = (speciesId: string, lineageId?: string) =>
  (speciesById(speciesId)?.speed ?? 30) + (lineageById(lineageId)?.speedBonus ?? 0);
export const lineagesFor = (speciesId: string) => LINEAGES.filter((l) => l.speciesId === speciesId);
export const subclassesFor = (classId: string) => SUBCLASSES.filter((s) => s.classId === classId);

// The spell list is large (~330 KB), so it is loaded lazily and cached.
let spellCache: Spell[] | null = null;
let spellPromise: Promise<Spell[]> | null = null;
export function loadSpells(): Promise<Spell[]> {
  if (spellCache) return Promise.resolve(spellCache);
  spellPromise ??= import('./spells.json').then((m) => (spellCache = m.default as Spell[]));
  return spellPromise;
}
export const getCachedSpells = () => spellCache;
