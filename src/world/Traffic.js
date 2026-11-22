// Simple ambient traffic: cars follow the inner lanes of the road grid, stop
// at red lights, keep their distance and always yield to pedestrians, the
// player and the player's car. One InstancedMesh; state in typed arrays.
import * as THREE from 'three';
import { LANE_IN } from './Vehicles.js';
import { vehicleGeometry, busGeometry, carMaterial, glassMaterial } from './CarModel.js';
import { cyclistGeometry, cyclistMaterial } from './Bikes.js';

const BIKE_LANE = 3.45; // between the driving lane and the parked cars
import { crowdDensity } from '../characters/Crowd.js';
import { CLOTH_COLORS } from '../characters/Customization.js';
import { mulberry32, damp, clamp } from '../core/utils.js';
import { obbOverlap, pushOutOBB } from './Collision.js';

const COUNTS = { low: 8, medium: 16, high: 26 };
const BUSES = { low: 1, medium: 3, high: 4 };
const CAR_HL = 2.17;
const BUS_HL = 5.75;
// what you see on the streets: mostly sedans, compacts and SUVs, plus taxis,
// pickups, sport sedans, delivery trucks, the odd supercar and police patrols
const TYPE_MIX = { sedan: 24, compact: 17, suv: 16, sport: 8, pickup: 7, taxi: 10, box: 5, coupe: 4, supercar: 2, police: 3, firetruck: 1, ambulance: 1.2, scooter: 7, motorbike: 5, garbage: 1.4, van: 4 };
const TYPE_COLOR = { taxi: ['#f2c230'], police: ['#f4f4f2'], firetruck: ['#c41e1e'], ambulance: ['#f4f4f2'], garbage: ['#3f6e4a', '#f4f4f2'], van: ['#7a4a2a', '#f4f4f2', '#2f5aa3', '#e9c04c', '#3a3f48'], scooter: ['#e9c04c', '#c53a3a', '#3fbf7a', '#f4f4f2', '#3f76d0', '#e06a9a', '#1d1f24'], motorbike: ['#c53a3a', '#1d1f24', '#3f76d0', '#e9c04c', '#f4f4f2', '#3fbf7a'], supercar: ['#e9c04c', '#c53a3a', '#3fbf5a', '#f07a1a', '#1d1f24', '#5a4fd0'] };
const CAR_COLORS = ['#f4f4f2', '#1d1f24', '#8a8d92', '#b0463c', '#27406b', '#d9c7a8', '#3f5f4a', '#e9c04c', ...CLOTH_COLORS.slice(8, 11)];

export class Traffic {
  constructor(scene) {
    this.scene = scene;
    this.n = 0;
    this.rng = mulberry32(777);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._up = new THREE.Vector3(0, 1, 0);
    this._c = new THREE.Color();
    this._e = new THREE.Euler();
  }

  dispose() {
    for (const M of this.meshes || []) {
      for (const m of [M.body, M.glass]) {
        if (!m) continue;
        this.scene.remove(m);
        m.geometry.dispose();
      }
    }
    this.meshes = [];
    if (this.busInst) {
      this.scene.remove(this.busInst);
      this.busInst.geometry.dispose();
      this.busInst = null;
    }
    this.n = 0;
  }

