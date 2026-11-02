import { useState } from 'react';
import type { Character, Currency, Item, ItemKind } from '../types';
import { WEAPONS, weaponById } from '../data';
import { uid, useStore } from '../store/characters';
import { Icon } from '../ui/Icon';
import { TabBar } from '../ui/TabBar';
import { BottomSheet } from '../ui/BottomSheet';
import { Stepper } from '../ui/Stepper';
import { useRollOverlay } from '../ui/RollOverlay';
import { calcText, prettyExpr } from '../ui/format';
import { facesOf } from '../ui/RollOverlay';
import './pack.css';

const COINS: (keyof Currency)[] = ['cp', 'sp', 'ep', 'gp', 'pp'];
const FILTERS = ['All', 'Equipped', 'Weapons', 'Gear', 'Consumables'] as const;
const KIND_OF: Record<string, ItemKind> = { Weapons: 'weapon', Gear: 'gear', Consumables: 'consumable' };
const KIND_LABEL: Record<ItemKind, string> = { weapon: 'Weapon', gear: 'Gear', consumable: 'Consumable' };
const PRESETS = [
  { name: 'Potion of Healing', effect: '2d4+2', weight: 0.5 },
  { name: 'Potion of Greater Healing', effect: '4d4+4', weight: 0.5 },
  { name: 'Rations (1 day)', effect: '', weight: 2 },
];

interface Draft { id?: string; name: string; kind: ItemKind; weaponId: string; qty: number; weight: string; effect: string; notes: string }
const blank = (): Draft => ({ name: '', kind: 'gear', weaponId: '', qty: 1, weight: '1', effect: '', notes: '' });

