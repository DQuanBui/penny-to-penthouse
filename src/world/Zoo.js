// The city zoo: a fenced block with an entrance arch, walkways, a flamingo
// pond and four big enclosures (giraffes and zebras, elephants, lions,
// penguins). Animals wander their enclosures; visitors stand at the walls.
// A ticket from the booth at the gate lets you in for the day.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { labelTexture } from './Textures.js';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { roleAppearance } from '../characters/Customization.js';
import { addNeed } from '../sim/Needs.js';
import { hourOf } from '../core/Clock.js';
import { mulberry32, fmtMoney, dampAngle } from '../core/utils.js';
import { h, btn } from '../ui/dom.js';
import { dialog } from '../ui/Menus.js';

const R = 23.6; // fence line from the block centre
const WALK = 3.5; // half-width of the cross walkways
export const ZOO_HOURS = [9, 18];

/** Vertex-coloured geometry bag, merged into one mesh. */
class Bag {
  constructor() {
    this.list = [];
  }
  add(geo, color, x = 0, y = 0, z = 0) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    geo.translate(x, y, z);
    const n = geo.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(geo);
  }
  mesh(opts = {}) {
    const m = new THREE.Mesh(mergeGeometries(this.list), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, ...opts }));
    m.castShadow = m.receiveShadow = true;
    return m;
  }
}
const bx = (w, hh, d) => new THREE.BoxGeometry(w, hh, d);
const cy = (r0, r1, hh, s = 12) => new THREE.CylinderGeometry(r0, r1, hh, s);
const sp = (r, sx = 1, sy = 1, sz = 1, s = 12) => new THREE.SphereGeometry(r, s, Math.max(6, Math.round(s * 0.7))).scale(sx, sy, sz);

const ENCLOSURES = [
  { id: 'savanna', sx: -1, sz: -1, ground: '#cbb26a', label: 'Giraffes & Zebras', icon: '🦒', species: [['giraffe', 2], ['zebra', 3]], fact: 'A giraffe\'s tongue is about 50 cm long — and dark blue, so it does not sunburn.' },
  { id: 'elephants', sx: 1, sz: -1, ground: '#9a7a55', label: 'Elephants', icon: '🐘', species: [['elephant', 2]], fact: 'Elephants recognise themselves in a mirror and mourn their dead.' },
  { id: 'lions', sx: -1, sz: 1, ground: '#d6b878', label: 'Lions', icon: '🦁', species: [['lion', 3]], fact: 'A lion\'s roar can be heard 8 km away. They sleep up to 20 hours a day.' },
  { id: 'penguins', sx: 1, sz: 1, ground: '#e4edf2', label: 'Penguins', icon: '🐧', species: [['penguin', 6]], fact: 'Penguins can drink sea water: a gland above their eyes filters out the salt.' },
];

