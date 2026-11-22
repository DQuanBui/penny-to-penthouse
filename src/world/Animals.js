// City wildlife and pets:
//   dogs     on leashes, walking beside some pedestrians (sit and wag when they stop)
//   pigeons  flocks pecking on the sidewalk that burst into the air when you get close
//   birds    flocks gliding high over the city by day (gulls in waterfront cities)
//   ducks    paddling around park fountains
// Each species is ONE InstancedMesh; legs, tails, heads and wings are animated
// in the vertex shader from per-instance gait data. No per-frame allocations.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldUniforms } from './Buildings.js';
import { mulberry32 } from '../core/utils.js';

// aSwing = (sign, pivotY, axis, pivotX/pivotZ)
//   axis 0 legs (about X)  ·  1 wings (about Z)  ·  2 tail wag (about Y)  ·  3 head peck (about X)
class Shape {
  constructor() {
    this.parts = [];
  }
  add(geo, color, swing = [0, 0, 0, 0]) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    const n = geo.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    const sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      col.set([c.r, c.g, c.b], i * 3);
      sw.set(swing, i * 4);
    }
    geo.deleteAttribute('uv');
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSwing', new THREE.BufferAttribute(sw, 4));
    this.parts.push(geo);
    return this;
  }
  build() {
    return mergeGeometries(this.parts);
  }
}

export function dogGeometry() {
  const S = new Shape();
  const coat = '#ffffff'; // tinted per instance
  S.add(new THREE.CapsuleGeometry(0.12, 0.36, 4, 10).rotateX(Math.PI / 2).translate(0, 0.42, 0), coat);
  S.add(new THREE.SphereGeometry(0.105, 10, 8).translate(0, 0.56, 0.3), coat, [1, 0.5, 3, 0.22]);
  S.add(new THREE.BoxGeometry(0.08, 0.07, 0.12).translate(0, 0.53, 0.42), coat, [1, 0.5, 3, 0.22]);
  S.add(new THREE.SphereGeometry(0.022, 6, 5).translate(0, 0.55, 0.485), '#151515', [1, 0.5, 3, 0.22]); // nose
  for (const m of [-1, 1]) {
    S.add(new THREE.SphereGeometry(0.026, 8, 6).scale(1, 1.15, 0.6).translate(m * 0.046, 0.6, 0.392), '#fbfaf7', [1, 0.5, 3, 0.22]); // eyes
    S.add(new THREE.SphereGeometry(0.018, 8, 6).scale(1, 1.15, 0.6).translate(m * 0.046, 0.598, 0.402), '#151515', [1, 0.5, 3, 0.22]);
    S.add(new THREE.SphereGeometry(0.006, 6, 4).translate(m * 0.046 - 0.006, 0.608, 0.414), '#ffffff', [1, 0.5, 3, 0.22]);
    S.add(new THREE.BoxGeometry(0.05, 0.1, 0.03).rotateZ(m * 0.35).translate(m * 0.07, 0.63, 0.27), '#d8d8d8', [1, 0.5, 3, 0.22]); // ears
  }
  // legs swing in diagonal pairs
  for (const [x, z, s] of [[-0.075, 0.18, 1], [0.075, 0.18, -1], [-0.075, -0.18, -1], [0.075, -0.18, 1]]) S.add(new THREE.CapsuleGeometry(0.035, 0.26, 3, 6).translate(x, 0.17, z), coat, [s, 0.36, 0, 0]);
  S.add(new THREE.CylinderGeometry(0.018, 0.028, 0.2, 6).rotateX(-0.7).translate(0, 0.52, -0.3), coat, [1, 0.47, 2, -0.24]); // tail
  S.add(new THREE.TorusGeometry(0.075, 0.012, 4, 12).rotateX(Math.PI / 2).rotateX(0.5).translate(0, 0.52, 0.22), '#c53a3a'); // collar
  return S.build();
}

