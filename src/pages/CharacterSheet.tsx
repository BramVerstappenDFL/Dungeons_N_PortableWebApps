import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCharacter, useStore } from '../store/characters';
import { derive } from '../rules/derived';
import { HpPanel } from '../components/HpPanel';
import { AbilityPanel, SkillList } from '../components/AbilityPanel';
import { CombatStats, ConditionsPanel } from '../components/CombatStats';
import { RestControls } from '../components/RestControls';
import { SpellsTab } from '../components/SpellsTab';
import { InventoryTab } from '../components/InventoryTab';
import { DiceTray } from '../components/DiceTray';
import { RollLog } from '../components/RollLog';
import { backgroundById } from '../data';
import { classLabel } from '../rules/classes';

type Tab = 'overview' | 'spells' | 'inventory' | 'dice';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '🛡' },
  { id: 'spells', label: 'Spells', icon: '✨' },
  { id: 'inventory', label: 'Inventory', icon: '🎒' },
  { id: 'dice', label: 'Dice', icon: '🎲' },
];

function useWide() {
  const q = '(min-width: 960px)';
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const fn = () => setWide(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, []);
  return wide;
}

export function CharacterSheet() {
  const { id } = useParams();
  const c = useCharacter(id);
  const wide = useWide();
  const [tab, setTab] = useState<Tab>('overview');
  const update = useStore((s) => s.update);
  if (!c) return <div className="page"><p>Character not found.</p><Link to="/" className="btn">Back</Link></div>;
  const d = derive(c);
  // On wide screens the overview is always visible, so the tab area shows the other panels.
  const activeTab: Tab = wide && tab === 'overview' ? 'spells' : tab;
  const bgName = c.backgroundId === 'custom' ? 'Custom background' : backgroundById(c.backgroundId)?.name;

  const overview = (
    <div className="stack">
      <HpPanel c={c} />
      <RestControls c={c} d={d} />
      <CombatStats c={c} d={d} />
      <AbilityPanel c={c} d={d} />
      <SkillList c={c} d={d} />
      <ConditionsPanel c={c} />
      <section className="card">
        <h3 className="card-title">Notes</h3>
        <textarea className="notes" rows={4} value={c.notes} placeholder="Features, feats, backstory, quest notes…" onChange={(e) => update(c.id, (x) => ({ ...x, notes: e.target.value }))} />
      </section>
    </div>
  );
  const tabContent = {
    overview,
    spells: <SpellsTab c={c} d={d} />,
    inventory: <InventoryTab c={c} />,
    dice: (
      <div className="stack">
        <section className="card"><h3 className="card-title">Dice</h3><DiceTray characterId={c.id} /></section>
        <section className="card"><h3 className="card-title">Roll history</h3><RollLog entries={c.rollLog} onClear={() => update(c.id, (x) => ({ ...x, rollLog: [] }))} /></section>
      </div>
    ),
  }[activeTab];

  const tabs = (
    <nav className="tabs" role="tablist" aria-label="Character sections">
      {TABS.filter((t) => !wide || t.id !== 'overview').map((t) => (
        <button key={t.id} role="tab" aria-selected={activeTab === t.id} className={activeTab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
          <span aria-hidden>{t.icon}</span> {t.label}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="page sheet">
      <header className="sheet-head">
        <div className="avatar lg" aria-hidden>{c.name.charAt(0).toUpperCase()}</div>
        <div className="grow">
          <h1>{c.name}</h1>
          <p className="muted small">Level {d.level} {d.species?.name} {classLabel(c)}{bgName ? ` · ${bgName}` : ''}</p>
        </div>
        <Link to={`/c/${c.id}/edit`} className="btn btn-ghost small">Edit</Link>
      </header>

      {wide ? (
        <div className="sheet-grid">
          <div className="pane-overview">{overview}</div>
          <div className="pane-tab">{tabs}{tabContent}</div>
        </div>
      ) : (
        <>{tabContent}{tabs}</>
      )}
    </div>
  );
}