// ---- animals: a group with legs on pivots so they can walk ------------------------------
function leg(group, x, y, z, len, r, color) {
  const pivot = new THREE.Object3D();
  pivot.position.set(x, y, z);
  const m = new THREE.Mesh(cy(r, r * 0.8, len, 8).translate(0, -len / 2, 0), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  m.castShadow = true;
  pivot.add(m);
  group.add(pivot);
  return pivot;
}
function part(group, geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  m.position.set(x, y, z);
  m.castShadow = true;
  group.add(m);
  return m;
}

const SPECIES = {
  giraffe: { speed: 0.9, scale: 1, build(g) {
    const tan = '#d9a750';
    part(g, sp(1, 0.55, 0.55, 0.95), tan, 0, 2.15, 0);
    const neck = part(g, cy(0.16, 0.24, 2.2, 10), tan, 0, 3.15, 0.75);
    neck.rotation.x = 0.42;
    part(g, sp(1, 0.17, 0.2, 0.36), tan, 0, 4.2, 1.35);
    for (const s of [-1, 1]) part(g, cy(0.03, 0.03, 0.22, 6), '#5a3a1e', s * 0.08, 4.42, 1.25);
    // patches
    for (let i = 0; i < 26; i++) {
      const a = (i * 2.4) % 6.28;
      part(g, sp(0.13, 1, 1, 0.3), '#8a5a2a', Math.cos(a) * 0.5, 2.15 + Math.sin(a * 1.7) * 0.3, -0.7 + (i % 8) * 0.2).lookAt(0, 2.15, 0);
    }
    return { legs: [[-0.28, 1.75, 0.6], [0.28, 1.75, 0.6], [-0.28, 1.75, -0.6], [0.28, 1.75, -0.6]].map(([x, y, z]) => leg(g, x, y, z, 1.75, 0.07, tan)) };
  } },
  zebra: { speed: 1.2, scale: 1, build(g) {
    // striped body: alternating slices
    for (let i = 0; i < 9; i++) part(g, cy(0.36, 0.36, 0.15, 12).rotateX(Math.PI / 2), i % 2 ? '#1d1d1f' : '#f4f2ec', 0, 1.15, -0.6 + i * 0.15);
    const neck = part(g, cy(0.14, 0.2, 0.75, 10), '#f4f2ec', 0, 1.55, 0.75);
    neck.rotation.x = 0.6;
    part(g, bx(0.06, 0.5, 0.25), '#1d1d1f', 0, 1.65, 0.7).rotation.x = 0.6;
    part(g, bx(0.2, 0.22, 0.55), '#f4f2ec', 0, 1.82, 1.12).rotation.x = 0.45;
    part(g, bx(0.21, 0.12, 0.16), '#1d1d1f', 0, 1.72, 1.36);
    return { legs: [[-0.18, 0.9, 0.5], [0.18, 0.9, 0.5], [-0.18, 0.9, -0.5], [0.18, 0.9, -0.5]].map(([x, y, z], k) => leg(g, x, y, z, 0.9, 0.06, k % 2 ? '#f4f2ec' : '#2b2b2e')) };
  } },
  elephant: { speed: 0.6, scale: 1, build(g) {
    const grey = '#8d8e93';
    part(g, sp(1, 1.0, 1.0, 1.45), grey, 0, 2.0, 0);
    part(g, sp(1, 0.62, 0.66, 0.6), grey, 0, 2.45, 1.45);
    for (const s of [-1, 1]) part(g, sp(1, 0.08, 0.62, 0.5), shade(grey, 0.9), s * 0.62, 2.45, 1.2);
    // trunk: stacked, curling down
    for (let i = 0; i < 6; i++) part(g, cy(0.15 - i * 0.015, 0.16 - i * 0.015, 0.3, 8), grey, 0, 2.15 - i * 0.26, 1.95 + Math.sin(i * 0.35) * 0.18);
    for (const s of [-1, 1]) part(g, new THREE.ConeGeometry(0.06, 0.55, 8).rotateX(1.9), '#f4f0e2', s * 0.25, 1.95, 1.95);
    return { legs: [[-0.55, 1.4, 0.8], [0.55, 1.4, 0.8], [-0.55, 1.4, -0.8], [0.55, 1.4, -0.8]].map(([x, y, z]) => leg(g, x, y, z, 1.4, 0.28, grey)) };
  } },
  lion: { speed: 0.8, scale: 1, build(g, k) {
    const tan = '#c99a52';
    part(g, sp(1, 0.38, 0.38, 0.85), tan, 0, 0.95, 0);
    part(g, sp(0.3), tan, 0, 1.2, 0.9);
    if (k === 0) part(g, sp(0.48, 1, 1, 0.8), '#7a4a22', 0, 1.2, 0.78); // mane
    part(g, bx(0.18, 0.14, 0.2), shade(tan, 1.1), 0, 1.12, 1.15);
    part(g, cy(0.04, 0.03, 0.9, 6), tan, 0, 0.95, -1.15).rotation.x = -0.9;
    return { legs: [[-0.2, 0.7, 0.5], [0.2, 0.7, 0.5], [-0.2, 0.7, -0.5], [0.2, 0.7, -0.5]].map(([x, y, z]) => leg(g, x, y, z, 0.7, 0.09, tan)) };
  } },
  penguin: { speed: 0.45, scale: 1, waddle: true, build(g) {
    part(g, sp(1, 0.22, 0.36, 0.22), '#1d1f24', 0, 0.42, 0);
    part(g, sp(1, 0.17, 0.3, 0.12), '#f6f6f2', 0, 0.4, 0.11);
    part(g, sp(0.13), '#1d1f24', 0, 0.82, 0.02);
    part(g, new THREE.ConeGeometry(0.035, 0.14, 8).rotateX(Math.PI / 2), '#e8a33a', 0, 0.8, 0.18);
    for (const s of [-1, 1]) part(g, bx(0.04, 0.3, 0.14), '#1d1f24', s * 0.22, 0.45, 0).rotation.z = s * 0.25;
    return { legs: [[-0.08, 0.1, 0.04], [0.08, 0.1, 0.04]].map(([x, y, z]) => leg(g, x, y, z, 0.1, 0.05, '#e8a33a')) };
  } },
  flamingo: { speed: 0.3, scale: 1, build(g) {
    const pink = '#f08aa8';
    part(g, sp(1, 0.2, 0.18, 0.34), pink, 0, 1.05, 0);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.1, 0.25), new THREE.Vector3(0, 1.45, 0.38), new THREE.Vector3(0, 1.6, 0.18), new THREE.Vector3(0, 1.75, 0.3)]);
    part(g, new THREE.TubeGeometry(curve, 12, 0.035, 6), pink, 0, 0, 0);
    part(g, sp(0.07), pink, 0, 1.78, 0.33);
    part(g, new THREE.ConeGeometry(0.03, 0.14, 6).rotateX(2.2), '#1d1f24', 0, 1.72, 0.42);
    return { legs: [leg(g, 0, 0.95, 0, 0.95, 0.018, '#e86a8a')] };
  } },
};
function shade(hex, f) {
  return '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
}

