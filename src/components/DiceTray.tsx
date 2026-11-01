import { useState } from 'react';
import { useStore } from '../store/characters';
import type { RollMode } from '../rules/dice';
import { Stepper } from './Stepper';

const DICE = [4, 6, 8, 10, 12, 20, 100];

export function DiceTray({ characterId }: { characterId?: string }) {
  const roll = useStore((s) => s.roll);
  const [count, setCount] = useState(1);
  const [mod, setMod] = useState(0);
  const [mode, setMode] = useState<RollMode>('normal');
  const [expr, setExpr] = useState('');
  const [error, setError] = useState('');

  const rollDie = (sides: number) => {
    const e = `${count}d${sides}${mod ? (mod > 0 ? `+${mod}` : mod) : ''}`;
    roll(e, `${e}`, { characterId, mode: sides === 20 && count === 1 ? mode : 'normal' });
  };
  const rollExpr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expr.trim()) return;
    const r = roll(expr, expr.trim(), { characterId, mode });
    setError(r ? '' : 'Could not read that. Try something like 2d6+3 or 4d6kh3.');
  };

  return (
    <div className="dice-tray">
      <div className="dice-grid">
        {DICE.map((d) => (
          <button key={d} className="die-btn" onClick={() => rollDie(d)} aria-label={`Roll ${count}d${d}`}>
            <span className="die-shape">d{d}</span>
          </button>
        ))}
      </div>
      <div className="tray-options">
        <label>Dice <Stepper value={count} onChange={setCount} min={1} max={50} label="Number of dice" /></label>
        <label>Modifier <Stepper value={mod} onChange={setMod} min={-30} max={30} label="Modifier" /></label>
      </div>
      <div className="segmented" role="radiogroup" aria-label="Roll mode">
        {(['disadvantage', 'normal', 'advantage'] as RollMode[]).map((m) => (
          <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
            {m === 'normal' ? 'Normal' : m === 'advantage' ? 'Advantage' : 'Disadvantage'}
          </button>
        ))}
      </div>
      <form className="row" onSubmit={rollExpr}>
        <input className="grow" placeholder="Expression, e.g. 2d6+1d4+3" value={expr} onChange={(e) => setExpr(e.target.value)} aria-label="Dice expression" />
        <button className="btn btn-primary" type="submit">Roll</button>
      </form>
      {error && <p className="error small">{error}</p>}
      <p className="muted small">Advantage/disadvantage applies to single d20 rolls.</p>
    </div>
  );
}