  setCity(city, quality = 'medium') {
    this.dispose();
    this.city = city;
    // the last few slots are city buses
    const nb = (this.nb = (city.busStops || []).length ? BUSES[quality] ?? 3 : 0);
    // a few slots are always cyclists in the bike lanes
    const nBikes = (this.nBikes = { low: 3, medium: 5, high: 7 }[quality] ?? 5);
    const n = (this.n = (COUNTS[quality] ?? 16) + nBikes + nb);
    this.bus0 = n - nb;
    this.hl = new Float32Array(n).fill(CAR_HL);
    this.hw = new Float32Array(n).fill(0.92);
    this.dwell = new Float32Array(n);
    this.lastStop = new Int32Array(n).fill(-1);
    for (let i = this.bus0; i < n; i++) {
      this.hl[i] = BUS_HL;
      this.hw[i] = 1.27;
    }
    this.x = new Float32Array(n);
    this.z = new Float32Array(n);
    this.hx = new Int8Array(n); // heading along the grid (unit axis)
    this.hz = new Int8Array(n);
    this.ti = new Int16Array(n); // intersection the car is driving towards
    this.tj = new Int16Array(n);
    this.speed = new Float32Array(n);
    this.max = new Float32Array(n);
    this.ry = new Float32Array(n);
    this.turnT = new Float32Array(n); // > 0 while crossing an intersection
    this.fromX = new Float32Array(n);
    this.fromZ = new Float32Array(n);
    this.alive = new Uint8Array(n);
    // the next manoeuvre is planned a block ahead so cars can slow down and signal
    this.nhx = new Int8Array(n);
    this.nhz = new Int8Array(n);
    this.ctrlX = new Float32Array(n); // bezier control point through the intersection
    this.ctrlZ = new Float32Array(n);
    this.toX = new Float32Array(n);
    this.toZ = new Float32Array(n);
    this.tLen = new Float32Array(n);
    this.turnSp = new Float32Array(n);
    this.roll = new Float32Array(n);
    this.pitch = new Float32Array(n);
    this.prevRy = new Float32Array(n);
    this.prevSp = new Float32Array(n);
    // each car slot gets a body style; one instanced body + glass mesh per style
    this.sig = new Float32Array(n); // indicator / siren state per slot
    this.lane = new Float32Array(n).fill(LANE_IN);
    this.siren = new Uint8Array(n);
    this.slotMesh = new Int16Array(n).fill(-1);
    this.slotIdx = new Int16Array(n);
    const mix = { ...TYPE_MIX, taxi: TYPE_MIX.taxi * (city.cfg.taxiMul ?? 1) };
    const total = Object.values(mix).reduce((a, b) => a + b, 0);
    const groups = {};
    for (let i = 0; i < this.bus0; i++) {
      let r = this.rng() * total;
      let type = i < this.nBikes ? 'bike' : 'sedan';
      for (const [t, w] of i < this.nBikes ? [] : Object.entries(mix)) {
        r -= w;
        if (r <= 0) {
          type = t;
          break;
        }
      }
      (groups[type] ||= []).push(i);
      this.siren[i] = (type === 'police' && this.rng() < 0.4) || ((type === 'firetruck' || type === 'ambulance') && this.rng() < 0.7) ? 1 : 0;
    }
    this.carMat ||= carMaterial({ signals: true });
    this.glassMat ||= glassMaterial();
    this.meshes = [];
    for (const [type, slots] of Object.entries(groups)) {
      if (type === 'bike') {
        // cyclists: bike + rider in one mesh, legs pedal in the shader
        const geo = cyclistGeometry();
        const anim = new THREE.InstancedBufferAttribute(new Float32Array(slots.length * 3), 3);
        geo.setAttribute('aAnim', anim);
        const sig = new THREE.InstancedBufferAttribute(new Float32Array(slots.length), 1);
        const bm = new THREE.InstancedMesh(geo, (this.bikeMat ||= cyclistMaterial()), slots.length);
        bm.castShadow = true;
        bm.frustumCulled = false;
        const jerseys = ['#e05c2c', '#2f8fd6', '#f2c230', '#3fbf5a', '#f4f4f2', '#1d1f24', '#e06a9a', '#5a4fd0'];
        slots.forEach((i, k) => {
          this.slotMesh[i] = this.meshes.length;
          this.slotIdx[i] = k;
          this.hl[i] = 0.95;
          this.hw[i] = 0.36;
          this.lane[i] = BIKE_LANE;
          bm.setColorAt(k, this._c.set(jerseys[Math.floor(this.rng() * jerseys.length)]));
          anim.setXYZ(k, 6, this.rng() * 6.28, 0);
        });
        bm.instanceColor.needsUpdate = true;
        this.scene.add(bm);
        this.meshes.push({ type, body: bm, glass: null, sig, anim });
        continue;
      }
      const { body, glass, dims } = vehicleGeometry(type);
      const sig = new THREE.InstancedBufferAttribute(new Float32Array(slots.length), 1);
      body.setAttribute('aSignal', sig);
      const bm = new THREE.InstancedMesh(body, this.carMat, slots.length);
      bm.castShadow = true;
      bm.frustumCulled = false;
      const gm = glass ? new THREE.InstancedMesh(glass, this.glassMat, slots.length) : null;
      if (gm) gm.frustumCulled = false;
      const pal = TYPE_COLOR[type] || CAR_COLORS;
      slots.forEach((i, k) => {
        this.slotMesh[i] = this.meshes.length;
        this.slotIdx[i] = k;
        this.hl[i] = dims.hl;
        this.hw[i] = dims.hw;
        bm.setColorAt(k, this._c.set(pal[Math.floor(this.rng() * pal.length)]));
      });
      bm.instanceColor.needsUpdate = true;
      this.scene.add(bm);
      if (gm) this.scene.add(gm);
      this.meshes.push({ type, body: bm, glass: gm, sig });
    }
    this.typeOf = (i) => (this.slotMesh[i] >= 0 ? this.meshes[this.slotMesh[i]].type : 'bus');
    // street segments with a bus stop on the kerb side, keyed "fromI,fromJ,toI,toJ"
    this.stopSegs = new Set();
    const rc = (k) => city.roadCenter(k);
    for (const s of city.busStops || []) {
      for (let a = 0; a <= city.N; a++) {
        for (let b = 0; b < city.N; b++) {
          // north-south road a, between intersections b and b+1
          if (Math.abs(s.x - rc(a)) < 9 && s.z > rc(b) && s.z < rc(b + 1)) this.stopSegs.add(s.x > rc(a) ? `${a},${b + 1},${a},${b}` : `${a},${b},${a},${b + 1}`);
          // east-west road a, between intersections b and b+1
          if (Math.abs(s.z - rc(a)) < 9 && s.x > rc(b) && s.x < rc(b + 1)) this.stopSegs.add(s.z > rc(a) ? `${b},${a},${b + 1},${a}` : `${b + 1},${a},${b},${a}`);
        }
      }
    }
    if (nb) {
      this.busInst = new THREE.InstancedMesh(busGeometry(), carMaterial({ roughness: 0.4, metalness: 0.25 }), nb);
      this.busInst.castShadow = true;
      this.busInst.frustumCulled = false;
      const livery = city.cfg.busColor || '#1f6fb2';
      for (let k = 0; k < nb; k++) this.busInst.setColorAt(k, this._c.set(livery));
      this.busInst.instanceColor.needsUpdate = true;
      this.scene.add(this.busInst);
    }
    this._first = true;
  }

