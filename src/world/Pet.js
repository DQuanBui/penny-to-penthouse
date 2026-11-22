// Your dog in the 3D world: heels beside you, runs to catch up, sits and
// looks up at you when you stop, waits by the door while you shop, rides
// along in the car, curls up at home and plays fetch.
// Also the adoptable dogs pottering around the pet rescue.
import * as THREE from 'three';
import { dogGeometry, animatedMaterial } from './Animals.js';
import { BREED_BY_ID, BREEDS } from '../data/pets.js';
import { dampAngle } from '../core/utils.js';
import { addInk } from './Animals.js';

function dogMesh(n) {
  const geo = dogGeometry();
  const anim = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  geo.setAttribute('aAnim', anim);
  const mesh = new THREE.InstancedMesh(geo, animatedMaterial(), n);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const c = new THREE.Color('#ffffff');
  for (let i = 0; i < n; i++) {
    mesh.setColorAt(i, c);
    anim.setXYZ(i, 8, i * 1.7, 0);
  }
  addInk(mesh);
  return { mesh, anim };
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export class PetFollower {
  constructor() {
    const { mesh, anim } = dogMesh(1);
    this.mesh = mesh;
    this.anim = anim;
    this.mesh.visible = false;
    this.pos = new THREE.Vector3();
    this.ry = 0;
    this.speed = 0;
    this.scale = 1;
    this.active = false;
    this.mode = 'follow'; // follow | wait | fetch
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshStandardMaterial({ color: '#cde63c', roughness: 0.7 }));
    this.ball.castShadow = true;
    this.ball.visible = false;
    this.fetch = null;
    this.onFetched = null;
  }

  /** Show the player's dog (or hide it when `pet` is null). */
  setPet(pet) {
    this.active = !!pet;
    this.mesh.visible = this.active;
    this.ball.visible = false;
    this.fetch = null;
    this.mode = 'follow';
    if (!pet) return;
    const b = BREED_BY_ID[pet.breed] || BREEDS[0];
    this.mesh.setColorAt(0, new THREE.Color(b.coat));
    this.mesh.instanceColor.needsUpdate = true;
    this.scale = b.scale;
  }

  attach(scene) {
    scene.add(this.mesh);
    scene.add(this.ball);
  }

  /** Drop the dog beside the player (after a door, a car ride or a teleport). */
  heel(player) {
    const h = player.heading;
    this.place(player.pos.x - Math.sin(h) * 0.9 + Math.cos(h) * 0.7, player.pos.z - Math.cos(h) * 0.9 - Math.sin(h) * 0.7, h, player.pos.y);
    this.mode = 'follow';
  }

  place(x, z, ry, y = 0) {
    this.pos.set(x, y, z);
    this.ry = ry;
    this.speed = 0;
  }

  /** Sit and wait at a spot (outside a shop door) until the player comes back. */
  waitAt(x, z, ry) {
    this.place(x, z, ry, this.pos.y);
    this.mode = 'wait';
    this.fetch = null;
    this.ball.visible = false;
  }

  near(p, r = 1.9) {
    return this.active && this.mesh.visible && this.mode === 'follow' && (this.pos.x - p.x) ** 2 + (this.pos.z - p.z) ** 2 < r * r;
  }

  /** Throw the ball ahead of the player; the dog chases it and brings it back. */
  throwBall(player, colliders) {
    const h = player.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    let dist = 8;
    for (let d = 1; d <= 8; d += 0.5) {
      if (colliders?.pointBlocked(player.pos.x + fx * d, player.pos.y + 0.4, player.pos.z + fz * d, 0.3)) {
        dist = Math.max(1.5, d - 1);
        break;
      }
    }
    this.fetch = { stage: 'flight', t: 0, dur: 0.5 + dist * 0.05, sx: player.pos.x + fx * 0.4, sz: player.pos.z + fz * 0.4, sy: player.pos.y + 1.3, ex: player.pos.x + fx * dist, ez: player.pos.z + fz * dist, by: 0, vy: 0 };
    this.mode = 'fetch';
    this.ball.visible = true;
  }

  /**
   * ctx: { player, colliders, groundY, hidden }
   * hidden = riding in the car (the dog travels with you, out of sight)
   */
  update(dt, ctx) {
    if (!this.active) return;
    const pl = ctx.player;
    if (ctx.hidden) {
      this.mesh.visible = false;
      this.ball.visible = false;
      this.fetch = null;
      this.mode = 'follow';
      this._wasHidden = true;
      return;
    }
    if (this._wasHidden) {
      this._wasHidden = false;
      this.heel(pl);
    }
    this.mesh.visible = true;
    const pp = pl.pos;
    let tx = this.pos.x;
    let tz = this.pos.z;
    let stop = 0.3;
    let maxSp = 6.5;
    const f = this.fetch;
    if (this.mode === 'follow') {
      // heel: a little behind and to the side of the player
      const h = pl.heading;
      tx = pp.x - Math.sin(h) * 0.9 + Math.cos(h) * 0.7;
      tz = pp.z - Math.cos(h) * 0.9 - Math.sin(h) * 0.7;
      if ((pp.x - this.pos.x) ** 2 + (pp.z - this.pos.z) ** 2 > 22 * 22) this.heel(pl);
    } else if (f) {
      maxSp = 7.5;
      if (f.stage === 'flight') {
        f.t += dt;
        const k = Math.min(1, f.t / f.dur);
        const gy = ctx.groundY(f.ex, f.ez) + 0.05;
        this.ball.position.set(f.sx + (f.ex - f.sx) * k, f.sy + (gy - f.sy) * k + Math.sin(k * Math.PI) * 1.6, f.sz + (f.ez - f.sz) * k);
        if (k >= 1) {
          f.stage = 'chase';
          f.vy = 1.6; // one little bounce
        }
        tx = f.ex;
        tz = f.ez;
      } else if (f.stage === 'chase') {
        f.vy -= 9.8 * dt;
        f.by = Math.max(0, f.by + f.vy * dt);
        this.ball.position.y = ctx.groundY(f.ex, f.ez) + 0.05 + f.by;
        tx = f.ex;
        tz = f.ez;
        stop = 0.35;
        if ((tx - this.pos.x) ** 2 + (tz - this.pos.z) ** 2 < 0.45 * 0.45) f.stage = 'carry';
      } else {
        tx = pp.x + Math.sin(pl.heading) * 0.8;
        tz = pp.z + Math.cos(pl.heading) * 0.8;
        stop = 0.35;
        if ((tx - this.pos.x) ** 2 + (tz - this.pos.z) ** 2 < 0.5 * 0.5) {
          this.fetch = null;
          this.mode = 'follow';
          this.ball.visible = false;
          this.onFetched?.();
        }
      }
    }
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    const want = d > stop ? Math.min(maxSp, d * 2.4 + (this.mode === 'follow' ? pl.speed * 0.5 : 2)) : 0;
    this.speed += (want - this.speed) * Math.min(1, dt * 6);
    if (this.speed > 0.08 && d > 1e-3) {
      const step = Math.min(d, this.speed * dt);
      this.pos.x += (dx / d) * step;
      this.pos.z += (dz / d) * step;
      this.ry = dampAngle(this.ry, Math.atan2(dx, dz), 10, dt);
    } else {
      // sit and look up at the player
      this.ry = dampAngle(this.ry, Math.atan2(pp.x - this.pos.x, pp.z - this.pos.z), 4, dt);
    }
    if (ctx.colliders) ctx.colliders.resolve(this.pos, 0.2, this.pos.y + 0.1, 0.5);
    this.pos.y = ctx.groundY(this.pos.x, this.pos.z);
    const moving = this.speed > 0.15;
    const s = this.scale;
    _q.setFromAxisAngle(_up, this.ry);
    _m.compose(_p.set(this.pos.x, this.pos.y - (moving ? 0 : 0.05 * s), this.pos.z), _q, _s.set(s, s, s));
    this.mesh.setMatrixAt(0, _m);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.anim.setX(0, 7 + this.speed * 2.2);
    this.anim.setZ(0, moving ? Math.min(1, this.speed / 1.2) : 0);
    this.anim.needsUpdate = true;
    // the ball in the dog's mouth on the way back
    if (f && f.stage === 'carry') this.ball.position.set(this.pos.x + Math.sin(this.ry) * 0.47 * s, this.pos.y + 0.5 * s, this.pos.z + Math.cos(this.ry) * 0.47 * s);
  }
}

