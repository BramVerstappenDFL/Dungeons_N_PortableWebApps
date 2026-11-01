import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './Icon';

export const CELLS = 20;

export function hpState(current: number, max: number): { word: string; cls: string } {
  const ratio = max > 0 ? current / max : 0;
  if (current <= 0) return { word: 'Down', cls: 'is-down' };
  if (ratio <= 0.25) return { word: 'Critical', cls: 'is-critical' };
  if (ratio <= 0.5) return { word: 'Bloodied', cls: 'is-bloodied' };
  return { word: 'Healthy', cls: 'is-healthy' };
}

/** Cells lit for HP and for temp HP after them. */
export function cellSpan(current: number, temp: number, max: number) {
  const on = max > 0 ? Math.round((current / max) * CELLS) : 0;
  return { on, end: on + Math.min(CELLS - on, max > 0 ? Math.round((temp / max) * CELLS) : 0) };
}

export interface Cell { cls: string; d?: number }

/** The Grimoire 20-cell hit point bar. */
export function HpCells({ current, max, temp, cells, extraClass = '', children }: {
  current: number; max: number; temp: number; cells?: Cell[]; extraClass?: string; children?: ReactNode;
}) {
  const { word, cls } = hpState(current, max);
  const { on, end } = cellSpan(current, temp, max);
  const list: Cell[] = cells ?? Array.from({ length: CELLS }, (_, i) => ({ cls: i < on ? 'on' : i < end ? 'tmp' : '' }));
  return (
    <div className={`gr-hp ${cls} ${extraClass}`} style={{ width: '100%' }}>
      {children}
      <div className="gr-hp__cells">
        {list.map((c, i) => <span key={i} className={c.cls} style={{ '--d': c.d ?? 0 } as CSSProperties} />)}
      </div>
      <div className="gr-hp__head">
        <span className="gr-hp__num">{max > 0 ? Math.round((current / max) * 100) : 0}%</span>
        <span className="gr-hp__state"><Icon name={current > 0 ? 'heart' : 'alert'} />{word}</span>
      </div>
    </div>
  );
}
