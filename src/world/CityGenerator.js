// Procedural city built from a city data file: block grid, per-district lot
// layouts and building styles, enterable places with doors/signs, backdrop
// skyline, colliders and helper queries (ground height, district lookup).
import * as THREE from 'three';
import { mulberry32, pick, shuffle } from '../core/utils.js';
import { DISTRICT_STYLES } from '../data/districtStyles.js';
import { PLACE_TYPES } from '../data/placeTypes.js';
import { SHOP_TYPES, SHOP_IDS, STYLE_MIX } from '../data/shops.js';
import { BuildingBatch, InstanceBatch, FACADE } from './Buildings.js';
import { ColliderWorld } from './Collision.js';
import { buildRoads } from './Roads.js';
import { buildProps, buildStation } from './Props.js';
import { buildLandmarks } from './Landmarks.js';
import { buildStorefronts } from './Storefronts.js';
import { buildStreetscape, addRooftops } from './Streetscape.js';
import { decorateParks } from './Parks.js';
import { buildFoodCarts } from './FoodCarts.js';
import { beachSpec, buildBeach, beachY } from './Beach.js';
import { buildZoo } from './Zoo.js';
import { buildCampus, buildSchool } from './Campus.js';
import { buildAirport, airportSide } from './Airport.js';
import { bridgeSpec, buildBridge, onWalkway, deckY } from './Bridge.js';
import { labelTexture, iconTexture } from './Textures.js';

export const K = { BLOCK: 58, SIDEWALK: 5, ROAD: 14, PITCH: 72, CURB: 0.15, PROM: 26 };
const FACADE_ID = { glass: FACADE.GLASS, masonry: FACADE.MASONRY, warehouse: FACADE.WAREHOUSE, balcony: FACADE.BALCONY, plain: FACADE.PLAIN };
const NORMALS = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };

