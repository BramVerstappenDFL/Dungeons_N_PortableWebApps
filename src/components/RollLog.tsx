import type { RollLogEntry } from '../types';

export function RollLog({ entries, onClear }: { entries: RollLogEntry[]; onClear?: () => void }) {
  if (!entries.length) return <p className="muted">No rolls yet.</p>;
  return (
    <div>
      <ul className="roll-log">
        {entries.map((e) => (
          <li key={e.id} className={e.crit ?? ''}>
            <div>
              <div className="roll-log-label">{e.label}</div>
              <div className="muted small">
                {e.expression} · {e.detail.replace(/~(\d+)~/g, '($1)')} · {new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <strong className="roll-log-total">{e.total}</strong>
          </li>
        ))}
      </ul>
      {onClear && <button className="btn btn-ghost small" onClick={onClear}>Clear history</button>}
    </div>
  );
}
