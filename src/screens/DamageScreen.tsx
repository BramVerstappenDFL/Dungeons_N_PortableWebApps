import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { Character } from '../types';
import { useStore } from '../store/characters';
import { applyDamage, applyHealing, setTempHp } from '../rules/hp';
import { applyResistance, originOf } from '../rules/origin';
import { Icon, type IconName } from '../ui/Icon';
import { CELLS, HpCells, cellSpan, type Cell } from '../ui/HpCells';
import './damage.css';

type Mode = 'damage' | 'heal' | 'temp';
interface Fx { kind: 'dmg' | 'heal' | 'temp'; prevOn: number; prevEnd: number; text: string }
interface Notice { kind: string; title: string; text: string }

const TYPES = ['Slashing', 'Piercing', 'Bludgeoning', 'Fire', 'Cold', 'Lightning', 'Necrotic', 'Poison', 'Force', 'Psychic', 'Radiant', 'Acid', 'Thunder'];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'B'];
const FX_ICON: Record<Fx['kind'], IconName> = { dmg: 'flame', heal: 'heart', temp: 'shield' };

export function DamageScreen({ c }: { c: Character }) {
  const update = useStore((s) => s.update);
  const [mode, setMode] = useState<Mode>('damage');
  const [amount, setAmount] = useState('');
  const [dtype, setDtype] = useState('Slashing');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [fx, setFx] = useState<Fx | null>(null);
  const t1 = useRef<number>(), t2 = useRef<number>();
  useEffect(() => () => { clearTimeout(t1.current); clearTimeout(t2.current); }, []);

  // Clearing first and re-adding a tick later restarts the animation on back-to-back changes.
  const fire = (next: Fx) => {
    clearTimeout(t1.current); clearTimeout(t2.current);
    setFx(null);
    t1.current = window.setTimeout(() => setFx(next), 30);
    t2.current = window.setTimeout(() => setFx(null), 1500);
  };

  const max = c.hp.max;
  const amt = parseInt(amount || '0', 10);
  const resistances = originOf(c).resistances;
  const resisted = mode === 'damage' && resistances.includes(dtype.toLowerCase());
  const { on, end } = cellSpan(c.hp.current, c.hp.temp, max);
  const cells: Cell[] = Array.from({ length: CELLS }, (_, i) => {
    let cls = i < on ? 'on' : i < end ? 'tmp' : '';
    let d = 0;
    if (fx?.kind === 'dmg' && i >= end && i < fx.prevEnd) { cls = 'lost'; d = fx.prevEnd - 1 - i; }
    if (fx?.kind === 'heal' && i >= fx.prevOn && i < on) { cls += ' gain'; d = i - fx.prevOn; }
    if (fx?.kind === 'temp' && i >= fx.prevEnd && i < end) { cls += ' ward'; d = i - fx.prevEnd; }
    return { cls, d };
  });

  const press = (k: string) => {
    if (k === 'C') return setAmount('');
    if (k === 'B') return setAmount((a) => a.slice(0, -1));
    setAmount((a) => (a.length >= 3 ? a : (a + k).replace(/^0+/, '')));
  };

  const apply = () => {
    if (!amt) return;
    const prev = { prevOn: on, prevEnd: end };
    if (mode === 'damage') {
      const taken = applyResistance(amt, dtype, resistances);
      const next = applyDamage(c, taken);
      update(c.id, (x) => applyDamage(x, taken));
      const dc = Math.max(10, Math.floor(taken / 2));
      if (next.deathSaves.failures >= 3 && c.hp.current > 0) {
        setNotice({ kind: 'gr-notice gr-error', title: 'Massive damage', text: 'The damage left over after dropping to 0 equals your hit point maximum. Your character dies.' });
      } else if (next.hp.current === 0) {
        setNotice({ kind: 'gr-notice gr-error', title: c.hp.current === 0 ? 'Failed death save' : 'You drop to 0 hit points', text: c.hp.current === 0 ? `Damage while down counts as a failed death save (${next.deathSaves.failures} of 3).` : 'Make death saving throws at the start of your turns. They are on the sheet.' });
      } else {
        setNotice({ kind: 'gr-notice gr-warn', title: taken < amt ? `Resisted: took ${taken} of ${amt} ${dtype.toLowerCase()} damage` : `Took ${amt} ${dtype.toLowerCase()} damage`, text: c.concentration ? `You are concentrating: make a Constitution save, DC ${dc}.` : `Concentrating? Make a Constitution save, DC ${dc}.` });
      }
      setAmount('');
      fire({ kind: 'dmg', ...prev, text: `−${taken}` });
    } else if (mode === 'heal') {
      const hp = Math.min(max, c.hp.current + amt);
      update(c.id, (x) => applyHealing(x, amt));
      setNotice({ kind: 'gr-notice gr-ok', title: `Healed ${hp - c.hp.current} hit points`, text: `Now at ${hp} of ${max}.` });
      setAmount('');
      fire({ kind: 'heal', ...prev, text: `+${hp - c.hp.current}` });
    } else {
      const t = Math.max(c.hp.temp, amt);
      update(c.id, (x) => setTempHp(x, amt));
      setNotice({ kind: 'gr-notice gr-hint', title: `Temporary hit points: ${t}`, text: 'They don’t stack; the higher value is kept.' });
      setAmount('');
      fire({ kind: 'temp', ...prev, text: `+${t - c.hp.temp} temp` });
    }
  };

  let label = 'Enter an amount';
  if (amt) label = mode === 'damage' ? (resisted ? `Take ${Math.floor(amt / 2)} damage (resisted)` : `Take ${amt} damage`) : mode === 'heal' ? `Heal ${amt} hit points` : `Gain ${amt} temp HP`;
  const seg = (m: Mode) => (mode === m ? 'segbtn is-on' : 'segbtn');

  return (
    <div className="screen">
      <header className="hdr">
        <Link to="/" className="gr-btn gr-btn--secondary gr-btn--icon ico-btn" aria-label="Back to sheet"><Icon name="back" /></Link>
        <h1 className="sub">Damage and healing</h1>
      </header>

      <main className="scroll" style={{ padding: 16, gap: 14 }}>
        <section className={`gr-window${fx?.kind === 'dmg' ? ' win-dmg' : ''}`} style={{ '--tincture': 'var(--tincture-5)', width: '100%' } as CSSProperties}>
          <div className="gr-window__head"><i className="gr-window__mark" /><div className="gr-window__title"><span>{c.name}</span></div></div>
          <div className="gr-window__body" style={{ gap: 10 }}>
            <div className="row" style={{ alignItems: 'baseline' }}>
              <span className={`num ${fx?.kind === 'dmg' ? 'num-dmg' : fx?.kind === 'heal' ? 'num-heal' : ''}`} style={{ display: 'inline-block', fontSize: 40 }}>{c.hp.current}</span>
              <span className="num" style={{ fontSize: 18, color: 'var(--text-muted)' }}>/ {max}</span>
              <span className="gr-chip" style={{ marginLeft: 'auto', alignSelf: 'center' }}>Temp {c.hp.temp}</span>
            </div>
            <HpCells current={c.hp.current} max={max} temp={c.hp.temp} cells={cells} extraClass={fx ? `fx-${fx.kind}` : ''}>
              {fx && <span className={`hp-float float-${fx.kind}`} aria-hidden="true"><Icon name={FX_ICON[fx.kind]} />{fx.text}</span>}
            </HpCells>
          </div>
        </section>

        <div role="group" aria-label="Change type" className="seg">
          <button className={seg('damage')} onClick={() => setMode('damage')} aria-pressed={mode === 'damage'}>Damage</button>
          <button className={seg('heal')} onClick={() => setMode('heal')} aria-pressed={mode === 'heal'}>Heal</button>
          <button className={seg('temp')} onClick={() => setMode('temp')} aria-pressed={mode === 'temp'}>Temp HP</button>
        </div>

        <div className="row" style={{ gap: 12, padding: '10px 14px', background: 'var(--paper)', border: '2px solid var(--ink)' }} aria-live="polite">
          <span className="gr-label" style={{ flex: 1 }}>Amount</span>
          <output className="num" style={{ fontSize: 44, minWidth: 64, textAlign: 'right' }}>{amount || '0'}</output>
        </div>

        {mode === 'damage' && (
          <div className="chips" role="group" aria-label="Damage type" style={{ flexWrap: 'nowrap', overflowX: 'auto', margin: '0 -16px', padding: '0 16px 2px' }}>
            {TYPES.map((n) => (
              <button key={n} className={`gr-chip dtype${dtype === n ? ' is-on' : ''}`} onClick={() => setDtype(n)} aria-pressed={dtype === n}>
                {n}{resistances.includes(n.toLowerCase()) && <Icon name="shield" label="resisted" />}
              </button>
            ))}
          </div>
        )}
        {resisted && (
          <div key={dtype} className="gr-notice gr-hint" style={{ animation: 'pop-in .3s cubic-bezier(.2,.8,.2,1) both' }}>
            <Icon name="shield" />
            <span><b>You resist {dtype.toLowerCase()}</b>Damage of this type is halved{amt ? `: ${amt} becomes ${Math.floor(amt / 2)}` : ''}.</span>
          </div>
        )}

        <div className="grid3">
          {KEYS.map((k) => (
            <button key={k} className={k === 'C' || k === 'B' ? 'key key--fn' : 'key'} onClick={() => press(k)}
              aria-label={k === 'C' ? 'Clear' : k === 'B' ? 'Delete digit' : k}>
              {k === 'C' ? 'Clear' : k === 'B' ? '←' : k}
            </button>
          ))}
        </div>

        {notice && (
          <div className={notice.kind} role="status">
            <Icon name="alert" />
            <span><b>{notice.title}</b>{notice.text}</span>
          </div>
        )}
      </main>

      <footer className="foot foot--lg" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
        <button className={mode === 'damage' ? 'gr-btn gr-btn--danger' : 'gr-btn gr-btn--primary'} style={{ width: '100%', height: 52, fontSize: 17 }} onClick={apply} disabled={!amt}>
          {label}
        </button>
      </footer>
    </div>
  );
}
