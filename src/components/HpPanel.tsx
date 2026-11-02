import { useState } from 'react';
import type { Character } from '../types';
import { useStore } from '../store/characters';
import { applyDamage, applyDeathSave, applyHealing, setTempHp } from '../rules/hp';
import { rollDie } from '../rules/dice';

export function HpPanel({ c }: { c: Character }) {
  const update = useStore((s) => s.update);
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');
  const set = (fn: (c: Character) => Character) => update(c.id, fn);
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  const pct = c.hp.max ? Math.round((c.hp.current / c.hp.max) * 100) : 0;
  const tempPct = c.hp.max ? Math.min(100, Math.round((c.hp.temp / c.hp.max) * 100)) : 0;
  const dead = c.deathSaves.failures >= 3;
  const stable = c.deathSaves.successes >= 3;

  const act = (kind: 'damage' | 'heal' | 'temp') => {
    if (!n) return;
    if (kind === 'damage') {
      set((x) => applyDamage(x, n));
      setMsg(`Took ${n} damage${c.concentration ? ` — make a DC ${Math.min(30, Math.max(10, Math.floor(n / 2)))} Constitution save to keep concentrating` : ''}.`);
    }
    if (kind === 'heal') { set((x) => applyHealing(x, n)); setMsg(`Healed ${n}.`); }
    if (kind === 'temp') { set((x) => setTempHp(x, n)); setMsg(`Temporary HP set to ${Math.max(c.hp.temp, n)}.`); }
    setAmount('');
  };

  const rollDeathSave = () => {
    const nat = rollDie(20);
    set((x) => applyDeathSave(x, nat));
    useStore.getState().roll(`${nat}`, `Death save: natural ${nat}${nat === 20 ? ' — back on your feet with 1 HP!' : nat === 1 ? ' — two failures' : nat >= 10 ? ' — success' : ' — failure'}`, { characterId: c.id });
  };

  return (
    <section className="card hp-card" aria-label="Hit points">
      <div className="hp-top">
        <div>
          <div className="label">Hit Points</div>
          <div className="hp-value">
            <span className={pct <= 25 ? 'danger' : pct <= 50 ? 'warn' : ''}>{c.hp.current}</span>
            <span className="muted"> / {c.hp.max}</span>
            {c.hp.temp > 0 && <span className="temp-badge">+{c.hp.temp} temp</span>}
          </div>
        </div>
      </div>
      <div className="hp-bar" aria-hidden>
        <div className="hp-fill" style={{ width: `${pct}%` }} />
        {tempPct > 0 && <div className="hp-temp" style={{ width: `${tempPct}%` }} />}
      </div>
      <div className="hp-actions">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && act('damage')}
          aria-label="Amount"
        />
        <button className="btn btn-danger" onClick={() => act('damage')} disabled={!n}>Damage</button>
        <button className="btn btn-success" onClick={() => act('heal')} disabled={!n}>Heal</button>
        <button className="btn" onClick={() => act('temp')} disabled={!n}>Temp</button>
      </div>
      {msg && <p className="small muted">{msg}</p>}
      {c.hp.current === 0 && (
        <div className="death-saves">
          <div className="label">{dead ? 'Dead' : stable ? 'Stable' : 'Death Saves'}</div>
          <div className="ds-row">
            <span>Successes</span>
            <Pips n={c.deathSaves.successes} kind="ok" onSet={(v) => set((x) => ({ ...x, deathSaves: { ...x.deathSaves, successes: v } }))} />
          </div>
          <div className="ds-row">
            <span>Failures</span>
            <Pips n={c.deathSaves.failures} kind="bad" onSet={(v) => set((x) => ({ ...x, deathSaves: { ...x.deathSaves, failures: v } }))} />
          </div>
          {!dead && !stable && <button className="btn btn-primary" onClick={rollDeathSave}>Roll death save</button>}
        </div>
      )}
    </section>
  );
}

function Pips({ n, kind, onSet }: { n: number; kind: 'ok' | 'bad'; onSet: (v: number) => void }) {
  return (
    <span className="pips">
      {[1, 2, 3].map((i) => (
        <button key={i} className={`pip ${i <= n ? `on ${kind}` : ''}`} onClick={() => onSet(i <= n ? i - 1 : i)} aria-label={`${kind === 'ok' ? 'Success' : 'Failure'} ${i}`} />
      ))}
    </span>
  );
}
