import type { Character } from '../types';
import type { Derived } from '../rules/derived';
import { ABILITIES, ABILITY_NAMES, SKILLS } from '../rules/abilities';
import { d20With, signed } from '../rules/dice';
import { useStore } from '../store/characters';

export function AbilityPanel({ c, d }: { c: Character; d: Derived }) {
  const roll = useStore((s) => s.roll);
  return (
    <section className="card" aria-label="Abilities">
      <h3 className="card-title">Abilities <span className="muted small">tap to roll</span></h3>
      <div className="ability-grid">
        {ABILITIES.map((a) => (
          <div key={a} className="ability">
            <button className="ability-main" onClick={() => roll(d20With(d.check(a)), `${ABILITY_NAMES[a]} check`, { characterId: c.id })}>
              <span className="ability-abbr">{a.toUpperCase()}</span>
              <span className="ability-mod">{signed(d.mods[a])}</span>
              <span className="ability-score">{c.abilities[a]}</span>
            </button>
            <button
              className={`ability-save ${d.cls?.saves.includes(a) ? 'prof' : ''}`}
              onClick={() => roll(d20With(d.saveBonus(a)), `${ABILITY_NAMES[a]} save`, { characterId: c.id })}
              aria-label={`${ABILITY_NAMES[a]} saving throw ${signed(d.saveBonus(a))}`}
            >
              Save {signed(d.saveBonus(a))}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SkillList({ c, d }: { c: Character; d: Derived }) {
  const roll = useStore((s) => s.roll);
  return (
    <section className="card" aria-label="Skills">
      <h3 className="card-title">Skills</h3>
      <ul className="skill-list">
        {SKILLS.map((s) => {
          const prof = c.expertise.includes(s.id) ? 'expert' : c.skills.includes(s.id) ? 'prof' : '';
          return (
            <li key={s.id}>
              <button className="skill" onClick={() => roll(d20With(d.skill(s.id)), `${s.name} check`, { characterId: c.id })}>
                <span className={`prof-dot ${prof}`} aria-label={prof ? (prof === 'expert' ? 'Expertise' : 'Proficient') : undefined} />
                <span className="skill-name">{s.name}</span>
                <span className="muted small">{s.ability.toUpperCase()}</span>
                <span className="skill-bonus">{signed(d.skill(s.id))}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
