# D&D Assist

An installable Progressive Web App for Dungeons & Dragons 5th edition (2024 rules). It works on phones and desktops, runs fully offline once installed, and keeps all data on your device.

## Features
A phone-first app (on wider screens it shows as a centered phone column), built on the **Grimoire** design system with Parchment and Dungeon themes.
- **Sheet**: HP, AC, initiative, speed, proficiency, abilities and save proficiencies, spell slots (tap to spend or restore), Hit Dice and short rest, inspiration and concentration. An accordion of equipped weapons and ready spells with generated banners. Add experience and watch it fly into the XP bar; levelling up grows HP by the class average.
- **New character**: six animated steps: name, species (10, with lineages and size) and traits; background (16, with origin feat and tool); class (12) with skills and a level-3 path (48 subclasses); standard array or point buy with the 2024 background increases; starting equipment kits and languages; and a review that seals the character. Starting AC comes from the kit's armour. All motion is off under reduced motion.
- **Origins in play**: species, lineage and origin-feat effects carry through the app. Darkvision, size and passive Perception show on the sheet. Resisted damage is halved on the damage screen. Dwarven Toughness and Tough add HP per level. Alert adds to initiative. Wood Elves move 35 ft. Lineage and Magic Initiate spells are always prepared and cast with their own ability, with one free cast per long rest. Limited features (Breath Weapon, Adrenaline Rush, Lucky…) have use pips on the sheet and cards in combat, and come back on the right rest. Humans gain Heroic Inspiration after a long rest. AC follows equipped armour unless you set it by hand.
- **Damage and healing**: keypad for damage, healing and temp HP (temp HP absorbs first), concentration DC and 0 HP warnings, death saves on the sheet.
- **Long rest**: shows what comes back, plays the night and dawn animation, then restores HP, slots and Hit Dice, lowers Exhaustion, and offers Undo.
- **Combat**: initiative (your character for now), round counter, Action / Bonus action / Reaction tracking, standard actions, and attack and spell cards that roll to-hit and damage (crits double the dice) and spend spell slots.
- **Dice**: tap any skill, save or ability check to roll it, build a dice pool with a modifier and advantage or disadvantage, and see recent rolls.
- **Pack**: coins, carrying weight against Strength × 15, search and filters, equip toggle, SRD weapons, and consumables that roll on use (potions).
- **Notes**: tagged notes (Session, NPC, Quest, Loot) with search and pins.
- **Spellbook**: the SRD 5.2.1 spell list for your class; learn spells and choose which are prepared.
- **Characters**: several characters with a switcher (tap the name on the sheet), JSON import and export, and a theme choice.

## Development
```bash
npm install
npm run dev        # dev server
npm test           # unit tests (rules, dice, rests, HP, slots)
npm run build      # production build -> dist/
npm run preview    # serve the build
npm run build:srd  # regenerate src/data/*.json from the SRD package
npm run icons      # regenerate PNG icons from public/icons/favicon.svg (needs Playwright)
```
The app is served from `/Dungeons_N_PortableWebApps/` by default (GitHub Pages). To use another path, set `BASE_PATH=/` at build time.

## Deployment
`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`. Turn it on once under **Settings → Pages → Source: GitHub Actions**. Pages serves over HTTPS, which browsers require before they will install a PWA.

## Project layout
- `src/rules/`: pure, tested game logic (dice, abilities, slots, HP, rests, spell rolls, XP, weapons, combat, character creation)
- `src/store/`: Zustand store, saved to localStorage (with migrations between versions)
- `src/screens/`: one React screen per route, each with its own CSS
- `src/ui/`: shared UI (tab bar, bottom sheet, accordion, dice roll overlay, banner generator)
- `src/styles/grimoire/`: the Grimoire design system tokens and components
- `src/data/`: generated SRD data, plus `phb.ts` (PHB 2024 names and mechanics only, hand-maintained)
- `scripts/`: data and icon generators

## Legal
This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. The spell, class, subclass, species, lineage, background, feat, language, starting-equipment and weapon data were converted from the [`@opencharacter/5e-srd-5.2`](https://www.npmjs.com/package/@opencharacter/5e-srd-5.2) package (CC-BY-4.0, see `LICENSE-SRD`).

Backgrounds, species, subclasses and origin feats marked **PHB** (Player's Handbook, 2024) are listed by name and game mechanics only, for reference (`src/data/phb.ts`). No rules or flavour text from the Player's Handbook is included.

D&D Assist is unofficial fan content. It is not affiliated with or endorsed by Wizards of the Coast.
