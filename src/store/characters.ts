import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Character, RollLogEntry } from '../types';
import { roll as rollDice, type RollMode } from '../rules/dice';

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const MAX_LOG = 100;

export interface LastRoll extends RollLogEntry { characterName?: string }

interface State {
  characters: Character[];
  lastRoll: LastRoll | null;
  add: (c: Character) => void;
  update: (id: string, fn: (c: Character) => Character) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => string | null;
  importMany: (list: Character[]) => number;
  /** Rolls an expression, logs it on the character (if any) and shows it in the roll toast. */
  roll: (expression: string, label: string, opts?: { characterId?: string; mode?: RollMode }) => LastRoll | null;
  clearLastRoll: () => void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      characters: [],
      lastRoll: null,
      add: (c) => set((s) => ({ characters: [...s.characters, c] })),
      update: (id, fn) =>
        set((s) => ({ characters: s.characters.map((c) => (c.id === id ? { ...fn(c), updatedAt: Date.now() } : c)) })),
      remove: (id) => set((s) => ({ characters: s.characters.filter((c) => c.id !== id) })),
      duplicate: (id) => {
        const src = get().characters.find((c) => c.id === id);
        if (!src) return null;
        const copy: Character = { ...structuredClone(src), id: uid(), name: `${src.name} (copy)`, createdAt: Date.now(), updatedAt: Date.now() };
        set((s) => ({ characters: [...s.characters, copy] }));
        return copy.id;
      },
      importMany: (list) => {
        const valid = list.filter((c) => c && typeof c.name === 'string' && c.abilities && c.hp);
        const existing = new Set(get().characters.map((c) => c.id));
        const fixed = valid.map((c) => (existing.has(c.id) ? { ...c, id: uid() } : c));
        set((s) => ({ characters: [...s.characters, ...fixed] }));
        return fixed.length;
      },
      roll: (expression, label, opts = {}) => {
        let r;
        try {
          r = rollDice(expression, opts.mode);
        } catch {
          return null;
        }
        const isD20 = r.natural != null;
        const entry: LastRoll = {
          id: uid(),
          label: opts.mode && opts.mode !== 'normal' ? `${label} (${opts.mode === 'advantage' ? 'adv' : 'dis'})` : label,
          expression: r.expression,
          total: r.total,
          detail: r.detail,
          time: Date.now(),
          crit: isD20 && r.natural === 20 ? 'hit' : isD20 && r.natural === 1 ? 'miss' : undefined,
        };
        const { characterId } = opts;
        if (characterId) {
          const c = get().characters.find((x) => x.id === characterId);
          entry.characterName = c?.name;
          get().update(characterId, (c) => ({ ...c, rollLog: [entry, ...c.rollLog].slice(0, MAX_LOG) }));
        }
        set({ lastRoll: entry });
        return entry;
      },
      clearLastRoll: () => set({ lastRoll: null }),
    }),
    {
      name: 'dnd-assist',
      version: 1,
      partialize: (s) => ({ characters: s.characters }),
    },
  ),
);

export const useCharacter = (id: string | undefined) => useStore((s) => s.characters.find((c) => c.id === id));
