// Ambient pedestrians. Agents walk the sidewalk grid (block edges and
// crosswalks) around the player; density follows the time of day (commute,
// lunch, nightlife) and the weather. They wait for the walk signal before
// crossing, stop now and then to window-shop or check their phone, and a few
// are out jogging.
//
// LOD: the nearest people get full animated rigs from a pool; everyone else is
// ONE InstancedMesh whose walking legs/arms, skin, hair and clothes are all
// driven per instance in the vertex shader. State lives in typed arrays — no
// per-frame allocations.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRig } from './CharacterFactory.js';
import { glbNpcModels } from './GLBCharacters.js';
import { randomAppearance, SKIN_TONES, HAIR_COLORS } from './Customization.js';
import { animateRig } from './Animation.js';
import { worldUniforms } from '../world/Buildings.js';
import { mulberry32 } from '../core/utils.js';

const COUNTS = { low: [80, 8], medium: [170, 16], high: [240, 24] }; // [agents, rigs]
const INSET = 2.6; // walking line: distance from the kerb
const NEAR = 40; // full rigs inside this radius
const FAR = 105; // agents further away respawn closer to the player
const SPAWN_RING = 1; // spawn within ±1 block of the player (the 3×3 blocks around them)

// muted, realistic clothing colours (tops / bottoms)
const TOPS = ['#e9e6df', '#1f2229', '#3b4558', '#6d7787', '#8c2f2f', '#c46a3a', '#d9b44a', '#3f6e4a', '#2f6e78', '#2f5aa3', '#5a4a8a', '#a8577a', '#7a5a42', '#c9b9a0', '#24324f', '#e0d6c4', '#9aa6b2'];
const BOTTOMS = ['#1d2433', '#2b3448', '#3a3f48', '#5c6370', '#8a7a62', '#c9b9a0', '#1f1f22', '#4a3a2c', '#2d4a6b', '#6b5a48'];

/** 0..1 share of the crowd that is out at a given hour. */
export function crowdDensity(hour) {
  if (hour < 5) return 0.1;
  if (hour < 7) return 0.35;
  if (hour < 9.5) return 1;
  if (hour < 11.5) return 0.65;
  if (hour < 13.5) return 1;
  if (hour < 16.5) return 0.7;
  if (hour < 19.5) return 1;
  if (hour < 23) return 0.6;
  return 0.25;
}

// part ids used by the shader: 0 top, 1 bottom, 2 skin, 3 hair, 4 shoes
function impostorGeometry() {
  const parts = [];
  const add = (g, part, swing = 0, pivot = 0) => {
    const n = g.attributes.position.count;
    g.deleteAttribute('uv');
    g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1));
    const sw = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      sw[i * 2] = swing;
      sw[i * 2 + 1] = pivot;
    }
    g.setAttribute('aSwing', new THREE.BufferAttribute(sw, 2));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    parts.push(g);
  };
  // head, hair, neck
  add(new THREE.SphereGeometry(0.115, 10, 8).scale(0.95, 1.08, 1).translate(0, 1.63, 0.005), 2);
  add(new THREE.SphereGeometry(0.125, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 1.645, -0.012), 3);
  add(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 8).translate(0, 1.49, 0), 2);
  // torso + shoulders + hips
  add(new THREE.CapsuleGeometry(0.16, 0.3, 4, 10).scale(1, 1, 0.72).translate(0, 1.22, 0), 0);
  add(new THREE.SphereGeometry(1, 10, 6).scale(0.2, 0.065, 0.11).translate(0, 1.38, 0), 0);
  add(new THREE.SphereGeometry(1, 10, 6).scale(0.155, 0.11, 0.105).translate(0, 0.96, 0), 1);
  // arms (swing opposite to the legs) with hands
  for (const m of [-1, 1]) {
    add(new THREE.CapsuleGeometry(0.048, 0.42, 3, 6).translate(m * 0.205, 1.12, 0), 0, -m, 1.38);
    add(new THREE.SphereGeometry(0.042, 6, 5).translate(m * 0.205, 0.86, 0.01), 2, -m, 1.38);
  }
  // legs + shoes
  for (const m of [-1, 1]) {
    add(new THREE.CapsuleGeometry(0.068, 0.68, 3, 6).translate(m * 0.088, 0.5, 0), 1, m, 0.93);
    add(new THREE.BoxGeometry(0.1, 0.07, 0.24).translate(m * 0.088, 0.035, 0.04), 4, m, 0.93);
  }
  return mergeGeometries(parts);
}

function impostorMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = worldUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        attribute float aPart;
        attribute vec2 aSwing;
        attribute vec3 aGait; // stride frequency, phase, moving 0..1
        attribute vec3 aTop;
        attribute vec3 aBottom;
        attribute vec3 aSkin;
        attribute vec3 aHair;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float cyc = uTime * aGait.x + aGait.y;
        if (aSwing.x != 0.0) {
          float ang = sin(cyc) * 0.5 * aGait.z * aSwing.x;
          float yy = transformed.y - aSwing.y;
          float cs = cos(ang);
          float sn = sin(ang);
          transformed.y = aSwing.y + yy * cs - transformed.z * sn;
          transformed.z = yy * sn + transformed.z * cs;
        }
        transformed.y += abs(sin(cyc)) * 0.025 * aGait.z;`,
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        vColor.rgb = aPart < 0.5 ? aTop : (aPart < 1.5 ? aBottom : (aPart < 2.5 ? aSkin : (aPart < 3.5 ? aHair : vec3(0.07, 0.07, 0.08))));`,
      );
  };
  return mat;
}

/**
 * An InstancedMesh of n varied low-poly people (skin, hair, clothes) whose
 * limbs animate in the vertex shader. gait.(x freq, y phase, z 0 idle..1 moving)
 */
export function createImpostors(n, rng) {
  const c = new THREE.Color();
  const geo = impostorGeometry();
  const attr = (size) => new THREE.InstancedBufferAttribute(new Float32Array(n * size), size);
  const top = attr(3);
  const bottom = attr(3);
  const skin = attr(3);
  const hair = attr(3);
  const gait = attr(3);
  for (let i = 0; i < n; i++) {
    const put = (a, hex) => {
      c.set(hex).convertSRGBToLinear();
      a.setXYZ(i, c.r, c.g, c.b);
    };
    put(top, TOPS[Math.floor(rng() * TOPS.length)]);
    put(bottom, BOTTOMS[Math.floor(rng() * BOTTOMS.length)]);
    put(skin, SKIN_TONES[Math.floor(rng() * SKIN_TONES.length)]);
    put(hair, HAIR_COLORS[Math.floor(rng() * 10)]);
    gait.setXYZ(i, 6, rng() * 6.28, 0);
  }
  geo.setAttribute('aTop', top);
  geo.setAttribute('aBottom', bottom);
  geo.setAttribute('aSkin', skin);
  geo.setAttribute('aHair', hair);
  geo.setAttribute('aGait', gait);
  const mesh = new THREE.InstancedMesh(geo, impostorMaterial(), n);
  mesh.frustumCulled = false;
  return { mesh, gait };
}

export class Crowd {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.city = null;
    this.n = 0;
    this.rigs = [];
    this.densityMul = 1;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
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
    this.ry = new Float32Array(n);
    this.pause = new Float32Array(n); // seconds left standing still
    this.waitSig = new Uint8Array(n); // 1 = waiting to cross on a signal
    this.crossAxis = new Uint8Array(n); // 1 crossing along x, 2 along z
    this.chat = new Uint8Array(n); // talks on the phone / to a friend while paused
    this.off = new Float32Array(n); // sidestep: current offset from the walking line (m, to the right)
    this.tOff = new Float32Array(n); // ...and where it is heading
    this.bi = new Int16Array(n);
    this.bj = new Int16Array(n);
    this.alive = new Uint8Array(n);
    this.rigOf = new Int8Array(n).fill(-1);

