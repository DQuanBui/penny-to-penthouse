// A great suspension bridge striding out from the waterfront promenade:
// stone towers with pointed arches, sweeping main cables, vertical
// suspenders and the diagonal stay "web", a raised wooden walkway with
// lamps and benches, and a lookout where the walk ends. Walkable: the city
// asks bridgeGround() for the deck height and the corridor lifts the bounds.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Tex, labelTexture } from './Textures.js';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { roleAppearance } from '../characters/Customization.js';

const WALK = 3.2; // half-width of the walkway
const RISE = 50; // ramp length up to the deck
const DECK = 5.8; // deck height above the promenade
export const TOWERS = [80, 240]; // distances of the towers from the shore
export const WALK_END = 300; // where the walkway ends (lookout)
const SPAN_END = 720; // the deck carries on towards the far shore

/** Which waterfront gets the bridge and where it starts. */
export function bridgeSpec(cfg, ctx) {
  const wf = cfg.waterfront || [];
  if (!wf.length) return null;
  const side = ['south', 'east', 'north', 'west'].find((s) => wf.includes(s));
  const k = Math.floor(ctx.N / 2) - (side === 'south' || side === 'north' ? 1 : 0);
  const along = ctx.roadCenter(k);
  const start = ctx.half + ctx.K.PROM; // the promenade's water edge
  const [ox, oz] = { east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1] }[side];
  return { side, along, start, ox, oz, name: cfg.bridge || `${cfg.name} Harbor Bridge`, style: cfg.bridgeStyle || 'stone' };
}

/** Deck height at distance d from the shore (0 at the promenade). */
export const deckY = (d, curb) => curb + Math.min(1, Math.max(0, d) / RISE) ** 0.9 * DECK;

/** Is a point on the walkway? Returns its distance from the shore or -1. */
export function onWalkway(spec, x, z, pad = 0) {
  if (!spec) return -1;
  const a = spec.ox ? z : x;
  const o = spec.ox ? x * spec.ox : z * spec.oz;
  const d = o - spec.start + 0.6;
  if (Math.abs(a - spec.along) > WALK + pad || d < -0.6 || d > WALK_END + 2) return -1;
  return Math.max(0, d);
}

class Bag {
  constructor() {
    this.list = [];
  }
  add(geo, color) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    const c = new THREE.Color(color);
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(geo);
  }
  mesh(opts = {}) {
    const m = new THREE.Mesh(mergeGeometries(this.list), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, ...opts }));
    m.castShadow = m.receiveShadow = true;
    return m;
  }
}

