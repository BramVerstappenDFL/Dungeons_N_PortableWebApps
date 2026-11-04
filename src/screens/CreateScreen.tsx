import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Ability, AbilityScores, Size } from '../types';
import {
  BACKGROUNDS, CLASSES, FEATS, SPECIES, STANDARD_LANGUAGES, backgroundById, classById, featById, languageById,
  lineageById, lineagesFor, originName, speciesById, speciesSpeed, subclassById, subclassesFor,
} from '../data';
import { uid, useStore } from '../store/characters';
import {
  ABILITIES, ABILITY_NAMES, SKILLS, POINT_BUY_BUDGET, POINT_BUY_COST, abilityMod, defaultMaxHp, pointBuySpent, skillName,
} from '../rules/abilities';
import {
  LANGUAGE_PICKS, applyBoosts, boostsValid, buildCharacter, defaultBoosts, isStandardArray, keyAbility,
  kitGold, languagesValid, startingArmorClass, suggestedScores, swapScores,
} from '../rules/create';
import { Icon } from '../ui/Icon';
import { importCharacterFile } from '../ui/importFile';
import { cap, signed, excerpt } from '../ui/format';
import { reducedMotion } from '../ui/theme';
import { KitPicker, OriginRow, SealProgress, SourceTag, Tick, WaxSeal } from './create/parts';
import { FeatChoices, MI_LISTS, SKILLED_PICKS, miAbility, miComplete, type FeatInstance, type FeatSlot, type MiPick } from './create/FeatChoices';
import { originAbilityOf, originOf } from '../rules/origin';
import { useSpells } from '../ui/useSpells';
import type { CharacterSpell } from '../types';
import './create.css';

const STEPS = ['Origin', 'Background', 'Class', 'Abilities', 'Gear & tongues', 'Review'];
const CASTER: Record<string, string> = { full: 'Full caster', half: 'Half caster', pact: 'Pact magic', none: 'No spellcasting' };
type Method = 'standard' | 'pointbuy';
type SourceFilter = 'all' | 'SRD 5.2.1' | 'PHB 2024';

