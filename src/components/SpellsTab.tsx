import { useEffect, useMemo, useState } from 'react';
import type { Ability, Character, CharacterSpell, Spell } from '../types';
import type { Derived } from '../rules/derived';
import { CLASSES, loadSpells } from '../data';
import { useStore } from '../store/characters';
import { cap, levelLabel, SCHOOLS, spellRolls } from '../rules/spells';
import { d20With, signed } from '../rules/dice';
import { ABILITIES, ABILITY_NAMES } from '../rules/abilities';
import { uid } from '../store/characters';
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
  const [editing, setEditing] = useState<Spell | 'new' | null>(null);
  const byId = useMemo(() => new Map([...(all ?? []), ...c.customSpells].map((s) => [s.id, s])), [all, c.customSpells]);
  const mine = c.spells.map((s) => ({ ref: s, spell: byId.get(s.id) })).filter((x) => x.spell) as { ref: Character['spells'][0]; spell: Spell }[];
  const levels = [...new Set(mine.map((m) => m.spell.level))].sort((a, b) => a - b);
  const concentrating = c.concentration ? byId.get(c.concentration) : null;

  const toggleSlot = (lvl: number, i: number) =>
    update(c.id, (x) => {
      const used = [...x.spellSlotsUsed];
      used[lvl] = i < used[lvl] ? i : i + 1;
      return { ...x, spellSlotsUsed: used };
    });
  const togglePact = (i: number) => update(c.id, (x) => ({ ...x, pactSlotsUsed: i < x.pactSlotsUsed ? i : i + 1 }));
  const pips = (max: number, used: number, onToggle: (i: number) => void, label: string) => (
    <>
      <span className="pips">
        {Array.from({ length: max }, (_, i) => (
          <button
            key={i}
            className={`pip slot ${i < max - used ? 'on' : ''}`}
            onClick={() => onToggle(max - 1 - i)}
            aria-label={`${label} slot ${i + 1}`}
          />
        ))}
      </span>
      <span className="muted small">{max - used}/{max}</span>
    </>
  );

  return (
    <div className="stack">
      {d.castingAbilities.map((k) => (
        <section key={k.ability} className="stat-row" aria-label={`Spellcasting (${ABILITY_NAMES[k.ability]})`}>
          <div className="stat"><span className="label">Ability</span><strong>{k.ability.toUpperCase()}</strong></div>
          <div className="stat"><span className="label">Save DC</span><strong>{k.dc}</strong></div>
          <button className="stat" onClick={() => useStore.getState().roll(d20With(k.attack + d.d20Penalty), 'Spell attack', { characterId: c.id })}>
            <span className="label">Spell Attack</span><strong>{signed(k.attack)}</strong>
          </button>
        </section>
      ))}

      {concentrating && (
        <div className="banner">
          <span>Concentrating on <strong>{concentrating.name}</strong></span>
          <button className="btn btn-ghost small" onClick={() => update(c.id, (x) => ({ ...x, concentration: null }))}>End</button>
        </div>
      )}

      {(d.slotsMax.some((n) => n > 0) || d.pact) && (
        <section className="card" aria-label="Spell slots">
          <h3 className="card-title">{d.slotsMax.some((n) => n > 0) ? 'Spell Slots' : 'Pact Magic Slots'} <span className="muted small">tap to use / restore</span></h3>
          <div className="slots">
            {d.slotsMax.map((max, lvl) =>
              max > 0 ? (
                <div key={lvl} className="slot-row">
                  <span className="slot-level">{lvl + 1}</span>
                  {pips(max, c.spellSlotsUsed[lvl] ?? 0, (i) => toggleSlot(lvl, i), `Level ${lvl + 1}`)}
                </div>
              ) : null,
            )}
            {d.pact && (
              <div className="slot-row">
                <span className="slot-level" title={`Pact Magic, level ${d.pact.level}`}>{d.slotsMax.some((n) => n > 0) ? 'P' : ''}{d.pact.level}</span>
                {pips(d.pact.count, Math.min(d.pact.count, c.pactSlotsUsed), togglePact, `Pact Magic level ${d.pact.level}`)}
              </div>
            )}
          </div>
          {d.pact && d.slotsMax.some((n) => n > 0) && <p className="muted small">P{d.pact.level}: Pact Magic slots (level {d.pact.level}), regained on a short rest.</p>}
        </section>
      )}

      <section className="card">
        <div className="row space-between">
          <h3 className="card-title">My Spells</h3>
          <button className="btn btn-primary" onClick={() => setBrowse(true)} disabled={!all}>+ Add spells</button>
        </div>
        {!all && <p className="muted">Loading spells…</p>}
        {all && mine.length === 0 && <p className="muted">No spells yet. Add some from the SRD spell list, or create your own.</p>}
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
                    <span className="spell-name">{spell.name}{isCustom(spell) && <span className="muted small"> · custom</span>}</span>
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

      {browse && all && <SpellBrowser all={all} c={c} d={d} onClose={() => setBrowse(false)} onOpen={setDetail} onCreate={() => { setBrowse(false); setEditing('new'); }} />}
      {detail && (
        <SpellDetail
          key={detail.id}
          spell={byId.get(detail.id) ?? detail}
          c={c}
          d={d}
          onClose={() => setDetail(null)}
          onEdit={(sp) => { setDetail(null); setEditing(sp); }}
        />
      )}
      {editing && <CustomSpellForm c={c} d={d} spell={editing === 'new' ? null : editing} onClose={(saved) => { setEditing(null); if (saved) setDetail(saved); }} />}
    </div>
  );
}

