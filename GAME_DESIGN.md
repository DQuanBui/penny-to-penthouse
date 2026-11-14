# Build "PENNY TO PENTHOUSE" — a 3D third-person life-simulation game for the browser

You are the lead developer. Build this game in this empty folder, working autonomously through the phases in section 14. Don't ask me questions unless truly blocked — make sensible decisions and record them in PROGRESS.md.

## 0. Working rules (save tokens, survive session limits)
1. Save this entire brief, word for word, as GAME_DESIGN.md. In later sessions, read ONLY the sections you need (search by heading) — never the whole file.
2. Create PROGRESS.md with the phase checklist. After each phase: decisions, known issues, and a "RESUME HERE:" line saying exactly what's next.
3. git init. After every phase: npm run build, fix all errors, test in npm run dev, update PROGRESS.md, commit.
4. Keep replies to me short. Don't print whole files back to me.
5. If context or usage runs low, stop only at a clean point (build passes, committed, RESUME HERE updated).

## 1. The game
- Title: PENNY TO PENTHOUSE — tagline: "Start with nothing. Build everything."
- Genre: 3D third-person open-city life simulation (career, money, friends, homes, building, rankings).
- Rating: everyone/teen — no crime, weapons, violence or gambling. Exploring the city is about life, not chaos.
- Platform: desktop browser, keyboard + mouse, deployed on GitHub Pages.
- Player fantasy: pick a person and a US city, start broke, then learn, work, network, invest, buy and design homes, and climb the city rankings from a rented room to a penthouse.

## 2. Tech stack and constraints
- Vite + vanilla JavaScript (ES modules) + Three.js (latest). Simple custom collision (capsule vs ground, box colliders for buildings/props). No heavy physics engine unless needed.
- vite.config.js base: './' (works on GitHub Pages under any repo name).
- ALL game content is data-driven JSON/JS modules in src/data/ (cities, districts, archetypes, careers, courses, items, furniture, homes, NPCs, events, stocks, achievements). Adding content must not require engine changes.
- Assets: generate everything procedurally by default (city, buildings, props, furniture, textures via canvas, sounds via Web Audio). Optional asset hooks: if .glb files exist in public/models/characters/, public/models/vehicles/, public/models/furniture/ or audio exists in public/audio/, load and use them (characters must support Mixamo/Quaternius-style rigs with idle/walk/run/sit animations via AnimationMixer); otherwise fall back silently. Write a short ASSETS.md telling me exactly which free CC0 packs to download and where to put them.
- Procedural character fallback must still look good: stylized, well-proportioned humanoids (rounded torso/limbs, head with modeled hair styles, eyes, eyebrows, simple clothing meshes), smooth procedural walk/run/idle animation. Not blocky.
- Performance: 60 FPS on a mid-range laptop at Medium. InstancedMesh for buildings/windows/trees/streetlights/NPC crowds, distance culling, LOD for NPCs, no per-frame allocations. Low/Medium/High presets and auto-downgrade if FPS stays low.
- Save system: 3 save slots in localStorage + export/import save as a JSON file. Autosave every in-game day and when sleeping.
- No console errors in normal play. Never use alert/confirm/prompt. Clean, modular, commented code.

## 3. Controls
- WASD move, Shift run, Space jump, mouse to orbit the third-person camera (hold right mouse or pointer lock — make it a setting), mouse wheel zoom
- E interact (doors, NPCs, shops, beds, computers, job sites)
- Tab or P phone, M map, B build mode (only inside a home you own), T wait/skip time, Esc pause
- Driving (when vehicles exist): W/S throttle/brake, A/D steer, F enter/exit
- First-time contextual hints for every action.

## 4. Start of game
### 4.1 Character select and creator
- 10 starting archetypes (data-driven), each with a short backstory, starting cash, debt, skills and a trait:
  Small-Town Dreamer, City Kid, Rich Heir (lots of money, low grit), College Dropout, First-Gen Hustler, Retired Athlete, Art School Grad, Ex-Military, Single Parent, Gamer/Streamer.
- "Random" button that generates a full random character.
- Creator: name, body type, height, skin tone (wide range), face shape, eyes, brows, hairstyle and color (10+ styles), facial hair, outfit (top, bottom, shoes, accessory). Live rotating 3D preview in a nicely lit studio.
- Traits (pick 2 of ~12): Ambitious, Frugal, Charismatic, Night Owl, Fitness Buff, Creative, Genius, Lazy, Generous, Risk-Taker, Homebody, Social Butterfly — each with gameplay effects.

