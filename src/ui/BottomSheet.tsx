import { useEffect, useId, type ReactNode } from 'react';
import { Icon } from './Icon';

/** Modal sheet that slides up from the bottom of the phone column. */
export function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const id = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop">
      <button className="sheet-dismiss" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="row" style={{ gap: 12 }}>
          <h2 id={id}>{title}</h2>
          <button className="gr-btn gr-btn--secondary gr-btn--icon ico-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
