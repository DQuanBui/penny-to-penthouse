// Street furniture: lamps (with fake light pools), trees, benches, traffic
// lights, parks and transit entrances. Everything is instanced.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Tex } from './Textures.js';
import { InstanceBatch } from './Buildings.js';
import { pick } from '../core/utils.js';
import { fadeOccluders } from './OccluderFade.js';

const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cyl = (r0, r1, h, x = 0, y = 0, z = 0, seg = 8) => new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z);

const LEAF = ['#4f8f3f', '#5fa04a', '#3f7f3a', '#6aa84f', '#4a9050'];
const LEAF_FALL = ['#d98a2b', '#c8642a', '#e0a83a', '#b5522a', '#d9b23a'];
const BLOSSOM = ['#f4b6c8', '#f8c8d8', '#eaa0b8', '#fbe0e8', '#f0a8c0'];
const BANNER_COLORS = ['#b5343c', '#2f5aa3', '#3f6e4a', '#7a3fd0', '#c9a24a', '#2f8f8f'];

/** A district's lamp-post banner: its name down a coloured strip. */
function bannerTexture(name, color) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 288;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 288);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(8, 8, 112, 6);
  g.fillRect(8, 274, 112, 6);
  g.save();
  g.translate(64, 144);
  g.rotate(-Math.PI / 2);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 44;
  g.font = `800 ${size}px Outfit,"Segoe UI",sans-serif`;
  while (g.measureText(name.toUpperCase()).width > 250 && size > 18) g.font = `800 ${(size -= 3)}px Outfit,"Segoe UI",sans-serif`;
  g.fillStyle = '#ffffff';
  g.fillText(name.toUpperCase(), 0, 2);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Side descriptors for a block: outward normal + tangent. */
const SIDES = [
  { id: 'n', nx: 0, nz: -1 },
  { id: 's', nx: 0, nz: 1 },
  { id: 'w', nx: -1, nz: 0 },
  { id: 'e', nx: 1, nz: 0 },
];

