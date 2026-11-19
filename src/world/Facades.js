// Details that make the blocks read as a real city:
//  · black iron fire escapes zig-zagging down the fronts of walk-ups
//  · red aircraft warning lights blinking on top of the towers at night
//  · billboards on rooftops (the game's fictional brands)
//  · roof gardens with planters and little trees on low buildings
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FACADE, InstanceBatch } from './Buildings.js';
import { adTextures } from './TimesSquare.js';

const N4 = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

class Bag {
  constructor() {
    this.list = [];
  }
  add(geo) {
    this.list.push(geo.index ? geo.toNonIndexed() : geo);
  }
}

/** Box in facade space: u along the wall, y up, v out from the wall. */
function facadeBox(f, u, y, v, w, h, d, roll = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (roll) g.rotateZ(roll);
  g.translate(u, y, v);
  // facade space -> world: along the wall, up, and out along its normal (nx, nz)
  // (tangent (nz, -nx) keeps it a rotation, not a mirror, so faces stay outward)
  const m = new THREE.Matrix4().set(f.nz, 0, f.nx, f.x, 0, 1, 0, 0, -f.nx, 0, f.nz, f.z, 0, 0, 0, 1);
  g.applyMatrix4(m);
  return g;
}

export function buildFacadeDetails(ctx) {
  const { group, rng, K } = ctx;
  const list = ctx.facades || [];
  const iron = new Bag();
  const warn = [];
  const boards = new Map();
  const ads = adTextures();
  const grass = new InstanceBatch(new THREE.BoxGeometry(1, 0.12, 1).translate(0, 0.06, 0), new THREE.MeshStandardMaterial({ color: '#4f8a3f', roughness: 1 }), { receiveShadow: true });
  const planters = new InstanceBatch(new THREE.BoxGeometry(1, 0.5, 1).translate(0, 0.25, 0), new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.9 }), { castShadow: true });
  const shrubs = new InstanceBatch(new THREE.IcosahedronGeometry(0.6, 1), new THREE.MeshStandardMaterial({ color: '#3f7a34', roughness: 0.9, flatShading: true }), { castShadow: true });
  const posts = new Bag();
  let escapes = 0;

  for (const b of list) {
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const side = b.sides?.[0];
    const masonry = b.type === FACADE.MASONRY || b.type === FACADE.BALCONY;
    // ---- fire escapes on walk-ups (not on the shopfront of a place)
    if (side && masonry && !b.place && b.h > 11 && b.h < 42 && rng() < 0.42) {
      const [nx, nz] = N4[side];
      const len = nz ? w : d;
      const fw = Math.min(4.6, len - 2.4);
      if (fw > 2.6) {
        const off = (rng() - 0.5) * (len - fw - 2) * 0.8;
        const f = { nx, nz, x: cx + nx * (w / 2), z: cz + nz * (d / 2) };
        const fh = b.floorH || 3.4;
        const floors = Math.floor(b.h / fh);
        for (let k = 1; k < floors; k++) {
          const y = K.CURB + k * fh - 0.1;
          iron.add(facadeBox(f, off, y, 0.55, fw, 0.06, 1.05));
          iron.add(facadeBox(f, off, y + 1.0, 1.06, fw, 0.04, 0.04)); // top rail
          iron.add(facadeBox(f, off, y + 0.5, 1.06, fw, 0.03, 0.03)); // mid rail
          for (const s of [-1, 1]) iron.add(facadeBox(f, off + s * fw / 2, y + 0.5, 0.55, 0.04, 1.0, 1.05));
          for (let p = -fw / 2; p <= fw / 2 + 0.01; p += fw / 6) iron.add(facadeBox(f, off + p, y + 0.5, 1.06, 0.025, 1.0, 0.025));
          // the stair up to the next landing, alternating direction
          if (k < floors - 1) {
            const run = fw * 0.62;
            const ang = Math.atan2(fh, run) * (k % 2 ? 1 : -1);
            iron.add(facadeBox(f, off, y + fh / 2, 0.75, Math.hypot(run, fh), 0.05, 0.6, ang));
          }
        }
        // the drop ladder hanging from the first landing
        iron.add(facadeBox(f, off + fw / 2 - 0.4, K.CURB + fh - 1.3, 0.95, 0.04, 2.4, 0.04));
        iron.add(facadeBox(f, off + fw / 2 - 0.85, K.CURB + fh - 1.3, 0.95, 0.04, 2.4, 0.04));
        for (let r = 0; r < 6; r++) iron.add(facadeBox(f, off + fw / 2 - 0.625, K.CURB + fh - 2.4 + r * 0.38, 0.95, 0.45, 0.03, 0.03));
        escapes++;
      }
    }
    // ---- warning lights on the tallest towers
    const top = b.top || b.h;
    if (top > 85) {
      warn.push([cx, top + 0.4, cz]);
      if (top > 150) for (const [sx, sz] of [[-1, -1], [1, 1]]) warn.push([cx + sx * (w * 0.3), top - 2, cz + sz * (d * 0.3)]);
    }
    // ---- rooftop billboards on mid-height buildings facing a street
    if (side && b.h > 14 && b.h < 46 && !b.place && rng() < 0.09) {
      const [nx, nz] = N4[side];
      const f = { nx, nz, x: cx + nx * (w / 2 - 1.5), z: cz + nz * (d / 2 - 1.5) };
      const bw = Math.min(10, (nz ? w : d) - 2);
      if (bw > 5) {
        const y0 = K.CURB + b.h + 1.6;
        for (const u of [-bw / 2 + 0.6, 0, bw / 2 - 0.6]) {
          posts.add(facadeBox(f, u, K.CURB + b.h + 0.8, -0.3, 0.14, 1.6 + bw * 0.3, 0.14));
          posts.add(facadeBox(f, u, K.CURB + b.h + 0.6, -1.2, 0.1, 1.2, 0.1));
        }
        posts.add(facadeBox(f, 0, y0 + bw * 0.3 + 0.05, -0.32, bw + 0.3, bw * 0.6 + 0.3, 0.12));
        const geo = new THREE.PlaneGeometry(bw, bw * 0.6);
        geo.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(nx, nz)));
        geo.translate(f.x + nx * -0.24, y0 + bw * 0.3 + 0.05, f.z + nz * -0.24);
        const tex = ads[Math.floor(rng() * ads.length)];
        if (!boards.has(tex)) boards.set(tex, []);
        boards.get(tex).push(geo);
      }
    }
    // ---- roof gardens on low buildings
    if (b.h < 22 && b.h > 7 && w > 9 && d > 9 && rng() < 0.12) {
      const y = K.CURB + b.h;
      grass.add(cx, y, cz, { sx: w * 0.6, sz: d * 0.5 });
      for (let i = 0; i < 4; i++) {
        const px = cx + (rng() - 0.5) * w * 0.5;
        const pz = cz + (rng() - 0.5) * d * 0.4;
        planters.add(px, y, pz, { sx: 1.2, sz: 1.2 });
        shrubs.add(px, y + 0.9, pz, { sx: 0.8 + rng() * 0.6, sy: 0.9 + rng() * 0.6, sz: 0.8 + rng() * 0.6 });
      }
    }
  }

  if (iron.list.length) {
    const m = new THREE.Mesh(mergeGeometries(iron.list), new THREE.MeshStandardMaterial({ color: '#1e1f23', roughness: 0.6, metalness: 0.5 }));
    m.castShadow = true;
    group.add(m);
  }
  if (posts.list.length) {
    const m = new THREE.Mesh(mergeGeometries(posts.list), new THREE.MeshStandardMaterial({ color: '#3a3d44', roughness: 0.7, metalness: 0.4 }));
    m.castShadow = true;
    group.add(m);
  }
  for (const [tex, geos] of boards) group.add(new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
  for (const m of [grass.build(), planters.build(), shrubs.build()]) if (m) group.add(m);
  if (warn.length) {
    const mat = new THREE.MeshBasicMaterial({ color: '#ff2a2a', toneMapped: false });
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 8, 6), mat, warn.length);
    const mx = new THREE.Matrix4();
    warn.forEach(([x, y, z], i) => inst.setMatrixAt(i, mx.makeTranslation(x, y, z)));
    group.add(inst);
    ctx.animated.push((t) => {
      const on = t % 1.6 < 0.5;
      mat.color.set(on ? '#ff2a2a' : '#3a0a0a');
    });
  }
  return { escapes, beacons: warn.length, billboards: [...boards.values()].reduce((s, l) => s + l.length, 0) };
}
