# PENNY TO PENTHOUSE — Progress

RESUME HERE: Sixth round in progress (see checklist below). Done so far: city signature features, taxi drop-off, achievements, balance, camera collision. Next: the fix list (map labels, creator preview, save-failed toast), then bus riding, relocation, office interiors, touch controls, performance.

## Sixth round (this session)
- [x] City signature features (world/CityThemes.js): Miami neon, LA hillside letters, Chicago sailboats, Austin festoons + dusk bats (`themes` scenario, CITY=...)
- [x] Taxi drop-off (TaxiRide.taxiArrive / updateCabOff): the cab pulls up at the kerb by the door, you step out, it drives off; kerbSpot/kerbGap shared with ui/Hail.js (`hail` scenario)
- [x] Achievements: Top of the Trail (summit), Peak Bagger (summits in 3 cities, flags.summitCities), Clean Streets (50 litter, flags.litterTotal)
- [x] Camera collision: ColliderWorld.raycast (slab test, padded boxes) head→camera, fast in / slow out; world/OccluderFade.js dithers awnings, planters, shopfront trim and tree crowns inside a cone around the camera→player line (`camera` scenario)
- [x] Balance (npm run sim): ER collapses came from life events resolved at midnight + choices that eat hours (LifeEvents.decideNow, energy/hunger floor after long choices, stale events expire), shifts and activities that drove energy past 0 (Jobs.workShift sends you home early, doActivity refuses when exhausted), hunger during sleep (sleep wakes you); promotions need time in the role (jobs.minDaysAtLevel × level); business levelGrowth 1.45 / upgradeCost 1.0 / sellMultiple 8
- [ ] Map: district labels avoid icons
- [ ] Creator: preview faces the camera after Random / appearance changes
- [ ] Toast when a save fails
- [ ] Ride the city bus (board, fare, ride, get off at a chosen stop)
- [ ] Relocation (move permanently to another city)
- [ ] Interiors for 3+ more office workplaces
- [ ] Mobile / touch controls
- [ ] Performance pass

## Earlier rounds (summary)
- **Post-launch polish**: car OBB collisions, crowd + traffic behaviour, storefronts, wildlife, parks, weekly city events, 30 life events, pets, HUD compass, photo mode, buses, roles/uniforms, neighbourhood businesses (data/shops.js), zoo/campus/school/airport + trips, vehicle BODIES, bicycles, umbrellas, bigger cities, bridge, subway.
- **Third round (city life)**: Times Square, food carts, beaches + swimming, more roles, ducks, live events (crashes, purse snatchers), sports block, subway stairwells/stations, museums/library, building details (Facades.js), NYC district grid, zoo beyond the edge.
- **Fourth round (anime look)**: toon characters with ink outlines, motorbikes/scooters, skate park, bigger zoo, upstairs interiors, named buildings, street shows, playgrounds, clubs, doormen, roof parties, fireworks, food trucks, bus rides (ui/Bus.js), taxi hail (ui/Hail.js), world/Chunks.js culling.
- **Fifth round**: see-through car glass + cabins, taxi ride (world/TaxiRide.js), map search/identify, trash + cleaning crews (Trash.js, Cleaning.js), hiking hills (Hills.js), city themes (cfg.theme.styles).

## Phase checklist
- [x] 1. Setup: Vite + Three.js, loop, third-person controller + orbit camera, one procedural district, day/night
- [x] 2. Characters: factory (GLB hook + procedural), animations, 10 archetypes, creator UI, Random
- [x] 3. Core sim: clock, needs, mood, money, HUD, phone + Bank app, saves, title, pause/settings
- [x] 4. Home and work: room interior, sleep/eat/shower, Jobs app + interview, 3 careers + mini-games, café, clothing → MILESTONE demo
- [x] 5. Social: NPCs, schedules, friendships, Contacts/Messages, Social app, popularity, parties
- [x] 6. Education and skills; remaining careers; side hustles; businesses
- [x] 7. Finance depth: credit, card, loans, Invest app + market sim, Homes app, property, mortgages, renting out
- [x] 8. Build mode + furniture catalog + style score
- [x] 9. City select + all 5 cities, weather, transit/fast travel, map
- [x] 10. Rankings + AI rivals, goals, achievements, life events, tutorial
- [x] 11. Vehicles: dealer, driving, parking, traffic
- [x] 12. Polish: audio, post-processing, UI animation, balance pass, performance, bugs
- [x] 13. README, ASSETS.md, GitHub Pages workflow

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
- **Life events**: `when` = eligibility for random rolls (timing, flavour); `needs` = hard data requirements. trigger(id) (debug/forced) checks only `needs`, so it can never crash on a missing car/job/business/pet.
- **Pets**: one dog max (state.pet). Happiness −16/day without a 30-minute walk (−4 with), food charged each morning; 4 days at 0 → rehomed. The follower lives in the city scene and waits by shop doors; it moves into the interior scene only for the home and the rescue. Interaction needs the player to face the dog (it usually walks at heel).
- **Buses**: the last `nb` traffic slots are buses (hl 5.75 / hw 1.27, own InstancedMesh). They always stay alive, prefer street segments in `traffic.stopSegs` (stop on their right-hand kerb) and dwell 5–9 s with the front door at the stop.
- **Interior trims** must be one-sided planes facing into the room; boxes show through the cut-away walls nearest the camera.
- **Special blocks** are chosen in CityGenerator step 1 (kind 'zoo' | 'campus' | 'school' | 'airport') before lots; their builders add to the BuildingBatch, so they must run before `batch.build()`. Their places carry `outdoor` (zoo: booth dialog) or `custom` (own front) and Storefronts skips both.
- **Trips**: state.trip = { cityId } while visiting. The world (Game.city) is the visited city; the sim keeps the home city cfg (getCity(state.cityId)) for prices, rent and rankings. homePlace() returns the hotel; Vehicles.sync() shows no cars; Trips.daily charges a hotel night.
- **Performance**: parked cars use vehicleGeometry(type, { low: true }) (~600 tris vs ~1,800), split into 4×4-block chunks and hidden beyond ~240 m (ctx.lod, city.update(elapsed, night, px, pz)); keep instanced props light because hundreds are drawn at once.
- **Bridge walkway**: city.groundY() returns deckY() on the walkway; ColliderWorld.corridors exempt it from the city bounds; the rails and the lookout railing are colliders.
- **Rail transit**: cfg.transit.kind ('subway' | 'elevated' | 'bus'). Stations in rail cities enter the 'platform' interior (SubwayLife adds the train); boarding uses openStation(game, station, onPick) and a 'subwaycar' pseudo-place whose x/z/nx/nz are the destination station, so leaving the car puts you there.

