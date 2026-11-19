// A city beach off the waterfront promenade: sand sloping into the water,
// umbrellas, towels, loungers, a lifeguard tower, a volleyball court, a
// sandcastle and surfboards. BeachLife fills it with people: sunbathers,
// swimmers, volleyball and frisbee players, waders, a lifeguard, beachcombers.
// The player can walk in, wade, swim, sunbathe and join the volleyball game.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Tex, labelTexture } from './Textures.js';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { roleAppearance } from '../characters/Customization.js';

export const WATER_Y = -0.45;
const DRY = 14; // flat dry sand (m out from the promenade)
const SLOPE = 0.075;
const OUT = 56; // how far the swimming area reaches
const TAPER = 16;

/** Where the beach goes: cfg.beach = { name, side, at (0..1 along the side), length }. */
export function beachSpec(cfg, ctx) {
  const b = cfg.beach;
  if (!b || !(cfg.waterfront || []).includes(b.side)) return null;
  const [ox, oz] = { east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1] }[b.side];
  const len = b.length || 200;
  const ac = -ctx.half + (b.at ?? 0.5) * (ctx.half * 2);
  return { ...b, ox, oz, a0: ac - len / 2, a1: ac + len / 2, ac, edge: ctx.half + ctx.K.PROM, name: b.name || 'City Beach' };
}

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Sand height at along-coordinate a, distance d out from the promenade edge. */
function sandAt(spec, a, d) {
  const base = d < DRY ? 0.1 - d * 0.004 : 0.1 - DRY * 0.004 - (d - DRY) * SLOPE;
  const s = Math.min(a - spec.a0, spec.a1 - a);
  const taper = Math.max(0, TAPER - s) * 0.1 * (0.35 + 0.65 * smooth(0, 20, d));
  return Math.max(-3.4, base - taper);
}

/** Beach coordinates of a world point: { a, d } or null when off the beach. */
export function onBeach(spec, x, z, pad = 0) {
  if (!spec) return null;
  const a = spec.ox ? z : x;
  const o = spec.ox ? x * spec.ox : z * spec.oz;
  const d = o - spec.edge;
  if (a < spec.a0 - pad || a > spec.a1 + pad || d < -0.6 || d > OUT + pad) return null;
  return { a, d };
}

/** Ground height on the beach (or null). */
export function beachY(spec, x, z) {
  const p = onBeach(spec, x, z);
  if (!p || p.d < 0) return null;
  return sandAt(spec, p.a, p.d);
}

/** World position of beach coordinates. */
const at = (spec, a, d) => (spec.ox ? [spec.ox * (spec.edge + d), a] : [a, spec.oz * (spec.edge + d)]);

class Bag {
  constructor() {
    this.list = [];
  }
  add(geo, color, x, y, z, ry = 0) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    if (ry) geo.rotateY(ry);
    geo.translate(x, y, z);
    const n = geo.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    geo.deleteAttribute('uv');
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(geo);
  }
}
const bx = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cy = (r0, r1, h, x = 0, y = 0, z = 0, s = 8) => new THREE.CylinderGeometry(r0, r1, h, s).translate(x, y, z);
const UMB = [['#e84a4a', '#f4f1ea'], ['#2f6db5', '#f4f1ea'], ['#f2b33d', '#e86ab0'], ['#2f8f8f', '#f2c230'], ['#7a3fd0', '#f4f1ea'], ['#ff7a45', '#2f6db5']];
const TOWEL = ['#e84a4a', '#2f6db5', '#f2b33d', '#3fd0a0', '#e86ab0', '#7a3fd0', '#ff7a45', '#f4f1ea'];

