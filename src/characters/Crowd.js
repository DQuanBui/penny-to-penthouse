// Ambient pedestrians. Agents random-walk the sidewalk grid (block edges and
// crosswalks) around the player; density follows the time of day (commute,
// lunch, nightlife). LOD: the nearest few get full animated rigs from a small
// pool, everyone else is one InstancedMesh of low-poly figures.
// All state lives in typed arrays — no per-frame allocations.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRig } from './CharacterFactory.js';
import { glbNpcModels } from './GLBCharacters.js';
import { randomAppearance, CLOTH_COLORS } from './Customization.js';
import { animateRig } from './Animation.js';
import { mulberry32 } from '../core/utils.js';

const COUNTS = { low: [36, 6], medium: [64, 12], high: [90, 18] }; // [agents, rigs]
const INSET = 2.6; // walking line: distance from the kerb
const NEAR = 44;
const FAR = 175;

/** 0..1 share of the crowd that is out at a given hour. */
export function crowdDensity(hour) {
  if (hour < 5) return 0.12;
  if (hour < 7) return 0.35;
  if (hour < 9.5) return 1;
  if (hour < 11.5) return 0.6;
  if (hour < 13.5) return 0.95;
  if (hour < 16.5) return 0.6;
  if (hour < 19.5) return 1;
  if (hour < 23) return 0.7;
  return 0.3;
}

function impostorGeometry() {
  const paint = (g, r, gr, b) => {
    const n = g.attributes.position.count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      c[i * 3] = r;
      c[i * 3 + 1] = gr;
      c[i * 3 + 2] = b;
    }
    g.deleteAttribute('uv');
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  };
  return mergeGeometries([
    paint(new THREE.CapsuleGeometry(0.17, 0.42, 3, 8).translate(0, 1.18, 0), 1, 1, 1), // torso takes the instance colour
    paint(new THREE.BoxGeometry(0.28, 0.82, 0.2).translate(0, 0.42, 0), 0.22, 0.24, 0.3),
    paint(new THREE.SphereGeometry(0.135, 8, 6).translate(0, 1.66, 0), 0.75, 0.58, 0.46),
  ]);
}

