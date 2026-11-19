// Third-person character controller: camera-relative WASD, run, jump, gravity,
// kerb-aware ground following and collision against the active ColliderWorld.
import * as THREE from 'three';
import { damp, dampAngle } from '../core/utils.js';
import { animateRig } from './Animation.js';

const WALK = 3.3;
const RUN = 6.6;
const GRAVITY = 22;
const JUMP = 7.2;
const RADIUS = 0.34;

export class PlayerController {
  constructor() {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.grounded = true;
    this.speed = 0; // horizontal speed (m/s), read by animation + audio
    this.sitting = false;
    this.talking = false;
    this.frozen = false; // true while UI owns the player (dialogs, mini-games)
    this.speedMul = 1;
    this.sitLift = 0; // seat height above a standard chair
    this.riding = null; // { max, accel, v } while on a bicycle
    this.umbrella = false; // holding an umbrella (rain)
    this.emote = null; // { id, t, held } (ui/Emotes.js)
    this.swimming = false; // in deep water (world/Beach.js)
    this.floatY = null; // the height you float at while swimming
    this.lying = false; // sunbathing on a towel
    this.rig = null;
    this.world = null; // { colliders, groundY(x,z) }
    this.stepAccum = 0;
    this.onStep = null;
  }

  setRig(rig) {
    this.rig = rig;
    this.sync();
  }
  setWorld(world) {
    this.world = world;
  }
  teleport(x, z, heading = this.heading) {
    this.pos.set(x, this.world ? this.world.groundY(x, z) : 0, z);
    this.vel.set(0, 0, 0);
    this.heading = heading;
    this.grounded = true;
    this.sync();
  }
  sync() {
    if (!this.rig) return;
    this.rig.group.position.copy(this.pos);
    if (this.sitting && this.sitLift) this.rig.group.position.y += this.sitLift;
    if (this.swimming) this.rig.group.position.y += Math.sin(performance.now() / 450) * 0.035;
    // lying on your back: tip the whole body over (order YXZ: heading first)
    const lie = this.lying && this.sitting;
    this.rig.group.rotation.order = 'YXZ';
    this.rig.group.rotation.x = lie ? -Math.PI / 2 : 0;
    this.rig.group.rotation.y = this.heading;
  }

  /** Bicycle: W pedal, S brake, A/D steer. */
  updateRide(dt, input, w) {
    const R = this.riding;
    let throttle = 0;
    let steer = 0;
    if (input && !this.frozen) {
      if (input.isDown('KeyW') || input.isDown('ArrowUp')) throttle += 1;
      if (input.isDown('KeyS') || input.isDown('ArrowDown')) throttle -= 1;
      if (input.isDown('KeyA') || input.isDown('ArrowLeft')) steer += 1;
      if (input.isDown('KeyD') || input.isDown('ArrowRight')) steer -= 1;
    }
    R.v = R.v || 0;
    if (throttle > 0) R.v = Math.min(R.max, R.v + R.accel * dt);
    else if (throttle < 0) R.v = Math.max(0, R.v - 7 * dt);
    else R.v = damp(R.v, 0, 0.5, dt);
    R.steer = damp(R.steer || 0, steer, 6, dt);
    this.heading += R.steer * 2.1 * Math.min(1, 0.35 + R.v / 4) * dt;
    const px = this.pos.x;
    const pz = this.pos.z;
    this.pos.x += Math.sin(this.heading) * R.v * dt;
    this.pos.z += Math.cos(this.heading) * R.v * dt;
    if (w) {
      w.colliders.resolve(this.pos, 0.4, this.pos.y + 0.25, 1.4);
      if (w.obstacles && w.obstacles(this.pos, 0.4, this.pos.y)) w.colliders.resolve(this.pos, 0.4, this.pos.y + 0.25, 1.4);
      const gy = w.groundY(this.pos.x, this.pos.z);
      this.pos.y = damp(this.pos.y, gy, 18, dt);
    }
    // bumping into something slows you down
    const moved = Math.hypot(this.pos.x - px, this.pos.z - pz) / Math.max(dt, 1e-4);
    if (moved < R.v * 0.6) R.v = moved;
    this.vel.set(Math.sin(this.heading) * R.v, 0, Math.cos(this.heading) * R.v);
    this.speed = R.v;
    this.grounded = true;
    if (this.rig) {
      this.sync();
      animateRig(this.rig, dt, { speed: R.v, grounded: true, riding: true });
    }
  }