export function PackScreen({ c }: { c: Character }) {
  const update = useStore((s) => s.update);
  const roll = useStore((s) => s.roll);
  const overlay = useRollOverlay();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [coinSheet, setCoinSheet] = useState(false);
  const set = (fn: (x: Character) => Character) => update(c.id, fn);
  const setItems = (fn: (items: Item[]) => Item[]) => set((x) => ({ ...x, inventory: fn(x.inventory) }));

  const weight = Math.round(c.inventory.reduce((t, i) => t + i.weight * i.qty, 0) * 10) / 10;
  const capacity = c.abilities.str * 15;
  const q = query.trim().toLowerCase();
  const shown = c.inventory.filter((i) =>
    (filter === 'All' || (filter === 'Equipped' ? i.equipped : i.kind === KIND_OF[filter])) && (!q || i.name.toLowerCase().includes(q)));

  const use = (i: Item) => {
    setItems((list) => list.map((x) => (x.id === i.id ? { ...x, qty: Math.max(0, x.qty - 1) } : x)));
    if (!i.effect) return;
    const r = roll(i.effect, i.name, { characterId: c.id });
    if (r) overlay.show({ kicker: 'Rolled', total: r.total, title: i.name, calc: `${calcText(r.result)} = ${r.total} · ${i.qty - 1} left` }, facesOf(r.result));
  };
  const save = () => {
    if (!draft || !draft.name.trim()) return;
    const w = weaponById(draft.weaponId);
    const item: Item = {
      id: draft.id ?? uid(), name: draft.name.trim(), kind: draft.kind, qty: Math.max(0, draft.qty),
      weight: Math.max(0, parseFloat(draft.weight) || 0), notes: draft.notes.trim(),
      equipped: draft.id ? (c.inventory.find((x) => x.id === draft.id)?.equipped ?? false) : draft.kind === 'weapon',
      weaponId: draft.kind === 'weapon' ? w?.id : undefined,
      effect: draft.kind === 'consumable' && draft.effect.trim() ? draft.effect.replace(/\s+/g, '') : undefined,
    };
    setItems((list) => (draft.id ? list.map((x) => (x.id === draft.id ? item : x)) : [item, ...list]));
    setDraft(null);
  };
  const edit = (i: Item) => setDraft({ id: i.id, name: i.name, kind: i.kind, weaponId: i.weaponId ?? '', qty: i.qty, weight: String(i.weight), effect: i.effect ?? '', notes: i.notes });
  const meta = (i: Item) => {
    const w = weaponById(i.weaponId);
    return [KIND_LABEL[i.kind], `${i.weight} lb`, w ? `${w.damage} ${w.damageType}` : i.effect ? prettyExpr(i.effect) : i.notes].filter(Boolean).join(' · ');
  };
  const effectOk = !draft?.effect.trim() || /^(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/i.test(draft.effect.replace(/\s+/g, ''));

  return (
    <div className="screen">
      <header className="hdr">
        <h1>Inventory</h1>
        <button className="gr-btn gr-btn--primary gr-btn--small" style={{ height: 40 }} onClick={() => setDraft(blank())}><Icon name="plus" />Add item</button>
      </header>

      <main className="scroll" style={{ padding: 16, gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
          {COINS.map((k) => (
            <button key={k} className={`coin coin--${k}`} onClick={() => setCoinSheet(true)} aria-label={`${c.currency[k]} ${k.toUpperCase()}. Change coins`}>
              <span className="coin__mark"><i aria-hidden="true" /><span className="gr-label" style={{ fontSize: 11 }}>{k.toUpperCase()}</span></span>
              <span className="num" style={{ fontSize: 20 }}>{c.currency[k]}</span>
            </button>
          ))}
        </div>

        <div className="col" style={{ gap: 6 }}>
          <div className="row" style={{ alignItems: 'baseline' }}>
            <span className="gr-label" style={{ flex: 1 }}>Carrying</span>
            <span className="num" style={{ fontSize: 16 }}>{weight} / {capacity} lb</span>
          </div>
          <div style={{ height: 14, boxSizing: 'border-box', padding: 3, border: '2px solid var(--ink)', background: 'var(--paper)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ height: '100%', width: `${Math.min(100, Math.round((weight / capacity) * 100))}%`, background: weight > capacity ? 'var(--rubric)' : 'var(--accent)' }} />
          </div>
          {weight > capacity && <span className="muted" style={{ color: 'var(--rubric)' }}>Over your carrying capacity (Strength × 15).</span>}
        </div>

        <div className="gr-search">
          <Icon name="search" />
          <input className="gr-input" style={{ height: 44 }} type="search" aria-label="Search items" placeholder="Search the pack" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="chips" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f} className={`gr-chip filter${filter === f ? ' is-on' : ''}`} onClick={() => setFilter(f)} aria-pressed={filter === f}>{f}</button>
          ))}
        </div>

        {shown.length > 0 ? (
          <div className="panel">
            {shown.map((i) => (
              <div key={i.id} className="item">
                <button className={i.equipped ? 'eq on' : 'eq'} onClick={() => setItems((l) => l.map((x) => (x.id === i.id ? { ...x, equipped: !x.equipped } : x)))} aria-pressed={i.equipped} aria-label={`Equip ${i.name}`}>
                  <span>{i.equipped && <Icon name="check" style={{ width: 14, height: 14, strokeWidth: 3 }} />}</span>
                </button>
                <div className="col" style={{ gap: 2, minWidth: 0 }}>
                  <button className="itemname" onClick={() => edit(i)} aria-label={`Edit ${i.name}`}>{i.name}</button>
                  <span className="muted">{meta(i)}</span>
                </div>
                <div className="row">
                  <span className="num" style={{ fontSize: 16 }}>×{i.qty}</span>
                  {i.kind === 'consumable' && (
                    <button className="gr-btn gr-btn--secondary gr-btn--small" style={{ height: 36 }} onClick={() => use(i)} disabled={i.qty === 0}>Use</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="gr-notice gr-empty">
            <Icon name="pack" />
            <b>{c.inventory.length ? 'Nothing here' : 'Your pack is empty'}</b>
            <span>{c.inventory.length ? 'No items match this filter.' : 'Add weapons, gear and potions with Add item.'}</span>
          </div>
        )}
        <span className="muted">Tick an item to mark it as worn or held. Tap a name to edit it.</span>
      </main>

      <TabBar />
      {overlay.overlay}

      {draft && (
        <BottomSheet title={draft.id ? 'Edit item' : 'New item'} onClose={() => setDraft(null)}>
          <div className="seg" role="group" aria-label="Kind">
            {(['gear', 'weapon', 'consumable'] as ItemKind[]).map((k) => (
              <button key={k} className={draft.kind === k ? 'segbtn is-on' : 'segbtn'} aria-pressed={draft.kind === k} onClick={() => setDraft({ ...draft, kind: k })}>{KIND_LABEL[k]}</button>
            ))}
          </div>
          {draft.kind === 'weapon' && (
            <div className="gr-field" style={{ width: '100%' }}>
              <label htmlFor="weaponPick" className="gr-label">Weapon</label>
              <select id="weaponPick" className="gr-input gr-select" style={{ height: 44 }} value={draft.weaponId}
                onChange={(e) => { const w = weaponById(e.target.value); setDraft({ ...draft, weaponId: e.target.value, name: draft.name && draft.name !== weaponById(draft.weaponId)?.name ? draft.name : (w?.name ?? ''), weight: String(w?.weight ?? draft.weight) }); }}>
                <option value="">Choose a weapon</option>
                {(['simple', 'martial'] as const).map((cat) => (
                  <optgroup key={cat} label={cat === 'simple' ? 'Simple weapons' : 'Martial weapons'}>
                    {WEAPONS.filter((w) => w.category === cat).map((w) => <option key={w.id} value={w.id}>{w.name} ({w.damage} {w.damageType})</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          )}
          {draft.kind === 'consumable' && !draft.id && (
            <div className="chips" role="group" aria-label="Presets">
              {PRESETS.map((p) => (
                <button key={p.name} className="gr-chip filter" onClick={() => setDraft({ ...draft, name: p.name, effect: p.effect, weight: String(p.weight) })}>{p.name}</button>
              ))}
            </div>
          )}
          <div className="gr-field" style={{ width: '100%' }}>
            <label htmlFor="itemName" className="gr-label">Name</label>
            <input id="itemName" className="gr-input" style={{ height: 44 }} placeholder="Silk rope, 50 ft" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="grid2" style={{ alignItems: 'end' }}>
            <div className="gr-field">
              <span className="gr-label">Quantity</span>
              <Stepper label="Quantity" value={draft.qty} min={0} max={999} onChange={(v) => setDraft({ ...draft, qty: v })} />
            </div>
            <div className="gr-field">
              <label htmlFor="itemWeight" className="gr-label">Weight each (lb)</label>
              <input id="itemWeight" className="gr-input" style={{ height: 44 }} inputMode="decimal" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value.replace(/[^0-9.]/g, '') })} />
            </div>
          </div>
          {draft.kind === 'consumable' && (
            <div className="gr-field" style={{ width: '100%' }}>
              <label htmlFor="itemEffect" className="gr-label">Roll on use (optional)</label>
              <input id="itemEffect" className={`gr-input${effectOk ? '' : ' gr-input--invalid'}`} style={{ height: 44 }} placeholder="2d4+2" value={draft.effect} onChange={(e) => setDraft({ ...draft, effect: e.target.value })} />
              {!effectOk && <span className="gr-help gr-help--error">Use dice like 2d4+2.</span>}
            </div>
          )}
          <div className="gr-field" style={{ width: '100%' }}>
            <label htmlFor="itemNotes" className="gr-label">Notes</label>
            <input id="itemNotes" className="gr-input" style={{ height: 44 }} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </div>
          <div className="grid2">
            {draft.id ? (
              <button className="gr-btn gr-btn--danger" style={{ height: 48 }} onClick={() => { setItems((l) => l.filter((x) => x.id !== draft.id)); setDraft(null); }}>Remove</button>
            ) : (
              <button className="gr-btn gr-btn--secondary" style={{ height: 48 }} onClick={() => setDraft(null)}>Cancel</button>
            )}
            <button className="gr-btn gr-btn--primary" style={{ height: 48 }} onClick={save} disabled={!draft.name.trim() || !effectOk || (draft.kind === 'weapon' && !draft.weaponId)}>
              {draft.id ? 'Save' : 'Add to pack'}
            </button>
          </div>
        </BottomSheet>
      )}

      {coinSheet && (
        <BottomSheet title="Coins" onClose={() => setCoinSheet(false)}>
          <div className="panel" style={{ boxShadow: 'none' }}>
            {COINS.map((k) => (
              <div key={k} className={`row coin--${k}`} style={{ gap: 12, padding: '8px 12px', borderTop: k === 'cp' ? 0 : '2px solid var(--ink)' }}>
                <span className="coin__mark" style={{ flex: 1 }}><i aria-hidden="true" /><b>{k.toUpperCase()}</b></span>
                <input className="gr-input" style={{ width: 96, height: 44, textAlign: 'right', font: '600 18px/1 var(--font-heading)' }} inputMode="numeric" aria-label={`${k.toUpperCase()} amount`}
                  value={c.currency[k]} onChange={(e) => { const v = parseInt(e.target.value.replace(/\D/g, '') || '0', 10); set((x) => ({ ...x, currency: { ...x.currency, [k]: v } })); }} />
              </div>
            ))}
          </div>
          <span className="muted">1 gp = 10 sp = 100 cp. 1 ep = 5 sp. 1 pp = 10 gp.</span>
          <button className="gr-btn gr-btn--primary" style={{ height: 48 }} onClick={() => setCoinSheet(false)}>Done</button>
        </BottomSheet>
      )}
    </div>
  );
}
