import { Link } from 'react-router-dom';
import { useStore } from '../store/characters';
import { Icon } from '../ui/Icon';

export function AboutScreen() {
  const has = useStore((s) => s.characters.length > 0);
  return (
    <div className="screen">
      <header className="hdr">
        <Link to={has ? '/' : '/new'} className="gr-btn gr-btn--secondary gr-btn--icon ico-btn" aria-label="Back"><Icon name="back" /></Link>
        <h1 className="sub">About D&amp;D Assist</h1>
      </header>
      <main className="scroll" style={{ padding: 16, gap: 14, fontSize: 16, lineHeight: 1.5 }}>
        <p style={{ margin: 0 }}>A companion for Dungeons &amp; Dragons 5th edition (2024 rules): character sheet, dice, combat turns, rests, inventory, spells and notes. Everything stays on this device; install the app to use it offline.</p>
        <section className="gr-window" style={{ width: '100%' }}>
          <div className="gr-window__head"><i className="gr-window__mark" /><div className="gr-window__title"><span>Rules used</span></div></div>
          <div className="gr-window__body" style={{ fontSize: 14.5 }}>
            <span><b>Short rest:</b> spend Hit Dice (die + CON modifier each). Warlocks regain Pact Magic slots.</span>
            <span><b>Long rest:</b> regain all HP, all spent Hit Dice and all spell slots; Exhaustion drops by 1.</span>
            <span><b>Damage:</b> temporary HP absorb damage first. At 0 HP, roll death saving throws.</span>
            <span><b>Exhaustion:</b> −2 to d20 tests and −5 ft speed per level.</span>
            <span><b>Levelling:</b> HP grows by the fixed average of your Hit Die + CON modifier per level.</span>
          </div>
        </section>
        <h2 className="gr-label" style={{ margin: 0 }}>Legal</h2>
        <p style={{ margin: 0, fontSize: 14.5 }}>
          This work includes material from the System Reference Document 5.2.1 (&ldquo;SRD 5.2.1&rdquo;) by Wizards of the Coast LLC, available at{' '}
          <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noreferrer">https://www.dndbeyond.com/srd</a>. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noreferrer">https://creativecommons.org/licenses/by/4.0/legalcode</a>.
        </p>
        <p className="muted" style={{ margin: 0 }}>Spell, class, species, background and weapon data were converted from the open <code>@opencharacter/5e-srd-5.2</code> package (CC-BY-4.0). D&amp;D Assist is unofficial fan content and is not affiliated with or endorsed by Wizards of the Coast.</p>
      </main>
    </div>
  );
}
