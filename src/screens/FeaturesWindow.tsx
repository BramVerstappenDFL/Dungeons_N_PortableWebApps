import type { CSSProperties } from 'react';
import type { Character } from '../types';
import { useStore } from '../store/characters';
import { spendFeature, usesLeft, type FeatureDef } from '../rules/origin';
import { excerpt } from '../ui/format';
import { Icon } from '../ui/Icon';

const recharge = (r: string) => (r === 'short' ? 'short or long rest' : r === 'short-one' ? 'one back per short rest' : 'long rest');

const TINCTURE: Record<FeatureDef['source'], string> = {
  Class: 'var(--tincture-2)', Species: 'var(--tincture-5)', Lineage: 'var(--tincture-4)', Feat: 'var(--tincture-3)', Path: 'var(--tincture-1)',
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
              {f.uses && f.pool && (
                <div className="feat__uses">
                  <div className="gr-stepper" style={{ height: 36 }}>
                    <button onClick={() => update(c.id, (x) => spendFeature(x, f, 1))} disabled={left === 0} aria-label={`Spend 1 from ${f.name}`}><Icon name="minus" /></button>
                    <output key={left} className="tick">{left}</output>
                    <button onClick={() => update(c.id, (x) => spendFeature(x, f, -1))} disabled={left === f.uses.max} aria-label={`Restore 1 to ${f.name}`}><Icon name="plus" /></button>
                  </div>
                  <span className="muted">of {f.uses.max} · {recharge(f.uses.recharge)}</span>
                </div>
              )}
              {f.uses && !f.pool && (
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
                  <span className="muted">{left} of {f.uses.max} · {recharge(f.uses.recharge)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