export function buildBridge(ctx, spec) {
  const { group, colliders, K } = ctx;
  const Y = K.CURB;
  const { ox, oz, along, start } = spec;
  // world position from (a = across the bridge, d = distance out from the shore, y)
  const W = (a, d, y = 0) => (ox ? new THREE.Vector3(ox * (start + d), y, along + a) : new THREE.Vector3(along + a, y, oz * (start + d)));
  // a box spanning across a (wa) and along d (wd), centred at (a, d)
  const boxAt = (bag, a, d, y, wa, h, wd, color) => {
    const p = W(a, d, y);
    bag.add(new THREE.BoxGeometry(ox ? wd : wa, h, ox ? wa : wd).translate(p.x, p.y, p.z), color);
  };
  const stone = spec.style === 'stone' ? '#b3a389' : '#d9dde2';
  const steel = spec.style === 'stone' ? '#5a5f68' : '#e8ecef';
  const bag = new Bag();

  // ---- deck: ramp + roadway on both sides of the raised walkway ----
  for (let d = 0; d < SPAN_END; d += 10) {
    const y0 = deckY(d, Y);
    const y1 = deckY(d + 10, Y);
    const y = (y0 + y1) / 2;
    // roadways (visual), lower than the walkway, and the deck girders under them
    for (const s of [-1, 1]) boxAt(bag, s * 8.6, d + 5, y - 1.4, 9.5, 0.5, 10.05, '#4a4e55');
    boxAt(bag, 0, d + 5, y - 2.4, 26, 1.6, 10.05, steel);
    if (d < WALK_END) {
      // walkway rails: posts + top rail; the rails are also colliders
      for (const s of [-1, 1]) {
        boxAt(bag, s * (WALK + 0.1), d + 5, y + 1.05, 0.08, 0.08, 10.05, steel);
        for (let t = 0; t < 10; t += 2.5) boxAt(bag, s * (WALK + 0.1), d + t, y + 0.55, 0.07, 1.0, 0.07, steel);
        const p0 = W(s * (WALK + 0.15), d);
        const p1 = W(s * (WALK + 0.15), d + 10);
        colliders.add(Math.min(p0.x, p1.x) - 0.08, Math.min(p0.z, p1.z) - 0.08, Math.max(p0.x, p1.x) + 0.08, Math.max(p0.z, p1.z) + 0.08, y + 2);
      }
    }
  }
  // walkway planks (wood texture), following the ramp
  const plankMat = new THREE.MeshStandardMaterial({ map: Tex.wood(), roughness: 0.9 });
  for (let d = 0; d < WALK_END; d += 5) {
    const y0 = deckY(d, Y);
    const y1 = deckY(d + 5, Y);
    const g = new THREE.BoxGeometry(ox ? 5.05 : WALK * 2, 0.2, ox ? WALK * 2 : 5.05);
    const m = new THREE.Mesh(g, plankMat);
    const p = W(0, d + 2.5, (y0 + y1) / 2 - 0.1);
    m.position.copy(p);
    const tilt = Math.atan2(y1 - y0, 5);
    if (ox) m.rotation.z = ox * tilt;
    else m.rotation.x = -oz * tilt;
    m.receiveShadow = true;
    group.add(m);
  }
  // the far end of the walk: a lookout with a railing
  const yEnd = deckY(WALK_END, Y);
  boxAt(bag, 0, WALK_END + 0.1, yEnd + 0.55, WALK * 2 + 0.2, 1.1, 0.12, steel);
  {
    const p0 = W(-WALK - 0.2, WALK_END);
    const p1 = W(WALK + 0.2, WALK_END + 0.4);
    colliders.add(Math.min(p0.x, p1.x), Math.min(p0.z, p1.z), Math.max(p0.x, p1.x), Math.max(p0.z, p1.z), yEnd + 2);
  }

  // ---- towers: piers with pointed (gothic) arches over the walkway and roads ----
  const top = DECK + 52;
  for (const td of TOWERS) {
    const yd = deckY(td, Y);
    for (const a of [-13.2, -4.9, 4.9, 13.2]) boxAt(bag, a, td, (yd - 8 + top) / 2, a === -4.9 || a === 4.9 ? 2.8 : 3.6, top - yd + 8 + 8, 7, stone);
    // above the arches: solid stone with a cornice
    boxAt(bag, 0, td, top - 4, 30, 14, 7, stone);
    boxAt(bag, 0, td, top + 3.3, 31.5, 0.8, 8, '#9a8b72');
    // pointed arch heads (two triangles of stone over each opening)
    for (const a of [-9.05, 0, 9.05]) {
      const span = a === 0 ? 7 : 4.7;
      const shape = new THREE.Shape([new THREE.Vector2(-span, 0), new THREE.Vector2(span, 0), new THREE.Vector2(span, 6), new THREE.Vector2(0, 2.2), new THREE.Vector2(-span, 6)]);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 7, bevelEnabled: false }).translate(0, 0, -3.5);
      if (ox) geo.rotateY(Math.PI / 2);
      const p = W(a, td, top - 17);
      bag.add(geo.translate(p.x, p.y, p.z), stone);
    }
    for (const a of [-13.2, -4.9, 4.9, 13.2]) {
      const p = W(a, td);
      const w = a === -4.9 || a === 4.9 ? 1.4 : 1.8;
      colliders.add(p.x - (ox ? 3.5 : w), p.z - (ox ? w : 3.5), p.x + (ox ? 3.5 : w), p.z + (ox ? w : 3.5), top + 10);
    }
  }

  // ---- cables: main cables, suspenders and the diagonal stays ----
  const cableY = (d) => {
    // tower to tower: a sagging curve; outside: straight down to the anchorages
    const [t0, t1] = TOWERS;
    const yT = top + 2;
    if (d <= t0) return deckY(0, Y) + 2 + ((yT - deckY(0, Y) - 2) * d) / t0;
    if (d >= t1) return yT - ((yT - deckY(t1, Y) - 2) * Math.min(1, (d - t1) / t0));
    const k = (d - t0) / (t1 - t0);
    return yT - (yT - (deckY(160, Y) + 2.5)) * 4 * k * (1 - k);
  };
  const lines = [];
  for (const a of [-9.6, -3.9, 3.9, 9.6]) {
    const pts = [];
    for (let d = 0; d <= TOWERS[1] + TOWERS[0]; d += 8) pts.push(W(a, d, cableY(d)));
    const tubeG = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.28, 6);
    bag.add(tubeG, steel);
    // suspenders down to the deck
    for (let d = 4; d < TOWERS[1] + TOWERS[0]; d += 4) {
      const pTop = W(a, d, cableY(d));
      const pBot = W(a, d, deckY(d, Y) - 0.9);
      lines.push(pTop, pBot);
    }
    // stays fanning from each tower top
    for (const td of TOWERS) {
      for (let k = 1; k <= 9; k++) {
        for (const s of [-1, 1]) {
          const d = td + s * k * 7;
          lines.push(W(a, td, top + 1), W(a, d, deckY(d, Y) - 0.9));
        }
      }
    }
  }
  const lg = new THREE.BufferGeometry().setFromPoints(lines);
  group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: spec.style === 'stone' ? '#3a3f48' : '#c9ced6' })));
  group.add(bag.mesh());

  // ---- lamps on the walkway and lights strung along the cables (lit at night) ----
  const lampMat = new THREE.MeshStandardMaterial({ color: '#fff1c4', emissive: '#ffcf80', emissiveIntensity: 0.2 });
  const glow = [];
  const lampGeo = new THREE.SphereGeometry(0.22, 10, 8);
  const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 3.4, 8);
  const postMat = new THREE.MeshStandardMaterial({ color: '#2b2d33', roughness: 0.5 });
  for (let d = 10; d < WALK_END; d += 22) {
    for (const s of [-1, 1]) {
      const y = deckY(d, Y);
      const p = W(s * (WALK - 0.25), d, y + 1.7);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.copy(p);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.copy(p).add(new THREE.Vector3(0, 1.8, 0));
      group.add(post, lamp);
    }
  }
  const bulbGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const bulbs = new THREE.InstancedMesh(bulbGeo, lampMat, 4 * Math.ceil((TOWERS[1] + TOWERS[0]) / 12));
  let bi = 0;
  const mtx = new THREE.Matrix4();
  for (const a of [-9.6, -3.9, 3.9, 9.6]) {
    for (let d = 6; d < TOWERS[1] + TOWERS[0] && bi < bulbs.count; d += 12) {
      mtx.makeTranslation(W(a, d, cableY(d) - 0.3));
      bulbs.setMatrixAt(bi++, mtx);
    }
  }
  bulbs.count = bi;
  group.add(bulbs);
  glow.push(lampMat);

  // ---- benches facing out over the water, and the name on the first tower ----
  for (let d = 20; d < WALK_END - 8; d += 26) {
    for (const s of [-1, 1]) {
      if ((d / 26 + (s > 0 ? 0 : 1)) % 2 < 1) continue;
      const y = deckY(d, Y);
      const p = W(s * (WALK - 0.55), d, y + 0.25);
      const ry = ox ? (s > 0 ? Math.PI : 0) : s > 0 ? -Math.PI / 2 : Math.PI / 2;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(ox ? 1.6 : 0.5, 0.45, ox ? 0.5 : 1.6), new THREE.MeshStandardMaterial({ color: '#6b4a2a', roughness: 0.8 }));
      bench.position.copy(p);
      group.add(bench);
      ctx.benchSpots?.push({ x: p.x, z: p.z, ry: ry + Math.PI, y: p.y - 0.25 });
    }
  }
  const tex = labelTexture(spec.name, { icon: '🌉', bg: '#2b2f3a', accent: '#e9c04c' });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.2), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  const sp = W(0, TOWERS[0] - 3.6, top - 6);
  sign.position.copy(sp);
  sign.rotation.y = Math.atan2(-ox, -oz);
  group.add(sign);

  // the walkway may leave the city's usual bounds
  const c0 = W(-WALK - 0.3, -1);
  const c1 = W(WALK + 0.3, WALK_END + 1);
  colliders.corridors = [...(colliders.corridors || []), { minX: Math.min(c0.x, c1.x), maxX: Math.max(c0.x, c1.x), minZ: Math.min(c0.z, c1.z), maxZ: Math.max(c0.z, c1.z) }];
  ctx.bridge = { ...spec, lookout: W(0, WALK_END - 3), mid: W(0, (TOWERS[0] + TOWERS[1]) / 2), glow };
  return ctx.bridge;
}

