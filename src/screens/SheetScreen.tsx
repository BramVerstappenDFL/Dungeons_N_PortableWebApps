import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Ability, Character } from '../types';
import { backgroundById, featById, languageById, originName, subclassById, weaponById } from '../data';
import { useStore } from '../store/characters';
import { derive } from '../rules/derived';
import { ABILITIES } from '../rules/abilities';
import { applyXp, bandPct, levelForXp, xpForNext } from '../rules/xp';
import { weaponAttack } from '../rules/weapons';
import { applyDeathSave } from '../rules/hp';
import { spendHitDie, finishShortRest } from '../rules/rest';
import { spellRolls } from '../rules/spells';
import { Icon } from '../ui/Icon';
import { TabBar } from '../ui/TabBar';
import { HpCells } from '../ui/HpCells';
import { BottomSheet } from '../ui/BottomSheet';
import { Stepper } from '../ui/Stepper';
import { CardList, useAccordion, type CardItem } from '../ui/Accordion';
import { useSpells } from '../ui/useSpells';
import { reducedMotion } from '../ui/theme';
import { cap, excerpt, ordinal, prettyExpr, signed } from '../ui/format';
import { CharacterSwitcher } from './CharacterSwitcher';
import './sheet.css';

const fmt = (n: number) => n.toLocaleString('en-US');
const SCHOOL_TINT: Record<string, string> = {
  evocation: 'var(--tincture-2)', abjuration: 'var(--tincture-1)', conjuration: 'var(--tincture-5)',
  transmutation: 'var(--tincture-3)', enchantment: 'var(--tincture-4)', necromancy: 'var(--tincture-6)',
  divination: 'var(--tincture-1)', illusion: 'var(--tincture-4)',
};

interface Orb { sx: number; sy: number; tx: number; ty: number; dl: number; sz: number }