export function generateCity(cfg, opts = {}) {
  const rng = mulberry32(cfg.seed || 1);
  const N = cfg.grid || 12; // blocks per side (12 × 12 ≈ 860 m across)
  const total = N * K.PITCH + K.ROAD;
  const half = total / 2;
  const blockMin = (i) => -half + K.ROAD + i * K.PITCH;
  const roadCenter = (k) => -half + K.ROAD / 2 + k * K.PITCH;
  const wf = cfg.waterfront || [];
  const water = { north: wf.includes('north'), south: wf.includes('south'), east: wf.includes('east'), west: wf.includes('west') };
  water.any = wf.length > 0;

  const group = new THREE.Group();
  group.name = 'city:' + cfg.id;
  const colliders = new ColliderWorld(16);
  colliders.bounds = {
    minX: -half - (water.west ? K.PROM - 0.6 : 0),
    maxX: half + (water.east ? K.PROM - 0.6 : 0),
    minZ: -half - (water.north ? K.PROM - 0.6 : 0),
    maxZ: half + (water.south ? K.PROM - 0.6 : 0),
  };

  // a great bridge strides out from the waterfront
  const bridge = bridgeSpec(cfg, { N, half, roadCenter, K });
  const beach = beachSpec(cfg, { half, K });

  const districts = cfg.districts.map((d, q) => {
    const qi = q % 2;
    const qj = q >> 1;
    const span = (N / 2) * K.PITCH;
    return {
      ...d,
      index: q,
      styleDef: DISTRICT_STYLES[d.style] || DISTRICT_STYLES.midrise,
      cx: -half + K.ROAD / 2 + span * (qi + 0.5),
      cz: -half + K.ROAD / 2 + span * (qj + 0.5),
    };
  });
  const districtAt = (x, z) => districts[(z < 0 ? 0 : 2) + (x < 0 ? 0 : 1)];

  // --- 1. Blocks and lots ----------------------------------------------------
  const blocks = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x0 = blockMin(i);
      const z0 = blockMin(j);
      const d = districts[(j < N / 2 ? 0 : 2) + (i < N / 2 ? 0 : 1)];
      const b = { i, j, x0, z0, x1: x0 + K.BLOCK, z1: z0 + K.BLOCK, cx: x0 + K.BLOCK / 2, cz: z0 + K.BLOCK / 2, district: d, style: d.styleDef, kind: 'build', lots: [] };
      if (rng() < (b.style.parkChance ?? 0.05)) b.kind = 'park';
      blocks.push(b);
    }
  }
  // every district gets at least one park
  for (const d of districts) {
    const mine = blocks.filter((b) => b.district === d);
    if (!mine.some((b) => b.kind === 'park')) mine[5].kind = 'park';
  }
  // landmarks take over a whole block (a paved plaza) in their district
  for (const lm of cfg.landmarks || []) {
    const d = districts.find((x) => x.id === lm.district) || districts[0];
    const mine = blocks.filter((b) => b.district === d && b.kind === 'build');
    const b = mine[Math.floor(rng() * mine.length)];
    if (b) {
      b.kind = 'landmark';
      b.landmark = lm;
    }
  }
  // the city zoo takes a whole block in a leafy, lower-rise district
  const zooDistrict = [...districts].sort((a, c) => (a.style === 'skyscraper') - (c.style === 'skyscraper') || a.rentMul - c.rentMul)[0];
  const zooCands = blocks.filter((b) => b.district === zooDistrict && b.kind === 'build');
  const zooBlock = zooCands.length ? zooCands[Math.floor(rng() * zooCands.length)] : null;
  if (zooBlock) zooBlock.kind = 'zoo';
  // a university campus where the college is, and a neighbourhood school
  const pickBlock = (d) => {
    const c = blocks.filter((b) => b.district === d && b.kind === 'build');
    return c.length > 2 ? c[Math.floor(rng() * c.length)] : null;
  };
  const collegeD = districts.find((d) => d.id === (cfg.places.find((p) => p.type === 'college') || {}).district) || districts[1];
  const campusBlock = pickBlock(collegeD);
  if (campusBlock) campusBlock.kind = 'campus';
  const schoolD = [...districts].sort((a, c) => a.rentMul - c.rentMul).find((d) => d !== zooDistrict) || districts[2];
  const schoolBlock = pickBlock(schoolD);
  if (schoolBlock) schoolBlock.kind = 'school';
  // the airport terminal sits on an edge block facing open land; its airfield is beyond the edge
  const airSide = airportSide(cfg);
  const mid = Math.floor(N / 2);
  const edgeAt = (k) => blocks.find((b) => (airSide === 'east' ? b.i === N - 1 && b.j === k : airSide === 'west' ? b.i === 0 && b.j === k : airSide === 'north' ? b.j === 0 && b.i === k : b.j === N - 1 && b.i === k));
  let airBlock = null;
  for (const k of [mid, mid - 1, mid + 1, mid - 2, mid + 2]) {
    const b = edgeAt(k);
    if (b && b.kind === 'build') {
      airBlock = b;
      break;
    }
  }
  if (airBlock) airBlock.kind = 'airport';
  const airfield = (i, j) => {
    if (!airBlock) return false;
    if (airSide === 'east') return i >= N && Math.abs(j - airBlock.j) <= 3;
    if (airSide === 'west') return i < 0 && Math.abs(j - airBlock.j) <= 3;
    if (airSide === 'north') return j < 0 && Math.abs(i - airBlock.i) <= 3;
    return j >= N && Math.abs(i - airBlock.i) <= 3;
  };
  for (const b of blocks) if (b.kind === 'build') makeLots(b, rng);

  // --- 2. Assign places to street-facing lots -------------------------------
  const places = [];
  const reserved = []; // sidewalk spots props must keep clear
  const wanted = [];
  for (const d of districts) wanted.push({ type: 'home', name: `${d.name} Residences`, district: d.id, id: 'home_' + d.id });
  for (const p of cfg.places) wanted.push({ ...p, id: p.id || p.type });
  // a grand hotel in the priciest district (where you stay when visiting)
  wanted.push({ type: 'hotel', name: cfg.hotel || `Grand ${cfg.name} Hotel`, district: [...districts].sort((a, c) => c.rentMul - a.rentMul)[0].id, id: 'hotel' });
  for (const d of districts) {
    const mine = wanted.filter((p) => p.district === d.id);
    const order = shuffle(rng, blocks.filter((b) => b.district === d && b.kind === 'build')).sort(
      (a, b2) => Math.hypot(a.cx - d.cx, a.cz - d.cz) + rng() * 30 - (Math.hypot(b2.cx - d.cx, b2.cz - d.cz) + rng() * 30),
    );
    mine.forEach((p, n) => {
      for (let tries = 0; tries < order.length; tries++) {
        const b = order[(n + tries) % order.length];
        const lot = shuffle(rng, b.lots).find((l) => l.sides.length && !l.place && l.x1 - l.x0 >= 7);
        if (!lot) continue;
        const side = pick(rng, lot.sides);
        const [nx, nz] = NORMALS[side];
        const mx = (lot.x0 + lot.x1) / 2;
        const mz = (lot.z0 + lot.z1) / 2;
        const fx = nx ? (nx > 0 ? lot.x1 : lot.x0) : mx; // facade centre
        const fz = nz ? (nz > 0 ? lot.z1 : lot.z0) : mz;
        const meta = PLACE_TYPES[p.type];
        const place = {
          id: p.id, type: p.type, name: p.name, district: d, icon: meta.icon, color: meta.color, label: meta.label,
          nx, nz, doorX: fx, doorZ: fz, x: fx + nx * 1.6, z: fz + nz * 1.6, lot,
        };
        lot.place = place;
        lot.side = side;
        places.push(place);
        reserved.push({ x: fx + nx * 4, z: fz + nz * 4 });
        break;
      }
    });
  }

  // --- 2b. Neighbourhood businesses on the remaining street-facing lots ---------
  const usedNames = new Set(places.map((p) => p.name));
  for (const b of blocks) {
    if (b.kind !== 'build') continue;
    const style = b.district.style;
    const max = b.style.lots === 'houses' ? 1 : 3;
    let count = 0;
    for (const lot of shuffle(rng, b.lots)) {
      if (count >= max) break;
      if (lot.place || !lot.sides.length || lot.empty || rng() > 0.55) continue;
      const side = pick(rng, lot.sides);
      const [nx, nz] = NORMALS[side];
      if ((nz ? lot.x1 - lot.x0 : lot.z1 - lot.z0) < 7.5) continue;
      // what kind of business suits this part of town
      const mix = STYLE_MIX[style] || {};
      let total = 0;
      for (const id of SHOP_IDS) total += SHOP_TYPES[id].weight * (mix[id] || 1);
      let r = rng() * total;
      let type = SHOP_IDS[0];
      for (const id of SHOP_IDS) {
        r -= SHOP_TYPES[id].weight * (mix[id] || 1);
        if (r <= 0) {
          type = id;
          break;
        }
      }
      const pool = SHOP_TYPES[type].names;
      let name = pool[Math.floor(rng() * pool.length)];
      for (let k = 0; k < pool.length && usedNames.has(name); k++) name = pool[(pool.indexOf(name) + 1) % pool.length];
      for (const sfx of [b.district.name, 'Uptown', 'Downtown', 'Express', '& Co.', 'II', 'No. 3']) {
        if (!usedNames.has(name)) break;
        name = `${pool[Math.floor(rng() * pool.length)]} ${sfx}`;
      }
      usedNames.add(name);
      const mx = (lot.x0 + lot.x1) / 2;
      const mz = (lot.z0 + lot.z1) / 2;
      const fx = nx ? (nx > 0 ? lot.x1 : lot.x0) : mx;
      const fz = nz ? (nz > 0 ? lot.z1 : lot.z0) : mz;
      const meta = PLACE_TYPES[type];
      const place = {
        id: `shop_${b.i}_${b.j}_${count}`, type, name, district: b.district, icon: meta.icon, color: meta.color, label: meta.label, minor: true,
        nx, nz, doorX: fx, doorZ: fz, x: fx + nx * 1.6, z: fz + nz * 1.6, lot,
      };
      lot.place = place;
      lot.side = side;
      places.push(place);
      reserved.push({ x: fx + nx * 4, z: fz + nz * 4 });
      count++;
    }
  }

  // --- 3. Buildings ------------------------------------------------------------
  const batch = new BuildingBatch();
  const roofGeo = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]), { depth: 1, bevelEnabled: false });
  roofGeo.translate(0, 0, -0.5);
  const roofs = new InstanceBatch(roofGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), { castShadow: true });
  const plain = { type: FACADE.PLAIN };

  const addBuilding = (x0, z0, x1, z1, h, st, isPlace, over) => {
    const w = x1 - x0;
    const d = z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const color = over?.color || pick(rng, st.palette);
    const type = FACADE_ID[over?.facade || pick(rng, st.facade)] ?? FACADE.MASONRY;
    if (over?.tiers) st = { ...st, tiers: true };
    const style = { floorH: st.floorH * (0.95 + rng() * 0.1), bay: st.bay * (0.9 + rng() * 0.25), seed: rng() * 100, type };
    batch.add(cx, cz, w, d, h, color, style);
    colliders.add(x0, z0, x1, z1, h);
    if (st.tiers && h > 80 && rng() < 0.75) {
      const h2 = h * (0.18 + rng() * 0.2);
      batch.add(cx, cz, w * 0.72, d * 0.72, h2, color, style, h);
      if (rng() < 0.5) {
        batch.add(cx, cz, w * 0.42, d * 0.42, h2 * 0.7, color, style, h + h2);
        if (rng() < 0.6) batch.add(cx, cz, 0.8, 0.8, 18 + rng() * 14, '#9aa3ad', plain, h + h2 * 1.7);
      }
    } else if (h > 9 && !isPlace) {
      batch.add(cx + (rng() - 0.5) * w * 0.3, cz + (rng() - 0.5) * d * 0.3, w * 0.34, d * 0.3, 2.4, '#8a8d92', plain, h);
    }
    return { cx, cz, w, d, color };
  };

  for (const b of blocks) {
    if (b.kind !== 'build') continue;
    const st = b.style;
    const hm = b.district.heightMul || 1;
    const [h0, h1] = st.heights;
    for (const lot of b.lots) {
      if (lot.empty) continue;
      let h = (h0 + (h1 - h0) * Math.pow(rng(), 1.7)) * hm;
      // some places have a building of their own (bank tower, hospital, mall...)
      const over = lot.place ? PLACE_TYPES[lot.place.type].look?.building : null;
      if (lot.place) h = Math.max(h, 9);
      if (over) h = over.minH + (over.maxH - over.minH) * rng();
      lot.h = h;
      if (st.lots === 'houses' && !lot.place) {
        // detached house with a pitched roof, set back behind a small yard
        const w = 10 + rng() * 2.5;
        const d = 9 + rng() * 2;
        const [nx, nz] = NORMALS[lot.sides[0] || 'n'];
        const mx = (lot.x0 + lot.x1) / 2;
        const mz = (lot.z0 + lot.z1) / 2;
        const cx = mx + nx * ((lot.x1 - lot.x0) / 2 - w / 2 - 2.5);
        const cz = mz + nz * ((lot.z1 - lot.z0) / 2 - d / 2 - 2.5);
        addBuilding(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, h, { ...st, tiers: false }, true);
        const alongX = nz !== 0;
        roofs.add(cx, h, cz, { sx: (alongX ? d : w) + 0.8, sy: 2.6 + rng(), sz: (alongX ? w : d) + 0.8, ry: alongX ? Math.PI / 2 : 0, color: pick(rng, st.roofs) });
      } else {
        const gap = st.lots === 'tower' ? 1.2 : st.lots === 'rows' ? 0 : 0.35;
        const x0 = lot.x0 + (lot.sides.includes('w') ? 0 : gap);
        const x1 = lot.x1 - (lot.sides.includes('e') ? 0 : gap);
        const z0 = lot.z0 + (lot.sides.includes('n') ? 0 : gap);
        const z1 = lot.z1 - (lot.sides.includes('s') ? 0 : gap);
        addBuilding(x0, z0, x1, z1, h, st, !!lot.place, over);
        if (st.lots === 'rows' && !lot.place) {
          // brownstone stoop
          const [nx, nz] = NORMALS[lot.sides[0]];
          const sx = (x0 + x1) / 2 + nx * ((x1 - x0) / 2 + 0.7) + (nz ? 1.6 : 0);
          const sz = (z0 + z1) / 2 + nz * ((z1 - z0) / 2 + 0.7) + (nx ? 1.6 : 0);
          batch.add(sx, sz, nz ? 2 : 1.4, nz ? 1.4 : 2, 1.1, '#9a938a', plain, K.CURB);
          colliders.add(sx - (nz ? 1 : 0.7), sz - (nz ? 0.7 : 1), sx + (nz ? 1 : 0.7), sz + (nz ? 0.7 : 1), 1.25);
        }
      }
    }
  }

  // --- 4. Backdrop skyline beyond the playable area ------------------------
  const allBlocks = blocks.slice();
  const ring = 2;
  const back = { palette: ['#9aa3ad', '#b0a595', '#8f98a5', '#a8a096', '#7f8a99', '#b9b2a6'], facade: ['masonry', 'glass'], floorH: 3.5, bay: 3, tiers: false };
  for (let j = -ring; j < N + ring; j++) {
    for (let i = -ring; i < N + ring; i++) {
      if (i >= 0 && i < N && j >= 0 && j < N) continue;
      if (airfield(i, j)) continue; // open land for the runway
      if ((water.west && i < 0) || (water.east && i >= N) || (water.north && j < 0) || (water.south && j >= N)) continue;
      const x0 = blockMin(i);
      const z0 = blockMin(j);
      allBlocks.push({ cx: x0 + K.BLOCK / 2, cz: z0 + K.BLOCK / 2, backdrop: true });
      const near = i >= -1 && i <= N && j >= -1 && j <= N;
      const s = K.SIDEWALK;
      const half2 = (K.BLOCK - 2 * s) / 2;
      for (let a = 0; a < 2; a++) {
        for (let c = 0; c < 2; c++) {
          const bx0 = x0 + s + a * half2;
          const bz0 = z0 + s + c * half2;
          const h = near ? 14 + rng() * 50 : 10 + rng() * 34;
          const color = pick(rng, back.palette);
          batch.add(bx0 + half2 / 2, bz0 + half2 / 2, half2 - 0.6, half2 - 0.6, h, color, { floorH: 3.5, bay: 3, seed: rng() * 100, type: rng() < 0.3 ? FACADE.GLASS : FACADE.MASONRY });
        }
      }
    }
  }

  const ctx = { cfg, rng, N, half, total, K, blockMin, roadCenter, blocks, allBlocks, group, colliders, places, reserved, water, districts, batch, season: opts.season, bridgeSpec: bridge, beachSpec: beach };

  // --- 5. Landmarks, roads, props -------------------------------------------
  buildLandmarks(ctx);
  if (campusBlock) buildCampus(ctx, campusBlock);
  if (schoolBlock) buildSchool(ctx, schoolBlock);
  if (airBlock) buildAirport(ctx, airBlock, airSide);
  addRooftops(ctx);
  group.add(batch.build());
  const rm = roofs.build();
  if (rm) group.add(rm);
  buildRoads(ctx);

  // Transit entrance per district, on the sidewalk of the block nearest its centre.
  const transit = cfg.transit || { name: 'Transit', icon: '🚇' };
  for (const d of districts) {
    const b = blocks.filter((bl) => bl.district === d).sort((a, c) => Math.hypot(a.cx - d.cx, a.cz - d.cz) - Math.hypot(c.cx - d.cx, c.cz - d.cz))[0];
    // face the road on the side toward the district centre
    const south = d.cz > b.cz;
    const nz = south ? 1 : -1;
    const x = b.cx + 14;
    const z = b.cz + nz * (K.BLOCK / 2 - 2.1);
    buildStation(ctx, x, z, south ? 0 : Math.PI, PLACE_TYPES.station.color);
    reserved.push({ x, z }, { x: x - 3, z }, { x: x + 3, z });
    places.push({
      id: 'station_' + d.id, type: 'station', name: `${d.name} ${transit.name}`, district: d, icon: transit.icon || '🚇',
      color: PLACE_TYPES.station.color, label: transit.name, nx: 0, nz: -nz, doorX: x, doorZ: z, x, z: z - nz * 1.9, station: true,
    });
  }

  buildProps(ctx);
  decorateParks(ctx);
  if (beach) buildBeach(ctx, beach);
  buildFoodCarts(ctx);
  if (zooBlock) buildZoo(ctx, zooBlock);
  if (bridge) buildBridge(ctx, bridge);
  buildStreetscape(ctx);
  decoratePlaces(ctx);
  const fronts = buildStorefronts(ctx);

  // --- 6. Queries ---------------------------------------------------------------
  const inBlockAxis = (v) => {
    const local = v + half - K.ROAD;
    const i = Math.floor(local / K.PITCH);
    return i >= 0 && i < N && local - i * K.PITCH <= K.BLOCK;
  };
  /** Ground height: kerb-high on sidewalks/blocks and the promenade, 0 on roads. */
  const groundY = (x, z) => {
    if (bridge) {
      const d = onWalkway(bridge, x, z);
      if (d >= 0) return deckY(d, K.CURB);
    }
    if (beach) {
      const y = beachY(beach, x, z);
      if (y != null) return y;
    }
    if (Math.abs(x) > half || Math.abs(z) > half) return K.CURB;
    return inBlockAxis(x) && inBlockAxis(z) ? K.CURB : 0;
  };

  const home = places.find((p) => p.type === 'home');
  const city = {
    cfg, group, colliders, places, districts, blocks, K, N, half, blockMin, roadCenter, groundY, districtAt, water,
    lampPositions: ctx.lampPositions, benchSpots: ctx.benchSpots, busStops: ctx.busStops || [], zoo: ctx.zoo || null, campus: ctx.campus || null, school: ctx.school || null, airport: ctx.airport || null, bridge: ctx.bridge || null, timesSquare: ctx.timesSquare || null, beach: ctx.beach || null, sitters: ctx.sitters || [], bikeDocks: ctx.bikeDocks || [], landmarks: ctx.landmarks || [], vendors: ctx.vendors, buskers: ctx.buskers,
    placeById: Object.fromEntries(places.map((p) => [p.id, p])),
    spawn: { x: home.x, z: home.z, ry: Math.atan2(home.nx, home.nz) },
    /** Traffic signal phase shared with the traffic sim. Returns 'ns' | 'ew' | 'ns_y' | 'ew_y'. */
    signalPhase(t) {
      const p = t % 28;
      return p < 12 ? 'ns' : p < 14 ? 'ns_y' : p < 26 ? 'ew' : 'ew_y';
    },
    update(elapsed, night, px, pz) {
      // distance culling for chunked props (parked cars)
      if (px != null) for (const l of ctx.lod || []) l.mesh.visible = (l.x - px) ** 2 + (l.z - pz) ** 2 < (l.r + 240) ** 2;
      // the bridge's lamps and cable lights come on at dusk
      for (const m of ctx.bridge?.glow || []) m.emissiveIntensity = 0.15 + night * 2.6;
      const ph = this.signalPhase(elapsed);
      if (ph !== this._ph) {
        this._ph = ph;
        const m = ctx.signalMats;
        const set = (k, on, c) => m[k].color.set(on ? c : '#1c1c1c');
        set('nsgreen', ph === 'ns', '#3dff7a');
        set('nsyellow', ph === 'ns_y', '#ffd23d');
        set('nsred', ph === 'ew' || ph === 'ew_y', '#ff3b30');
        set('ewgreen', ph === 'ew', '#3dff7a');
        set('ewyellow', ph === 'ew_y', '#ffd23d');
        set('ewred', ph === 'ns' || ph === 'ns_y', '#ff3b30');
      }
      ctx.poolMat.opacity = night * 0.42;
      ctx.lampMat.color.setRGB(0.05 + night * 2.2, 0.045 + night * 1.7, 0.035 + night * 1.0);
      for (const f of ctx.animated) f(elapsed);
      fronts.update(night);
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (m.userData.ownMap && m.map) m.map.dispose();
            m.dispose();
          }
        }
      });
    },
  };
  return city;
}

