// Ground, road markings, crosswalks, water and waterfront promenade.
import * as THREE from 'three';
import { Tex } from './Textures.js';
import { InstanceBatch } from './Buildings.js';

function tiled(tex, rx, ry) {
  const t = tex.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

export function buildRoads(ctx) {
  const { N, half, total, K, group, cfg, water } = ctx;
  const { BLOCK, ROAD, PROM } = K;
  const far = 1300;

  // --- Asphalt base (clipped at the waterfront sides) -----------------------
  const x0 = water.west ? -half : -half - far;
  const x1 = water.east ? half : half + far;
  const z0 = water.north ? -half : -half - far;
  const z1 = water.south ? half : half + far;
  const land = new THREE.Mesh(
    new THREE.PlaneGeometry(x1 - x0, z1 - z0),
    new THREE.MeshStandardMaterial({ map: tiled(Tex.asphalt(), (x1 - x0) / 9, (z1 - z0) / 9), roughness: 0.95 }),
  );
  land.rotation.x = -Math.PI / 2;
  land.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  land.receiveShadow = true;
  group.add(land);

  // --- Water + promenade -----------------------------------------------------
  if (water.any) {
    const w = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.MeshStandardMaterial({ color: '#2f7fa8', roughness: 0.12, metalness: 0.35 }),
    );
    w.rotation.x = -Math.PI / 2;
    w.position.y = -0.45;
    group.add(w);
    ctx.waterMesh = w;

    const beach = cfg.promenade === 'beach';
    const pmat = new THREE.MeshStandardMaterial({
      map: tiled(beach ? Tex.sand() : Tex.wood(), beach ? 30 : 60, beach ? 3 : 4),
      roughness: 0.9,
    });
    const rail = new InstanceBatch(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.6 }), {
      castShadow: true,
    });
    const len = total + PROM * 2;
    const addStrip = (side) => {
      const horiz = side === 'north' || side === 'south';
      const sign = side === 'north' || side === 'west' ? -1 : 1;
      const c = sign * (half + PROM / 2);
      const m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : PROM, 1.2, horiz ? PROM : len), pmat);
      m.position.set(horiz ? 0 : c, K.CURB - 0.6, horiz ? c : 0);
      m.receiveShadow = true;
      group.add(m);
      if (!beach) {
        const e = sign * (half + PROM - 0.3);
        // top rail + posts
        rail.add(horiz ? 0 : e, K.CURB + 1.05, horiz ? e : 0, { sx: horiz ? len : 0.12, sy: 0.1, sz: horiz ? 0.12 : len });
        for (let p = -len / 2; p <= len / 2; p += 4) {
          rail.add(horiz ? p : e, K.CURB + 0.5, horiz ? e : p, { sx: 0.12, sy: 1.0, sz: 0.12 });
        }
      }
    };
    for (const s of ['north', 'south', 'east', 'west']) if (water[s]) addStrip(s);
    const r = rail.build();
    if (r) group.add(r);
  }

  // --- Sidewalk slabs (one per block, incl. backdrop blocks) -----------------
  const slab = new InstanceBatch(
    new THREE.BoxGeometry(BLOCK, K.CURB, BLOCK),
    new THREE.MeshStandardMaterial({ map: tiled(Tex.sidewalk(), 10, 10), roughness: 0.9 }),
    { receiveShadow: true },
  );
  for (const b of ctx.allBlocks) slab.add(b.cx, K.CURB / 2, b.cz);
  group.add(slab.build());

  // --- Lane markings -----------------------------------------------------------
  const flat = new THREE.PlaneGeometry(1, 1);
  flat.rotateX(-Math.PI / 2);
  const yellow = new InstanceBatch(flat, new THREE.MeshLambertMaterial({ color: '#d8b13a' }));
  const dashes = new InstanceBatch(
    flat,
    new THREE.MeshLambertMaterial({ map: tiled(Tex.dashes(), 1, 9), transparent: true, depthWrite: false }),
  );
  const cross = new InstanceBatch(
    flat,
    new THREE.MeshLambertMaterial({ map: tiled(Tex.crosswalk(), 3.5, 1), transparent: true, depthWrite: false, opacity: 0.9 }),
  );
  const stop = new InstanceBatch(flat, new THREE.MeshLambertMaterial({ color: '#e8e8e0' }));
  const y = 0.02;
  for (let k = 0; k <= N; k++) {
    const rc = ctx.roadCenter(k);
    for (let i = 0; i < N; i++) {
      const mid = ctx.blockMin(i) + BLOCK / 2;
      // road running along Z at x = rc, and along X at z = rc
      yellow.add(rc, y, mid, { sx: 0.3, sz: BLOCK - 8 });
      yellow.add(mid, y, rc, { sx: BLOCK - 8, sz: 0.3 });
      for (const o of [-3.5, 3.5]) {
        dashes.add(rc + o, y, mid, { sx: 0.18, sz: BLOCK - 8 });
        dashes.add(mid, y, rc + o, { sx: 0.18, sz: BLOCK - 8, ry: Math.PI / 2 });
      }
      // crosswalks + stop lines at both ends of the segment
      for (const e of [-1, 1]) {
        const p = mid + e * (BLOCK / 2 - 2);
        cross.add(rc, y + 0.005, p, { sx: ROAD, sz: 3 });
        cross.add(p, y + 0.005, rc, { sx: ROAD, sz: 3, ry: Math.PI / 2 });
        stop.add(rc - e * ROAD * 0.25, y, p - e * 2.4, { sx: ROAD / 2 - 0.6, sz: 0.4 });
        stop.add(p - e * 2.4, y, rc + e * ROAD * 0.25, { sx: 0.4, sz: ROAD / 2 - 0.6 });
      }
    }
  }
  for (const b of [yellow, dashes, cross, stop]) {
    const m = b.build();
    if (m) {
      m.renderOrder = 1;
      group.add(m);
    }
  }
}
