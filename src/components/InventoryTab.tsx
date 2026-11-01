import { useState } from 'react';
import type { Character, Currency, Item } from '../types';
import { uid, useStore } from '../store/characters';
import { Modal } from './Modal';

const COINS: (keyof Currency)[] = ['pp', 'gp', 'ep', 'sp', 'cp'];

export function InventoryTab({ c }: { c: Character }) {
  const update = useStore((s) => s.update);
  const [editing, setEditing] = useState<Item | null>(null);
  const totalWeight = c.inventory.reduce((sum, i) => sum + i.qty * i.weight, 0);
  const coinWeight = COINS.reduce((s, k) => s + c.currency[k], 0) / 50;
  const capacity = c.abilities.str * 15;
  const weight = Math.round((totalWeight + coinWeight) * 10) / 10;

  const setItems = (fn: (items: Item[]) => Item[]) => update(c.id, (x) => ({ ...x, inventory: fn(x.inventory) }));
  const save = (item: Item) => {
    setItems((items) => (items.some((i) => i.id === item.id) ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item]));
    setEditing(null);
  };

  return (
    <div className="stack">
      <section className="card" aria-label="Currency">
        <h3 className="card-title">Coins</h3>
        <div className="coins">
          {COINS.map((k) => (
            <label key={k} className={`coin coin-${k}`}>
              <span>{k.toUpperCase()}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={c.currency[k]}
                onChange={(e) => update(c.id, (x) => ({ ...x, currency: { ...x.currency, [k]: Math.max(0, Math.floor(Number(e.target.value) || 0)) } }))}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="card" aria-label="Inventory">
        <div className="row space-between">
          <h3 className="card-title">Inventory</h3>
          <button className="btn btn-primary" onClick={() => setEditing({ id: uid(), name: '', qty: 1, weight: 0, notes: '', equipped: false })}>+ Add item</button>
        </div>
        <div className="weight">
          <div className="weight-bar"><div style={{ width: `${Math.min(100, (weight / capacity) * 100)}%` }} className={weight > capacity ? 'over' : ''} /></div>
          <span className="small muted">{weight} / {capacity} lb carried</span>
        </div>
        {c.inventory.length === 0 && <p className="muted">Your pack is empty.</p>}
        <ul className="item-list">
          {c.inventory.map((i) => (
            <li key={i.id}>
              <button
                className={`equip ${i.equipped ? 'on' : ''}`}
                aria-pressed={i.equipped}
                title={i.equipped ? 'Equipped' : 'Not equipped'}
                aria-label={`${i.equipped ? 'Unequip' : 'Equip'} ${i.name}`}
                onClick={() => setItems((items) => items.map((x) => (x.id === i.id ? { ...x, equipped: !x.equipped } : x)))}
              >⚔</button>
              <button className="item-main" onClick={() => setEditing(i)}>
                <span className="item-name">{i.name}</span>
                <span className="muted small">{i.weight ? `${Math.round(i.weight * i.qty * 10) / 10} lb` : ''}{i.notes ? ` · ${i.notes}` : ''}</span>
              </button>
              <div className="qty">
                <button onClick={() => setItems((items) => items.map((x) => (x.id === i.id ? { ...x, qty: Math.max(0, x.qty - 1) } : x)))} aria-label={`Use one ${i.name}`}>−</button>
                <span>{i.qty}</span>
                <button onClick={() => setItems((items) => items.map((x) => (x.id === i.id ? { ...x, qty: x.qty + 1 } : x)))} aria-label={`Add one ${i.name}`}>+</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {editing && (
        <ItemEditor
          item={editing}
          isNew={!c.inventory.some((i) => i.id === editing.id)}
          onSave={save}
          onDelete={() => { setItems((items) => items.filter((x) => x.id !== editing.id)); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ItemEditor({ item, isNew, onSave, onDelete, onClose }: { item: Item; isNew: boolean; onSave: (i: Item) => void; onDelete: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState(item);
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (draft.name.trim()) onSave({ ...draft, name: draft.name.trim() }); };
  return (
    <Modal
      title={isNew ? 'Add item' : 'Edit item'}
      onClose={onClose}
      footer={<>
        {!isNew && <button className="btn btn-danger" onClick={onDelete}>Delete</button>}
        <span className="grow" />
        <button className="btn btn-primary" type="submit" form="item-form" disabled={!draft.name.trim()}>Save</button>
      </>}
    >
      <form id="item-form" className="form" onSubmit={submit}>
        <label>Name<input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Potion of Healing" /></label>
        <div className="form-row">
          <label>Quantity<input type="number" inputMode="numeric" min={0} value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} /></label>
          <label>Weight (lb each)<input type="number" inputMode="decimal" min={0} step="0.1" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: Math.max(0, Number(e.target.value) || 0) })} /></label>
        </div>
        <label>Notes<textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
        <label className="check"><input type="checkbox" checked={draft.equipped} onChange={(e) => setDraft({ ...draft, equipped: e.target.checked })} /> Equipped</label>
      </form>
    </Modal>
  );
}
