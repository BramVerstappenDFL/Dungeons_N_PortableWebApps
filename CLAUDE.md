# D&D Assist: notes for Claude

## Workflow
- **Always open a pull request against `main`** after pushing work in a cloud session. Do not wait to be asked.
- `main` is the deploy branch. Every push to it publishes to GitHub Pages (`.github/workflows/deploy.yml`).

## Project
- Installable PWA (Vite + React 18 + TypeScript, `vite-plugin-pwa`) for D&D 5e, **2024 rules**.
- **Phone-first**; no desktop layout yet (wide screens show the phone column centered). Characters are stored in localStorage via Zustand (`src/store/characters.ts`). Bump the persist `version` and extend `migrateCharacter` when the `Character` shape changes.
- UI follows the user's Claude Design canvas "D&D companion PWA" on the **Grimoire** design system. Screens are in `src/screens/` (one per route), shared UI in `src/ui/`, design-system CSS in `src/styles/grimoire/` (copied from the design; keep it unedited), shared patterns in `src/styles/app.css`.
- Game logic lives in pure functions in `src/rules/` (dice, abilities, slots, HP, rests, spell rolls, XP, weapons, combat, creation), with Vitest tests in `tests/`. Keep new rules there, with tests.
- SRD 5.2.1 data (CC-BY-4.0) is generated into `src/data/*.json` by `npm run build:srd`. Do not edit the JSON by hand. Keep the attribution in About, the README and `LICENSE-SRD`.

## Commands
- `npm test`: unit tests
- `npx tsc -b`: type check
- `npm run build`: production build (`BASE_PATH` overrides the default `/Dungeons_N_PortableWebApps/`)
- `npm run preview`: serve the build. To check the UI end to end, use the pre-installed Playwright Chromium at phone size (390×844).
