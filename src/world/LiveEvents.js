// Things that just happen on the street, every few minutes, near the player:
//  · a fender-bender at the kerb: two damaged cars with hazards on and smoke
//    from a crumpled hood, drivers arguing, people filming; a police car (with
//    its light bar going) and an ambulance turn up. Call 911 to hurry them,
//    check on the shaken driver.
//  · a purse snatcher: someone grabs a bag and runs. Chase them down (run with
//    Shift) and the victim gets the bag back — and thanks you with a reward.
import * as THREE from 'three';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { roleAppearance } from '../characters/Customization.js';
import { vehicleGeometry, carMaterial, glassMaterial, BODY_DIMS } from './CarModel.js';
import { LANE_OUT } from './Vehicles.js';
import { hourOf } from '../core/Clock.js';

const INSET = 2.6; // the crowd's walking line
const CAR_COLORS = ['#c53a3a', '#2f5aa3', '#e9e6df', '#1d1f24', '#7a8494', '#3f6e4a', '#b5a27a'];

let carMat;
let sigMat;
let glassMat;
/** One parked-looking car (instanced so the paint colour applies). sig: 2 strobes, -1 left blinker. */
function carMesh(type, color, sig = 0) {
  const { body, glass } = vehicleGeometry(type);
  carMat ||= carMaterial();
  sigMat ||= carMaterial({ signals: true });
  glassMat ||= glassMaterial();
  body.setAttribute('aSignal', new THREE.InstancedBufferAttribute(new Float32Array([sig]), 1));
  const m = new THREE.InstancedMesh(body, sig ? sigMat : carMat, 1);
  m.setMatrixAt(0, new THREE.Matrix4());
  m.setColorAt(0, new THREE.Color(color));
  m.castShadow = true;
  const g = new THREE.Group();
  g.add(m);
  if (glass) {
    const gm = new THREE.InstancedMesh(glass, glassMat, 1);
    gm.setMatrixAt(0, new THREE.Matrix4());
    g.add(gm);
  }
  return g;
}

/** A white box ambulance with a red stripe and a flashing light bar. */
function ambulance() {
  const g = carMesh('box', '#f4f4f2');
  const red = new THREE.MeshStandardMaterial({ color: '#c53a3a', roughness: 0.5 });
  for (const s of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 4.2), red);
    stripe.position.set(s * 1.11, 1.15, -0.4);
    g.add(stripe);
  }
  const lights = [];
  for (const [x, c] of [[-0.6, '#ff2a2a'], [-0.2, '#ffffff'], [0.2, '#ffffff'], [0.6, '#2a6aff']]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.26), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    m.position.set(x, 2.57, 1.2);
    g.add(m);
    lights.push(m);
  }
  g.userData.lights = lights;
  return g;
}

/** Smoke curling up from a crumpled hood. */
function smoke() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#6a6a6a', transparent: true, opacity: 0.35, depthWrite: false }));
    m.userData.ph = i / 6;
    g.add(m);
  }
  g.userData.tick = (t) => {
    for (const m of g.children) {
      const p = (t * 0.28 + m.userData.ph) % 1;
      m.position.set(Math.sin(p * 7 + m.userData.ph * 9) * 0.25, p * 3.2, p * 0.5);
      m.scale.setScalar(0.7 + p * 2.6);
      m.material.opacity = 0.42 * (1 - p);
    }
  };
  return g;
}

function cone() {
  const g = new THREE.Group();
  const o = new THREE.MeshStandardMaterial({ color: '#ff6a1a', roughness: 0.6 });
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.62, 12).translate(0, 0.33, 0), o);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.125, 0.09, 12).translate(0, 0.38, 0), new THREE.MeshStandardMaterial({ color: '#f4f4f2' }));
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42).translate(0, 0.02, 0), new THREE.MeshStandardMaterial({ color: '#1d1f24' }));
  g.add(c, band, base);
  g.traverse((m) => m.isMesh && (m.castShadow = true));
  return g;
}

/** A handbag that can be handed from bone to bone. */
function handbag(color) {
  const g = new THREE.Group();
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.1), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
  bag.position.y = -0.16;
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.008, 4, 12, Math.PI), new THREE.MeshStandardMaterial({ color: '#2b2b2e' }));
  strap.position.y = -0.06;
  g.add(bag, strap);
  return g;
}