export function buildProps(ctx) {
  const { group, colliders, rng, cfg, K } = ctx;
  const { BLOCK } = K;
  const Y = K.CURB;
  const palm = cfg.treeType === 'palm';

  const metal = new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.5, metalness: 0.6 });
  const lampGeo = mergeGeometries([cyl(0.07, 0.1, 6, 0, 3, 0), box(0.08, 0.08, 1.7, 0, 5.95, 0.8), box(0.34, 0.12, 0.7, 0, 5.9, 1.5)]);
  const lamps = new InstanceBatch(lampGeo, metal, { castShadow: true });
  ctx.lampMat = new THREE.MeshBasicMaterial({ color: '#40382c' });
  const bulbs = new InstanceBatch(box(0.26, 0.06, 0.56), ctx.lampMat);
  const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  ctx.poolMat = new THREE.MeshBasicMaterial({
    map: Tex.glow(),
    color: '#ffc980',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pools = new InstanceBatch(poolGeo, ctx.poolMat);

  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.9 });
  const trunks = new InstanceBatch(palm ? cyl(0.13, 0.2, 1, 0, 0.5, 0, 6) : cyl(0.14, 0.22, 1, 0, 0.5, 0, 6), trunkMat, { castShadow: true });
  const leafMat = fadeOccluders(new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }));
  let leafGeo;
  if (palm) {
    const fronds = [];
    for (let i = 0; i < 8; i++) {
      const f = box(0.5, 0.06, 2.6, 0, 0, 1.3);
      f.rotateX(0.45);
      f.rotateY((i / 8) * Math.PI * 2);
      fronds.push(f);
    }
    leafGeo = mergeGeometries(fronds);
  } else {
    leafGeo = new THREE.IcosahedronGeometry(1, 1);
  }
  const leaves = new InstanceBatch(leafGeo, leafMat, { castShadow: true });
  ctx.leafBatchColors = [];

  const benchGeo = mergeGeometries([
    box(1.7, 0.07, 0.5, 0, 0.45, 0),
    box(1.7, 0.45, 0.07, 0, 0.75, -0.24),
    box(0.08, 0.45, 0.45, -0.75, 0.22, 0),
    box(0.08, 0.45, 0.45, 0.75, 0.22, 0),
  ]);
  const benches = new InstanceBatch(benchGeo, new THREE.MeshStandardMaterial({ color: '#7a5a3c', roughness: 0.8 }), { castShadow: true });
  ctx.benchSpots ||= [];

  // snowy-winter cities get white lawns
  const snowy = ctx.season === 'winter' && cfg.weather?.snowInWinter;
  const grass = new InstanceBatch(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    snowy ? new THREE.MeshStandardMaterial({ color: '#eef2f6', roughness: 0.9 }) : new THREE.MeshStandardMaterial({ map: Tex.grass(), roughness: 1 }),
    { receiveShadow: true },
  );
  const paths = new InstanceBatch(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#cfc3a8', roughness: 1 }), {
    receiveShadow: true,
  });
  const stone = new THREE.MeshStandardMaterial({ color: '#b9b4aa', roughness: 0.8 });
  const fountains = new InstanceBatch(mergeGeometries([cyl(3.2, 3.4, 0.6, 0, 0.3, 0, 20), cyl(0.35, 0.5, 1.8, 0, 0.9, 0, 10), cyl(1.1, 0.3, 0.25, 0, 1.85, 0, 14)]), stone, {
    castShadow: true,
  });
  const waterDisc = new InstanceBatch(cyl(2.9, 2.9, 0.05, 0, 0.56, 0, 20), new THREE.MeshStandardMaterial({ color: '#4fa3d1', roughness: 0.1, metalness: 0.3 }));

  ctx.lampPositions = [];
  const banners = {}; // district id -> { d, geos }
  const season = ctx.season || 'spring';
  const leafPal = season === 'fall' && !palm ? LEAF_FALL : LEAF;

  const addTree = (x, z, scale = 1) => {
    if (palm) {
      const h = (6.5 + rng() * 3) * scale;
      trunks.add(x, Y, z, { sy: h });
      leaves.add(x, Y + h, z, { ry: rng() * 6, sx: scale, sy: scale, sz: scale, color: pick(rng, ['#3f8f4a', '#4a9a52', '#5aa85a']) });
    } else {
      const h = (2.2 + rng() * 1.2) * scale;
      trunks.add(x, Y, z, { sy: h });
      const r = (1.5 + rng() * 0.8) * scale;
      const bare = season === 'winter' && cfg.weather?.snowInWinter;
      if (!bare) {
        const blossom = season === 'spring' && !palm && rng() < 0.22;
        const pal = blossom ? BLOSSOM : leafPal;
        leaves.add(x, Y + h + r * 0.55, z, { sx: r, sy: r * 0.9, sz: r, ry: rng() * 6, color: pick(rng, pal) });
        leaves.add(x + (rng() - 0.5) * r, Y + h + r * 1.1, z + (rng() - 0.5) * r, { sx: r * 0.7, sy: r * 0.65, sz: r * 0.7, ry: rng() * 6, color: pick(rng, pal) });
      } else {
        // bare winter branches: a thin crown
        leaves.add(x, Y + h + r * 0.4, z, { sx: r * 0.5, sy: r * 0.7, sz: r * 0.5, ry: rng() * 6, color: '#7a6a5a' });
      }
    }
    colliders.add(x - 0.25, z - 0.25, x + 0.25, z + 0.25, 3);
  };
  ctx.addTree = addTree;

  const addBench = (x, z, ry) => {
    benches.add(x, Y, z, { ry });
    const hw = Math.abs(Math.cos(ry)) > 0.5 ? 0.85 : 0.3;
    const hd = Math.abs(Math.cos(ry)) > 0.5 ? 0.3 : 0.85;
    colliders.add(x - hw, z - hd, x + hw, z + hd, 0.9);
    ctx.benchSpots.push({ x, z, ry });
  };

  const clear = (x, z, r = 3.2) => {
    for (const p of ctx.reserved) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) return false;
    return true;
  };

  // --- Street lamps / trees / benches along every block edge ----------------
  for (const b of ctx.blocks) {
    const density = b.style.trees ?? 0.7;
    for (const s of SIDES) {
      // skip props on the water side promenade edge? no: keep streets consistent
      const ex = b.cx + s.nx * (BLOCK / 2 - 1.0);
      const ez = b.cz + s.nz * (BLOCK / 2 - 1.0);
      const tx = -s.nz;
      const tz = s.nx;
      for (const t of [-22, -11, 0, 11, 22]) {
        const x = ex + tx * t;
        const z = ez + tz * t;
        if (!clear(x, z)) continue;
        if (t === -11 || t === 11) {
          const ry = Math.atan2(s.nx, s.nz);
          lamps.add(x, Y, z, { ry });
          if (!b.backdrop) {
            const d = b.district;
            const list = (banners[d.id] ||= { d, geos: [] });
            for (const sgn of [1, -1]) {
              const p = new THREE.PlaneGeometry(0.5, 1.15).rotateY((sgn * Math.PI) / 2).translate(sgn * 0.025, 4.1, 0.38);
              p.rotateY(ry).translate(x, Y, z);
              list.geos.push(p);
            }
          }
          const hx = x + s.nx * 1.5;
          const hz = z + s.nz * 1.5;
          bulbs.add(hx, Y + 5.82, hz, { ry });
          pools.add(hx, 0.22, hz, { sx: 13, sz: 13 });
          colliders.add(x - 0.12, z - 0.12, x + 0.12, z + 0.12, 6);
          ctx.lampPositions.push(hx, hz);
        } else if (rng() < density) {
          addTree(x, z);
        }
      }
      if (rng() < 0.22) {
        const t = rng() < 0.5 ? -5.5 : 5.5;
        const x = ex + tx * t - s.nx * 0.2;
        const z = ez + tz * t - s.nz * 0.2;
        if (clear(x, z, 4)) addBench(x, z, Math.atan2(-s.nx, -s.nz));
      }
    }

    // --- Parks, courtyards and yards ---------------------------------------
    if (b.kind === 'park') {
      const inner = BLOCK - 2 * K.SIDEWALK; // lawn inside a full sidewalk ring
      grass.add(b.cx, Y + 0.012, b.cz, { sx: inner, sz: inner });
      paths.add(b.cx, Y + 0.02, b.cz, { sx: inner, sz: 2.4 });
      paths.add(b.cx, Y + 0.02, b.cz, { sx: 2.4, sz: inner });
      fountains.add(b.cx, Y, b.cz);
      waterDisc.add(b.cx, Y, b.cz);
      colliders.add(b.cx - 3.2, b.cz - 3.2, b.cx + 3.2, b.cz + 3.2, 0.9);
      for (let i = 0; i < 22; i++) {
        const x = b.cx + (rng() - 0.5) * (inner - 6);
        const z = b.cz + (rng() - 0.5) * (inner - 6);
        if (Math.abs(x - b.cx) < 3 || Math.abs(z - b.cz) < 3) continue;
        // the south half holds the playground and picnic area (world/Parks.js)
        if (z - b.cz > 4 && Math.abs(x - b.cx) > 4 && Math.abs(x - b.cx) < 22) continue;
        // and the north lawn is kept open for markets and concerts (world/CityEvents.js)
        if (z - b.cz > -18 && z - b.cz < -4 && Math.abs(x - b.cx) < 21) continue;
        addTree(x, z, 1.15);
      }
      for (const [dx, dz, ry] of [
        [6, 2.2, Math.PI],
        [-6, -2.2, 0],
        [2.2, -6, -Math.PI / 2],
        [-2.2, 6, Math.PI / 2],
      ]) addBench(b.cx + dx, b.cz + dz, ry);
      for (const [dx, dz] of [
        [9, 9],
        [-9, -9],
      ]) {
        lamps.add(b.cx + dx, Y, b.cz + dz, { ry: Math.atan2(-dx, -dz) });
        bulbs.add(b.cx + dx * 0.86, Y + 5.82, b.cz + dz * 0.86);
        pools.add(b.cx + dx * 0.86, 0.22, b.cz + dz * 0.86, { sx: 13, sz: 13 });
        ctx.lampPositions.push(b.cx + dx * 0.86, b.cz + dz * 0.86);
      }
    } else if (b.grass) {
      for (const g of b.grass) grass.add(g.x, Y + 0.012, g.z, { sx: g.w, sz: g.d });
      for (const t of b.yardTrees || []) addTree(t.x, t.z, 0.9);
    }
  }

  // --- Waterfront promenade dressing ------------------------------------------
  const { half, water } = ctx;
  const promSides = [
    ['north', 0, -1],
    ['south', 0, 1],
    ['west', -1, 0],
    ['east', 1, 0],
  ];
  for (const [side, nx, nz] of promSides) {
    if (!water[side]) continue;
    for (let t = -half + 12; t <= half - 12; t += 18) {
      const x = nx ? nx * (half + K.PROM * 0.45) : t;
      const z = nz ? nz * (half + K.PROM * 0.45) : t;
      addTree(x, z, palm ? 1 : 0.9);
      const bx = nx ? nx * (half + K.PROM - 2.2) : t + 9;
      const bz = nz ? nz * (half + K.PROM - 2.2) : t + 9;
      addBench(bx, bz, Math.atan2(nx, nz));
    }
  }

  // --- Traffic lights at interior intersections ------------------------------
  const tl = new InstanceBatch(mergeGeometries([cyl(0.08, 0.1, 5.2, 0, 2.6, 0), box(0.34, 1.0, 0.3, 0, 4.7, 0.2)]), metal, { castShadow: true });
  const sph = new THREE.SphereGeometry(0.11, 6, 4);
  ctx.signalMats = {};
  const lights = {};
  for (const g of ['ns', 'ew']) {
    for (const c of ['red', 'yellow', 'green']) {
      const mat = new THREE.MeshBasicMaterial({ color: '#222' });
      ctx.signalMats[g + c] = mat;
      lights[g + c] = new InstanceBatch(sph, mat);
    }
  }
  const off = K.ROAD / 2 + 0.7;
  for (let i = 1; i < ctx.N; i++) {
    for (let j = 1; j < ctx.N; j++) {
      const cx = ctx.roadCenter(i);
      const cz = ctx.roadCenter(j);
      // [dx, dz, facing angle, group]
      const corners = [
        [off, off, Math.PI, 'ns'],
        [-off, -off, 0, 'ns'],
        [off, -off, -Math.PI / 2, 'ew'],
        [-off, off, Math.PI / 2, 'ew'],
      ];
      for (const [dx, dz, ry, g] of corners) {
        const x = cx + dx;
        const z = cz + dz;
        tl.add(x, Y, z, { ry });
        const fx = Math.sin(ry) * 0.36;
        const fz = Math.cos(ry) * 0.36;
        lights[g + 'red'].add(x + fx, Y + 5.0, z + fz);
        lights[g + 'yellow'].add(x + fx, Y + 4.7, z + fz);
        lights[g + 'green'].add(x + fx, Y + 4.4, z + fz);
        colliders.add(x - 0.12, z - 0.12, x + 0.12, z + 0.12, 5);
      }
    }
  }

  for (const { d, geos } of Object.values(banners)) {
    const mat = new THREE.MeshStandardMaterial({ map: bannerTexture(d.name, BANNER_COLORS[d.index % BANNER_COLORS.length]), roughness: 0.8, side: THREE.DoubleSide });
    mat.userData.ownMap = true;
    group.add(new THREE.Mesh(mergeGeometries(geos), mat));
  }
  for (const b of [lamps, bulbs, trunks, leaves, benches, grass, paths, fountains, waterDisc, tl, ...Object.values(lights)]) {
    const m = b.build();
    if (m) group.add(m);
  }
  const pm = pools.build();
  if (pm) {
    pm.renderOrder = 2;
    group.add(pm);
  }
}

