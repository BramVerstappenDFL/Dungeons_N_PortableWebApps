export function About() {
  return (
    <div className="page prose">
      <h1>About D&amp;D Assist</h1>
      <p>A companion app for Dungeons &amp; Dragons 5th edition (2024 rules). Track characters, roll dice, take rests, manage inventory and cast spells. All data stays on this device; install the app to use it offline.</p>
      <h2>Rules used</h2>
      <ul>
        <li><strong>Short rest:</strong> spend Hit Dice (die + CON modifier each). Warlocks regain Pact Magic slots.</li>
        <li><strong>Long rest:</strong> regain all HP, all spent Hit Dice and all spell slots; Exhaustion −1.</li>
        <li><strong>Damage:</strong> temporary HP absorb damage first. At 0 HP, track death saving throws.</li>
        <li><strong>Exhaustion:</strong> −2 to d20 tests and −5 ft speed per level (applied automatically).</li>
      </ul>
      <h2>Legal</h2>
      <p className="small">
        This work includes material from the System Reference Document 5.2.1 (&ldquo;SRD 5.2.1&rdquo;) by Wizards of the Coast LLC, available at{' '}
        <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noreferrer">https://www.dndbeyond.com/srd</a>. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noreferrer">https://creativecommons.org/licenses/by/4.0/legalcode</a>.
      </p>
      <p className="small muted">Spell data was converted from the open <code>@opencharacter/5e-srd-5.2</code> package (CC-BY-4.0). D&amp;D Assist is unofficial fan content and is not affiliated with or endorsed by Wizards of the Coast.</p>
    </div>
  );
}
