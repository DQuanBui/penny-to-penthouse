// The morning clean-up, on the streets around you:
//  · a garbage truck works its way down the block; two crew ride the back step,
//    hop off at each pile, carry the bags and the bin liners to the hopper and
//    toss them in (the traffic queues up behind it, as it should)
//  · a street washer sprays the gutters clean, its brushes spinning, leaving a
//    wet sheen on the road that dries out behind it
//  · porters push a cart and broom along the pavements, sweeping up litter
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { vehicleGeometry, carMaterial, glassMaterial, BODIES } from './CarModel.js';
import { LANE_IN } from './Vehicles.js';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { roleAppearance } from '../characters/Customization.js';
import { hourOf } from '../core/Clock.js';

const HOURS = { garbage: [5, 10.5], washer: [4, 9.5], porter: [6, 11] };
const CRUISE = { garbage: 4.2, washer: 3.0 };
const NEAR = 150;
const WALK = 1.7;

const inHours = (h, [a, b]) => h >= a && h < b;

function truckGroup(type, color) {
  const g = new THREE.Group();
  const { body, glass } = vehicleGeometry(type);
  const m = new THREE.InstancedMesh(body, carMaterial(), 1);
  m.setMatrixAt(0, new THREE.Matrix4());
  m.setColorAt(0, new THREE.Color(color));
  m.castShadow = true;
  g.add(m);
  if (glass) {
    const gm = new THREE.InstancedMesh(glass, glassMaterial(), 1);
    gm.setMatrixAt(0, new THREE.Matrix4());
    g.add(gm);
  }
  return g;
}

/** A rotating gutter brush: a disc with bristle tufts. */
function brushMesh() {
  const parts = [new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10)];
  for (let i = 0; i < 10; i++) parts.push(new THREE.BoxGeometry(0.42, 0.05, 0.05).translate(0.24, -0.02, 0).rotateY((i / 10) * Math.PI * 2));
  return new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ color: '#e9a31a', roughness: 0.8 }));
}

