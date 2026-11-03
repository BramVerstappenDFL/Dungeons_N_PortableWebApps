import type { CSSProperties } from 'react';
import type { Character } from '../types';
import { useStore } from '../store/characters';
import { spendFeature, usesLeft, type FeatureDef } from '../rules/origin';
import { excerpt } from '../ui/format';

const TINCTURE: Record<FeatureDef['source'], string> = {
  Species: 'var(--tincture-5)', Lineage: 'var(--tincture-4)', Feat: 'var(--tincture-3)', Path: 'var(--tincture-1)',
};

/** Species traits, lineage, origin feats and path features, with tappable use pips for limited ones. */
export function FeaturesWindow({ c, features }: { c: Character; features: FeatureDef[] }) {
  const update = useStore((s) => s.update);
  if (!features.length) return null;
  return (
    <section className="gr-window" style={{ '--tincture': 'var(--tincture-5)', width: '100%' } as CSSProperties}>
      <div className="gr-window__head"><i className="gr-window__mark" /><div className="gr-window__title"><span>Features &amp; traits</span></div></div>
      <div className="feats">
        {features.map((f) => {
          const left = usesLeft(c, f);
          return (
            <div key={f.id} className="feat" style={{ '--tincture': TINCTURE[f.source] } as CSSProperties}>
              <details>
                <summary>
                  <span className="feat__name">{f.name}</span>
                  <span className="feat__src">{f.source}</span>
                </summary>
                <p className="feat__text">{f.text ? excerpt(f.text, 420) : 'Listed by name; see the Player’s Handbook for the rules.'}</p>
              </details>
              {f.uses && (
                <div className="feat__uses">
                  <span className="pips" role="group" aria-label={`${f.name} uses`}>
                    {Array.from({ length: f.uses.max }, (_, i) => {
                      const spent = i >= left;
                      return (
                        <button key={i} className={spent ? 'pip spent' : 'pip'} aria-pressed={spent}
                          aria-label={spent ? `Restore a use of ${f.name}` : `Spend a use of ${f.name}`}
                          onClick={() => update(c.id, (x) => spendFeature(x, f, spent ? -1 : 1))} />
                      );
                    })}
                  </span>
                  <span className="muted">{left} of {f.uses.max} · {f.uses.recharge === 'short' ? 'short or long rest' : 'long rest'}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
