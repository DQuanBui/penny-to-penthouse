// Litter and trash: crumpled paper, cans, cups and bottles on the pavements and
// in the gutters; bags piled at the kerb in the evening; corner bins that
// overflow by night. It builds up through the day and is cleared in the
// morning (by the garbage truck and the street washer: see Cleaning.js, or by
// crews out of sight). You can pick litter up and bin it yourself.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hourOf, dayOf } from '../core/Clock.js';
import { mulberry32, hashStr, pick } from '../core/utils.js';

const VIEW = 95; // pieces further than this aren't drawn
const FAR = 42; // crews only add or clear litter this far from you (no popping)

// kinds: [geometry, base height above the ground, material options]
function kinds() {
  const cyl = (r0, r1, h, s = 7) => new THREE.CylinderGeometry(r0, r1, h, s);
  return [
    { id: 'paper', geo: new THREE.IcosahedronGeometry(0.065, 0).scale(1, 0.7, 1), y: 0.04, mat: { roughness: 0.9 } },
    { id: 'can', geo: cyl(0.033, 0.033, 0.12).rotateZ(Math.PI / 2), y: 0.033, mat: { roughness: 0.35, metalness: 0.55 } },
    { id: 'cup', geo: cyl(0.045, 0.032, 0.11).rotateZ(Math.PI / 2), y: 0.042, mat: { roughness: 0.7 } },
    { id: 'wrapper', geo: new THREE.BoxGeometry(0.17, 0.008, 0.1), y: 0.005, mat: { roughness: 0.5, metalness: 0.2 } },
    { id: 'bottle', geo: mergeGeometries([cyl(0.035, 0.035, 0.17), cyl(0.013, 0.03, 0.07).translate(0, 0.12, 0)]).rotateZ(Math.PI / 2), y: 0.035, mat: { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.8 } },
    { id: 'bag', geo: mergeGeometries([new THREE.SphereGeometry(0.3, 8, 6).scale(1, 0.85, 0.9), new THREE.ConeGeometry(0.07, 0.14, 6).translate(0, 0.29, 0)]), y: 0.24, mat: { roughness: 0.32, metalness: 0.05 } },
    { id: 'box', geo: new THREE.BoxGeometry(0.5, 0.34, 0.4), y: 0.17, mat: { roughness: 0.95 } },
  ];
}
const LITTER_COLORS = {
  paper: ['#f2f0e8', '#e8e2cf', '#d9d6cc', '#c9c4b2'],
  can: ['#c53a3a', '#c9ced6', '#2f6fd0', '#3f9a4a', '#e9c04c'],
  cup: ['#f4f1ea', '#f4f1ea', '#7a4a2a', '#c53a3a'],
  wrapper: ['#e9c04c', '#c53a3a', '#3f76d0', '#e06a9a', '#f07a1a'],
  bottle: ['#3f8a4a', '#9fc4dc', '#7a4a2a'],
};
const BAG_COLORS = ['#1b1c20', '#1b1c20', '#1b1c20', '#26302a', '#e8e8e2', '#3a6fc0'];

/** How much litter lies about (0..1) at an hour of the day. */
export function litterDensity(h) {
  if (h < 4) return 0.72;
  if (h < 8) return 0.72 - ((h - 4) / 4) * 0.6; // crews clean up through the early morning
  return 0.12 + ((h - 8) / 16) * 0.6;
}

