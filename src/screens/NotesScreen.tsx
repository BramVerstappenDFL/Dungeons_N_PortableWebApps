import { useState, type CSSProperties } from 'react';
import type { Character, Note, NoteTag } from '../types';
import { uid, useStore } from '../store/characters';
import { Icon } from '../ui/Icon';
import { TabBar } from '../ui/TabBar';
import { timeAgo } from '../ui/format';

const TAGS: NoteTag[] = ['Session', 'NPC', 'Quest', 'Loot'];
const TINT: Record<string, string> = { Session: 'var(--tincture-1)', NPC: 'var(--tincture-2)', Quest: 'var(--tincture-3)', Loot: 'var(--tincture-4)', All: 'var(--accent)' };

const notesCss = `
.write { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; font: inherit; font-size: 16px; font-weight: 500; color: var(--ink); background: transparent; border: 2px dashed var(--ink); cursor: pointer; }
.write:hover { background: var(--accent-100); }
.pin { width: 44px; height: 44px; margin: -10px -10px 0 0; display: flex; align-items: center; justify-content: center; background: transparent; border: 0; color: var(--text-muted); cursor: pointer; position: relative; z-index: 1; }
.pin:hover, .pin.on { color: var(--ink); }
.pin.on svg { fill: var(--gilt); }
.notetitle { font: inherit; background: none; border: 0; padding: 0; color: inherit; text-align: left; cursor: pointer; }
`;

interface Draft { id?: string; title: string; body: string; tag: NoteTag }

export function NotesScreen({ c }: { c: Character }) {
  const update = useStore((s) => s.update);
  const [filter, setFilter] = useState<NoteTag | 'All'>('All');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const setNotes = (fn: (n: Note[]) => Note[]) => update(c.id, (x) => ({ ...x, notes: fn(x.notes) }));

  const q = query.trim().toLowerCase();
  const shown = c.notes
    .filter((n) => (filter === 'All' || n.tag === filter) && (!q || `${n.title} ${n.body}`.toLowerCase().includes(q)))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt);

  const save = () => {
    if (!draft || !draft.title.trim()) return;
    const fields = { title: draft.title.trim(), body: draft.body.trim(), tag: draft.tag };
    setNotes((l) => draft.id
      ? l.map((n) => (n.id === draft.id ? { ...n, ...fields } : n))
      : [{ id: uid(), ...fields, pinned: false, createdAt: Date.now() }, ...l]);
    setDraft(null);
  };

  return (
    <div className="screen">
      <style>{notesCss}</style>
      <header className="hdr" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <h1>Notes</h1>
        <div className="gr-search">
          <Icon name="search" />
          <input className="gr-input" style={{ height: 44 }} type="search" aria-label="Search notes" placeholder="Search names, places, clues" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </header>

      <main className="scroll" style={{ padding: 16, gap: 16 }}>
        <div className="chips" role="group" aria-label="Filter by tag">
          {(['All', ...TAGS] as const).map((f) => (
            <button key={f} className={`gr-chip${f === 'All' ? '' : ' gr-chip--school'} filter${filter === f ? ' is-on' : ''}`} style={{ '--tincture': TINT[f] } as CSSProperties}
              onClick={() => setFilter(f)} aria-pressed={filter === f}>{f}</button>
          ))}
        </div>

        {!draft ? (
          <button className="write" onClick={() => setDraft({ title: '', body: '', tag: filter === 'All' ? 'Session' : filter })}><Icon name="plus" />Write a note</button>
        ) : (
          <section className="gr-window is-focused" style={{ '--tincture': TINT[draft.tag], width: '100%' } as CSSProperties}>
            <div className="gr-window__head"><i className="gr-window__mark" /><div className="gr-window__title"><span>{draft.id ? 'Edit note' : 'New note'}</span></div></div>
            <div className="gr-window__body">
              <div className="gr-field" style={{ width: '100%' }}>
                <label htmlFor="noteTitle" className="gr-label">Title</label>
                <input id="noteTitle" className="gr-input" style={{ height: 44 }} placeholder="Who, where or what" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus />
              </div>
              <div className="gr-field" style={{ width: '100%' }}>
                <label htmlFor="noteBody" className="gr-label">Note</label>
                <textarea id="noteBody" className="gr-input gr-textarea" placeholder="What happened, what you learned" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
              </div>
              <div className="chips" role="group" aria-label="Tag">
                {TAGS.map((t) => (
                  <button key={t} className={`gr-chip gr-chip--school filter${draft.tag === t ? ' is-on' : ''}`} style={{ '--tincture': TINT[t] } as CSSProperties}
                    onClick={() => setDraft({ ...draft, tag: t })} aria-pressed={draft.tag === t}>{t}</button>
                ))}
              </div>
              <div className="grid2">
                {draft.id ? (
                  <button className="gr-btn gr-btn--danger" style={{ height: 44 }} onClick={() => { setNotes((l) => l.filter((n) => n.id !== draft.id)); setDraft(null); }}>Delete</button>
                ) : (
                  <button className="gr-btn gr-btn--secondary" style={{ height: 44 }} onClick={() => setDraft(null)}>Cancel</button>
                )}
                <button className="gr-btn gr-btn--primary" style={{ height: 44 }} onClick={save} disabled={!draft.title.trim()}>Save note</button>
              </div>
              {draft.id && <button className="gr-btn gr-btn--ghost gr-btn--small" onClick={() => setDraft(null)}>Cancel editing</button>}
            </div>
          </section>
        )}

        {shown.map((n) => (
          <article key={n.id} className="gr-card" style={{ width: '100%', gap: 8 }}>
            <div className="gr-card__top" style={{ alignItems: 'center' }}>
              <span className="gr-chip gr-chip--school" style={{ '--tincture': TINT[n.tag] } as CSSProperties}>{n.tag}</span>
              <span className="muted" style={{ flex: 1 }}>{timeAgo(n.createdAt)}</span>
              <button className={n.pinned ? 'pin on' : 'pin'} onClick={() => setNotes((l) => l.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x)))} aria-pressed={n.pinned} aria-label={`Pin ${n.title}`}>
                <Icon name="star" />
              </button>
            </div>
            <h2 className="gr-card__name" style={{ fontSize: 20 }}>
              <button className="notetitle" onClick={() => setDraft({ id: n.id, title: n.title, body: n.body, tag: n.tag })} aria-label={`Edit ${n.title}`}>{n.title}</button>
            </h2>
            {n.body && <p className="gr-card__text" style={{ fontSize: 16, whiteSpace: 'pre-wrap' }}>{n.body}</p>}
          </article>
        ))}

        {shown.length === 0 && !draft && (
          <div className="gr-notice gr-empty">
            <Icon name="notes" />
            <b>The page is blank</b>
            <span>{c.notes.length ? 'No notes match. Try another tag or search.' : 'Write down names, places, quests and loot as you play.'}</span>
          </div>
        )}
      </main>
      <TabBar />
    </div>
  );
}
