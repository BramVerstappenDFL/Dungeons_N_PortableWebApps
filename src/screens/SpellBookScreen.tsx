import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Character, Spell } from '../types';
import { uid, useStore } from '../store/characters';
import { classById } from '../data';
import { derive } from '../rules/derived';
import { allSpells, castingFor } from '../rules/origin';
import { preparedSpells, topSpellLevel } from '../rules/classes';
import { CustomSpellSheet } from './CustomSpellSheet';
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
  const spells = useSpells(c);
  const d = derive(c);
  // Each spellcasting class has its own list; spells learned from it use that class's ability.
  const casterIds = d.castings.map((k) => k.classId).filter((id): id is string => !!id);
  const multi = d.classes.length > 1;
  const [listClass, setListClass] = useState(casterIds[0] ?? c.classId);
  const listCls = classById(listClass);
  const [editing, setEditing] = useState<Spell | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<number | null>(null);
  const mineAll = allSpells(c);
  const [mine, setMine] = useState(mineAll.length > 0);
  const [open, setOpen] = useState<string | null>(null);
  const top = Math.max(1, topSpellLevel(c));
  const has = (id: string) => mineAll.find((s) => s.id === id);

  const q = query.trim().toLowerCase();
  const list = (spells ?? [])
    .filter((s) => (mine ? !!has(s.id) : s.id.startsWith('custom-') || ((s.classes.includes(listClass) || !listCls?.spellAbility) && s.level <= top)))
    .filter((s) => level === null || s.level === level)
    .filter((s) => !q || s.name.toLowerCase().includes(q))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  const toggleKnown = (id: string) => update(c.id, (x) => ({
    ...x,
    spells: x.spells.some((s) => s.id === id)
      ? x.spells.filter((s) => s.id !== id || !!s.source)
      : [...x.spells, { id, prepared: true, ...(multi ? { classId: mine ? casterIds[0] : listClass } : {}) }],
  }));
  const saveCustom = (sp: Spell) => {
    const id = sp.id || `custom-${uid()}`;
    const spell = { ...sp, id };
    update(c.id, (x) => {
      const list = x.customSpells ?? [];
      return {
        ...x,
        customSpells: list.some((s) => s.id === id) ? list.map((s) => (s.id === id ? spell : s)) : [...list, spell],
        spells: x.spells.some((s) => s.id === id) ? x.spells : [...x.spells, { id, prepared: true, ...(multi && casterIds[0] ? { classId: casterIds[0] } : {}) }],
      };
    });
    setEditing(null);
    setMine(true);
  };
  const deleteCustom = (id: string) => {
    update(c.id, (x) => ({
      ...x, customSpells: (x.customSpells ?? []).filter((s) => s.id !== id), spells: x.spells.filter((s) => s.id !== id),
      concentration: x.concentration === id ? null : x.concentration,
    }));
    setEditing(null);
  };
  const preparedMax = d.classes.reduce((n, x) => n + preparedSpells(x.id, x.level), 0);
  const togglePrepared = (id: string) => update(c.id, (x) => ({ ...x, spells: x.spells.map((s) => (s.id === id ? { ...s, prepared: !s.prepared } : s)) }));
  // Cantrips are always ready; only levelled spells count toward the prepared limit.
  const levelOf = new Map((spells ?? []).map((s) => [s.id, s.level]));
  const prepared = mineAll.filter((s) => s.prepared && (levelOf.get(s.id) ?? 1) > 0).length;

  return (
    <div className="screen">
      <style>{css}</style>
      <header className="hdr" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div className="row" style={{ gap: 12 }}>
          <Link to="/" className="gr-btn gr-btn--secondary gr-btn--icon ico-btn" aria-label="Back to sheet"><Icon name="back" /></Link>
          <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <h1 className="sub" style={{ margin: 0, font: '600 22px/1.15 var(--font-heading)' }}>Spellbook</h1>
            <span className="muted">{mineAll.length} known · {prepared}{preparedMax ? ` of ${preparedMax + mineAll.filter((s) => s.source).length}` : ''} prepared · up to {ordinal(top)} level</span>
          </div>
        </div>
        <div className="gr-search">
          <Icon name="search" />
          <input className="gr-input" style={{ height: 44 }} type="search" aria-label="Search spells" placeholder={`Search ${mine ? 'my' : listCls?.name ?? ''} spells`} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </header>

      <main className="scroll" style={{ padding: 16, gap: 14 }}>
        <div className="seg" role="group" aria-label="Which spells">
          <button className={mine ? 'segbtn is-on' : 'segbtn'} aria-pressed={mine} onClick={() => setMine(true)}>My spells</button>
          {(casterIds.length ? casterIds : [c.classId]).map((id) => (
            <button key={id} className={!mine && listClass === id ? 'segbtn is-on' : 'segbtn'} aria-pressed={!mine && listClass === id}
              onClick={() => { setListClass(id); setMine(false); }}>{casterIds.length ? `${classById(id)?.name} list` : 'All list'}</button>
          ))}
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
                  <button className={k ? 'eq on' : 'eq'} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 0, cursor: k?.source ? 'default' : 'pointer', color: 'var(--ink)' }}
                    onClick={() => !k?.source && toggleKnown(s.id)} disabled={!!k?.source} aria-pressed={!!k} aria-label={k?.source ? `${s.name}, from your ${k.source}` : `${k ? 'Forget' : 'Learn'} ${s.name}`}>
                    <span style={{ width: 22, height: 22, boxSizing: 'border-box', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: k ? 'var(--accent)' : 'var(--paper)', color: 'var(--on-accent)' }}>
                      {k && <Icon name="check" style={{ width: 14, height: 14, strokeWidth: 3 }} />}
                    </span>
                  </button>
                  <div className="col" style={{ gap: 2, minWidth: 0 }}>
                    <button className="spname" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>{s.name}</button>
                    {(s.id.startsWith('custom-') || (multi && k && !k.source)) && (
                      <span className="muted" style={{ fontSize: 13 }}>{[s.id.startsWith('custom-') ? 'Custom' : '', multi && k && !k.source ? classById(d.classCasting(k).classId ?? '')?.name : ''].filter(Boolean).join(' · ')}</span>
                    )}
                    <span className="muted">{ordinal(s.level)} · {cap(s.school)} · {s.castingTime}{s.concentration ? ' · C' : ''}{s.ritual ? ' · R' : ''}</span>
                  </div>
                  {k?.source ? (
                    <span className="gr-tag gr-tag--gilt" title={`Always prepared; ${castingFor(c, k, d.spellAbility).ability.toUpperCase()} DC ${castingFor(c, k, d.spellAbility).dc}`}>{k.source === 'lineage' ? 'Lineage' : 'Feat'}</span>
                  ) : k && s.level > 0 ? (
                    <button className={`gr-chip filter${k.prepared ? ' is-on' : ''}`} aria-pressed={k.prepared} onClick={() => togglePrepared(s.id)}>Prepared</button>
                  ) : <span />}
                  {open === s.id && (
                    <div className="spdesc col" style={{ gap: 8 }}>
                      <p style={{ margin: 0 }}>{s.range} · {s.duration} · {s.components}. {excerpt(s.description, 600)}</p>
                      {(s.id.startsWith('custom-') || (k && !k.source && d.castings.length > 1)) && (
                        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                          {k && !k.source && d.castings.length > 1 && (
                            <select className="gr-input gr-select" style={{ height: 40, width: 'auto' }} aria-label={`Cast ${s.name} as`} value={d.classCasting(k).classId ?? ''}
                              onChange={(e) => update(c.id, (x) => ({ ...x, spells: x.spells.map((y) => (y.id === s.id ? { ...y, classId: e.target.value } : y)) }))}>
                              {d.castings.map((cc) => <option key={cc.classId ?? ''} value={cc.classId ?? ''}>{classById(cc.classId ?? '')?.name} · {cc.ability.toUpperCase()} DC {cc.dc}</option>)}
                            </select>
                          )}
                          {s.id.startsWith('custom-') && <button className="gr-btn gr-btn--secondary gr-btn--small" onClick={() => setEditing(s)}>Edit spell</button>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="gr-notice gr-empty">
            <Icon name="book" />
            <b>{mine ? 'No spells yet' : 'No spells match'}</b>
            <span>{mine ? `Open the ${listCls?.name ?? 'class'} list and tick spells to learn them.` : 'Try another level or search.'}</span>
            {mine && <button className="gr-btn gr-btn--secondary gr-btn--small" onClick={() => setMine(false)}>Open {listCls?.name ?? 'class'} list</button>}
          </div>
        )}
        <button className="gr-btn gr-btn--secondary" style={{ height: 44 }} onClick={() => setEditing('new')}>Add a custom spell</button>
        <span className="muted">Tick a spell to learn it. Prepared spells and cantrips show on the sheet and in combat. Tap a name for details.</span>
      </main>
      {editing && (
        <CustomSpellSheet
          spell={editing === 'new' ? null : editing}
          onSave={saveCustom}
          onDelete={editing === 'new' ? undefined : () => deleteCustom(editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