/** Split a block's buildable area into lots according to its district style. */
function makeLots(b, rng) {
  const s = K.SIDEWALK;
  const x0 = b.x0 + s;
  const z0 = b.z0 + s;
  const x1 = b.x1 - s;
  const z1 = b.z1 - s;
  const st = b.style;
  const grid = (nx, nz) => {
    const w = (x1 - x0) / nx;
    const d = (z1 - z0) / nz;
    for (let a = 0; a < nx; a++) {
      for (let c = 0; c < nz; c++) {
        const sides = [];
        if (c === 0) sides.push('n');
        if (c === nz - 1) sides.push('s');
        if (a === 0) sides.push('w');
        if (a === nx - 1) sides.push('e');
        b.lots.push({ x0: x0 + a * w, z0: z0 + c * d, x1: x0 + (a + 1) * w, z1: z0 + (c + 1) * d, sides, block: b });
      }
    }
  };
  if (st.lots === 'tower') {
    const r = rng();
    if (r < 0.22) grid(1, 1);
    else if (r < 0.5) rng() < 0.5 ? grid(2, 1) : grid(1, 2);
    else grid(2, 2);
  } else if (st.lots === 'rows') {
    const n = 6;
    const w = (x1 - x0) / n;
    const depth = 17;
    for (let a = 0; a < n; a++) {
      b.lots.push({ x0: x0 + a * w, z0, x1: x0 + (a + 1) * w, z1: z0 + depth, sides: ['n'], block: b });
      b.lots.push({ x0: x0 + a * w, z0: z1 - depth, x1: x0 + (a + 1) * w, z1, sides: ['s'], block: b });
    }
    b.grass = [{ x: b.cx, z: b.cz, w: x1 - x0, d: z1 - z0 - depth * 2 }];
    b.yardTrees = [
      { x: b.cx - 12, z: b.cz },
      { x: b.cx + 10, z: b.cz + 2 },
    ];
  } else if (st.lots === 'houses') {
    grid(3, 3);
    const mid = b.lots.find((l) => l.sides.length === 0);
    if (mid) mid.empty = true;
    b.grass = [{ x: b.cx, z: b.cz, w: x1 - x0, d: z1 - z0 }];
    b.yardTrees = [
      { x: b.cx - 3, z: b.cz + 2 },
      { x: b.cx + 4, z: b.cz - 3 },
    ];
  } else {
    const [gx, gz] = st.grid || [2, 2];
    rng() < 0.5 ? grid(gx, gz) : grid(gz, gx);
  }
}

