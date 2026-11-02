import type { RollResult } from '../rules/dice';
import type { RollOutcome } from '../store/characters';
import type { Face, RollPopup } from './RollOverlay';
import { facesOf } from './RollOverlay';

export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
export const ordinal = (n: number) => (n === 0 ? 'Cantrip' : n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "1d8+3" → "1d8 + 3" for display. */
export const prettyExpr = (e: string) => e.replace(/([+-])/g, ' $1 ').replace(/\s+/g, ' ').trim();

/** Strips the light markdown used in SRD text. */
export const stripMd = (s: string) => s.replace(/\*\*|__|\*|_/g, '').replace(/\s*\n+\s*/g, ' ').trim();

/** First sentences of a text, up to roughly `max` characters. */
export function excerpt(s: string, max = 200): string {
  const t = stripMd(s);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = cut.lastIndexOf('. ');
  return end > 60 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}

/** "d20 (12, 17 → 17) + 7" style breakdown of a roll. */
export function calcText(r: RollResult): string {
  return r.terms
    .map((t, i) => {
      const sign = t.term.sign < 0 ? '- ' : i > 0 ? '+ ' : '';
      if (t.term.kind === 'const') return `${sign}${t.term.value}`;
      const count = t.term.keep ? '' : t.term.count > 1 ? t.term.count : '';
      const kept = t.term.keep ? ` → ${t.kept.join(', ')}` : '';
      return `${sign}${count}d${t.term.sides} (${t.rolls.join(', ')}${kept})`;
    })
    .join(' ');
}

/** Turns a logged roll into the pop-up and the faces to tumble. */
export function popupFromRoll(r: RollOutcome, title: string, extra: Partial<RollPopup> = {}): [RollPopup, Face[]] {
  const nat = r.result.natural;
  const tone = nat === 20 ? 'crit' : nat === 1 ? 'fumble' : undefined;
  return [
    {
      total: r.total,
      title,
      calc: `${calcText(r.result)} = ${r.total}`,
      tone,
      tag: tone === 'crit' ? 'Natural 20' : tone === 'fumble' ? 'Natural 1' : undefined,
      ...extra,
    },
    facesOf(r.result),
  ];
}

export const timeAgo = (t: number) => {
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};