/** The adoptable dogs inside the rescue: they potter around a play area. */
export class ShelterDogs {
  constructor() {
    const { mesh, anim } = dogMesh(3);
    this.mesh = mesh;
    this.anim = anim;
    this.dogs = [];
  }

  show(scene, offers, area) {
    this.area = area; // [x0, z0, x1, z1]
    this.dogs = offers.map((o, i) => ({ x: area[0] + (i + 0.5) * ((area[2] - area[0]) / offers.length), z: (area[1] + area[3]) / 2, ry: i * 2, tx: 0, tz: 0, wait: i * 0.8, sp: 0, s: o.breed.scale }));
    offers.forEach((o, i) => this.mesh.setColorAt(i, new THREE.Color(o.breed.coat)));
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.count = offers.length;
    scene.add(this.mesh);
  }

  clear() {
    this.mesh.removeFromParent();
    this.dogs = [];
  }

  update(dt) {
    const a = this.area;
    this.dogs.forEach((g, i) => {
      g.wait -= dt;
      if (g.wait <= 0 && g.sp === 0) {
        g.tx = a[0] + Math.random() * (a[2] - a[0]);
        g.tz = a[1] + Math.random() * (a[3] - a[1]);
        g.sp = 1.2 + Math.random() * 1.4;
      }
      if (g.sp > 0) {
        const dx = g.tx - g.x;
        const dz = g.tz - g.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.1) {
          g.sp = 0;
          g.wait = 1.5 + Math.random() * 4;
        } else {
          const st = Math.min(d, g.sp * dt);
          g.x += (dx / d) * st;
          g.z += (dz / d) * st;
          g.ry = dampAngle(g.ry, Math.atan2(dx, dz), 8, dt);
        }
      }
      _q.setFromAxisAngle(_up, g.ry);
      _m.compose(_p.set(g.x, g.sp ? 0 : -0.04 * g.s, g.z), _q, _s.set(g.s, g.s, g.s));
      this.mesh.setMatrixAt(i, _m);
      this.anim.setX(i, 7 + g.sp * 2.2);
      this.anim.setZ(i, g.sp ? 1 : 0);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.anim.needsUpdate = true;
  }
}
