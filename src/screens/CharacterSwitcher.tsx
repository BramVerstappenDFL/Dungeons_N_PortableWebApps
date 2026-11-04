import { useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Character } from '../types';
import { originName } from '../data';
import { classLabel } from '../rules/classes';
import { importCharacterFile } from '../ui/importFile';
import { useStore } from '../store/characters';
import { BottomSheet } from '../ui/BottomSheet';
import { Icon } from '../ui/Icon';
import { useTheme } from '../ui/theme';

const TINTS = ['var(--tincture-4)', 'var(--tincture-1)', 'var(--tincture-5)', 'var(--tincture-2)', 'var(--tincture-6)', 'var(--tincture-3)'];

/** Character list, new character, import/export, delete and theme, opened from the sheet header. */
export function CharacterSwitcher({ onClose }: { onClose: () => void }) {
  const { characters, activeId, select, remove, setTheme, theme: chosen } = useStore();
  const theme = useTheme();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ text: string; details?: string[] } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const active = characters.find((c) => c.id === activeId) ?? characters[0];

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(characters, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dnd-characters.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const onImport = async (f: File | undefined) => {
    if (!f) return;
    const r = await importCharacterFile(f);
    setMsg({ text: r.text, details: r.details });
  };

  return (
    <BottomSheet title="Characters" onClose={onClose}>
      <div className="panel" role="list">
        {characters.map((c: Character, i) => (
          <button key={c.id} role="listitem" className={`charrow${c.id === active?.id ? ' is-on' : ''}`} aria-current={c.id === active?.id}
            onClick={() => { select(c.id); onClose(); nav('/'); }}>
            <span className="gr-token" style={{ '--tincture': TINTS[i % TINTS.length], width: 40, height: 40, fontSize: 18 } as CSSProperties}>{c.name.charAt(0).toUpperCase()}</span>
            <span className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{c.name}</span>
              <span className="muted">Level {c.level} · {originName(c.speciesId, c.lineageId)} {classLabel(c).toLowerCase()}</span>
            </span>
            {c.id === active?.id && <Icon name="check" />}
          </button>
        ))}
      </div>
      <button className="gr-btn gr-btn--primary" style={{ height: 48 }} onClick={() => { onClose(); nav('/new'); }}>
        <Icon name="plus" />New character
      </button>

      <div className="col" style={{ gap: 8 }}>
        <span className="gr-label">Theme</span>
        <div className="seg" role="group" aria-label="Theme">
          {([[null, 'System'], ['parchment', 'Parchment'], ['dungeon', 'Dungeon']] as const).map(([t, label]) => (
            <button key={label} className={chosen === t ? 'segbtn is-on' : 'segbtn'} aria-pressed={chosen === t} onClick={() => setTheme(t)}>{label}</button>
          ))}
        </div>
        <span className="muted">Showing {theme === 'dungeon' ? 'Dungeon' : 'Parchment'}.</span>
      </div>

      <div className="grid2">
        <button className="gr-btn gr-btn--secondary" style={{ height: 44 }} onClick={exportAll}><Icon name="download" />Export</button>
        <button className="gr-btn gr-btn--secondary" style={{ height: 44 }} onClick={() => fileRef.current?.click()}><Icon name="upload" />Import</button>
        {/* No accept filter: phones often grey out unknown extensions such as .cah. */}
        <input ref={fileRef} type="file" hidden onChange={(e) => { onImport(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <span className="muted">Import reads D&amp;D Assist exports and .cah character files from other apps.</span>
      {msg && (
        <div className="gr-notice gr-hint" role="status">
          <Icon name="info" />
          <span>
            {msg.text}
            {msg.details?.map((m) => <span key={m} style={{ display: 'block', marginTop: 4 }}>• {m}</span>)}
          </span>
        </div>
      )}

      {active && (confirmDelete ? (
        <div className="gr-notice gr-error">
          <Icon name="alert" />
          <span style={{ flex: 1 }}><b>Delete {active.name}?</b>This can't be undone. Export first to keep a copy.</span>
          <div className="col" style={{ gap: 6 }}>
            <button className="gr-btn gr-btn--danger gr-btn--small" onClick={() => { remove(active.id); setConfirmDelete(false); onClose(); }}>Delete</button>
            <button className="gr-btn gr-btn--secondary gr-btn--small" onClick={() => setConfirmDelete(false)}>Keep</button>
          </div>
        </div>
      ) : (
        <button className="gr-btn gr-btn--ghost" style={{ height: 44 }} onClick={() => setConfirmDelete(true)}><Icon name="trash" />Delete {active.name}</button>
      ))}
      <button className="gr-btn gr-btn--ghost" style={{ height: 44 }} onClick={() => { onClose(); nav('/about'); }}>About and SRD license</button>
    </BottomSheet>
  );
}