/** A few people strolling, jogging and sitting on the bridge walkway. */
export class BridgeLife {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.people = [];
  }

  setCity(city) {
    this.clear();
    this.city = city;
    this.spec = city.bridge;
    if (this.spec) this.game.scene.add(this.group);
  }

  clear() {
    for (const p of this.people) p.rig.dispose();
    this.people = [];
    this.group.clear();
    this.group.removeFromParent();
  }

  spawn() {
    const roles = ['tourist', 'tourist', 'civilian', 'jogger', 'civilian', 'student', 'business'];
    for (let k = 0; k < roles.length; k++) {
      const rig = createRig(roleAppearance(roles[k], Math.random));
      const jog = roles[k] === 'jogger';
      this.people.push({ rig, d: 10 + Math.random() * (WALK_END - 20), a: (Math.random() - 0.5) * 3.4, dir: Math.random() < 0.5 ? 1 : -1, speed: jog ? 2.8 : 1 + Math.random() * 0.4, pause: Math.random() * 6 });
      this.group.add(rig.group);
    }
  }

  update(dt, playerPos, visible) {
    const s = this.spec;
    if (!s) return;
    this.group.visible = visible;
    if (!visible) return;
    const near = onWalkway(s, playerPos.x, playerPos.z, 40) >= 0 || Math.hypot(playerPos.x - (s.ox ? s.ox * s.start : s.along), playerPos.z - (s.ox ? s.along : s.oz * s.start)) < 120;
    if (near && !this.people.length) this.spawn();
    if (!this.people.length) return;
    const Y = this.city.K.CURB;
    for (const p of this.people) {
      let v = 0;
      if (p.pause > 0) p.pause -= dt;
      else {
        v = p.speed;
        p.d += p.dir * v * dt;
        if (p.d < 6 || p.d > WALK_END - 6) {
          p.dir *= -1;
          p.pause = 2 + Math.random() * 5;
        }
      }
      const pos = s.ox ? [s.ox * (s.start + p.d), s.along + p.a] : [s.along + p.a, s.oz * (s.start + p.d)];
      p.rig.group.position.set(pos[0], deckY(p.d, Y), pos[1]);
      const fwd = s.ox ? Math.atan2(s.ox * p.dir, 0) : Math.atan2(0, s.oz * p.dir);
      p.rig.group.rotation.y = p.pause > 0 ? fwd + Math.PI / 2 * Math.sign(p.a || 1) : fwd;
      animateRig(p.rig, dt, { speed: v, grounded: true, talking: p.pause > 0 && Math.random() < 0.01 });
    }
  }
}