export class CityCleaning {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.wetMat = new THREE.MeshStandardMaterial({ color: '#05070a', transparent: true, opacity: 0.4, roughness: 0.08, metalness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.wetGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  }

  setCity(city) {
    this.clear();
    this.city = city;
    this.trash = this.game.trash;
    this.game.scene.add(this.group);
    this.cool = { garbage: 2, washer: 6, porter: 1 };
  }

  clear() {
    for (const k of ['garbage', 'washer']) this.despawn(k);
    for (const p of this.porters || []) this.dropPorter(p);
    this.porters = [];
    for (const w of this.wet || []) w.mesh.removeFromParent();
    this.wet = [];
    this.group.removeFromParent();
  }

  // ---- routes ---------------------------------------------------------------
  /** A straight run along a road near you, in the right-hand lane. */
  route(pos, scorePiles) {
    const c = this.city;
    const half = c.half;
    let best = null;
    for (let k = 0; k <= c.N; k++) {
      const rc = c.roadCenter(k);
      for (const axis of ['x', 'z']) {
        const lat = axis === 'z' ? pos.x - rc : pos.z - rc;
        if (Math.abs(lat) > 70) continue;
        for (const dir of [1, -1]) {
          const ry = axis === 'z' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          const fx = Math.sin(ry);
          const fz = Math.cos(ry);
          const rx = -fz;
          const rz = fx;
          const along = axis === 'z' ? pos.z : pos.x;
          const a0 = Math.max(-half + 12, Math.min(half - 12, along - dir * 62));
          const R = { axis, c: rc, dir, ry, fx, fz, rx, rz, a: a0, end: dir > 0 ? half - 10 : -half + 10 };
          let s = -Math.abs(lat) / 12 + Math.random() * 2;
          if (scorePiles) for (const p of this.trash.piles) if (p.out && this.onRight(R, p) && (this.along(R, p) - a0) * dir > 0 && (this.along(R, p) - a0) * dir < 170) s += 10;
          const [sx, sz] = this.at(R, a0);
          if ((sx - pos.x) ** 2 + (sz - pos.z) ** 2 < 30 * 30) s -= 50; // don't appear right next to you
          if (!best || s > best.s) best = { R, s };
        }
      }
    }
    return best?.R;
  }

  /** The run down the street next to a pile, with the pile on the right, starting a little before it. */
  routeFor(p, back = 14) {
    const half = this.city.half;
    let R;
    if (p.nx) {
      const ry = p.nx > 0 ? 0 : Math.PI;
      R = { axis: 'z', c: p.x + p.nx * 8, dir: p.nx > 0 ? 1 : -1, ry };
    } else {
      const ry = p.nz > 0 ? -Math.PI / 2 : Math.PI / 2;
      R = { axis: 'x', c: p.z + p.nz * 8, dir: p.nz > 0 ? -1 : 1, ry };
    }
    R.fx = Math.sin(R.ry);
    R.fz = Math.cos(R.ry);
    R.rx = -R.fz;
    R.rz = R.fx;
    R.a = this.along(R, p) - R.dir * back;
    R.end = R.dir > 0 ? half - 10 : -half + 10;
    return R;
  }

  at(R, a, lat = LANE_IN) {
    return R.axis === 'z' ? [R.c + R.rx * lat, a] : [a, R.c + R.rz * lat];
  }
  along(R, p) {
    return R.axis === 'z' ? p.z : p.x;
  }
  lateral(R, p) {
    return R.axis === 'z' ? (p.x - R.c) * R.rx : (p.z - R.c) * R.rz;
  }
  onRight(R, p) {
    const l = this.lateral(R, p);
    return l > 6.2 && l < 9.4;
  }

  // ---- trucks ---------------------------------------------------------------
  spawn(kind, pos, R = this.route(pos, kind === 'garbage')) {
    if (!R) return;
    const g = truckGroup(kind === 'garbage' ? 'garbage' : 'sweeper', kind === 'garbage' ? '#3f6e4a' : '#f4f4f2');
    const T = { kind, R, g, v: 0, L: BODIES[kind === 'garbage' ? 'garbage' : 'sweeper'].L, pile: null, blocker: { x: 0, z: 0, hw: 1.15, hl: 3.8 } };
    if (kind === 'garbage') {
      T.crew = [-1, 1].map((slot) => {
        const rig = createRig(roleAppearance('sanitation', Math.random));
        this.group.add(rig.group);
        const held = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6).scale(1, 0.85, 0.9), new THREE.MeshStandardMaterial({ roughness: 0.32 }));
        held.visible = false;
        this.group.add(held);
        return { rig, slot, state: 'ride', held, x: 0, z: 0, ry: 0, t: 0 };
      });
    } else {
      T.brushes = [-1, 1].map((s) => {
        const b = brushMesh();
        b.position.set(s * 0.95, 0.1, T.L - 0.35);
        g.add(b);
        return b;
      });
      this.makeSpray(T);
    }
    this.group.add(g);
    (this.game.traffic.blockers ||= []).push(T.blocker);
    this[kind] = T;
    this.place(T);
  }

  despawn(kind) {
    const T = this[kind];
    if (!T) return;
    T.g.removeFromParent();
    for (const w of T.crew || []) {
      w.rig.group.removeFromParent();
      w.rig.dispose();
      w.held.removeFromParent();
    }
    if (T.spray) T.spray.removeFromParent();
    const bl = this.game.traffic.blockers;
    if (bl) bl.splice(bl.indexOf(T.blocker) >>> 0, 1);
    if (T.pile) T.pile.busy = false;
    this[kind] = null;
  }

  place(T) {
    const [x, z] = this.at(T.R, T.R.a);
    T.g.position.set(x, 0, z);
    T.g.rotation.y = T.R.ry;
    T.blocker.x = x;
    T.blocker.z = z;
  }

  /** Something in the lane ahead: you, or a car. */
  blocked(T, pos) {
    const R = T.R;
    const [x, z] = this.at(R, R.a);
    const ahead = (px, pz) => (px - x) * R.fx + (pz - z) * R.fz;
    const side = (px, pz) => Math.abs((px - x) * R.rx + (pz - z) * R.rz);
    const pa = ahead(pos.x, pos.z);
    if (pa > 0 && pa < T.L + 4 && side(pos.x, pos.z) < 2.2) return true;
    const tr = this.game.traffic;
    for (let i = 0; i < tr.n; i++) {
      if (!tr.alive[i]) continue;
      const a = ahead(tr.x[i], tr.z[i]);
      if (a > 0.5 && a < T.L + 6 && side(tr.x[i], tr.z[i]) < 1.5) return true;
    }
    return false;
  }

  drive(T, dt, pos, target) {
    const R = T.R;
    if (this.blocked(T, pos)) target = 0;
    const toEnd = (R.end - R.a) * R.dir;
    target = Math.min(target, Math.max(0, toEnd * 0.5));
    T.v += Math.max(-4 * dt, Math.min(2 * dt, target - T.v));
    R.a += T.v * dt * R.dir;
    this.place(T);
    return toEnd;
  }

  updateGarbage(T, dt, pos) {
    const R = T.R;
    const tr = this.trash;
    if (!T.pile) {
      // the next pile on the right, just behind the cab
      let next = null;
      for (const p of tr.piles) {
        if (!p.out || p.busy || !this.onRight(R, p)) continue;
        const ahead = (this.along(R, p) - R.a) * R.dir + 0.6;
        if (ahead > -0.8 && ahead < 14 && (!next || ahead < next.ahead)) next = { p, ahead };
      }
      let target = CRUISE.garbage;
      if (next) {
        target = Math.min(target, Math.max(0.5, next.ahead * 0.6));
        if (next.ahead < 0.25) {
          target = 0;
          if (T.v < 0.2) {
            T.pile = next.p;
            next.p.busy = true;
          }
        }
      }
      const left = this.drive(T, dt, pos, target);
      if (left < 2 && T.v < 0.1) return false;
    } else {
      T.v = 0;
      const p = T.pile;
      const remaining = p.items.filter((i) => tr.pieces[i].on && !tr.pieces[i].claimed);
      for (const w of T.crew) if (w.state === 'ride' && remaining.length) this.sendOut(w, remaining.shift());
      if (!remaining.length && T.crew.every((w) => w.state === 'ride')) {
        for (const i of p.items) tr.pieces[i].claimed = false;
        p.out = false;
        p.busy = false;
        p.done = tr.nightKey();
        T.pile = null;
      }
    }
    for (const w of T.crew) this.updateCrew(T, w, dt);
    return true;
  }

  sendOut(w, i) {
    const q = this.trash.pieces[i];
    q.claimed = true;
    w.item = i;
    w.state = 'out';
    w.held.visible = false;
  }

  /** World position of a point on the truck (local x left, z forward). */
  local(T, lx, lz) {
    const g = T.g.position;
    const ry = T.R.ry;
    return [g.x + Math.cos(ry) * lx + Math.sin(ry) * lz, g.z - Math.sin(ry) * lx + Math.cos(ry) * lz];
  }

  updateCrew(T, w, dt) {
    const c = this.city;
    const rig = w.rig;
    const hop = this.local(T, w.slot * 0.5, -T.L - 0.9); // where they load the hopper
    let speed = 0;
    let toss = false;
    const walkTo = (tx, tz) => {
      const dx = tx - w.x;
      const dz = tz - w.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.12) return true;
      const s = Math.min(d, WALK * dt);
      w.x += (dx / d) * s;
      w.z += (dz / d) * s;
      w.ry = Math.atan2(dx, dz);
      speed = WALK;
      return false;
    };
    if (w.state === 'ride') {
      const [x, z] = this.local(T, w.slot * 0.6, -T.L - 0.32);
      w.x = x;
      w.z = z;
      w.ry = T.R.ry;
      rig.group.position.set(x, 0.44, z);
    } else {
      if (w.state === 'out') {
        const q = this.trash.pieces[w.item];
        // stop just short of the bag, on its road side
        if (walkTo(q.x + (hop[0] - q.x) * 0.12, q.z + (hop[1] - q.z) * 0.12) || Math.hypot(q.x - w.x, q.z - w.z) < 0.55) {
          q.on = false;
          this.trash.dirty = true;
          w.held.material.color.copy(q.color);
          w.held.scale.setScalar(q.k === 5 || q.k === 6 ? q.s : 0.35);
          w.held.visible = true;
          w.state = 'back';
        }
      } else if (w.state === 'back') {
        if (walkTo(hop[0], hop[1])) {
          w.state = 'toss';
          w.t = 0;
          w.from = w.held.position.clone();
        }
      } else if (w.state === 'toss') {
        w.t += dt;
        toss = true;
        const [hx, hz] = this.local(T, 0, -T.L - 0.1);
        const k = Math.min(1, w.t / 0.45);
        w.held.position.set(w.from.x + (hx - w.from.x) * k, w.from.y + (1.3 - w.from.y) * k + Math.sin(k * Math.PI) * 0.6, w.from.z + (hz - w.from.z) * k);
        if (k >= 1) {
          w.held.visible = false;
          this.game.audio?.play('throw');
          w.state = 'climb';
        }
      } else if (w.state === 'climb') {
        const [x, z] = this.local(T, w.slot * 0.6, -T.L - 0.32);
        if (walkTo(x, z)) w.state = 'ride';
      }
      rig.group.position.set(w.x, c.groundY(w.x, w.z), w.z);
      if (w.state !== 'toss' && w.held.visible) w.held.position.set(w.x + Math.sin(w.ry) * 0.32, rig.group.position.y + 0.72, w.z + Math.cos(w.ry) * 0.32);
    }
    rig.group.rotation.y = w.ry;
    animateRig(rig, dt, { speed, grounded: true, cheering: toss });
  }

  // ---- the street washer -----------------------------------------------------
  makeSpray(T) {
    const N = 160;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#d8ecff', size: 0.1, transparent: true, opacity: 0.75, depthWrite: false }));
    pts.frustumCulled = false;
    this.group.add(pts);
    T.spray = pts;
    T.drops = Array.from({ length: N }, () => ({ x: 0, y: -1, z: 0, vx: 0, vy: 0, vz: 0 }));
    T.wetFrom = null;
  }

  updateWasher(T, dt, pos) {
    const R = T.R;
    const left = this.drive(T, dt, pos, CRUISE.washer);
    const moving = T.v > 0.3;
    for (const b of T.brushes) b.rotation.y += dt * 9 * (b.position.x > 0 ? 1 : -1);
    // water jets from the front bar, out toward the kerb on the right
    const [nx, nz] = this.local(T, -1.0, T.L + 0.15);
    const a = T.spray.geometry.attributes.position;
    for (let i = 0; i < T.drops.length; i++) {
      const d = T.drops[i];
      if (d.y < 0) {
        if (!moving && Math.random() < 0.7) {
          a.setXYZ(i, 0, -5, 0);
          continue;
        }
        const s = 4 + Math.random() * 3;
        d.x = nx;
        d.y = 0.38;
        d.z = nz;
        d.vx = R.rx * s + R.fx * (T.v + 0.8) + (Math.random() - 0.5) * 0.6;
        d.vz = R.rz * s + R.fz * (T.v + 0.8) + (Math.random() - 0.5) * 0.6;
        d.vy = 0.8 + Math.random() * 1.2;
        // stagger the first burst
        const k = Math.random() * 0.4;
        d.x += d.vx * k;
        d.z += d.vz * k;
        d.y += d.vy * k - 4.9 * k * k;
      }
      d.vy -= 9.8 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      a.setXYZ(i, d.x, d.y, d.z);
    }
    a.needsUpdate = true;
    // gutter litter washes away
    T.wash = (T.wash || 0) - dt;
    if (T.wash < 0) {
      T.wash = 0.25;
      const [gx, gz] = this.at(R, R.a + R.dir * 2, 7.2);
      this.trash.clearAround(gx, gz, 2.6, 'gutter');
    }
    // a wet strip of road behind it
    if (moving) {
      if (T.wetFrom === null) T.wetFrom = R.a;
      if ((R.a - T.wetFrom) * R.dir > 6) {
        this.addWet(R, T.wetFrom, R.a);
        T.wetFrom = R.a;
      }
    }
    return !(left < 2 && T.v < 0.1);
  }

  addWet(R, a0, a1) {
    const mesh = new THREE.Mesh(this.wetGeo, this.wetMat.clone());
    const mid = (a0 + a1) / 2;
    const [x, z] = this.at(R, mid, 3.9);
    const len = Math.abs(a1 - a0) + 0.2;
    mesh.position.set(x, 0.02, z);
    if (R.axis === 'z') mesh.scale.set(6.4, 1, len);
    else mesh.scale.set(len, 1, 6.4);
    mesh.renderOrder = 1;
    this.group.add(mesh);
    this.wet.push({ mesh, t: 0 });
    if (this.wet.length > 40) this.wet.shift().mesh.removeFromParent();
  }

  // ---- pavement porters ------------------------------------------------------
  spawnPorter(pos) {
    const c = this.city;
    // a block near you, walked clockwise along the middle of its pavement
    const blocks = c.blocks.filter((b) => (b.cx - pos.x) ** 2 + (b.cz - pos.z) ** 2 < 110 * 110 && (b.cx - pos.x) ** 2 + (b.cz - pos.z) ** 2 > 20 * 20);
    if (!blocks.length) return;
    const b = blocks[Math.floor(Math.random() * blocks.length)];
    const m = 2.6;
    const pts = [[b.x0 + m, b.z0 + m], [b.x1 - m, b.z0 + m], [b.x1 - m, b.z1 - m], [b.x0 + m, b.z1 - m]];
    const app = { ...roleAppearance('sanitation', Math.random), carry: 'broomcart', carryColor: '#3f6e4a' };
    const rig = createRig(app);
    this.group.add(rig.group);
    const k = Math.floor(Math.random() * 4);
    const u = Math.random();
    const [ax, az] = pts[k];
    const [bx, bz] = pts[(k + 1) % 4];
    const P = { rig, pts, k: (k + 1) % 4, x: ax + (bx - ax) * u, z: az + (bz - az) * u, ry: 0, pause: 0, step: 0 };
    this.porters.push(P);
  }

  dropPorter(P) {
    P.rig.group.removeFromParent();
    P.rig.dispose();
  }

  updatePorter(P, dt, pos) {
    const [tx, tz] = P.pts[P.k];
    const dx = tx - P.x;
    const dz = tz - P.z;
    const d = Math.hypot(dx, dz);
    let speed = 0;
    if (P.pause > 0) P.pause -= dt;
    else if (d < 0.1) P.k = (P.k + 1) % 4;
    else {
      // stop for you
      const near = (pos.x - P.x) ** 2 + (pos.z - P.z) ** 2 < 1.6 * 1.6 && (pos.x - P.x) * dx + (pos.z - P.z) * dz > 0;
      if (!near) {
        const s = Math.min(d, 0.85 * dt);
        P.x += (dx / d) * s;
        P.z += (dz / d) * s;
        P.ry = Math.atan2(dx, dz);
        speed = 0.85;
        P.step += s;
        if (P.step > 14) {
          P.step = 0;
          P.pause = 2 + Math.random() * 2; // a moment with the broom
        }
      }
    }
    P.sweep = (P.sweep || 0) - dt;
    if (P.sweep < 0) {
      P.sweep = 0.3;
      this.trash.clearAround(P.x + Math.sin(P.ry) * 0.6, P.z + Math.cos(P.ry) * 0.6, 1.7, 'walk');
    }
    P.rig.group.position.set(P.x, this.city.groundY(P.x, P.z), P.z);
    P.rig.group.rotation.y = P.ry + (P.pause > 0 ? Math.sin(performance.now() / 240) * 0.35 : 0);
    animateRig(P.rig, dt, { speed, grounded: true, pushing: P.pause <= 0 });
  }

  // ---- per frame ---------------------------------------------------------------
  update(dt, pos, inside) {
    if (!this.city || !this.game.state || !this.trash?.piles) return;
    this.group.visible = !inside;
    if (inside) return;
    const h = hourOf(this.game.state.time.total);
    for (const kind of ['garbage', 'washer']) {
      const T = this[kind];
      if (!T) {
        this.cool[kind] -= dt;
        if (this.cool[kind] < 0 && inHours(h, HOURS[kind])) {
          this.cool[kind] = 8;
          this.spawn(kind, pos);
        }
        continue;
      }
      const g = T.g.position;
      const far = (g.x - pos.x) ** 2 + (g.z - pos.z) ** 2 > NEAR * NEAR;
      const alive = kind === 'garbage' ? this.updateGarbage(T, dt, pos) : this.updateWasher(T, dt, pos);
      if (!alive || far || (!inHours(h, HOURS[kind]) && !T.pile)) {
        this.despawn(kind);
        this.cool[kind] = 5;
      }
    }
    // the wet road dries out
    for (let i = this.wet.length - 1; i >= 0; i--) {
      const w = this.wet[i];
      w.t += dt;
      w.mesh.material.opacity = 0.4 * Math.max(0, 1 - w.t / 70);
      if (w.t > 70) {
        w.mesh.removeFromParent();
        w.mesh.material.dispose();
        this.wet.splice(i, 1);
      }
    }
    // porters
    const want = inHours(h, HOURS.porter) ? 2 : 0;
    for (let i = this.porters.length - 1; i >= 0; i--) {
      const P = this.porters[i];
      if (this.porters.length > want || (P.x - pos.x) ** 2 + (P.z - pos.z) ** 2 > 130 * 130) {
        this.dropPorter(P);
        this.porters.splice(i, 1);
      } else this.updatePorter(P, dt, pos);
    }
    this.cool.porter -= dt;
    if (this.porters.length < want && this.cool.porter < 0) {
      this.cool.porter = 3;
      this.spawnPorter(pos);
    }
  }
}