export class LiveEvents {
  constructor(game) {
    this.game = game;
    this.next = 70 + Math.random() * 60; // seconds until something happens
    this.ev = null;
  }

  setCity(city) {
    this.clear();
    this.city = city;
  }

  clear() {
    if (!this.ev) return;
    for (const p of this.ev.people || []) {
      p.rig.group.removeFromParent();
      p.rig.dispose();
    }
    this.ev.group?.removeFromParent();
    this.ev.group?.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.ev = null;
  }

  /** Start one now (tests and the occasional scripted moment). */
  trigger(kind) {
    this.clear();
    return kind === 'thief' ? this.startThief() : this.startAccident();
  }

  update(dt, pos, inside) {
    const game = this.game;
    if (!this.city || !game.state) return;
    if (this.ev) {
      this.ev.t += dt;
      if (this.ev.kind === 'accident') this.updateAccident(dt, pos);
      else this.updateThief(dt, pos);
      const far = (this.ev.x - pos.x) ** 2 + (this.ev.z - pos.z) ** 2 > 170 * 170;
      if (this.ev && (this.ev.t > this.ev.life || (far && this.ev.t > 20))) this.clear();
      return;
    }
    if (inside || game.vehicles.driving) return;
    this.next -= dt;
    if (this.next > 0) return;
    this.next = 140 + Math.random() * 160;
    const hr = hourOf(game.state.time.total);
    const kind = hr >= 7 && hr < 23 && Math.random() < 0.5 ? 'thief' : 'accident';
    if (kind === 'thief') this.startThief();
    else this.startAccident();
  }

  person(role, x, z, extra = {}) {
    const look = roleAppearance(role, Math.random);
    Object.assign(look, extra.look || {});
    const rig = createRig(look);
    rig.group.position.set(x, this.city.groundY(x, z), z);
    this.ev.group.add(rig.group);
    const p = { rig, x, z, ry: 0, pose: {}, ...extra };
    this.ev.people.push(p);
    return p;
  }

  place(p) {
    p.rig.group.position.set(p.x, this.city.groundY(p.x, p.z), p.z);
    p.rig.group.rotation.y = p.ry;
  }

