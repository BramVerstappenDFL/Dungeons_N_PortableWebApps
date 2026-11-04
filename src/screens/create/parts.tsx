import type { CSSProperties, ReactNode } from 'react';
import type { Source, StartingKit } from '../../types';
import { signed } from '../../ui/format';
import { useTicker } from '../../ui/motion';
import { Icon } from '../../ui/Icon';

/** Six progress seals; reached steps can be tapped to go back. */
export function SealProgress({ steps, step, reached, onJump }: { steps: string[]; step: number; reached: number; onJump: (i: number) => void }) {
  return (
    <ol className="seals" aria-label="Steps">
      {steps.map((s, i) => {
        const state = i < step ? 'done' : i === step ? 'now' : 'todo';
        return (
          <li key={s}>
            <button className={`seal seal--${state}`} disabled={i > reached || i === step} onClick={() => onJump(i)}
              aria-current={i === step ? 'step' : undefined} aria-label={`${s}${state === 'done' ? ', done' : ''}`}>
              <i />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** A number that ticks to its new value and flashes gilt when it changes. */
export function Tick({ value, sign, from, className, style }: { value: number; sign?: boolean; from?: number; className?: string; style?: CSSProperties }) {
  const v = useTicker(value, 420, from);
  return <span key={value} className={`num tick ${className ?? ''}`} style={style}>{sign ? signed(v) : v}</span>;
}

export const SourceTag = ({ source }: { source?: Source }) =>
  source === 'PHB 2024' ? <span className="gr-tag src-tag" title="Name and mechanics only; see the Player's Handbook for the rules text">PHB</span> : null;

/** An expanding row: the head picks it, the body opens while it is picked. */
export function OriginRow({ on, index, title, meta, tincture, onPick, children, source }: {
  on: boolean; index: number; title: string; meta: ReactNode; tincture: number; source?: Source;
  onPick: () => void; children: ReactNode;
}) {
  return (
    <div className={on ? 'orow is-on rise' : 'orow rise'} style={{ '--i': index, '--tincture': `var(--tincture-${(tincture % 6) + 1})` } as CSSProperties}>
      <button className="orow__head" onClick={onPick} aria-expanded={on}>
        <i className="orow__pip" />
        <span className="orow__name">{title}<SourceTag source={source} /></span>
        <span className="muted orow__meta">{meta}</span>
      </button>
      <div className="orow__body" aria-hidden={!on}>
        <div className="orow__inner">{on && children}</div>
      </div>
    </div>
  );
}

/** "2 × Dagger, Robe, … · 5 GP" for a starting kit. */
export function kitSummary(k: StartingKit): string {
  const items = k.items.map((i) => (i.qty > 1 ? `${i.qty} × ${i.name}` : i.name)).join(', ');
  return items ? `${items} · ${k.gp} GP` : `${k.gp} GP to spend`;
}

export function KitPicker({ label, kits, value, onPick }: { label: string; kits: StartingKit[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      <span className="gr-label">{label}</span>
      <div className="col" role="radiogroup" aria-label={label} style={{ gap: 10 }}>
        {kits.map((k, i) => (
          <button key={k.id} role="radio" aria-checked={k.id === value} className={k.id === value ? 'kit is-on rise' : 'kit rise'}
            style={{ '--i': i } as CSSProperties} onClick={() => onPick(k.id)}>
            <span className="kit__badge num">{k.id.toUpperCase()}</span>
            <span className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 700 }}>{k.items.length ? `Kit ${k.id.toUpperCase()}` : 'Gold only'}</span>
              <span className="muted">{kitSummary(k)}</span>
            </span>
            {k.id === value && <Icon name="check" style={{ color: 'var(--accent)' }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The wax seal stamped on the review and on creation. */
export const WaxSeal = ({ className }: { className?: string }) => (
  <span className={`wax ${className ?? ''}`} aria-hidden="true"><Icon name="sparkle" /></span>
);
