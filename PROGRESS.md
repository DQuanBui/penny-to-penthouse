# PENNY TO PENTHOUSE — Progress

RESUME HERE: Phase 2 — GLB character hook (characters/GLBCharacters.js), data/archetypes.js + traits.js, ui/CharacterCreator.js with studio preview + Random; wire a temporary "New Life" flow from boot.

## Phase checklist
- [x] 1. Setup: Vite + Three.js, loop, third-person controller + orbit camera, one procedural district, day/night
- [ ] 2. Characters: factory (GLB hook + procedural), animations, 10 archetypes, creator UI, Random
- [ ] 3. Core sim: clock, needs, mood, money, HUD, phone + Bank app, saves, title, pause/settings
- [ ] 4. Home and work: room interior, sleep/eat/shower, Jobs app + interview, 3 careers + mini-games, café, clothing → MILESTONE demo
- [ ] 5. Social: NPCs, schedules, friendships, Contacts/Messages, Social app, popularity, parties
- [ ] 6. Education and skills; remaining careers; side hustles; businesses
- [ ] 7. Finance depth: credit, card, loans, Invest app + market sim, Homes app, property, mortgages, renting out
- [ ] 8. Build mode + furniture catalog + style score
- [ ] 9. City select + all 5 cities, weather, transit/fast travel, map
- [ ] 10. Rankings + AI rivals, goals, achievements, life events, tutorial
- [ ] 11. Vehicles: dealer, driving, parking, traffic
- [ ] 12. Polish: audio, post-processing, UI animation, balance pass, performance, bugs
- [ ] 13. README, ASSETS.md, GitHub Pages workflow

## Decisions
- **Stack**: Vite 8 + three r187, vanilla ES modules. `playwright-core` (dev only) drives installed Edge for `npm run smoke` (headless console-error check + screenshots in scripts/shots/).
- **Sim is headless**: everything in `src/sim/` and `src/data/` is pure JS (no three/DOM) operating on one serializable `state` object + an event bus, so `npm run sim` can run it in Node and saves are just JSON.
- **City layout**: 8×8 blocks (58 m blocks incl. 5 m sidewalks, 14 m roads), 4 districts = 4 quadrants (NW, NE, SW, SE order in city data). All buildings are ONE InstancedMesh; windows/storefronts/night lights are generated in the fragment shader (`world/Buildings.js`).
- **Collision**: AABBs in a spatial hash vs player circle (`world/Collision.js`); ground height is analytic (kerb = 0.15 m).
- **Characters**: procedural humanoid = one merged, vertex-coloured SkinnedMesh (1 draw call) driven by a procedural animator; GLB rigs use AnimationMixer when files exist.
- **Calendar**: 1 year = 4 seasons × 28 days. Pay every 14 days (annual/26, looks like a real paycheck), monthly bills every 28 days with real-looking amounts. Asset growth rates (market, property) are applied per game-year, i.e. time-compressed ≈3× in the player's favour. All numbers live in `src/data/balance.js`.
- **Phone / menus pause the clock** so players can think about money decisions.

## Testing
- `npm run dev` then (second terminal) `node scripts/smoke.mjs <scenario>` — headless Edge, fails on console errors, screenshots in scripts/shots/. Scenarios live in scripts/scenarios.mjs. Headless uses software GL, so its FPS number is meaningless.
- Dev keys: `[` / `]` shift the clock by an hour.

## Known issues
- GitHub repo `DQuanBui/penny-to-penthouse` did not exist / `gh` not logged in at start → commits are local until the repo exists (see end of file for push steps).

## Push to GitHub (when ready)
1. Create an empty public repo named `penny-to-penthouse` on github.com (no README).
2. `git remote add origin https://github.com/DQuanBui/penny-to-penthouse.git` then `git push -u origin main`.
3. Repo Settings → Pages → Source = "GitHub Actions".
