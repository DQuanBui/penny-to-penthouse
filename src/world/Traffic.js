// Simple ambient traffic: cars follow the inner lanes of the road grid, stop
// at red lights, keep their distance and always yield to pedestrians, the
// player and the player's car. One InstancedMesh; state in typed arrays.
import * as THREE from 'three';
import { LANE_IN } from './Vehicles.js';
import { carGeometry, busGeometry, carMaterial } from './CarModel.js';
import { crowdDensity } from '../characters/Crowd.js';
import { CLOTH_COLORS } from '../characters/Customization.js';
import { mulberry32, damp } from '../core/utils.js';
import { obbOverlap, pushOutOBB } from './Collision.js';

const COUNTS = { low: 8, medium: 16, high: 26 };
const BUSES = { low: 1, medium: 3, high: 4 };
const CAR_HL = 2.17;
const BUS_HL = 5.75;
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
  }

  dispose() {
    for (const k of ['inst', 'busInst']) {
      if (!this[k]) continue;
      this.scene.remove(this[k]);
      this[k].geometry.dispose();
      this[k].material.dispose();
      this[k] = null;
    }
    this.n = 0;
  }

  setCity(city, quality = 'medium') {
    this.dispose();
    this.city = city;
    // the last few slots are city buses
    const nb = (this.nb = (city.busStops || []).length ? BUSES[quality] ?? 3 : 0);
    const n = (this.n = (COUNTS[quality] ?? 16) + nb);
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
    this.inst = new THREE.InstancedMesh(carGeometry(), carMaterial(), n);
    this.inst.castShadow = true;
    this.inst.frustumCulled = false;
    for (let i = 0; i < n; i++) this.inst.setColorAt(i, this._c.set(CAR_COLORS[Math.floor(this.rng() * CAR_COLORS.length)]));
    this.inst.instanceColor.needsUpdate = true;
    this.scene.add(this.inst);
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
    out.x = c.roadCenter(this.ti[i]) - hx * back - hz * LANE_IN;
    out.z = c.roadCenter(this.tj[i]) - hz * back + hx * LANE_IN;
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
      this.max[i] = i >= this.bus0 ? 7 + this.rng() : 8.5 + this.rng() * 4;
      this.dwell[i] = 0;
      this.lastStop[i] = -1;
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

  /** Pick the next intersection after arriving at (ti,tj). */
  chooseTurn(i) {
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
    this.fromX[i] = this.x[i];
    this.fromZ[i] = this.z[i];
    this.hx[i] = best[0];
    this.hz[i] = best[1];
    this.ti[i] += best[0];
    this.tj[i] += best[1];
    this.turnT[i] = 1e-4;
  }

  /**
   * @param elapsed   seconds (drives the shared signal phase)
   * @param crowd     Crowd instance (cars yield to pedestrians)
   * @param px,pz     player (or player's car) position: cars stop for it
   */
  update(dt, elapsed, hour, px, pz, crowd, visible = true, densityMul = 1) {
    if (!this.inst) return;
    this.inst.visible = visible;
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
        // glide through the intersection onto the next lane
        const to = this.lanePoint(i, K.PITCH - stopBack, p);
        const len = Math.hypot(to.x - this.fromX[i], to.z - this.fromZ[i]) || 1;
        this.turnT[i] += (Math.max(4, this.speed[i]) * dt) / len;
        const t = Math.min(1, this.turnT[i]);
        this.x[i] = this.fromX[i] + (to.x - this.fromX[i]) * t;
        this.z[i] = this.fromZ[i] + (to.z - this.fromZ[i]) * t;
        if (t >= 1) this.turnT[i] = 0;
        this.speed[i] = damp(this.speed[i], this.max[i] * 0.7, 2, dt);
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
        // obstacles ahead in my lane: other cars, the player, pedestrians
        const look = 5 + this.speed[i] * 0.9;
        const nose = this.hl[i] - CAR_HL; // extra length of a bus in front of its centre
        for (let k = 0; k < n && target > 0; k++) {
          if (k === i || !this.alive[k]) continue;
          const ahead = (this.x[k] - this.x[i]) * hx + (this.z[k] - this.z[i]) * hz;
          const side = Math.abs((this.x[k] - this.x[i]) * hz - (this.z[k] - this.z[i]) * hx);
          if (ahead > 0.5 && ahead < look + this.hl[i] + this.hl[k] - 1.3 && side < 1.3 + this.hw[k]) target = 0;
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
      // face the direction of travel (smoothly through turns)
      const want2 = Math.atan2(this.hx[i], this.hz[i]);
      let d = want2 - this.ry[i];
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.ry[i] += d * Math.min(1, dt * 4);
    }
    this._first = false;

    const m = this._m;
    for (let i = 0; i < n; i++) {
      if (!this.alive[i]) m.makeScale(0, 0, 0);
      else {
        this._q.setFromAxisAngle(this._up, this.ry[i]);
        m.compose(p.set(this.x[i], 0, this.z[i]), this._q, this._s);
      }
      if (i >= this.bus0) {
        this.busInst.setMatrixAt(i - this.bus0, m);
        m.makeScale(0, 0, 0);
      }
      this.inst.setMatrixAt(i, m);
    }
    this.inst.instanceMatrix.needsUpdate = true;
    if (this.busInst) {
      this.busInst.visible = visible;
      this.busInst.instanceMatrix.needsUpdate = true;
    }
  }
}
