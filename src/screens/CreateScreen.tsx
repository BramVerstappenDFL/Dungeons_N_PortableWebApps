import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Ability, AbilityScores } from '../types';
import { BACKGROUNDS, CLASSES, SPECIES, backgroundById, classById, speciesById } from '../data';
import { uid, useStore } from '../store/characters';
import { ABILITIES, ABILITY_NAMES, POINT_BUY_BUDGET, POINT_BUY_COST, abilityMod, defaultMaxHp, pointBuySpent, skillName } from '../rules/abilities';
import { applyBoosts, boostsValid, buildCharacter } from '../rules/create';
import { Icon } from '../ui/Icon';
import { cap, signed, excerpt } from '../ui/format';
import './create.css';

const STEPS = ['Basics', 'Class', 'Abilities', 'Review'];
/** The ability each class leans on most, for hints and the default background boost. */
const KEY_ABILITY: Record<string, Ability> = {
  barbarian: 'str', fighter: 'str', paladin: 'str', monk: 'dex', rogue: 'dex', ranger: 'dex',
  bard: 'cha', sorcerer: 'cha', warlock: 'cha', cleric: 'wis', druid: 'wis', wizard: 'int',
};
const SPECIES_TRAIT: Record<string, string> = {
  dragonborn: 'Breath weapon', dwarf: 'Poison resistance', elf: 'Darkvision, trance', gnome: 'Gnomish cunning',
  goliath: 'Giant ancestry', halfling: 'Luck', human: 'Resourceful, skillful', orc: 'Relentless endurance', tiefling: 'Fiendish legacy',
};

/** Default +2/+1: the class key ability if the background offers it, then the best other option. */
function defaultBoosts(allowed: Ability[], key: Ability, base: AbilityScores): Partial<Record<Ability, number>> {
  if (!allowed.length) return {};
  const sorted = [...allowed].sort((a, b) => (a === key ? -1 : b === key ? 1 : base[b] - base[a]));
  return { [sorted[0]]: 2, [sorted[1]]: 1 };
}