/** Transit entrance: canopy, sign posts and a dark stairwell pad. */
/** Stair geometry shared by the stairwell and groundY: top at local x = +1.8, landing below. */
export const WELL = { top: 1.8, foot: -1.0, end: -1.8, half: 0.95, drop: 3.0 };

/** Ground height inside a subway stairwell (local x), or null outside it. */
export function wellY(w, x, z) {
  const c = Math.cos(w.ry);
  const s = Math.sin(w.ry);
  const dx = x - w.x;
  const dz = z - w.z;
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  if (lx > WELL.top || lx < WELL.end || Math.abs(lz) > WELL.half) return null;
  return lx >= WELL.foot ? -((WELL.top - lx) / (WELL.top - WELL.foot)) * WELL.drop : -WELL.drop;
}

/**
 * A New York style subway entrance: an open stairwell going down below the
 * sidewalk, green railings on three sides, globe lamps at the top of the steps.
 * The sidewalk can't really have a hole in it, so a "punch" quad drawn right
 * after the ground resets the depth buffer over the opening and the stairwell
 * (drawn later) shows through.
 */
function subwayEntrance(ctx, g, color) {
  const W = WELL;
  const cream = new THREE.MeshStandardMaterial({ color: '#d9d2bf', roughness: 0.8, side: THREE.DoubleSide });
  // the well: side walls, the far wall, a floor, and a ceiling only over the tunnel
  // (no lid over the opening, or it would hide the sky from inside)
  const X0 = -4.6;
  const H = W.drop + 1;
  const len = W.top - X0;
  const shell = [];
  for (const s of [-1, 1]) shell.push(new THREE.PlaneGeometry(len, H).translate((W.top + X0) / 2, -H / 2, s * (W.half + 0.02)));
  shell.push(new THREE.PlaneGeometry(W.half * 2 + 0.04, H).rotateY(Math.PI / 2).translate(X0, -H / 2, 0));
  shell.push(new THREE.PlaneGeometry(len, W.half * 2 + 0.04).rotateX(-Math.PI / 2).translate((W.top + X0) / 2, -H, 0));
  shell.push(new THREE.PlaneGeometry(W.end - X0, W.half * 2 + 0.04).rotateX(Math.PI / 2).translate((W.end + X0) / 2, -0.02, 0));
  const well = new THREE.Mesh(mergeGeometries(shell), cream);
  well.receiveShadow = true;
  g.add(well);
  const parts = [];
  const cols = [];
  const add = (geo, c) => {
    parts.push(geo.index ? geo.toNonIndexed() : geo);
    cols.push([c, geo.index ? geo.index.count : geo.attributes.position.count]);
  };
  const n = 10;
  const run = (W.top - W.foot) / n;
  const rise = W.drop / n;
  for (let k = 0; k < n; k++) {
    const x0 = W.top - k * run;
    const top = -(k + 1) * rise;
    add(new THREE.BoxGeometry(run, W.drop + 1 + top, W.half * 2).translate(x0 - run / 2, (top - W.drop - 1) / 2, 0), '#8a8d92');
    add(new THREE.BoxGeometry(0.06, 0.012, W.half * 2).translate(x0 - run + 0.03, top + 0.006, 0), '#e9c04c');
    // a darker riser face so each step reads from above
    add(new THREE.BoxGeometry(0.012, rise, W.half * 2 - 0.02).translate(x0 + 0.006, top + rise / 2, 0), '#55585e');
  }
  add(new THREE.BoxGeometry(W.foot - W.end + 2.8, 0.1, W.half * 2).translate((W.foot + W.end - 2.8) / 2, -W.drop - 0.05, 0), '#7a7d82');
  // a band of green tile along both walls, handrails down the steps
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(W.top + 4.6, 0.25, 0.02).translate((W.top - 4.6) / 2, -W.drop + 1.6, s * (W.half - 0.005)), '#2f6a4a');
    const len = Math.hypot(W.top - W.foot, W.drop);
    add(new THREE.CylinderGeometry(0.025, 0.025, len, 6).rotateZ(Math.PI / 2 - Math.atan2(W.drop, W.top - W.foot)).translate((W.top + W.foot) / 2, -W.drop / 2 + 0.85, s * (W.half - 0.08)), '#c9ced6');
  }
  // the lit way through to the turnstiles, down at the end of the tunnel
  const glowMat = new THREE.MeshBasicMaterial({ color: '#fff1c8', toneMapped: false });
  const doorway = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.2).rotateY(Math.PI / 2).translate(W.end - 2.75, -W.drop + 1.1, 0), glowMat);
  g.add(doorway);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.2).translate(W.end - 1.4, -0.3, 0), glowMat);
  g.add(strip);
  const geo = mergeGeometries(parts.map((p, i) => {
    const c = new THREE.Color(cols[i][0]);
    const a = new Float32Array(p.attributes.position.count * 3);
    for (let k = 0; k < p.attributes.position.count; k++) a.set([c.r, c.g, c.b], k * 3);
    p.deleteAttribute('uv');
    p.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return p;
  }));
  const steps = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  steps.receiveShadow = true;
  g.add(steps);
  // the punch: clears depth over the opening right after the ground is drawn
  const punchMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthFunc: THREE.AlwaysDepth });
  punchMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragDepth = 1.0;');
  };
  punchMat.customProgramCacheKey = () => 'well-punch';
  const punch = new THREE.Mesh(new THREE.PlaneGeometry(W.top - W.end, W.half * 2).rotateX(-Math.PI / 2).translate((W.top + W.end) / 2, 0.004, 0), punchMat);
  punch.renderOrder = -1;
  g.add(punch);
  // green railings with posts on three sides, globe lamps at the top of the steps
  const green = new THREE.MeshStandardMaterial({ color: '#24513a', roughness: 0.45, metalness: 0.5 });
  const rail = [];
  for (const s of [-1, 1]) {
    rail.push(box(W.top - W.end + 0.1, 0.06, 0.06, (W.top + W.end) / 2, 1.05, s * (W.half + 0.05)));
    rail.push(box(W.top - W.end + 0.1, 0.04, 0.04, (W.top + W.end) / 2, 0.55, s * (W.half + 0.05)));
    for (let x = W.end; x <= W.top + 0.01; x += (W.top - W.end) / 4) rail.push(box(0.06, 1.05, 0.06, x, 0.525, s * (W.half + 0.05)));
  }
  rail.push(box(0.06, 0.06, W.half * 2 + 0.16, W.end - 0.02, 1.05, 0), box(0.04, 0.04, W.half * 2 + 0.16, W.end - 0.02, 0.55, 0));
  rail.push(box(0.12, 1.1, W.half * 2 + 0.1, W.end - 0.08, 0.55, 0)); // the solid end panel with the sign
  for (const s of [-1, 1]) rail.push(cyl(0.05, 0.07, 2.6, W.top + 0.05, 1.3, s * (W.half + 0.05), 8));
  const rails = new THREE.Mesh(mergeGeometries(rail), green);
  rails.castShadow = true;
  g.add(rails);
  const globeMat = new THREE.MeshStandardMaterial({ color: '#7fe08a', emissive: '#3fbf5a', emissiveIntensity: 0.6, roughness: 0.3 });
  for (const s of [-1, 1]) {
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), globeMat);
    globe.position.set(W.top + 0.05, 2.75, s * (W.half + 0.05));
    g.add(globe);
  }
  ctx.globeMats ||= [];
  ctx.globeMats.push(globeMat);
  // keep people out of the hole: walls below, railings above (open at the top of the steps)
  const wx = g.position.x;
  const wz = g.position.z;
  const c = Math.cos(g.rotation.y);
  const sn = Math.sin(g.rotation.y);
  const toW = (lx, lz) => [wx + lx * c + lz * sn, wz - lx * sn + lz * c];
  const solid = (x0, z0, x1, z1, y0, y1) => {
    const [ax, az] = toW(x0, z0);
    const [bx2, bz] = toW(x1, z1);
    ctx.colliders.add(Math.min(ax, bx2), Math.min(az, bz), Math.max(ax, bx2), Math.max(az, bz), ctx.K.CURB + y1, ctx.K.CURB + y0);
  };
  for (const s of [-1, 1]) solid(W.end - 0.1, s * W.half, W.top, s * (W.half + 0.12), -6, 1.15);
  solid(W.end - 0.15, -W.half - 0.12, W.end, W.half + 0.12, -6, 1.15);
  ctx.wells ||= [];
  ctx.wells.push({ x: wx, z: wz, ry: g.rotation.y });
  void color;
}