### 4.2 City select
5 cities, each a data file with its own look, economy and districts. Show a comparison screen (rent index, salary index, top industries, weather, vibe):
- New York — highest pay and rent, finance/media; districts: Midtown, Lower Manhattan, Brooklyn, Queens.
- Los Angeles — entertainment/creative, car-centric, sunny; districts: Downtown, Hollywood, Santa Monica, Silver Lake.
- Chicago — finance/trades, cold winters; districts: The Loop, River North, Wicker Park, Hyde Park.
- Miami — tourism/real estate, beaches, humid; districts: Brickell, South Beach, Wynwood, Little Havana.
- Austin — tech boom, mid cost; districts: Downtown, East Austin, South Congress, The Domain.
Use real city/neighborhood names but fictional businesses and brands only (e.g., Byteway Tech, Brewly Coffee, Summit Bank). No real company logos or trademarks.

## 5. The open city (third person)
- Procedural city per city config: road grid with sidewalks, crosswalks, traffic lights, street lamps, trees, benches; district-specific building styles and heights (skyscrapers, brownstones, beach condos, warehouses), stylized landmark-inspired buildings per city (not exact replicas), parks, a waterfront where the city has one.
- Day/night cycle with lighting changes, lit windows at night, weather per city (rain, snow in Chicago winter, heat haze in Miami).
- Ambient life: NPC pedestrians with simple schedules (commute, lunch, nightlife) and later traffic.
- Enterable places (separate interior scenes loaded with a quick fade): your home, workplaces, café, gym, clothing store, furniture store, grocery, bank, college, bar/lounge, real-estate office, car dealer.
- Minimap + full map (M) with district names, icons, and a GPS waypoint line.
- Getting around: walk/run, subway/bus stations (pay fare, fast travel between districts), taxi/rideshare (costs money), own vehicles later.

## 6. Core life systems
### 6.1 Time and needs
- Clock and calendar (1 in-game day ≈ 16 real minutes, configurable). Weekdays/weekends, seasons, paydays and bill dates.
- Needs: Energy, Hunger, Hygiene, Fun, Social, Health. Low needs reduce work performance, mood and earning; very low triggers consequences (fainting → hospital bill).
- Mood summarizes needs and boosts/penalizes everything.
- Sleep in a bed to skip the night; better beds restore more.

### 6.2 Skills and education
- Skills (0–10): Coding, Business, Finance, Charisma, Fitness, Creativity, Cooking, Handiness.
- Learn by: college degrees (multi-week, tuition or student loans), bootcamps, online courses on the phone, books, practice (gym, cooking at home, computer).
- Degrees/certifications unlock higher career levels.

### 6.3 Careers
- Data-driven career ladders (6–8 levels each, salary, hours, skill/degree requirements):
  Tech, Finance, Healthcare, Creative/Influencer, Trades, Hospitality/Food, Real Estate, plus Entrepreneur (start a business: food truck, café, app startup, clothing brand, property management — invest, hire, earn profit, risk failure).
- Side hustles anytime: rideshare/delivery runs, freelancing gigs, streaming, tutoring.
- Getting a job: Jobs app → apply → short interview (3 choice questions affected by skills/charisma/outfit).
- Working: go to the workplace on time (late = penalty). Each shift = choose skip-to-end (auto-resolve) or play a quick 30–60 second career mini-game (e.g., Tech: bug-squash puzzle; Finance: pick the right trades; Food: order rush; Trades: wiring puzzle). Performance builds toward promotions, raises, bonuses, or getting fired.
- City matters: industries boost salaries/opportunities in their city.

### 6.4 Relationships and popularity
- 30+ named NPCs per city (data-driven) with personality, interests, job, schedule and favorite places.
- Interactions: chat, joke, compliment, ask about work, invite to hang out, give gift; friendship meter (stranger → acquaintance → friend → best friend) and optional dating/partner/roommate.
- Friends give job referrals, investment tips, discounts, party invites. Networking is a real career lever.
- Popularity score + followers in the Social app: posts (photos at landmarks, new outfits, new home), throwing parties, events. Popularity unlocks influencer income and VIP places.