export function buildBeach(ctx, spec) {
  const { group, colliders, rng, K } = ctx;
  const { ox, oz, a0, a1, ac } = spec;
  // facing out to sea, and back toward the city
  const sea = Math.atan2(ox, oz);
  const land = Math.atan2(-ox, -oz);

  // --- the sand: a displaced plane, wet and darker toward the water ----------
  const L = a1 - a0 + 48;
  const D = OUT + 6;
  const geo = new THREE.PlaneGeometry(L, D, Math.round(L / 3), Math.round(D / 1.5));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const dry = new THREE.Color('#f0dfb4');
  const wet = new THREE.Color('#b99a68');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const a = ac + pos.getX(i);
    const d = pos.getZ(i) + D / 2 - 0.6;
    const y = sandAt(spec, a, d);
    const [x, z] = at(spec, a, d);
    pos.setXYZ(i, x, y, z);
    tmp.copy(dry).lerp(wet, smooth(-0.1, -0.5, y));
    cols.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  // mirrored mappings (north, east) flip the winding: keep the faces pointing up
  if (oz === -1 || ox === 1) geo.index.array.reverse();
  geo.computeVertexNormals();
  const sandTex = Tex.sand().clone();
  sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
  sandTex.repeat.set(L / 6, D / 6);
  sandTex.needsUpdate = true;
  const sand = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: sandTex, vertexColors: true, roughness: 1 }));
  sand.receiveShadow = true;
  group.add(sand);

  // turquoise shallows and a line of foam that laps in and out
  const shoreD = DRY + (0.1 - DRY * 0.004 - WATER_Y) / SLOPE;
  const strip = (len, w, d, color, op) => {
    const g = new THREE.PlaneGeometry(ox ? w : len, ox ? len : w).rotateX(-Math.PI / 2);
    const [x, z] = at(spec, ac, d);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
    m.position.set(x, WATER_Y + 0.012, z);
    group.add(m);
    return m;
  };
  strip(a1 - a0 - 20, 18, shoreD + 9, '#5fd6d0', 0.32);
  const foam = strip(a1 - a0 - 2 * TAPER, 1.1, shoreD, '#ffffff', 0.5);
  const foam2 = strip(a1 - a0 - 2 * TAPER - 10, 0.6, shoreD + 3, '#ffffff', 0.3);
  ctx.animated.push((t) => {
    const w = Math.sin(t * 0.8);
    const [x, z] = at(spec, ac, shoreD + 0.4 + w * 0.7);
    foam.position.x = x;
    foam.position.z = z;
    foam.material.opacity = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.8 + 1.2));
    const [x2, z2] = at(spec, ac, shoreD + 3.5 + Math.sin(t * 0.8 - 1.4) * 1.2);
    foam2.position.x = x2;
    foam2.position.z = z2;
  });

  // keep people on the beach: end walls and a buoy line far out
  const wall = (aA, dA, aB, dB) => {
    const [x0, z0] = at(spec, aA, dA);
    const [x1, z1] = at(spec, aB, dB);
    colliders.add(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), 4, -8);
  };
  wall(a0 - 1, -0.6, a0, OUT);
  wall(a1, -0.6, a1 + 1, OUT);
  wall(a0, OUT - 1, a1, OUT);
  const [c0x, c0z] = at(spec, a0, -1.2);
  const [c1x, c1z] = at(spec, a1, OUT + 1);
  colliders.corridors = [...(colliders.corridors || []), { minX: Math.min(c0x, c1x), maxX: Math.max(c0x, c1x), minZ: Math.min(c0z, c1z), maxZ: Math.max(c0z, c1z) }];

  // --- furniture: merged, vertex-coloured --------------------------------------
  const bag = new Bag();
  const put = (geo, color, a, d, ry = 0, lift = 0) => {
    const [x, z] = at(spec, a, d);
    bag.add(geo, color, x, sandAt(spec, a, d) + lift, z, ry);
  };
  const solid = (a, d, r, h = 2) => {
    const [x, z] = at(spec, a, d);
    colliders.add(x - r, z - r, x + r, z + r, sandAt(spec, a, d) + h, -4);
  };
  // buoys along the swimming line
  for (let a = a0 + 6; a < a1 - 4; a += 8) put(new THREE.SphereGeometry(0.3, 8, 6), (a / 8) & 1 ? '#ff6a2a' : '#f4f1ea', a, OUT - 1, 0, WATER_Y - sandAt(spec, a, OUT - 1) + 0.08);

  const towels = [];
  const loungers = [];
  const court = { a: ac - 58, d: 8.5 };
  const tower = { a: ac + 4, d: 15.5 };
  for (let a = a0 + 14; a <= a1 - 14; a += 15) {
    if (Math.abs(a - court.a) < 14 || Math.abs(a - tower.a) < 6) continue;
    for (const d of [6.5 + rng() * 1.5, 12 + rng() * 1.5]) {
      const aa = a + (rng() - 0.5) * 5;
      const [c1, c2] = UMB[Math.floor(rng() * UMB.length)];
      // umbrella: tilted pole and striped canopy
      put(cy(0.03, 0.03, 2.4, 0, 1.2, 0, 6), '#e8e4da', aa, d);
      for (let i = 0; i < 8; i++) put(new THREE.ConeGeometry(1.35, 0.5, 1, 1, true, (i * Math.PI) / 4, Math.PI / 4).translate(0, 2.45, 0), i % 2 ? c2 : c1, aa, d);
      solid(aa, d, 0.12, 2.4);
      // a towel or two beside it, and sometimes a lounger
      for (const side of [-1, 1]) {
        if (rng() < 0.25) continue;
        const ta = aa + side * 1.3;
        const td = d + 0.3;
        if (rng() < 0.3) {
          put(bx(0.65, 0.08, 1.9, 0, 0.3, 0), '#f4f1ea', ta, td, sea);
          put(bx(0.65, 0.06, 0.7, 0, 0.55, -0.85).rotateX(0), '#f4f1ea', ta, td, sea);
          for (const [lx, lz] of [[-0.28, -0.85], [0.28, -0.85], [-0.28, 0.85], [0.28, 0.85]]) put(cy(0.02, 0.02, 0.3, lx, 0.15, lz, 5), '#9aa2ad', ta, td, sea);
          loungers.push({ a: ta, d: td });
        } else {
          put(bx(0.9, 0.02, 1.85, 0, 0.01, 0), TOWEL[Math.floor(rng() * TOWEL.length)], ta, td, sea + (rng() - 0.5) * 0.3);
          towels.push({ a: ta, d: td });
        }
      }
      // a cooler or a beach bag
      if (rng() < 0.45) put(bx(0.5, 0.36, 0.34, 0, 0.18, 0), pick2(rng, ['#2f6db5', '#e84a4a', '#f4f1ea']), aa + 0.5, d - 1.1, rng() * 3);
    }
  }
  // lifeguard tower: stilts, a seat platform, a red cross flag
  {
    const { a, d } = tower;
    for (const [lx, lz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) put(cy(0.06, 0.08, 2.2, lx, 1.1, lz, 6), '#f4f1ea', a, d, sea);
    put(bx(1.7, 0.1, 1.7, 0, 2.2, 0), '#f4f1ea', a, d, sea);
    put(bx(0.9, 0.06, 0.6, 0, 2.6, -0.2), '#c53a3a', a, d, sea);
    put(bx(0.9, 0.7, 0.06, 0, 2.95, -0.5), '#c53a3a', a, d, sea);
    for (let s = 0; s < 5; s++) put(bx(0.6, 0.05, 0.18, 0, 0.35 + s * 0.42, -1.05 - s * 0.2), '#e8e4da', a, d, sea);
    put(cy(0.03, 0.03, 2.2, 0.75, 3.3, -0.75, 5), '#e8e4da', a, d, sea);
    put(bx(0.02, 0.5, 0.8, 0.75, 4.15, -0.35), '#c53a3a', a, d, sea);
    put(cy(0.9, 0.9, 0.06, 0, 3.7, -0.2, 10), '#c53a3a', a, d, sea);
    solid(a, d, 0.95, 2.4);
  }
  // volleyball court: posts, net, boundary lines
  {
    const { a, d } = court;
    const across = ox ? Math.PI / 2 : 0; // the net runs out toward the sea
    for (const s of [-1, 1]) put(cy(0.05, 0.05, 2.5, 0, 1.25, s * 4.6), '#e8e4da', a, d, across);
    // the net itself: a see-through mesh texture between the posts
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g2 = c.getContext('2d');
    g2.strokeStyle = '#1d1f24';
    g2.lineWidth = 6;
    g2.strokeRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(9 / 0.12, 0.9 / 0.12);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.9).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
    net.material.userData.ownMap = true;
    const [nx, nz] = at(spec, a, d);
    net.position.set(nx, sandAt(spec, a, d) + 1.95, nz);
    net.rotation.y = across;
    group.add(net);
    put(bx(0.035, 0.08, 9.1, 0, 2.43, 0), '#f4f1ea', a, d, across);
    const line = (w, l, la, ld) => put(bx(w, 0.015, l, 0, 0.01, 0), '#f4f1ea', a + la, d + ld, ox ? 0 : Math.PI / 2);
    for (const s of [-1, 1]) {
      line(0.08, 16, 0, s * 4);
      line(8, 0.08, s * 8, 0);
    }
    for (const s of [-1, 1]) solid(a, d + s * 4.6, 0.12, 2.5);
  }
  // sandcastle, surfboards, a beach sign on the promenade
  {
    const a = ac + 14;
    const d = 17;
    put(cy(0.9, 1.1, 0.4, 0, 0.2, 0, 10), '#d8c08a', a, d);
    for (const [cx, cz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
      put(cy(0.22, 0.26, 0.7, cx, 0.55, cz, 8), '#d8c08a', a, d);
      put(new THREE.ConeGeometry(0.26, 0.32, 8).translate(cx, 1.06, cz), '#d0b47a', a, d);
    }
    put(cy(0.32, 0.36, 0.9, 0, 0.75, 0, 8), '#d8c08a', a, d);
    put(new THREE.ConeGeometry(0.36, 0.5, 8).translate(0, 1.45, 0), '#d0b47a', a, d);
    put(new THREE.TorusGeometry(1.5, 0.18, 4, 18).rotateX(Math.PI / 2).translate(0, 0.02, 0), '#b99a68', a, d);
    for (let i = 0; i < 4; i++) put(new THREE.CapsuleGeometry(0.24, 1.8, 4, 8).scale(1, 1, 0.22).translate(i * 0.7 - 1, 1.15, 0), ['#ff7a45', '#2f8f8f', '#f2c230', '#e84a4a'][i], ac + 62, 15.5, land + 0.1);
    solid(ac + 62, 15.5, 1.4, 2.4);
  }
  const mesh = new THREE.Mesh(mergeGeometries(bag.list), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  // the beach's name over the entrance
  {
    const [x, z] = at(spec, ac, -2.4);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), new THREE.MeshBasicMaterial({ map: labelTexture(spec.name, { icon: '🏖️', bg: '#2f8f8f', accent: '#f2c230' }), toneMapped: false, side: THREE.DoubleSide }));
    sign.material.userData.ownMap = true;
    sign.position.set(x, K.CURB + 4.3, z);
    sign.rotation.y = land;
    group.add(sign);
    for (const s of [-1, 1]) {
      const [px, pz] = at(spec, ac + s * 3.7, -2.4);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5.2, 8), new THREE.MeshStandardMaterial({ color: '#e8e4da', roughness: 0.6 }));
      post.position.set(px, K.CURB + 2.6, pz);
      post.castShadow = true;
      group.add(post);
      colliders.add(px - 0.15, pz - 0.15, px + 0.15, pz + 0.15, 5.5);
    }
  }
  // an ice-cream cart at the top of the sand (drawn by FoodCarts with the others)
  const [vx, vz] = at(spec, ac - 22, 3);
  ctx.vendors.push({ x: vx, z: vz, ry: land, kind: 'cart', cart: 'icecream', id: 'beach_cart' });
  colliders.add(vx - 1, vz - 1, vx + 1, vz + 1, 1.4);

  const w = (p) => {
    const [x, z] = at(spec, p.a, p.d);
    return { ...p, x, z, y: sandAt(spec, p.a, p.d) };
  };
  ctx.beach = { ...spec, sea, land, towels: towels.map(w), loungers: loungers.map(w), court: w(court), tower: w(tower), shoreD, at: (a, d) => at(spec, a, d), y: (a, d) => sandAt(spec, a, d) };
}

