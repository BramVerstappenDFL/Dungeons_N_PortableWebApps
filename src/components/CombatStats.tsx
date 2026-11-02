import type { Character } from '../types';
import { CONDITIONS, type Derived } from '../rules/derived';
import { d20With, signed } from '../rules/dice';
import { useStore } from '../store/characters';
import { Stepper } from './Stepper';

export function CombatStats({ c, d }: { c: Character; d: Derived }) {
  const roll = useStore((s) => s.roll);
  return (
    <section className="stat-row" aria-label="Combat stats">
      <div className="stat"><span className="label">AC</span><strong>{c.armorClass}</strong></div>
      <button className="stat" onClick={() => roll(d20With(d.initiative), 'Initiative', { characterId: c.id })}>
        <span className="label">Initiative</span><strong>{signed(d.initiative)}</strong>
      </button>
      <div className="stat"><span className="label">Speed</span><strong>{d.speed} ft</strong></div>
      <div className="stat"><span className="label">Prof.</span><strong>{signed(d.pb)}</strong></div>
      <div className="stat"><span className="label">Passive Perc.</span><strong>{d.passivePerception}</strong></div>
      <div className="stat"><span className="label">Hit Dice</span><strong>{c.level - c.hitDiceUsed}/{c.level}<small>d{d.hitDie}</small></strong></div>
    </section>
  );
}

export function ConditionsPanel({ c }: { c: Character }) {
  const update = useStore((s) => s.update);
  const toggle = (name: string) =>
    update(c.id, (x) => ({ ...x, conditions: x.conditions.includes(name) ? x.conditions.filter((n) => n !== name) : [...x.conditions, name] }));
  return (
    <section className="card" aria-label="Conditions">
      <h3 className="card-title">Conditions</h3>
      <div className="chips">
        {CONDITIONS.map((n) => (
          <button key={n} className={`chip ${c.conditions.includes(n) ? 'active' : ''}`} aria-pressed={c.conditions.includes(n)} onClick={() => toggle(n)}>{n}</button>
        ))}
      </div>
      <div className="row space-between mt">
        <span>Exhaustion <span className="muted small">(−2 to d20 tests and −5 ft speed per level)</span></span>
        <Stepper value={c.exhaustion} min={0} max={6} label="Exhaustion" onChange={(v) => update(c.id, (x) => ({ ...x, exhaustion: v }))} />
      </div>
      {c.exhaustion >= 6 && <p className="error small">Exhaustion 6: the character dies.</p>}
    </section>
  );
}
