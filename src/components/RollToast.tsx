import { useEffect } from 'react';
import { useStore } from '../store/characters';

/** Shows the most recent roll result; auto-dismisses. */
export function RollToast() {
  const last = useStore((s) => s.lastRoll);
  const clear = useStore((s) => s.clearLastRoll);
  useEffect(() => {
    if (!last) return;
    const t = setTimeout(clear, 5000);
    return () => clearTimeout(t);
  }, [last, clear]);
  if (!last) return null;
  return (
    <button key={last.id} className={`roll-toast ${last.crit ?? ''}`} onClick={clear} aria-live="polite">
      <span className="roll-toast-label">{last.label}</span>
      <span className="roll-toast-total">{last.total}</span>
      <span className="roll-toast-detail">
        {last.expression} · {last.detail.replace(/~(\d+)~/g, '($1)')}
        {last.crit === 'hit' && ' · Natural 20!'}
        {last.crit === 'miss' && ' · Natural 1'}
      </span>
    </button>
  );
}
