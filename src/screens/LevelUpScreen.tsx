import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Ability, Character } from '../types';
import { CLASSES, FEATS, classById, featById, subclassById, subclassesFor } from '../data';
import { classLevelOf, multiclassBlocker, multiclassNeeds } from '../rules/classes';
import { useStore } from '../store/characters';
import { ABILITIES, ABILITY_NAMES, SKILLS, abilityMod, skillName } from '../rules/abilities';
import {
  MAX_LEVEL, applyAsi, applyLevelUp, asiComplete, levelUpPlan, pendingLevels, subclassOf, type AsiChoice, type LevelUpChoices,
} from '../rules/progression';
import { derive } from '../rules/derived';
import { Icon } from '../ui/Icon';
import { cap, excerpt, ordinal, signed } from '../ui/format';
import { reducedMotion } from '../ui/theme';
import { useSpells } from '../ui/useSpells';
import { useRollOverlay } from '../ui/RollOverlay';
import { popupFromRoll } from '../ui/format';
import { OriginRow, SealProgress, SourceTag, Tick, WaxSeal } from './create/parts';
import './create.css';
import './levelup.css';

type StepId = 'class' | 'hp' | 'subclass' | 'features' | 'asi' | 'style' | 'cantrips' | 'review';
const STEP_NAMES: Record<StepId, string> = {
  class: 'Class', hp: 'Hit points', subclass: 'Subclass', features: 'New features', asi: 'Improvement', style: 'Fighting style', cantrips: 'Cantrips', review: 'Review',
};

/** Remounts for each level, so a character with several levels ready goes through them one by one. */
export function LevelUpRoute({ c }: { c: Character }) {
  return <LevelUpScreen key={c.level} c={c} />;
}