    const imp = createImpostors(n, this.rng);
    this.inst = imp.mesh;
    this.gait = imp.gait;
    this.group.add(this.inst);
    const models = glbNpcModels();
    for (let k = 0; k < r; k++) {
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
    // back onto the walking line before snapping to the corner
    if (this.off[i]) {
      this.x[i] += this.hz[i] * this.off[i];
      this.z[i] -= this.hx[i] * this.off[i];
      this.off[i] = 0;
    }
    this.tOff[i] = 0;
    const x0 = c.blockMin(this.bi[i]) + INSET;
    const x1 = x0 + K.BLOCK - INSET * 2;
    const z0 = c.blockMin(this.bj[i]) + INSET;
    const z1 = z0 + K.BLOCK - INSET * 2;
    const atX0 = Math.abs(this.x[i] - x0) < 1;
    const atZ0 = Math.abs(this.z[i] - z0) < 1;
    this.x[i] = atX0 ? x0 : x1;
    this.z[i] = atZ0 ? z0 : z1;
    // the intersection at this corner (road indices); only inner ones have signals
    const ix = atX0 ? this.bi[i] : this.bi[i] + 1;
    const iz = atZ0 ? this.bj[i] : this.bj[i] + 1;
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
    this.crossAxis[i] = crossing ? (hx ? 1 : 2) : 0;
    if (crossing) {
      this.waitSig[i] = ix > 0 && ix < c.N && iz > 0 && iz < c.N ? 1 : 0;
    } else {
      this.waitSig[i] = 0;
      // now and then stop at a corner for a while
      if (this.rng() < 0.1) {
        this.pause[i] = 4 + this.rng() * 14;
        this.chat[i] = this.rng() < 0.5 ? 1 : 0;
      }
    }
  }

  spawn(i, px, pz, anywhere) {
    const c = this.city;
    const K = c.K;
    const clampI = (v) => Math.max(0, Math.min(c.N - 1, v));
    const pi = clampI(Math.floor((px + c.half - K.ROAD) / K.PITCH));
    const pj = clampI(Math.floor((pz + c.half - K.ROAD) / K.PITCH));
    for (let tries = 0; tries < 6; tries++) {
      this.bi[i] = clampI(pi + Math.floor(this.rng() * (SPAWN_RING * 2 + 1)) - SPAWN_RING);
      this.bj[i] = clampI(pj + Math.floor(this.rng() * (SPAWN_RING * 2 + 1)) - SPAWN_RING);
      this.x[i] = c.blockMin(this.bi[i]) + INSET + (this.rng() < 0.5 ? 0 : K.BLOCK - INSET * 2);
      this.z[i] = c.blockMin(this.bj[i]) + INSET + (this.rng() < 0.5 ? 0 : K.BLOCK - INSET * 2);
      this.hx[i] = 0;
      this.hz[i] = 0;
      this.chooseNext(i, true);
      if (this.crossAxis[i]) continue; // start on a sidewalk, not in the road
      const f = this.rng() * this.left[i];
      this.x[i] += this.hx[i] * f;
      this.z[i] += this.hz[i] * f;
      this.left[i] -= f;
      const d2 = (this.x[i] - px) ** 2 + (this.z[i] - pz) ** 2;
      if (anywhere || d2 > 32 * 32) break;
    }
    const jogger = this.rng() < 0.06;
    this.speed[i] = jogger ? 2.6 + this.rng() * 0.6 : 1.05 + this.rng() * 0.55;
    this.pause[i] = 0;
    this.off[i] = 0;
    this.tOff[i] = 0;
    this.ry[i] = Math.atan2(this.hx[i], this.hz[i]);
    this.alive[i] = 1;
  }

  /**
   * Walk around anything solid on the pavement (hedges, bins, patios, shelters,
   * a parked bike...) by sliding sideways within the sidewalk.
   */
  steer(i) {
    const col = this.city.colliders;
    const hx = this.hx[i];
    const hz = this.hz[i];
    // the walking line under the agent, and the right-hand direction
    const lx = this.x[i] + hz * this.off[i];
    const lz = this.z[i] - hx * this.off[i];
    const rx = -hz;
    const rz = hx;
    const free = (o) => {
      for (const a of [0.6, 1.3]) {
        if (col.pointBlocked(lx + rx * o + hx * a, 0.55, lz + rz * o + hz * a, 0.32)) return false;
      }
      return true;
    };
    const cur = this.tOff[i];
    // near the corner, head back to the line so the turn is seamless
    const pref = this.left[i] < 2.5 ? 0 : cur;
    if (free(pref)) {
      this.tOff[i] = pref !== 0 && free(0) ? 0 : pref;
      return;
    }
    for (const o of [cur + 0.9, cur - 0.9, cur + 1.8, cur - 1.8, 0]) {
      if (Math.abs(o) <= 1.9 && free(o)) {
        this.tOff[i] = o;
        return;
      }
    }
    // boxed in: wait a moment
    this.pause[i] = 0.8;
    this.chat[i] = 0;
  }

