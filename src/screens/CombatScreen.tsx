import { useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Character, EconomySlot, Spell } from '../types';
import { weaponById } from '../data';
import { useStore } from '../store/characters';
import { derive } from '../rules/derived';
import { endTurn, newCombat, pickSlot, setUsed, slotForCastingTime, spendSlot } from '../rules/combat';
import { weaponAttack } from '../rules/weapons';
import { spellRolls } from '../rules/spells';
import { d20With } from '../rules/dice';
import { Icon } from '../ui/Icon';
import { TabBar } from '../ui/TabBar';
import { CardList, useAccordion, type CardItem } from '../ui/Accordion';
import { useRollOverlay, type Face, type RollPopup } from '../ui/RollOverlay';
import { facesOf } from '../ui/RollOverlay';
import { useSpells } from '../ui/useSpells';
import { calcText, cap, excerpt, ordinal, popupFromRoll, prettyExpr, signed } from '../ui/format';
import './combat.css';

const TABS: [EconomySlot, string][] = [['action', 'Action'], ['bonus', 'Bonus action'], ['reaction', 'Reaction']];
const doubleDice = (expr: string) => expr.replace(/(\d+)d(\d+)/g, (_m, n, s) => `${Number(n) * 2}d${s}`);

interface Action extends CardItem { verb: string; go: () => void }

