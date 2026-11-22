# PENNY TO PENTHOUSE — Progress

RESUME HERE: All 13 phases are complete and deployed. Post-launch polish round done (see "Post-launch" below). Second polish round done too (businesses, roles, zoo, campus, school, airport). Next ideas: riding the bus, moving permanently to another city (relocation), interiors for more office types, mobile/touch controls, an online leaderboard provider (sim/Rankings.js interface).

## Post-launch (polish round)
- [x] Car collisions (OBB/SAT for parked + traffic + player car) — no walking or driving through cars
- [x] Denser crowd (signal-aware crossings, joggers, chats) and smoother procedural characters
- [x] Storefronts per place type (data/placeTypes.js `look`, world/Storefronts.js), malls in every city
- [x] Wildlife (world/Animals.js), streetscape + rooftops (world/Streetscape.js), realistic car model (world/CarModel.js)
- [x] Parks + street life (world/Parks.js, world/StreetLife.js), benches you can sit on
- [x] Weekly city events (data/cityEvents.js, world/CityEvents.js)
- [x] 30 life events; forced/debug triggers respect each event's `needs`
- [x] Pets: data/pets.js, sim/Pets.js (state.pet), world/Pet.js (follower + rescue dogs), ui/Pets.js; Pet Rescue place type in every city
- [x] HUD: compass + waypoint distance, need ring meters, pet chip, dismissable toasts
- [x] Interiors: skyline windows (day/night), curtains, wall clock, molding, set tables
- [x] Photo mode (ui/PhotoMode.js, H): save PNG or post (POST_KINDS.photo with a subject multiplier)
- [x] City buses (Traffic bus slots, CarModel busGeometry, city.busStops, per-city `busColor`)
- [x] Pedestrians stay on pavements: park lawns keep a 5 m sidewalk ring; Crowd.steer() sidesteps colliders
- [x] Traffic: planned turns (planTurn), bezier paths through intersections, blinking indicators (aSignal), body roll/pitch; player car bicycle-model steering
- [x] Roles (Customization ROLES / roleAppearance): uniforms, vests, scrubs, coats, hats, carried items; crowd rigs matched by role; people sitting on the street (StreetLife 'sitter')
- [x] Crowd greetings: socialize() pairs, handshake/talk/wave animation, keep-right passing
- [x] Neighbourhood businesses: data/shops.js (minor place types), CityGenerator step 2b, ui/SmallBusiness.js, interiors pub/club/pizza/deli/pharmacy/barber/salon/bookstore/laundromat/florist/cinema/diner/arcade/bakery, NPC customers and dancers, map filters
- [x] Zoo (world/Zoo.js, block kind 'zoo'), campus + school (world/Campus.js), airport + air traffic (world/Airport.js) and trips (sim/Trips.js, ui/Travel.js, Game.travelTo)
- [x] Vehicles: parametric BODIES in world/CarModel.js (vehicleGeometry(type) -> body + see-through glass with a driver); Traffic one mesh pair per style; parked cars chunked + distance-culled; dealer models carry `body`
- [x] Bicycles (world/Bikes.js): bike-share docks (city.bikeDocks), own bikes from the bike shop (state.bike, G), PlayerController.updateRide, cyclists as Traffic 'bike' slots in BIKE_LANE
- [x] Umbrellas (characters/Umbrella.js): crowd impostors + rigs, NPCs, player when raining
- [x] World food: 12 more shop types in data/shops.js with eatery() themed interiors
- [x] Bigger cities (grid 12), suspension bridge (world/Bridge.js: walkable corridor, deckY ground, BridgeLife strollers), subway (world/Subway.js: platform + subwaycar interiors, trains, rides)

## Third round (city life)
- [x] Times Square (world/TimesSquare.js, landmark type 'times_square'): billboard towers, tickers, red steps (per-step colliders), TimesSquareLife tourists
- [x] Food carts (world/FoodCarts.js): CART_KINDS menus, corner carts, steam; StreetLife.openCart(spot) by kind; 'vendor' role with apron
- [x] Beaches (world/Beach.js, cfg.beach): sloped sand mesh, beachY in groundY, corridor + walls, Roads rail gap; BeachLife (sunbathers, swimmers, volleyball, frisbee, lifeguard); player swimming (floatY, swim pose) and lying (sunbathe)
- [x] More roles: firefighter, paramedic, sanitation, rich, elderly (cane), parent (stroller), skater, musician, poor; crowd RIG_ROLES
- [x] Ducks and swans (world/Ducks.js): instanced clusters along the waterfront, feed from the railing
- [x] Live events (world/LiveEvents.js): kerb crashes (police/ambulance, 911, help) and purse snatchers (chase on the sidewalk lattice, return the bag); OBBs via Game.pushOutOfMovers
- [x] Sports block (world/Sports.js, block kind 'sports'): basketball + soccer pickup games, join (emote with move: true)
- [x] Subway stairwells (Props.js subwayEntrance): depth "punch" quad (renderOrder -1 after ground/water at -2), wellY in groundY; bigger station hall with ticket machines (state.transitPass), newsstand, maps, transit police
- [x] New shop types: autoshow, library (skill XP via menu item xp), artmuseum, historymuseum with themed interiors and furniture
- [x] Building details (world/Facades.js): fire escapes, rooftop billboards, warning lights, roof gardens
- [x] District grid (cfg.districtGrid) — New York is 2 x 3 on a 15 x 15 map with Harlem and the Bronx; Borough Field ballpark landmark
- [x] Zoo moved beyond the city edge (zooField in the backdrop loop, corridor): 11 habitats, new species (tiger, bear, hippo, rhino, monkey, kangaroo)