export class Crowd {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.city = null;
    this.n = 0;
    this.rigs = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._c = new THREE.Color();
    this._timer = 0;
    this.rng = mulberry32(4242);
  }

  dispose() {
    for (const r of this.rigs) r.dispose();
    this.rigs = [];
    if (this.inst) {
      this.inst.geometry.dispose();
      this.inst.material.dispose();
    }
    this.group.clear();
    this.inst = null;
  }

  /** (Re)build for a city and quality preset. */
  setCity(city, quality = 'medium') {
    this.dispose();
    this.city = city;
    const [n, r] = COUNTS[quality] || COUNTS.medium;
    this.n = n;
    this.x = new Float32Array(n);
    this.z = new Float32Array(n);
    this.hx = new Float32Array(n);
    this.hz = new Float32Array(n);
    this.left = new Float32Array(n);
    this.speed = new Float32Array(n);
    this.cur = new Float32Array(n); // current speed (0 while waiting)
    this.bi = new Int16Array(n);
    this.bj = new Int16Array(n);
    this.alive = new Uint8Array(n);
    this.rigOf = new Int8Array(n).fill(-1);
    this.inst = new THREE.InstancedMesh(impostorGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), n);
    this.inst.frustumCulled = false;
    for (let i = 0; i < n; i++) this.inst.setColorAt(i, this._c.set(CLOTH_COLORS[Math.floor(this.rng() * CLOTH_COLORS.length)]));
    this.inst.instanceColor.needsUpdate = true;
    this.group.add(this.inst);
    for (let k = 0; k < r; k++) {
      const models = glbNpcModels();
      const look = randomAppearance(this.rng);
      const rig = createRig(models.length ? { ...look, model: models[k % models.length] } : look);
      rig.group.visible = false;
      rig.agent = -1;
      this.group.add(rig.group);
      this.rigs.push(rig);
    }
    this._first = true;
  }

  // ---- navigation ---------------------------------------------------------
  /** Pick the next segment for agent i standing on a corner of block (bi,bj). */
  chooseNext(i, allowReverse) {
    const c = this.city;
    const K = c.K;
    const x0 = c.blockMin(this.bi[i]) + INSET;
    const x1 = x0 + K.BLOCK - INSET * 2;
    const z0 = c.blockMin(this.bj[i]) + INSET;
    const z1 = z0 + K.BLOCK - INSET * 2;
    const atX0 = Math.abs(this.x[i] - x0) < 1;
    const atZ0 = Math.abs(this.z[i] - z0) < 1;
    this.x[i] = atX0 ? x0 : x1;
    this.z[i] = atZ0 ? z0 : z1;
    const along = K.BLOCK - INSET * 2;
    const cross = K.ROAD + INSET * 2;
    const ohx = this.hx[i];
    const ohz = this.hz[i];
    // candidates: +x, -x, +z, -z
    let best = -1;
    let bestW = -1;
    for (let k = 0; k < 4; k++) {
      const hx = k === 0 ? 1 : k === 1 ? -1 : 0;
      const hz = k === 2 ? 1 : k === 3 ? -1 : 0;
      if (!allowReverse && hx === -ohx && hz === -ohz && (ohx || ohz)) continue;
      let ok = true;
      if (hx > 0 && !atX0) ok = this.bi[i] + 1 < c.N;
      else if (hx < 0 && atX0) ok = this.bi[i] - 1 >= 0;
      else if (hz > 0 && !atZ0) ok = this.bj[i] + 1 < c.N;
      else if (hz < 0 && atZ0) ok = this.bj[i] - 1 >= 0;
      if (!ok) continue;
      const w = (hx === ohx && hz === ohz ? 2 : 1) * this.rng();
      if (w > bestW) {
        bestW = w;
        best = k;
      }
    }
    if (best < 0) return this.chooseNext(i, true);
    const hx = best === 0 ? 1 : best === 1 ? -1 : 0;
    const hz = best === 2 ? 1 : best === 3 ? -1 : 0;
    this.hx[i] = hx;
    this.hz[i] = hz;
    let crossing = false;
    if (hx > 0 && !atX0) (crossing = true), this.bi[i]++;
    else if (hx < 0 && atX0) (crossing = true), this.bi[i]--;
    else if (hz > 0 && !atZ0) (crossing = true), this.bj[i]++;
    else if (hz < 0 && atZ0) (crossing = true), this.bj[i]--;
    this.left[i] = crossing ? cross : along;
  }

  spawn(i, px, pz, anywhere) {
    const c = this.city;
    const K = c.K;
    const clampI = (v) => Math.max(0, Math.min(c.N - 1, v));
    const pi = clampI(Math.floor((px + c.half - K.ROAD) / K.PITCH));
    const pj = clampI(Math.floor((pz + c.half - K.ROAD) / K.PITCH));
    for (let tries = 0; tries < 5; tries++) {
      this.bi[i] = clampI(pi + Math.floor(this.rng() * 5) - 2);
      this.bj[i] = clampI(pj + Math.floor(this.rng() * 5) - 2);
      this.x[i] = c.blockMin(this.bi[i]) + INSET + (this.rng() < 0.5 ? 0 : K.BLOCK - INSET * 2);
      this.z[i] = c.blockMin(this.bj[i]) + INSET + (this.rng() < 0.5 ? 0 : K.BLOCK - INSET * 2);
      this.hx[i] = 0;
      this.hz[i] = 0;
      this.chooseNext(i, true);
      // start somewhere along the segment
      const f = this.rng() * this.left[i];
      this.x[i] += this.hx[i] * f;
      this.z[i] += this.hz[i] * f;
      this.left[i] -= f;
      const d2 = (this.x[i] - px) ** 2 + (this.z[i] - pz) ** 2;
      if (anywhere || d2 > 30 * 30) break;
    }
    this.speed[i] = 1.15 + this.rng() * 0.6;
    this.alive[i] = 1;
  }

  // ---- per frame ------------------------------------------------------------
  /**
   * @param visible false while the player is indoors (crowd is paused + hidden)
   */
  update(dt, px, pz, hour, visible = true) {
    if (!this.city) return;
    this.group.visible = visible;
    if (!visible) return;
    const n = this.n;
    const want = Math.round(n * crowdDensity(hour) * (this.densityMul ?? 1));
    const groundY = this.city.groundY;

    for (let i = 0; i < n; i++) {
      if (i >= want) {
        // night-time: surplus agents retire once they are out of sight
        if (this.alive[i] && (this.x[i] - px) ** 2 + (this.z[i] - pz) ** 2 > 60 * 60) this.alive[i] = 0;
        if (!this.alive[i]) continue;
      } else if (!this.alive[i]) this.spawn(i, px, pz, this._first);
      const dx = this.x[i] - px;
      const dz = this.z[i] - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 > FAR * FAR) {
        this.spawn(i, px, pz, false);
        continue;
      }
      // wait politely if the player is right in the way
      const blockedByPlayer = d2 < 0.85 * 0.85 && -(dx * this.hx[i] + dz * this.hz[i]) > 0;
      const v = blockedByPlayer ? 0 : this.speed[i];
      this.cur[i] = v;
      this.x[i] += this.hx[i] * v * dt;
      this.z[i] += this.hz[i] * v * dt;
      this.left[i] -= v * dt;
      if (this.left[i] <= 0) {
        this.x[i] += this.hx[i] * this.left[i];
        this.z[i] += this.hz[i] * this.left[i];
        this.chooseNext(i, false);
      }
    }
    this._first = false;

    // LOD assignment a few times per second
    this._timer -= dt;
    if (this._timer <= 0) {
      this._timer = 0.3;
      for (let k = 0; k < this.rigs.length; k++) {
        const rig = this.rigs[k];
        const a = rig.agent;
        if (a >= 0 && (!this.alive[a] || (this.x[a] - px) ** 2 + (this.z[a] - pz) ** 2 > (NEAR + 8) ** 2)) {
          this.rigOf[a] = -1;
          rig.agent = -1;
          rig.group.visible = false;
        }
      }
      let free = 0;
      for (let i = 0; i < n; i++) {
        if (!this.alive[i] || this.rigOf[i] >= 0) continue;
        if ((this.x[i] - px) ** 2 + (this.z[i] - pz) ** 2 > NEAR * NEAR) continue;
        while (free < this.rigs.length && this.rigs[free].agent >= 0) free++;
        if (free >= this.rigs.length) break;
        this.rigs[free].agent = i;
        this.rigs[free].group.visible = true;
        this.rigOf[i] = free;
      }
    }

    // animated rigs
    for (let k = 0; k < this.rigs.length; k++) {
      const rig = this.rigs[k];
      const a = rig.agent;
      if (a < 0) continue;
      const y = groundY(this.x[a], this.z[a]);
      rig.group.position.set(this.x[a], y, this.z[a]);
      rig.group.rotation.y = Math.atan2(this.hx[a], this.hz[a]);
      animateRig(rig, dt, { speed: this.cur[a], grounded: true });
    }

    // impostors
    const m = this._m;
    for (let i = 0; i < n; i++) {
      if (!this.alive[i] || this.rigOf[i] >= 0) {
        m.makeScale(0, 0, 0);
      } else {
        this._q.setFromAxisAngle(this._up, Math.atan2(this.hx[i], this.hz[i]));
        m.compose(this._p.set(this.x[i], groundY(this.x[i], this.z[i]), this.z[i]), this._q, this._s.set(1, 1, 1));
      }
      this.inst.setMatrixAt(i, m);
    }
    this.inst.instanceMatrix.needsUpdate = true;
  }
}