const pick2 = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// ------------------------------------------------------------------ people
function beachLook(rng, kind) {
  const a = roleAppearance('beach', rng);
  if (kind === 'guard') Object.assign(a, { top: 'tank', topColor: '#c53a3a', bottom: 'shorts', bottomColor: '#c53a3a', accessory: 'sunglasses', hat: 'none' });
  else if (rng() < 0.4) a.topColor = a.skin; // shirtless / swimsuit look
  return a;
}

/** A foam ring around someone swimming. */
function ring() {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.62, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false }));
  return m;
}

export class BeachLife {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.people = [];
    this.balls = [];
    this.playerRing = ring();
  }

  setCity(city) {
    this.clear();
    this.city = city;
    this.beach = city.beach;
    if (this.beach) this.game.scene.add(this.group);
  }

  clear() {
    for (const p of this.people) p.rig.dispose();
    this.people = [];
    this.balls = [];
    this.group.clear();
    this.group.removeFromParent();
  }

  add(kind, a, d, ry, extra = {}) {
    const rng = Math.random;
    const rig = createRig(beachLook(rng, kind));
    const p = { kind, rig, a, d, ry, t: Math.random() * 10, ...extra };
    if (kind === 'lie') {
      rig.group.rotation.order = 'YXZ';
      rig.group.rotation.x = -Math.PI / 2;
    }
    if (kind === 'swim') {
      p.ring = ring();
      this.group.add(p.ring);
    }
    this.group.add(rig.group);
    this.people.push(p);
    return p;
  }

  spawn() {
    const B = this.beach;
    const r = Math.random;
    // sunbathers and sitters on the towels; one reads on a lounger
    const towels = [...B.towels].sort(() => r() - 0.5);
    towels.slice(0, 6).forEach((t) => this.add('lie', t.a, t.d, B.land, { towel: t }));
    towels.slice(6, 10).forEach((t) => this.add('sit', t.a, t.d - 0.4, B.sea, { towel: t }));
    for (const l of B.loungers.slice(0, 2)) this.add('lounge', l.a, l.d, B.sea);
    B.taken = new Set(towels.slice(0, 10));
    // volleyball: two a side
    const c = B.court;
    this.volley = { team: [], ball: null };
    for (const s of [-1, 1]) for (const dd of [-2, 2]) this.volley.team.push(this.add('volley', c.a + s * 4, c.d + dd, 0, { side: s, home: [c.a + s * 4, c.d + dd] }));
    this.volley.ball = this.ball('#f4f1ea', 0.13);
    this.volley.toss = { from: 0, to: 2, t: 0, dur: 1.5, h: 4 };
    // frisbee pair by the water
    const fa = B.ac + 34;
    const fr = [this.add('toss', fa - 5, B.shoreD - 3, 0), this.add('toss', fa + 5, B.shoreD - 3, 0)];
    this.frisbee = { team: fr, ball: this.ball('#ff7a45', 0.16, true), toss: { from: 0, to: 1, t: 0, dur: 1.4, h: 1.2 } };
    // swimmers and waders
    for (let i = 0; i < 7; i++) this.add('swim', B.a0 + 25 + r() * (B.a1 - B.a0 - 50), B.shoreD + 15 + r() * 18, r() * 6, { tx: 0, td: 0, wait: 0 });
    for (let i = 0; i < 3; i++) this.add('wade', B.ac - 30 + r() * 60, B.shoreD + 2 + r() * 3, B.land + (r() - 0.5));
    // the lifeguard in the tower, watching the water
    const tw = B.tower;
    this.add('guard', tw.a, tw.d, B.sea);
    // beachcombers walking along the shore
    for (let i = 0; i < 3; i++) this.add('walk', B.a0 + 20 + r() * (B.a1 - B.a0 - 40), B.shoreD - 1.5 - r() * 1.5, 0, { dir: r() < 0.5 ? -1 : 1, speed: i === 0 ? 2.6 : 1.1 });
  }

  ball(color, r, flat = false) {
    const geo = flat ? new THREE.CylinderGeometry(r, r * 0.9, 0.035, 14) : new THREE.SphereGeometry(r, 12, 8);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    m.castShadow = true;
    this.group.add(m);
    return m;
  }

  /** Who can catch the ball: the team plus the player when they joined. */
  members(game) {
    const list = game.team.map((p) => ({ x: () => this.posOf(p), npc: p }));
    if (game === this.volley && this.game.player.emote?.id === 'volley') list.push({ x: () => this.game.player.pos, player: true });
    return list;
  }

  posOf(p) {
    const [x, z] = this.beach.at(p.a, p.d);
    return { x, y: this.beach.y(p.a, p.d), z };
  }

  /** A ball (or frisbee) flying from one person to another. */
  playBall(g, dt) {
    const m = this.members(g);
    const T = g.toss;
    T.t += dt / T.dur;
    if (T.from >= m.length) T.from = 0;
    if (T.to >= m.length) T.to = (T.from + 1) % m.length;
    const A = m[T.from].x();
    const B = m[T.to].x();
    if (T.t >= 1) {
      // caught: the catcher hits it on to someone else
      const hitter = m[T.to];
      if (hitter.npc) hitter.npc.hit = 0.45;
      if (hitter.player) this.onPlayerHit?.();
      T.from = T.to;
      let next = T.from;
      while (next === T.from) next = Math.floor(Math.random() * m.length);
      // volleyball crosses the net more often than not
      if (g === this.volley && m[next].npc && hitter.npc && m[next].npc.side === hitter.npc.side && Math.random() < 0.6) {
        const other = m.findIndex((q) => q.npc && q.npc.side !== hitter.npc.side);
        if (other >= 0) next = other;
      }
      T.to = next;
      T.t = 0;
      T.dur = (g === this.volley ? 1.3 : 1.2) + Math.random() * 0.5;
      return;
    }
    const t = T.t;
    g.ball.position.set(A.x + (B.x - A.x) * t, Math.max(A.y, B.y) + 1.7 + Math.sin(t * Math.PI) * T.h, A.z + (B.z - A.z) * t);
    g.ball.rotation.y += dt * 8;
  }

  update(dt, playerPos, visible) {
    const B = this.beach;
    if (!B) return;
    this.updatePlayer(dt);
    this.group.visible = visible;
    if (!visible) return;
    const [cx, cz] = B.at(B.ac, 20);
    const near = (playerPos.x - cx) ** 2 + (playerPos.z - cz) ** 2 < 190 * 190;
    if (!near) return;
    if (!this.people.length) this.spawn();
    this.playBall(this.volley, dt);
    this.playBall(this.frisbee, dt);
    for (const p of this.people) this.step(p, dt);
  }

  step(p, dt) {
    const B = this.beach;
    p.t += dt;
    const g = p.rig.group;
    let pose = { speed: 0, grounded: true };
    let [x, z] = B.at(p.a, p.d);
    let y = B.y(p.a, p.d);
    let ry = p.ry;
    switch (p.kind) {
      case 'lie':
        // feet toward the sea, head up the beach, face to the sky
        [x, z] = B.at(p.a, p.d + 0.9);
        y = B.y(p.a, p.d) + 0.12;
        ry = B.sea;
        pose = { speed: 0, grounded: true, lying: true };
        break;
      case 'sit':
        pose = { speed: 0, grounded: true, floor: true, talking: Math.sin(p.t * 0.3) > 0.6 };
        break;
      case 'lounge':
        y -= 0.14;
        pose = { speed: 0, grounded: true, sitting: true, phone: Math.sin(p.t * 0.2) > 0.3 };
        break;
      case 'guard':
        y += 2.25 - 0.48 + 0.02;
        pose = { speed: 0, grounded: true, sitting: true, waving: Math.sin(p.t * 0.25) > 0.97 };
        break;
      case 'volley':
      case 'toss': {
        p.hit = Math.max(0, (p.hit || 0) - dt);
        // face the ball
        const game = p.kind === 'volley' ? this.volley : this.frisbee;
        ry = Math.atan2(game.ball.position.x - x, game.ball.position.z - z);
        pose = { speed: 0, grounded: true, cheering: p.hit > 0 };
        if (p.hit > 0) y += Math.sin((p.hit / 0.45) * Math.PI) * 0.3;
        break;
      }
      case 'swim': {
        if (p.wait > 0) p.wait -= dt;
        else {
          if (!p.tx) {
            p.tx = Math.min(B.a1 - 18, Math.max(B.a0 + 18, p.a + (Math.random() - 0.5) * 30));
            p.td = Math.min(OUT - 4, Math.max(B.shoreD + 13, p.d + (Math.random() - 0.5) * 14));
          }
          const da = p.tx - p.a;
          const dd = p.td - p.d;
          const len = Math.hypot(da, dd);
          if (len < 0.5) {
            p.tx = 0;
            p.wait = 2 + Math.random() * 5;
          } else {
            p.a += (da / len) * 0.7 * dt;
            p.d += (dd / len) * 0.7 * dt;
            [x, z] = B.at(p.a, p.d);
            const [x2, z2] = B.at(p.a + da, p.d + dd);
            ry = p.ry = Math.atan2(x2 - x, z2 - z);
          }
        }
        y = WATER_Y - 1.3 + Math.sin(p.t * 2.2) * 0.04;
        pose = { speed: 0, grounded: true, swimming: true, swimMove: p.wait > 0 ? 0 : 0.7 };
        p.ring.position.set(x, WATER_Y + 0.02, z);
        p.ring.material.opacity = 0.3 + Math.sin(p.t * 3) * 0.12;
        break;
      }
      case 'wade':
        pose = { speed: 0, grounded: true, cheering: Math.sin(p.t * 0.7) > 0.8 };
        break;
      case 'walk': {
        p.a += p.dir * p.speed * dt;
        if (p.a > B.a1 - 18 || p.a < B.a0 + 18) p.dir *= -1;
        [x, z] = B.at(p.a, p.d);
        const [x2, z2] = B.at(p.a + p.dir, p.d);
        ry = Math.atan2(x2 - x, z2 - z);
        y = B.y(p.a, p.d);
        pose = { speed: p.speed, grounded: true };
        break;
      }
    }
    g.position.set(x, y, z);
    g.rotation.y = ry;
    animateRig(p.rig, dt, pose);
  }

  // ---------------------------------------------------------------- the player
  /** Swimming when the water is deep enough; wading slows you down. */
  updatePlayer(dt) {
    const pl = this.game.player;
    const B = this.beach;
    const on = onBeach(B, pl.pos.x, pl.pos.z);
    const depth = on && on.d > 0 ? WATER_Y - B.y(on.a, on.d) : 0;
    const swim = depth > 1.0 && !pl.riding && !this.game.vehicles.driving;
    if (swim !== pl.swimming) {
      pl.swimming = swim;
      if (swim) {
        pl.emote = null;
        this.game.hud.hint('swim', 'Swimming! Keep an eye on your Energy. Walk back up the sand to get out.', 7);
        this.game.audio?.play('splash');
        this.game.state.stats.swims = (this.game.state.stats.swims || 0) + 1;
      }
    }
    pl.wading = depth > 0.25 && !swim;
    pl.floatY = swim ? WATER_Y - 1.3 : null;
    pl.speedMul = swim ? 0.45 : pl.wading ? 0.7 : 1;
    if (swim && !this.playerRing.parent) this.group.add(this.playerRing);
    else if (!swim && this.playerRing.parent) this.group.remove(this.playerRing);
    if (swim) {
      this.playerRing.position.set(pl.pos.x, WATER_Y + 0.02, pl.pos.z);
      this.playerRing.scale.setScalar(1 + Math.min(1, pl.speed / 2) * 0.4);
    }
  }

  /** Beach interactions: sunbathe on a free towel, join the volleyball game. */
  interactable(p) {
    const B = this.beach;
    if (!B || !onBeach(B, p.x, p.z, 2)) return null;
    const c = B.court;
    if ((c.x - p.x) ** 2 + (c.z - p.z) ** 2 < 9 * 9 && this.game.player.emote?.id !== 'volley') return { label: '🏐 Join the volleyball game', action: () => this.joinVolley() };
    for (const t of B.towels) {
      if (B.taken?.has(t)) continue;
      if ((t.x - p.x) ** 2 + (t.z - p.z) ** 2 < 1.8 * 1.8) return { label: '🏖️ Lie down and soak up the sun', action: () => this.sunbathe(t) };
    }
    return null;
  }

  sunbathe(t) {
    const game = this.game;
    const pl = game.player;
    pl.sitting = true;
    pl.lying = true;
    pl.sitLift = 0.12;
    pl.sitExit = { x: t.x + Math.sin(this.beach.land) * 1.4, z: t.z + Math.cos(this.beach.land) * 1.4 };
    // feet toward the sea, head toward the city
    pl.teleport(t.x + Math.sin(this.beach.sea) * 0.9, t.z + Math.cos(this.beach.sea) * 0.9, this.beach.sea);
    game.hud.hint('sunbathe', 'Sunbathing restores Fun and Energy. Move (W A S D) to get up.', 7);
  }

  joinVolley() {
    const game = this.game;
    const c = this.beach.court;
    // take a spot on the side with the gap
    const [x, z] = this.beach.at(c.a + 4, c.d);
    game.player.teleport(x, z, Math.atan2(c.x - x, c.z - z));
    game.player.emote = { id: 'volley', held: true, t: 0 };
    game.hud.hint('volley', 'The ball comes to you automatically. Move to leave the game.', 6);
    this.onPlayerHit = () => {
      game.player.emote && (game.player.emote.hit = 0.45);
      game.audio?.play('click');
    };
  }
}