export function CreateScreen() {
  const add = useStore((s) => s.add);
  const hasCharacters = useStore((s) => s.characters.length > 0);
  const nav = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [sealing, setSealing] = useState(false);

  const [name, setName] = useState('');
  const [speciesId, setSpeciesId] = useState('human');
  const [lineageId, setLineageId] = useState<string | undefined>();
  const [size, setSize] = useState<Size>('medium');
  const [backgroundId, setBackgroundId] = useState(BACKGROUNDS[0].id);
  const [bgFilter, setBgFilter] = useState<SourceFilter>('all');
  const [classId, setClassId] = useState('fighter');
  const [classSkills, setClassSkills] = useState<string[]>([]);
  const [subclassId, setSubclassId] = useState<string | undefined>();
  const [method, setMethod] = useState<Method>('standard');
  const [scores, setScores] = useState<AbilityScores>(() => suggestedScores(keyAbility('fighter')));
  const [swapFrom, setSwapFrom] = useState<Ability | null>(null);
  const [boosts, setBoosts] = useState<Partial<Record<Ability, number>> | null>(null);
  const [classKit, setClassKit] = useState('a');
  const [bgKit, setBgKit] = useState('a');
  const [languages, setLanguages] = useState<string[]>([]);
  const [keenSenses, setKeenSenses] = useState<string | undefined>();
  const [skillful, setSkillful] = useState<string | undefined>();
  const [extraFeat, setExtraFeat] = useState<string | undefined>();
  const [extraFeatNote, setExtraFeatNote] = useState<string | undefined>();
  const [originAbility, setOriginAbility] = useState<Ability | undefined>();
  const [skilled, setSkilled] = useState<string[]>([]);
  const [mi, setMiState] = useState<Partial<Record<FeatSlot, MiPick>>>({});
  const spells = useSpells();

  const cls = classById(classId)!;
  const bg = backgroundById(backgroundId)!;
  const species = speciesById(speciesId)!;
  const lineage = lineageById(lineageId);
  const key = keyAbility(classId);
  const effBoosts = boosts ?? defaultBoosts(bg.abilities, key, scores);
  const final = applyBoosts(scores, effBoosts);
  const left = POINT_BUY_BUDGET - pointBuySpent(scores);
  const isHuman = speciesId === 'human';
  const featList: FeatInstance[] = [
    ...(bg.feat ? [{ slot: 'bg' as const, id: bg.feat, note: bg.featNote }] : []),
    ...(isHuman && extraFeat ? [{ slot: 'extra' as const, id: extraFeat, note: extraFeatNote }] : []),
  ];
  const originSkills = [speciesId === 'elf' ? keenSenses : undefined, isHuman ? skillful : undefined].filter((s): s is string => !!s);
  const skilledNeeded = featList.filter((f) => f.id === 'skilled').length * SKILLED_PICKS;
  const skilledPicks = skilled.slice(0, skilledNeeded);
  const grantsSpells = !!lineage?.abilityChoice || (species.traits ?? []).some((t) => t.spells?.length);
  const featSpells: CharacterSpell[] = featList.filter((f) => f.id === 'magic-initiate').flatMap((f) => {
    const p = mi[f.slot];
    return p ? [...p.cantrips, ...(p.spell ? [p.spell] : [])].map((id) => ({ id, prepared: true, source: 'feat' as const, ability: p.ability })) : [];
  });
  const skillPool = (cls.skillOptions ?? SKILLS.map((s) => s.id)).filter((s) => !bg.skills.includes(s) && !originSkills.includes(s) && !skilledPicks.includes(s));
  const skillsOk = classSkills.length === Math.min(cls.skillCount, skillPool.length);
  const clsKits = cls.kits ?? [];
  const bgKits = bg.kits ?? [];
  const chosenKits = [clsKits.find((k) => k.id === classKit), bgKits.find((k) => k.id === bgKit)];
  const kitArmor = chosenKits.flatMap((k) => k?.items ?? []);
  const ac = startingArmorClass(classId, final, kitArmor);
  const hp = defaultMaxHp(cls.hitDie, 1, final.con);
  const dexMod = abilityMod(final.dex), conMod = abilityMod(final.con);
  const feat = featById(bg.feat);
  const speciesLineages = lineagesFor(speciesId);
  const speed = speciesSpeed(speciesId, lineageId);

  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [step]);

  const scoresOk = method === 'standard' ? isStandardArray(scores) : left >= 0;
  const valid = [
    !!name.trim() && (!species.lineage || !!lineage) && (speciesId !== 'elf' || !!keenSenses)
      && (!isHuman || (!!skillful && !!extraFeat && (extraFeat !== 'magic-initiate' || !!extraFeatNote))),
    skilledPicks.length === skilledNeeded && featList.filter((f) => f.id === 'magic-initiate').every((f) => miComplete(mi[f.slot])),
    skillsOk,
    scoresOk && boostsValid(effBoosts, bg.abilities),
    languagesValid(languages),
    true,
  ];
  const go = (to: number) => {
    setDir(to > step ? 'fwd' : 'back');
    setStep(to);
    setReached((r) => Math.max(r, to));
  };

  const pickSpecies = (id: string) => {
    if (id === speciesId) return;
    const s = speciesById(id)!;
    setSpeciesId(id);
    setLineageId(undefined);
    setKeenSenses(undefined);
    setSkillful(undefined);
    setExtraFeat(undefined);
    setOriginAbility(undefined);
    setSize(s.sizes?.includes('medium') ? 'medium' : (s.sizes?.[0] ?? 'medium'));
  };
  const pickBackground = (id: string) => {
    const b = backgroundById(id)!;
    setBackgroundId(id);
    setBoosts(null);
    setBgKit(b.kits?.[0]?.id ?? 'a');
    setClassSkills((l) => l.filter((x) => !b.skills.includes(x)));
    setSkilled((l) => l.filter((x) => !b.skills.includes(x)));
    setMiState((m) => ({ extra: m.extra }));
  };
  const pickClass = (id: string) => {
    if (id === classId) return;
    setClassId(id);
    setClassSkills([]);
    setSubclassId(undefined);
    setBoosts(null);
    setClassKit('a');
    setSwapFrom(null);
    setScores(suggestedScores(keyAbility(id)));
  };
  const setScore = (a: Ability, delta: number) => {
    const v = scores[a] + delta;
    if (v < 8 || v > 15) return;
    const next = { ...scores, [a]: v };
    if (pointBuySpent(next) > POINT_BUY_BUDGET) return;
    setScores(next);
  };
  const tapStandard = (a: Ability) => {
    if (!swapFrom) return setSwapFrom(a);
    if (swapFrom !== a) setScores((s) => swapScores(s, swapFrom, a));
    setSwapFrom(null);
  };
  const switchMethod = (m: Method) => {
    setMethod(m);
    setSwapFrom(null);
    if (m === 'standard' && !isStandardArray(scores)) setScores(suggestedScores(key));
  };
  const toggleSkill = (s: string) =>
    setClassSkills((l) => (l.includes(s) ? l.filter((x) => x !== s) : l.length < cls.skillCount ? [...l, s] : l));
  const toggleLanguage = (id: string) =>
    setLanguages((l) => (l.includes(id) ? l.filter((x) => x !== id) : l.length < LANGUAGE_PICKS ? [...l, id] : [l[1], id]));
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

  const setMi = (slot: FeatSlot, p: MiPick) => setMiState((m) => ({ ...m, [slot]: p }));
  const input = (id: string, makeId?: () => string) => ({
    id, name, speciesId, backgroundId, classId, base: scores, boosts: effBoosts,
    classSkills, backgroundSkills: bg.skills, now: Date.now(), method,
    lineageId, size: (species.sizes?.length ?? 0) > 1 ? size : undefined, subclassId,
    originFeat: bg.feat, originFeatNote: bg.featNote, languages, kits: chosenKits, makeId,
    originAbility: grantsSpells ? originAbilityOf(final, originAbility) : undefined,
    extraFeat: isHuman ? extraFeat : undefined, extraFeatNote: isHuman ? extraFeatNote : undefined,
    originPicks: { keenSenses: originSkills.includes(keenSenses ?? '') ? keenSenses : undefined, skillful: isHuman ? skillful : undefined, skilled: skilledPicks },
    featSpells,
  });
  // The review shows the character exactly as it will be saved.
  const preview = step === STEPS.length - 1 ? buildCharacter(input('preview')) : null;
  const previewOrigin = preview ? originOf(preview) : null;
  const create = () => {
    const c = buildCharacter(input(uid(), uid));
    const finish = () => { add(c); nav('/', { replace: true }); };
    if (reducedMotion()) return finish();
    setSealing(true);
    window.setTimeout(finish, 900);
  };

  const backgrounds = BACKGROUNDS.filter((b) => bgFilter === 'all' || (b.source ?? 'SRD 5.2.1') === bgFilter);

  return (
    <div className="screen create-flow">
      <header className="hdr" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div className="row" style={{ gap: 12 }}>
          {hasCharacters && (
            <Link to="/" className="gr-btn gr-btn--secondary gr-btn--icon ico-btn" aria-label="Close"><Icon name="close" /></Link>
          )}
          <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <h1 className="sub" style={{ margin: 0, font: '600 22px/1.15 var(--font-heading)' }}>New character</h1>
            <span className="muted step-label" key={step}>Step {step + 1} of {STEPS.length} · {STEPS[step]}</span>
          </div>
          <button className="gr-btn gr-btn--secondary gr-btn--small" style={{ height: 40 }} onClick={() => importRef.current?.click()} aria-label="Import a character file">
            <Icon name="upload" />Import
          </button>
          {/* No accept filter: phones often grey out unknown extensions such as .cah. */}
          <input ref={importRef} type="file" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const r = await importCharacterFile(f);
            if (r.count) nav('/', { replace: true });
            window.alert([r.text, ...r.details.map((x) => `• ${x}`)].join('\n'));
          }} />
        </div>
        <SealProgress steps={STEPS} step={step} reached={reached} onJump={go} />
      </header>

      <main ref={mainRef} className="scroll" style={{ padding: '20px 16px 28px' }}>
        <div key={step} className={`page page--${dir}`}>
          {step === 0 && (
            <>
              {!hasCharacters && (
                <div className="gr-notice gr-hint rise" style={{ '--i': 0 } as CSSProperties}>
                  <Icon name="info" />
                  <span><b>Welcome</b>Build a level 1 hero in six steps. Everything is saved on this device.</span>
                </div>
              )}
              <div className="gr-field rise" style={{ width: '100%', '--i': 1 } as CSSProperties}>
                <label htmlFor="charName" className="gr-label">Name</label>
                <input id="charName" className="gr-input" style={{ height: 48 }} placeholder="What does the table call you?" value={name}
                  onChange={(e) => setName(e.target.value)} autoComplete="off" />
              </div>
              <div className="col" style={{ gap: 8 }}>
                <div className="row" style={{ alignItems: 'baseline' }}>
                  <span className="gr-label" style={{ flex: 1 }}>Species</span>
                  <span className="muted">{SPECIES.length} to choose from</span>
                </div>
                <div className="olist">
                  {SPECIES.map((s, i) => (
                    <OriginRow key={s.id} index={i + 2} tincture={i} on={s.id === speciesId} title={s.name} source={s.source}
                      meta={`${(s.sizes ?? [s.size]).map(cap).join(' or ')} · ${s.speed} ft`} onPick={() => pickSpecies(s.id)}>
                      <div className="traits">
                        {(s.traits ?? []).map((t, j) => (
                          <div key={t.id} className="trait" style={{ '--i': j } as CSSProperties}>
                            <b>{t.name}</b>
                            {t.description && <span className="muted">{excerpt(t.description, 150)}</span>}
                          </div>
                        ))}
                      </div>
                      {(s.sizes?.length ?? 0) > 1 && (
                        <div className="col" style={{ gap: 6 }}>
                          <span className="gr-label">Size</span>
                          <div className="seg" role="group" aria-label="Size">
                            {s.sizes!.map((z) => (
                              <button key={z} className={size === z ? 'segbtn is-on' : 'segbtn'} aria-pressed={size === z} onClick={() => setSize(z)}>{cap(z)}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {s.lineage && (
                        <div className="col" style={{ gap: 6 }}>
                          <span className="gr-label">{s.id === 'dragonborn' ? 'Draconic ancestry' : s.id === 'goliath' ? 'Giant ancestry' : s.id === 'tiefling' ? 'Fiendish legacy' : 'Lineage'}</span>
                          <div className="chips" role="radiogroup" aria-label="Lineage">
                            {speciesLineages.map((l) => (
                              <button key={l.id} role="radio" aria-checked={l.id === lineageId}
                                className={`gr-chip filter${l.id === lineageId ? ' is-on' : ''}`} onClick={() => setLineageId(l.id)}>
                                {l.name.replace(/ Dragon$/, '').replace(/ Giant$/, '')}
                              </button>
                            ))}
                          </div>
                          {lineage
                            ? <span key={lineage.id} className="muted fade-up">{lineage.damageType ? `${cap(lineage.damageType)} damage. ` : ''}{excerpt(lineage.description, 180)}</span>
                            : <span className="muted">Pick one to continue.</span>}
                        </div>
                      )}
                      {s.id === 'elf' && (
                        <div className="col" style={{ gap: 6 }}>
                          <span className="gr-label">Keen Senses</span>
                          <div className="chips" role="radiogroup" aria-label="Keen Senses skill">
                            {['insight', 'perception', 'survival'].map((k) => (
                              <button key={k} role="radio" aria-checked={keenSenses === k} className={`gr-chip filter${keenSenses === k ? ' is-on' : ''}`} onClick={() => setKeenSenses(k)}>{skillName(k)}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {s.id === 'human' && (
                        <>
                          <div className="col" style={{ gap: 6 }}>
                            <span className="gr-label">Skillful: one more skill</span>
                            <div className="chips" role="radiogroup" aria-label="Skillful skill">
                              {SKILLS.filter((k) => !bg.skills.includes(k.id)).map((k) => (
                                <button key={k.id} role="radio" aria-checked={skillful === k.id} className={`gr-chip filter${skillful === k.id ? ' is-on' : ''}`} onClick={() => setSkillful(k.id)}>{k.name}</button>
                              ))}
                            </div>
                          </div>
                          <div className="col" style={{ gap: 6 }}>
                            <span className="gr-label">Versatile: an origin feat</span>
                            <div className="chips" role="radiogroup" aria-label="Versatile feat">
                              {FEATS.filter((f) => f.category === 'origin').map((f) => (
                                <button key={f.id} role="radio" aria-checked={extraFeat === f.id} className={`gr-chip filter${extraFeat === f.id ? ' is-on' : ''}`}
                                  onClick={() => { setExtraFeat(f.id); setExtraFeatNote(undefined); setMiState((m) => ({ bg: m.bg })); }}>
                                  {f.name}<SourceTag source={f.source} />
                                </button>
                              ))}
                            </div>
                            {extraFeat === 'magic-initiate' && (
                              <div className="seg fade-up" role="group" aria-label="Spell list">
                                {MI_LISTS.map((l) => (
                                  <button key={l} className={extraFeatNote === l ? 'segbtn is-on' : 'segbtn'} aria-pressed={extraFeatNote === l}
                                    onClick={() => { setExtraFeatNote(l); setMiState((m) => ({ bg: m.bg, extra: { cantrips: [], ability: miAbility(l) } })); }}>{l}</button>
                                ))}
                              </div>
                            )}
                            {extraFeat && featById(extraFeat)?.description && (
                              <span key={extraFeat} className="muted fade-up">{excerpt(featById(extraFeat)!.description.replace(/^Origin Feat\s*/, ''), 160)}</span>
                            )}
                          </div>
                        </>
                      )}
                      {(s.id === speciesId && ((lineage?.abilityChoice) || (s.traits ?? []).some((t) => t.spells?.length))) && (
                        <div className="col fade-up" style={{ gap: 6 }}>
                          <span className="gr-label">Spellcasting ability for {s.name.toLowerCase()} spells</span>
                          <div className="seg" role="group" aria-label="Spellcasting ability">
                            {(['int', 'wis', 'cha'] as Ability[]).map((a) => {
                              const on = originAbilityOf(final, originAbility) === a;
                              return <button key={a} className={on ? 'segbtn is-on' : 'segbtn'} aria-pressed={on} onClick={() => setOriginAbility(a)}>{ABILITY_NAMES[a]}</button>;
                            })}
                          </div>
                        </div>
                      )}
                      {s.source === 'PHB 2024' && <span className="muted">Traits are listed by name; see the Player's Handbook for the rules.</span>}
                    </OriginRow>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="seg rise" role="group" aria-label="Source" style={{ '--i': 0 } as CSSProperties}>
                {([['all', `All ${BACKGROUNDS.length}`], ['SRD 5.2.1', 'SRD'], ['PHB 2024', 'PHB']] as const).map(([v, l]) => (
                  <button key={v} className={bgFilter === v ? 'segbtn is-on' : 'segbtn'} aria-pressed={bgFilter === v} onClick={() => setBgFilter(v)}>{l}</button>
                ))}
              </div>
              <div className="olist" key={bgFilter}>
                {backgrounds.map((b, i) => (
                  <OriginRow key={b.id} index={i + 1} tincture={i + 2} on={b.id === backgroundId} title={b.name} source={b.source}
                    meta={b.skills.map(skillName).join(', ')} onPick={() => pickBackground(b.id)}>
                    <div className="facts">
                      <span className="gr-label">Abilities</span>
                      <span className="chips">{b.abilities.map((a) => <span key={a} className="gr-tag">{a.toUpperCase()}</span>)}</span>
                      <span className="gr-label">Origin feat</span>
                      <span><b>{featById(b.feat)?.name ?? cap(b.feat ?? '')}</b>{b.featNote ? ` (${b.featNote})` : ''}</span>
                      <span className="gr-label">Skills</span>
                      <span>{b.skills.map(skillName).join(' and ')}</span>
                      {b.tool && <><span className="gr-label">Tool</span><span>{b.tool}</span></>}
                    </div>
                    {featById(b.feat)?.description && (
                      <span className="muted">{excerpt(featById(b.feat)!.description.replace(/^Origin Feat\s*/, ''), 170)}</span>
                    )}
                  </OriginRow>
                ))}
              </div>
              <FeatChoices feats={featList} spells={spells} taken={[...bg.skills, ...originSkills]}
                skilled={skilledPicks} setSkilled={setSkilled} mi={mi} setMi={setMi} />
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid2">
                {CLASSES.map((k, i) => (
                  <button key={k.id} className={k.id === classId ? 'cls is-on rise' : 'cls rise'} aria-pressed={k.id === classId}
                    style={{ '--i': i, '--tincture': `var(--tincture-${(i % 6) + 1})` } as CSSProperties} onClick={() => pickClass(k.id)}>
                    <span style={{ font: '600 18px/1.15 var(--font-heading)' }}>{k.name}</span>
                    <span className="muted">Hit die d{k.hitDie}</span>
                    <span className="muted">Key: {(k.primary?.length ? k.primary : [keyAbility(k.id)]).map((a) => ABILITY_NAMES[a]).join(' / ')}</span>
                  </button>
                ))}
              </div>
              <section key={classId} className="gr-window unfold" style={{ '--tincture': `var(--tincture-${(CLASSES.indexOf(cls) % 6) + 1})`, width: '100%' } as CSSProperties}>
                <div className="gr-window__head"><i className="gr-window__mark" /><div className="gr-window__title"><span>The {cls.name}</span></div></div>
                <div className="gr-window__body" style={{ gap: 14 }}>
                  <div className="grid3">
                    {[['Hit die', `d${cls.hitDie}`], ['Saves', cls.saves.map((s) => s.toUpperCase()).join(' ')], ['Magic', CASTER[cls.casterType].replace(' caster', '')]].map(([k, v]) => (
                      <div key={k} className="stat" style={{ background: 'var(--bg)' }}><span className="gr-label">{k}</span><span className="num" style={{ fontSize: 17 }}>{v}</span></div>
                    ))}
                  </div>
                  <div className="col" style={{ gap: 8 }}>
                    <div className="row" style={{ alignItems: 'baseline' }}>
                      <span className="gr-label" style={{ flex: 1 }}>Skills</span>
                      <span className="muted"><Tick value={classSkills.length} /> of {Math.min(cls.skillCount, skillPool.length)}</span>
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
                  <div className="col" style={{ gap: 8 }}>
                    <div className="row" style={{ alignItems: 'baseline' }}>
                      <span className="gr-label" style={{ flex: 1 }}>Path at level 3</span>
                      <span className="muted">Optional</span>
                    </div>
                    <div className="chips" role="radiogroup" aria-label="Subclass">
                      {subclassesFor(classId).map((sc) => (
                        <button key={sc.id} role="radio" aria-checked={sc.id === subclassId}
                          className={`gr-chip filter${sc.id === subclassId ? ' is-on' : ''}`} onClick={() => setSubclassId(sc.id === subclassId ? undefined : sc.id)}>
                          {sc.name}<SourceTag source={sc.source} />
                        </button>
                      ))}
                    </div>
                    {subclassId && (
                      <span key={subclassId} className="muted fade-up">
                        {subclassById(subclassId)?.description ? excerpt(subclassById(subclassId)!.description, 200) : 'Listed by name; see the Player\'s Handbook for its features.'}
                      </span>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}

          {step === 3 && (
            <>
              <div className="seg rise" role="group" aria-label="Score method" style={{ '--i': 0 } as CSSProperties}>
                {([['standard', 'Standard array'], ['pointbuy', 'Point buy']] as const).map(([m, l]) => (
                  <button key={m} className={method === m ? 'segbtn is-on' : 'segbtn'} aria-pressed={method === m} onClick={() => switchMethod(m)}>{l}</button>
                ))}
              </div>
              <div className="panel panel--sm row rise" style={{ gap: 12, padding: 12, '--i': 1 } as CSSProperties}>
                <div className="col" style={{ gap: 2, flex: 1 }}>
                  <span style={{ fontWeight: 700 }}>{method === 'standard' ? 'Standard array' : 'Point buy'}</span>
                  <span className="muted">
                    {method === 'standard'
                      ? swapFrom ? `Tap another ability to swap with ${ABILITY_NAMES[swapFrom]}.` : '15, 14, 13, 12, 10, 8. Tap two scores to swap them.'
                      : 'Scores 8 to 15. 14 and 15 cost 2 points each.'}
                  </span>
                </div>
                {method === 'pointbuy' && <><Tick value={left} style={{ fontSize: 30 }} /><span className="gr-label" style={{ fontSize: 11 }}>left</span></>}
              </div>
              <div className="panel rise" style={{ '--i': 2 } as CSSProperties}>
                {ABILITIES.map((a) => {
                  const cost = POINT_BUY_COST[scores[a] + 1] - POINT_BUY_COST[scores[a]];
                  return (
                    <div key={a} className={`abrow${a === key ? ' is-key' : ''}`}>
                      <span style={{ width: 112, fontWeight: 700, whiteSpace: 'nowrap' }}>{ABILITY_NAMES[a]}</span>
                      <span className="num" style={{ width: 52, fontSize: 15, color: 'var(--text-muted)' }}>
                        <Tick value={abilityMod(final[a])} sign />
                        {effBoosts[a] ? <sup key={`${a}${effBoosts[a]}`} className="boost-badge"> +{effBoosts[a]}</sup> : null}
                      </span>
                      {method === 'pointbuy' ? (
                        <div className="gr-stepper" style={{ marginLeft: 'auto', height: 44 }}>
                          <button onClick={() => setScore(a, -1)} aria-label={`Lower ${ABILITY_NAMES[a]}`} disabled={scores[a] <= 8}><Icon name="minus" /></button>
                          <output key={scores[a]} className="tick">{scores[a]}</output>
                          <button onClick={() => setScore(a, 1)} aria-label={`Raise ${ABILITY_NAMES[a]}`} disabled={scores[a] >= 15 || cost > left}><Icon name="plus" /></button>
                        </div>
                      ) : (
                        <button className={`score-tile${swapFrom === a ? ' is-lifted' : ''}`} onClick={() => tapStandard(a)}
                          aria-pressed={swapFrom === a} aria-label={`${ABILITY_NAMES[a]} ${scores[a]}${swapFrom ? `, swap with ${ABILITY_NAMES[swapFrom]}` : ''}`}>
                          <span key={scores[a]} className="num tick">{scores[a]}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <section className="gr-window rise" style={{ '--tincture': 'var(--tincture-3)', width: '100%', '--i': 3 } as CSSProperties}>
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
              <div className="gr-notice gr-hint rise" style={{ '--i': 4 } as CSSProperties}>
                <Icon name="info" />
                <span>Put your highest score in {ABILITY_NAMES[key]} for a {cls.name.toLowerCase()}.</span>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <KitPicker label={`${cls.name} equipment`} kits={clsKits} value={classKit} onPick={setClassKit} />
              <KitPicker label={`${bg.name} equipment`} kits={bgKits} value={bgKit} onPick={setBgKit} />
              <div className="panel panel--sm row rise" style={{ gap: 16, padding: 12, '--i': 4 } as CSSProperties}>
                <div className="col" style={{ gap: 2, flex: 1 }}>
                  <span style={{ fontWeight: 700 }}>Starting purse and armour</span>
                  <span className="muted">AC uses the best armour in your kits.</span>
                </div>
                <div className="col" style={{ alignItems: 'center' }}><Tick value={kitGold(chosenKits)} style={{ fontSize: 22 }} /><span className="gr-label" style={{ fontSize: 11 }}>GP</span></div>
                <div className="col" style={{ alignItems: 'center' }}><Tick value={ac} style={{ fontSize: 22 }} /><span className="gr-label" style={{ fontSize: 11 }}>AC</span></div>
              </div>
              <div className="col rise" style={{ gap: 8, '--i': 5 } as CSSProperties}>
                <div className="row" style={{ alignItems: 'baseline' }}>
                  <span className="gr-label" style={{ flex: 1 }}>Languages</span>
                  <span className="muted"><Tick value={languages.length} /> of {LANGUAGE_PICKS}</span>
                </div>
                <div className="chips" role="group" aria-label="Languages">
                  <span className="gr-chip filter is-on lang-locked"><Icon name="check" />Common</span>
                  {STANDARD_LANGUAGES.map((l) => (
                    <button key={l.id} className={`gr-chip filter${languages.includes(l.id) ? ' is-on' : ''}`} aria-pressed={languages.includes(l.id)} onClick={() => toggleLanguage(l.id)}>
                      {l.name}
                    </button>
                  ))}
                </div>
                <span className="muted">Everyone speaks Common. Pick two standard languages.</span>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <section className="gr-window unroll" style={{ '--tincture': 'var(--tincture-4)', width: '100%' } as CSSProperties}>
                <div className="gr-window__head"><i className="gr-window__mark" /><div className="gr-window__title"><span>{name.trim() || 'Unnamed hero'}</span></div></div>
                <div className="gr-window__body" style={{ position: 'relative' }}>
                  <WaxSeal className="wax--review" />
                  <span style={{ fontSize: 16, paddingRight: 56 }}>
                    Level 1 · {originName(speciesId, lineageId)} {cls.name.toLowerCase()} · {bg.name}
                  </span>
                  <div className="grid3">
                    {([['HP', preview?.hp.max ?? hp, false], ['AC', preview?.armorClass ?? ac, false], ['Init', dexMod + (previewOrigin?.initiativeBonus ?? 0), true]] as const).map(([k, v, sign], i) => (
                      <div key={k} className="stat flip" style={{ background: 'var(--bg)', '--i': i } as CSSProperties}>
                        <span className="gr-label">{k}</span><ReviewNumber value={v} sign={sign} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4 }}>
                    {ABILITIES.map((a, i) => (
                      <div key={a} className="col flip" style={{ alignItems: 'center', border: '2px solid var(--ink)', '--i': i + 3 } as CSSProperties}>
                        <span style={{ width: '100%', textAlign: 'center', background: 'var(--ink)', color: 'var(--paper)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', padding: '3px 0' }}>{a.toUpperCase()}</span>
                        <span className="num" style={{ fontSize: 18, lineHeight: 1.3 }}>{signed(abilityMod(final[a]))}</span>
                        <span className="muted" style={{ paddingBottom: 4 }}>{final[a]}</span>
                      </div>
                    ))}
                  </div>
                  <dl className="ledger">
                    {[
                      ['Origin', `${originName(speciesId, lineageId)} · ${(species.sizes?.length ?? 0) > 1 ? cap(size) : cap(species.size)} · ${speed} ft`],
                      ['Feats', (previewOrigin?.feats ?? []).map((f) => `${f.name}${f.note ? ` (${f.note})` : ''}`).join(', ') || (feat?.name ?? '')],
                      ['Path', subclassId ? `${subclassById(subclassId)?.name} at level 3` : 'Chosen at level 3'],
                      ['Skills', (preview?.skills ?? []).map(skillName).join(', ')],
                      ['Saves', cls.saves.map(cap).join(', ')],
                      ...(previewOrigin?.darkvision ? [['Senses', `Darkvision ${previewOrigin.darkvision} ft`]] : []),
                      ...(previewOrigin?.resistances.length ? [['Resists', previewOrigin.resistances.map(cap).join(', ')]] : []),
                      ...(preview?.tools?.length ? [['Tools', preview.tools.join(', ')]] : []),
                      ...(preview && spells && (featSpells.length || previewOrigin?.grantedSpells.length)
                        ? [['Spells', [...featSpells, ...previewOrigin!.grantedSpells].map((s) => spells.find((x) => x.id === s.id)?.name ?? s.id).join(', ')]] : []),
                      ['Tongues', ['Common', ...languages.map((l) => languageById(l)?.name ?? l)].join(', ')],
                      ['Pack', `${chosenKits.reduce((n, k) => n + (k?.items.length ?? 0), 0)} items · ${kitGold(chosenKits)} GP`],
                    ].map(([k, v], i) => (
                      <div key={k} className="ledger__row" style={{ '--i': i + 9 } as CSSProperties}><dt className="gr-label">{k}</dt><dd>{v}</dd></div>
                    ))}
                  </dl>
                </div>
              </section>
              <div className="gr-notice gr-ok rise" style={{ '--i': 14 } as CSSProperties}>
                <Icon name="check" />
                <span><b>Ready for the table</b>HP starts at {preview?.hp.max ?? hp} ({cls.hitDie} {signed(conMod)} CON{(previewOrigin?.hpPerLevel ?? 0) > 0 ? ` + ${previewOrigin!.hpPerLevel} from your origin` : ''}). More spells can be added from the sheet.</span>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="foot foot--lg grid2" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
        <button className="gr-btn gr-btn--secondary" style={{ height: 48 }} onClick={() => go(Math.max(0, step - 1))} disabled={step === 0}>
          <Icon name="back" />Back
        </button>
        {step < STEPS.length - 1 ? (
          <button className="gr-btn gr-btn--primary" style={{ height: 48 }} onClick={() => go(step + 1)} disabled={!valid[step]}>
            Next<Icon name="next" />
          </button>
        ) : (
          <button className="gr-btn gr-btn--primary create-btn" style={{ height: 48 }} onClick={create} disabled={sealing}><Icon name="check" />Create character</button>
        )}
      </footer>

      {sealing && (
        <div className="sealing" role="status" aria-live="polite">
          <div className="sealing__burst" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--a': `${i * 45}deg` } as CSSProperties} />)}
          </div>
          <WaxSeal className="wax--big" />
          <span className="sealing__name">{name.trim()}</span>
          <span className="muted">joins the table</span>
        </div>
      )}
    </div>
  );
}

/** Review stats tally up from zero. */
function ReviewNumber({ value, sign }: { value: number; sign?: boolean }) {
  return <Tick value={value} sign={sign} from={0} style={{ fontSize: 22 }} />;
}