export class CityTrash {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.K = kinds();
    this.meshes = this.K.map((k) => {
      const m = new THREE.InstancedMesh(k.geo, new THREE.MeshStandardMaterial({ color: '#ffffff', ...k.mat }), 1);
      m.frustumCulled = false; // refilled with only the nearby pieces
      m.count = 0;
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    });
    this.picked = 0;
  }

  setCity(city) {
    this.group.removeFromParent();
    this.city = city;
    const rng = mulberry32(hashStr(city.cfg.name + ':trash'));
    const { K, blocks } = city;
    const Y = K.CURB;
    const P = (this.pieces = []); // { k, x, y, z, ry, s, color, on, zone }
    const kindIx = Object.fromEntries(this.K.map((k, i) => [k.id, i]));
    const add = (id, x, y, z, s = 1, color = null, zone = 'walk') => {
      const ix = kindIx[id];
      P.push({ k: ix, x, y: y + this.K[ix].y * s, z, ry: rng() * Math.PI * 2, s, color: new THREE.Color(color || pick(rng, LITTER_COLORS[id])), on: false, zone });
      return P.length - 1;
    };
    const LIT = ['paper', 'paper', 'paper', 'cup', 'cup', 'can', 'can', 'wrapper', 'wrapper', 'bottle'];
    this.litter = [];
    this.piles = [];
    const doors = city.places.filter((p) => p.doorX !== undefined);
    const nearDoor = (x, z, r) => doors.some((p) => (p.doorX - x) ** 2 + (p.doorZ - z) ** 2 < r * r);
    const parked = city.parkedCars || [];
    for (const b of blocks) {
      const dense = b.style?.lots !== 'houses';
      for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const tx = -nz;
        const tz = nx;
        const ex = b.cx + nx * (K.BLOCK / 2);
        const ez = b.cz + nz * (K.BLOCK / 2);
        const at = (t, inward) => [ex + tx * t - nx * inward, ez + tz * t - nz * inward];
        // pavement litter
        const n = Math.floor(rng() * (dense ? 5 : 3));
        for (let i = 0; i < n; i++) {
          const [x, z] = at((rng() - 0.5) * (K.BLOCK - 5), 0.5 + rng() * 3.9);
          this.litter.push(add(pick(rng, LIT), x, Y, z));
        }
        // gutter litter (washed away by the street washer)
        const g = Math.floor(rng() * 3);
        for (let i = 0; i < g; i++) {
          const [x, z] = at((rng() - 0.5) * (K.BLOCK - 3), -0.15 - rng() * 0.45);
          this.litter.push(add(pick(rng, LIT), x, 0.01, z, 1, null, 'gutter'));
        }
        // bags put out at the kerb for the morning pickup (commercial streets)
        if (!dense || b.kind !== 'build' || rng() > 0.55) continue;
        const t = pick(rng, [-13.8, 2.6, 13.8, 9.2]);
        const [px, pz] = at(t, 1.0);
        if (nearDoor(px, pz, 3.5)) continue;
        // keep a gap in the parked cars so the crew can reach it
        const lx = px + nx * 3.05;
        const lz = pz + nz * 3.05;
        if (parked.some((c) => (c.x - lx) ** 2 + (c.z - lz) ** 2 < 3.6 * 3.6)) continue;
        const items = [];
        const m = 3 + Math.floor(rng() * 4);
        for (let i = 0; i < m; i++) {
          const u = (i - (m - 1) / 2) * 0.42 + (rng() - 0.5) * 0.15;
          const v = (rng() - 0.5) * 0.45;
          const x = px + tx * u - nx * v;
          const z = pz + tz * u - nz * v;
          if (rng() < 0.15) items.push(add('box', x, Y, z, 0.8 + rng() * 0.4, pick(rng, ['#b08a5a', '#a67c4e', '#c29a66'])));
          else items.push(add('bag', x, Y, z, 0.75 + rng() * 0.45, pick(rng, BAG_COLORS)));
        }
        this.piles.push({ kind: 'kerb', x: px, z: pz, nx, nz, items, outAt: 18 + rng() * 3.5, out: false, done: -99 });
      }
    }
    // corner bins overflow by night: a bag stuffed on top, a cup and papers around
    for (const bin of city.bins || []) {
      if (rng() > 0.6) continue;
      const items = [add('bag', bin.x, Y + 0.84, bin.z, 0.72, pick(rng, BAG_COLORS))];
      const c = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < c; i++) {
        const a = rng() * Math.PI * 2;
        const r = 0.45 + rng() * 0.5;
        items.push(add(pick(rng, ['paper', 'cup', 'can', 'paper']), bin.x + Math.cos(a) * r, Y, bin.z + Math.sin(a) * r));
      }
      this.piles.push({ kind: 'bin', x: bin.x, z: bin.z, items, outAt: 15.5 + rng() * 4, out: false, done: -99 });
    }
    for (const i of this.litter) P[i].litter = true;
    const h = this.hour();
    const d = litterDensity(h);
    this.onCount = 0;
    for (const i of this.litter) if ((P[i].on = rng() < d)) this.onCount++;
    for (const p of this.piles) this.setPile(p, this.pileWanted(p, h, true));
    this.t = 0;
    this.last = null;
    this.game.scene.add(this.group);
    this.refresh();
  }

  hour() {
    return this.game.state ? hourOf(this.game.state.time.total) : 12;
  }

  /** Which "trash night" it is: from the evening until noon the next day. */
  nightKey() {
    const total = this.game.state?.time.total || 0;
    return hourOf(total) >= 12 ? dayOf(total) : dayOf(total) - 1;
  }

  pileWanted(p, h, initial = false) {
    if (p.done === this.nightKey()) return false;
    const evening = h >= p.outAt;
    const morning = h < (initial ? 9 : 12);
    return evening || morning;
  }

  setPile(p, out) {
    p.out = out;
    for (const i of p.items) this.pieces[i].on = out;
  }

  /** The crew takes one item off a pile (returns the piece, or null when it's empty). */
  takeFrom(p) {
    const i = p.items.find((k) => this.pieces[k].on);
    if (i === undefined) {
      p.out = false;
      p.done = this.nightKey();
      return null;
    }
    this.pieces[i].on = false;
    this.dirty = true;
    if (!p.items.some((k) => this.pieces[k].on)) {
      p.out = false;
      p.done = this.nightKey();
    }
    return this.pieces[i];
  }

  /** Clear litter in a circle (the washer and the pavement sweepers). zone: 'gutter' | 'walk' | null (both). */
  clearAround(x, z, r, zone = null) {
    let n = 0;
    for (const i of this.near || []) {
      const q = this.pieces[i];
      if (!q.on || q.litter !== true || (zone && q.zone !== zone)) continue;
      if ((q.x - x) ** 2 + (q.z - z) ** 2 < r * r) {
        q.on = false;
        this.onCount--;
        n++;
      }
    }
    if (n) this.dirty = true;
    return n;
  }

  update(dt, pos, inside) {
    if (!this.city || !this.game.state) return;
    this.group.visible = !inside;
    if (inside) return;
    this.t -= dt;
    const moved = !this.last || (this.last.x - pos.x) ** 2 + (this.last.z - pos.z) ** 2 > 16;
    if (this.t > 0 && !moved && !this.dirty) return;
    this.t = 0.4;
    const h = this.hour();
    // litter drifts toward the density for this hour, out of your sight
    const target = litterDensity(h) * this.litter.length;
    const diff = target - this.onCount;
    if (Math.abs(diff) > 4) {
      const want = diff > 0;
      let n = Math.min(12, Math.ceil(Math.abs(diff) / 40));
      for (let tries = 0; tries < 60 && n > 0; tries++) {
        const q = this.pieces[this.litter[Math.floor(Math.random() * this.litter.length)]];
        if (q.on === want || (q.x - pos.x) ** 2 + (q.z - pos.z) ** 2 < FAR * FAR) continue;
        q.on = want;
        this.onCount += want ? 1 : -1;
        n--;
      }
    }
    // bags go out in the evening; the ones the truck didn't reach are picked up by late morning
    for (const p of this.piles) {
      const far = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2 > 30 * 30;
      if (!p.out && this.pileWanted(p, h) && (far || h > p.outAt + 1.5) && p.done !== this.nightKey()) this.setPile(p, true);
      else if (p.out && h >= 10 && h < 12 && far) {
        this.setPile(p, false);
        p.done = this.nightKey();
      }
    }
    this.refresh(pos);
  }

  refresh(pos = this.game.player?.pos) {
    this.dirty = false;
    if (!pos) return;
    this.last = { x: pos.x, z: pos.z };
    const show = this.meshes.map(() => []);
    this.near = [];
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      if ((p.x - pos.x) ** 2 + (p.z - pos.z) ** 2 > VIEW * VIEW) continue;
      this.near.push(i);
      if (p.on) show[p.k].push(p);
    }
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const v = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    show.forEach((list, k) => {
      if (list.length > this.meshes[k].instanceMatrix.count) this.grow(k, list.length);
      const m = this.meshes[k];
      list.forEach((p, n) => {
        q.setFromAxisAngle(up, p.ry);
        m4.compose(v.set(p.x, p.y, p.z), q, s.setScalar(p.s));
        m.setMatrixAt(n, m4);
        m.setColorAt(n, p.color);
      });
      m.count = list.length;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
  }

  /** Make room for more instances of a kind. */
  grow(k, need) {
    const old = this.meshes[k];
    const m = new THREE.InstancedMesh(old.geometry, old.material, Math.ceil(need * 1.5) + 16);
    m.frustumCulled = false;
    m.count = 0;
    m.receiveShadow = true;
    old.removeFromParent();
    old.dispose();
    this.group.add(m);
    this.meshes[k] = m;
  }

  /** Pick up a bit of litter next to you. */
  interactable(pos) {
    let best = null;
    for (const i of this.near || []) {
      const q = this.pieces[i];
      if (!q.on || !q.litter) continue;
      const d = (q.x - pos.x) ** 2 + (q.z - pos.z) ** 2;
      if (d < 1.3 * 1.3 && (!best || d < best.d)) best = { q, d };
    }
    if (!best) return null;
    return { label: '🗑️ Pick up the litter', action: () => this.pickUp(best.q) };
  }

  pickUp(q) {
    const game = this.game;
    q.on = false;
    this.onCount--;
    this.dirty = true;
    this.picked++;
    const st = game.state;
    const day = dayOf(st.time.total);
    if (st.flags.litterDay !== day) {
      st.flags.litterDay = day;
      st.flags.litterN = 0;
    }
    st.flags.litterN = (st.flags.litterN || 0) + 1;
    st.flags.litterTotal = (st.flags.litterTotal || 0) + 1;
    game.audio?.play('click');
    // the first few each day lift your mood a little
    if (st.flags.litterN <= 5) {
      st.needs.fun = Math.min(100, st.needs.fun + 1);
      st.needs.social = Math.min(100, st.needs.social + 1);
    }
    const LINES = ['A passer-by gives you a nod.', 'Into the bin it goes. The block looks a little better.', 'Somebody has to. Today it was you.', 'A kid sees you do it, and picks up a wrapper too.', 'The corner looks better already.'];
    if (st.flags.litterN <= 3 || st.flags.litterN % 10 === 0) game.events.emit('toast', { icon: '🗑️', title: st.flags.litterN % 10 === 0 ? `${st.flags.litterN} bits of litter today!` : 'Binned it', text: LINES[st.flags.litterTotal % LINES.length], kind: 'good' });
  }
}
