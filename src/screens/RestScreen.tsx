import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { Character } from '../types';
import { useStore } from '../store/characters';
import { derive } from '../rules/derived';
import { longRest } from '../rules/rest';
import { Icon } from '../ui/Icon';
import { reducedMotion } from '../ui/theme';
import './rest.css';

interface Row { label: string; note: string; from: string; to: string }

const STARS = [[12, 14], [28, 8], [46, 18], [64, 10], [82, 16], [90, 30], [8, 34], [20, 62], [76, 58], [88, 74], [36, 80], [58, 86], [14, 88], [70, 36]];

/** What a long rest changes, from the character before and after. */
function restRows(before: Character, after: Character): Row[] {
  const d = derive(before);
  const rows: Row[] = [
    { label: 'Hit points', note: 'Restored to full', from: `${before.hp.current}`, to: `${after.hp.current}` },
  ];
  const slotMax = d.slotsMax.reduce((a, b) => a + b, 0);
  if (slotMax > 0) {
    const avail = (c: Character) => d.slotsMax.reduce((t, m, i) => t + Math.max(0, m - c.spellSlotsUsed[i]), 0);
    rows.push({ label: 'Spell slots', note: 'Every level refills', from: `${avail(before)} / ${slotMax}`, to: `${avail(after)} / ${slotMax}` });
  }
  rows.push({ label: 'Hit dice', note: 'Regain all spent Hit Dice', from: `${before.level - before.hitDiceUsed} / ${before.level}`, to: `${after.level - after.hitDiceUsed} / ${after.level}` });
  rows.push({ label: 'Exhaustion', note: 'Drops by one level', from: `${before.exhaustion}`, to: `${after.exhaustion}` });
  if (before.hp.temp > 0) rows.push({ label: 'Temporary HP', note: 'They fade', from: `${before.hp.temp}`, to: '0' });
  if (before.concentration) rows.push({ label: 'Concentration', note: 'Ends when you sleep', from: 'On', to: 'Off' });
  for (const f of d.origin.features) {
    const used = before.featureUses?.[f.id] ?? 0;
    if (f.uses && used > 0) rows.push({ label: f.name, note: 'Uses come back', from: `${f.uses.max - used} / ${f.uses.max}`, to: `${f.uses.max} / ${f.uses.max}` });
  }
  const freeCasts = Object.keys(before.featureUses ?? {}).filter((k) => k.startsWith('free-') && before.featureUses![k] > 0).length;
  if (freeCasts) rows.push({ label: 'Free casts', note: 'Feat and lineage spells', from: 'Used', to: 'Ready' });
  if (!before.inspiration && after.inspiration) rows.push({ label: 'Heroic Inspiration', note: 'Resourceful', from: 'None', to: 'Yes' });
  if (before.deathSaves.successes || before.deathSaves.failures) rows.push({ label: 'Death saves', note: 'Reset', from: `${before.deathSaves.successes}✓ ${before.deathSaves.failures}✗`, to: '0' });
  return rows;
}