  update(dt, input, camYaw) {
    const w = this.world;
    let mx = 0;
    let mz = 0;
    let wantJump = false;
    let running = false;
    if (this.riding) return this.updateRide(dt, input, w);
    if (input && !this.frozen && !this.sitting) {
      if (input.isDown('KeyW') || input.isDown('ArrowUp')) mz -= 1;
      if (input.isDown('KeyS') || input.isDown('ArrowDown')) mz += 1;
      if (input.isDown('KeyA') || input.isDown('ArrowLeft')) mx -= 1;
      if (input.isDown('KeyD') || input.isDown('ArrowRight')) mx += 1;
      running = (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && !this.swimming;
      wantJump = input.pressed('Space') && !this.swimming;
    }
    const len = Math.hypot(mx, mz);
    if (len > 0 && this.emote) this.emote = null; // moving ends any action
    let tx = 0;
    let tz = 0;
    if (len > 0) {
      mx /= len;
      mz /= len;
      // rotate input by camera yaw so "forward" is away from the camera
      const s = Math.sin(camYaw);
      const c = Math.cos(camYaw);
      const dx = mx * c + mz * s;
      const dz = -mx * s + mz * c;
      const sp = (running ? RUN : WALK) * this.speedMul;
      tx = dx * sp;
      tz = dz * sp;
      this.heading = dampAngle(this.heading, Math.atan2(dx, dz), 12, dt);
    }
    const accel = this.grounded ? (len > 0 ? 12 : 16) : 3;
    this.vel.x = damp(this.vel.x, tx, accel, dt);
    this.vel.z = damp(this.vel.z, tz, accel, dt);

    if (wantJump && this.grounded) {
      this.vel.y = JUMP;
      this.grounded = false;
    }
    this.vel.y -= GRAVITY * dt;

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;
    if (w) {
      // (seated on a bench the player stays put inside the bench's collider)
      if (!this.sitting) {
        w.colliders.resolve(this.pos, RADIUS, this.pos.y + 0.25, 1.4);
        // cars, pedestrians and other moving things
        if (w.obstacles && w.obstacles(this.pos, RADIUS, this.pos.y)) w.colliders.resolve(this.pos, RADIUS, this.pos.y + 0.25, 1.4);
      }
      let gy = w.groundY(this.pos.x, this.pos.z);
      if (this.floatY != null) gy = Math.max(gy, this.floatY);
      if (this.pos.y <= gy) {
        this.pos.y = this.grounded ? damp(this.pos.y, gy, 30, dt) : gy;
        if (this.pos.y < gy - 0.2) this.pos.y = gy;
        this.vel.y = 0;
        this.grounded = true;
      } else if (this.grounded && this.pos.y - gy < 0.3 && this.vel.y <= 0) {
        // walking down a kerb: stay glued to the ground
        this.pos.y = damp(this.pos.y, gy, 20, dt);
        this.vel.y = 0;
      } else if (this.pos.y - gy > 0.02) this.grounded = false;
    }
    this.speed = Math.hypot(this.vel.x, this.vel.z);

    // footsteps (audio hook)
    if (this.grounded && this.speed > 0.5 && !this.swimming) {
      this.stepAccum += this.speed * dt;
      const stride = this.speed > 4.5 ? 1.25 : 0.72;
      if (this.stepAccum > stride) {
        this.stepAccum = 0;
        this.onStep?.(this.speed > 4.5);
      }
    }

    if (this.rig) {
      this.sync();
      const em = this.emote?.id;
      const lie = this.lying && this.sitting;
      animateRig(this.rig, dt, { speed: this.swimming ? 0 : this.speed, grounded: this.grounded, swimming: this.swimming, swimMove: this.speed, lying: lie, sitting: this.sitting && !lie, talking: this.talking, umbrella: this.umbrella && !this.sitting && !em && !this.swimming, waving: em === 'wave', cheering: em === 'cheer' || (em === 'volley' && this.emote.hit > 0), dancing: em === 'dance', jacks: em === 'jacks', floor: em === 'sit', phone: em === 'phone' || em === 'selfie' });
    }
  }
}
