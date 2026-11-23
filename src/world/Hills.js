// Hiking hills beyond a free edge of the city: a wooded ridge with a
// switchback trail from the trailhead by the road to a rocky summit with a
// cairn, a flag and a coin telescope. Higher hills roll on into the distance.
// Hikers walk the trail; reaching the top lifts your mood.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { labelTexture } from './Textures.js';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { roleAppearance } from '../characters/Customization.js';
import { addNeed } from '../sim/Needs.js';
import { dayOf, hourOf } from '../core/Clock.js';
import { mulberry32, hashStr } from '../core/utils.js';

const CELLS = 4; // ring cells along the edge
const FAR = 170; // the distant range beyond the walkable hills
const GRID = 2;

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Where the hills go: a free edge (no water, not the airport's), away from the zoo. */
export function hillsSpec(cfg, { N, half, K, water, airSide, zoo, blockMin }) {
  if (cfg.hills === false || N < CELLS + 2) return null;
  const sides = ['north', 'east', 'south', 'west'].filter((s) => !water[s] && s !== airSide);
  sides.sort((a, b) => (a === zoo?.side) - (b === zoo?.side));
  for (const side of sides) {
    const zi = zoo && zoo.side === side ? (side === 'north' || side === 'south' ? zoo.i : zoo.j) : null;
    let best = null;
    for (let a0 = 0; a0 + CELLS <= N; a0++) {
      if (zi !== null && a0 <= zi + 2 && a0 + CELLS - 1 >= zi - 2) continue;
      const mid = a0 + CELLS / 2;
      const score = zi === null ? -Math.abs(mid - N / 2) : Math.abs(mid - zi);
      if (!best || score > best.score) best = { a0, score };
    }
    if (!best) continue;
    const a0 = best.a0;
    const u0 = blockMin(a0) - K.ROAD / 2;
    const u1 = blockMin(a0 + CELLS - 1) + K.BLOCK + K.ROAD / 2;
    const D = 2 * K.PITCH - 6;
    const uc = (u0 + u1) / 2;
    const W2 = (u1 - u0) / 2;
    const name = cfg.hills?.name || `${cfg.name} Hills`;
    const S = { side, a0, u0, u1, uc, W2, D, half, name, pu: uc + W2 * 0.2, pv: D * 0.68, qu: uc - W2 * 0.42, qv: D * 0.42, seed: hashStr(cfg.name + ':hills') };
    S.top = rawH(S, S.pu, S.pv);
    S.cells = (i, j) => {
      const along = side === 'north' || side === 'south' ? i : j;
      const out = side === 'north' ? j < 0 : side === 'south' ? j >= N : side === 'west' ? i < 0 : i >= N;
      return out && along >= a0 && along < a0 + CELLS;
    };
    const [x0, z0] = toXZ(S, u0, 0);
    const [x1, z1] = toXZ(S, u1, D);
    S.rect = [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)];
    return S;
  }
  return null;
}

/** Hill coordinates: u along the city edge, v outward from it. */
export function toXZ(S, u, v) {
  const h = S.half;
  return S.side === 'north' ? [u, -h - v] : S.side === 'south' ? [u, h + v] : S.side === 'west' ? [-h - v, u] : [h + v, u];
}
export function toUV(S, x, z) {
  const h = S.half;
  return S.side === 'north' ? [x, -h - z] : S.side === 'south' ? [x, z - h] : S.side === 'west' ? [z, -h - x] : [z, x - h];
}

function rawH(S, u, v) {
  if (v < 0) return 0;
  const du = u - S.uc;
  const edge = smooth(5, 36, v);
  const side = smooth(S.W2, S.W2 - 34, Math.abs(du));
  const g = (cu, cv, s) => Math.exp(-((u - cu) ** 2 + (v - cv) ** 2) / (2 * s * s));
  const main = 44 * g(S.pu, S.pv, 36);
  const second = 24 * g(S.qu, S.qv, 25);
  const range = (62 + 22 * Math.sin(u * 0.021 + 1.1) + 12 * Math.sin(u * 0.057)) * smooth(S.D - 25, S.D + 110, v);
  const noise = (2.4 * Math.sin(u * 0.071 + 1.3) * Math.sin(v * 0.083 + 0.4) + 1.2 * Math.sin(u * 0.19 + v * 0.13) + 0.6 * Math.sin(u * 0.37 - v * 0.29)) * smooth(8, 40, v);
  return Math.max(0, edge * side * (main + second + range + noise));
}

