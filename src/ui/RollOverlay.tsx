import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { RollResult } from '../rules/dice';
import { reducedMotion } from './theme';

export interface RollPopup {
  kicker?: string;
  total: number | string;
  title: string;
  calc: string;
  tag?: string;
  tone?: 'crit' | 'fumble';
}
export interface Face { n: number; v: number }

const SHAPES: Record<number, string> = {
  4: 'M12 3 21 20H3z', 6: 'M4 4h16v16H4z', 8: 'M12 2 21 12 12 22 3 12z', 10: 'M12 2 21 10 12 22 3 10z',
  12: 'M12 2 22 9.5 18 21H6L2 9.5z', 20: 'M12 2 21 7v10l-9 5-9-5V7z', 100: 'M12 2 21 10 12 22 3 10z',
};

/** Faces to tumble for a roll: d20s first, then the other dice (kept values). */
export function facesOf(r: RollResult): Face[] {
  const out: Face[] = [];
  for (const t of r.terms) {
    if (t.term.kind !== 'dice') continue;
    const vals = t.term.keep ? t.kept : t.rolls;
    for (const v of vals) out.push({ n: t.term.sides, v });
  }
  return out.sort((a, b) => (b.n === 20 ? 1 : 0) - (a.n === 20 ? 1 : 0));
}

interface Tumbler { n: number; final: number; d: string; face: number; dl: number; vars: Record<string, string> }

/** Tumbling dice and the result pop-up used by the Dice and Combat screens. */
export function useRollOverlay() {
  const [rolling, setRolling] = useState<Tumbler[] | null>(null);
  const [popup, setPopup] = useState<RollPopup | null>(null);
  const timers = useRef<number[]>([]);
  const flick = useRef<number>();
  const stop = () => { clearInterval(flick.current); timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => stop, []);
  const stageRef = useRef<HTMLDivElement>(null);

  const show = useCallback((res: RollPopup, faces: Face[]) => {
    stop();
    setPopup(null);
    if (reducedMotion() || !faces.length) { setRolling(null); setPopup(res); return; }
    const w = stageRef.current?.parentElement?.clientWidth ?? 390;
    const h = stageRef.current?.parentElement?.clientHeight ?? 844;
    const cx = w / 2 - 42;
    const R = (a: number, b: number) => Math.round(a + Math.random() * (b - a));
    const shown = faces.slice(0, 3);
    const spread = shown.length === 1 ? [0] : shown.length === 2 ? [-56, 56] : [-96, 0, 96];
    const tumble = shown.map((f, i) => {
      const fromLeft = i % 2 === 0;
      const x1 = cx + spread[i], y1 = R(h * 0.36, h * 0.42);
      const spin = (fromLeft ? 1 : -1) * R(540, 900);
      const px = (v: number) => `${Math.round(v)}px`;
      return {
        n: f.n, final: f.v, d: SHAPES[f.n] ?? SHAPES[20], face: R(1, f.n), dl: i * 70,
        vars: {
          '--x0': px(fromLeft ? -90 : w + 10), '--y0': px(R(h * 0.66, h * 0.8)),
          '--xm': px(x1 + (fromLeft ? -70 : 70)), '--ym': px(y1 - R(120, 180)),
          '--xb': px(x1 + (fromLeft ? -24 : 24)), '--yb': px(y1 + 10),
          '--x1': px(x1), '--y1': px(y1),
          '--r1': `${Math.round(spin * 0.55)}deg`, '--r2': `${Math.round(spin * 0.8)}deg`,
          '--r3': `${Math.round(spin * 0.95)}deg`, '--r4': `${spin + R(-8, 8)}deg`,
        },
      };
    });
    setRolling(tumble);
    flick.current = window.setInterval(() => {
      setRolling((st) => st && st.map((t) => ({ ...t, face: 1 + Math.floor(Math.random() * t.n) })));
    }, 70);
    timers.current.push(window.setTimeout(() => {
      clearInterval(flick.current);
      setRolling((st) => st && st.map((t) => ({ ...t, face: t.final })));
    }, 820));
    timers.current.push(window.setTimeout(() => { setRolling(null); setPopup(res); }, 1250));
  }, []);

  const dismiss = () => setPopup(null);
  const cls = `gr-roll pop-card${popup?.tone ? ` gr-roll--${popup.tone}` : ''}`;
  const overlay = (
    <>
      <div ref={stageRef} className="roll-stage" aria-hidden="true" style={{ display: rolling ? undefined : 'none' }}>
        {rolling?.map((t, i) => (
          <div key={i} className="tumbler" style={{ ...t.vars, animationDelay: `${t.dl}ms` } as CSSProperties}>
            <svg className="tumbler__shape" viewBox="0 0 24 24"><path d={t.d} /></svg>
            <span className="tumbler__face">{t.face}</span>
          </div>
        ))}
      </div>
      {popup && (
        <div className="pop-backdrop">
          <button className="pop-dismiss" aria-label="Close result" tabIndex={-1} onClick={dismiss} />
          <section className={cls} role="dialog" aria-modal="true" aria-label="Roll result" aria-live="assertive">
            {popup.kicker && <span className="pop-label">{popup.kicker}</span>}
            <span className="gr-roll__total pop-total">{popup.total}</span>
            <span className="gr-roll__title" style={{ fontSize: 19 }}>{popup.title}</span>
            <span className="gr-roll__calc">{popup.calc}</span>
            {popup.tag && <span className="gr-tag">{popup.tag}</span>}
            <button className="gr-btn gr-btn--secondary" style={{ width: '100%', height: 44, marginTop: 4 }} onClick={dismiss} autoFocus>Done</button>
          </section>
        </div>
      )}
    </>
  );
  return { show, overlay, busy: !!rolling };
}