export function SheetScreen({ c }: { c: Character }) {
  const update = useStore((s) => s.update);
  const roll = useStore((s) => s.roll);
  const nav = useNavigate();
  const d = derive(c);
  const spells = useSpells();
  const set = (fn: (c: Character) => Character) => update(c.id, fn);

  const [tab, setTab] = useState<'weapons' | 'spells'>('weapons');
  const [levelFilter, setLevelFilter] = useState<number | null>(null);
  const [sheet, setSheet] = useState<null | 'xp' | 'switch' | 'ac' | 'short'>(null);
  const mainRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const xpBarRef = useRef<HTMLDivElement>(null);

  // ---- Experience, with the orbs that fly into the bar ----
  const [shownXp, setShownXp] = useState(c.xp);
  const [orbs, setOrbs] = useState<Orb[] | null>(null);
  const [gain, setGain] = useState(0);
  const [gaining, setGaining] = useState(false);
  const [levelUp, setLevelUp] = useState(false);
  const [draft, setDraft] = useState('');
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { if (!orbs) setShownXp(c.xp); }, [c.xp, orbs]);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const addXp = (amount: number) => {
    if (!(amount > 0) || !d.cls) return;
    const from = c.xp, to = from + amount;
    const { levelsGained } = applyXp(c, amount, d.hitDie);
    const leveled = levelsGained > 0;
    timers.current.forEach(clearTimeout); timers.current = [];
    set((x) => applyXp(x, amount, d.hitDie).character);
    setSheet(null); setDraft('');
    if (reducedMotion()) {
      setShownXp(to); setLevelUp(leveled);
      if (leveled) later(() => setLevelUp(false), 3000);
      return;
    }
    let tx = 200, ty = 104;
    if (rootRef.current && xpBarRef.current) {
      const r = rootRef.current.getBoundingClientRect(), b = xpBarRef.current.getBoundingClientRect();
      const pct = leveled ? 100 : bandPct(to);
      tx = b.left - r.left + (b.width * pct) / 100;
      ty = b.top - r.top + b.height / 2;
    }
    const w = rootRef.current?.clientWidth ?? 390, h = rootRef.current?.clientHeight ?? 844;
    const n = Math.max(7, Math.min(22, Math.round(Math.sqrt(amount) / 2) + 5));
    setOrbs(Array.from({ length: n }, (_, i) => ({
      sx: Math.round(w * 0.18 + Math.random() * w * 0.64), sy: Math.round(h * 0.4 + Math.random() * h * 0.36),
      tx: Math.round(tx - 6 + Math.random() * 12), ty: Math.round(ty),
      dl: i * 55 + Math.round(Math.random() * 40), sz: 8 + Math.round(Math.random() * 3) * 2,
    })));
    setGain(amount); setGaining(false); setLevelUp(false); setShownXp(from);
    const first = 950, last = first + n * 55, steps = 14;
    for (let k = 1; k <= steps; k++) {
      later(() => { setShownXp(Math.round(from + (amount * k) / steps)); setGaining(true); }, first + ((last - first) * k) / steps);
    }
    later(() => { setShownXp(to); setLevelUp(leveled); }, last + 60);
    later(() => { setOrbs(null); setGaining(false); }, last + 700);
    if (leveled) later(() => setLevelUp(false), last + 4000);
  };

  const shownLvl = Math.max(c.level, levelForXp(shownXp));
  const draftN = Math.max(0, parseInt(draft || '0', 10) || 0);
  const nowPct = bandPct(c.xp);
  const landLevel = Math.max(c.level, levelForXp(c.xp + draftN));
  const pendingPct = landLevel > c.level ? 100 - nowPct : Math.max(0, bandPct(c.xp + draftN) - nowPct);

  // ---- Weapons and spells ----
  const weaponItems = c.inventory.filter((i) => i.kind === 'weapon' && i.equipped && weaponById(i.weaponId));
  const weaponCards: CardItem[] = weaponItems.map((i) => {
    const w = weaponById(i.weaponId)!;
    const a = weaponAttack(c, w);
    return {
      key: i.id, name: i.name, level: w.category === 'martial' ? 3 : 1,
      short: `${signed(a.toHit)} · ${prettyExpr(a.damage)}`,
      kind: `${cap(w.category)} ${w.range}`, tint: 'var(--tincture-3)',
      facts: [['To hit', signed(a.toHit)], ['Damage', `${prettyExpr(a.damage)} ${w.damageType}`], ['Range', a.rangeText], ['Weight', `${w.weight} lb`]],
      text: w.properties.length ? `Properties: ${w.properties.map((p) => p.replace(/-/g, ' ')).join(', ')}.` : undefined,
      foot: (
        <div className="gr-card__foot">
          <span className="gr-chip gr-chip--buff"><Icon name="check" />Equipped</span>
          {i.qty > 1 && <span className="gr-tag">×{i.qty} carried</span>}
          {a.versatile && <span className="gr-tag">Two hands: {prettyExpr(a.versatile)}</span>}
        </div>
      ),
    };
  });

  const known = useMemo(() => {
    if (!spells) return [];
    const byId = new Map(spells.map((s) => [s.id, s]));
    return c.spells
      .map((cs) => ({ cs, s: byId.get(cs.id)! }))
      .filter((x) => x.s && (x.s.level === 0 || x.cs.prepared))
      .sort((a, b) => a.s.level - b.s.level || a.s.name.localeCompare(b.s.name));
  }, [spells, c.spells]);
  const levelsKnown = [...new Set(known.map((k) => k.s.level))];
  const spellCards: CardItem[] = known
    .filter((k) => levelFilter === null || k.s.level === levelFilter)
    .map(({ s }) => {
      const rolls = spellRolls(s, Math.max(1, s.level), c.level, d.spellMod);
      const effect = rolls[0] ? prettyExpr(rolls[0].expression) + (s.damageType ? ` ${s.damageType}` : '') : s.save ? `${s.save.toUpperCase()} save` : '—';
      return {
        key: s.id, name: s.name, level: s.level, kind: cap(s.school), tint: SCHOOL_TINT[s.school],
        short: `${ordinal(s.level)} · ${s.range}`,
        facts: [['Level', ordinal(s.level)], ['Casting time', s.castingTime], ['Range', s.range], ['Duration', s.duration], ['Effect', effect]],
        text: excerpt(s.description),
        foot: (
          <div className="gr-card__foot">
            <span className="gr-chip gr-chip--buff"><Icon name="check" />{s.level === 0 ? 'Known' : 'Prepared'}</span>
            <span className="gr-tag">{s.level === 0 ? 'At will' : `Slot ${ordinal(s.level)}`}</span>
            {s.concentration && <span className="gr-tag">Concentration</span>}
          </div>
        ),
      };
    });
  const cards = tab === 'weapons' ? weaponCards : spellCards;
  const acc = useAccordion(mainRef, cards.length);
  const isCaster = d.slotsMax.some((n) => n > 0) || c.spells.length > 0;

  const bg = backgroundById(c.backgroundId);
  const subtitle = [`Level ${shownLvl}`, [d.species ? originName(c.speciesId, c.lineageId) : undefined, d.cls?.name.toLowerCase()].filter(Boolean).join(' '), bg?.name].filter(Boolean).join(' · ');

  // ---- Spell slots ----
  const toggleSlot = (lvl: number, idx: number) => set((x) => {
    const used = [...x.spellSlotsUsed];
    const max = d.slotsMax[lvl - 1];
    const avail = max - used[lvl - 1];
    used[lvl - 1] = idx < avail ? used[lvl - 1] + 1 : used[lvl - 1] - 1;
    used[lvl - 1] = Math.max(0, Math.min(max, used[lvl - 1]));
    return { ...x, spellSlotsUsed: used };
  });

  const down = c.hp.current === 0;
  const dead = c.deathSaves.failures >= 3;
  const deathSave = () => {
    const r = roll('1d20', 'Death saving throw', { characterId: c.id });
    if (r?.result.natural != null) set((x) => applyDeathSave(x, r.result.natural!));
  };

  return (
    <div ref={rootRef} className="screen">
      <header className="hdr" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, paddingBottom: 12 }}>
        <div className="row" style={{ gap: 12 }}>
          <button className="namebtn" onClick={() => setSheet('switch')} aria-label={`${c.name}. Switch character`}>
            <span className="gr-token" style={{ '--tincture': 'var(--tincture-4)', width: 48, height: 48, fontSize: 22, flex: 'none' } as CSSProperties}>
              {c.name.charAt(0).toUpperCase()}
            </span>
            <span className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <h1 style={{ letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</h1>
              <span className="row muted" style={{ gap: 6 }}>
                {subtitle}
                {levelUp && <span className="gr-tag gr-tag--gilt lvl-pop">Level up</span>}
              </span>
            </span>
          </button>
          <button className="gr-btn gr-btn--secondary gr-btn--icon ico-btn" aria-label="Add experience" onClick={() => { setDraft(''); setSheet('xp'); }}>
            <Icon name="sparkle" />
          </button>
        </div>
        <div className="row">
          <span className="gr-label" style={{ fontSize: 11, letterSpacing: '0.1em' }}>XP</span>
          <div ref={xpBarRef} className={`xpbar${gaining ? ' is-gaining' : ''}${levelUp ? ' is-levelup' : ''}`} role="progressbar"
            aria-label={`Experience toward level ${Math.min(20, c.level + 1)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(bandPct(shownXp))}>
            <div className="xpbar__fill" style={{ width: `${bandPct(shownXp)}%` }} />
          </div>
          <span className="num" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{fmt(shownXp)} / {fmt(xpForNext(shownLvl))}</span>
          {orbs && <span className="gr-tag gr-tag--gilt gain-tag">+{fmt(gain)}</span>}
        </div>
      </header>

      <main ref={mainRef} onScroll={acc.onScroll} className="scroll" style={{ padding: '16px 16px 24px', gap: 16 }}>
        {down && (
          <div className={dead ? 'gr-notice gr-error' : 'gr-notice gr-warn'}>
            <Icon name="alert" />
            <span style={{ flex: 1 }}>
              <b>{dead ? 'Dead' : c.deathSaves.successes >= 3 ? 'Stable at 0 hit points' : 'Down: death saving throws'}</b>
              Successes {c.deathSaves.successes} / 3 · Failures {c.deathSaves.failures} / 3
            </span>
            {!dead && c.deathSaves.successes < 3 && <button className="gr-btn gr-btn--roll gr-btn--small" onClick={deathSave}>Roll</button>}
          </div>
        )}

        <section className="gr-window" style={{ '--tincture': 'var(--tincture-5)', width: '100%' } as CSSProperties}>
          <div className="gr-window__head"><i className="gr-window__mark" /><div className="gr-window__title"><span>Hit points</span></div></div>
          <div className="gr-window__body">
            <div className="row" style={{ alignItems: 'baseline' }}>
              <span className="num" style={{ fontSize: 44 }}>{c.hp.current}</span>
              <span className="num" style={{ fontSize: 18, color: 'var(--text-muted)' }}>/ {c.hp.max}</span>
              <span className="gr-chip" style={{ marginLeft: 'auto', alignSelf: 'center' }}>Temp {c.hp.temp}</span>
            </div>
            <HpCells current={c.hp.current} max={c.hp.max} temp={c.hp.temp} />
            <div className="grid2">
              <Link to="/damage" className="gr-btn gr-btn--primary" style={{ height: 44 }}><Icon name="flame" />Damage / heal</Link>
              <Link to="/rest" className="gr-btn gr-btn--secondary" style={{ height: 44 }}><Icon name="moon" />Long rest</Link>
            </div>
          </div>
        </section>

        <div className="grid4">
          <button className="stat stat--shadow" onClick={() => setSheet('ac')} aria-label={`Armor class ${c.armorClass}. Change`}>
            <span className="gr-label">AC</span><span className="num">{c.armorClass}</span>
          </button>
          <div className="stat stat--shadow"><span className="gr-label">Init</span><span className="num">{signed(d.initiative)}</span></div>
          <div className="stat stat--shadow"><span className="gr-label">Speed</span><span className="num">{d.speed}</span></div>
          <div className="stat stat--shadow"><span className="gr-label">Prof</span><span className="num">{signed(d.pb)}</span></div>
        </div>

        <div className="chips">
          {c.concentration && spells && (
            <button className="gr-chip gr-chip--buff chipbtn" onClick={() => set((x) => ({ ...x, concentration: null }))} aria-label="End concentration">
              <Icon name="shield" />{spells.find((s) => s.id === c.concentration)?.name ?? 'Concentrating'}<span className="gr-chip__meta">end</span>
            </button>
          )}
          <button className={`gr-chip chipbtn${c.inspiration ? ' gr-chip--buff' : ' gr-chip--off'}`} aria-pressed={c.inspiration}
            onClick={() => set((x) => ({ ...x, inspiration: !x.inspiration }))}>
            {c.inspiration && <Icon name="star" />}Inspiration
          </button>
          {c.exhaustion > 0 && <span className="gr-chip gr-chip--debuff">Exhaustion {c.exhaustion}</span>}
        </div>

        <div className="gr-rule"><i /></div>

        <section className="col" style={{ gap: 12 }}>
          <h2 className="gr-label" style={{ margin: 0 }}>Abilities</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '4px 12px', justifyItems: 'center' }}>
            {ABILITIES.map((a: Ability) => (
              <div key={a} className={`gr-ability${d.cls?.saves.includes(a) ? ' is-prof' : ''}`}>
                <span className="gr-ability__label"><i className="gr-ability__pip" />{cap(a)}</span>
                <span className="gr-ability__mod">{signed(d.mods[a])}</span>
                <span className="gr-ability__score">{c.abilities[a]}</span>
              </div>
            ))}
          </div>
          <span className="muted">Gold pips mark proficient saving throws.</span>
        </section>

        {(c.originFeat || c.subclassId || (c.languages?.length ?? 0) > 0) && (
          <dl className="origin-facts">
            {c.originFeat && <div><dt className="gr-label">Feat</dt><dd>{featById(c.originFeat)?.name ?? c.originFeat}{c.originFeatNote ? ` (${c.originFeatNote})` : ''}</dd></div>}
            {c.subclassId && <div><dt className="gr-label">Path</dt><dd>{subclassById(c.subclassId)?.name}{c.level < 3 ? ' (from level 3)' : ''}</dd></div>}
            {(c.languages?.length ?? 0) > 0 && <div><dt className="gr-label">Tongues</dt><dd>{c.languages!.map((l) => languageById(l)?.name ?? l).join(', ')}</dd></div>}
          </dl>
        )}

        <section className="gr-window" style={{ '--tincture': 'var(--tincture-4)', width: '100%' } as CSSProperties}>
          <div className="gr-window__head"><i className="gr-window__mark" /><div className="gr-window__title"><span>{isCaster ? 'Spell slots' : 'Hit dice'}</span></div></div>
          <div className="gr-window__body" style={{ gap: 10 }}>
            {d.slotsMax.map((max, i) => max > 0 && (
              <div key={i} className="slotrow">
                <span className="num" style={{ width: 44, fontSize: 16 }}>{ordinal(i + 1)}</span>
                {Array.from({ length: max }, (_, k) => {
                  const avail = max - c.spellSlotsUsed[i];
                  const used = k >= avail;
                  return (
                    <button key={k} className={used ? 'slot used' : 'slot'} onClick={() => toggleSlot(i + 1, k)}
                      aria-label={used ? `Restore a ${ordinal(i + 1)}-level slot` : `Use a ${ordinal(i + 1)}-level slot`} />
                  );
                })}
                <span className="muted" style={{ marginLeft: 'auto' }}>{max - c.spellSlotsUsed[i]} of {max}</span>
              </div>
            ))}
            <button className="row" onClick={() => setSheet('short')}
              style={{ gap: 10, padding: isCaster ? '10px 0 0' : 0, border: 0, borderTop: isCaster ? '2px solid var(--ink)' : 0, background: 'transparent', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontWeight: 700 }}>Hit dice</span>
              <span className="muted">Short rest</span>
              <span className="num" style={{ marginLeft: 'auto', fontSize: 16 }}>{c.level - c.hitDiceUsed} / {c.level} d{d.hitDie}</span>
            </button>
          </div>
        </section>

        <section className="col" style={{ gap: 12 }}>
          {isCaster && (
            <div role="group" aria-label="Weapons or spells" className="seg">
              <button className={tab === 'weapons' ? 'segbtn is-on' : 'segbtn'} onClick={() => { setTab('weapons'); acc.setActive(-1); }} aria-pressed={tab === 'weapons'}>Weapons</button>
              <button className={tab === 'spells' ? 'segbtn is-on' : 'segbtn'} onClick={() => { setTab('spells'); acc.setActive(-1); }} aria-pressed={tab === 'spells'}>Spells</button>
            </div>
          )}
          {tab === 'weapons' ? (
            <>
              <span className="muted">Equipped weapons only. Change what you carry in the pack.</span>
              {weaponCards.length ? <CardList items={weaponCards} acc={acc} /> : (
                <div className="gr-notice gr-empty">
                  <Icon name="pack" /><b>No weapons equipped</b>
                  <span>Add a weapon in the pack and tick it to hold it.</span>
                  <Link to="/pack" className="gr-btn gr-btn--secondary gr-btn--small">Open pack</Link>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid3">
                <div className="stat"><span className="gr-label">Save DC</span><span className="num" style={{ fontSize: 22 }}>{d.spellDC}</span></div>
                <div className="stat"><span className="gr-label">Attack</span><span className="num" style={{ fontSize: 22 }}>{signed(d.spellAttack)}</span></div>
                <div className="stat"><span className="gr-label">Ready</span><span className="num" style={{ fontSize: 22 }}>{known.length}</span></div>
              </div>
              <div className="chips" role="group" aria-label="Spell level">
                {[null, ...levelsKnown].map((l) => (
                  <button key={String(l)} className={`gr-chip lvlf${levelFilter === l ? ' is-on' : ''}`} aria-pressed={levelFilter === l}
                    onClick={() => { setLevelFilter(l); acc.setActive(-1); }}>
                    {l === null ? 'All' : l === 0 ? 'Cantrips' : ordinal(l)}
                  </button>
                ))}
                <button className="gr-chip lvlf" onClick={() => nav('/spells')} style={{ marginLeft: 'auto' }}><Icon name="book" />Manage</button>
              </div>
              {spellCards.length ? <CardList items={spellCards} acc={acc} /> : (
                <div className="gr-notice gr-empty">
                  <Icon name="book" /><b>{spells ? 'No spells ready' : 'Loading spells'}</b>
                  <span>Learn cantrips and prepare spells in your spellbook.</span>
                  <Link to="/spells" className="gr-btn gr-btn--secondary gr-btn--small">Open spellbook</Link>
                </div>
              )}
              <span className="muted">Cantrips and today's prepared spells. Scroll to open the next card, or tap a title.</span>
            </>
          )}
          {cards.length > 1 && <div aria-hidden="true" style={{ height: 260, flex: 'none' }} />}
        </section>
      </main>

      <TabBar />

      {sheet === 'xp' && (
        <BottomSheet title="Add experience" onClose={() => setSheet(null)}>
          <div className="col" style={{ gap: 8, padding: 12, background: 'var(--bg)', border: '2px solid var(--ink)' }}>
            <div className="row" style={{ alignItems: 'baseline' }}>
              <span className="num" style={{ fontSize: 30 }}>{c.level >= 20 ? '—' : fmt(Math.max(0, xpForNext(c.level) - c.xp))}</span>
              <span style={{ fontSize: 14.5, color: 'var(--text-muted)' }}>{c.level >= 20 ? 'Highest level reached' : `XP needed for level ${c.level + 1}`}</span>
            </div>
            <div className="xpbar" style={{ flex: 'none' }} aria-hidden="true">
              <div style={{ height: '100%', display: 'flex' }}>
                <div className="xpbar__fill" style={{ width: `${Math.round(nowPct)}%` }} />
                <div style={{ height: '100%', width: `${Math.round(pendingPct)}%`, background: 'repeating-linear-gradient(135deg, var(--gilt) 0 2px, var(--paper) 2px 4px)' }} />
              </div>
            </div>
            <span className="muted">{fmt(c.xp)} of {fmt(xpForNext(c.level))} XP · level {c.level}</span>
          </div>
          <div className="gr-field" style={{ width: '100%' }}>
            <label htmlFor="xpAmount" className="gr-label">Experience gained</label>
            <input id="xpAmount" className="gr-input" style={{ height: 48, font: '600 22px/1 var(--font-heading)' }} type="text" inputMode="numeric"
              placeholder="0" value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} />
          </div>
          <div className="row" style={{ gap: 6 }} role="group" aria-label="Quick amounts">
            {[50, 100, 250, 500, 1000].map((v) => (
              <button key={v} className="gr-chip xpchip" onClick={() => setDraft(String(draftN + v))}>+{fmt(v)}</button>
            ))}
          </div>
          {landLevel > c.level && (
            <div className="gr-notice gr-warn">
              <Icon name="sparkle" />
              <span><b>Enough for level {landLevel}</b>Your hit points grow with the average for your class. Add new spells in the spellbook.</span>
            </div>
          )}
          <div className="grid2">
            <button className="gr-btn gr-btn--secondary" style={{ height: 48 }} onClick={() => setSheet(null)}>Cancel</button>
            <button className="gr-btn gr-btn--primary" style={{ height: 48 }} onClick={() => addXp(draftN)} disabled={draftN <= 0}>
              {draftN > 0 ? `Add ${fmt(draftN)} XP` : 'Add XP'}
            </button>
          </div>
        </BottomSheet>
      )}

      {sheet === 'ac' && (
        <BottomSheet title="Armor class" onClose={() => setSheet(null)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 16 }}>Armor, shield and magic included</span>
            <Stepper label="Armor class" value={c.armorClass} min={1} max={30} onChange={(v) => set((x) => ({ ...x, armorClass: v }))} />
          </div>
          <span className="muted">Without armor your AC is 10 + Dexterity modifier ({10 + d.mods.dex}).</span>
          <button className="gr-btn gr-btn--primary" style={{ height: 48 }} onClick={() => setSheet(null)}>Done</button>
        </BottomSheet>
      )}

      {sheet === 'short' && <ShortRestSheet c={c} onClose={() => setSheet(null)} />}
      {sheet === 'switch' && <CharacterSwitcher onClose={() => setSheet(null)} />}

      {orbs && (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none', overflow: 'hidden' }}>
          {orbs.map((o, i) => (
            <i key={i} className="xp-orb" style={{ '--sx': `${o.sx}px`, '--sy': `${o.sy}px`, '--tx': `${o.tx}px`, '--ty': `${o.ty}px`, '--dl': `${o.dl}ms`, '--sz': `${o.sz}px` } as CSSProperties} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Short rest: spend Hit Dice one at a time. Warlocks regain Pact Magic slots when it ends. */
function ShortRestSheet({ c, onClose }: { c: Character; onClose: () => void }) {
  const update = useStore((s) => s.update);
  const d = derive(c);
  const [log, setLog] = useState<string[]>([]);
  const left = c.level - c.hitDiceUsed;
  const spend = () => {
    if (!d.cls) return;
    const r = spendHitDie(c, d.cls);
    if (!r) return;
    update(c.id, () => r.character);
    setLog((l) => [`d${d.hitDie} (${r.roll}) ${signed(d.mods.con)} CON: healed ${r.healed}`, ...l]);
  };
  const finish = () => {
    if (d.cls) update(c.id, (x) => finishShortRest(x, d.cls!));
    onClose();
  };
  return (
    <BottomSheet title="Short rest" onClose={finish}>
      <span style={{ fontSize: 16, lineHeight: 1.5, color: 'var(--text-muted)' }}>
        Rest for an hour. Spend Hit Dice to heal: each one rolls d{d.hitDie} + your Constitution modifier.
      </span>
      <div className="grid3">
        <div className="stat"><span className="gr-label">HP</span><span className="num" style={{ fontSize: 22 }}>{c.hp.current} / {c.hp.max}</span></div>
        <div className="stat"><span className="gr-label">Hit dice</span><span className="num" style={{ fontSize: 22 }}>{left} / {c.level}</span></div>
        <div className="stat"><span className="gr-label">Die</span><span className="num" style={{ fontSize: 22 }}>d{d.hitDie}</span></div>
      </div>
      {log.length > 0 && (
        <div className="panel panel--sm col" style={{ padding: '6px 12px' }}>
          {log.map((l, i) => <span key={i} style={{ padding: '4px 0', fontSize: 14.5 }}>{l}</span>)}
        </div>
      )}
      {d.cls?.casterType === 'pact' && <span className="muted">Pact Magic slots come back when you finish.</span>}
      <div className="grid2">
        <button className="gr-btn gr-btn--roll" style={{ height: 48 }} onClick={spend} disabled={left <= 0 || c.hp.current >= c.hp.max}>
          <Icon name="d20" />Spend a die
        </button>
        <button className="gr-btn gr-btn--primary" style={{ height: 48 }} onClick={finish}>Finish rest</button>
      </div>
    </BottomSheet>
  );
}