  /** Lane position for a car heading (hx,hz) towards intersection (ti,tj), `back` metres before it. */
  lanePoint(i, back, out) {
    const c = this.city;
    const hx = this.hx[i];
    const hz = this.hz[i];
    // right-hand traffic: lane sits to the right of the travel direction
    const lane = this.lane ? this.lane[i] : LANE_IN;
    out.x = c.roadCenter(this.ti[i]) - hx * back - hz * lane;
    out.z = c.roadCenter(this.tj[i]) - hz * back + hx * lane;
    return out;
  }

  spawn(i, px, pz, anywhere) {
    const c = this.city;
    const K = c.K;
    const clampI = (v) => Math.max(0, Math.min(c.N, v));
    const pi = Math.round((px + c.half - K.ROAD / 2) / K.PITCH);
    const pj = Math.round((pz + c.half - K.ROAD / 2) / K.PITCH);
    for (let tries = 0; tries < 6; tries++) {
      const horiz = this.rng() < 0.5;
      const dir = this.rng() < 0.5 ? 1 : -1;
      this.hx[i] = horiz ? dir : 0;
      this.hz[i] = horiz ? 0 : dir;
      this.ti[i] = clampI(pi + Math.floor(this.rng() * 7) - 3);
      this.tj[i] = clampI(pj + Math.floor(this.rng() * 7) - 3);
      // the car must be coming from a valid previous intersection
      const fi = this.ti[i] - this.hx[i];
      const fj = this.tj[i] - this.hz[i];
      if (fi < 0 || fi > c.N || fj < 0 || fj > c.N) continue;
      const p = this.lanePoint(i, 14 + this.rng() * (K.PITCH - 26), this._p);
      const d2 = (p.x - px) ** 2 + (p.z - pz) ** 2;
      if (!anywhere && d2 < 45 * 45) continue;
      if (this.blocked(p.x, p.z, i >= this.bus0 ? 15 : 9, i)) continue;
      this.x[i] = p.x;
      this.z[i] = p.z;
      this.ry[i] = Math.atan2(this.hx[i], this.hz[i]);
      const ty = this.typeOf(i);
      this.max[i] = ty === 'bike' ? 4.2 + this.rng() * 2 : i >= this.bus0 ? 7 + this.rng() : ty === 'box' ? 7.5 + this.rng() : ty === 'supercar' || ty === 'coupe' ? 11 + this.rng() * 4 : this.siren[i] ? 12 + this.rng() * 2 : 8.5 + this.rng() * 4;
      this.dwell[i] = 0;
      this.lastStop[i] = -1;
      this.prevRy[i] = this.ry[i];
      this.prevSp[i] = this.speed[i];
      this.roll[i] = this.pitch[i] = 0;
      this.planTurn(i);
      this.speed[i] = this.max[i] * 0.6;
      this.turnT[i] = 0;
      this.alive[i] = 1;
      return;
    }
    this.alive[i] = 0;
  }