  // ------------------------------------------------------------- the accident
  /** A free spot in a kerb (parking) lane 45–110 m from the player. */
  findKerbSpot() {
    const c = this.city;
    const pos = this.game.player.pos;
    const parked = c.parkedCars || [];
    for (let tries = 0; tries < 60; tries++) {
      const b = c.blocks[Math.floor(Math.random() * c.blocks.length)];
      if (['zoo', 'airport', 'campus', 'landmark'].includes(b.kind)) continue;
      const side = Math.floor(Math.random() * 4);
      const N = c.N;
      if ((side === 0 && b.j === 0) || (side === 1 && b.j === N - 1) || (side === 2 && b.i === 0) || (side === 3 && b.i === N - 1)) continue;
      const along = (side < 2 ? b.x0 : b.z0) + 14 + Math.random() * (c.K.BLOCK - 28);
      const lane = [c.roadCenter(b.j) + LANE_OUT, c.roadCenter(b.j + 1) - LANE_OUT, c.roadCenter(b.i) + LANE_OUT, c.roadCenter(b.i + 1) - LANE_OUT][side];
      const x = side < 2 ? along : lane;
      const z = side < 2 ? lane : along;
      const d2 = (x - pos.x) ** 2 + (z - pos.z) ** 2;
      if (d2 < 45 * 45 || d2 > 110 * 110) continue;
      if (parked.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < 9 * 9)) continue;
      // heading along the kerb (traffic direction for that side), and toward the sidewalk
      const ry = [Math.PI / 2, -Math.PI / 2, Math.PI, 0][side];
      const nx = side < 2 ? 0 : side === 2 ? 1 : -1;
      const nz = side < 2 ? (side === 0 ? 1 : -1) : 0;
      return { x, z, ry, nx, nz };
    }
    return null;
  }

  startAccident() {
    const s = this.findKerbSpot();
    if (!s) return null;
    const group = new THREE.Group();
    this.game.scene.add(group);
    const ev = (this.ev = { kind: 'accident', t: 0, life: 200, x: s.x, z: s.z, group, people: [], spot: s, police: null, amb: null, called: false, helped: false });
    const fx = Math.sin(s.ry);
    const fz = Math.cos(s.ry);
    const pick = () => CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    // car A crunched into the back of car B, both a little askew
    const types = ['sedan', 'compact', 'suv', 'taxi', 'sport'];
    const a = carMesh(types[Math.floor(Math.random() * types.length)], pick(), -1);
    a.position.set(s.x - fx * 2.6, 0, s.z - fz * 2.6);
    a.rotation.y = s.ry + 0.32;
    const b = carMesh(types[Math.floor(Math.random() * types.length)], pick(), -1);
    b.position.set(s.x + fx * 2.4, 0, s.z + fz * 2.4);
    b.rotation.y = s.ry - 0.12;
    group.add(a, b);
    // solid: the player bumps into the wrecks
    ev.obbs = [a, b].map((m, k) => ({ x: m.position.x, z: m.position.z, ry: m.rotation.y, ...(BODY_DIMS[k ? 'suv' : 'suv']) }));
    // a popped hood, smoke, broken glass and a fallen bumper
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 1.0), new THREE.MeshStandardMaterial({ color: '#6a6e76', metalness: 0.5, roughness: 0.4 }));
    hood.position.set(0, 1.12, 1.55);
    hood.rotation.x = -0.55;
    a.add(hood);
    const sm = smoke();
    sm.position.set(0, 1.1, 1.8);
    a.add(sm);
    ev.smoke = sm;
    const glass = new THREE.MeshStandardMaterial({ color: '#cfe3ea', roughness: 0.1, metalness: 0.3 });
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06 + Math.random() * 0.08, 0.01, 0.05 + Math.random() * 0.06), glass);
      m.position.set(s.x + (Math.random() - 0.5) * 3, 0.02, s.z + (Math.random() - 0.5) * 3);
      m.rotation.y = Math.random() * 6;
      group.add(m);
    }
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.14), new THREE.MeshStandardMaterial({ color: '#2b2d33', roughness: 0.6 }));
    bumper.position.set(s.x - fz * 1.6, 0.09, s.z + fx * 1.6);
    bumper.rotation.y = s.ry + 1.2;
    group.add(bumper);
    // the drivers (one arguing, one sitting on the kerb, shaken) and onlookers filming
    const kx = s.x + s.nx * 3.9;
    const kz = s.z + s.nz * 3.9;
    ev.angry = this.person('business', s.x + s.nx * 1.6 + fx * 0.8, s.z + s.nz * 1.6 + fz * 0.8, { pose: { talking: true } });
    ev.angry.ry = Math.atan2(-s.nx, -s.nz) + 0.6;
    ev.hurt = this.person('civilian', kx - fx * 1.2, kz - fz * 1.2, { pose: { floor: true } });
    ev.hurt.ry = Math.atan2(-s.nx, -s.nz);
    for (let i = 0; i < 3; i++) {
      const o = this.person(['student', 'tourist', 'shopper', 'civilian'][i], kx + s.nx * 1.4 + fx * (i * 1.4 - 1), kz + s.nz * 1.4 + fz * (i * 1.4 - 1), { pose: { phone: true } });
      o.ry = Math.atan2(s.x - o.x, s.z - o.z);
    }
    for (const p of ev.people) this.place(p);
    const near = (s.x - this.game.player.pos.x) ** 2 + (s.z - this.game.player.pos.z) ** 2 < 90 * 90;
    if (near) this.game.audio?.play('crash');
    this.game.events.emit('toast', { icon: '💥', title: 'Crash nearby!', text: 'Two cars just collided down the street. Someone might need help.', kind: 'bad' });
    this.game.hud?.hint('accident', 'Something happened nearby: go and see. You can call 911 or check on the drivers.', 8);
    return ev;
  }

  updateAccident(dt, pos) {
    const ev = this.ev;
    const s = ev.spot;
    const t = ev.t;
    ev.smoke.userData.tick(t);
    const fx = Math.sin(s.ry);
    const fz = Math.cos(s.ry);
    // the police come (sooner if someone called), then an ambulance
    const policeAt = ev.called ? Math.min(ev.calledAt + 12, 40) : 40;
    if (!ev.police && t > policeAt) {
      const car = carMesh('police', '#f4f4f2', 2);
      car.position.set(s.x - fx * 9.5, 0, s.z - fz * 9.5);
      car.rotation.y = s.ry - 0.2;
      ev.group.add(car);
      ev.police = car;
      ev.obbs.push({ x: car.position.x, z: car.position.z, ry: car.rotation.y, ...BODY_DIMS.police });
      for (let i = 0; i < 4; i++) {
        const c = cone();
        c.position.set(s.x - fx * (5.5 + i * 0.1) - s.nx * (i * 1.1 - 0.5), 0, s.z - fz * (5.5 + i * 0.1) - s.nz * (i * 1.1 - 0.5));
        ev.group.add(c);
      }
      const cop = this.person('police', s.x + s.nx * 1.2 - fx * 0.6, s.z + s.nz * 1.2 - fz * 0.6, { pose: { talking: true } });
      cop.ry = Math.atan2(ev.angry.x - cop.x, ev.angry.z - cop.z);
      this.place(cop);
      if ((s.x - pos.x) ** 2 + (s.z - pos.z) ** 2 < 120 * 120) this.game.audio?.play('siren');
    }
    if (!ev.amb && t > policeAt + 18) {
      const amb = ambulance();
      amb.position.set(s.x + fx * 9, 0, s.z + fz * 9);
      amb.rotation.y = s.ry + Math.PI;
      ev.group.add(amb);
      ev.amb = amb;
      ev.obbs.push({ x: amb.position.x, z: amb.position.z, ry: amb.rotation.y, ...BODY_DIMS.box });
      const medic = this.person('paramedic', ev.hurt.x + fx * 0.9, ev.hurt.z + fz * 0.9, { pose: { talking: true } });
      medic.ry = Math.atan2(ev.hurt.x - medic.x, ev.hurt.z - medic.z);
      this.place(medic);
      if ((s.x - pos.x) ** 2 + (s.z - pos.z) ** 2 < 120 * 120) this.game.audio?.play('siren');
    }
    if (ev.amb) {
      const on = Math.floor(t * 6) % 2;
      ev.amb.userData.lights.forEach((m, i) => (m.visible = (i % 2) === on));
    }
    for (const p of ev.people) {
      p.rig.group.rotation.y = p.ry;
      animateRig(p.rig, dt, { speed: 0, grounded: true, ...p.pose });
    }
  }

  // ---------------------------------------------------------------- the thief
  /** Walking-line lattice: x and z values of every sidewalk corner. */
  lattice() {
    const c = this.city;
    const xs = [];
    for (let i = 0; i < c.N; i++) xs.push(c.blockMin(i) + INSET, c.blockMin(i) + c.K.BLOCK - INSET);
    return xs;
  }

  startThief() {
    const c = this.city;
    const pos = this.game.player.pos;
    const L = this.lattice();
    // the nearest walking-line corner 14–40 m away
    let best = null;
    for (let i = 0; i < L.length; i++) {
      for (let j = 0; j < L.length; j++) {
        const d = Math.hypot(L[i] - pos.x, L[j] - pos.z);
        if (d < 14 || d > 40) continue;
        const bi = Math.floor((L[i] + c.half - c.K.ROAD) / c.K.PITCH);
        const bj = Math.floor((L[j] + c.half - c.K.ROAD) / c.K.PITCH);
        const b = c.blocks.find((q) => q.i === bi && q.j === bj);
        if (!b || ['zoo', 'airport', 'campus'].includes(b.kind)) continue;
        if (!best || d < best.d) best = { i, j, d };
      }
    }
    if (!best) return null;
    const group = new THREE.Group();
    this.game.scene.add(group);
    const vx = L[best.i];
    const vz = L[best.j];
    const ev = (this.ev = { kind: 'thief', t: 0, life: 150, x: vx, z: vz, group, people: [], L, phase: 'approach', caught: false });
    ev.victim = this.person(Math.random() < 0.5 ? 'rich' : 'shopper', vx, vz, { look: { carry: 'none' } });
    ev.victim.ry = Math.atan2(pos.x - vx, pos.z - vz);
    ev.bag = handbag(['#7a1f2b', '#c19a6b', '#1d1f24', '#e86ab0'][Math.floor(Math.random() * 4)]);
    ev.victim.rig.bones.handR.add(ev.bag);
    // the thief walks up from the next corner
    const dir = Math.random() < 0.5 ? 1 : -1;
    const si = Math.min(L.length - 1, Math.max(0, best.i + dir));
    ev.thief = this.person('civilian', L[si], vz, { look: { top: 'hoodie', topColor: '#2b2d33', bottom: 'joggers', bottomColor: '#1d1f24', accessory: 'beanie', accColor: '#1d1f24', carry: 'none' } });
    ev.thief.gi = si;
    ev.thief.gj = best.j;
    ev.vi = best.i;
    ev.vj = best.j;
    for (const p of ev.people) this.place(p);
    return ev;
  }

  /** The next corner on the run: never straight back, prefer away from the player. */
  nextCorner(p) {
    const L = this.ev.L;
    const pos = this.game.player.pos;
    const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([di, dj]) => !(di === -p.di && dj === -p.dj) && L[p.gi + di] != null && L[p.gj + dj] != null);
    opts.sort((a, b) => {
      const da = Math.hypot(L[p.gi + a[0]] - pos.x, L[p.gj + a[1]] - pos.z);
      const db = Math.hypot(L[p.gi + b[0]] - pos.x, L[p.gj + b[1]] - pos.z);
      return db - da + (Math.random() - 0.5) * 20;
    });
    const [di, dj] = opts[0] || [1, 0];
    p.di = di;
    p.dj = dj;
    p.gi += di;
    p.gj += dj;
  }

  updateThief(dt, pos) {
    const ev = this.ev;
    const th = ev.thief;
    const vi = ev.victim;
    const L = ev.L;
    const game = this.game;
    let speed = 0;
    if (ev.phase === 'approach') {
      // stroll up to the victim, then grab the bag
      const dx = vi.x - th.x;
      const dz = vi.z - th.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.9) {
        ev.phase = 'run';
        ev.runT = 0;
        th.rig.bones.handR.add(ev.bag);
        th.di = Math.sign(th.x - vi.x) || 1;
        th.dj = 0;
        th.gi = ev.vi;
        th.gj = ev.vj;
        this.nextCorner(th);
        vi.pose = { waving: true, talking: true };
        game.audio?.play('error');
        game.events.emit('toast', { icon: '🚨', title: '"Stop! Thief!"', text: 'Someone just snatched a bag and ran! Chase them down: hold Shift to sprint.', kind: 'bad', long: true });
        game.hud?.hint('thief', 'Catch the purse snatcher: run (Shift) and get right up close to them.', 8);
      } else {
        speed = 1.4;
        th.x += (dx / d) * speed * dt;
        th.z += (dz / d) * speed * dt;
        th.ry = Math.atan2(dx, dz);
      }
    } else if (ev.phase === 'run') {
      ev.runT += dt;
      speed = 4.9;
      const tx = L[th.gi];
      const tz = L[th.gj];
      const dx = tx - th.x;
      const dz = tz - th.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.3) this.nextCorner(th);
      else {
        const st = Math.min(d, speed * dt);
        th.x += (dx / d) * st;
        th.z += (dz / d) * st;
        th.ry = Math.atan2(dx, dz);
      }
      const gap = Math.hypot(th.x - pos.x, th.z - pos.z);
      if (gap < 1.6) {
        ev.phase = 'caught';
        ev.caughtT = 0;
        th.pose = { floor: true };
        ev.bag.removeFromParent();
        ev.bag.position.set(th.x + 0.5, this.city.groundY(th.x, th.z) + 0.2, th.z);
        ev.group.add(ev.bag);
        game.audio?.play('bump');
        game.events.emit('toast', { icon: '🛑', title: 'Got them!', text: 'You caught up with the thief and they dropped the bag. Bring it back to its owner.', kind: 'good' });
      } else if (gap > 75 || ev.runT > 45) {
        ev.phase = 'escaped';
        ev.life = ev.t + 8;
        th.rig.group.visible = false;
        vi.pose = {};
        game.events.emit('toast', { icon: '💨', title: 'The thief got away', text: 'They vanished into the crowd. The police are taking a report.', kind: 'info' });
      }
    } else if (ev.phase === 'caught') {
      ev.caughtT += dt;
      // pick up the bag
      if (!ev.hasBag && Math.hypot(ev.bag.position.x - pos.x, ev.bag.position.z - pos.z) < 1.8) {
        ev.hasBag = true;
        const hand = game.playerRig.bones?.handL;
        if (hand) {
          hand.add(ev.bag);
          ev.bag.position.set(0, 0, 0);
        } else ev.bag.visible = false;
        game.events.emit('toast', { icon: '👜', title: 'You have the bag', text: 'Take it back to the person who was robbed.', kind: 'info' });
      }
      // the police arrive and take the thief away
      if (!ev.cop && ev.caughtT > 6) {
        ev.cop = this.person('police', th.x + 1.2, th.z + 0.4, { pose: { talking: true } });
        ev.cop.ry = Math.atan2(th.x - ev.cop.x, th.z - ev.cop.z);
        this.place(ev.cop);
      }
      // the victim walks toward you
      const dx = pos.x - vi.x;
      const dz = pos.z - vi.z;
      const d = Math.hypot(dx, dz);
      if (d > 1.6) {
        vi.x += (dx / d) * 1.2 * dt;
        vi.z += (dz / d) * 1.2 * dt;
        vi.moving = true;
      } else vi.moving = false;
      vi.ry = Math.atan2(dx, dz);
      vi.pose = { talking: !vi.moving };
      if (ev.hasBag && d < 2.2) this.returnBag();
    }
    th.rig.group.position.set(th.x, this.city.groundY(th.x, th.z), th.z);
    th.rig.group.rotation.y = th.ry;
    animateRig(th.rig, dt, { speed, grounded: true, ...(th.pose || {}) });
    vi.rig.group.position.set(vi.x, this.city.groundY(vi.x, vi.z), vi.z);
    vi.rig.group.rotation.y = vi.ry;
    animateRig(vi.rig, dt, { speed: vi.moving ? 1.2 : 0, grounded: true, ...(vi.pose || {}) });
    if (ev.cop) {
      ev.cop.rig.group.rotation.y = ev.cop.ry;
      animateRig(ev.cop.rig, dt, { speed: 0, grounded: true, talking: true });
    }
  }

  returnBag() {
    const ev = this.ev;
    const game = this.game;
    const sim = game.sim;
    ev.phase = 'returned';
    ev.life = ev.t + 10;
    ev.bag.removeFromParent();
    ev.bag.visible = true;
    ev.victim.rig.bones.handR.add(ev.bag);
    ev.bag.position.set(0, 0, 0);
    ev.victim.pose = { shaking: true };
    const reward = [20, 40, 50, 100][Math.floor(Math.random() * 4)];
    sim.finance.earn(reward, 'gifts', 'Reward for returning a stolen bag');
    sim.state.needs.social = Math.min(100, sim.state.needs.social + 12);
    sim.state.needs.fun = Math.min(100, sim.state.needs.fun + 8);
    sim.state.stats.kindness = (sim.state.stats.kindness || 0) + 1;
    sim.state.stats.thievesCaught = (sim.state.stats.thievesCaught || 0) + 1;
    game.audio?.play('success');
    game.events.emit('toast', { icon: '🦸', title: 'A street hero', text: `"Thank you, thank you! Everything I own is in there." They insist you take $${reward}.`, kind: 'good', long: true });
  }

  /** Oriented boxes the player can't walk through (the cars at a crash). */
  obbs() {
    return this.ev?.obbs || [];
  }

  /** Accident interactions: call 911, check on the driver. */
  interactable(p) {
    const ev = this.ev;
    if (!ev || ev.kind !== 'accident') return null;
    if ((ev.x - p.x) ** 2 + (ev.z - p.z) ** 2 > 9 * 9) return null;
    if (!ev.called && !ev.police) return { label: '📞 Call 911', action: () => this.call911() };
    if (!ev.helped && (ev.hurt.x - p.x) ** 2 + (ev.hurt.z - p.z) ** 2 < 3 * 3) return { label: '🩹 Check on the shaken driver', action: () => this.helpDriver() };
    return null;
  }

  call911() {
    const ev = this.ev;
    const game = this.game;
    ev.called = true;
    ev.calledAt = ev.t;
    game.player.emote = { id: 'phone', t: 4, held: false };
    game.state.stats.kindness = (game.state.stats.kindness || 0) + 1;
    game.events.emit('toast', { icon: '📞', title: '911, what is your emergency?', text: 'You report the crash and the location. "Units are on the way."', kind: 'info' });
  }

  helpDriver() {
    const ev = this.ev;
    const game = this.game;
    const sim = game.sim;
    ev.helped = true;
    sim.advance(10, { noCollapse: true });
    sim.state.needs.social = Math.min(100, sim.state.needs.social + 10);
    sim.state.stats.kindness = (sim.state.stats.kindness || 0) + 1;
    ev.hurt.pose = { floor: true, talking: true };
    game.events.emit('toast', { icon: '🩹', title: 'You check on the driver', text: '"I\'m okay, just shaken up. Thanks for stopping — nobody else did."', kind: 'good' });
  }
}
