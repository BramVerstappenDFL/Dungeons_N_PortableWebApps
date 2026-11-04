import type { CSSProperties } from 'react';
import type { Ability, Spell } from '../../types';
import { featById } from '../../data';
import { ABILITY_NAMES, SKILLS } from '../../rules/abilities';
import { Tick } from './parts';

export const SKILLED_PICKS = 3;
export const MI_LISTS = ['Cleric', 'Druid', 'Wizard'] as const;
export interface MiPick { cantrips: string[]; spell?: string; ability: Ability }
export type FeatSlot = 'bg' | 'extra';
export interface FeatInstance { slot: FeatSlot; id: string; note?: string }

/** Natural spellcasting ability of a Magic Initiate list. */
export const miAbility = (list?: string): Ability => (list === 'Wizard' ? 'int' : 'wis');
export const miComplete = (p: MiPick | undefined) => !!p && p.cantrips.length === 2 && !!p.spell;

/** The choices an origin feat asks for: three skills for Skilled, two cantrips and a spell for Magic Initiate. */
export function FeatChoices({ feats, spells, taken, skilled, setSkilled, mi, setMi }: {
  feats: FeatInstance[];
  spells: Spell[] | null;
  taken: string[]; // skills the character already has
  skilled: string[];
  setSkilled: (l: string[]) => void;
  mi: Partial<Record<FeatSlot, MiPick>>;
  setMi: (slot: FeatSlot, p: MiPick) => void;
}) {
  const skilledCount = feats.filter((f) => f.id === 'skilled').length * SKILLED_PICKS;
  const mis = feats.filter((f) => f.id === 'magic-initiate');
  if (!skilledCount && !mis.length) return null;
  const toggleSkill = (s: string) =>
    setSkilled(skilled.includes(s) ? skilled.filter((x) => x !== s) : skilled.length < skilledCount ? [...skilled, s] : skilled);

  return (
    <section className="gr-window unfold" style={{ '--tincture': 'var(--tincture-5)', width: '100%' } as CSSProperties}>
      <div className="gr-window__head"><i className="gr-window__mark" /><div className="gr-window__title"><span>Feat choices</span></div></div>
      <div className="gr-window__body" style={{ gap: 16 }}>
        {skilledCount > 0 && (
          <div className="col" style={{ gap: 8 }}>
            <div className="row" style={{ alignItems: 'baseline' }}>
              <span className="gr-label" style={{ flex: 1 }}>Skilled</span>
              <span className="muted"><Tick value={skilled.length} /> of {skilledCount}</span>
            </div>
            <div className="chips" role="group" aria-label="Skilled">
              {SKILLS.filter((s) => !taken.includes(s.id)).map((s) => (
                <button key={s.id} className={`gr-chip filter${skilled.includes(s.id) ? ' is-on' : ''}`} aria-pressed={skilled.includes(s.id)} onClick={() => toggleSkill(s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {mis.map((f) => {
          const list = f.note?.toLowerCase();
          const p = mi[f.slot] ?? { cantrips: [], ability: miAbility(f.note) };
          const pool = (spells ?? []).filter((s) => list && s.classes.includes(list));
          const toggleCantrip = (id: string) => setMi(f.slot, {
            ...p, cantrips: p.cantrips.includes(id) ? p.cantrips.filter((x) => x !== id) : p.cantrips.length < 2 ? [...p.cantrips, id] : [p.cantrips[1], id],
          });
          return (
            <div key={f.slot} className="col" style={{ gap: 10 }}>
              <span className="gr-label">{featById(f.id)?.name} ({f.note}){f.slot === 'extra' ? ' · Versatile' : ''}</span>
              {!spells ? <span className="muted">Opening the spell list…</span> : (
                <>
                  <div className="row" style={{ alignItems: 'baseline' }}>
                    <span className="muted" style={{ flex: 1 }}>Two cantrips</span>
                    <span className="muted"><Tick value={p.cantrips.length} /> of 2</span>
                  </div>
                  <div className="chips" role="group" aria-label="Cantrips">
                    {pool.filter((s) => s.level === 0).map((s) => (
                      <button key={s.id} className={`gr-chip filter${p.cantrips.includes(s.id) ? ' is-on' : ''}`} aria-pressed={p.cantrips.includes(s.id)} onClick={() => toggleCantrip(s.id)}>{s.name}</button>
                    ))}
                  </div>
                  <span className="muted">One level 1 spell, always prepared, cast free once per long rest</span>
                  <div className="chips" role="radiogroup" aria-label="Level 1 spell">
                    {pool.filter((s) => s.level === 1).map((s) => (
                      <button key={s.id} role="radio" aria-checked={p.spell === s.id} className={`gr-chip filter${p.spell === s.id ? ' is-on' : ''}`} onClick={() => setMi(f.slot, { ...p, spell: s.id })}>{s.name}</button>
                    ))}
                  </div>
                  <span className="muted">Spellcasting ability</span>
                  <div className="seg" role="group" aria-label="Spellcasting ability">
                    {(['int', 'wis', 'cha'] as Ability[]).map((a) => (
                      <button key={a} className={p.ability === a ? 'segbtn is-on' : 'segbtn'} aria-pressed={p.ability === a} onClick={() => setMi(f.slot, { ...p, ability: a })}>{ABILITY_NAMES[a]}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
