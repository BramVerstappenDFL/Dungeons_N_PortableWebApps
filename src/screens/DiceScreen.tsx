import { useState } from 'react';
import type { Ability, Character } from '../types';
import { useStore } from '../store/characters';
import { derive } from '../rules/derived';
import { ABILITIES, ABILITY_NAMES, SKILLS } from '../rules/abilities';
import { d20With, type RollMode } from '../rules/dice';
import { Icon, ICONS } from '../ui/Icon';
import { TabBar } from '../ui/TabBar';
import { useRollOverlay } from '../ui/RollOverlay';
import { popupFromRoll, prettyExpr, signed } from '../ui/format';
import './dice.css';

const SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
const DIE_ICON: Record<number, string> = {
  4: 'M12 3 21 20H3z', 6: 'M4 4h16v16H4zM9 9h.01M15 15h.01M12 12h.01', 8: 'M12 2 21 12 12 22 3 12zM3 12h18',
  10: 'M12 2 21 10 12 22 3 10zM3 10l9 4 9-4M12 14v8', 12: 'M12 2 22 9.5 18 21H6L2 9.5zM12 7l5 4-2 5H9l-2-5z',
  20: ICONS.d20, 100: 'M8 3 14 9 8 20 2 9zM16 3 22 9 16 20 13 14M14 9l2-6',
};
const EMPTY = () => Object.fromEntries(SIDES.map((n) => [n, 0])) as Record<number, number>;