  /** Is any traffic car within r of a point? (used when spawning) */
  blocked(x, z, r, ignore = -1) {
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i] || i === ignore) continue;
      if ((this.x[i] - x) ** 2 + (this.z[i] - z) ** 2 < r * r) return true;
    }
    return false;
  }

  /** Does any traffic car overlap this oriented box? */
  overlapsOBB(box) {
    const o = (this._obb ||= { hw: 0.92, hl: 2.17 });
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i]) continue;
      if ((this.x[i] - box.x) ** 2 + (this.z[i] - box.z) ** 2 > (this.hl[i] + 5) ** 2) continue;
      o.hw = this.hw[i];
      o.hl = this.hl[i];
      o.x = this.x[i];
      o.z = this.z[i];
      o.ry = this.ry[i];
      if (obbOverlap(box, o)) return true;
    }
    return false;
  }

  /** Push a circle (the walking player) out of every nearby traffic car. */
  pushOut(pos, r) {
    const o = (this._push ||= { hw: 0.92, hl: 2.17 });
    let hit = false;
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i]) continue;
      if ((this.x[i] - pos.x) ** 2 + (this.z[i] - pos.z) ** 2 > (this.hl[i] + 1.8) ** 2) continue;
      o.hw = this.hw[i];
      o.hl = this.hl[i];
      o.x = this.x[i];
      o.z = this.z[i];
      o.ry = this.ry[i];
      if (pushOutOBB(pos, r, o)) hit = true;
    }
    return hit;
  }

  /** Decide the manoeuvre at the intersection ahead (ti,tj): straight, right or left. */
  planTurn(i) {
    const c = this.city;
    const hx = this.hx[i];
    const hz = this.hz[i];
    // options: straight, right, left (never a U-turn unless it is a dead end)
    const opts = [
      [hx, hz, 3],
      [-hz, hx, 1.2],
      [hz, -hx, 1],
    ];
    let best = null;
    let bw = -1;
    for (const [ax, az, w] of opts) {
      const ni = this.ti[i] + ax;
      const nj = this.tj[i] + az;
      if (ni < 0 || ni > c.N || nj < 0 || nj > c.N) continue;
      // buses keep to streets with stops, like a route
      const route = i >= this.bus0 && this.stopSegs.has(`${this.ti[i]},${this.tj[i]},${ni},${nj}`) ? 6 : 1;
      const score = w * route * this.rng();
      if (score > bw) {
        bw = score;
        best = [ax, az];
      }
    }
    if (!best) best = [-hx, -hz];
    this.nhx[i] = best[0];
    this.nhz[i] = best[1];
  }

  /** +1 right, -1 left, 0 straight for the planned manoeuvre. */
  turnSide(i) {
    const hx = this.hx[i];
    const hz = this.hz[i];
    if (this.nhx[i] === hx && this.nhz[i] === hz) return 0;
    return this.nhx[i] === -hz && this.nhz[i] === hx ? 1 : -1;
  }

  /** Arrived at the stop line: start a curved path through the intersection. */
  chooseTurn(i) {
    const ohx = this.hx[i];
    const ohz = this.hz[i];
    const side = this.turnSide(i);
    const bus = i >= this.bus0;
    this.fromX[i] = this.x[i];
    this.fromZ[i] = this.z[i];
    this.hx[i] = this.nhx[i];
    this.hz[i] = this.nhz[i];
    this.ti[i] += this.hx[i];
    this.tj[i] += this.hz[i];
    const to = this.lanePoint(i, this.city.K.PITCH - (this.city.K.ROAD / 2 + 2.2), this._p);
    this.toX[i] = to.x;
    this.toZ[i] = to.z;
    if (side === 0) {
      this.ctrlX[i] = (this.fromX[i] + to.x) / 2;
      this.ctrlZ[i] = (this.fromZ[i] + to.z) / 2;
    } else if (this.hx[i] === -ohx && this.hz[i] === -ohz) {
      // dead end: a wide U-turn
      this.ctrlX[i] = (this.fromX[i] + to.x) / 2 + ohx * 9;
      this.ctrlZ[i] = (this.fromZ[i] + to.z) / 2 + ohz * 9;
    } else {
      // the corner where the old and new lane lines cross
      this.ctrlX[i] = ohx ? to.x : this.fromX[i];
      this.ctrlZ[i] = ohx ? this.fromZ[i] : to.z;
    }
    const d = (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az);
    this.tLen[i] = (d(this.fromX[i], this.fromZ[i], to.x, to.z) + d(this.fromX[i], this.fromZ[i], this.ctrlX[i], this.ctrlZ[i]) + d(this.ctrlX[i], this.ctrlZ[i], to.x, to.z)) / 2 || 1;
    const bike = this.lane[i] > LANE_IN + 0.1;
    this.turnSp[i] = side === 0 ? this.max[i] * 0.9 : bike ? 3.2 : side > 0 ? (bus ? 3 : 3.8) : bus ? 3.8 : 5;
    this.turnT[i] = 1e-4;
  }

  /**
   * @param elapsed   seconds (drives the shared signal phase)
   * @param crowd     Crowd instance (cars yield to pedestrians)
   * @param px,pz     player (or player's car) position: cars stop for it
   */
  update(dt, elapsed, hour, px, pz, crowd, visible = true, densityMul = 1) {
    if (!this.meshes?.length && !this.busInst) return;
    for (const M of this.meshes) {
      M.body.visible = visible;
      if (M.glass) M.glass.visible = visible;
    }
    if (this.busInst) this.busInst.visible = visible;
    if (!visible) return;
    const c = this.city;
    const K = c.K;
    const n = this.n;
    const want = Math.round(this.bus0 * Math.min(1, crowdDensity(hour) * 1.1) * densityMul);
    const phase = c.signalPhase(elapsed);
    const stopBack = K.ROAD / 2 + 2.2; // stop line distance before the intersection centre
    const p = this._p;

    for (let i = 0; i < n; i++) {
      // buses run all day; cars thin out with the hour and the weather
      if (i >= want && i < this.bus0) {
        if (this.alive[i] && (this.x[i] - px) ** 2 + (this.z[i] - pz) ** 2 > 70 * 70) this.alive[i] = 0;
        if (!this.alive[i]) continue;
      } else if (!this.alive[i]) {
        this.spawn(i, px, pz, this._first);
        if (!this.alive[i]) continue;
      }
      if ((this.x[i] - px) ** 2 + (this.z[i] - pz) ** 2 > 230 * 230) {
        this.spawn(i, px, pz, false);
        continue;
      }
      const hx = this.hx[i];
      const hz = this.hz[i];

      if (this.turnT[i] > 0) {
        // follow a quadratic curve through the intersection, facing along it
        this.speed[i] = damp(this.speed[i], this.turnSp[i], 2.5, dt);
        this.turnT[i] += (Math.max(1.5, this.speed[i]) * dt) / this.tLen[i];
        const t = Math.min(1, this.turnT[i]);
        const u = 1 - t;
        const ax = this.fromX[i];
        const az = this.fromZ[i];
        const bx = this.ctrlX[i];
        const bz = this.ctrlZ[i];
        const cx2 = this.toX[i];
        const cz2 = this.toZ[i];
        this.x[i] = u * u * ax + 2 * u * t * bx + t * t * cx2;
        this.z[i] = u * u * az + 2 * u * t * bz + t * t * cz2;
        const tx = u * (bx - ax) + t * (cx2 - bx);
        const tz = u * (bz - az) + t * (cz2 - bz);
        if (tx * tx + tz * tz > 1e-6) this.ry[i] = Math.atan2(tx, tz);
        this.sig[i] = t < 0.65 && this.sig[i] !== 2 ? this.sig[i] : this.siren[i] ? 2 : 0;
        if (t >= 1) {
          this.turnT[i] = 0;
          this.ry[i] = Math.atan2(this.hx[i], this.hz[i]);
          this.planTurn(i);
        }
      } else {
        // distance left to the stop line of the next intersection
        const cx = c.roadCenter(this.ti[i]);
        const cz = c.roadCenter(this.tj[i]);
        const toCentre = (cx - this.x[i]) * hx + (cz - this.z[i]) * hz;
        const toStop = toCentre - stopBack;
        let target = this.max[i];
        const interior = this.ti[i] > 0 && this.ti[i] < c.N && this.tj[i] > 0 && this.tj[i] < c.N;
        const green = !interior || (hz !== 0 ? phase === 'ns' : phase === 'ew');
        if (!green && toStop < 14 && toStop > -1.5) target = 0;
        // ease off before turning, and signal for the last 35 m
        const side = this.turnSide(i);
        if (side !== 0 && toStop < 30) target = Math.min(target, (i >= this.bus0 ? 3.2 : 4.2) + Math.max(0, toStop) * 0.42);
        this.sig[i] = side !== 0 && toStop < 35 ? side : this.siren[i] ? 2 : 0;
        // obstacles ahead in my lane: other cars, the player, pedestrians
        const look = 5 + this.speed[i] * 0.9;
        const nose = this.hl[i] - CAR_HL; // extra length of a bus in front of its centre
        for (let k = 0; k < n && target > 0; k++) {
          if (k === i || !this.alive[k]) continue;
          const ahead = (this.x[k] - this.x[i]) * hx + (this.z[k] - this.z[i]) * hz;
          const side = Math.abs((this.x[k] - this.x[i]) * hz - (this.z[k] - this.z[i]) * hx);
          if (ahead > 0.5 && ahead < look + this.hl[i] + this.hl[k] - 1.3 && side < 1.3 + this.hw[k]) target = 0;
        }
        // city work vehicles stopped in the lane (the garbage truck, the street washer)
        for (const b of this.blockers || []) {
          const ahead = (b.x - this.x[i]) * hx + (b.z - this.z[i]) * hz;
          const side = Math.abs((b.x - this.x[i]) * hz - (b.z - this.z[i]) * hx);
          if (ahead > 0.5 && ahead < look + this.hl[i] + b.hl - 1.3 && side < 1.3 + b.hw) target = 0;
        }
        {
          const ahead = (px - this.x[i]) * hx + (pz - this.z[i]) * hz;
          const side = Math.abs((px - this.x[i]) * hz - (pz - this.z[i]) * hx);
          if (ahead > 0 && ahead < look + 3 + nose && side < 2.6 + (this.hw[i] - 0.92)) target = 0;
        }
        // buses pull up at shelters on their side of the street and wait a moment
        if (i >= this.bus0) {
          if (this.dwell[i] > 0) {
            this.dwell[i] -= dt;
            target = 0;
          } else {
            const stops = c.busStops;
            for (let s = 0; s < stops.length; s++) {
              if (s === this.lastStop[i]) continue;
              const ahead = (stops[s].x - this.x[i]) * hx + (stops[s].z - this.z[i]) * hz - 4.4; // to the front door
              if (ahead < -0.5 || ahead > 14) continue;
              const right = (stops[s].x - this.x[i]) * -hz + (stops[s].z - this.z[i]) * hx;
              if (right < 0 || right > 7) continue;
              target = ahead < 0.5 ? 0 : Math.min(target, Math.max(1.6, ahead * 0.9));
              if (ahead < 0.5 && this.speed[i] < 0.5) {
                this.dwell[i] = 5 + this.rng() * 4;
                this.lastStop[i] = s;
                this.onStop?.(this.x[i], this.z[i]);
              }
              break;
            }
          }
        }
        // the player's parked cars (they may have been left in a lane)
        for (const o of this.parked || []) {
          if (target === 0) break;
          const ahead = (o.x - this.x[i]) * hx + (o.z - this.z[i]) * hz;
          const side = Math.abs((o.x - this.x[i]) * hz - (o.z - this.z[i]) * hx);
          if (ahead > 0 && ahead < look + 4 && side < 2.4) target = 0;
        }
        if (target > 0 && crowd && crowd.n) {
          for (let k = 0; k < crowd.n; k++) {
            if (!crowd.alive[k]) continue;
            const ahead = (crowd.x[k] - this.x[i]) * hx + (crowd.z[k] - this.z[i]) * hz;
            if (ahead < 0.5 || ahead > look + nose) continue;
            if (Math.abs((crowd.x[k] - this.x[i]) * hz - (crowd.z[k] - this.z[i]) * hx) < 1.9) {
              target = 0;
              break;
            }
          }
        }
        this.speed[i] = target < this.speed[i] ? damp(this.speed[i], target, 5, dt) : damp(this.speed[i], target, 1.2, dt);
        if (target === 0 && this.speed[i] < 0.25) this.speed[i] = 0;
        this.x[i] += hx * this.speed[i] * dt;
        this.z[i] += hz * this.speed[i] * dt;
        if (toStop <= 0.2 && (green || toStop < -1.5)) this.chooseTurn(i);
      }
      if (!(this.turnT[i] > 0)) {
        // straight lanes: face the direction of travel
        const want2 = Math.atan2(this.hx[i], this.hz[i]);
        let d = want2 - this.ry[i];
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.ry[i] += d * Math.min(1, dt * 4);
      }
      // body motion: lean out of turns, dip the nose under braking
      if (dt > 1e-4) {
        let dy = this.ry[i] - this.prevRy[i];
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        const yawRate = dy / dt;
        const acc = (this.speed[i] - this.prevSp[i]) / dt;
        const soft = i >= this.bus0 ? 0.6 : 1;
        this.roll[i] = damp(this.roll[i], clamp(this.speed[i] * yawRate * 0.011 * soft, -0.06, 0.06), 6, dt);
        this.pitch[i] = damp(this.pitch[i], clamp(-acc * 0.012 * soft, -0.035, 0.035), 6, dt);
      }
      this.prevRy[i] = this.ry[i];
      this.prevSp[i] = this.speed[i];
    }
    this._first = false;

    const m = this._m;
    for (let i = 0; i < n; i++) {
      if (!this.alive[i]) m.makeScale(0, 0, 0);
      else {
        this._q.setFromEuler(this._e.set(this.pitch[i], this.ry[i], this.roll[i], 'YXZ'));
        m.compose(p.set(this.x[i], 0, this.z[i]), this._q, this._s);
      }
      if (i >= this.bus0) {
        this.busInst.setMatrixAt(i - this.bus0, m);
        continue;
      }
      const M = this.meshes[this.slotMesh[i]];
      const k = this.slotIdx[i];
      M.body.setMatrixAt(k, m);
      if (M.glass) M.glass.setMatrixAt(k, m);
      M.sig.setX(k, this.sig[i]);
      if (M.anim) M.anim.setXYZ(k, 3 + this.speed[i] * 1.6, M.anim.getY(k), this.speed[i] > 0.3 ? 1 : 0);
    }
    for (const M of this.meshes) {
      M.body.instanceMatrix.needsUpdate = true;
      if (M.glass) M.glass.instanceMatrix.needsUpdate = true;
      M.sig.needsUpdate = true;
      if (M.anim) M.anim.needsUpdate = true;
    }
    if (this.busInst) {
      this.busInst.visible = visible;
      this.busInst.instanceMatrix.needsUpdate = true;
    }
  }
}