const isCustom = (s: Spell) => s.id.startsWith('custom-');

/** The character's class that can cast this spell, used to pick the spellcasting ability. */
function sourceClass(spell: Spell, d: Derived, preferred?: string): string | undefined {
  const casterIds = d.casting.map((x) => x.classId).filter((x): x is string => !!x);
  if (preferred && casterIds.includes(preferred)) return preferred;
  return casterIds.find((id) => spell.classes.includes(id)) ?? casterIds[0];
}

function SpellBrowser({ all, c, d, onClose, onOpen, onCreate }: {
  all: Spell[]; c: Character; d: Derived; onClose: () => void; onOpen: (s: Spell) => void; onCreate: () => void;
}) {
  const update = useStore((s) => s.update);
  const [q, setQ] = useState('');
  const [cls, setCls] = useState(c.classes.find((x) => CLASSES.some((k) => k.id === x.id && k.casterType !== 'none'))?.id ?? '');
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
      spells: known.has(id)
        ? x.spells.filter((s) => s.id !== id)
        : [...x.spells, { id, prepared: true, classId: sourceClass(all.find((s) => s.id === id)!, d, cls) }],
    }));
  return (
    <Modal
      title="SRD Spell List"
      onClose={onClose}
      wide
      footer={<>
        <button className="btn btn-ghost" onClick={onCreate}>+ Custom spell</button>
        <button className="btn btn-primary" onClick={onClose}>Done</button>
      </>}
    >
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

interface SlotOption { key: string; kind: 'slot' | 'pact'; lvl: number; max: number; left: number }

function SpellDetail({ spell, c, d, onClose, onEdit }: { spell: Spell; c: Character; d: Derived; onClose: () => void; onEdit: (s: Spell) => void }) {
  const update = useStore((s) => s.update);
  const roll = useStore((s) => s.roll);
  const ref = c.spells.find((s) => s.id === spell.id);
  const known = !!ref;
  const k = d.castingFor(ref);
  const castable: SlotOption[] = [
    ...d.slotsMax.map((max, i) => ({ key: `slot-${i + 1}`, kind: 'slot' as const, lvl: i + 1, max, left: max - (c.spellSlotsUsed[i] ?? 0) })),
    ...(d.pact ? [{ key: 'pact', kind: 'pact' as const, lvl: d.pact.level, max: d.pact.count, left: Math.max(0, d.pact.count - c.pactSlotsUsed) }] : []),
  ].filter((s) => s.lvl >= spell.level && s.max > 0);
  const firstFree = castable.find((s) => s.left > 0)?.key ?? castable[0]?.key ?? '';
  const [slotKey, setSlotKey] = useState(firstFree);
  const chosen = castable.find((s) => s.key === slotKey);
  const [note, setNote] = useState('');

  const cast = (useSlot: boolean) => {
    const lvl = spell.level === 0 ? 0 : useSlot && chosen ? chosen.lvl : spell.level;
    if (useSlot && spell.level > 0 && (!chosen || chosen.left <= 0)) { setNote('No slots of that level left.'); return; }
    const replaced = spell.concentration && c.concentration && c.concentration !== spell.id ? c.concentration : null;
    update(c.id, (x) => {
      const next = { ...x, concentration: spell.concentration ? spell.id : x.concentration };
      if (useSlot && spell.level > 0 && chosen) {
        if (chosen.kind === 'pact') next.pactSlotsUsed = x.pactSlotsUsed + 1;
        else {
          const used = [...x.spellSlotsUsed];
          used[chosen.lvl - 1] = (used[chosen.lvl - 1] ?? 0) + 1;
          next.spellSlotsUsed = used;
        }
      }
      return next;
    });
    if (spell.attack) roll(d20With(k.attack + d.d20Penalty), `${spell.name} attack`, { characterId: c.id });
    for (const r of spellRolls(spell, lvl, d.level, k.mod)) roll(r.expression, r.label, { characterId: c.id });
    if (!spell.attack && !spell.damage && !spell.heal) {
      roll('0', `Cast ${spell.name}${lvl > spell.level ? ` at level ${lvl}` : ''}`, { characterId: c.id });
    }
    setNote(
      `Cast ${spell.name}${spell.level > 0 && useSlot && chosen ? ` using a level ${chosen.lvl}${chosen.kind === 'pact' ? ' Pact Magic' : ''} slot` : useSlot ? '' : ' as a ritual'}.` +
        (spell.save ? ` Targets make a DC ${k.dc} ${ABILITY_NAMES[spell.save]} save.` : '') +
        (replaced ? ' Your previous concentration spell ended.' : ''),
    );
  };

  return (
    <Modal title={spell.name} onClose={onClose}>
      <p className="muted">
        {levelLabel(spell.level)} {cap(spell.school)}{spell.ritual ? ' (ritual)' : ''}
        {spell.classes.length > 0 && ` · ${spell.classes.map(cap).join(', ')}`}{isCustom(spell) && ' · Custom spell'}
      </p>
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
                <select value={slotKey} onChange={(e) => setSlotKey(e.target.value)} disabled={castable.length < 2}>
                  {castable.map((s) => (
                    <option key={s.key} value={s.key}>{s.kind === 'pact' ? 'Pact Magic, level' : 'Level'} {s.lvl} ({s.left}/{s.max} left)</option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary block" onClick={() => cast(true)} disabled={!chosen || chosen.left <= 0}>
                Cast{chosen && chosen.lvl > spell.level ? ` at level ${chosen.lvl}` : ''}
              </button>
              {spell.ritual && <button className="btn block" onClick={() => cast(false)}>Cast as ritual (no slot)</button>}
            </>
          )}
          {note && <p className="small">{note}</p>}
          {d.casting.length > 1 && (
            <label className="row">
              <span>Cast with</span>
              <select
                value={k.classId ?? ''}
                onChange={(e) => update(c.id, (x) => ({ ...x, spells: x.spells.map((s) => (s.id === spell.id ? { ...s, classId: e.target.value } : s)) }))}
              >
                {d.casting.map((x) => (
                  <option key={x.classId ?? ''} value={x.classId ?? ''}>
                    {CLASSES.find((cl) => cl.id === x.classId)?.name ?? 'Spellcasting'} ({x.ability.toUpperCase()}, DC {x.dc})
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="row wrap">
            {isCustom(spell) && <button className="btn btn-ghost small" onClick={() => onEdit(spell)}>Edit spell</button>}
            <button
              className="btn btn-ghost small"
              onClick={() => {
                update(c.id, (x) => ({
                  ...x,
                  spells: x.spells.filter((s) => s.id !== spell.id),
                  customSpells: x.customSpells.filter((s) => s.id !== spell.id),
                  concentration: x.concentration === spell.id ? null : x.concentration,
                }));
                onClose();
              }}
            >{isCustom(spell) ? 'Delete spell' : 'Remove from my spells'}</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-primary block" onClick={() => update(c.id, (x) => ({ ...x, spells: [...x.spells, { id: spell.id, prepared: true, classId: sourceClass(spell, d) }] }))}>
          Add to my spells
        </button>
      )}
    </Modal>
  );
}

const EMPTY_SPELL: Spell = {
  id: '', name: '', level: 1, school: 'evocation', classes: [], castingTime: 'Action', range: '60 feet',
  components: 'V, S', duration: 'Instantaneous', description: '',
};

/** Creates or edits a spell that is not in the SRD list. It is stored on the character. */
function CustomSpellForm({ c, d, spell, onClose }: { c: Character; d: Derived; spell: Spell | null; onClose: (saved?: Spell) => void }) {
  const update = useStore((s) => s.update);
  const [f, setF] = useState<Spell>(spell ?? EMPTY_SPELL);
  const [error, setError] = useState('');
  const set = <K extends keyof Spell>(key: K, value: Spell[K]) => setF((x) => ({ ...x, [key]: value }));
  const opt = (v: string) => v.trim() || undefined;

  const save = () => {
    if (!f.name.trim()) return setError('Give the spell a name.');
    if (f.damage && !/^\d+d\d+$/.test(f.damage)) return setError('Damage dice must look like 2d6.');
    const out: Spell = {
      ...f,
      id: spell?.id ?? `custom-${uid()}`,
      name: f.name.trim(),
      damage: opt(f.damage ?? ''),
      damageType: f.damage ? opt(f.damageType ?? '') : undefined,
      material: opt(f.material ?? ''),
    };
    update(c.id, (x) => {
      const exists = x.customSpells.some((s) => s.id === out.id);
      const ref: CharacterSpell = { id: out.id, prepared: true, classId: sourceClass(out, d) };
      return {
        ...x,
        customSpells: exists ? x.customSpells.map((s) => (s.id === out.id ? out : s)) : [...x.customSpells, out],
        spells: x.spells.some((s) => s.id === out.id) ? x.spells : [...x.spells, ref],
      };
    });
    onClose(out);
  };

  return (
    <Modal
      title={spell ? `Edit ${spell.name}` : 'Custom spell'}
      onClose={() => onClose()}
      footer={<>
        <button className="btn btn-ghost" onClick={() => onClose()}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save spell</button>
      </>}
    >
      <div className="form">
        <label>Name<input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></label>
        <div className="form-row">
          <label>Level
            <select value={f.level} onChange={(e) => set('level', Number(e.target.value))}>
              {Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>{levelLabel(i)}</option>)}
            </select>
          </label>
          <label>School
            <select value={f.school} onChange={(e) => set('school', e.target.value)}>
              {SCHOOLS.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>Casting time<input value={f.castingTime} onChange={(e) => set('castingTime', e.target.value)} /></label>
          <label>Range<input value={f.range} onChange={(e) => set('range', e.target.value)} /></label>
        </div>
        <div className="form-row">
          <label>Components<input value={f.components} onChange={(e) => set('components', e.target.value)} /></label>
          <label>Duration<input value={f.duration} onChange={(e) => set('duration', e.target.value)} /></label>
        </div>
        <label>Material<input value={f.material ?? ''} onChange={(e) => set('material', e.target.value)} placeholder="optional" /></label>
        <div className="row wrap">
          <label className="check"><input type="checkbox" checked={!!f.concentration} onChange={(e) => set('concentration', e.target.checked)} /> Concentration</label>
          <label className="check"><input type="checkbox" checked={!!f.ritual} onChange={(e) => set('ritual', e.target.checked)} /> Ritual</label>
        </div>
        <div className="form-row">
          <label>Damage dice<input value={f.damage ?? ''} onChange={(e) => set('damage', e.target.value.trim())} placeholder="e.g. 3d6" /></label>
          <label>Damage type<input value={f.damageType ?? ''} onChange={(e) => set('damageType', e.target.value)} placeholder="e.g. necrotic" /></label>
        </div>
        <div className="form-row">
          <label>Spell attack
            <select value={f.attack ?? ''} onChange={(e) => set('attack', (e.target.value || undefined) as Spell['attack'])}>
              <option value="">None</option><option value="melee">Melee</option><option value="ranged">Ranged</option>
            </select>
          </label>
          <label>Saving throw
            <select value={f.save ?? ''} onChange={(e) => set('save', (e.target.value || undefined) as Ability | undefined)}>
              <option value="">None</option>
              {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
            </select>
          </label>
        </div>
        {f.damage && (
          <div className="form-row">
            <label>Extra dice per slot level above<input type="number" min={0} value={f.upcastDice ?? 0} onChange={(e) => set('upcastDice', Number(e.target.value) || undefined)} /></label>
            {f.level === 0 && <label className="check"><input type="checkbox" checked={!!f.cantripScaling} onChange={(e) => set('cantripScaling', e.target.checked)} /> Scales at levels 5, 11, 17</label>}
          </div>
        )}
        <label>Description<textarea rows={6} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
        {error && <p className="error small">{error}</p>}
      </div>
    </Modal>
  );
}
