export type RollMode = 'normal' | 'advantage' | 'disadvantage';

export interface DiceTerm { kind: 'dice'; sign: 1 | -1; count: number; sides: number; keep?: 'h' | 'l'; keepN?: number }
export interface ConstTerm { kind: 'const'; sign: 1 | -1; value: number }
export type Term = DiceTerm | ConstTerm;

export interface TermResult { term: Term; rolls: number[]; kept: number[]; subtotal: number }
export interface RollResult {
  expression: string;
  total: number;
  terms: TermResult[];
  detail: string;
  natural?: number; // the kept d20 face for single-d20 rolls
}

export type Rng = () => number;
let rng: Rng = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
};
/** Swap the random source (used by tests). */
export function setRng(fn: Rng) { rng = fn; }

export const rollDie = (sides: number) => Math.floor(rng() * sides) + 1;

const TERM_RE = /([+-]?)\s*(?:(\d*)d(\d+)(?:k([hl])(\d+))?|(\d+))/giy;

/** Parses expressions like "2d6+3", "d20 - 1", "4d6kh3", "1d8+1d6+2". */
export function parseExpression(input: string): Term[] {
  if (/[\dd]\s+\d/i.test(input)) throw new Error(`Invalid expression: ${input}`);
  const src = input.replace(/\s+/g, '').toLowerCase();
  if (!src) throw new Error('Empty expression');
  const terms: Term[] = [];
  TERM_RE.lastIndex = 0;
  let pos = 0;
  while (pos < src.length) {
    TERM_RE.lastIndex = pos;
    const m = TERM_RE.exec(src);
    if (!m || m.index !== pos || (terms.length > 0 && !m[1])) throw new Error(`Invalid expression: ${input}`);
    const sign = m[1] === '-' ? -1 : 1;
    if (m[3]) {
      const count = m[2] ? Number(m[2]) : 1;
      const sides = Number(m[3]);
      if (count < 1 || count > 100 || sides < 1 || sides > 1000) throw new Error('Dice out of range');
      const t: DiceTerm = { kind: 'dice', sign, count, sides };
      if (m[4]) { t.keep = m[4] as 'h' | 'l'; t.keepN = Math.min(Number(m[5]), count); }
      terms.push(t);
    } else {
      terms.push({ kind: 'const', sign, value: Number(m[6]) });
    }
    pos = TERM_RE.lastIndex;
  }
  return terms;
}

export function formatTerms(terms: Term[]): string {
  return terms
    .map((t, i) => {
      const s = t.sign < 0 ? '-' : i > 0 ? '+' : '';
      if (t.kind === 'const') return `${s}${t.value}`;
      return `${s}${t.count}d${t.sides}${t.keep ? `k${t.keep}${t.keepN}` : ''}`;
    })
    .join('');
}

/**
 * Rolls an expression. With advantage/disadvantage, the first d20 term is rolled
 * twice and the higher/lower result kept (per 5e rules).
 */
export function roll(expression: string, mode: RollMode = 'normal'): RollResult {
  let terms = parseExpression(expression);
  if (mode !== 'normal') {
    const idx = terms.findIndex((t) => t.kind === 'dice' && t.sides === 20 && t.count === 1 && !t.keep);
    if (idx >= 0) {
      terms = terms.map((t, i) => (i === idx ? { ...(t as DiceTerm), count: 2, keep: mode === 'advantage' ? 'h' : 'l', keepN: 1 } : t));
    }
  }
  const results: TermResult[] = terms.map((term) => {
    if (term.kind === 'const') return { term, rolls: [], kept: [], subtotal: term.sign * term.value };
    const rolls = Array.from({ length: term.count }, () => rollDie(term.sides));
    let kept = rolls;
    if (term.keep && term.keepN != null) {
      const sorted = [...rolls].sort((a, b) => (term.keep === 'h' ? b - a : a - b));
      kept = sorted.slice(0, term.keepN);
    }
    return { term, rolls, kept, subtotal: term.sign * kept.reduce((a, b) => a + b, 0) };
  });
  const total = results.reduce((a, r) => a + r.subtotal, 0);
  const detail = results
    .map((r, i) => {
      const s = r.term.sign < 0 ? '− ' : i > 0 ? '+ ' : '';
      if (r.term.kind === 'const') return `${s}${r.term.value}`;
      const shown = r.term.keep ? r.rolls.map((v) => (r.kept.includes(v) ? `${v}` : `~${v}~`)) : r.rolls.map(String);
      return `${s}[${shown.join(', ')}]`;
    })
    .join(' ');
  const d20s = results.filter((r) => r.term.kind === 'dice' && r.term.sides === 20 && r.kept.length === 1);
  return { expression: formatTerms(terms), total, terms: results, detail, natural: d20s.length === 1 ? d20s[0].kept[0] : undefined };
}

/** Builds "1d20+5" style strings from a modifier. */
export const d20With = (mod: number) => `1d20${mod >= 0 ? '+' : ''}${mod}`;
export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