/** Build the zoo's static parts on block b and register its entrance place. */
export function buildZoo(ctx, b) {
  const { group, colliders, K, places } = ctx;
  const Y = K.CURB;
  const cx = b.cx;
  const cz = b.cz;
  const bag = new Bag();
  const name = ctx.cfg.zoo || `${ctx.cfg.name} Zoo`;
  // walkway paving over the whole lawn, then the enclosure grounds
  bag.add(bx(2 * R, 0.04, 2 * R), '#cfc6b4', cx, Y + 0.02, cz);
  for (const e of ENCLOSURES) {
    const x0 = cx + e.sx * WALK;
    const x1 = cx + e.sx * R;
    const z0 = cz + e.sz * WALK;
    const z1 = cz + e.sz * R;
    e.rect = [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)];
    const [ax, az, bxx, bz] = e.rect;
    bag.add(bx(bxx - ax, 0.05, bz - az), e.ground, (ax + bxx) / 2, Y + 0.045, (az + bz) / 2);
    // low stone wall + rail along the walkway sides
    const wx = cx + e.sx * WALK;
    const wz = cz + e.sz * WALK;
    const lenX = R - WALK;
    bag.add(bx(0.35, 0.9, lenX), '#a39a8a', wx, Y + 0.45, cz + e.sz * (WALK + lenX / 2));
    bag.add(bx(lenX, 0.9, 0.35), '#a39a8a', cx + e.sx * (WALK + lenX / 2), Y + 0.45, wz);
    bag.add(bx(0.06, 0.06, lenX), '#4a4f58', wx, Y + 1.35, cz + e.sz * (WALK + lenX / 2));
    bag.add(bx(lenX, 0.06, 0.06), '#4a4f58', cx + e.sx * (WALK + lenX / 2), Y + 1.35, wz);
    for (let t = 0; t <= lenX; t += 2.5) {
      bag.add(bx(0.06, 0.5, 0.06), '#4a4f58', wx, Y + 1.12, cz + e.sz * (WALK + t));
      bag.add(bx(0.06, 0.5, 0.06), '#4a4f58', cx + e.sx * (WALK + t), Y + 1.12, wz);
    }
    colliders.add(wx - 0.2, Math.min(wz, cz + e.sz * R), wx + 0.2, Math.max(wz, cz + e.sz * R), 1.4);
    colliders.add(Math.min(wx, cx + e.sx * R), wz - 0.2, Math.max(wx, cx + e.sx * R), wz + 0.2, 1.4);
    // scenery inside
    const mx = (ax + bxx) / 2;
    const mz = (az + bz) / 2;
    if (e.id === 'savanna') {
      for (const [ox, oz] of [[-4, -5], [5, 3]]) {
        bag.add(cy(0.18, 0.25, 3.2, 8), '#6b4a2a', mx + ox, Y + 1.6, mz + oz);
        bag.add(cy(2.6, 2.2, 0.5, 10), '#5a8a3a', mx + ox, Y + 3.4, mz + oz);
      }
    } else if (e.id === 'elephants') {
      bag.add(cy(3.2, 3.2, 0.06, 24), '#4f8fb0', mx + 3, Y + 0.08, mz + 3);
      for (const [ox, oz, r] of [[-5, -4, 1.4], [-6, 2, 1]]) bag.add(new THREE.DodecahedronGeometry(r, 0), '#8a8072', mx + ox, Y + r * 0.6, mz + oz);
    } else if (e.id === 'lions') {
      for (const [ox, oz, r] of [[3, -3, 2.2], [-4, 4, 1.6], [5, 5, 1.2]]) bag.add(new THREE.DodecahedronGeometry(r, 0).scale(1.3, 0.7, 1), '#b59a72', mx + ox, Y + r * 0.45, mz + oz);
      bag.add(cy(0.2, 0.28, 3, 8), '#6b4a2a', mx - 5, Y + 1.5, mz - 5);
      bag.add(sp(2.2, 1, 0.6, 1), '#6f8f3a', mx - 5, Y + 3.2, mz - 5);
    } else if (e.id === 'penguins') {
      bag.add(bx(9, 0.06, 7), '#3f9fd0', mx + 2, Y + 0.08, mz + 2);
      for (const [ox, oz, r] of [[-5, -4, 1.3], [-3, 4, 0.9], [6, -5, 1.1]]) bag.add(new THREE.DodecahedronGeometry(r, 0), '#f2f6f8', mx + ox, Y + r * 0.5, mz + oz);
    }
    // a sign at the walkway corner
    const sgx = cx + e.sx * (WALK - 0.6);
    const sgz = cz + e.sz * (WALK + 4);
    bag.add(bx(0.08, 1.2, 0.08), '#3a3f48', sgx, Y + 0.6, sgz);
    const tex = labelTexture(e.label, { icon: e.icon, bg: '#2f5a3a', accent: '#e9c04c' });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    sign.position.set(sgx, Y + 1.35, sgz);
    sign.rotation.y = e.sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(sign);
    e.sign = { x: sgx - e.sx * 0.9, z: sgz };
  }
  // flamingo pond in the middle, with a ring of flowers
  bag.add(cy(2.8, 2.8, 0.06, 28), '#4f9fc0', cx, Y + 0.07, cz);
  bag.add(new THREE.TorusGeometry(2.9, 0.18, 6, 28).rotateX(Math.PI / 2), '#8f8a7c', cx, Y + 0.12, cz);
  colliders.add(cx - 2.6, cz - 2.6, cx + 2.6, cz + 2.6, 0.5);
  // outer iron fence with the gate on the south side
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    bag.add(bx(along ? len : 0.06, 0.06, along ? 0.06 : len), '#24382c', (x0 + x1) / 2, Y + 2.0, (z0 + z1) / 2);
    bag.add(bx(along ? len : 0.06, 0.06, along ? 0.06 : len), '#24382c', (x0 + x1) / 2, Y + 0.25, (z0 + z1) / 2);
    for (let t = 0; t <= len; t += 0.45) {
      const k = t / len;
      bag.add(bx(0.04, 2.1, 0.04), '#24382c', x0 + (x1 - x0) * k, Y + 1.05, z0 + (z1 - z0) * k);
    }
    colliders.add(Math.min(x0, x1) - 0.1, Math.min(z0, z1) - 0.1, Math.max(x0, x1) + 0.1, Math.max(z0, z1) + 0.1, 2.2);
  };
  fence(cx - R, cz - R, cx + R, cz - R);
  fence(cx - R, cz - R, cx - R, cz + R);
  fence(cx + R, cz - R, cx + R, cz + R);
  fence(cx - R, cz + R, cx - 2.6, cz + R);
  fence(cx + 2.6, cz + R, cx + R, cz + R);
  // entrance arch
  for (const s of [-1, 1]) {
    bag.add(bx(0.7, 4.6, 0.7), '#7a5a3c', cx + s * 3.1, Y + 2.3, cz + R);
    colliders.add(cx + s * 3.1 - 0.35, cz + R - 0.35, cx + s * 3.1 + 0.35, cz + R + 0.35, 4.6);
  }
  bag.add(bx(7.2, 0.9, 0.5), '#2f5a3a', cx, Y + 4.9, cz + R);
  const archTex = labelTexture(name, { icon: '🦁', bg: '#2f5a3a', accent: '#e9c04c' });
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 0.82), new THREE.MeshBasicMaterial({ map: archTex, toneMapped: false }));
    m.position.set(cx, Y + 4.9, cz + R + s * 0.26);
    if (s < 0) m.rotation.y = Math.PI;
    group.add(m);
  }
  // ticket booth beside the gate (outside)
  bag.add(bx(1.8, 2.4, 1.4), '#e9e2d0', cx + 5, Y + 1.2, cz + R + 1.2);
  bag.add(bx(2.1, 0.15, 1.7), '#2f5a3a', cx + 5, Y + 2.48, cz + R + 1.2);
  colliders.add(cx + 4.1, cz + R + 0.5, cx + 5.9, cz + R + 1.9, 2.5);
  // snack kiosk near the pond
  bag.add(bx(1.6, 1.1, 1.0), '#f4f1ea', cx + 4.6, Y + 0.55, cz + 1.9);
  bag.add(new THREE.ConeGeometry(1.5, 0.6, 8), '#e85c8a', cx + 4.6, Y + 2.6, cz + 1.9);
  bag.add(cy(0.04, 0.04, 1.6, 6), '#b9bdc3', cx + 4.6, Y + 1.6, cz + 1.9);
  colliders.add(cx + 3.8, cz + 1.4, cx + 5.4, cz + 2.4, 1.2);
  // benches along the walkways
  for (const [x, z, ry] of [[-2.6, 12, Math.PI / 2], [2.6, -12, -Math.PI / 2], [12, -2.6, Math.PI], [-12, 2.6, 0]]) {
    bag.add(bx(ry % Math.PI ? 0.5 : 1.6, 0.45, ry % Math.PI ? 1.6 : 0.5), '#7a5a3c', cx + x, Y + 0.45, cz + z);
    ctx.benchSpots?.push({ x: cx + x, z: cz + z, ry });
  }
  group.add(bag.mesh());

  const place = {
    id: 'zoo', type: 'zoo', name, district: b.district, icon: '🦁', color: '#4f8a3a', label: 'Zoo', outdoor: true,
    nx: 0, nz: 1, doorX: cx, doorZ: cz + R, x: cx + 5, z: cz + R + 2.6,
  };
  places.push(place);
  ctx.zoo = { name, cx, cz, enclosures: ENCLOSURES.map((e) => ({ ...e })), kiosk: { x: cx + 4.6, z: cz + 2.9 }, place };
  return ctx.zoo;
}

