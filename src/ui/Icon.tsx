import type { CSSProperties } from 'react';

/** Stroke icons from the design (24×24, drawn with the Grimoire .gr-ico style). */
export const ICONS = {
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12l5 5 9-10',
  chevDown: 'M6 9l6 6 6-6',
  chevUp: 'M6 15l6-6 6 6',
  info: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v6M12 7v1',
  alert: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v6M12 16v1',
  sparkle: 'M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2zM19 3v4M17 5h4',
  flame: 'M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 1 2 2 2 3 1-1-2 0-4 0-6z',
  moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
  heart: 'M12 20 4 12a4.5 4.5 0 0 1 8-5 4.5 4.5 0 0 1 8 5z',
  shield: 'M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  person: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21c1-4 4-6 8-6s7 2 8 6',
  swords: 'M4 4l10 10M4 4h4M4 4v4M20 4 10 14M20 4h-4M20 4v4M6 14l4 4M18 14l-4 4M4 20l3-3M20 20l-3-3',
  d20: 'M12 2 21 7v10l-9 5-9-5V7zM12 7l5 9H7z',
  pack: 'M5 8h14v13H5zM9 8V4h6v4M9 13h6',
  notes: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h3',
  search: 'M11 5a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM16 16l4 4',
  star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  clock: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v5l3 2',
  book: 'M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, d, style, label }: { name?: IconName; d?: string; style?: CSSProperties; label?: string }) {
  return (
    <svg className="gr-ico" viewBox="0 0 24 24" style={style} aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      <path d={d ?? ICONS[name!]} />
    </svg>
  );
}