export function buildStation(ctx, x, z, ry, color) {
  const g = new THREE.Group();
  if (ctx.cfg?.transit?.kind === 'subway') {
    g.position.set(x, ctx.K.CURB, z);
    g.rotation.y = ry;
    subwayEntrance(ctx, g, color);
    ctx.group.add(g);
    return g;
  }
  const frame = new THREE.MeshStandardMaterial({ color: '#2b3340', roughness: 0.5, metalness: 0.4 });
  const roof = new THREE.Mesh(box(4.4, 0.18, 2.6, 0, 2.9, 0), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
  roof.castShadow = true;
  g.add(roof);
  const posts = new THREE.Mesh(
    mergeGeometries([box(0.14, 2.9, 0.14, -2, 1.45, -1.1), box(0.14, 2.9, 0.14, 2, 1.45, -1.1), box(0.14, 2.9, 0.14, -2, 1.45, 1.1), box(0.14, 2.9, 0.14, 2, 1.45, 1.1), box(4.2, 1.0, 0.1, 0, 0.5, -1.15)]),
    frame,
  );
  posts.castShadow = true;
  g.add(posts);
  const pit = new THREE.Mesh(box(3.6, 0.04, 1.9, 0, 0.03, 0), new THREE.MeshStandardMaterial({ color: '#0d1016', roughness: 1 }));
  g.add(pit);
  if (ctx.cfg?.transit?.kind === 'elevated') {
    // the line runs overhead: a raised platform on steel legs, reached by stairs
    pit.visible = false;
    const steel = new THREE.MeshStandardMaterial({ color: '#4a5560', roughness: 0.5, metalness: 0.5 });
    const parts = [box(9, 0.6, 3.2, 0, 6.3, 0), box(9.2, 1.1, 0.12, 0, 7.2, -1.6), box(9.2, 1.1, 0.12, 0, 7.2, 1.6)];
    for (const px of [-4.2, 4.2]) for (const pz of [-1.4, 1.4]) parts.push(box(0.3, 6.3, 0.3, px, 3.15, pz));
    for (let k = 0; k < 10; k++) parts.push(box(1.6, 0.18, 0.5, 3.4, 0.6 * k + 0.3, -1.6 + k * 0.35 - 1.6));
    const deck = new THREE.Mesh(mergeGeometries(parts), steel);
    deck.castShadow = true;
    g.add(deck);
    const canopy = new THREE.Mesh(box(9, 0.15, 3.4, 0, 9.2, 0), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    g.add(canopy);
  }
  g.position.set(x, ctx.K.CURB, z);
  g.rotation.y = ry;
  ctx.group.add(g);
  return g;
}