  /** May agent i start crossing right now? (walk signal) */
  canCross(i, phase) {
    if (!this.waitSig[i]) return true;
    // moving along x crosses a north–south road: walk while N–S cars are stopped
    return this.crossAxis[i] === 1 ? phase === 'ew' : phase === 'ns';
  }

  // ---- per frame ------------------------------------------------------------
  /**
   * @param visible false while the player is indoors (crowd is paused + hidden)
   * @param elapsed seconds since start (shared traffic-signal clock)
   */
  update(dt, px, pz, hour, visible = true, elapsed = 0) {
    if (!this.city) return;
    this.group.visible = visible;
    if (!visible) return;
    const n = this.n;
    const want = Math.round(n * crowdDensity(hour) * (this.densityMul ?? 1));
    const groundY = this.city.groundY;
    const phase = this.city.signalPhase(elapsed);
    const gait = this.gait;
    this._frame = ((this._frame || 0) + 1) & 1023;

    for (let i = 0; i < n; i++) {
      if (i >= want) {
        // surplus agents retire once they are out of sight
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
      let v = this.speed[i];
      if (this.pause[i] > 0) {
        this.pause[i] -= dt;
        v = 0;
      } else if (this.waitSig[i] && this.left[i] > this.city.K.ROAD + INSET * 2 - 0.05) {
        // standing at the kerb until the walk signal
        if (this.canCross(i, phase)) this.waitSig[i] = 0;
        else v = 0;
      }
      // step aside politely if the player is right in the way
      if (v > 0 && d2 < 0.9 * 0.9 && -(dx * this.hx[i] + dz * this.hz[i]) > 0) v = 0;
      // sidewalks only: look ahead for obstacles (a quarter of the agents each frame)
      if (v > 0 && !this.crossAxis[i] && ((i + this._frame) & 3) === 0) this.steer(i);
      const dOff = Math.max(-dt * 1.3, Math.min(dt * 1.3, this.tOff[i] - this.off[i]));
      if (dOff) {
        this.off[i] += dOff;
        this.x[i] -= this.hz[i] * dOff;
        this.z[i] += this.hx[i] * dOff;
        v *= 0.8;
      }
      this.cur[i] = v;
      this.x[i] += this.hx[i] * v * dt;
      this.z[i] += this.hz[i] * v * dt;
      this.left[i] -= v * dt;
      if (this.left[i] <= 0) {
        this.x[i] += this.hx[i] * this.left[i];
        this.z[i] += this.hz[i] * this.left[i];
        this.chooseNext(i, false);
      }
      // turn smoothly into the new direction
      const want2 = Math.atan2(this.hx[i], this.hz[i]);
      let da = want2 - this.ry[i];
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      this.ry[i] += da * Math.min(1, dt * 8);
      // gait: stride frequency from speed, legs still when standing
      const moving = v > 0.1 ? 1 : 0;
      gait.setX(i, v > 2 ? 9.5 : 5.2 + v * 1.2);
      gait.setZ(i, gait.getZ(i) + (moving - gait.getZ(i)) * Math.min(1, dt * 6));
    }
    gait.needsUpdate = true;
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
      rig.group.position.set(this.x[a], groundY(this.x[a], this.z[a]), this.z[a]);
      rig.group.rotation.y = this.ry[a];
      animateRig(rig, dt, { speed: this.cur[a], grounded: true, talking: this.pause[a] > 0 && this.chat[a] === 1 });
    }

    // impostors
    const m = this._m;
    for (let i = 0; i < n; i++) {
      if (!this.alive[i] || this.rigOf[i] >= 0) {
        m.makeScale(0, 0, 0);
      } else {
        this._q.setFromAxisAngle(this._up, this.ry[i]);
        m.compose(this._p.set(this.x[i], groundY(this.x[i], this.z[i]), this.z[i]), this._q, this._s);
      }
      this.inst.setMatrixAt(i, m);
    }
    this.inst.instanceMatrix.needsUpdate = true;
  }
}
