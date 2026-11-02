import { useState } from 'react';
import { useMatch } from 'react-router-dom';
import { Modal } from './Modal';
import { DiceTray } from './DiceTray';

/** Floating d20 button that opens the dice tray from anywhere. */
export function QuickRoll() {
  const [open, setOpen] = useState(false);
  const match = useMatch('/c/:id/*');
  const characterId = match?.params.id;
  return (
    <>
      <button className="fab" onClick={() => setOpen(true)} aria-label="Open dice roller">
        <svg viewBox="0 0 100 100" aria-hidden><polygon points="50,4 92,28 92,72 50,96 8,72 8,28" /><polygon points="50,26 74,66 26,66" className="inner" /></svg>
      </button>
      {open && (
        <Modal title="Roll dice" onClose={() => setOpen(false)}>
          <DiceTray characterId={characterId} />
        </Modal>
      )}
    </>
  );
}
