import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Character } from '../types';
import { useStore } from '../store/characters';
import { derive } from '../rules/derived';
import { maxSpellLevel } from '../rules/slots';
import { Icon } from '../ui/Icon';
import { useSpells } from '../ui/useSpells';
import { cap, excerpt, ordinal } from '../ui/format';

const css = `
.sprow { display: grid; grid-template-columns: 44px 1fr auto; align-items: center; gap: 8px; padding: 8px 10px 8px 6px; border-top: 2px solid var(--ink); }
.sprow:first-child { border-top: 0; }
.sprow.open { background: color-mix(in srgb, var(--ink) 5%, transparent); }
.spname { font: inherit; font-weight: 700; color: var(--ink); background: none; border: 0; padding: 0; text-align: left; cursor: pointer; }
.spdesc { grid-column: 2 / 4; font-size: 14.5px; line-height: 1.45; margin: 0; }
`;

/** Learn cantrips and spells for the class, and choose which are prepared today. */
export function SpellBookScreen({ c }: { c: Character }) {
  const update = useStore((s) => s.update);
  const spells = useSpells();
  const d = derive(c);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<number | null>(null);
  const [mine, setMine] = useState(c.spells.length > 0);
  const [open, setOpen] = useState<string | null>(null);
  const top = Math.max(1, maxSpellLevel(d.cls?.casterType ?? 'none', c.level));
  const has = (id: string) => c.spells.find((s) => s.id === id);

  const q = query.trim().toLowerCase();
  const list = (spells ?? [])
    .filter((s) => (mine ? !!has(s.id) : (s.classes.includes(c.classId) || !d.cls?.spellAbility) && s.level <= top))
    .filter((s) => level === null || s.level === level)
    .filter((s) => !q || s.name.toLowerCase().includes(q))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  const toggleKnown = (id: string) => update(c.id, (x) => ({
    ...x, spells: x.spells.some((s) => s.id === id) ? x.spells.filter((s) => s.id !== id) : [...x.spells, { id, prepared: true }],
  }));
  const togglePrepared = (id: string) => update(c.id, (x) => ({ ...x, spells: x.spells.map((s) => (s.id === id ? { ...s, prepared: !s.prepared } : s)) }));
  const prepared = c.spells.filter((s) => s.prepared).length;

  return (
    <div className="screen">
      <style>{css}</style>
      <header className="hdr" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div className="row" style={{ gap: 12 }}>
          <Link to="/" className="gr-btn gr-btn--secondary gr-btn--icon ico-btn" aria-label="Back to sheet"><Icon name="back" /></Link>
          <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <h1 className="sub" style={{ margin: 0, font: '600 22px/1.15 var(--font-heading)' }}>Spellbook</h1>
            <span className="muted">{c.spells.length} known · {prepared} prepared · up to {ordinal(top)} level</span>
          </div>
        </div>
        <div className="gr-search">
          <Icon name="search" />
          <input className="gr-input" style={{ height: 44 }} type="search" aria-label="Search spells" placeholder={`Search ${d.cls?.name ?? ''} spells`} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </header>

      <main className="scroll" style={{ padding: 16, gap: 14 }}>
        <div className="seg" role="group" aria-label="Which spells">
          <button className={mine ? 'segbtn is-on' : 'segbtn'} aria-pressed={mine} onClick={() => setMine(true)}>My spells</button>
          <button className={!mine ? 'segbtn is-on' : 'segbtn'} aria-pressed={!mine} onClick={() => setMine(false)}>{d.cls?.name ?? 'All'} list</button>
        </div>
        <div className="chips" role="group" aria-label="Spell level">
          {[null, ...Array.from({ length: top + 1 }, (_, i) => i)].map((l) => (
            <button key={String(l)} className={`gr-chip filter${level === l ? ' is-on' : ''}`} aria-pressed={level === l} onClick={() => setLevel(l)}>
              {l === null ? 'All' : l === 0 ? 'Cantrips' : ordinal(l)}
            </button>
          ))}
        </div>

        {!spells ? <div className="muted empty-line">Loading spells…</div> : list.length ? (
          <div className="panel">
            {list.map((s) => {
              const k = has(s.id);
              return (
                <div key={s.id} className={`sprow${open === s.id ? ' open' : ''}`}>
                  <button className={k ? 'eq on' : 'eq'} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--ink)' }}
                    onClick={() => toggleKnown(s.id)} aria-pressed={!!k} aria-label={`${k ? 'Forget' : 'Learn'} ${s.name}`}>
                    <span style={{ width: 22, height: 22, boxSizing: 'border-box', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: k ? 'var(--accent)' : 'var(--paper)', color: 'var(--on-accent)' }}>
                      {k && <Icon name="check" style={{ width: 14, height: 14, strokeWidth: 3 }} />}
                    </span>
                  </button>
                  <div className="col" style={{ gap: 2, minWidth: 0 }}>
                    <button className="spname" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>{s.name}</button>
                    <span className="muted">{ordinal(s.level)} · {cap(s.school)} · {s.castingTime}{s.concentration ? ' · C' : ''}{s.ritual ? ' · R' : ''}</span>
                  </div>
                  {k && s.level > 0 ? (
                    <button className={`gr-chip filter${k.prepared ? ' is-on' : ''}`} aria-pressed={k.prepared} onClick={() => togglePrepared(s.id)}>Prepared</button>
                  ) : <span />}
                  {open === s.id && <p className="spdesc">{s.range} · {s.duration} · {s.components}. {excerpt(s.description, 600)}</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="gr-notice gr-empty">
            <Icon name="book" />
            <b>{mine ? 'No spells yet' : 'No spells match'}</b>
            <span>{mine ? `Open the ${d.cls?.name ?? 'class'} list and tick spells to learn them.` : 'Try another level or search.'}</span>
            {mine && <button className="gr-btn gr-btn--secondary gr-btn--small" onClick={() => setMine(false)}>Open {d.cls?.name ?? 'class'} list</button>}
          </div>
        )}
        <span className="muted">Tick a spell to learn it. Prepared spells and cantrips show on the sheet and in combat. Tap a name for details.</span>
      </main>
    </div>
  );
}