/** Doors, awnings, signs and floating markers for every enterable place. */
function decoratePlaces(ctx) {
  const { group, places, K: KK } = ctx;
  const signGeo = new THREE.PlaneGeometry(5, 1.25);
  ctx.markers = [];
  for (const p of places) {
    const ry = Math.atan2(p.nx, p.nz);
    // shops, offices and homes get full storefronts (world/Storefronts.js); stations keep a two-sided sign
    if (p.station) {
      const mat = new THREE.MeshBasicMaterial({ map: labelTexture(p.name, { icon: p.icon, accent: p.color }), toneMapped: false });
      mat.userData.ownMap = true;
      const sign = new THREE.Mesh(signGeo, mat);
      sign.scale.setScalar(0.7);
      sign.position.set(p.doorX, KK.CURB + 3.6, p.doorZ);
      sign.rotation.y = ry;
      group.add(sign);
      const back = sign.clone();
      back.rotation.y = ry + Math.PI;
      group.add(back);
    }
    const mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(p.icon, p.color), transparent: true, depthWrite: false, fog: false }));
    mk.scale.setScalar(1.7);
    mk.position.set(p.doorX + p.nx * 1.2, KK.CURB + (p.station ? 5.4 : 8.6), p.doorZ + p.nz * 1.2);
    group.add(mk);
    p.marker = mk;
    ctx.markers.push(mk);
  }
}
