# PENNY TO PENTHOUSE — Progress

RESUME HERE: Phase 9 — data/cities/{losangeles,chicago,miami,austin}.js + data/npcs for each (registerNpcs), ui/CitySelect.js comparison screen in the New Life flow, world/Weather.js (rain, Chicago winter snow, Miami heat haze), world/Transit.js (station fast travel with fare, taxi from the Map app), Map phone app.

## Phase checklist
- [x] 1. Setup: Vite + Three.js, loop, third-person controller + orbit camera, one procedural district, day/night
- [x] 2. Characters: factory (GLB hook + procedural), animations, 10 archetypes, creator UI, Random
- [x] 3. Core sim: clock, needs, mood, money, HUD, phone + Bank app, saves, title, pause/settings
- [x] 4. Home and work: room interior, sleep/eat/shower, Jobs app + interview, 3 careers + mini-games, café, clothing → MILESTONE demo
- [x] 5. Social: NPCs, schedules, friendships, Contacts/Messages, Social app, popularity, parties
- [x] 6. Education and skills; remaining careers; side hustles; businesses
- [x] 7. Finance depth: credit, card, loans, Invest app + market sim, Homes app, property, mortgages, renting out
- [x] 8. Build mode + furniture catalog + style score
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

- **GLB hook**: a Vite plugin (vite.config.js) scans public/models/* and public/audio and serves/emits `asset-manifest.json`, so the game never requests a missing file (no 404 console noise). Character files named `player*.glb` are offered in the creator; others dress NPCs. Shared clips go in public/models/characters/animations/.
- **Traits**: archetype grants 1 signature trait for free; the player picks 2 more. Trait effects are multipliers in data/traits.js read via sim/Player.js mod().

- **Game structure**: core/Game.js has modes title/creator/play. Blocking UI = overlays (game.openOverlay/closeOverlay); any open overlay pauses the sim clock and player input. Sim systems are attached in sim/index.js installSystems() (shared with npm run sim). Phone apps register in ui/Phone/apps.js.
- **Bills**: rent+utilities on the 1st of each 28-day month, phone/insurance on the 15th, paychecks every other Friday (day%14==4). First month of rent is treated as prepaid.
- **UI gotcha**: DOM .append(null) prints "null" — app/dialog bodies are wrapped with dom.js tolerant() so apps may pass null/arrays.

- **Interiors**: separate scene (world/Interiors.js) built from a layout {w,d,floor,wall,walls,items,doorX}. Perimeter walls/ceiling/door are inward-facing planes, so the orbit camera may sit outside the room (dollhouse view) and never needs wall collision. Homes keep their layout in state.home.layout; shops use commercialLayout(place) templates. Furniture = data/furniture.js + procedural meshes in build/FurnitureCatalog.js (GLB override by id).
- **Interaction**: Game.findInteractable() -> {label, action}; furniture  ids are handled in ui/Interact.js, counters in ui/Shops.js SERVICES (later phases add entries), everyday actions in sim/Activities.js (shared with headless sim).
- **Jobs**: sim/Jobs.js. Pay accrues per shift and is paid every other Friday; tips are instant cash. Performance 100 = promotion if next-level requirements are met, otherwise a 4% raise. Outside hires are capped at level 4. Mini-games live in src/minigames (shell + one file per game), score 0..1 or skip.

- **NPCs**: data/npcs/<city>.js rows -> npcsOf() adds a deterministic look; npcWhere(npc,hour,day) returns home/work/in/out from schedule tables. characters/NPC.js shows "out" NPCs on benches / by shop doors when the player is within 75 m, and fills interiors with whoever is there plus counter staff. characters/Crowd.js = anonymous pedestrians random-walking sidewalk corners (typed arrays, rig pool for near, one InstancedMesh for far).
- **Social**: sim/Relationships.js (sim.rel) levels 0/20/50/80; max 3 conversations per NPC per day with diminishing returns; friends (50+) give referrals (flags.referrals), 15% shop discounts (flags.discounts), tips, party invites via state.messages. sim/Popularity.js (sim.social): posts, sponsored posts from 5k followers, house parties, VIP at popularity 35.

- **Education**: data/courses.js (college PROGRAMS = degrees/certs with one class a day at the college counter, ONLINE lessons and BOOKS via the Learn app). Career reqs: degree lists accept certs too; either:true means degree OR cert.
- **Loans**: sim/Loans.js amortised monthly (APR/12); student loans are always approved, others need min score + DTI <= 43%. Archetype starting debt becomes a real loan/card balance in installSystems().
- **Hustles / Business**: sim/Hustles.js (once a day each, 12% withheld). sim/Business.js: daily profit = base x 1.75^(level-1) x owner skill fit x reputation x staffing x city demand x luck, minus wages and fixed costs; bankrupt when the business account falls below -30% of startup cost. Owner draws are taxed.

- **Market**: sim/Market.js. Index random walk with regimes (bull/normal/bear/recession/boom announced in News), stocks = beta x market + sector trend + own noise + news shocks; dividends every 28 days; 15% tax on realised gains. Buying/selling assets uses finance.assetTx() so it stays out of the budget and earned/spent stats.
- **Real estate**: sim/RealEstate.js. Rentals of every type in every district (deposit + first month + movers); 5 listings per district refreshed monthly; mortgage via sim.loans (PMI under 20% down); monthly property tax + upkeep; appreciation tied to market regime (market.homeIndex); rent out (vacancy/repairs) or move in; player-bought furniture (item.own) goes to inventory.furniture when moving.

- **Build mode**: build/BuildMode.js (B inside your home, own overlay + top-down camera; Game.updatePlay hands the frame to it while active). Furniture snaps to 0.5 m (build/Grid.js canPlace), inner walls are 1 m unit segments (build/Walls.js; a doorway = a missing segment). Two-storey homes: layout.upper {walls, items}, a lift pad switches floors (stairs-free). Renters may furnish only. Undo/redo = JSON snapshots of layout + storage + cash. Style score = Grid.styleScore(layout), stored on state.home.styleScore (and the property).
- **Smoke tests**: software GL is slow, so scenarios switch to the Low preset and key() waits for game.fading to clear.

## Testing
- `npm run dev` then (second terminal) `node scripts/smoke.mjs <scenario>` — headless Edge, fails on console errors, screenshots in scripts/shots/. Scenarios live in scripts/scenarios.mjs. Headless uses software GL, so its FPS number is meaningless.
- Scenarios: build (build mode, renovation, two floors), finance (Invest, Homes, mortgage, loans, News), learn (Learn app, class, gigs, ventures, 4 mini-games), social (crowd, NPC talk, Contacts, Pulse, indoor NPCs), work (home, sleep, jobs, interview, shift, mini-games, café), core (HUD/phone/bank/map/pause/save-load), creator, default (walk + day/night shots).
- Dev key: `]` advances the clock one hour.

## Known issues
- GitHub repo `DQuanBui/penny-to-penthouse` did not exist / `gh` not logged in at start → commits are local until the repo exists (see end of file for push steps).

## Push to GitHub (when ready)
1. Create an empty public repo named `penny-to-penthouse` on github.com (no README).
2. `git remote add origin https://github.com/DQuanBui/penny-to-penthouse.git` then `git push -u origin main`.
3. Repo Settings → Pages → Source = "GitHub Actions".
