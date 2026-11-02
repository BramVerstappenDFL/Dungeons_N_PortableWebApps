import { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/characters';
import { classById, speciesById } from '../data';
import type { Character } from '../types';

function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function CharacterList() {
  const characters = useStore((s) => s.characters);
  const { remove, duplicate, importMany } = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const n = importMany(Array.isArray(data) ? data : [data]);
      alert(n ? `Imported ${n} character${n > 1 ? 's' : ''}.` : 'No characters found in that file.');
    } catch {
      alert('That file could not be read as a character backup.');
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Characters</h1>
        <Link to="/new" className="btn btn-primary">+ New character</Link>
      </div>
      {characters.length === 0 ? (
        <div className="empty card">
          <div className="empty-icon" aria-hidden>🐉</div>
          <h2>No adventurers yet</h2>
          <p className="muted">Create your first character to track HP, spells, inventory and rolls. Everything is stored on this device and works offline.</p>
          <Link to="/new" className="btn btn-primary">Create a character</Link>
        </div>
      ) : (
        <ul className="char-grid">
          {characters.map((c) => <CharacterCard key={c.id} c={c} onDelete={() => confirm(`Delete ${c.name}? This cannot be undone.`) && remove(c.id)} onCopy={() => { const id = duplicate(c.id); if (id) navigate(`/c/${id}/edit`); }} />)}
        </ul>
      )}
      <div className="row wrap mt">
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>Import backup</button>
        {characters.length > 0 && <button className="btn btn-ghost" onClick={() => download('dnd-assist-characters.json', characters)}>Export all</button>}
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
      </div>
    </div>
  );
}

function CharacterCard({ c, onDelete, onCopy }: { c: Character; onDelete: () => void; onCopy: () => void }) {
  const pct = c.hp.max ? (c.hp.current / c.hp.max) * 100 : 0;
  return (
    <li className="card char-card">
      <Link to={`/c/${c.id}`} className="char-link">
        <div className="avatar" aria-hidden>{c.name.charAt(0).toUpperCase()}</div>
        <div className="grow">
          <h2>{c.name}</h2>
          <p className="muted small">Level {c.level} {speciesById(c.speciesId)?.name ?? ''} {classById(c.classId)?.name ?? ''}</p>
          <div className="hp-bar thin"><div className="hp-fill" style={{ width: `${pct}%` }} /></div>
          <p className="small">{c.hp.current}/{c.hp.max} HP</p>
        </div>
      </Link>
      <div className="char-actions">
        <Link to={`/c/${c.id}/edit`} className="btn btn-ghost small">Edit</Link>
        <button className="btn btn-ghost small" onClick={onCopy}>Duplicate</button>
        <button className="btn btn-ghost small" onClick={() => download(`${c.name.replace(/\W+/g, '-')}.json`, c)}>Export</button>
        <button className="btn btn-ghost small danger" onClick={onDelete}>Delete</button>
      </div>
    </li>
  );
}