export function DiceScreen({ c }: { c: Character }) {
  const roll = useStore((s) => s.roll);
  const d = derive(c);
  const overlay = useRollOverlay();
  const [tableOpen, setTableOpen] = useState(true);
  const [pool, setPool] = useState(EMPTY);
  const [mod, setMod] = useState(0);
  const [adv, setAdv] = useState<RollMode>('normal');
  const [last, setLast] = useState<string | null>(null);
  const opts = { characterId: c.id, mode: adv };

  const rollCheck = (key: string, label: string, bonus: number) => {
    const r = roll(d20With(bonus), label, opts);
    if (!r) return;
    setLast(key);
    overlay.show(...popupFromRoll(r, r.label));
  };

  const parts = SIDES.filter((n) => pool[n] > 0).map((n) => `${pool[n]}d${n}`);
  let expr = parts.join('+');
  if (expr && mod) expr += mod > 0 ? `+${mod}` : `${mod}`;
  const advNote = adv === 'advantage' ? ' (advantage)' : adv === 'disadvantage' ? ' (disadvantage)' : '';
  const shownFormula = expr ? prettyExpr(expr.replace(/\b1d/g, 'd')) + (pool[20] === 1 ? advNote : '') : '';
  const rollPool = () => {
    if (!expr) return;
    const r = roll(expr, 'Custom roll', { characterId: c.id, mode: pool[20] === 1 ? adv : 'normal' });
    if (!r) return;
    setLast(null);
    overlay.show(...popupFromRoll(r, 'Custom roll', pool[20] === 1 ? {} : { tone: undefined, tag: undefined }));
  };

  const prof = (id: string) => (c.expertise.includes(id) ? ' expert' : c.skills.includes(id) ? ' prof' : '');
  const skills = [...SKILLS].sort((a, b) => (prof(b.id) ? 1 : 0) - (prof(a.id) ? 1 : 0) || d.skill(b.id) - d.skill(a.id));
  const saves = [...ABILITIES].sort((a: Ability, b: Ability) => (d.cls?.saves.includes(b) ? 1 : 0) - (d.cls?.saves.includes(a) ? 1 : 0) || d.saveBonus(b) - d.saveBonus(a));
  const seg = (m: RollMode) => (adv === m ? 'segbtn is-on' : 'segbtn');

  return (
    <div className="screen">
      <header className="hdr">
        <h1>Dice</h1>
        <button className="gr-btn gr-btn--secondary gr-btn--small" style={{ height: 40 }} onClick={() => { setPool(EMPTY()); setMod(0); setAdv('normal'); setLast(null); }}>Clear</button>
      </header>

      <main className="scroll">
        <div className="col" style={{ flex: 'none', minHeight: '100%', boxSizing: 'border-box', padding: 16, gap: 14 }}>
          <section className="panel panel--sm">
            <button className="tblhead" onClick={() => setTableOpen((v) => !v)} aria-expanded={tableOpen} aria-controls="checkTable">
              <span style={{ flex: 1, font: '600 16px/1.2 var(--font-heading)' }}>Checks and saves</span>
              <span className="muted">{tableOpen ? 'Hide' : '18 skills · 6 saves'}</span>
              <svg className={tableOpen ? 'chev up' : 'chev'} viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {tableOpen && (
              <div id="checkTable">
                <div className="tsec"><span>Skill checks</span><span>Tap to roll · gold = proficient</span></div>
                <div className="tgrid" role="group" aria-label="Skill checks">
                  {skills.map((s) => {
                    const key = `skill:${s.id}`, b = d.skill(s.id);
                    return (
                      <button key={s.id} className={`tcell${prof(s.id)}${last === key ? ' is-on' : ''}`} onClick={() => rollCheck(key, `${s.name} check`, b)} aria-label={`Roll ${s.name} check ${signed(b)}`}>
                        <i className="pip" /><span className="tname">{s.name}</span><span className="tmod">{signed(b)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="tsec"><span>Saving throws</span></div>
                <div className="tgrid tgrid--3" role="group" aria-label="Saving throws">
                  {saves.map((a) => {
                    const key = `save:${a}`, b = d.saveBonus(a);
                    return (
                      <button key={a} className={`tcell${d.cls?.saves.includes(a) ? ' prof' : ''}${last === key ? ' is-on' : ''}`} onClick={() => rollCheck(key, `${ABILITY_NAMES[a]} save`, b)} aria-label={`Roll ${ABILITY_NAMES[a]} save ${signed(b)}`}>
                        <i className="pip" /><span className="tname">{a.charAt(0).toUpperCase() + a.slice(1)}</span><span className="tmod">{signed(b)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="tsec"><span>Ability checks</span></div>
                <div className="tgrid tgrid--3" role="group" aria-label="Ability checks">
                  {ABILITIES.map((a) => {
                    const key = `check:${a}`, b = d.check(a);
                    return (
                      <button key={a} className={`tcell${last === key ? ' is-on' : ''}`} onClick={() => rollCheck(key, `${ABILITY_NAMES[a]} check`, b)} aria-label={`Roll ${ABILITY_NAMES[a]} check ${signed(b)}`}>
                        <i className="pip" /><span className="tname">{a.charAt(0).toUpperCase() + a.slice(1)}</span><span className="tmod">{signed(b)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px 12px' }} role="group" aria-label="Dice">
            {SIDES.map((n) => (
              <div key={n} className="diecell">
                <button className={pool[n] ? 'gr-die is-on' : 'gr-die'} onClick={() => setPool((p) => ({ ...p, [n]: Math.min(9, p[n] + 1) }))} aria-label={`Add d${n}`}>
                  <Icon d={DIE_ICON[n]} />d{n}
                </button>
                {pool[n] > 0 && (
                  <>
                    <span className="cnt" aria-hidden="true">{pool[n]}</span>
                    <button className="dec" onClick={() => setPool((p) => ({ ...p, [n]: Math.max(0, p[n] - 1) }))} aria-label={`Remove one d${n}`}><Icon name="minus" /></button>
                  </>
                )}
              </div>
            ))}
            <div className="gr-stepper" style={{ width: '100%', height: 64, boxSizing: 'border-box', flexDirection: 'column', alignSelf: 'stretch' }}>
              <span style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', paddingTop: 4, color: 'var(--text-muted)' }}>MOD</span>
              <div style={{ display: 'flex', flex: 1, alignItems: 'stretch', borderTop: '2px solid var(--ink)' }}>
                <button onClick={() => setMod((m) => Math.max(-10, m - 1))} aria-label="Lower modifier" style={{ flex: 1, width: 'auto', border: 0, borderRight: '2px solid var(--ink)' }}><Icon name="minus" style={{ width: 14, height: 14 }} /></button>
                <output style={{ minWidth: 28, fontSize: 15 }}>{signed(mod)}</output>
                <button onClick={() => setMod((m) => Math.min(20, m + 1))} aria-label="Raise modifier" style={{ flex: 1, width: 'auto', border: 0, borderLeft: '2px solid var(--ink)' }}><Icon name="plus" style={{ width: 14, height: 14 }} /></button>
              </div>
            </div>
          </div>

          <div role="group" aria-label="d20 mode" className="seg">
            <button className={seg('normal')} onClick={() => setAdv('normal')} aria-pressed={adv === 'normal'}>Normal</button>
            <button className={seg('advantage')} onClick={() => setAdv('advantage')} aria-pressed={adv === 'advantage'}>Advantage</button>
            <button className={seg('disadvantage')} onClick={() => setAdv('disadvantage')} aria-pressed={adv === 'disadvantage'}>Disadvantage</button>
          </div>
          {d.d20Penalty !== 0 && <span className="muted">Exhaustion {c.exhaustion}: {d.d20Penalty} is included in checks and saves.</span>}

          {c.rollLog.length > 0 && (
            <span className="row muted" style={{ justifyContent: 'center', gap: 6 }}>
              Scroll for recent rolls<Icon name="chevDown" style={{ width: 14, height: 14 }} />
            </span>
          )}
        </div>

        {c.rollLog.length > 0 && (
          <section className="col" style={{ flex: 'none', padding: '4px 16px 24px', gap: 8 }}>
            <h2 className="gr-label" style={{ margin: 0 }}>Recent rolls</h2>
            <div className="panel" style={{ boxShadow: 'none' }}>
              {c.rollLog.slice(0, 15).map((h) => (
                <div key={h.id} className="hist">
                  <span className="num" style={{ fontSize: 20, minWidth: 36, color: h.crit === 'hit' ? 'var(--accent)' : h.crit === 'miss' ? 'var(--rubric)' : undefined }}>{h.total}</span>
                  <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <span style={{ fontWeight: 700 }}>{h.label}</span>
                    <span className="muted">{prettyExpr(h.expression)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="foot">
        <button className="gr-btn gr-btn--roll" style={{ width: '100%', height: 52, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden' }} onClick={rollPool} disabled={!expr}>
          <Icon name="d20" />{expr ? `Roll ${shownFormula}` : 'Pick dice to roll'}
        </button>
      </div>
      <TabBar />
      {overlay.overlay}
    </div>
  );
}
