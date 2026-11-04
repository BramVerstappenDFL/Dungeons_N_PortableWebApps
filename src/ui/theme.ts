import { useEffect, useState } from 'react';
import { useStore, type Theme } from '../store/characters';

const query = () => window.matchMedia?.('(prefers-color-scheme: dark)');

/** The theme in use: the saved choice, else the system colour scheme (dark = Dungeon). */
export function useTheme(): Theme {
  const chosen = useStore((s) => s.theme);
  const [dark, setDark] = useState(() => query()?.matches ?? false);
  useEffect(() => {
    const q = query();
    if (!q) return;
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return chosen ?? (dark ? 'dungeon' : 'parchment');
}

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
