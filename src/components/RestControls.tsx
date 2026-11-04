import { useState } from 'react';
import type { Character } from '../types';
import type { Derived } from '../rules/derived';
import { useStore } from '../store/characters';
import { finishShortRest, longRest, spendHitDie } from '../rules/rest';
import { signed } from '../rules/dice';
import { Modal } from './Modal';

export function RestControls({ c, d }: { c: Character; d: Derived }) {
  const [open, setOpen] = useState<'short' | 'long' | null>(null);
  return (
    <>
      <div className="rest-buttons">
        <button className="btn" onClick={() => setOpen('short')}>☕ Short Rest</button>
        <button className="btn" onClick={() => setOpen('long')}>🌙 Long Rest</button>
      </div>
      {open === 'short' && <ShortRest c={c} d={d} onClose={() => setOpen(null)} />}
      {open === 'long' && <LongRest c={c} onClose={() => setOpen(null)} />}
    </>
  );
}

function ShortRest({ c, d, onClose }: { c: Character; d: Derived; onClose: () => void }) {
  const update = useStore((s) => s.update);
  const [log, setLog] = useState<string[]>([]);
  const spend = (die: number) => {
    const r = spendHitDie(c, die);
    if (!r) return;
    update(c.id, () => r.character);
    setLog((l) => [...l, `d${die}: rolled ${r.roll} ${signed(d.mods.con)} CON → healed ${r.healed}`]);
  };
  const finish = () => {
    update(c.id, finishShortRest);
    onClose();
  };
  return (
    <Modal
      title="Short Rest"
      onClose={onClose}
      footer={<button className="btn btn-primary" onClick={finish}>Finish short rest</button>}
    >
      <p>Spend Hit Dice to recover HP. Each die heals its roll + your Constitution modifier.</p>
      <div className="big-row">
        <div><span className="label">HP</span><strong>{c.hp.current} / {c.hp.max}</strong></div>
        <div><span className="label">Hit Dice left</span><strong>{d.hitDice.map((p) => `${p.total - p.used} × d${p.die}`).join(', ')}</strong></div>
      </div>
      <div className="stack-buttons">
      {d.hitDice.map((p) => (
        <button key={p.die} className="btn btn-primary block" onClick={() => spend(p.die)} disabled={p.used >= p.total || c.hp.current >= c.hp.max}>
          Spend a Hit Die (d{p.die})
        </button>
      ))}
      </div>
      {c.hp.current >= c.hp.max && <p className="muted small">You are at full HP.</p>}
      {log.length > 0 && <ul className="plain-list">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      {d.pact && <p className="muted small">Finishing the rest restores your Pact Magic spell slots.</p>}
    </Modal>
  );
}

function LongRest({ c, onClose }: { c: Character; onClose: () => void }) {
  const update = useStore((s) => s.update);
  return (
    <Modal
      title="Long Rest"
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => { update(c.id, longRest); onClose(); }}>Take long rest</button>
      </>}
    >
      <p>After 8 hours of rest you:</p>
      <ul className="plain-list">
        <li>Regain all lost Hit Points ({c.hp.current} → {c.hp.max}); temporary HP end</li>
        <li>Regain all spent Hit Dice ({Object.values(c.hitDiceUsed).reduce((a, b) => a + b, 0)} spent)</li>
        <li>Regain all expended spell slots</li>
        {c.exhaustion > 0 && <li>Reduce Exhaustion by 1 ({c.exhaustion} → {c.exhaustion - 1})</li>}
        {c.concentration && <li>Stop concentrating on your current spell</li>}
      </ul>
    </Modal>
  );
}
