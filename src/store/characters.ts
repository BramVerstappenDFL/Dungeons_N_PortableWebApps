import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Character, Item, Note, RollLogEntry } from '../types';
import { roll as rollDice, type RollMode, type RollResult } from '../rules/dice';
import { XP_TABLE } from '../rules/xp';
import { newCombat } from '../rules/combat';
import { armorByName, classById } from '../data';
import { pactSlotLevel } from '../rules/slots';

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const MAX_LOG = 100;

export interface LastRoll extends RollLogEntry { characterName?: string }
export interface RollOutcome extends LastRoll { result: RollResult }

export type Theme = 'parchment' | 'dungeon';

interface State {
  characters: Character[];
  activeId: string | null;
  /** null = follow the system colour scheme. */
  theme: Theme | null;
  lastRoll: LastRoll | null;
  add: (c: Character) => void;
  update: (id: string, fn: (c: Character) => Character) => void;
  remove: (id: string) => void;
  select: (id: string) => void;
  setTheme: (t: Theme | null) => void;
  importMany: (list: Character[]) => number;
  /** Rolls an expression and logs it on the character (if any). */
  roll: (expression: string, label: string, opts?: { characterId?: string; mode?: RollMode }) => RollOutcome | null;
}

/** Brings a character saved by an older version up to the current shape. */
export function migrateCharacter(raw: unknown): Character {
  const c = raw as Omit<Character, 'notes'> & { notes?: unknown };
  const oldNotes = c.notes;
  const notes: Note[] = Array.isArray(oldNotes)
    ? (oldNotes as Note[])
    : typeof oldNotes === 'string' && oldNotes.trim()
      ? [{ id: uid(), tag: 'Session', title: 'Notes', body: oldNotes.trim(), pinned: false, createdAt: c.updatedAt ?? Date.now() }]
      : [];
  // Armour picked up before items carried their armour data gets it from the SRD table by name.
  const inventory: Item[] = (c.inventory ?? []).map((i) => {
    const a = i.armor ?? armorByName(i.name ?? '');
    return { ...i, kind: i.kind ?? 'gear', ...(a ? { armor: { category: a.category, ac: a.ac } } : {}) };
  });
  // Version 5 and earlier: one Hit Dice count, and a Warlock's pact slots kept in the slot array.
  const used = c.hitDiceUsed as unknown;
  const hitDiceUsed = typeof used === 'number'
    ? (used > 0 ? { [classById(c.classId)?.hitDie ?? 8]: used } : {})
    : used && typeof used === 'object' ? (used as Record<number, number>) : {};
  let spellSlotsUsed = Array.isArray(c.spellSlotsUsed) ? c.spellSlotsUsed : Array(9).fill(0);
  let pactSlotsUsed = c.pactSlotsUsed;
  if (typeof pactSlotsUsed !== 'number') {
    pactSlotsUsed = 0;
    if (!c.multiclass?.length && classById(c.classId)?.casterType === 'pact') {
      const i = pactSlotLevel(c.level ?? 1) - 1;
      pactSlotsUsed = spellSlotsUsed[i] ?? 0;
      spellSlotsUsed = Array(9).fill(0);
    }
  }
  return {
    ...c,
    hitDiceUsed,
    spellSlotsUsed,
    pactSlotsUsed,
    customSpells: Array.isArray(c.customSpells) ? c.customSpells : [],
    xp: typeof c.xp === 'number' ? c.xp : XP_TABLE[Math.max(1, Math.min(20, c.level ?? 1))],
    inspiration: c.inspiration ?? false,
    notes,
    inventory,
    combat: c.combat ?? newCombat(),
    languages: Array.isArray(c.languages) ? c.languages : ['common'],
    tools: Array.isArray(c.tools) ? c.tools : [],
    featureUses: c.featureUses ?? {},
    feats: Array.isArray(c.feats) ? c.feats : [],
    levelHistory: Array.isArray(c.levelHistory) ? c.levelHistory : [],
  };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      characters: [],
      activeId: null,
      theme: null,
      lastRoll: null,
      add: (c) => set((s) => ({ characters: [...s.characters, c], activeId: c.id })),
      update: (id, fn) =>
        set((s) => ({ characters: s.characters.map((c) => (c.id === id ? { ...fn(c), updatedAt: Date.now() } : c)) })),
      remove: (id) =>
        set((s) => {
          const characters = s.characters.filter((c) => c.id !== id);
          return { characters, activeId: s.activeId === id ? (characters[0]?.id ?? null) : s.activeId };
        }),
      select: (id) => set({ activeId: id }),
      setTheme: (theme) => set({ theme }),
      importMany: (list) => {
        const valid = list.filter((c) => c && typeof c.name === 'string' && c.abilities && c.hp).map(migrateCharacter);
        const existing = new Set(get().characters.map((c) => c.id));
        const fixed = valid.map((c) => (existing.has(c.id) ? { ...c, id: uid() } : c));
        set((s) => ({ characters: [...s.characters, ...fixed], activeId: s.activeId ?? fixed[0]?.id ?? null }));
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
          label: opts.mode && opts.mode !== 'normal' ? `${label} (${opts.mode === 'advantage' ? 'advantage' : 'disadvantage'})` : label,
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
        return { ...entry, result: r };
      },
    }),
    {
      name: 'dnd-assist',
      version: 6,
      partialize: (s) => ({ characters: s.characters, activeId: s.activeId, theme: s.theme }),
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as { characters?: unknown[]; activeId?: string | null; theme?: Theme | null };
        const characters = (p.characters ?? []).map(migrateCharacter);
        return {
          characters,
          activeId: version < 2 ? (characters[0]?.id ?? null) : (p.activeId ?? characters[0]?.id ?? null),
          theme: p.theme ?? null,
        } as Partial<State> as State;
      },
    },
  ),
);

/** The character being played, or undefined when there are none. */
export const useActive = () =>
  useStore((s) => s.characters.find((c) => c.id === s.activeId) ?? s.characters[0]);
