import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from './theme';

/** Counts a number from its previous value (or `from`) to `value` over `ms`, easing out. */
export function useTicker(value: number, ms = 420, from?: number): number {
  const [shown, setShown] = useState(from ?? value);
  const last = useRef(from ?? value);
  useEffect(() => {
    const start = last.current;
    if (start === value || reducedMotion()) { last.current = value; setShown(value); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(start + (value - start) * eased);
      setShown(v);
      last.current = v;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}