### 6.5 Money and personal finance (signature system — make it deep and realistic)
- Bank app: checking, savings (APY), transaction history, monthly budget breakdown, net-worth chart over time.
- Income: paychecks (biweekly), simplified progressive income tax, bonuses, side-hustle and business income, rent collected.
- Expenses: rent/mortgage, utilities, phone, groceries, transit/car, insurance, subscriptions, loan payments. Lifestyle creep is real.
- Credit score (300–850) driven by on-time payments, utilization, history. Affects loan approval and rates. Credit card with a limit and interest.
- Loans: student, auto, personal, mortgage — amortized payments, interest, missed payments hurt credit.
- Investing app: index fund (steady growth + volatility), 10 fictional stocks across sectors with simulated prices (random walk + sector trends + news events), crypto (very volatile), bonds. Market regimes (bull, bear, recession, boom) announced via in-game news. Buy/sell, portfolio value, gain/loss, dividends.
- Real estate: listings per district (studio → condo → townhouse → house → luxury penthouse), prices tied to city/district, appreciation over time, down payment + mortgage calculator, property tax, maintenance. Owned properties can be rented out to tenants for passive income (vacancy and repair events).
- Net worth = cash + investments + property equity + vehicles − debts.

### 6.6 Housing, shopping and build mode
- Housing ladder: couch-surf/rented room → studio → apartment → owned condo → house → penthouse.
- Shops: clothing (outfits affect popularity and interviews), furniture, electronics, groceries, vehicles (later).
- Build mode (B, owned homes only): grid-based walls, floors, wallpaper/paint, doors, windows, stairs-free single or two-floor layouts; furniture catalog by category (bed, sofa, desk, kitchen, bathroom, decor, plants, lighting) with price, need bonuses and a "style score". Move/rotate/sell items, undo/redo, top-down build camera. Home style score feeds happiness and popularity (and parties).
- Rented homes allow furniture placement but not walls.

### 6.7 Random life events
Data-driven events with choices and consequences: job offer from a rival company, market crash, friend asks for a loan, car breakdown, viral post, landlord raises rent, scholarship offer, health scare (doctor bill), inheritance, startup buyout offer. Roughly 1 event every 2–3 in-game days.

### 6.8 Goals, rankings and achievements
- Life goals chosen at start (e.g., "Millionaire by 35", "Own 3 properties", "Become a CEO", "1M followers") with progress tracking.
- Rankings app: Net Worth, Total Earned, Savings Rate, Popularity, Career Level, Home Value, Friends. Show the player vs ~20 simulated AI rival residents per city whose stats grow realistically over time, so the leaderboard feels alive offline. City rank + national rank across all 5 cities.
- Also a Hall of Fame across save slots.
- Achievements: First Paycheck, Debt-Free, Emergency Fund, First $100K, Homeowner, Landlord, Promoted to Executive, Millionaire, Penthouse, Best Friends x5, Viral, etc.
- Keep the leaderboard code behind an interface so an online backend (Supabase) can be added later without rewriting.

## 7. The phone (main UI hub)
A sleek in-game smartphone UI (Tab/P) with apps: Bank, Jobs, Learn, Invest, Homes, Shop, Social, Contacts/Messages, Map, Calendar, Rankings, Goals, News, Settings. Clean modern design, smooth transitions, notification badges and toast notifications (payday, bills due, messages, market news).

## 8. HUD
Minimal: clock/date, cash, mood + needs ring (expand on hover), current objective/goal, minimap, interaction prompts, notification toasts.

## 9. Menus
- Title screen: animated 3D city skyline at sunset with a slow camera flyover; logo; buttons: Continue, New Life, Load, Settings, Credits.
- Pause: Resume, Save, Load, Settings, Controls, Quit to title.
- Settings: graphics preset, show FPS, mouse sensitivity, invert Y, camera mode, time speed, volumes, UI scale, autosave toggle.
- Short optional tutorial "First Day": wake up in a rented room, check your phone, buy a coffee, apply for your first job, make a friend.

## 10. Visual and audio direction
- Stylized semi-realistic, warm and aspirational: soft shadows, rich sunset/golden-hour palette, neon accents at night, clean UI with rounded cards and a modern sans font.
- Post-processing (Medium/High): subtle bloom, SSAO-lite or baked AO look, tone mapping, vignette.
- Procedural audio (Web Audio): city ambience (traffic hum, distant horns, birds by day, nightlife by night), footsteps, UI clicks/swooshes, cash register, notification pings, a light lo-fi music loop per city mood. Master/Music/SFX volume.