/** Height of the hills at a point (a flat, rocky top at the summit). */
export function hillH(S, u, v) {
  let y = rawH(S, u, v);
  const d = Math.hypot(u - S.pu, v - S.pv);
  if (d < 10) y += (S.top - y) * smooth(10, 4.5, d);
  return y;
}

/** Ground height inside the hills (null outside). */
export function hillsY(S, x, z) {
  const [u, v] = toUV(S, x, z);
  if (v < 0 || v > S.D + FAR || u < S.u0 || u > S.u1) return null;
  return hillH(S, u, v);
}

export function buildHills(ctx, S) {
  const { group, colliders, K, places } = ctx;
  const rng = mulberry32(S.seed);
  const Y = K.CURB + 0.03;
  const g = new THREE.Group();
  g.name = 'hills';

  // ---- the trail: switchbacks from the trailhead up to the summit ----
  const ut = S.uc - S.W2 * 0.3;
  const ctrl = [];
  const L = 7;
  for (let k = 0; k <= L; k++) {
    const t = k / L;
    const u = ut + (S.pu - ut) * t;
    const v = 2 + (S.pv - 2) * t;
    const off = k === 0 || k === L ? 0 : (k % 2 ? 1 : -1) * 24 * (1 - t ** 0.8);
    ctrl.push(new THREE.Vector3(u + off, 0, v + (k === 0 ? 0 : 0)));
  }
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  const n = Math.ceil(curve.getLength() / 1.5);
  const trail = curve.getSpacedPoints(n).map((p) => ({ u: p.x, v: p.z }));
  S.trail = trail.map(({ u, v }) => {
    const [x, z] = toXZ(S, u, v);
    return { x, z, u, v };
  });
  const trailDist = (u, v) => {
    let d = 1e9;
    for (let i = 0; i < trail.length; i += 2) d = Math.min(d, (trail[i].u - u) ** 2 + (trail[i].v - v) ** 2);
    return Math.sqrt(d);
  };

  // ---- terrain ----
  const nu = Math.ceil((S.u1 - S.u0) / GRID);
  const nv = Math.ceil((S.D + FAR) / GRID);
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
  const col = new Float32Array((nu + 1) * (nv + 1) * 3);
  const c = new THREE.Color();
  const GRASS = new THREE.Color('#6f9a4a');
  const FOREST = new THREE.Color('#4d7536');
  const ROCK = new THREE.Color('#8d877c');
  const SNOW = new THREE.Color('#eef1f4');
  const DIRT = new THREE.Color('#a88a5e');
  let k = 0;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = S.u0 + (i / nu) * (S.u1 - S.u0);
      const v = (j / nv) * (S.D + FAR);
      const y = hillH(S, u, v);
      const [x, z] = toXZ(S, u, v);
      pos.set([x, Y + y, z], k * 3);
      const n2 = Math.sin(u * 0.31 + v * 0.17) * 0.5 + 0.5;
      c.copy(GRASS).lerp(FOREST, smooth(6, 16, y) * (0.6 + n2 * 0.4));
      c.lerp(ROCK, smooth(30, 42, y));
      c.lerp(SNOW, smooth(62, 72, y));
      if (v < S.D) {
        const td = trailDist(u, v);
        if (td < 2.6) c.lerp(DIRT, smooth(2.6, 1.2, td) * 0.7);
      }
      col.set([c.r, c.g, c.b], k * 3);
      k++;
    }
  }
  const idx = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      const b = a + 1;
      const d = a + nu + 1;
      const e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // the winding depends on the side: make sure the normals point up
  if (geo.attributes.normal.getY(Math.floor(geo.attributes.normal.count / 2)) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    geo.setIndex(idx);
    geo.computeVertexNormals();
  }
  const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  land.receiveShadow = true;
  g.add(land);

  // the dirt path itself, a ribbon just above the ground
  const rp = [];
  const ri = [];
  for (let i = 0; i < trail.length; i++) {
    const a = trail[Math.max(0, i - 1)];
    const b = trail[Math.min(trail.length - 1, i + 1)];
    const tu = b.u - a.u;
    const tv = b.v - a.v;
    const l = Math.hypot(tu, tv) || 1;
    for (const s of [-1, 1]) {
      const u = trail[i].u + (-tv / l) * 0.85 * s;
      const v = trail[i].v + (tu / l) * 0.85 * s;
      const [x, z] = toXZ(S, u, v);
      rp.push(x, Y + hillH(S, u, v) + 0.09, z);
    }
    if (i) {
      const q = (i - 1) * 2;
      ri.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
    }
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  pg.setIndex(ri);
  pg.computeVertexNormals();
  if (pg.attributes.normal.getY(0) < 0) {
    for (let i = 0; i < ri.length; i += 3) [ri[i + 1], ri[i + 2]] = [ri[i + 2], ri[i + 1]];
    pg.setIndex(ri);
    pg.computeVertexNormals();
  }
  const path = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ color: '#a8875a', roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  path.receiveShadow = true;
  g.add(path);

  // ---- pines and boulders ----
  const tint = (geo2, color) => {
    const cc = new THREE.Color(color);
    const a = new Float32Array(geo2.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) a.set([cc.r, cc.g, cc.b], i);
    geo2.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo2;
  };
  const pineGeo = mergeGeometries([
    tint(new THREE.CylinderGeometry(0.16, 0.24, 1.8, 6).translate(0, 0.9, 0), '#5a3f2a'),
    tint(new THREE.ConeGeometry(1.7, 2.6, 8).translate(0, 2.6, 0), '#2f5a32'),
    tint(new THREE.ConeGeometry(1.3, 2.2, 8).translate(0, 3.8, 0), '#356638'),
    tint(new THREE.ConeGeometry(0.85, 1.8, 8).translate(0, 4.9, 0), '#3d7240'),
  ]);
  const pines = [];
  const rocks = [];
  const solid = [];
  for (let tries = 0; tries < 2600 && pines.length < 520; tries++) {
    const u = S.u0 + 6 + rng() * (S.u1 - S.u0 - 12);
    const v = 9 + rng() * (S.D + FAR * 0.7);
    const y = hillH(S, u, v);
    if (y > 36 || (v < S.D && trailDist(u, v) < 3.2) || Math.hypot(u - S.pu, v - S.pv) < 16) continue;
    if (Math.abs(u - S.uc) > S.W2 - 8) continue;
    if (rng() > 0.35 + smooth(4, 14, y) * 0.6) continue; // thicker woods up the slopes
    const [x, z] = toXZ(S, u, v);
    const s = 0.8 + rng() * 0.7;
    pines.push({ x, y: Y + y - 0.1, z, s, r: rng() * 6 });
    if (v < S.D) solid.push([x, z, 0.3, Y + y]);
  }
  for (let i = 0; i < 90; i++) {
    const near = i < 25;
    const u = near ? S.pu + (rng() - 0.5) * 34 : S.u0 + 10 + rng() * (S.u1 - S.u0 - 20);
    const v = near ? S.pv + (rng() - 0.5) * 34 : 12 + rng() * (S.D - 14);
    if (trailDist(u, v) < 2.6 || Math.hypot(u - S.pu, v - S.pv) < 9) continue;
    const y = hillH(S, u, v);
    const [x, z] = toXZ(S, u, v);
    const s = 0.4 + rng() * 1.1;
    rocks.push({ x, y: Y + y - 0.2 * s, z, s, r: rng() * 6 });
    if (s > 0.8) solid.push([x, z, s * 0.8, Y + y]);
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pm = new THREE.InstancedMesh(pineGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), pines.length);
  pines.forEach((p, i) => pm.setMatrixAt(i, m4.compose(new THREE.Vector3(p.x, p.y, p.z), q.setFromAxisAngle(up, p.r), new THREE.Vector3(p.s, p.s * (0.9 + (i % 5) * 0.06), p.s))));
  pm.castShadow = true;
  pm.receiveShadow = true;
  g.add(pm);
  const rm = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#8f897d', roughness: 0.9, flatShading: true }), rocks.length);
  rocks.forEach((p, i) => rm.setMatrixAt(i, m4.compose(new THREE.Vector3(p.x, p.y, p.z), q.setFromAxisAngle(up, p.r), new THREE.Vector3(p.s * 1.2, p.s * 0.75, p.s))));
  rm.castShadow = true;
  rm.receiveShadow = true;
  g.add(rm);
  for (const [x, z, r, y] of solid) colliders.add(x - r, z - r, x + r, z + r, y + 5, y - 1);

  // ---- wooden things: trail markers, benches, the trailhead sign ----
  const wood = [];
  const blaze = [];
  const put = (geo2, list, u, v, ry = 0) => {
    const [x, z] = toXZ(S, u, v);
    list.push(geo2.rotateY(ry).translate(x, Y + hillH(S, u, v), z));
    return [x, z];
  };
  const faceCity = { north: 0, south: Math.PI, west: Math.PI / 2, east: -Math.PI / 2 }[S.side]; // a rotation that looks back toward the city
  for (let i = 20; i < trail.length - 8; i += 22) {
    const a = trail[i];
    const b = trail[i + 1];
    const tu = b.u - a.u;
    const tv = b.v - a.v;
    const l = Math.hypot(tu, tv) || 1;
    const u = a.u + (-tv / l) * 1.4;
    const v = a.v + (tu / l) * 1.4;
    const [x, z] = put(new THREE.BoxGeometry(0.14, 1.1, 0.14).translate(0, 0.55, 0), wood, u, v);
    blaze.push(new THREE.BoxGeometry(0.16, 0.18, 0.16).translate(x, Y + hillH(S, u, v) + 0.92, z));
    colliders.add(x - 0.1, z - 0.1, x + 0.1, z + 0.1, Y + hillH(S, u, v) + 1.1, Y + hillH(S, u, v) - 1);
  }
  const benchGeo = () =>
    mergeGeometries([
      new THREE.BoxGeometry(1.6, 0.08, 0.45).translate(0, 0.45, 0),
      new THREE.BoxGeometry(1.6, 0.4, 0.06).translate(0, 0.75, -0.2),
      ...[-0.7, 0.7].map((x) => new THREE.BoxGeometry(0.08, 0.45, 0.4).translate(x, 0.22, 0)),
    ]);
  for (const f of [0.38, 0.72]) {
    const i = Math.floor(trail.length * f);
    const a = trail[i];
    const b = trail[i + 1];
    const tu = b.u - a.u;
    const tv = b.v - a.v;
    const l = Math.hypot(tu, tv) || 1;
    const u = a.u + (tv / l) * 1.6;
    const v = a.v - (tu / l) * 1.6;
    const [x, z] = put(benchGeo(), wood, u, v, faceCity);
    ctx.benchSpots?.push({ x, z, ry: faceCity });
  }
  // the trailhead: a big sign on two posts and a map board
  const [hx, hz] = toXZ(S, ut, 3);
  const hy = Y + hillH(S, ut, 3);
  for (const s of [-1.9, 1.9]) {
    const [px, pz] = toXZ(S, ut + s, 3);
    wood.push(new THREE.BoxGeometry(0.2, 3.4, 0.2).translate(px, hy + 1.7, pz));
    colliders.add(px - 0.15, pz - 0.15, px + 0.15, pz + 0.15, hy + 3.4, hy - 1);
  }
  const signTex = labelTexture(`${S.name} Trail`, { icon: '⛰️', bg: '#3f5a2f', accent: '#e9c04c' });
  for (const s of [0, Math.PI]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }));
    m.material.userData.ownMap = s === 0;
    m.position.set(hx, hy + 3.0, hz);
    m.rotation.y = faceCity + Math.PI + s;
    m.translateZ(0.12);
    g.add(m);
  }
  wood.push(new THREE.BoxGeometry(4.2, 1.15, 0.18).rotateY(faceCity).translate(hx, hy + 3.0, hz));

  // ---- the summit: a cairn, a flag, a coin telescope and a sign ----
  const [sx, sz] = toXZ(S, S.pu, S.pv);
  const sy = Y + S.top;
  S.summit = { x: sx, z: sz, y: sy };
  const stones = [];
  for (let i = 0; i < 6; i++) stones.push(new THREE.DodecahedronGeometry(0.5 - i * 0.06, 0).scale(1.2, 0.7, 1).rotateY(i).translate(sx + 2.5, sy + 0.25 + i * 0.36, sz + 2.5));
  g.add(new THREE.Mesh(mergeGeometries(stones), new THREE.MeshStandardMaterial({ color: '#9a9488', roughness: 0.9, flatShading: true })));
  colliders.add(sx + 1.9, sz + 1.9, sx + 3.1, sz + 3.1, sy + 2.5, sy - 1);
  wood.push(new THREE.CylinderGeometry(0.05, 0.06, 6, 8).translate(sx - 2.5, sy + 3, sz + 2.2));
  colliders.add(sx - 2.6, sz + 2.1, sx - 2.4, sz + 2.3, sy + 6, sy - 1);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshStandardMaterial({ color: '#d8423a', roughness: 0.7, side: THREE.DoubleSide }));
  flag.position.set(sx - 2.5 + 0.72, sy + 5.45, sz + 2.2);
  g.add(flag);
  ctx.animated?.push(() => (flag.rotation.y = Math.sin(performance.now() / 600) * 0.35));
  const [vx, vz] = toXZ(S, S.pu, S.pv - 3.2);
  const viewer = mergeGeometries([
    new THREE.CylinderGeometry(0.06, 0.08, 1.1, 8).translate(0, 0.55, 0),
    new THREE.CylinderGeometry(0.15, 0.13, 0.55, 10).rotateX(Math.PI / 2).translate(0, 1.25, 0.05),
    new THREE.BoxGeometry(0.36, 0.22, 0.2).translate(0, 1.25, -0.2),
  ]).rotateY(faceCity + Math.PI);
  g.add(new THREE.Mesh(viewer.translate(vx, sy, vz), new THREE.MeshStandardMaterial({ color: '#2f6e78', roughness: 0.4, metalness: 0.5 })));
  colliders.add(vx - 0.2, vz - 0.2, vx + 0.2, vz + 0.2, sy + 1.4, sy - 1);
  S.viewer = { x: vx, z: vz };
  const topTex = labelTexture(`Summit · ${Math.round(S.top * 4.2 + 120)} ft`, { icon: '🏔️', bg: '#4a3a28', accent: '#e9c04c' });
  const [tx, tz] = toXZ(S, S.pu + 3.4, S.pv - 1.5);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: topTex, toneMapped: false, side: THREE.DoubleSide }));
  top.position.set(tx, sy + 1.4, tz);
  top.rotation.y = faceCity + Math.PI;
  g.add(top);
  wood.push(new THREE.BoxGeometry(0.12, 1.4, 0.12).translate(tx, sy + 0.7, tz));
  g.add(new THREE.Mesh(mergeGeometries(wood), new THREE.MeshStandardMaterial({ color: '#7a5a3c', roughness: 0.85 })));
  g.add(new THREE.Mesh(mergeGeometries(blaze), new THREE.MeshStandardMaterial({ color: '#e9c04c', roughness: 0.6 })));
  group.add(g);

  // walkable: the hills up to the far range
  const [c0x, c0z] = toXZ(S, S.u0 + 2, -0.5);
  const [c1x, c1z] = toXZ(S, S.u1 - 2, S.D);
  colliders.corridors = [...(colliders.corridors || []), { minX: Math.min(c0x, c1x), maxX: Math.max(c0x, c1x), minZ: Math.min(c0z, c1z), maxZ: Math.max(c0z, c1z) }];
  // a place on the map (and somewhere a taxi can take you)
  const [ax, az] = toXZ(S, ut + 3.5, 1.5);
  const [ox, oz] = toXZ(S, ut + 3.5, 6);
  const near = ctx.blocks.slice().sort((a, b) => (a.cx - ax) ** 2 + (a.cz - az) ** 2 - ((b.cx - ax) ** 2 + (b.cz - az) ** 2))[0].district;
  places.push({ id: 'hills', type: 'hills', name: S.name, district: near, icon: '⛰️', color: '#5f7f3f', label: 'Hiking trail', outdoor: true, walk: true, nx: Math.sign(ox - ax), nz: Math.sign(oz - az), doorX: ax, doorZ: az, x: ax, z: az });
  S.trailhead = { x: hx, z: hz };
  ctx.hills = S;
}