function LevelUpScreen({ c }: { c: Character }) {
  const update = useStore((s) => s.update);
  const roll = useStore((s) => s.roll);
  const nav = useNavigate();
  const overlay = useRollOverlay();
  const spells = useSpells();
  const mainRef = useRef<HTMLElement>(null);
  const d = derive(c);

  // The class that takes this level: one the character has, or a new one (multiclassing).
  const [classId, setClassId] = useState(c.classId);
  const [subclassId, setSubclassId] = useState<string | undefined>(c.subclassId);
  const plan = levelUpPlan(c, subclassId, classId);
  const cls = classById(classId);
  const pickClass = (id: string) => {
    setClassId(id);
    setSubclassId(subclassOf(c, id));
    // Choices made for another class no longer apply.
    setHp(undefined); setStyle(undefined); setCantrips([]); setPlus2(undefined); setPlus1([]); setFeatId(undefined);
  };
  const [hp, setHp] = useState<LevelUpChoices['hp'] | undefined>();
  const [asiKind, setAsiKind] = useState<AsiChoice['kind']>(plan.epicBoon ? 'feat' : 'plus2');
  const [plus2, setPlus2] = useState<Ability | undefined>();
  const [plus1, setPlus1] = useState<Ability[]>([]);
  const [featId, setFeatId] = useState<string | undefined>();
  const [featAbility, setFeatAbility] = useState<Ability | undefined>();
  const [skill, setSkill] = useState<string | undefined>();
  const [expertise, setExpertise] = useState<string | undefined>();
  const [style, setStyle] = useState<string | undefined>();
  const [cantrips, setCantrips] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [sealing, setSealing] = useState(false);

  const steps: StepId[] = [
    'class', 'hp', ...(plan.subclass ? ['subclass' as const] : []), 'features',
    ...(plan.asi || plan.epicBoon ? ['asi' as const] : []), ...(plan.fightingStyle ? ['style' as const] : []),
    ...(plan.newCantrips ? ['cantrips' as const] : []), 'review',
  ];
  const id = steps[step];
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [step]);

  const asi: AsiChoice | undefined =
    asiKind === 'plus2' ? (plus2 ? { kind: 'plus2', ability: plus2 } : undefined)
      : asiKind === 'plus1' ? (plus1.length === 2 ? { kind: 'plus1', abilities: [plus1[0], plus1[1]] } : undefined)
        : featId ? { kind: 'feat', featId, ability: featAbility, skill, expertise } : undefined;
  const choices: LevelUpChoices = {
    hp: hp ?? { mode: 'average' }, classId, subclassId, asi, fightingStyle: style, cantrips,
  };
  const preview = useMemo(() => applyLevelUp(c, choices), [c, hp, classId, subclassId, asiKind, plus2, plus1, featId, featAbility, skill, expertise, style, cantrips]); // eslint-disable-line react-hooks/exhaustive-deps
  const after = derive(preview);
  const scores = applyAsi(c.abilities, plan.asi || plan.epicBoon ? asi : undefined);

  const valid: Record<StepId, boolean> = {
    class: !multiclassBlocker(c, classId), hp: !!hp, subclass: !!subclassId, features: true, asi: asiComplete(asi), style: !!style,
    cantrips: cantrips.length === plan.newCantrips, review: true,
  };
  const go = (to: number) => { setDir(to > step ? 'fwd' : 'back'); setStep(to); setReached((r) => Math.max(r, to)); };

  const rollHp = () => {
    const r = roll(`1d${plan.hitDie}`, `Hit points for level ${plan.level}`, { characterId: c.id });
    if (!r) return;
    setHp({ mode: 'roll', roll: r.total });
    const [p, f] = popupFromRoll(r, `Level ${plan.level} hit die`, { kicker: `d${plan.hitDie}` });
    overlay.show({ ...p, calc: `${r.total} ${signed(plan.conMod)} CON${plan.bonusPerLevel ? ` + ${plan.bonusPerLevel} origin` : ''} = +${Math.max(1, r.total + plan.conMod) + plan.bonusPerLevel} HP` }, f);
  };

  const seal = () => {
    const finish = () => {
      update(c.id, (x) => applyLevelUp(x, choices));
      // With another level ready, the route remounts for it; otherwise back to the sheet.
      if (pendingLevels(preview) === 0) nav('/', { replace: true });
    };
    if (reducedMotion()) return finish();
    setSealing(true);
    window.setTimeout(finish, 950);
  };

  if (c.level >= MAX_LEVEL) {
    return (
      <div className="screen create-flow">
        <header className="hdr"><Link to="/" className="gr-btn gr-btn--secondary gr-btn--icon ico-btn" aria-label="Back"><Icon name="back" /></Link><h1>Level 20</h1></header>
        <main className="scroll" style={{ padding: 16 }}>
          <div className="gr-notice gr-ok"><Icon name="star" /><span><b>The highest level</b>{c.name} has reached level 20.</span></div>
        </main>
      </div>
    );
  }

  // ---- Feats available at this level ----
  const taken = new Set([c.originFeat, c.extraFeat, ...(c.feats ?? []).map((f) => f.id)]);
  const featList = FEATS.filter((f) => (plan.epicBoon ? ['epic-boon', 'general', 'origin'] : ['general', 'origin']).includes(f.category)
    && f.id !== 'ability-score-improvement' && (f.prerequisiteLevel ?? 1) <= plan.level && (!taken.has(f.id) || f.repeatable))
    .sort((a, b) => (a.category === 'epic-boon' ? -1 : 0) - (b.category === 'epic-boon' ? -1 : 0) || a.name.localeCompare(b.name));
  const feat = featById(featId);
  const styles = FEATS.filter((f) => f.category === 'fighting-style' && !taken.has(f.id));
  const cantripPool = (spells ?? []).filter((s) => s.level === 0 && s.classes.includes(classId) && !c.spells.some((k) => k.id === s.id));
  const mine = d.classes.map((x) => x.id);
  const others = CLASSES.filter((k) => !mine.includes(k.id));
  const cap20 = (a: Ability) => c.abilities[a] >= (feat?.category === 'epic-boon' ? 30 : 20);

  return (
    <div className="screen create-flow">
      <header className="hdr" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div className="row" style={{ gap: 12 }}>
          <Link to="/" className="gr-btn gr-btn--secondary gr-btn--icon ico-btn" aria-label="Close"><Icon name="close" /></Link>
          <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <h1 className="sub" style={{ margin: 0, font: '600 22px/1.15 var(--font-heading)' }}>Level {plan.level}</h1>
            <span className="muted step-label" key={step}>{c.name} · {cls?.name} {plan.classLevel} · Step {step + 1} of {steps.length} · {STEP_NAMES[id]}</span>
          </div>
          <span className="lvl-badge" aria-hidden="true"><span className="num">{plan.level}</span></span>
        </div>
        <SealProgress steps={steps.map((s) => STEP_NAMES[s])} step={step} reached={reached} onJump={go} />
      </header>

      <main ref={mainRef} className="scroll" style={{ padding: '20px 16px 28px' }}>
        <div key={step} className={`page page--${dir}`}>
          {id === 'class' && (
            <>
              <div className="gr-notice gr-hint rise" style={{ '--i': 0 } as CSSProperties}>
                <Icon name="star" />
                <span><b>Which class grows?</b>Take level {plan.level} in a class you have, or multiclass into a new one.</span>
              </div>
              <div className="grid2" role="radiogroup" aria-label="Class">
                {d.classes.map((x, i) => (
                  <button key={x.id} role="radio" aria-checked={classId === x.id} className={classId === x.id ? 'cls is-on rise' : 'cls rise'}
                    style={{ '--i': i + 1, '--tincture': `var(--tincture-${(i % 6) + 1})` } as CSSProperties} onClick={() => pickClass(x.id)}>
                    <span style={{ font: '600 16px/1.2 var(--font-heading)' }}>{classById(x.id)?.name}</span>
                    <span className="muted">Level {x.level} → {x.level + 1}</span>
                  </button>
                ))}
              </div>
              {others.length > 0 && (
                <>
                  <span className="gr-label rise" style={{ '--i': 3 } as CSSProperties}>Multiclass</span>
                  <span className="muted">You need 13 or more in the main abilities of your classes and the new one.</span>
                  <div className="grid2" role="radiogroup" aria-label="New class">
                    {others.map((k, i) => {
                      const blocked = multiclassBlocker(c, k.id);
                      const need = multiclassNeeds(k.id);
                      return (
                        <button key={k.id} role="radio" aria-checked={classId === k.id} disabled={!!blocked}
                          className={classId === k.id ? 'cls is-on rise' : 'cls rise'} title={blocked ?? undefined}
                          style={{ '--i': i + 4, '--tincture': `var(--tincture-${((i + 2) % 6) + 1})` } as CSSProperties} onClick={() => pickClass(k.id)}>
                          <span style={{ font: '600 16px/1.2 var(--font-heading)' }}>{k.name}</span>
                          <span className="muted">{blocked ? `Needs ${need.abilities.map((a) => a.toUpperCase()).join(need.any ? ' or ' : ' and ')} 13` : `d${k.hitDie} · new class`}</span>
                        </button>
                      );
                    })}
                  </div>
                  {multiclassBlocker(c, classId) && <span className="muted">{multiclassBlocker(c, classId)}.</span>}
                </>
              )}
            </>
          )}

          {id === 'hp' && (
            <>
              <div className="panel panel--sm row rise" style={{ gap: 12, padding: 12, '--i': 0 } as CSSProperties}>
                <div className="col" style={{ gap: 2, flex: 1 }}>
                  <span style={{ fontWeight: 700 }}>Hit point maximum</span>
                  <span className="muted">d{plan.hitDie} {signed(plan.conMod)} CON{plan.bonusPerLevel ? ` + ${plan.bonusPerLevel} from your origin` : ''}, at least 1</span>
                </div>
                <span className="num muted" style={{ fontSize: 18 }}>{c.hp.max}</span>
                <Icon name="arrowRight" />
                <Tick value={preview.hp.max} style={{ fontSize: 30 }} />
              </div>
              <div className="col" role="radiogroup" aria-label="Hit points" style={{ gap: 10 }}>
                <button role="radio" aria-checked={hp?.mode === 'average'} disabled={hp?.mode === 'roll'}
                  className={hp?.mode === 'average' ? 'kit is-on rise' : 'kit rise'} style={{ '--i': 1 } as CSSProperties} onClick={() => setHp({ mode: 'average' })}>
                  <span className="kit__badge num">{plan.hpAverage}</span>
                  <span className="col" style={{ gap: 2, flex: 1 }}>
                    <span style={{ fontWeight: 700 }}>Take the average</span>
                    <span className="muted">+{Math.max(1, plan.hpAverage + plan.conMod) + plan.bonusPerLevel} HP, every time</span>
                  </span>
                  {hp?.mode === 'average' && <Icon name="check" style={{ color: 'var(--accent)' }} />}
                </button>
                <button role="radio" aria-checked={hp?.mode === 'roll'} disabled={hp?.mode === 'roll' || overlay.busy}
                  className={hp?.mode === 'roll' ? 'kit is-on rise' : 'kit rise'} style={{ '--i': 2 } as CSSProperties} onClick={rollHp}>
                  <span className="kit__badge num">{hp?.mode === 'roll' ? hp.roll : <Icon name="d20" />}</span>
                  <span className="col" style={{ gap: 2, flex: 1 }}>
                    <span style={{ fontWeight: 700 }}>{hp?.mode === 'roll' ? `Rolled ${hp.roll}` : `Roll a d${plan.hitDie}`}</span>
                    <span className="muted">{hp?.mode === 'roll' ? `+${Math.max(1, hp.roll + plan.conMod) + plan.bonusPerLevel} HP. The roll stands.` : `1 to ${plan.hitDie}, plus CON. Once rolled, it stands.`}</span>
                  </span>
                  {hp?.mode === 'roll' && <Icon name="check" style={{ color: 'var(--accent)' }} />}
                </button>
              </div>
            </>
          )}

          {id === 'subclass' && (
            <>
              <div className="gr-notice gr-hint rise" style={{ '--i': 0 } as CSSProperties}>
                <Icon name="star" />
                <span><b>Choose your {cls?.name.toLowerCase()} subclass</b>It shapes your features from now on.</span>
              </div>
              <div className="grid2">
                {subclassesFor(classId).map((s, i) => (
                  <button key={s.id} className={s.id === subclassId ? 'cls is-on rise' : 'cls rise'} aria-pressed={s.id === subclassId}
                    style={{ '--i': i + 1, '--tincture': `var(--tincture-${(i % 6) + 1})` } as CSSProperties} onClick={() => setSubclassId(s.id)}>
                    <span style={{ font: '600 16px/1.2 var(--font-heading)' }}>{s.name}</span>
                    <SourceTag source={s.source} />
                    {subclassOf(c, classId) === s.id && <span className="muted">Chosen earlier</span>}
                  </button>
                ))}
              </div>
              {subclassId && (
                <span key={subclassId} className="muted fade-up">
                  {subclassById(subclassId)?.description ? excerpt(subclassById(subclassId)!.description, 260) : 'Listed by name; see the Player’s Handbook for its features.'}
                </span>
              )}
            </>
          )}

          {id === 'features' && (
            <>
              <section className="gr-window rise" style={{ '--tincture': 'var(--tincture-3)', width: '100%', '--i': 0 } as CSSProperties}>
                <div className="gr-window__head"><i className="gr-window__mark" /><div className="gr-window__title"><span>What grows</span></div></div>
                <dl className="ledger" style={{ borderTop: 0, padding: '4px 12px 8px' }}>
                  {[
                    ['Proficiency', plan.pb[0] === plan.pb[1] ? signed(plan.pb[1]) : `${signed(plan.pb[0])} → ${signed(plan.pb[1])}`],
                    ...plan.resources.map((r) => [r.name, `${r.from} → ${r.to}`]),
                    ...(plan.slots[1].some((n, i) => n !== plan.slots[0][i])
                      ? [['Spell slots', plan.slots[1].map((n, i) => (n ? `${ordinal(i + 1)} ×${n}` : '')).filter(Boolean).join(', ')]] : []),
                    ...(plan.pact[1] && (plan.pact[1].count !== plan.pact[0]?.count || plan.pact[1].level !== plan.pact[0]?.level)
                      ? [['Pact Magic', `${plan.pact[1].count} slots of ${ordinal(plan.pact[1].level)} level`]] : []),
                    ...(plan.prepared[1] !== plan.prepared[0] ? [['Prepared', `${plan.prepared[0]} → ${plan.prepared[1]} spells`]] : []),
                    ...(after.attacks !== d.attacks ? [['Attacks', `${d.attacks} → ${after.attacks} per Attack action`]] : []),
                  ].map(([k, v], i) => (
                    <div key={k} className="ledger__row" style={{ '--i': i } as CSSProperties}><dt className="gr-label">{k}</dt><dd>{v}</dd></div>
                  ))}
                </dl>
              </section>
              {plan.newClass && (
                <div className="gr-notice gr-hint"><Icon name="info" /><span><b>New class: {cls?.name}</b>Multiclassing gives some of its proficiencies but not its saving throws. Check the Player&rsquo;s Handbook for which ones.</span></div>
              )}
              <div className="olist">
                {[...plan.classFeatures.map((f) => ({ ...f, from: cls?.name ?? 'Class' })), ...plan.pathFeatures.map((f) => ({ ...f, from: subclassById(subclassId)?.name ?? 'Subclass' }))]
                  .map((f, i) => <FeatureRow key={f.id} index={i + 1} name={f.name} from={f.from} text={f.description} />)}
              </div>
              {!plan.classFeatures.length && !plan.pathFeatures.length && (
                <div className="gr-notice gr-hint"><Icon name="info" /><span>No new features at this level{subclassById(subclassId)?.source === 'PHB 2024' ? ' that are in the SRD; see the Player’s Handbook for your subclass' : ''}.</span></div>
              )}
            </>
          )}

          {id === 'asi' && (
            <>
              <div className="seg rise" role="group" aria-label="Improvement" style={{ '--i': 0 } as CSSProperties}>
                {(plan.epicBoon ? [['feat', 'Epic Boon or feat'], ['plus2', '+2'], ['plus1', '+1 / +1']] as const : [['plus2', '+2 to one'], ['plus1', '+1 to two'], ['feat', 'A feat']] as const).map(([k, l]) => (
                  <button key={k} className={asiKind === k ? 'segbtn is-on' : 'segbtn'} aria-pressed={asiKind === k} onClick={() => setAsiKind(k)}>{l}</button>
                ))}
              </div>
              {asiKind !== 'feat' && (
                <div className="panel rise" style={{ '--i': 1 } as CSSProperties}>
                  {ABILITIES.map((a) => {
                    const on = asiKind === 'plus2' ? plus2 === a : plus1.includes(a);
                    return (
                      <button key={a} className={`abrow abpick${on ? ' is-on' : ''}`} disabled={cap20(a)} aria-pressed={on}
                        onClick={() => asiKind === 'plus2' ? setPlus2(a) : setPlus1((l) => (l.includes(a) ? l.filter((x) => x !== a) : [...l.slice(-1), a]))}>
                        <span style={{ width: 112, fontWeight: 700, textAlign: 'left' }}>{ABILITY_NAMES[a]}</span>
                        <span className="num muted" style={{ fontSize: 15 }}>{c.abilities[a]}</span>
                        <Icon name="arrowRight" style={{ opacity: on ? 1 : 0.25 }} />
                        <Tick value={scores[a]} style={{ fontSize: 20, minWidth: 28 }} />
                        <span className="num" style={{ marginLeft: 'auto', fontSize: 15, color: 'var(--text-muted)' }}>{signed(abilityMod(scores[a]))}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {asiKind === 'feat' && (
                <>
                  <div className="chips rise" role="radiogroup" aria-label="Feat" style={{ '--i': 1 } as CSSProperties}>
                    {featList.map((f) => (
                      <button key={f.id} role="radio" aria-checked={featId === f.id}
                        className={`gr-chip filter${featId === f.id ? ' is-on' : ''}${f.category === 'epic-boon' ? ' boon' : ''}`}
                        onClick={() => { setFeatId(f.id); setFeatAbility(f.abilities?.length === 1 ? f.abilities[0] : undefined); setSkill(undefined); setExpertise(undefined); }}>
                        {f.name}<SourceTag source={f.source} />
                      </button>
                    ))}
                  </div>
                  {feat && (
                    <section key={feat.id} className="gr-window unfold" style={{ '--tincture': feat.category === 'epic-boon' ? 'var(--tincture-3)' : 'var(--tincture-4)', width: '100%' } as CSSProperties}>
                      <div className="gr-window__head"><i className="gr-window__mark" /><div className="gr-window__title"><span>{feat.name}</span></div></div>
                      <div className="gr-window__body" style={{ gap: 12 }}>
                        <span className="muted">{feat.description ? excerpt(feat.description.replace(/^(General|Origin|Epic Boon) Feat[^\n]*\s*/, ''), 320) : 'Listed by name with its ability increase; see the Player’s Handbook for the rest.'}</span>
                        {feat.abilities?.length ? (
                          <div className="col" style={{ gap: 6 }}>
                            <span className="gr-label">+1 to</span>
                            <div className="chips" role="radiogroup" aria-label="Feat ability">
                              {feat.abilities.map((a) => (
                                <button key={a} role="radio" aria-checked={featAbility === a} disabled={cap20(a)}
                                  className={`gr-chip filter${featAbility === a ? ' is-on' : ''}`} onClick={() => setFeatAbility(a)}>
                                  {ABILITY_NAMES[a]} {c.abilities[a]} → {Math.min(feat.category === 'epic-boon' ? 30 : 20, c.abilities[a] + 1)}
                                </button>
                              ))}
                            </div>
                            {feat.id === 'resilient' && featAbility && <span className="muted fade-up">You also become proficient in {ABILITY_NAMES[featAbility]} saving throws.</span>}
                          </div>
                        ) : null}
                        {feat.id === 'skill-expert' && (
                          <>
                            <div className="col" style={{ gap: 6 }}>
                              <span className="gr-label">New skill proficiency</span>
                              <div className="chips">{SKILLS.filter((s) => !c.skills.includes(s.id)).map((s) => (
                                <button key={s.id} className={`gr-chip filter${skill === s.id ? ' is-on' : ''}`} aria-pressed={skill === s.id} onClick={() => setSkill(s.id)}>{s.name}</button>
                              ))}</div>
                            </div>
                            <div className="col" style={{ gap: 6 }}>
                              <span className="gr-label">Expertise</span>
                              <div className="chips">{[...c.skills, ...(skill ? [skill] : [])].filter((s) => !c.expertise.includes(s)).map((s) => (
                                <button key={s} className={`gr-chip filter${expertise === s ? ' is-on' : ''}`} aria-pressed={expertise === s} onClick={() => setExpertise(s)}>{skillName(s)}</button>
                              ))}</div>
                            </div>
                          </>
                        )}
                      </div>
                    </section>
                  )}
                </>
              )}
              {ABILITIES.some(cap20) && <span className="muted">Scores can't go above {plan.epicBoon ? '20 (30 with an Epic Boon)' : 20}.</span>}
            </>
          )}

          {id === 'style' && (
            <>
              <div className="gr-notice gr-hint rise" style={{ '--i': 0 } as CSSProperties}>
                <Icon name="swords" />
                <span><b>Fighting Style</b>{classId === 'fighter' && classLevelOf(c, 'fighter') >= 1 && plan.classLevel > 1 ? 'Fighters get one at level 1; pick yours now.' : 'Pick the way you fight.'}</span>
              </div>
              <div className="olist">
                {styles.map((f, i) => (
                  <OriginRow key={f.id} index={i + 1} tincture={i} on={style === f.id} title={f.name} source={f.source} meta="" onPick={() => setStyle(f.id)}>
                    <span className="muted">{f.description ? excerpt(f.description.replace(/^Fighting Style Feat[^\n]*\s*/, ''), 260) : 'Listed by name; see the Player’s Handbook for the rules.'}</span>
                  </OriginRow>
                ))}
              </div>
            </>
          )}

          {id === 'cantrips' && (
            <>
              <div className="row rise" style={{ alignItems: 'baseline', '--i': 0 } as CSSProperties}>
                <span className="gr-label" style={{ flex: 1 }}>New cantrips</span>
                <span className="muted"><Tick value={cantrips.length} /> of {plan.newCantrips}</span>
              </div>
              {!spells ? <span className="muted">Opening the spell list…</span> : (
                <div className="chips rise" role="group" aria-label="Cantrips" style={{ '--i': 1 } as CSSProperties}>
                  {cantripPool.map((s) => (
                    <button key={s.id} className={`gr-chip filter${cantrips.includes(s.id) ? ' is-on' : ''}`} aria-pressed={cantrips.includes(s.id)}
                      onClick={() => setCantrips((l) => (l.includes(s.id) ? l.filter((x) => x !== s.id) : l.length < plan.newCantrips ? [...l, s.id] : [...l.slice(1), s.id]))}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
              {plan.prepared[1] > plan.prepared[0] && (
                <div className="gr-notice gr-hint"><Icon name="book" /><span>You can also prepare {plan.prepared[1]} spells now (up from {plan.prepared[0]}). Choose them in the spellbook after sealing.</span></div>
              )}
            </>
          )}

          {id === 'review' && (
            <>
              <section className="gr-window unroll" style={{ '--tincture': 'var(--tincture-3)', width: '100%' } as CSSProperties}>
                <div className="gr-window__head"><i className="gr-window__mark" /><div className="gr-window__title"><span>{c.name}, level {plan.level}</span></div></div>
                <div className="gr-window__body" style={{ position: 'relative' }}>
                  <WaxSeal className="wax--review" />
                  <span style={{ fontSize: 16, paddingRight: 56 }}>{cls?.name} {plan.classLevel}{subclassId ? ` · ${subclassById(subclassId)?.name}` : ''}{plan.newClass ? ' (new class)' : ''}</span>
                  <div className="grid3">
                    {([['HP', c.hp.max, preview.hp.max], ['Prof', d.pb, after.pb], ['AC', d.ac, after.ac]] as const).map(([k, from, to], i) => (
                      <div key={k} className="stat flip" style={{ background: 'var(--bg)', '--i': i } as CSSProperties}>
                        <span className="gr-label">{k}</span>
                        <Tick value={to} from={from} sign={k === 'Prof'} style={{ fontSize: 22 }} />
                        {to !== from && <span className="muted">was {k === 'Prof' ? signed(from) : from}</span>}
                      </div>
                    ))}
                  </div>
                  <dl className="ledger">
                    {[
                      ...ABILITIES.filter((a) => preview.abilities[a] !== c.abilities[a]).map((a) => [ABILITY_NAMES[a], `${c.abilities[a]} → ${preview.abilities[a]}`]),
                      ...(asi?.kind === 'feat' ? [['Feat', `${featById(asi.featId)?.name}${asi.ability ? ` (+1 ${asi.ability.toUpperCase()})` : ''}`]] : []),
                      ...(style ? [['Style', featById(style)?.name ?? style]] : []),
                      ...(plan.subclass && subclassId ? [['Subclass', subclassById(subclassId)?.name ?? '']] : []),
                      ...(plan.classFeatures.length + plan.pathFeatures.length ? [['Features', [...plan.classFeatures, ...plan.pathFeatures].map((f) => f.name).join(', ')]] : []),
                      ...plan.resources.map((r) => [r.name, `${r.from} → ${r.to}`]),
                      ...(cantrips.length && spells ? [['Cantrips', cantrips.map((s) => spells.find((x) => x.id === s)?.name ?? s).join(', ')]] : []),
                      ...(plan.prepared[1] !== plan.prepared[0] ? [['Prepared', `${plan.prepared[1]} spells (choose in the spellbook)`]] : []),
                      ['Hit points', hp?.mode === 'roll' ? `Rolled ${hp.roll} on the d${plan.hitDie}` : `Average ${plan.hpAverage} on the d${plan.hitDie}`],
                    ].map(([k, v], i) => (
                      <div key={k} className="ledger__row" style={{ '--i': i + 4 } as CSSProperties}><dt className="gr-label">{k}</dt><dd>{v}</dd></div>
                    ))}
                  </dl>
                </div>
              </section>
              {pendingLevels(preview) > 0 && (
                <div className="gr-notice gr-hint rise" style={{ '--i': 10 } as CSSProperties}><Icon name="star" /><span><b>Another level is ready</b>Level {plan.level + 1} comes next.</span></div>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="foot foot--lg grid2" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
        <button className="gr-btn gr-btn--secondary" style={{ height: 48 }} onClick={() => go(Math.max(0, step - 1))} disabled={step === 0}>
          <Icon name="back" />Back
        </button>
        {id !== 'review' ? (
          <button className="gr-btn gr-btn--primary" style={{ height: 48 }} onClick={() => go(step + 1)} disabled={!valid[id]}>
            Next<Icon name="next" />
          </button>
        ) : (
          <button className="gr-btn gr-btn--primary create-btn" style={{ height: 48 }} onClick={seal} disabled={sealing}><Icon name="star" />Seal level {plan.level}</button>
        )}
      </footer>

      {sealing && (
        <div className="sealing" role="status" aria-live="polite">
          <div className="sealing__burst" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--a': `${i * 45}deg` } as CSSProperties} />)}
          </div>
          <WaxSeal className="wax--big" />
          <span className="sealing__name">Level {plan.level}</span>
          <span className="muted">{c.name} grows stronger</span>
        </div>
      )}
      {overlay.overlay}
    </div>
  );
}

function FeatureRow({ index, name, from, text }: { index: number; name: string; from: string; text: string }) {
  const [open, setOpen] = useState(index === 1);
  return (
    <div className={open ? 'orow is-on rise' : 'orow rise'} style={{ '--i': index, '--tincture': `var(--tincture-${(index % 6) + 1})` } as CSSProperties}>
      <button className="orow__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <i className="orow__pip" />
        <span className="orow__name">{name}</span>
        <span className="muted orow__meta">{cap(from)}</span>
      </button>
      <div className="orow__body" aria-hidden={!open}>
        <div className="orow__inner">{open && <span style={{ fontSize: 14.5, lineHeight: 1.45 }}>{excerpt(text, 600)}</span>}</div>
      </div>
    </div>
  );
}
