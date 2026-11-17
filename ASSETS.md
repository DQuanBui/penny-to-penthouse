# Optional assets

**The game needs no downloads.** The city, characters, furniture, cars, textures and all sound are generated procedurally at runtime.

If you want to swap in real models or audio, drop files into the folders below. The game detects them automatically (a Vite plugin lists the folders into `asset-manifest.json`) and silently falls back to the procedural version for anything missing.

After adding files, refresh the page in `npm run dev`, or run `npm run build` again for a production build.

## Characters — `public/models/characters/`

Format: `.glb` (binary glTF) with a skinned humanoid and animations. Mixamo- and Quaternius-style rigs both work. The model is auto-scaled to about 1.75 m.

| File name | Used for |
| --- | --- |
| `player*.glb` (e.g. `player.glb`, `player_casual.glb`) | Offered as a **Model** choice on the Look tab of the character creator |
| any other `.glb` | Named NPCs and the pedestrian crowd |

Animations are matched by clip **name** (case-insensitive): a clip containing `idle`, `walk`, `run`, `sit` or `jump` is used for that state. Missing clips fall back to idle.

Rigs whose animations come as separate files (Mixamo "without skin" downloads): convert each to `.glb` and put them in `public/models/characters/animations/` named after the action (`idle.glb`, `walk.glb`, `run.glb`, `sit.glb`). They are shared by every character model with matching bone names.

Recommended free packs (CC0 — no attribution required, verify the licence on the download page):

- **Quaternius — Ultimate Animated Character Pack** and **Universal Base Characters** — https://quaternius.com — ready-made `.glb` files that already include Idle / Walk / Run / Sitting clips. The easiest option.
- **Kenney — Animated Characters** packs — https://kenney.nl/assets — CC0; shipped as FBX, convert to GLB (Blender: File → Import FBX, File → Export glTF 2.0 with animations).
- **Mixamo** — https://www.mixamo.com — free with an Adobe account (not CC0; read their terms). Download a character "with skin" plus idle/walk/run/sitting animations, convert to GLB.

## Vehicles — `public/models/vehicles/`

One `.glb` per car, named after the vehicle id in `src/data/vehicles.js`, with the **front facing +Z**:

`dart.glb`, `metro.glb`, `hauler.glb`, `trail.glb`, `e1.glb`, `stinger.glb`, `monarch.glb`

- **Kenney — Car Kit** — https://kenney.nl/assets/car-kit — CC0, includes GLB files.
- **Quaternius — Cars** packs — https://quaternius.com — CC0.

(Ambient traffic always uses the built-in instanced car mesh for performance.)

## Furniture — `public/models/furniture/`

One `.glb` per item, named after the furniture id in `src/data/furniture.js` (for example `bed_single.glb`, `sofa.glb`, `desk_basic.glb`, `fridge.glb`, `tv_big.glb`, `plant_floor.glb`). The model is scaled to fit the item's footprint; front faces +Z.

- **Kenney — Furniture Kit** — https://kenney.nl/assets/furniture-kit — CC0, includes GLB files.

## Audio — `public/audio/`

Formats: `.mp3`, `.ogg`, `.wav` or `.m4a`.

| File name | Replaces |
| --- | --- |
| `click`, `swoosh`, `cash`, `notify`, `success`, `error`, `door`, `step`, `stepIn` | The matching synthesised sound effect |
| `music.mp3` | The generated lo-fi music loop, in every city |
| `music_newyork.mp3`, `music_losangeles.mp3`, `music_chicago.mp3`, `music_miami.mp3`, `music_austin.mp3` | The music for one city |

- **Kenney — Interface Sounds / UI Audio / Impact Sounds** — https://kenney.nl/assets?q=audio — CC0.
- **FreePD** — https://freepd.com — CC0 music.

## Licence reminder

Only add assets you have the right to redistribute — the repository is public and GitHub Pages serves everything under `public/`. Keep to fictional brands: no real company logos or trademarks.