// ---- life on the hills -------------------------------------------------------
const HIKERS = ['athlete', 'tourist', 'student', 'jogger', 'artist', 'elderly'];

export class HikeLife {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.hikers = [];
  }

  setCity(city) {
    this.clear();
    this.S = city.hills;
    this.city = city;
    if (this.S) this.game.scene.add(this.group);
  }

  clear() {
    for (const h of this.hikers) {
      h.rig.group.removeFromParent();
      h.rig.dispose();
    }
    this.hikers = [];
    this.group.removeFromParent();
  }

  update(dt, pos, inside) {
    const S = this.S;
    if (!S || !this.game.state) return;
    const T = S.trail;
    const [u, v] = toUV(S, pos.x, pos.z);
    const near = !inside && v > -60 && v < S.D + 40 && u > S.u0 - 60 && u < S.u1 + 60;
    const hr = hourOf(this.game.state.time.total);
    const want = near && hr > 6 && hr < 20 && this.game.weather.kind !== 'rain' ? 5 : 0;
    while (this.hikers.length > want) {
      const h = this.hikers.pop();
      h.rig.group.removeFromParent();
      h.rig.dispose();
    }
    while (this.hikers.length < want) {
      const role = HIKERS[Math.floor(Math.random() * HIKERS.length)];
      const rig = createRig(roleAppearance(role, Math.random));
      this.group.add(rig.group);
      this.hikers.push({ rig, i: Math.random() * (T.length - 1), dir: Math.random() < 0.5 ? 1 : -1, v: role === 'jogger' ? 2.6 : role === 'elderly' ? 0.8 : 1.15, pause: 0, side: (Math.random() - 0.5) * 0.8 });
    }
    for (const h of this.hikers) {
      let speed = 0;
      if (h.pause > 0) h.pause -= dt;
      else {
        h.i += (h.dir * h.v * dt) / 1.5;
        speed = h.v;
        if (h.i >= T.length - 1) {
          h.i = T.length - 1;
          h.dir = -1;
          h.pause = 6 + Math.random() * 6; // enjoy the top
        } else if (h.i <= 0) {
          h.i = 0;
          h.dir = 1;
          h.pause = 3;
        }
      }
      const a = T[Math.floor(h.i)];
      const b = T[Math.min(T.length - 1, Math.floor(h.i) + 1)];
      const f = h.i - Math.floor(h.i);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      const x = a.x + dx * f + (-dz / l) * h.side * h.dir;
      const z = a.z + dz * f + (dx / l) * h.side * h.dir;
      h.rig.group.position.set(x, this.city.groundY(x, z), z);
      if (speed) h.rig.group.rotation.y = Math.atan2(dx * h.dir, dz * h.dir);
      animateRig(h.rig, dt, { speed, grounded: true, cheering: h.pause > 0 && h.i > T.length - 2 && h.pause % 4 > 3 });
    }
    // made it to the top
    if (!inside && S.summit && (pos.x - S.summit.x) ** 2 + (pos.z - S.summit.z) ** 2 < 8 * 8) {
      const st = this.game.state;
      const day = dayOf(st.time.total);
      if (st.flags.summitDay !== day) {
        st.flags.summitDay = day;
        st.stats.summits = (st.stats.summits || 0) + 1;
        const cid = this.city.cfg.id;
        if (!(st.flags.summitCities ||= []).includes(cid)) st.flags.summitCities.push(cid);
        this.game.sim.achievements?.check();
        addNeed(this.game.sim, 'fun', 12);
        this.game.audio?.play('success');
        this.game.events.emit('toast', { icon: '🏔️', title: `You made it to the top of ${S.name}!`, text: st.stats.summits === 1 ? 'The whole city is spread out below you. Worth every step.' : `Summit number ${st.stats.summits}. The view never gets old.`, kind: 'good', long: true });
      }
    }
  }

  interactable(pos) {
    const S = this.S;
    if (!S) return null;
    if (S.viewer && (pos.x - S.viewer.x) ** 2 + (pos.z - S.viewer.z) ** 2 < 2.2 * 2.2) return { label: '🔭 Look through the telescope · $1', action: () => this.lookOut() };
    if (S.trailhead && (pos.x - S.trailhead.x) ** 2 + (pos.z - S.trailhead.z) ** 2 < 3.5 * 3.5) return { label: `⛰️ Read the trail sign`, action: () => this.readSign() };
    return null;
  }

  lookOut() {
    const game = this.game;
    if (!game.sim.finance.spend(1, 'fun', 'Summit telescope')) return;
    const night = game.sky.night > 0.5;
    game.fade(() => {
      game.sim.advance(15, { noCollapse: true });
      addNeed(game.sim, 'fun', 10);
    });
    game.events.emit('toast', { icon: '🔭', title: this.S.name, text: night ? 'The city glitters below like a spilled jewellery box.' : 'You can pick out your own street from up here, and the tiny cars crawling along it.', kind: 'good', long: true });
  }

  readSign() {
    const S = this.S;
    const len = Math.round(S.trail.length * 1.5);
    this.game.events.emit('toast', { icon: '⛰️', title: `${S.name} Trail`, text: `${(len / 1000).toFixed(1)} km of switchbacks to the summit (${Math.round(S.top * 4.2 + 120)} ft). Follow the yellow markers. Benches on the way up, a telescope at the top.`, kind: 'info', long: true });
  }
}
