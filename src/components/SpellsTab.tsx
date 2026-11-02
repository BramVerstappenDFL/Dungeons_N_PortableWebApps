import { useEffect, useMemo, useState } from 'react';
import type { Character, Spell } from '../types';
import type { Derived } from '../rules/derived';
import { CLASSES, loadSpells } from '../data';
import { useStore } from '../store/characters';
import { cap, levelLabel, SCHOOLS, spellRolls } from '../rules/spells';
import { d20With, signed } from '../rules/dice';
import { ABILITY_NAMES } from '../rules/abilities';
import { Modal } from './Modal';
import { Markdown } from './Markdown';

function useSpells() {
  const [spells, setSpells] = useState<Spell[] | null>(null);
  useEffect(() => { loadSpells().then(setSpells); }, []);
  return spells;
}

export function SpellsTab({ c, d }: { c: Character; d: Derived }) {
  const all = useSpells();
  const update = useStore((s) => s.update);
  const [browse, setBrowse] = useState(false);
  const [detail, setDetail] = useState<Spell | null>(null);
  const byId = useMemo(() => new Map((all ?? []).map((s) => [s.id, s])), [all]);
  const mine = c.spells.map((s) => ({ ref: s, spell: byId.get(s.id) })).filter((x) => x.spell) as { ref: Character['spells'][0]; spell: Spell }[];
  const levels = [...new Set(mine.map((m) => m.spell.level))].sort((a, b) => a - b);
  const concentrating = c.concentration ? byId.get(c.concentration) : null;

  const toggleSlot = (lvl: number, i: number) =>
    update(c.id, (x) => {
      const used = [...x.spellSlotsUsed];
      used[lvl] = i < used[lvl] ? i : i + 1;
      return { ...x, spellSlotsUsed: used };
    });

  return (
    <div className="stack">
      <section className="stat-row" aria-label="Spellcasting">
        <div className="stat"><span className="label">Ability</span><strong>{d.spellAbility.toUpperCase()}</strong></div>
        <div className="stat"><span className="label">Save DC</span><strong>{d.spellDC}</strong></div>
        <button className="stat" onClick={() => useStore.getState().roll(d20With(d.spellAttack + d.d20Penalty), 'Spell attack', { characterId: c.id })}>
          <span className="label">Spell Attack</span><strong>{signed(d.spellAttack)}</strong>
        </button>
      </section>

      {concentrating && (
        <div className="banner">
          <span>Concentrating on <strong>{concentrating.name}</strong></span>
          <button className="btn btn-ghost small" onClick={() => update(c.id, (x) => ({ ...x, concentration: null }))}>End</button>
        </div>
      )}

      {d.slotsMax.some((n) => n > 0) && (
        <section className="card" aria-label="Spell slots">
          <h3 className="card-title">{d.cls?.casterType === 'pact' ? 'Pact Magic Slots' : 'Spell Slots'} <span className="muted small">tap to use / restore</span></h3>
          <div className="slots">
            {d.slotsMax.map((max, lvl) =>
              max > 0 ? (
                <div key={lvl} className="slot-row">
                  <span className="slot-level">{lvl + 1}</span>
                  <span className="pips">
                    {Array.from({ length: max }, (_, i) => (
                      <button
                        key={i}
                        className={`pip slot ${i < max - (c.spellSlotsUsed[lvl] ?? 0) ? 'on' : ''}`}
                        onClick={() => toggleSlot(lvl, max - 1 - i)}
                        aria-label={`Level ${lvl + 1} slot ${i + 1}`}
                      />
                    ))}
                  </span>
                  <span className="muted small">{max - (c.spellSlotsUsed[lvl] ?? 0)}/{max}</span>
                </div>
              ) : null,
            )}
          </div>
        </section>
      )}

      <section className="card">
        <div className="row space-between">
          <h3 className="card-title">My Spells</h3>
          <button className="btn btn-primary" onClick={() => setBrowse(true)} disabled={!all}>+ Add spells</button>
        </div>
        {!all && <p className="muted">Loading spells…</p>}
        {all && mine.length === 0 && <p className="muted">No spells yet. Add some from the SRD spell list.</p>}
        {levels.map((lvl) => (
          <div key={lvl} className="spell-group">
            <h4>{lvl === 0 ? 'Cantrips' : `Level ${lvl}`}</h4>
            <ul className="spell-list">
              {mine.filter((m) => m.spell.level === lvl).map(({ ref, spell }) => (
                <li key={spell.id}>
                  {lvl > 0 && (
                    <button
                      className={`prep ${ref.prepared ? 'on' : ''}`}
                      aria-pressed={ref.prepared}
                      aria-label={ref.prepared ? 'Prepared' : 'Not prepared'}
                      title="Prepared"
                      onClick={() => update(c.id, (x) => ({ ...x, spells: x.spells.map((s) => (s.id === spell.id ? { ...s, prepared: !s.prepared } : s)) }))}
                    >★</button>
                  )}
                  <button className="spell-item" onClick={() => setDetail(spell)}>
                    <span className="spell-name">{spell.name}</span>
                    <span className="muted small">
                      {spell.castingTime} · {spell.range}
                      {spell.concentration && ' · C'}{spell.ritual && ' · R'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {browse && all && <SpellBrowser all={all} c={c} onClose={() => setBrowse(false)} onOpen={setDetail} />}
      {detail && <SpellDetail spell={detail} c={c} d={d} onClose={() => setDetail(null)} />}
    </div>
  );
}

function SpellBrowser({ all, c, onClose, onOpen }: { all: Spell[]; c: Character; onClose: () => void; onOpen: (s: Spell) => void }) {
  const update = useStore((s) => s.update);
  const [q, setQ] = useState('');
  const [cls, setCls] = useState(CLASSES.find((x) => x.id === c.classId && x.casterType !== 'none') ? c.classId : '');
  const [level, setLevel] = useState('');
  const [school, setSchool] = useState('');
  const known = new Set(c.spells.map((s) => s.id));
  const results = all.filter(
    (s) =>
      (!q || s.name.toLowerCase().includes(q.toLowerCase())) &&
      (!cls || s.classes.includes(cls)) &&
      (level === '' || s.level === Number(level)) &&
      (!school || s.school === school),
  );
  const toggle = (id: string) =>
    update(c.id, (x) => ({
      ...x,
      spells: known.has(id) ? x.spells.filter((s) => s.id !== id) : [...x.spells, { id, prepared: true }],
    }));
  return (
    <Modal title="SRD Spell List" onClose={onClose} wide footer={<button className="btn btn-primary" onClick={onClose}>Done</button>}>
      <div className="filters">
        <input type="search" placeholder="Search spells…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search spells" autoFocus />
        <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Class">
          <option value="">All classes</option>
          {CLASSES.filter((x) => x.casterType !== 'none').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level">
          <option value="">All levels</option>
          {Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>{levelLabel(i)}</option>)}
        </select>
        <select value={school} onChange={(e) => setSchool(e.target.value)} aria-label="School">
          <option value="">All schools</option>
          {SCHOOLS.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
        </select>
      </div>
      <p className="muted small">{results.length} spells</p>
      <ul className="spell-list browse">
        {results.map((s) => (
          <li key={s.id}>
            <button className="spell-item" onClick={() => onOpen(s)}>
              <span className="spell-name">{s.name}</span>
              <span className="muted small">{levelLabel(s.level)} · {cap(s.school)}{s.concentration ? ' · C' : ''}{s.ritual ? ' · R' : ''}</span>
            </button>
            <button className={`btn small ${known.has(s.id) ? 'btn-ghost' : 'btn-primary'}`} onClick={() => toggle(s.id)} aria-label={`${known.has(s.id) ? 'Remove' : 'Add'} ${s.name}`}>
              {known.has(s.id) ? 'Remove' : 'Add'}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function SpellDetail({ spell, c, d, onClose }: { spell: Spell; c: Character; d: Derived; onClose: () => void }) {
  const update = useStore((s) => s.update);
  const roll = useStore((s) => s.roll);
  const known = c.spells.some((s) => s.id === spell.id);
  const isPact = d.cls?.casterType === 'pact';
  const available = d.slotsMax.map((max, i) => max - (c.spellSlotsUsed[i] ?? 0));
  const castable = d.slotsMax
    .map((max, i) => ({ lvl: i + 1, max, left: available[i] }))
    .filter((s) => s.lvl >= spell.level && s.max > 0);
  const firstFree = castable.find((s) => s.left > 0)?.lvl ?? castable[0]?.lvl ?? spell.level;
  const [slot, setSlot] = useState(firstFree);
  const [note, setNote] = useState('');

  const cast = (useSlot: boolean) => {
    const lvl = spell.level === 0 ? 0 : useSlot ? slot : spell.level;
    if (useSlot && spell.level > 0) {
      if ((available[slot - 1] ?? 0) <= 0) { setNote('No slots of that level left.'); return; }
    }
    const replaced = spell.concentration && c.concentration && c.concentration !== spell.id ? c.concentration : null;
    update(c.id, (x) => {
      const used = [...x.spellSlotsUsed];
      if (useSlot && spell.level > 0) used[slot - 1] = (used[slot - 1] ?? 0) + 1;
      return { ...x, spellSlotsUsed: used, concentration: spell.concentration ? spell.id : x.concentration };
    });
    if (spell.attack) roll(d20With(d.spellAttack + d.d20Penalty), `${spell.name} attack`, { characterId: c.id });
    for (const r of spellRolls(spell, lvl, c.level, d.spellMod)) roll(r.expression, r.label, { characterId: c.id });
    if (!spell.attack && !spell.damage && !spell.heal) {
      roll('0', `Cast ${spell.name}${lvl > spell.level ? ` at level ${lvl}` : ''}`, { characterId: c.id });
    }
    setNote(
      `Cast ${spell.name}${spell.level > 0 && useSlot ? ` using a level ${slot} slot` : useSlot ? '' : ' as a ritual'}.` +
        (spell.save ? ` Targets make a DC ${d.spellDC} ${ABILITY_NAMES[spell.save]} save.` : '') +
        (replaced ? ' Your previous concentration spell ended.' : ''),
    );
  };

  return (
    <Modal title={spell.name} onClose={onClose}>
      <p className="muted">{levelLabel(spell.level)} {cap(spell.school)}{spell.ritual ? ' (ritual)' : ''} · {spell.classes.map(cap).join(', ')}</p>
      <dl className="spell-meta">
        <div><dt>Casting Time</dt><dd>{spell.castingTime}{spell.ritual ? ' or Ritual' : ''}</dd></div>
        <div><dt>Range</dt><dd>{spell.range}</dd></div>
        <div><dt>Components</dt><dd>{spell.components}{spell.material ? ` (${spell.material})` : ''}</dd></div>
        <div><dt>Duration</dt><dd>{spell.duration}</dd></div>
      </dl>
      <Markdown text={spell.description} />
      {known ? (
        <div className="cast-box">
          {spell.level === 0 ? (
            <button className="btn btn-primary block" onClick={() => cast(false)}>Cast cantrip</button>
          ) : castable.length === 0 ? (
            <>
              <p className="muted small">You have no spell slots of level {spell.level} or higher.</p>
              {spell.ritual && <button className="btn block" onClick={() => cast(false)}>Cast as ritual (no slot)</button>}
            </>
          ) : (
            <>
              <label className="row">
                <span>Slot level</span>
                <select value={slot} onChange={(e) => setSlot(Number(e.target.value))} disabled={isPact}>
                  {castable.map((s) => (
                    <option key={s.lvl} value={s.lvl}>Level {s.lvl} ({s.left}/{s.max} left)</option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary block" onClick={() => cast(true)} disabled={(available[slot - 1] ?? 0) <= 0}>
                Cast{slot > spell.level ? ` at level ${slot}` : ''}
              </button>
              {spell.ritual && <button className="btn block" onClick={() => cast(false)}>Cast as ritual (no slot)</button>}
            </>
          )}
          {note && <p className="small">{note}</p>}
          <button
            className="btn btn-ghost small"
            onClick={() => { update(c.id, (x) => ({ ...x, spells: x.spells.filter((s) => s.id !== spell.id) })); onClose(); }}
          >Remove from my spells</button>
        </div>
      ) : (
        <button className="btn btn-primary block" onClick={() => update(c.id, (x) => ({ ...x, spells: [...x.spells, { id: spell.id, prepared: true }] }))}>
          Add to my spells
        </button>
      )}
    </Modal>
  );
}
