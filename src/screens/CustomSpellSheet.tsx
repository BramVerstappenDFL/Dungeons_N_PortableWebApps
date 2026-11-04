import { useState } from 'react';
import type { Ability, Spell } from '../types';
import { ABILITIES, ABILITY_NAMES } from '../rules/abilities';
import { SCHOOLS, cap } from '../rules/spells';
import { BottomSheet } from '../ui/BottomSheet';
import { ordinal } from '../ui/format';

const EMPTY: Spell = {
  id: '', name: '', level: 1, school: 'evocation', classes: [], castingTime: 'Action', range: '60 feet',
  components: 'V, S', duration: 'Instantaneous', description: '',
};
const DICE = /^\d+d\d+$/;

/** Creates or edits a spell that is not in the SRD list. `onSave` gets the finished spell; `onDelete` removes it. */
export function CustomSpellSheet({ spell, onSave, onDelete, onClose }: {
  spell: Spell | null; onSave: (s: Spell) => void; onDelete?: () => void; onClose: () => void;
}) {
  const [f, setF] = useState<Spell>(spell ?? EMPTY);
  const set = <K extends keyof Spell>(k: K, v: Spell[K]) => setF((x) => ({ ...x, [k]: v }));
  const diceOk = !f.damage || DICE.test(f.damage);
  const ok = f.name.trim().length > 0 && diceOk;
  const text = (k: 'castingTime' | 'range' | 'components' | 'duration' | 'material', label: string, placeholder = '') => (
    <div className="gr-field">
      <label htmlFor={`cs-${k}`} className="gr-label">{label}</label>
      <input id={`cs-${k}`} className="gr-input" style={{ height: 44 }} placeholder={placeholder} value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
    </div>
  );
  const save = () => {
    const opt = (v?: string) => v?.trim() || undefined;
    onSave({
      ...f,
      name: f.name.trim(),
      material: opt(f.material),
      damage: opt(f.damage),
      damageType: f.damage ? opt(f.damageType) : undefined,
      upcastDice: f.damage && f.level > 0 ? f.upcastDice || undefined : undefined,
      cantripScaling: f.damage && f.level === 0 ? f.cantripScaling || undefined : undefined,
    });
  };

  return (
    <BottomSheet title={spell ? `Edit ${spell.name}` : 'Custom spell'} onClose={onClose}>
      <span className="muted">For spells that are not in the SRD list. They stay on this character.</span>
      <div className="gr-field" style={{ width: '100%' }}>
        <label htmlFor="cs-name" className="gr-label">Name</label>
        <input id="cs-name" className="gr-input" style={{ height: 44 }} value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus={!spell} />
      </div>
      <div className="grid2">
        <div className="gr-field">
          <label htmlFor="cs-level" className="gr-label">Level</label>
          <select id="cs-level" className="gr-input gr-select" style={{ height: 44 }} value={f.level} onChange={(e) => set('level', Number(e.target.value))}>
            {Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>{i === 0 ? 'Cantrip' : ordinal(i)}</option>)}
          </select>
        </div>
        <div className="gr-field">
          <label htmlFor="cs-school" className="gr-label">School</label>
          <select id="cs-school" className="gr-input gr-select" style={{ height: 44 }} value={f.school} onChange={(e) => set('school', e.target.value)}>
            {SCHOOLS.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid2">{text('castingTime', 'Casting time')}{text('range', 'Range')}</div>
      <div className="grid2">{text('components', 'Components')}{text('duration', 'Duration')}</div>
      {text('material', 'Material (optional)')}
      <div className="chips" role="group" aria-label="Spell tags">
        <button className={`gr-chip filter${f.concentration ? ' is-on' : ''}`} aria-pressed={!!f.concentration} onClick={() => set('concentration', !f.concentration)}>Concentration</button>
        <button className={`gr-chip filter${f.ritual ? ' is-on' : ''}`} aria-pressed={!!f.ritual} onClick={() => set('ritual', !f.ritual)}>Ritual</button>
      </div>
      <div className="grid2">
        <div className="gr-field">
          <label htmlFor="cs-damage" className="gr-label">Damage dice</label>
          <input id="cs-damage" className={`gr-input${diceOk ? '' : ' gr-input--invalid'}`} style={{ height: 44 }} placeholder="2d6" value={f.damage ?? ''} onChange={(e) => set('damage', e.target.value.replace(/\s/g, ''))} />
          {!diceOk && <span className="gr-help gr-help--error">Use dice like 2d6.</span>}
        </div>
        <div className="gr-field">
          <label htmlFor="cs-type" className="gr-label">Damage type</label>
          <input id="cs-type" className="gr-input" style={{ height: 44 }} placeholder="necrotic" value={f.damageType ?? ''} onChange={(e) => set('damageType', e.target.value.toLowerCase())} />
        </div>
      </div>
      <div className="grid2">
        <div className="gr-field">
          <label htmlFor="cs-attack" className="gr-label">Spell attack</label>
          <select id="cs-attack" className="gr-input gr-select" style={{ height: 44 }} value={f.attack ?? ''} onChange={(e) => set('attack', (e.target.value || undefined) as Spell['attack'])}>
            <option value="">None</option><option value="melee">Melee</option><option value="ranged">Ranged</option>
          </select>
        </div>
        <div className="gr-field">
          <label htmlFor="cs-save" className="gr-label">Saving throw</label>
          <select id="cs-save" className="gr-input gr-select" style={{ height: 44 }} value={f.save ?? ''} onChange={(e) => set('save', (e.target.value || undefined) as Ability | undefined)}>
            <option value="">None</option>
            {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
          </select>
        </div>
      </div>
      {f.damage && f.level > 0 && (
        <div className="gr-field">
          <label htmlFor="cs-upcast" className="gr-label">Extra dice per slot level above {ordinal(f.level)}</label>
          <input id="cs-upcast" className="gr-input" style={{ height: 44 }} inputMode="numeric" value={f.upcastDice ?? 0} onChange={(e) => set('upcastDice', Number(e.target.value.replace(/\D/g, '')) || undefined)} />
        </div>
      )}
      {f.damage && f.level === 0 && (
        <div className="chips">
          <button className={`gr-chip filter${f.cantripScaling ? ' is-on' : ''}`} aria-pressed={!!f.cantripScaling} onClick={() => set('cantripScaling', !f.cantripScaling)}>More dice at levels 5, 11 and 17</button>
        </div>
      )}
      <div className="gr-field" style={{ width: '100%' }}>
        <label htmlFor="cs-desc" className="gr-label">Description</label>
        <textarea id="cs-desc" className="gr-input gr-textarea" value={f.description} onChange={(e) => set('description', e.target.value)} />
      </div>
      <div className="grid2">
        {onDelete ? (
          <button className="gr-btn gr-btn--danger" style={{ height: 48 }} onClick={onDelete}>Delete</button>
        ) : (
          <button className="gr-btn gr-btn--secondary" style={{ height: 48 }} onClick={onClose}>Cancel</button>
        )}
        <button className="gr-btn gr-btn--primary" style={{ height: 48 }} onClick={save} disabled={!ok}>Save spell</button>
      </div>
    </BottomSheet>
  );
}