- **Cities**: 5 data files in data/cities (+32-36 residents each in data/npcs). New Life flow = creator -> ui/CitySelect.js (live skyline preview) -> beginLife. The city is regenerated when the season changes (Game.checkSeason): fall colours, bare trees and white lawns in snowy-winter cities.
- **Weather**: world/Weather.js weatherAt(city,total) is deterministic per 6-hour block (clear/cloudy/rain/snow/haze); drives sky overcast + fog, particles and crowd density.
- **Transit**: world/Transit.js. Stations (E) = fare + fast travel between districts; taxi buttons in the map list (pricier, door to door).

- **Phase 10**: sim/Rivals.js (20 AI residents per city x 5 cities, daily growth) + sim/Rankings.js (LeaderboardProvider interface, LocalProvider; Hall of Fame in localStorage p2p.hof.v1). data/goals.js (picked in creator tab 5, max 3) + data/achievements.js checked daily by sim/Goals.js. data/events.js + sim/LifeEvents.js: one event every 2-3 days, shown by ui/EventDialog.js between 8:00 and 22:00; headless runs set sim.events.policy. ui/Tutorial.js "First Day" (event-driven, tolerant of out-of-order actions). A new life starts inside the rented room.

- **Vehicles**: data/vehicles.js, sim/Garage.js (cash or auto loan, depreciation, upkeep billed monthly), world/Vehicles.js (F to enter/exit, arcade driving restricted to asphalt, auto-brake for pedestrians, kerb parking in the outer lanes, valet from the Homes app), world/Traffic.js (AI cars in the inner lanes, obey signals, yield to people and the player). Interactables may set key F.

- **Phase 12**: src/audio (AudioEngine = synthesised SFX + optional files from public/audio, Ambience, Music = generative lo-fi from city.music). core/PostFX.js = bloom + vignette + OutputPass on Medium/High (Game.draw). ui/Debug.js = F1 panel, dynamically imported only in dev. scripts/sim.mjs = npm run sim [years] [city]: 7 bot strategies, 3 seeds each.
- **Balance results (10 years, Austin, Nov 2026)**: year 8 — coaster ~$160K, saver ~$165K, trades ~$210K, tech climber ~$635K ($900K y10), finance+landlord ~$1.08M, entrepreneur ~$1.14M; ER collapses ~0 for every bot. Promotions wait minDaysAtLevel × (level+1) days in the role. Raises are capped at 30% per level and reset on promotion.

## Testing
- `npm run dev` then (second terminal) `node scripts/smoke.mjs <scenario>` — headless Edge, fails on console errors, screenshots in scripts/shots/. Scenarios live in scripts/scenarios.mjs. Headless uses software GL, so its FPS number is meaningless.
- New scenarios: collide, crowd, faces, fronts, animals, park, events, pets, hud, rooms, photo, buses, walkers, turns, people, meet, shops, zoo, campus, travel, airfield, cars, bikes, rain, food, bridge, subway, sit, emotes, times, carts, beach (CITY=Miami for others), ducks, live, sports, stairs, culture, facades, boroughs, perf (draw calls / triangles; HEAVY=1 BREAKDOWN=1), motos, skate, upstairs (PLACE=restaurant...), homestairs, shows, trucks, fireworks, busride, playground, clubs, accessories, banners, hail, doormen, roofs, mapsearch, trash, cleanup (steps the crews directly), hills, themes (CITY=Miami | Los Angeles | Chicago | Austin). `ROLES=a,b node scripts/smoke.mjs people` lines up chosen roles.
- Do not edit files under src/ while a smoke run is going: the dev server hot-reloads and the run fails (window.__game undefined).
- Scenarios: polish (post FX, audio, debug panel), drive (dealer, driving, parking, traffic), life (tutorial, events, Goals/Rankings/Calendar), cities (all 5 cities, weather, transit, taxi — heavy, may need a rerun under software GL), build (build mode, renovation, two floors), finance (Invest, Homes, mortgage, loans, News), learn (Learn app, class, gigs, ventures, 4 mini-games), social (crowd, NPC talk, Contacts, Pulse, indoor NPCs), work (home, sleep, jobs, interview, shift, mini-games, café), core (HUD/phone/bank/map/pause/save-load), creator, default (walk + day/night shots).
- Dev key: `]` advances the clock one hour.

## Deployment
- Repo: https://github.com/DQuanBui/penny-to-penthouse (public). Play: https://dquanbui.github.io/penny-to-penthouse/
- .github/workflows/deploy.yml builds and deploys to GitHub Pages on every push to main, so only push commits whose smoke scenarios pass.

## Known issues
- Under headless software GL the heavy `cities` scenario can time out on a screenshot; rerun it.
- Under headless software GL the sim runs at roughly a quarter speed; scenarios that wait for traffic place vehicles directly.