function birdGeometry() {
  const S = new Shape();
  S.add(new THREE.SphereGeometry(1, 10, 8).scale(0.055, 0.05, 0.1).translate(0, 0.1, 0), '#ffffff');
  S.add(new THREE.SphereGeometry(0.036, 8, 6).translate(0, 0.165, 0.075), '#ffffff', [1, 0.12, 3, 0.04]);
  S.add(new THREE.ConeGeometry(0.012, 0.035, 5).rotateX(Math.PI / 2).translate(0, 0.16, 0.12), '#e3b04a', [1, 0.12, 3, 0.04]);
  S.add(new THREE.BoxGeometry(0.06, 0.012, 0.08).translate(0, 0.1, -0.12), '#d0d0d0');
  for (const m of [-1, 1]) S.add(new THREE.BoxGeometry(0.17, 0.012, 0.09).translate(m * 0.13, 0.115, -0.005), '#d8d8d8', [m, 0.115, 1, m * 0.045]);
  return S.build();
}

function duckGeometry() {
  const S = new Shape();
  S.add(new THREE.SphereGeometry(1, 10, 8).scale(0.09, 0.07, 0.15).translate(0, 0.05, 0), '#8a6a4a');
  S.add(new THREE.SphereGeometry(0.055, 8, 6).translate(0, 0.15, 0.1), '#2f6b3a', [1, 0.08, 3, 0.06]);
  S.add(new THREE.BoxGeometry(0.035, 0.015, 0.05).translate(0, 0.14, 0.17), '#e3a33a', [1, 0.08, 3, 0.06]);
  S.add(new THREE.BoxGeometry(0.09, 0.02, 0.06).rotateX(0.5).translate(0, 0.09, -0.15), '#5a4632');
  return S.build();
}