## 11. Suggested structure
    index.html, vite.config.js, package.json
    README.md, GAME_DESIGN.md, PROGRESS.md, ASSETS.md
    .github/workflows/deploy.yml
    public/models/ (optional characters, vehicles, furniture), public/audio/
    src/main.js
    src/core/       Game.js, Loop.js, Input.js, SaveSystem.js, Settings.js, Events.js, Clock.js
    src/world/      CityGenerator.js, Buildings.js, Roads.js, Props.js, Sky.js, Weather.js, Interiors.js, Transit.js
    src/characters/ CharacterFactory.js, Customization.js, Animation.js, PlayerController.js, ThirdPersonCamera.js, NPC.js, Crowd.js
    src/sim/        Needs.js, Skills.js, Careers.js, Jobs.js, Education.js, Relationships.js, Popularity.js, Finance.js, Credit.js, Loans.js, Market.js, RealEstate.js, Business.js, LifeEvents.js, Goals.js, Rankings.js, Rivals.js, Achievements.js
    src/build/      BuildMode.js, Grid.js, Walls.js, FurnitureCatalog.js
    src/minigames/  one file per career mini-game
    src/ui/         TitleScreen.js, CharacterCreator.js, CitySelect.js, HUD.js, Phone/ (one file per app), Menus.js, Map.js, styles.css
    src/audio/      AudioEngine.js, Ambience.js, Music.js
    src/data/       cities/, archetypes.js, traits.js, careers.js, courses.js, items.js, furniture.js, homes.js, npcs/, events.js, stocks.js, achievements.js

## 12. Quality bar
- A new player knows what to do in the first 60 seconds (tutorial + Goals app + clear objective).
- The economy must be balanced and fun: early game tight (rent pressure), mid game choices (invest vs spend vs study), late game big moves (properties, business). Put all tuning numbers in one balance.js config. Write a quick headless simulation script (npm run sim) that simulates 5 in-game years for a few strategies and prints net worth, so balance can be checked with data.
- Never stuck in geometry or out of bounds; resize and tab-blur (auto-pause) handled.
- Dev-only debug panel (F1): add money, set time, max skills, teleport to district, trigger event. Disabled in production builds.

## 13. README.md
Title, tagline, 3-sentence pitch, author: Quan Bui (GitHub: DQuanBui, dbui10@fordham.edu), features list, controls table, how to run locally (Node.js LTS → npm install → npm run dev), play online link: https://dquanbui.github.io/penny-to-penthouse/ , how to add free character models (link ASSETS.md), credits, "Built with Claude (Fable 5.2) in VS Code."

## 14. Build phases (in order; after each: build, fix, test, update PROGRESS.md, commit)
1. Setup: Vite + Three.js, structure, loop, third-person controller and orbit camera on one procedural city district (roads, sidewalks, buildings, lamps, trees), day/night cycle.
2. Characters: character factory (GLB hook + good-looking procedural fallback), animations, 10 archetypes, creator UI with live preview, Random button.
3. Core sim: clock, needs, mood, money, HUD, phone shell with Bank app, save slots/autosave, title screen, pause/settings.
4. Home and work: rented room interior, sleep, eat, shower; Jobs app, applying + interview, 3 careers (Tech, Hospitality/Food, Trades) with shifts and 3 mini-games, promotions; café and clothing store.
   → MILESTONE: playable demo (create character, live a few days, earn, get promoted).
5. Social: NPCs with schedules, interactions, friendships, Contacts/Messages, Social app, popularity, parties.
6. Education and skills; remaining careers; side hustles; Entrepreneur businesses.
7. Finance depth: credit score, credit card, loans, Invest app with market sim and news, Homes app, buying property, mortgages, renting out.
8. Build mode with furniture catalog and style score.
9. City select + all 5 cities with their districts, weather and economies; transit/fast travel; map.
10. Rankings with AI rivals, life goals, achievements, random life events, tutorial "First Day".
11. Vehicles: dealer, driving, parking, simple traffic.
12. Polish: audio, post-processing, UI animations, balance pass (npm run sim), performance pass, bug pass.
13. README, ASSETS.md, GitHub Pages workflow (.github/workflows/deploy.yml using actions/configure-pages, actions/upload-pages-artifact, actions/deploy-pages on push to main). Remind me to set Settings → Pages → Source = "GitHub Actions".

## 15. When you finish (or stop at a clean point)
Reply briefly: what was built, how to run it, how to test the newest features in 3–5 steps, known issues, and next steps.
