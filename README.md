# PENNY TO PENTHOUSE

**Start with nothing. Build everything.**

Penny to Penthouse is a 3D third-person life simulation that runs in your browser. Pick a person and a US city, start broke in a rented room, then learn, work, make friends, invest, buy and design homes, and climb the city rankings all the way to a penthouse. Every dollar follows real personal-finance rules — paychecks, taxes, rent, credit scores, loans, index funds and mortgages — so getting rich takes actual decisions.

### ▶ Play online: https://dquanbui.github.io/penny-to-penthouse/

![Title screen](docs/title.png)
![In the city](docs/city.png)

**Author:** Quan Bui — GitHub: [DQuanBui](https://github.com/DQuanBui) — dbui10@fordham.edu

## Features

- **Five open cities** — New York, Los Angeles, Chicago, Miami and Austin, each generated procedurally with its own districts, skyline, landmarks, economy, weather and residents. Day/night cycle, seasons, rain, snow and heat haze.
- **Character creator** — 10 backgrounds (Small-Town Dreamer to Rich Heir), 12 traits, body, face, 14 hairstyles, outfits and accessories with a live studio preview, plus a Random button.
- **Needs and mood** — Energy, Hunger, Hygiene, Fun, Social and Health shape how well you work and earn.
- **Careers** — 7 ladders (Tech, Finance, Healthcare, Creative, Trades, Hospitality, Real Estate) with interviews, shifts, promotions, raises and 7 mini-games. Side hustles any time.
- **Entrepreneurship** — start a food truck, café, app startup, clothing brand or property-management firm; hire, market, expand, sell — or go bust.
- **Deep personal finance** — checking and savings, budget and net-worth chart, progressive income tax, credit score and credit card, amortised loans, an investing app (index fund, 10 fictional stocks, bonds, crypto, market regimes and news), and real estate with mortgages, property tax, tenants and repairs.
- **Homes and build mode** — rent or buy from a room to a penthouse; place furniture on a grid, add walls, floors, paint and windows; style score lifts mood, popularity and parties.
- **People** — 160+ named residents with jobs, schedules and personalities. Chat, joke, hang out, date, find a roommate; friends bring referrals, discounts and party invites.
- **Popularity** — post from landmarks, go viral, land brand deals, throw house parties, unlock VIP tables.
- **Getting around** — walk, run, transit, taxis, or buy a car and drive it through traffic.
- **Goals, rankings and achievements** — life goals, 26 achievements, and city and national leaderboards against 100 AI rivals whose fortunes grow over time.
- **Life events** — job offers, market crashes, inheritances, rent hikes and more, each with choices that matter.
- **The phone** — Bank, Invest, Homes, Jobs, Learn, Gigs, Ventures, Contacts, Pulse, News, Goals, Rankings, Calendar, Map and Settings.
- **Saves** — 3 slots, autosave, export/import as a JSON file, and a Hall of Fame across lives.
- **Everything is procedural** — no downloaded art or audio: the city, characters, furniture, textures, sound effects and music are generated at runtime.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Shift | Run |
| Space | Jump |
| Mouse drag (or pointer lock — see Settings) | Orbit the camera |
| Mouse wheel | Zoom |
| E | Interact: doors, people, shops, beds, computers, work stations |
| Tab or P | Phone |
| M | Map (set a GPS waypoint, call a taxi) |
| B | Build mode (inside your home) |
| T | Wait / skip time |
| F | Get in / out of your car |
| W / S, A / D (in a car) | Throttle / brake, steer |
| Esc | Pause, or close the current screen |

The optional "First Day" tutorial walks you through the first few minutes.

## Run it locally

1. Install [Node.js LTS](https://nodejs.org/).
2. In this folder:

```bash
npm install
npm run dev
```

3. Open the address Vite prints (usually http://localhost:5173).

Other commands:

| Command | What it does |
| --- | --- |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run sim` | Headless balance check: plays 7 strategies for 5 in-game years and prints net worth (`npm run sim 8 newyork` for 8 years in New York) |
| `npm run smoke <scenario>` | Automated browser test with screenshots (needs `npm run dev` running and Edge or Chrome installed) |

In development builds, **F1** opens a debug panel (money, time, skills, teleport, events).

## Adding free character models

The game looks complete without any downloads, but you can drop in free CC0 character, vehicle and furniture models or your own audio. See **[ASSETS.md](ASSETS.md)** for exactly which packs to get and where to put the files.

## Project layout

```
src/core        game loop, input, saves, settings, post-processing
src/world       city generator, buildings, roads, sky, weather, interiors, vehicles, traffic
src/characters  procedural humanoids, animation, player controller, NPCs, crowd
src/sim         the headless simulation: needs, jobs, finance, market, real estate, social...
src/build       build mode and furniture meshes
src/minigames   one file per career mini-game
src/ui          HUD, phone apps, menus, creator, map
src/audio       procedural sound effects, ambience and music
src/data        ALL content: cities, careers, courses, items, furniture, NPCs, events, balance
```

All game content is data-driven: add a city, career, course, item or event by editing `src/data/` — no engine changes. Every tuning number lives in `src/data/balance.js`.

## Deployment

Pushing to `main` builds and publishes to GitHub Pages through `.github/workflows/deploy.yml` (repository **Settings → Pages → Source** must be **GitHub Actions**).

## Credits

- Design and development: **Quan Bui**
- Engine: [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/)
- All cities and neighbourhoods are real places; every business, brand and person in the game is fictional.

Built with Claude (Fable 5.2) in VS Code.
