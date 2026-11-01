import { useCallback, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Icon } from './Icon';
import { bannerTint, bannerUri } from './spellBanner';
import { useTheme } from './theme';

/** A minimized card is 56px tall plus an 8px gap. */
const STEP = 64;

/**
 * Scroll-driven accordion from the design: while a card is open, scrolling the screen opens the
 * card under a line partway down the view, so the open card stays near the middle.
 */
export function useAccordion(scrollRef: RefObject<HTMLElement>, count: number, cardHeight = 420) {
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const lead = useCallback(() => {
    const h = scrollRef.current?.clientHeight ?? 690;
    return Math.max(96, Math.round((h - cardHeight) / 2) + STEP / 2);
  }, [scrollRef, cardHeight]);
  const listTop = useCallback(() => {
    const m = scrollRef.current!, l = listRef.current!;
    return l.getBoundingClientRect().top - m.getBoundingClientRect().top + m.scrollTop;
  }, [scrollRef]);
  const onScroll = useCallback(() => {
    const m = scrollRef.current, l = listRef.current;
    if (active < 0 || !m || !l || !count) return;
    let i = Math.floor((m.scrollTop - listTop() + lead()) / STEP);
    i = Math.max(0, Math.min(count - 1, i));
    if (i !== active) setActive(i);
  }, [active, count, lead, listTop, scrollRef]);
  const open = useCallback((i: number) => {
    setActive(i);
    requestAnimationFrame(() => {
      const m = scrollRef.current, l = listRef.current;
      if (!m || !l) return;
      m.scrollTop = Math.max(0, listTop() + i * STEP - lead() + STEP / 2);
    });
  }, [lead, listTop, scrollRef]);
  return { active, setActive, open, onScroll, listRef };
}

export interface CardItem {
  key: string;
  name: string;
  /** Spell level (0–9) for the banner's brightness. */
  level: number;
  /** Text in the minimized bar. */
  short: string;
  kind: string;
  tint?: string;
  facts: [string, string][];
  text?: string;
  foot?: ReactNode;
}

export function CardList({ items, acc }: { items: CardItem[]; acc: ReturnType<typeof useAccordion> }) {
  const theme = useTheme();
  return (
    <div ref={acc.listRef} className="col" style={{ gap: 8 }}>
      {items.map((c, i) => {
        const banner = bannerUri(c.name, c.level, theme);
        const barTint = bannerTint(c.name);
        const tint = c.tint ?? barTint;
        if (i !== acc.active) {
          return (
            <button key={c.key} className="mini" style={{ '--tincture': barTint } as CSSProperties} onClick={() => acc.open(i)} aria-expanded="false">
              <img className="mini__bg" src={banner} alt="" />
              <i className="gr-window__mark" />
              <span className="mini__name">{c.name}</span>
              <span className="mini__meta">{c.short}<Icon name="chevDown" /></span>
            </button>
          );
        }
        return (
          <article key={c.key} className="gr-card is-open" style={{ '--tincture': tint, width: '100%' } as CSSProperties}>
            <button className="gr-card__banner bannerbtn" onClick={() => acc.setActive(-1)} aria-label={`Minimize ${c.name}`} aria-expanded="true">
              <img src={banner} alt="" />
            </button>
            <div className="gr-card__top" style={{ alignItems: 'center' }}>
              <h3 className="gr-card__name">{c.name}</h3>
              <span className="gr-chip gr-chip--school" style={{ '--tincture': tint } as CSSProperties}>{c.kind}</span>
              <button className="gr-btn gr-btn--secondary gr-btn--icon" style={{ position: 'relative', zIndex: 1, width: 40, height: 40, flex: 'none' }} onClick={() => acc.setActive(-1)} aria-label={`Minimize ${c.name}`}>
                <Icon name="chevUp" />
              </button>
            </div>
            <div className="gr-rule"><i /></div>
            <dl className="gr-card__facts">
              {c.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            {c.text && <p className="gr-card__text">{c.text}</p>}
            {c.foot}
          </article>
        );
      })}
    </div>
  );
}