let ramp = null;
const toonRamp = () => {
  if (ramp) return ramp;
  ramp = new THREE.DataTexture(new Uint8Array([115, 115, 115, 255, 195, 195, 195, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
};

/** Cel-shaded animal material; ink = the outline pass (same animation, pushed out, drawn inside-out). */
export function animatedMaterial(ink = false) {
  const mat = ink ? new THREE.MeshBasicMaterial({ color: '#1d1418', side: THREE.BackSide }) : new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() });
  mat.customProgramCacheKey = () => (ink ? 'animal-ink' : 'animal-toon');
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = worldUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        attribute vec4 aSwing;
        attribute vec3 aAnim; // frequency, phase, moving (0 idle .. 1 walking / flying)`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float ph = uTime * aAnim.x + aAnim.y;
        if (aSwing.x != 0.0) {
          float ang = 0.0;
          if (aSwing.z < 0.5) {
            ang = sin(ph) * 0.6 * aAnim.z * aSwing.x;
            float yy = transformed.y - aSwing.y; float cs = cos(ang); float sn = sin(ang);
            transformed.y = aSwing.y + yy * cs - transformed.z * sn;
            transformed.z = yy * sn + transformed.z * cs;
          } else if (aSwing.z < 1.5) {
            // wings: folded down along the body at rest, flapping in flight
            ang = mix(-1.25, sin(ph * 2.4) * 0.85, aAnim.z) * aSwing.x;
            vec2 d = vec2(transformed.x - aSwing.w, transformed.y - aSwing.y); float cs = cos(ang); float sn = sin(ang);
            transformed.x = aSwing.w + d.x * cs - d.y * sn;
            transformed.y = aSwing.y + d.x * sn + d.y * cs;
          } else if (aSwing.z < 2.5) {
            ang = sin(uTime * 11.0 + aAnim.y) * 0.5;
            vec2 d = vec2(transformed.x, transformed.z - aSwing.w); float cs = cos(ang); float sn = sin(ang);
            transformed.x = d.x * cs - d.y * sn;
            transformed.z = aSwing.w + d.x * sn + d.y * cs;
          } else {
            // head: pecks / bobs while idle, steady while moving
            ang = max(0.0, sin(uTime * 3.1 + aAnim.y * 3.0)) * 0.7 * (1.0 - aAnim.z);
            float yy = transformed.y - aSwing.y; float zz = transformed.z - aSwing.w; float cs = cos(ang); float sn = sin(ang);
            transformed.y = aSwing.y + yy * cs - zz * sn;
            transformed.z = aSwing.w + yy * sn + zz * cs;
          }
        }` + (ink ? '\n        transformed += normal * 0.008;' : ''),
      );
  };
  return mat;
}

/** Give an animated InstancedMesh its ink outline (shares the instance matrices). */
export function addInk(mesh) {
  const ink = new THREE.InstancedMesh(mesh.geometry, animatedMaterial(true), mesh.count);
  ink.instanceMatrix = mesh.instanceMatrix;
  ink.frustumCulled = false;
  mesh.add(ink);
  return ink;
}

const COAT = ['#e9dcc6', '#c9a26b', '#8a5a34', '#3a2f2a', '#f4f1ea', '#b8b8b8', '#d9b48a', '#2b2b2e'];
const PIGEON = ['#9aa0aa', '#8a8f99', '#b4b8c0', '#7a7f88', '#a59a90', '#e8e8ea'];

export class Animals {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.rng = mulberry32(9090);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._c = new THREE.Color();
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.group.clear();
  }

  makeMesh(geo, n, colors, castShadow = false) {
    const anim = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    geo.setAttribute('aAnim', anim);
    const mesh = new THREE.InstancedMesh(geo, animatedMaterial(), n);
    mesh.frustumCulled = false;
    mesh.castShadow = castShadow;
    for (let i = 0; i < n; i++) {
      mesh.setColorAt(i, this._c.set(colors[Math.floor(this.rng() * colors.length)]));
      anim.setXYZ(i, 8, this.rng() * 6.28, 0);
    }
    mesh.instanceColor.needsUpdate = true;
    if (castShadow || geo.userData.ink) addInk(mesh);
    this.group.add(mesh);
    return { mesh, anim };
  }

  setCity(city, quality = 'medium') {
    this.dispose();
    this.city = city;
    const q = quality === 'low' ? 0.6 : quality === 'high' ? 1.3 : 1;
    // dogs: every 8th pedestrian walks one
    this.dogs = this.makeMesh(dogGeometry(), 40, COAT, quality !== 'low');
    this.dogScale = new Float32Array(40).map(() => 0.75 + this.rng() * 0.6);
    this.dogRy = new Float32Array(40);
    this.leashPos = new Float32Array(40 * 6);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(this.leashPos, 3));
    this.leash = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#2a2a2e' }));
    this.leash.frustumCulled = false;
    this.group.add(this.leash);

    // pigeons: flocks around the player
    this.flocks = Math.round(7 * q);
    this.perFlock = 7;
    const np = this.flocks * this.perFlock;
    this.pigeons = this.makeMesh(birdGeometry(), np, PIGEON);
    this.pg = { x: new Float32Array(np), y: new Float32Array(np), z: new Float32Array(np), vx: new Float32Array(np), vy: new Float32Array(np), vz: new Float32Array(np), ry: new Float32Array(np), t: new Float32Array(np) };
    this.flock = Array.from({ length: this.flocks }, () => ({ x: 0, z: 0, state: 'off', timer: 0, tx: 0, tz: 0 }));

    // sky birds (gulls near water)
    this.skyN = Math.round(24 * q);
    const gull = (city.cfg.waterfront || []).length > 0;
    this.sky = this.makeMesh(birdGeometry(), this.skyN, gull ? ['#f4f4f2', '#e6e8ea', '#d0d4d8'] : ['#2b2b30', '#3a3a40', '#4a4a50']);
    for (let i = 0; i < this.skyN; i++) this.sky.anim.setXYZ(i, 5 + this.rng() * 2, this.rng() * 6.28, 1);
    this.sky.anim.needsUpdate = true;
    this.skyData = Array.from({ length: Math.ceil(this.skyN / 8) }, () => ({ r: 60 + this.rng() * 70, h: 32 + this.rng() * 26, w: (this.rng() < 0.5 ? -1 : 1) * (0.05 + this.rng() * 0.05), a: this.rng() * 6.28 }));

    // ducks in park fountains
    this.parks = city.blocks.filter((b) => b.kind === 'park');
    this.ducks = this.makeMesh(duckGeometry(), 12, ['#ffffff', '#f2efe8', '#d9cbb5']);
    for (let i = 0; i < 12; i++) this.ducks.anim.setXYZ(i, 2, this.rng() * 6.28, 0.3);
    this.ducks.anim.needsUpdate = true;
  }

  /** A walkable spot for a pigeon flock: on a sidewalk near the player, or in a park. */
  flockSpot(f, px, pz) {
    const c = this.city;
    const K = c.K;
    for (let t = 0; t < 8; t++) {
      const a = this.rng() * Math.PI * 2;
      const d = 22 + this.rng() * 45;
      let x = px + Math.cos(a) * d;
      let z = pz + Math.sin(a) * d;
      if (Math.abs(x) > c.half - 4 || Math.abs(z) > c.half - 4) continue;
      // snap onto the sidewalk band just inside the nearest block edge
      const bi = Math.floor((x + c.half - K.ROAD) / K.PITCH);
      const bj = Math.floor((z + c.half - K.ROAD) / K.PITCH);
      if (bi < 0 || bj < 0 || bi >= c.N || bj >= c.N) continue;
      const x0 = c.blockMin(bi);
      const z0 = c.blockMin(bj);
      const block = c.blocks[bj * c.N + bi];
      if (block?.kind === 'park') {
        x = x0 + 6 + this.rng() * (K.BLOCK - 12);
        z = z0 + 6 + this.rng() * (K.BLOCK - 12);
      } else if (this.rng() < 0.5) x = this.rng() < 0.5 ? x0 + 3.6 : x0 + K.BLOCK - 3.6;
      else z = this.rng() < 0.5 ? z0 + 3.6 : z0 + K.BLOCK - 3.6;
      f.x = x;
      f.z = z;
      return true;
    }
    return false;
  }

  landFlock(fi, x, z) {
    const f = this.flock[fi];
    const P = this.pg;
    f.state = 'ground';
    f.x = x;
    f.z = z;
    for (let k = 0; k < this.perFlock; k++) {
      const i = fi * this.perFlock + k;
      const a = this.rng() * Math.PI * 2;
      const r = 0.3 + this.rng() * 1.4;
      P.x[i] = x + Math.cos(a) * r;
      P.z[i] = z + Math.sin(a) * r;
      P.y[i] = 0;
      P.ry[i] = this.rng() * 6.28;
      P.t[i] = this.rng() * 2;
      this.pigeons.anim.setZ(i, 0);
    }
  }

  /** Startle a flock: every bird takes off away from the threat. */
  scare(fi, fromX, fromZ) {
    const f = this.flock[fi];
    const P = this.pg;
    f.state = 'fly';
    f.timer = 3.5 + this.rng() * 2;
    if (!this.flockSpot(f, f.x, f.z)) (f.x += 15), (f.z += 10);
    f.tx = f.x;
    f.tz = f.z;
    for (let k = 0; k < this.perFlock; k++) {
      const i = fi * this.perFlock + k;
      const dx = P.x[i] - fromX;
      const dz = P.z[i] - fromZ;
      const d = Math.hypot(dx, dz) || 1;
      P.vx[i] = (dx / d) * (3 + this.rng() * 2);
      P.vz[i] = (dz / d) * (3 + this.rng() * 2);
      P.vy[i] = 3.5 + this.rng() * 2;
      this.pigeons.anim.setXYZ(i, 9 + this.rng() * 3, this.rng() * 6.28, 1);
    }
    this.onScare?.();
  }

  /**
   * @param crowd     Crowd (dogs follow some of its agents)
   * @param night     0..1 (birds roost at night)
   */
  update(dt, crowd, px, pz, night, visible) {
    if (!this.city) return;
    this.group.visible = visible;
    if (!visible) return;
    const m = this._m;
    const groundY = this.city.groundY;

    // ---- dogs -------------------------------------------------------------
    const D = this.dogs;
    const L = this.leashPos;
    for (let k = 0; k < 40; k++) {
      const a = k * 8 + 3; // owner agent
      const alive = crowd.n > a && crowd.alive[a] && night < 0.85;
      if (!alive) {
        m.makeScale(0, 0, 0);
        D.mesh.setMatrixAt(k, m);
        L.fill(0, k * 6, k * 6 + 6);
        continue;
      }
      const ry = crowd.ry[a];
      const rx = Math.cos(ry);
      const rz = -Math.sin(ry);
      const fx = Math.sin(ry);
      const fz = Math.cos(ry);
      const moving = crowd.cur[a] > 0.1;
      const x = crowd.x[a] + rx * 0.62 + fx * (moving ? 0.45 : 0.25);
      const z = crowd.z[a] + rz * 0.62 + fz * (moving ? 0.45 : 0.25);
      const y = groundY(x, z);
      // turn to face the walking direction (or the owner when sitting)
      this.dogRy[k] = moving ? ry : Math.atan2(crowd.x[a] - x, crowd.z[a] - z);
      const s = this.dogScale[k];
      this._q.setFromAxisAngle(this._up, this.dogRy[k]);
      // sitting: a little lower
      m.compose(this._p.set(x, y - (moving ? 0 : 0.05 * s), z), this._q, this._s.set(s, s, s));
      D.mesh.setMatrixAt(k, m);
      D.anim.setX(k, 7 + crowd.cur[a] * 3);
      D.anim.setZ(k, moving ? 1 : 0);
      const hy = groundY(crowd.x[a], crowd.z[a]);
      L[k * 6] = crowd.x[a] + rx * 0.24;
      L[k * 6 + 1] = hy + 0.92;
      L[k * 6 + 2] = crowd.z[a] + rz * 0.24;
      L[k * 6 + 3] = x + Math.sin(this.dogRy[k]) * 0.22 * s;
      L[k * 6 + 4] = y + 0.52 * s;
      L[k * 6 + 5] = z + Math.cos(this.dogRy[k]) * 0.22 * s;
    }
    D.mesh.instanceMatrix.needsUpdate = true;
    D.anim.needsUpdate = true;
    this.leash.geometry.attributes.position.needsUpdate = true;

    // ---- pigeons --------------------------------------------------------------
    const P = this.pg;
    const pa = this.pigeons.anim;
    for (let fi = 0; fi < this.flocks; fi++) {
      const f = this.flock[fi];
      const far = (f.x - px) ** 2 + (f.z - pz) ** 2 > 95 * 95;
      if (night > 0.6) f.state = 'off';
      else if (f.state === 'off' || (far && f.state === 'ground')) {
        if (this.flockSpot(f, px, pz)) this.landFlock(fi, f.x, f.z);
      }
      if (f.state === 'ground') {
        // the player or a passer-by walking through scatters them
        let threat = null;
        if ((f.x - px) ** 2 + (f.z - pz) ** 2 < 3.2 * 3.2) threat = [px, pz];
        else {
          for (let i = 0; i < crowd.n && !threat; i++) {
            if (crowd.alive[i] && crowd.cur[i] > 0.1 && (crowd.x[i] - f.x) ** 2 + (crowd.z[i] - f.z) ** 2 < 1.6 * 1.6) threat = [crowd.x[i], crowd.z[i]];
          }
        }
        if (threat) this.scare(fi, threat[0], threat[1]);
      } else if (f.state === 'fly') {
        f.timer -= dt;
        if (f.timer <= 0) this.landFlock(fi, f.tx, f.tz);
      }
      for (let k = 0; k < this.perFlock; k++) {
        const i = fi * this.perFlock + k;
        if (f.state === 'off') {
          m.makeScale(0, 0, 0);
          this.pigeons.mesh.setMatrixAt(i, m);
          continue;
        }
        if (f.state === 'fly') {
          // climb, then glide toward the landing spot and descend
          const t = f.timer;
          const toX = f.tx - P.x[i];
          const toZ = f.tz - P.z[i];
          P.vx[i] += (toX * 0.6 - P.vx[i]) * dt * 0.8;
          P.vz[i] += (toZ * 0.6 - P.vz[i]) * dt * 0.8;
          P.vy[i] += ((t > 1.8 ? 1.5 : -2.5) - P.vy[i]) * dt * 1.5;
          P.x[i] += P.vx[i] * dt;
          P.z[i] += P.vz[i] * dt;
          P.y[i] = Math.max(0, P.y[i] + P.vy[i] * dt);
          P.ry[i] = Math.atan2(P.vx[i], P.vz[i]);
        } else {
          // hop about now and then
          P.t[i] -= dt;
          if (P.t[i] <= 0) {
            P.t[i] = 1 + this.rng() * 3;
            P.ry[i] += (this.rng() - 0.5) * 2;
            P.x[i] += Math.sin(P.ry[i]) * 0.18;
            P.z[i] += Math.cos(P.ry[i]) * 0.18;
          }
        }
        this._q.setFromAxisAngle(this._up, P.ry[i]);
        m.compose(this._p.set(P.x[i], groundY(P.x[i], P.z[i]) + P.y[i], P.z[i]), this._q, this._s.set(1, 1, 1));
        this.pigeons.mesh.setMatrixAt(i, m);
      }
    }
    this.pigeons.mesh.instanceMatrix.needsUpdate = true;
    pa.needsUpdate = true;

    // ---- birds in the sky ---------------------------------------------------------
    const day = night < 0.55;
    const t = worldUniforms.uTime.value;
    for (let i = 0; i < this.skyN; i++) {
      const g = this.skyData[i >> 3];
      if (!day) {
        m.makeScale(0, 0, 0);
        this.sky.mesh.setMatrixAt(i, m);
        continue;
      }
      const k = i & 7;
      const ang = g.a + t * g.w - k * 0.035 * Math.sign(g.w);
      const r = g.r + (k % 2 ? 2.5 : -2.5) * (k >> 1);
      const x = px + Math.cos(ang) * r;
      const z = pz + Math.sin(ang) * r;
      const y = g.h + Math.sin(t * 0.6 + k) * 1.2 + (k >> 1) * 0.6;
      this._q.setFromAxisAngle(this._up, Math.atan2(-Math.sin(ang) * g.w, Math.cos(ang) * g.w));
      m.compose(this._p.set(x, y, z), this._q, this._s.set(2.2, 2.2, 2.2));
      this.sky.mesh.setMatrixAt(i, m);
    }
    this.sky.mesh.instanceMatrix.needsUpdate = true;

    // ---- ducks ----------------------------------------------------------------------
    let di = 0;
    const K = this.city.K;
    for (const b of this.parks) {
      if (di >= 12) break;
      if ((b.cx - px) ** 2 + (b.cz - pz) ** 2 > 150 * 150) continue;
      for (let k = 0; k < 3 && di < 12; k++, di++) {
        const a = t * (0.12 + k * 0.03) + k * 2.1;
        const r = 1.4 + k * 0.35;
        this._q.setFromAxisAngle(this._up, a + Math.PI);
        m.compose(this._p.set(b.cx + Math.cos(a) * r, K.CURB + 0.55, b.cz + Math.sin(a) * r), this._q, this._s.set(1.6, 1.6, 1.6));
        this.ducks.mesh.setMatrixAt(di, m);
      }
    }
    for (; di < 12; di++) {
      m.makeScale(0, 0, 0);
      this.ducks.mesh.setMatrixAt(di, m);
    }
    this.ducks.mesh.instanceMatrix.needsUpdate = true;
  }
}
