import type { Character } from '../types';
import { loadSpells } from '../data';
import { useStore } from '../store/characters';
import { fromCah, isCahCharacter } from '../rules/importCah';

export interface ImportOutcome { count: number; text: string; details: string[] }

/**
 * Imports a character file: a D&D Assist export (.json, one character or a list) or a `.cah`
 * character file from another app, converted with its spells matched to the SRD list.
 */
export async function importCharacterFile(file: File): Promise<ImportOutcome> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return { count: 0, text: 'That file is not a character export. Choose a D&D Assist export (.json) or a .cah character file.', details: [] };
  }
  const { add, importMany } = useStore.getState();
  const list = Array.isArray(data) ? data : [data];
  if (list.some(isCahCharacter)) {
    const srd = await loadSpells();
    const results = list.filter(isCahCharacter).map((x) => fromCah(x, srd));
    results.forEach((r) => add(r.character));
    return {
      count: results.length,
      text: `Imported ${results.map((r) => r.character.name).join(', ')}. Features, resources and other details are in the notes.`,
      details: results.flatMap((r) => r.warnings),
    };
  }
  const n = importMany(list as Character[]);
  return { count: n, text: n ? `Imported ${n} character${n === 1 ? '' : 's'}.` : 'No characters found in that file.', details: [] };
}