export function CombatScreen({ c }: { c: Character }) {
  const update = useStore((s) => s.update);
  const roll = useStore((s) => s.roll);
  const d = derive(c);
  const spells = useSpells();
  const overlay = useRollOverlay();
  const [tab, setTab] = useState<EconomySlot>('action');
  const mainRef = useRef<HTMLElement>(null);
  const eco = c.combat.eco;
  const set = (fn: (x: Character) => Character) => update(c.id, fn);
  const mark = (slot: EconomySlot) => set((x) => ({ ...x, combat: setUsed(x.combat, slot) }));
  const opts = { characterId: c.id };

  const show = (p: RollPopup, faces: Face[], slot: EconomySlot) => { mark(slot); overlay.show(p, faces); };

  /** Attack roll plus damage, doubling the dice on a natural 20. */
  const attack = (name: string, toHit: number, damage: string, type: string, slot: EconomySlot, after?: string) => {
    const hit = roll(d20With(toHit), `${name} attack`, opts);
    if (!hit) return;
    const nat = hit.result.natural;
    if (nat === 1) {
      const [p, f] = popupFromRoll(hit, `${name}: miss`, { kicker: 'To hit' });
      return show(p, f, slot);
    }
    const dmg = roll(nat === 20 ? doubleDice(damage) : damage, `${name} damage`, opts);
    if (!dmg) return;
    show({
      kicker: 'To hit', total: hit.total, title: `${dmg.total} ${type} damage on a hit`,
      calc: `${calcText(hit.result)} = ${hit.total} · ${calcText(dmg.result)}${after ? ` · ${after}` : ''}`,
      tone: nat === 20 ? 'crit' : undefined, tag: nat === 20 ? 'Critical hit' : undefined,
    }, [...facesOf(hit.result), ...facesOf(dmg.result).slice(0, 2)], slot);
  };

  const cast = (s: Spell, slot: EconomySlot) => {
    const level = pickSlot(s.level, c.spellSlotsUsed, d.slotsMax);
    if (level === null) {
      overlay.show({ kicker: s.name, total: '0', title: `No ${ordinal(s.level)}-level slots left`, calc: 'Take a rest, or tap a used slot on the sheet to restore it.' }, []);
      return;
    }
    const slotText = level > 0 ? `uses a ${ordinal(level)}-level slot` : 'cantrip';
    set((x) => ({ ...x, spellSlotsUsed: spendSlot(x.spellSlotsUsed, level), concentration: s.concentration ? s.id : x.concentration }));
    const rolls = spellRolls(s, Math.max(level, s.level), c.level, d.spellMod);
    if (s.attack && rolls[0]) return attack(s.name, d.spellAttack, rolls[0].expression, s.damageType ?? '', slot, slotText);
    if (rolls[0]) {
      const r = roll(rolls[0].expression, rolls[0].label, opts);
      if (!r) return;
      const heal = !!s.heal && !s.damage;
      return show({
        kicker: heal ? 'Hit points regained' : `${cap(s.damageType ?? '')} damage`.trim(),
        total: r.total,
        title: s.save ? `${s.name}: ${s.save.toUpperCase()} save DC ${d.spellDC}` : s.name,
        calc: `${calcText(r.result)} = ${r.total} · ${slotText}`,
      }, facesOf(r.result), slot);
    }
    show({ kicker: s.save ? `${s.save.toUpperCase()} save` : 'Cast', total: s.save ? `DC ${d.spellDC}` : '✓', title: s.name, calc: `${excerpt(s.description, 140)} · ${slotText}` }, [], slot);
  };

  const check = (label: string, mod: number, slot: EconomySlot) => {
    const r = roll(d20With(mod), label, opts);
    if (r) { const [p, f] = popupFromRoll(r, label); show(p, f, slot); }
  };
  const noRoll = (kicker: string, total: string, title: string, calc: string, slot: EconomySlot = 'action') => () =>
    show({ kicker, total, title, calc }, [], slot);

  // ---- What you can do, by action economy ----
  const weapons = c.inventory.filter((i) => i.kind === 'weapon' && i.equipped && weaponById(i.weaponId));
  const ready = useMemo(() => {
    if (!spells) return [];
    const byId = new Map(spells.map((s) => [s.id, s]));
    return c.spells.map((cs) => ({ cs, s: byId.get(cs.id)! })).filter((x) => x.s && (x.s.level === 0 || x.cs.prepared)).map((x) => x.s)
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [spells, c.spells]);

  const spellAction = (s: Spell, slot: EconomySlot): Action => {
    const r = spellRolls(s, Math.max(1, s.level), c.level, d.spellMod)[0];
    const facts: [string, string][] = [['Level', ordinal(s.level)], ['Range', s.range]];
    if (s.attack) facts.push(['To hit', signed(d.spellAttack)]);
    if (s.save) facts.push(['Save', `${s.save.toUpperCase()} DC ${d.spellDC}`]);
    if (r) facts.push([s.heal && !s.damage ? 'Healing' : 'Damage', `${prettyExpr(r.expression)}${s.damageType ? ` ${s.damageType}` : ''}`]);
    if (facts.length < 4) facts.push(['Duration', s.duration]);
    return {
      key: `${slot}-${s.id}`, name: s.name, level: s.level, kind: cap(s.school), verb: 'Cast',
      short: `${s.level === 0 ? (s.attack ? signed(d.spellAttack) : 'Cantrip') : ordinal(s.level)}${r ? ` · ${prettyExpr(r.expression)}` : ''}`,
      facts, text: excerpt(s.description, 180), go: () => cast(s, slot),
    };
  };
  const weaponAction = (i: (typeof weapons)[number], slot: EconomySlot, opportunity = false): Action => {
    const w = weaponById(i.weaponId)!;
    const a = weaponAttack(c, w);
    return {
      key: `${slot}-${i.id}`, name: i.name, level: w.category === 'martial' ? 3 : 1, kind: opportunity ? 'Opportunity' : 'Weapon', verb: 'Attack',
      short: `${signed(a.toHit)} · ${prettyExpr(a.damage)}`,
      facts: opportunity
        ? [['Trigger', 'Foe leaves reach'], ['To hit', signed(a.toHit)], ['Damage', `${prettyExpr(a.damage)} ${w.damageType}`], ['Reach', a.rangeText]]
        : [['To hit', signed(a.toHit)], ['Damage', `${prettyExpr(a.damage)} ${w.damageType}`], ['Range', a.rangeText], [a.versatile ? 'Two hands' : 'Weight', a.versatile ? prettyExpr(a.versatile) : `${w.weight} lb`]],
      text: opportunity ? 'Opportunity attack: strike a creature as it moves out of your reach.' : w.properties.length ? `Properties: ${w.properties.join(', ')}.` : undefined,
      go: () => attack(i.name, a.toHit, a.damage, w.damageType, slot),
    };
  };

  const bySlot = (slot: EconomySlot) => ready.filter((s) => slotForCastingTime(s.castingTime) === slot).map((s) => spellAction(s, slot));
  const melee = weapons.find((i) => weaponById(i.weaponId)!.range === 'melee');
  const all: Record<EconomySlot, Action[]> = {
    action: [...bySlot('action'), ...weapons.map((i) => weaponAction(i, 'action'))],
    bonus: bySlot('bonus'),
    reaction: [...bySlot('reaction'), ...(melee ? [weaponAction(melee, 'reaction', true)] : [])],
  };
  const items: CardItem[] = all[tab].map((a) => ({
    ...a,
    foot: <button className="gr-btn gr-btn--roll" style={{ position: 'relative', zIndex: 1, width: '100%', height: 48 }} onClick={a.go}>{a.verb}</button>,
  }));
  const acc = useAccordion(mainRef, items.length, 440);

  const potion = c.inventory.find((i) => i.kind === 'consumable' && i.effect && i.qty > 0);
  const usePotion = () => {
    if (!potion) return noRoll('Use an object', '✓', 'Use an object', 'Open a door, drink a potion or pull a lever. Add potions to your pack to roll them here.')();
    const r = roll(potion.effect!, potion.name, opts);
    if (!r) return;
    set((x) => ({ ...x, inventory: x.inventory.map((it) => (it.id === potion.id ? { ...it, qty: it.qty - 1 } : it)) }));
    show({ kicker: 'Rolled', total: r.total, title: potion.name, calc: `${calcText(r.result)} = ${r.total} · ${potion.qty - 1} left in your pack` }, facesOf(r.result), 'action');
  };
  const stealth = d.skill('stealth');
  const std: { name: string; hint: string; icon: string; go: () => void; other?: boolean }[] = [
    { name: 'Dash', hint: `Move ${d.speed * 2} ft this turn`, icon: 'M4 12h11M11 6l6 6-6 6M4 7h4M4 17h4', go: noRoll('Dash', `${d.speed * 2} ft`, 'Dash', `Your movement this turn doubles to ${d.speed * 2} feet.`) },
    { name: 'Disengage', hint: 'No opportunity attacks', icon: 'M9 5 3 12l6 7M3 12h12M18 5v14', go: noRoll('Disengage', '—', 'Disengage', 'Your movement doesn’t provoke opportunity attacks this turn.') },
    { name: 'Dodge', hint: 'Attacks on you at disadvantage', icon: 'M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', go: noRoll('Dodge', '—', 'Dodge', 'Attacks against you have disadvantage; Dex saves have advantage until your next turn.') },
    { name: 'Help', hint: 'An ally gains advantage', icon: 'M12 7v10M7 12h10M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z', go: noRoll('Help', '—', 'Help', 'An ally gets advantage on their next check or attack.') },
    { name: 'Hide', hint: `Stealth check, ${signed(stealth)}`, icon: 'M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6zM4 4l16 16', go: () => check('Stealth check (hide)', stealth, 'action') },
    { name: 'Ready', hint: 'Act later, on a trigger', icon: 'M12 7v5l3 2M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z', go: noRoll('Ready', '—', 'Ready', 'Choose a trigger and the action you’ll take as a reaction.') },
    { name: 'Use an object', hint: potion ? `${potion.name}, ${prettyExpr(potion.effect!)}` : 'Potion, door, lever', icon: 'M9 3h6M10 3v5l-5 9a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-5-9V3M7 14h10', go: usePotion },
    { name: 'Something else', hint: 'If the DM allows it', icon: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7v.5M12 17v.5', go: noRoll('Ask the DM', '?', 'Something else', 'Describe what you want to do. The DM decides how it works and what you roll.'), other: true },
  ];

  const rollInit = () => {
    const r = roll(d20With(d.initiative), 'Initiative', opts);
    if (!r) return;
    set((x) => ({ ...x, combat: { ...x.combat, initiative: r.total } }));
    const [p, f] = popupFromRoll(r, 'Initiative', { kicker: 'You act at' });
    overlay.show(p, f);
  };
  const tabName = TABS.find((t) => t[0] === tab)![1];
  const hint = eco[tab] ? `${tabName} used this turn.` : tab === 'action' ? 'One action per turn.' : tab === 'bonus' ? 'Only with a bonus action feature or spell.' : 'One per round, on anyone’s turn.';

  return (
    <div className="screen">
      <header className="hdr">
        <h1>Combat</h1>
        <span className="gr-tag">Round {c.combat.round}</span>
        <button className="gr-btn gr-btn--secondary gr-btn--small" style={{ height: 40 }} onClick={() => { set((x) => ({ ...x, combat: newCombat() })); acc.setActive(-1); setTab('action'); }}>Reset</button>
      </header>

      <main ref={mainRef} onScroll={acc.onScroll} className="scroll gr-desk" style={{ padding: 16, gap: 16 }}>
        <section className="gr-window gr-init" style={{ '--tincture': 'var(--tincture-3)', width: '100%' } as CSSProperties}>
          <div className="gr-window__head"><i className="gr-window__mark" /><div className="gr-window__title"><span>Initiative</span></div></div>
          <ol className="gr-init__list">
            <li className={`gr-init__row is-current${c.hp.current === 0 ? ' is-down' : ''}`}>
              <span className="gr-init__ptr"><Icon name="next" label="Acting now" /></span>
              <span className="gr-token" style={{ '--tincture': 'var(--tincture-4)' } as CSSProperties}>{c.name.charAt(0).toUpperCase()}</span>
              <span className="gr-init__who">
                <span className="gr-init__name">{c.name}</span>
                <span className="gr-init__sub">You · {d.cls?.name}</span>
              </span>
              <span className="gr-init__hp">{c.hp.current}/{c.hp.max}</span>
              <span className="gr-init__n">{c.combat.initiative ?? '—'}</span>
            </li>
          </ol>
          <div style={{ padding: '0 12px 12px' }}>
            <button className="gr-btn gr-btn--secondary gr-btn--small" style={{ width: '100%', height: 40 }} onClick={rollInit}>
              <Icon name="d20" />{c.combat.initiative == null ? `Roll initiative (${signed(d.initiative)})` : 'Roll again'}
            </button>
          </div>
        </section>

        <div className="col" style={{ gap: 12 }}>
          <div className="row" style={{ alignItems: 'baseline' }}>
            <h2 className="gr-label" style={{ margin: 0, flex: 1 }}>Your turn</h2>
            <span className="muted">Movement {d.speed} ft</span>
          </div>

          <div className="etabs" role="tablist" aria-label="Action economy">
            {TABS.map(([k, name]) => (
              <button key={k} className={`etab${tab === k ? ' is-on' : ''}${eco[k] ? ' used' : ''}`} role="tab" aria-selected={tab === k}
                onClick={() => { setTab(k); acc.setActive(-1); }}>
                <span className="etab__name">{name}</span>
                <span className="etab__state"><i />{eco[k] ? 'Used' : 'Ready'}</span>
              </button>
            ))}
          </div>

          <div role="tabpanel" aria-label={tabName} className="col" style={{ gap: 12 }}>
            <div className="row">
              <span className="muted" style={{ flex: 1 }}>{hint}</span>
              <button className="gr-btn gr-btn--secondary gr-btn--small" style={{ height: 36 }} onClick={() => set((x) => ({ ...x, combat: setUsed(x.combat, tab, !x.combat.eco[tab]) }))}>
                {eco[tab] ? 'Mark ready' : 'Mark used'}
              </button>
            </div>

            {tab === 'action' && (
              <div className="col" style={{ gap: 8 }}>
                <h3 className="gr-label" style={{ margin: 0 }}>Standard actions</h3>
                <div className="stdgrid" role="group" aria-label="Standard actions">
                  {std.map((o) => (
                    <button key={o.name} className={o.other ? 'stdtile other' : 'stdtile'} onClick={o.go}>
                      <span className="stdtile__ico"><Icon d={o.icon} /></span>
                      <span className="stdtile__name">{o.name}</span>
                      <span className="stdtile__hint">{o.hint}</span>
                    </button>
                  ))}
                </div>
                <h3 className="gr-label" style={{ margin: '6px 0 0' }}>Attacks and spells</h3>
              </div>
            )}

            {items.length ? <CardList items={items} acc={acc} /> : (
              <div className="gr-notice gr-empty" style={{ background: 'var(--paper)' }}>
                <Icon name="clock" />
                <b>Nothing for this {tabName.toLowerCase()}</b>
                <span>{tab === 'action' ? 'Equip a weapon in the pack or prepare spells in the spellbook.' : `None of your prepared spells take a ${tabName.toLowerCase()}.`}</span>
              </div>
            )}
            {items.length > 0 && <span className="muted" style={{ textAlign: 'center' }}>Tap a bar to open it. Scroll to move to the next.</span>}
            {items.length > 1 && <div aria-hidden="true" style={{ height: 240, flex: 'none' }} />}
          </div>
        </div>
      </main>

      <div className="foot">
        <button className="gr-btn gr-btn--primary" style={{ width: '100%', height: 48 }} onClick={() => { set((x) => ({ ...x, combat: endTurn(x.combat) })); acc.setActive(-1); }}>
          End turn<Icon name="next" />
        </button>
      </div>
      <TabBar />
      {overlay.overlay}
    </div>
  );
}