## Fourth round (anime look, liveliness)
- [x] Anime characters (CharacterFactory): MeshToonMaterial with a 3-step ramp, ink outline = second SkinnedMesh on the same skeleton (aOutline attribute, tiny parts skip), HEAD_SCALE 1.15, anime eyes/lashes/brows/blush, bangs + spiky/twintails/hime hair, bow/catears/hairclip accessories; far crowd (Crowd impostors) toon + ink; zoo and city animals toon + ink
- [x] Motorbikes (CarModel buildMoto, BODIES scooter/motorbike[_solo]); player scooter/motorbike (Bikes.makeMoto, helmet on the head bone); skateboard + rental (SkatePark.js: rampY quarter pipes in groundY, SkateLife)
- [x] Zoo: 15 habitats (pandas, gorillas, crocodiles, aviary with perched parrots), gate officer, keepers (feedingAt draws animals)
- [x] Interiors: withUpstairs() adds a staircase + upper floor (UPSTAIRS by interior kind; stairY ramp in groundY; Game.useStairs at y > 1.3 / < -1.3); homes: spiral staircase replaces the lift pad
- [x] Named buildings (Facades: entrances, plaques, tower names), accent colours; people: kids, cosplayers, hipsters, goths, athletes, artists
- [x] StreetShows, Playground, NightLife (club queues), Doormen, RoofParties, Fireworks, food trucks (FoodCarts.buildFoodTrucks), waiters/cooks (NPC route), chat bubbles (Crowd), district banners + spring blossoms (Props), bus rides (ui/Bus.js), taxi hail (ui/Hail.js), garbage trucks and vans
- [x] Performance: world/Chunks.js tiles city-wide meshes and batches (200 m) and distance-culls signs/icons

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
- **Balance results (5 years, Austin)**: coaster ~$105K, saver ~$110K, trades+index ~$205K, tech climber ~$525K, finance+landlord ~$675K ($1.1M in NYC), entrepreneur ~$2M. Year 1 is near zero for anyone studying on loans. Raises are capped at 30% per level and reset on promotion.

## Testing
- `npm run dev` then (second terminal) `node scripts/smoke.mjs <scenario>` — headless Edge, fails on console errors, screenshots in scripts/shots/. Scenarios live in scripts/scenarios.mjs. Headless uses software GL, so its FPS number is meaningless.
- New scenarios: collide, crowd, faces, fronts, animals, park, events, pets, hud, rooms, photo, buses, walkers, turns, people, meet, shops, zoo, campus, travel, airfield, cars, bikes, rain, food, bridge, subway, sit, emotes, times, carts, beach (CITY=Miami for others), ducks, live, sports, stairs, culture, facades, boroughs, perf (draw calls / triangles; HEAVY=1 BREAKDOWN=1), motos, skate, upstairs (PLACE=restaurant...), homestairs, shows, trucks, fireworks, busride, playground, clubs, accessories, banners, hail, doormen, roofs. `ROLES=a,b node scripts/smoke.mjs people` lines up chosen roles.
- Do not edit files under src/ while a smoke run is going: the dev server hot-reloads and the run fails (window.__game undefined).
- Scenarios: polish (post FX, audio, debug panel), drive (dealer, driving, parking, traffic), life (tutorial, events, Goals/Rankings/Calendar), cities (all 5 cities, weather, transit, taxi — heavy, may need a rerun under software GL), build (build mode, renovation, two floors), finance (Invest, Homes, mortgage, loans, News), learn (Learn app, class, gigs, ventures, 4 mini-games), social (crowd, NPC talk, Contacts, Pulse, indoor NPCs), work (home, sleep, jobs, interview, shift, mini-games, café), core (HUD/phone/bank/map/pause/save-load), creator, default (walk + day/night shots).
- Dev key: `]` advances the clock one hour.

## Deployment
- Repo: https://github.com/DQuanBui/penny-to-penthouse (public). Play: https://dquanbui.github.io/penny-to-penthouse/
- .github/workflows/deploy.yml builds and deploys to GitHub Pages on every push to main, so only push commits whose smoke scenarios pass.

## Known issues
- Under headless software GL the heavy `cities` scenario can time out on a screenshot; rerun it.
- Under headless software GL the sim runs at roughly a quarter speed; scenarios that wait for traffic place vehicles directly.
