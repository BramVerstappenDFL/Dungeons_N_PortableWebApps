# D&D Assist

An installable Progressive Web App for Dungeons & Dragons 5th edition (2024 rules). It works on phones and desktops, runs fully offline once installed, and keeps all data on your device.

## Features
- **Characters**: create and edit characters (class, level, species, background, Standard Array / Point Buy / manual ability scores, 2024 background ability increases, skills, HP, AC). Duplicate, delete, and import or export characters as JSON.
- **Rolls**: tap any ability, save, skill or initiative to roll it. A dice tray handles d4–d100 with advantage/disadvantage and expressions like `2d6+1d4+3` or `4d6kh3`. Each character keeps a roll history.
- **HP**: damage, healing and temporary HP (temp HP absorbs damage first), death saves, massive damage, and a concentration-save reminder.
- **Rests**: short rest (spend Hit Dice; Warlock Pact slots come back) and long rest (all HP, Hit Dice and slots restored; Exhaustion −1).
- **Spells**: the full SRD 5.2.1 spell list (339 spells) with search and filters. Casting uses slots (including upcasting and rituals), rolls attack, damage and healing (cantrips scale with level), shows the save DC, and tracks concentration.
- **Inventory**: items with quantity, weight, notes and an equipped flag, plus coins and carrying capacity.
- **Conditions and Exhaustion** (the 2024 −2 per level to d20 tests is applied automatically).

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
- `src/rules/`: pure, tested game logic (dice, abilities, slots, HP, rests, spell rolls)
- `src/store/`: Zustand store, saved to localStorage
- `src/components/`, `src/pages/`: React UI
- `src/data/`: generated SRD data
- `scripts/`: data and icon generators

## Legal
This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. The spell data was converted from the [`@opencharacter/5e-srd-5.2`](https://www.npmjs.com/package/@opencharacter/5e-srd-5.2) package (CC-BY-4.0, see `LICENSE-SRD`).

D&D Assist is unofficial fan content. It is not affiliated with or endorsed by Wizards of the Coast.