export function CreateScreen() {
  const add = useStore((s) => s.add);
  const hasCharacters = useStore((s) => s.characters.length > 0);
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [speciesId, setSpeciesId] = useState(SPECIES.find((s) => s.id === 'human')?.id ?? SPECIES[0].id);
  const [backgroundId, setBackgroundId] = useState(BACKGROUNDS[0].id);
  const [classId, setClassId] = useState('fighter');
  const [classSkills, setClassSkills] = useState<string[]>([]);
  const [scores, setScores] = useState<AbilityScores>({ str: 15, dex: 14, con: 13, int: 8, wis: 12, cha: 10 });
  const [boosts, setBoosts] = useState<Partial<Record<Ability, number>> | null>(null);

  const cls = classById(classId)!;
  const bg = backgroundById(backgroundId)!;
  const species = speciesById(speciesId)!;
  const key = KEY_ABILITY[classId] ?? 'str';
  const effBoosts = boosts ?? defaultBoosts(bg.abilities, key, scores);
  const final = applyBoosts(scores, effBoosts);
  const left = POINT_BUY_BUDGET - pointBuySpent(scores);
  const skillPool = (cls.skillOptions ?? []).filter((s) => !bg.skills.includes(s));
  const skillsOk = classSkills.length === Math.min(cls.skillCount, skillPool.length);

  const setScore = (a: Ability, delta: number) => {
    const v = scores[a] + delta;
    if (v < 8 || v > 15) return;
    const next = { ...scores, [a]: v };
    if (pointBuySpent(next) > POINT_BUY_BUDGET) return;
    setScores(next);
  };
  const toggleSkill = (s: string) =>
    setClassSkills((l) => (l.includes(s) ? l.filter((x) => x !== s) : l.length < cls.skillCount ? [...l, s] : l));
  /** Picks the +2 or the +1 ability; the other one moves out of the way. */
  const pickBoost = (a: Ability, amount: 1 | 2) => {
    const find = (v: number) => (Object.keys(effBoosts) as Ability[]).find((k) => effBoosts[k] === v);
    let two = find(2), one = find(1);
    if (!two) one = undefined; // was +1/+1/+1
    if (amount === 2) two = a; else one = a;
    const other = (not?: Ability) => bg.abilities.find((x) => x !== not)!;
    if (amount === 2 && (!one || one === a)) one = other(a);
    if (amount === 1 && (!two || two === a)) two = other(a);
    setBoosts({ [two!]: 2, [one!]: 1 });
  };
  const spread = () => setBoosts(Object.fromEntries(bg.abilities.map((a) => [a, 1])));

  const canNext = step === 0 ? !!name.trim() : step === 1 ? skillsOk : step === 2 ? boostsValid(effBoosts, bg.abilities) : true;
  const create = () => {
    add(buildCharacter({
      id: uid(), name, speciesId, backgroundId, classId, base: scores, boosts: effBoosts,
      classSkills, backgroundSkills: bg.skills, now: Date.now(),
    }));
    nav('/', { replace: true });
  };
  const conMod = abilityMod(final.con), dexMod = abilityMod(final.dex);

  return (
    <div className="screen">
      <header className="hdr" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div className="row" style={{ gap: 12 }}>
          {hasCharacters && (
            <Link to="/" className="gr-btn gr-btn--secondary gr-btn--icon ico-btn" aria-label="Close"><Icon name="close" /></Link>
          )}
          <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <h1 className="sub" style={{ margin: 0, font: '600 22px/1.15 var(--font-heading)' }}>New character</h1>
            <span className="muted">Step {step + 1} of 4 · {STEPS[step]}</span>
          </div>
        </div>
        <div className="row" style={{ gap: 6 }} aria-hidden="true">
          {STEPS.map((s, i) => <span key={s} className={i <= step ? 'progress-seg on' : 'progress-seg'} />)}
        </div>
      </header>

      <main className="scroll" style={{ padding: '20px 16px 24px', gap: 20 }}>
        {step === 0 && (
          <>
            {!hasCharacters && (
              <div className="gr-notice gr-hint">
                <Icon name="info" />
                <span><b>Welcome</b>Build a level 1 hero in four steps. Everything is saved on this device.</span>
              </div>
            )}
            <div className="gr-field" style={{ width: '100%' }}>
              <label htmlFor="charName" className="gr-label">Name</label>
              <input id="charName" className="gr-input" style={{ height: 48 }} placeholder="What does the table call you?" value={name}
                onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </div>
            <div className="col" style={{ gap: 8 }}>
              <span className="gr-label">Species</span>
              <div className="panel">
                {SPECIES.map((s) => (
                  <button key={s.id} className={s.id === speciesId ? 'pick is-on' : 'pick'} onClick={() => setSpeciesId(s.id)} aria-pressed={s.id === speciesId}>
                    <i className="gr-row__pip" />
                    <span style={{ flex: 1 }}>{s.name}</span>
                    <span className="muted" style={{ fontWeight: 400 }}>{SPECIES_TRAIT[s.id] ?? `Speed ${s.speed} ft`}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="col" style={{ gap: 8 }}>
              <span className="gr-label">Background</span>
              <div className="panel">
                {BACKGROUNDS.map((b) => (
                  <button key={b.id} className={b.id === backgroundId ? 'pick is-on' : 'pick'} aria-pressed={b.id === backgroundId}
                    onClick={() => { setBackgroundId(b.id); setBoosts(null); setClassSkills((l) => l.filter((x) => !b.skills.includes(x))); }}>
                    <i className="gr-row__pip" />
                    <span style={{ flex: 1 }}>{b.name}</span>
                    <span className="muted" style={{ fontWeight: 400, textAlign: 'right' }}>{b.skills.map(skillName).join(', ')}</span>
                  </button>
                ))}
              </div>
              <span className="muted">{excerpt(bg.description.split('**Equipment:**')[0], 160)}</span>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="col" style={{ gap: 12 }}>
              <span className="gr-label">Class</span>
              <div className="grid2">
                {CLASSES.map((k) => (
                  <button key={k.id} className={k.id === classId ? 'cls is-on' : 'cls'} aria-pressed={k.id === classId}
                    onClick={() => { setClassId(k.id); setClassSkills([]); setBoosts(null); }}>
                    <span style={{ font: '600 18px/1.15 var(--font-heading)' }}>{k.name}</span>
                    <span className="muted">Hit die d{k.hitDie}</span>
                    <span className="muted">Key: {ABILITY_NAMES[KEY_ABILITY[k.id] ?? 'str']}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="col" style={{ gap: 8 }}>
              <div className="row" style={{ alignItems: 'baseline' }}>
                <span className="gr-label" style={{ flex: 1 }}>{cls.name} skills</span>
                <span className="muted">{classSkills.length} of {Math.min(cls.skillCount, skillPool.length)}</span>
              </div>
              <div className="chips" role="group" aria-label="Class skills">
                {skillPool.map((s) => (
                  <button key={s} className={`gr-chip filter${classSkills.includes(s) ? ' is-on' : ''}`} aria-pressed={classSkills.includes(s)} onClick={() => toggleSkill(s)}>
                    {skillName(s)}
                  </button>
                ))}
              </div>
              <span className="muted">Your background already gives {bg.skills.map(skillName).join(' and ')}.</span>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="col" style={{ gap: 12 }}>
            <div className="panel panel--sm row" style={{ gap: 12, padding: 12, boxShadow: 'var(--shadow-sm)' }}>
              <div className="col" style={{ gap: 2, flex: 1 }}>
                <span style={{ fontWeight: 700 }}>Point buy</span>
                <span className="muted">Scores 8 to 15. 14 and 15 cost 2 points each.</span>
              </div>
              <span className="num" style={{ fontSize: 30 }}>{left}</span>
              <span className="gr-label" style={{ fontSize: 11 }}>left</span>
            </div>
            <div className="panel">
              {ABILITIES.map((a) => {
                const cost = POINT_BUY_COST[scores[a] + 1] - POINT_BUY_COST[scores[a]];
                return (
                  <div key={a} className="abrow">
                    <span style={{ width: 92, fontWeight: 700 }}>{ABILITY_NAMES[a]}</span>
                    <span className="num" style={{ width: 44, fontSize: 15, color: 'var(--text-muted)' }}>
                      {signed(abilityMod(final[a]))}{effBoosts[a] ? <sup style={{ fontSize: 10, color: 'var(--accent)' }}> +{effBoosts[a]}</sup> : null}
                    </span>
                    <div className="gr-stepper" style={{ marginLeft: 'auto', height: 44 }}>
                      <button onClick={() => setScore(a, -1)} aria-label={`Lower ${ABILITY_NAMES[a]}`} disabled={scores[a] <= 8}><Icon name="minus" /></button>
                      <output>{scores[a]}</output>
                      <button onClick={() => setScore(a, 1)} aria-label={`Raise ${ABILITY_NAMES[a]}`} disabled={scores[a] >= 15 || cost > left}><Icon name="plus" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <section className="gr-window" style={{ '--tincture': 'var(--tincture-3)', width: '100%' } as CSSProperties}>
              <div className="gr-window__head"><i className="gr-window__mark" /><div className="gr-window__title"><span>{bg.name} increases</span></div></div>
              <div className="gr-window__body" style={{ gap: 10 }}>
                {([2, 1] as const).map((amt) => (
                  <div key={amt} className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <span className="num" style={{ width: 28, fontSize: 16 }}>+{amt}</span>
                    {bg.abilities.map((a) => (
                      <button key={a} className={`gr-chip filter${effBoosts[a] === amt ? ' is-on' : ''}`} aria-pressed={effBoosts[a] === amt} onClick={() => pickBoost(a, amt)}>
                        {ABILITY_NAMES[a]}
                      </button>
                    ))}
                  </div>
                ))}
                <button className="gr-btn gr-btn--secondary gr-btn--small" style={{ alignSelf: 'flex-start' }} onClick={spread}>+1 to all three instead</button>
              </div>
            </section>
            <div className="gr-notice gr-hint">
              <Icon name="info" />
              <span>Put your highest score in {ABILITY_NAMES[key]} for a {cls.name.toLowerCase()}.</span>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="col" style={{ gap: 16 }}>
            <section className="gr-window" style={{ '--tincture': 'var(--tincture-4)', width: '100%' } as CSSProperties}>
              <div className="gr-window__head"><i className="gr-window__mark" /><div className="gr-window__title"><span>{name.trim() || 'Unnamed hero'}</span></div></div>
              <div className="gr-window__body">
                <span style={{ fontSize: 16 }}>Level 1 · {species.name} {cls.name.toLowerCase()} · {bg.name}</span>
                <div className="grid3">
                  {[['HP', defaultMaxHp(cls.hitDie, 1, final.con)], ['AC', 10 + dexMod], ['Init', signed(dexMod)]].map(([k, v]) => (
                    <div key={k} className="stat" style={{ background: 'var(--bg)' }}><span className="gr-label">{k}</span><span className="num" style={{ fontSize: 22 }}>{v}</span></div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4 }}>
                  {ABILITIES.map((a) => (
                    <div key={a} className="col" style={{ alignItems: 'center', border: '2px solid var(--ink)' }}>
                      <span style={{ width: '100%', textAlign: 'center', background: 'var(--ink)', color: 'var(--paper)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', padding: '3px 0' }}>{a.toUpperCase()}</span>
                      <span className="num" style={{ fontSize: 18, lineHeight: 1.3 }}>{signed(abilityMod(final[a]))}</span>
                      <span className="muted" style={{ paddingBottom: 4 }}>{final[a]}</span>
                    </div>
                  ))}
                </div>
                <span className="muted">Skills: {[...new Set([...bg.skills, ...classSkills])].map(skillName).join(', ')}. Saves: {cls.saves.map(cap).join(', ')}.</span>
              </div>
            </section>
            <div className="gr-notice gr-ok">
              <Icon name="check" />
              <span><b>Ready for the table</b>Equipment and spells can be added from the sheet. HP starts at {defaultMaxHp(cls.hitDie, 1, final.con)} ({cls.hitDie} {signed(conMod)} CON).</span>
            </div>
          </div>
        )}
      </main>

      <footer className="foot foot--lg grid2" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
        <button className="gr-btn gr-btn--secondary" style={{ height: 48 }} onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <Icon name="back" />Back
        </button>
        {step < 3 ? (
          <button className="gr-btn gr-btn--primary" style={{ height: 48 }} onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            Next<Icon name="next" />
          </button>
        ) : (
          <button className="gr-btn gr-btn--primary" style={{ height: 48 }} onClick={create}><Icon name="check" />Create character</button>
        )}
      </footer>
    </div>
  );
}