/** Animals, visitors, the ticket and things to do inside the zoo. */
export class ZooLife {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.animals = [];
    this.visitors = [];
    this.prevInside = false;
  }

  setCity(city) {
    this.clear();
    this.city = city;
    this.data = city.zoo || null;
    if (!this.data) return;
    game(this).scene.add(this.group);
    const rng = mulberry32(31337);
    const Y = city.K.CURB;
    for (const e of this.data.enclosures) {
      for (const [kind, n] of e.species) {
        for (let k = 0; k < n; k++) this.spawn(kind, e.rect, rng, Y, k);
      }
    }
    for (let k = 0; k < 5; k++) this.spawn('flamingo', [this.data.cx - 2.2, this.data.cz - 2.2, this.data.cx + 2.2, this.data.cz + 2.2], rng, Y, k);
  }

  spawn(kind, rect, rng, Y, k) {
    const g = new THREE.Group();
    const parts = SPECIES[kind].build(g, k);
    const pad = kind === 'flamingo' ? 0.3 : 2;
    const a = { kind, g, legs: parts.legs, rect: [rect[0] + pad, rect[1] + pad, rect[2] - pad, rect[3] - pad], x: 0, z: 0, ry: rng() * 6.28, tx: 0, tz: 0, wait: rng() * 4, phase: rng() * 6, moving: false, Y };
    a.x = a.rect[0] + rng() * (a.rect[2] - a.rect[0]);
    a.z = a.rect[1] + rng() * (a.rect[3] - a.rect[1]);
    g.position.set(a.x, Y, a.z);
    this.group.add(g);
    this.animals.push(a);
  }

  clear() {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.group.clear();
    for (const v of this.visitors) v.rig.dispose();
    this.visitors = [];
    this.animals = [];
  }

  open(hr = hourOf(this.game.state.time.total)) {
    return hr >= ZOO_HOURS[0] && hr < ZOO_HOURS[1];
  }

  hasTicket() {
    return this.game.state?.flags.zooDay === this.game.sim?.day;
  }

  inside(p) {
    const d = this.data;
    return !!d && Math.abs(p.x - d.cx) < R && Math.abs(p.z - d.cz) < R;
  }

  /** Turnstile: without a ticket (or after closing) you cannot walk in through the gate. */
  blockPlayer(pos) {
    const d = this.data;
    if (!d) return false;
    const lx = pos.x - d.cx;
    const lz = pos.z - d.cz;
    const wasOutside = !this.prevInside;
    this.prevInside = Math.abs(lx) < R && Math.abs(lz) < R;
    if (!this.prevInside || !wasOutside) return false;
    if (this.hasTicket() && this.open()) return false;
    pos.z = d.cz + R + 0.35;
    this.prevInside = false;
    if (!this._warned || performance.now() - this._warned > 4000) {
      this._warned = performance.now();
      this.game.events.emit('toast', { icon: '🎟️', title: this.open() ? 'Ticket needed' : 'The zoo is closed', text: this.open() ? 'Buy a ticket at the booth by the gate.' : `Open ${ZOO_HOURS[0]} AM – ${ZOO_HOURS[1] - 12} PM.`, kind: 'info' });
    }
    return true;
  }

  update(dt, playerPos, visible) {
    if (!this.data) return;
    this.group.visible = visible;
    if (!visible) return;
    const near = (playerPos.x - this.data.cx) ** 2 + (playerPos.z - this.data.cz) ** 2 < 120 * 120;
    if (!near) return;
    for (const a of this.animals) {
      const sp = SPECIES[a.kind];
      if (!a.moving) {
        a.wait -= dt;
        if (a.wait <= 0) {
          a.tx = a.rect[0] + Math.random() * (a.rect[2] - a.rect[0]);
          a.tz = a.rect[1] + Math.random() * (a.rect[3] - a.rect[1]);
          a.moving = true;
        }
      } else {
        const dx = a.tx - a.x;
        const dz = a.tz - a.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.2) {
          a.moving = false;
          a.wait = 3 + Math.random() * 8;
        } else {
          const step = Math.min(d, sp.speed * dt);
          a.x += (dx / d) * step;
          a.z += (dz / d) * step;
          a.ry = dampAngle(a.ry, Math.atan2(dx, dz), 2.5, dt);
        }
      }
      a.phase += dt * (a.moving ? sp.speed * 4.2 : 0);
      const swing = a.moving ? 0.45 : 0;
      a.legs.forEach((l, k) => (l.rotation.x = Math.sin(a.phase + (k === 0 || k === 3 ? 0 : Math.PI)) * swing));
      a.g.position.set(a.x, a.Y + (a.moving ? Math.abs(Math.sin(a.phase)) * 0.03 : 0), a.z);
      a.g.rotation.y = a.ry;
      a.g.rotation.z = sp.waddle && a.moving ? Math.sin(a.phase) * 0.15 : 0;
    }
    this.updateVisitors(dt, playerPos);
  }

  /** A few visitors at the enclosure walls during opening hours. */
  updateVisitors(dt, playerPos) {
    const want = this.open() ? 8 : 0;
    if (this.visitors.length !== want) {
      for (const v of this.visitors) {
        v.rig.group.removeFromParent();
        v.rig.dispose();
      }
      this.visitors = [];
      const rng = mulberry32(777 + (this.game.sim?.day || 0));
      const d = this.data;
      for (let k = 0; k < want; k++) {
        const e = d.enclosures[k % 4];
        const along = WALK + 3 + rng() * 15;
        const onX = rng() < 0.5;
        const x = d.cx + (onX ? e.sx * (WALK - 0.7) : e.sx * along);
        const z = d.cz + (onX ? e.sz * along : e.sz * (WALK - 0.7));
        const rig = createRig(roleAppearance(rng() < 0.5 ? 'tourist' : rng() < 0.5 ? 'student' : 'civilian', rng));
        rig.group.position.set(x, this.city.K.CURB, z);
        rig.group.rotation.y = onX ? Math.atan2(e.sx, 0) : Math.atan2(0, e.sz);
        this.group.add(rig.group);
        this.visitors.push({ rig, talk: rng() < 0.4 });
      }
    }
    for (const v of this.visitors) animateRig(v.rig, dt, { speed: 0, grounded: true, talking: v.talk, waving: false });
    void playerPos;
  }

  /** Things to do: watch an enclosure, buy a snack, the ticket booth. */
  interactable(pos) {
    const d = this.data;
    if (!d) return null;
    if (this.inside(pos)) {
      for (const e of d.enclosures) {
        if ((e.sign.x - pos.x) ** 2 + (e.sign.z - pos.z) ** 2 < 2.4 * 2.4) return { label: `${e.icon} Watch the ${e.label.toLowerCase()}`, action: () => this.watch(e) };
      }
      if ((d.kiosk.x - pos.x) ** 2 + (d.kiosk.z - pos.z) ** 2 < 2.2 * 2.2) return { label: '🍦 Zoo snack kiosk', action: () => this.kiosk() };
    }
    return null;
  }

  watch(e) {
    const game = this.game;
    game.fade(() => {
      game.sim.advance(20, { noCollapse: true });
      addNeed(game.sim, 'fun', 10);
      addNeed(game.sim, 'social', 2);
      game.state.stats.zooAnimals = (game.state.stats.zooAnimals || 0) + 1;
    });
    game.events.emit('toast', { icon: e.icon, title: e.label, text: e.fact, kind: 'good', long: true });
  }

  kiosk() {
    const game = this.game;
    const sim = game.sim;
    const price = Math.round(5 * (sim.city.priceIndex || 1));
    if (!sim.finance.spend(price, 'food', 'Zoo ice cream')) return;
    addNeed(sim, 'hunger', 10);
    addNeed(sim, 'fun', 6);
    game.events.emit('toast', { icon: '🍦', title: 'Ice cream', text: 'Strawberry, dripping down the cone. A flamingo looks jealous.', kind: 'good' });
  }

  /** Ticket booth at the gate. */
  openBooth(place) {
    const game = this.game;
    const sim = game.sim;
    const st = game.state;
    const price = Math.round(28 * (sim.city.priceIndex || 1));
    const has = this.hasTicket();
    const el = dialog(game, {
      title: `🦁 ${place.name}`,
      body: h(
        'div.menu-col',
        h('div.muted', `Giraffes, zebras, elephants, lions, penguins and flamingos. Open ${ZOO_HOURS[0]} AM – ${ZOO_HOURS[1] - 12} PM daily.`),
        has
          ? h('div.good', '🎟️ You have a ticket for today. Walk through the gate!')
          : !this.open()
            ? h('div.bad', 'The zoo is closed right now. Come back in the morning.')
            : btn(`🎟️  Day ticket  ·  ${fmtMoney(price)}`, () => {
                if (!sim.finance.spend(price, 'fun', `Ticket · ${place.name}`)) return;
                st.flags.zooDay = sim.day;
                st.stats.zooVisits = (st.stats.zooVisits || 0) + 1;
                game.audio?.play('cash');
                game.closeOverlay(el);
                game.events.emit('toast', { icon: '🎟️', title: 'Enjoy the zoo!', text: 'Your ticket is good all day. The gate is right here.', kind: 'good' });
              }, 'primary'),
      ),
    });
  }
}
const game = (z) => z.game;
