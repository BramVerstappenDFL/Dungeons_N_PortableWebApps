import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Ability, AbilityScores, Character, CreationInfo, ScoreMethod } from '../types';
import { BACKGROUNDS, CLASSES, SPECIES, backgroundById, classById } from '../data';
import {
  ABILITIES, ABILITY_NAMES, POINT_BUY_BUDGET, POINT_BUY_COST, SKILLS, STANDARD_ARRAY,
  abilityMod, defaultMaxHp, pointBuySpent,
} from '../rules/abilities';
import { signed } from '../rules/dice';
import { uid, useCharacter, useStore } from '../store/characters';
import { Stepper } from '../components/Stepper';

const BASE_DEFAULT: Record<ScoreMethod, AbilityScores> = {
  standard: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  pointbuy: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
  manual: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
};

export function CharacterEditor() {
  const { id } = useParams();
  const existing = useCharacter(id);
  const navigate = useNavigate();
  const { add, update } = useStore.getState();

  const [name, setName] = useState(existing?.name ?? '');
  const [classId, setClassId] = useState(existing?.classId ?? 'fighter');
  const [level, setLevel] = useState(existing?.level ?? 1);
  const [speciesId, setSpeciesId] = useState(existing?.speciesId ?? 'human');
  const [backgroundId, setBackgroundId] = useState(existing?.backgroundId ?? 'soldier');
  const [method, setMethod] = useState<ScoreMethod>(existing?.creation?.method ?? (existing ? 'manual' : 'standard'));
  const [base, setBase] = useState<AbilityScores>(existing?.creation?.base ?? existing?.abilities ?? BASE_DEFAULT.standard);
  const [boosts, setBoosts] = useState<Partial<Record<Ability, number>>>(existing?.creation?.boosts ?? {});
  const [classSkills, setClassSkills] = useState<string[]>(() => {
    if (!existing) return [];
    const bg = backgroundById(existing.backgroundId);
    return existing.skills.filter((s) => !bg?.skills.includes(s));
  });
  const [expertise, setExpertise] = useState<string[]>(existing?.expertise ?? []);
  const [hpAuto, setHpAuto] = useState(existing?.creation?.hpAuto ?? !existing);
  const [hpManual, setHpManual] = useState(existing?.hp.max ?? 10);
  const [acManual, setAcManual] = useState<number | null>(existing?.armorClass ?? null);
  const [error, setError] = useState('');

  const cls = classById(classId)!;
  const bg = backgroundById(backgroundId);
  const bgAbilities: Ability[] = bg?.abilities.length ? bg.abilities : ABILITIES;
  const final = useMemo(
    () => Object.fromEntries(ABILITIES.map((a) => [a, Math.min(20, base[a] + (boosts[a] ?? 0))])) as AbilityScores,
    [base, boosts],
  );
  const autoHp = defaultMaxHp(cls.hitDie, level, final.con);
  const maxHp = hpAuto ? autoHp : hpManual;
  const ac = acManual ?? 10 + abilityMod(final.dex);
  const bgSkills = bg?.skills ?? [];
  const skillPool = (cls.skillOptions ?? SKILLS.map((s) => s.id)).filter((s) => !bgSkills.includes(s));
  const boostTotal = Object.values(boosts).reduce((a, b) => a + (b ?? 0), 0);
  const boostValid = boostTotal === 3 && Object.values(boosts).every((v) => (v ?? 0) <= 2);
  const spent = pointBuySpent(base);
  const usedStd = ABILITIES.map((a) => base[a]);
  const stdValid = method !== 'standard' || [...usedStd].sort().join() === [...STANDARD_ARRAY].sort().join();

  const changeMethod = (m: ScoreMethod) => { setMethod(m); setBase(BASE_DEFAULT[m]); };
  const changeBackground = (b: string) => { setBackgroundId(b); setBoosts({}); setClassSkills((s) => s.filter((x) => !backgroundById(b)?.skills.includes(x))); };
  const changeClass = (cId: string) => { setClassId(cId); setClassSkills([]); };
  const setBoost = (a: Ability, v: number) => setBoosts((b) => ({ ...b, [a]: v }));
  const toggleSkill = (s: string) =>
    setClassSkills((list) => (list.includes(s) ? list.filter((x) => x !== s) : list.length < cls.skillCount ? [...list, s] : list));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Give your character a name.');
    if (method === 'pointbuy' && spent > POINT_BUY_BUDGET) return setError('You have spent more than 27 points.');
    if (!stdValid) return setError('Use each Standard Array value (15, 14, 13, 12, 10, 8) exactly once.');
    if (!boostValid) return setError('Distribute background ability increases: +2/+1 or +1/+1/+1.');
    const skills = [...new Set([...bgSkills, ...classSkills])];
    const creation: CreationInfo = { method, base, boosts, hpAuto };
    const now = Date.now();
    if (existing) {
      update(existing.id, (c) => {
        const hpDiff = maxHp - c.hp.max;
        return {
          ...c, name: name.trim(), classId, level, speciesId, backgroundId, abilities: final, skills,
          expertise: expertise.filter((x) => skills.includes(x)), armorClass: ac, creation,
          hp: { ...c.hp, max: maxHp, current: Math.max(0, Math.min(maxHp, c.hp.current + Math.max(0, hpDiff))) },
          hitDiceUsed: Math.min(c.hitDiceUsed, level),
        };
      });
      navigate(`/c/${existing.id}`);
    } else {
      const c: Character = {
        id: uid(), name: name.trim(), classId, level, speciesId, backgroundId, abilities: final, skills,
        expertise: expertise.filter((x) => skills.includes(x)), armorClass: ac,
        hp: { max: maxHp, current: maxHp, temp: 0 }, hitDiceUsed: 0, deathSaves: { successes: 0, failures: 0 },
        exhaustion: 0, conditions: [], spellSlotsUsed: Array(9).fill(0), spells: [], concentration: null,
        inventory: [], currency: { cp: 0, sp: 0, ep: 0, gp: 15, pp: 0 }, rollLog: [], notes: '', creation,
        createdAt: now, updatedAt: now,
      };
      add(c);
      navigate(`/c/${c.id}`);
    }
  };

  return (
    <form className="page editor" onSubmit={save}>
      <div className="page-head">
        <h1>{existing ? `Edit ${existing.name}` : 'New Character'}</h1>
      </div>

      <section className="card form">
        <h3 className="card-title">1 · Basics</h3>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Elara Moonwhisper" autoFocus={!existing} /></label>
        <div className="form-row">
          <label>Class
            <select value={classId} onChange={(e) => changeClass(e.target.value)}>
              {CLASSES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Level<Stepper value={level} min={1} max={20} onChange={setLevel} label="Level" /></label>
        </div>
        <div className="form-row">
          <label>Species
            <select value={speciesId} onChange={(e) => setSpeciesId(e.target.value)}>
              {SPECIES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>Background
            <select value={backgroundId} onChange={(e) => changeBackground(e.target.value)}>
              {BACKGROUNDS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              <option value="custom">Custom background</option>
            </select>
          </label>
        </div>
        <p className="muted small">
          d{cls.hitDie} Hit Die · Saves: {cls.saves.map((s) => s.toUpperCase()).join(', ')}
          {cls.spellAbility ? ` · Spellcasting: ${ABILITY_NAMES[cls.spellAbility]}` : ''}
        </p>
      </section>

      <section className="card form">
        <h3 className="card-title">2 · Ability Scores</h3>
        <div className="segmented" role="radiogroup" aria-label="Score method">
          {(['standard', 'pointbuy', 'manual'] as ScoreMethod[]).map((m) => (
            <button type="button" key={m} role="radio" aria-checked={method === m} className={method === m ? 'active' : ''} onClick={() => changeMethod(m)}>
              {m === 'standard' ? 'Standard Array' : m === 'pointbuy' ? 'Point Buy' : 'Manual'}
            </button>
          ))}
        </div>
        {method === 'pointbuy' && <p className={`small ${spent > POINT_BUY_BUDGET ? 'error' : 'muted'}`}>Points spent: {spent} / {POINT_BUY_BUDGET}</p>}
        {method === 'standard' && !stdValid && <p className="small error">Assign each of 15, 14, 13, 12, 10, 8 once.</p>}
        <div className="score-grid">
          {ABILITIES.map((a) => (
            <div key={a} className="score-cell">
              <span className="label">{ABILITY_NAMES[a]}</span>
              {method === 'standard' && (
                <select value={base[a]} onChange={(e) => setBase({ ...base, [a]: Number(e.target.value) })} aria-label={ABILITY_NAMES[a]}>
                  {STANDARD_ARRAY.map((v) => <option key={v} value={v}>{v}{usedStd.filter((x) => x === v).length > 1 ? ' (dup)' : ''}</option>)}
                </select>
              )}
              {method === 'pointbuy' && (
                <Stepper value={base[a]} min={8} max={15} label={ABILITY_NAMES[a]} onChange={(v) => setBase({ ...base, [a]: v })} />
              )}
              {method === 'manual' && (
                <Stepper value={base[a]} min={1} max={20} label={ABILITY_NAMES[a]} onChange={(v) => setBase({ ...base, [a]: v })} />
              )}
              {method === 'pointbuy' && <span className="muted small">cost {POINT_BUY_COST[base[a]]}</span>}
              <span className="final-score">
                {final[a]} <span className="muted">({signed(abilityMod(final[a]))})</span>
              </span>
            </div>
          ))}
        </div>
        <h4>Background increases <span className="muted small">(+2 and +1, or +1 to three)</span></h4>
        <div className="boosts">
          {bgAbilities.map((a) => (
            <label key={a} className="boost">
              <span>{a.toUpperCase()}</span>
              <select value={boosts[a] ?? 0} onChange={(e) => setBoost(a, Number(e.target.value))}>
                <option value={0}>+0</option><option value={1}>+1</option><option value={2}>+2</option>
              </select>
            </label>
          ))}
        </div>
        {!boostValid && <p className="small muted">Assigned {boostTotal} / 3 points.</p>}
      </section>

      <section className="card form">
        <h3 className="card-title">3 · Skills</h3>
        {bgSkills.length > 0 && <p className="small muted">From background: {bgSkills.map((s) => SKILLS.find((x) => x.id === s)?.name).join(', ')}</p>}
        <p className="small">Choose {cls.skillCount} class skills ({classSkills.length}/{cls.skillCount})</p>
        <div className="chips">
          {skillPool.map((s) => (
            <button type="button" key={s} className={`chip ${classSkills.includes(s) ? 'active' : ''}`} aria-pressed={classSkills.includes(s)} onClick={() => toggleSkill(s)}>
              {SKILLS.find((x) => x.id === s)?.name}
            </button>
          ))}
        </div>
        {[...bgSkills, ...classSkills].length > 0 && (
          <>
            <p className="small mt">Expertise <span className="muted">(optional, e.g. Rogue/Bard)</span></p>
            <div className="chips">
              {[...bgSkills, ...classSkills].map((s) => (
                <button type="button" key={s} className={`chip ${expertise.includes(s) ? 'active' : ''}`} aria-pressed={expertise.includes(s)}
                  onClick={() => setExpertise((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s]))}>
                  {SKILLS.find((x) => x.id === s)?.name}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card form">
        <h3 className="card-title">4 · Hit Points & Armor</h3>
        <label className="check"><input type="checkbox" checked={hpAuto} onChange={(e) => { setHpAuto(e.target.checked); setHpManual(autoHp); }} /> Calculate max HP automatically (fixed average)</label>
        <div className="form-row">
          <label>Max HP
            {hpAuto ? <input value={autoHp} readOnly /> : <input type="number" inputMode="numeric" min={1} value={hpManual} onChange={(e) => setHpManual(Math.max(1, Number(e.target.value) || 1))} />}
          </label>
          <label>Armor Class
            <input type="number" inputMode="numeric" min={0} value={ac} onChange={(e) => setAcManual(Number(e.target.value) || 0)} />
          </label>
        </div>
        <p className="muted small">AC defaults to 10 + DEX modifier (no armor). Update it after equipping armor.</p>
      </section>

      {error && <p className="error">{error}</p>}
      <div className="row sticky-actions">
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
        <button type="submit" className="btn btn-primary grow">{existing ? 'Save changes' : 'Create character'}</button>
      </div>
    </form>
  );
}
