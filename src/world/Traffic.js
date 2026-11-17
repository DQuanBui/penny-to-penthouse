// Simple ambient traffic: cars follow the inner lanes of the road grid, stop
// at red lights, keep their distance and always yield to pedestrians, the
// player and the player's car. One InstancedMesh; state in typed arrays.
import * as THREE from 'three';
import { carGeometry, LANE_IN } from './Vehicles.js';
import { crowdDensity } from '../characters/Crowd.js';
import { CLOTH_COLORS } from '../characters/Customization.js';
import { mulberry32, damp } from '../core/utils.js';

const COUNTS = { low: 8, medium: 16, high: 26 };
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
    if (this.inst) {
      this.scene.remove(this.inst);
      this.inst.geometry.dispose();
      this.inst.material.dispose();
      this.inst = null;
    }
    this.n = 0;
  }

  setCity(city, quality = 'medium') {
    this.dispose();
    this.city = city;
    const n = (this.n = COUNTS[quality] ?? 16);
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
    this.inst = new THREE.InstancedMesh(carGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.35 }), n);
    this.inst.castShadow = true;
    this.inst.frustumCulled = false;
    for (let i = 0; i < n; i++) this.inst.setColorAt(i, this._c.set(CAR_COLORS[Math.floor(this.rng() * CAR_COLORS.length)]));
    this.inst.instanceColor.needsUpdate = true;
    this.scene.add(this.inst);
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
      if (this.blocked(p.x, p.z, 9, i)) continue;
      this.x[i] = p.x;
      this.z[i] = p.z;
      this.ry[i] = Math.atan2(this.hx[i], this.hz[i]);
      this.max[i] = 8.5 + this.rng() * 4;
      this.speed[i] = this.max[i] * 0.6;
      this.turnT[i] = 0;
      this.alive[i] = 1;
      return;
    }
    this.alive[i] = 0;
  }

  /** Is any traffic car within r of a point? (used by the player's car and spawning) */
  blocked(x, z, r, ignore = -1) {
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i] || i === ignore) continue;
      if ((this.x[i] - x) ** 2 + (this.z[i] - z) ** 2 < r * r) return true;
    }
    return false;
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
      const score = w * this.rng();
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
    if (!visible) return;
    const c = this.city;
    const K = c.K;
    const n = this.n;
    const want = Math.round(n * Math.min(1, crowdDensity(hour) * 1.1) * densityMul);
    const phase = c.signalPhase(elapsed);
    const stopBack = K.ROAD / 2 + 2.2; // stop line distance before the intersection centre
    const p = this._p;

    for (let i = 0; i < n; i++) {
      if (i >= want) {
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
        for (let k = 0; k < n && target > 0; k++) {
          if (k === i || !this.alive[k]) continue;
          const ahead = (this.x[k] - this.x[i]) * hx + (this.z[k] - this.z[i]) * hz;
          const side = Math.abs((this.x[k] - this.x[i]) * hz - (this.z[k] - this.z[i]) * hx);
          if (ahead > 0.5 && ahead < look + 3 && side < 2.2) target = 0;
        }
        {
          const ahead = (px - this.x[i]) * hx + (pz - this.z[i]) * hz;
          const side = Math.abs((px - this.x[i]) * hz - (pz - this.z[i]) * hx);
          if (ahead > 0 && ahead < look + 3 && side < 2.6) target = 0;
        }
        if (target > 0 && crowd && crowd.n) {
          for (let k = 0; k < crowd.n; k++) {
            if (!crowd.alive[k]) continue;
            const ahead = (crowd.x[k] - this.x[i]) * hx + (crowd.z[k] - this.z[i]) * hz;
            if (ahead < 0.5 || ahead > look) continue;
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
      this.inst.setMatrixAt(i, m);
    }
    this.inst.instanceMatrix.needsUpdate = true;
  }
}
