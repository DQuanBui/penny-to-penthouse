// Street furniture: lamps (with fake light pools), trees, benches, traffic
// lights, parks and transit entrances. Everything is instanced.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Tex } from './Textures.js';
import { InstanceBatch } from './Buildings.js';
import { pick } from '../core/utils.js';

const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cyl = (r0, r1, h, x = 0, y = 0, z = 0, seg = 8) => new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z);

const LEAF = ['#4f8f3f', '#5fa04a', '#3f7f3a', '#6aa84f', '#4a9050'];
const LEAF_FALL = ['#d98a2b', '#c8642a', '#e0a83a', '#b5522a', '#d9b23a'];

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
  const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true });
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
  ctx.benchSpots = [];

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
        leaves.add(x, Y + h + r * 0.55, z, { sx: r, sy: r * 0.9, sz: r, ry: rng() * 6, color: pick(rng, leafPal) });
        leaves.add(x + (rng() - 0.5) * r, Y + h + r * 1.1, z + (rng() - 0.5) * r, { sx: r * 0.7, sy: r * 0.65, sz: r * 0.7, ry: rng() * 6, color: pick(rng, leafPal) });
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
      const inner = BLOCK - 4;
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
export function buildStation(ctx, x, z, ry, color) {
  const g = new THREE.Group();
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
  g.position.set(x, ctx.K.CURB, z);
  g.rotation.y = ry;
  ctx.group.add(g);
  return g;
}