export function RestScreen({ c }: { c: Character }) {
  const update = useStore((s) => s.update);
  const [phase, setPhase] = useState<'idle' | 'night' | 'dawn' | 'done'>('idle');
  const [hour, setHour] = useState(0);
  const [animate, setAnimate] = useState(false);
  const snapshot = useRef<Character | null>(null);
  const [rows, setRows] = useState<Row[]>(() => restRows(c, longRest(c)));
  const timers = useRef<number[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const done = phase === 'dawn' || phase === 'done';

  // Keep the preview current while idle (e.g. after damage elsewhere).
  useEffect(() => { if (phase === 'idle') setRows(restRows(c, longRest(c))); }, [c, phase]);

  const finish = () => {
    snapshot.current = c;
    setRows(restRows(c, longRest(c)));
    update(c.id, longRest);
  };
  const start = () => {
    clear();
    if (reducedMotion()) { finish(); setPhase('done'); return; }
    setPhase('night'); setHour(0);
    for (let h = 1; h <= 8; h++) later(() => setHour(h), 500 + h * 190);
    const dawn = 500 + 8 * 190 + 250;
    later(() => { finish(); setPhase('dawn'); setAnimate(true); }, dawn);
    later(() => setPhase('done'), dawn + 1000);
    later(() => setAnimate(false), dawn + 2200);
  };
  const undo = () => {
    clear();
    const before = snapshot.current;
    if (before) update(c.id, (x) => ({ ...before, rollLog: x.rollLog, notes: x.notes, inventory: x.inventory }));
    snapshot.current = null;
    setPhase('idle'); setHour(0); setAnimate(false);
  };

  return (
    <div className="screen">
      <header className="hdr">
        <Link to="/" className="gr-btn gr-btn--secondary gr-btn--icon ico-btn" aria-label="Back to sheet"><Icon name="back" /></Link>
        <h1 className="sub">Long rest</h1>
      </header>

      <main className="scroll gr-desk" style={{ padding: '20px 16px 24px', gap: 16 }}>
        <div className="col" style={{ alignItems: 'center', gap: 10, padding: '8px 0 4px', textAlign: 'center' }}>
          {done ? (
            <div className={`restbadge ${animate ? 'sun-in' : ''}`} style={{ background: 'var(--gilt)', color: 'var(--on-gilt)' }}><Icon name="sun" /></div>
          ) : (
            <div className="restbadge"><Icon name="moon" /></div>
          )}
          <h2 style={{ margin: 0, font: '600 26px/1.15 var(--font-heading)' }}>{done ? 'Rested and ready' : 'Rest for 8 hours'}</h2>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: 'var(--text-muted)', maxWidth: 300 }}>
            {done ? `${c.name} wakes with full strength and a clear mind.` : 'Sleep or keep light watch. Here is what comes back.'}
          </p>
        </div>

        <section className="gr-window" style={{ '--tincture': 'var(--tincture-5)', width: '100%' } as CSSProperties}>
          <div className="gr-window__head"><i className="gr-window__mark" /><div className="gr-window__title"><span>{done ? 'Restored' : 'What you regain'}</span></div></div>
          <div className="col">
            {rows.map((r, i) => (
              <div key={r.label} className={done ? (animate ? 'rrow done pop' : 'rrow done') : 'rrow'} style={{ '--d': i } as CSSProperties}>
                <span className="rico">
                  {done ? <Icon name="check" style={{ width: 16, height: 16 }} /> : <span className="num" style={{ fontSize: 13 }}>{i + 1}</span>}
                </span>
                <div className="col" style={{ gap: 2, minWidth: 0 }}>
                  <span style={{ fontWeight: 700 }}>{r.label}</span>
                  <span className="muted">{r.note}</span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {!done && <><span className="rfrom">{r.from}</span><Icon name="arrowRight" style={{ width: 14, height: 14, color: 'var(--text-muted)' }} /></>}
                  <span className="rto">{r.to}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {done ? (
          <div className={animate ? 'gr-notice gr-ok notice-in' : 'gr-notice gr-ok'}>
            <Icon name="check" />
            <span><b>Long rest complete</b>Your next long rest can start 16 hours after this one ends.</span>
          </div>
        ) : (
          <div className="gr-notice gr-hint">
            <Icon name="info" />
            <span>An hour or more of fighting, casting or walking interrupts the rest. Only one long rest per 24 hours.</span>
          </div>
        )}
      </main>

      <footer className="foot foot--lg" style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
        {!done ? (
          <button className="gr-btn gr-btn--primary" style={{ width: '100%', height: 52, fontSize: 17 }} onClick={start} disabled={phase === 'night'}>
            <Icon name="moon" />Take long rest
          </button>
        ) : (
          <div className="grid2">
            <button className="gr-btn gr-btn--secondary" style={{ height: 52 }} onClick={undo}>Undo</button>
            <Link to="/" className="gr-btn gr-btn--primary" style={{ height: 52 }}>Back to sheet</Link>
          </div>
        )}
      </footer>

      {(phase === 'night' || phase === 'dawn') && (
        <div className={phase === 'dawn' ? 'rest-ov is-dawn' : 'rest-ov is-night'} role="status" aria-live="polite">
          {STARS.map(([x, y], i) => <i key={i} className="star" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(i * 173) % 1200}ms` }} />)}
          <div className="ov-inner">
            <div className="ov-moon"><Icon name="moon" /></div>
            <span style={{ font: '600 26px/1.15 var(--font-heading)' }}>Resting</span>
            <div className="ov-hours" aria-hidden="true">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => <span key={h} className={h <= hour ? 'on' : ''} />)}
            </div>
            <span style={{ fontSize: 16, color: '#b8a888' }}>Hour {Math.max(1, hour)} of 8</span>
          </div>
        </div>
      )}
    </div>
  );
}
