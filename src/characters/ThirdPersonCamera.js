// Orbiting third-person camera with zoom, smoothing and collision (the boom is
// shortened when a wall is between the player and the camera).
import * as THREE from 'three';
import { clamp, damp } from '../core/utils.js';

export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI; // camera sits behind a player facing +Z... updated on spawn
    this.pitch = 0.32;
    this.dist = 6.5;
    this.curDist = 6.5;
    this.minDist = 2.2;
    this.maxDist = 16;
    this.maxPitch = 1.35;
    this.minPitch = -0.25;
    this.height = 1.5;
    this.target = new THREE.Vector3();
    this.sensitivity = 1;
    this.invertY = false;
    this.world = null;
    this._dir = new THREE.Vector3();
    this._init = false;
  }
  setWorld(world) {
    this.world = world;
  }
  /** Place the camera behind a character with the given heading. */
  snapBehind(heading) {
    this.yaw = heading + Math.PI;
    this._init = false;
  }

  update(dt, input, focus) {
    if (input) {
      const k = 0.0032 * this.sensitivity;
      this.yaw -= input.mouseDX * k;
      this.pitch += input.mouseDY * k * (this.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, this.minPitch, this.maxPitch);
      if (input.wheel) this.dist = clamp(this.dist * (1 + input.wheel * 0.12), this.minDist, this.maxDist);
    }
    const ty = focus.y + this.height;
    if (!this._init) {
      this.target.set(focus.x, ty, focus.z);
      this._init = true;
    } else {
      this.target.x = damp(this.target.x, focus.x, 18, dt);
      this.target.z = damp(this.target.z, focus.z, 18, dt);
      this.target.y = damp(this.target.y, ty, 10, dt);
    }
    const cp = Math.cos(this.pitch);
    const d = this._dir.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);

    // Collision: march along the boom and stop before the first blocked sample.
    let allowed = this.dist;
    const w = this.world;
    if (w) {
      const step = 0.4;
      for (let s = 0.8; s <= this.dist; s += step) {
        const x = this.target.x + d.x * s;
        const y = this.target.y + d.y * s;
        const z = this.target.z + d.z * s;
        if (w.colliders.pointBlocked(x, y, z, 0.3) || (w.ceiling && y > w.ceiling - 0.2)) {
          allowed = Math.max(0.6, s - step);
          break;
        }
      }
    }
    // pull in fast, ease out slowly
    this.curDist = allowed < this.curDist ? damp(this.curDist, allowed, 30, dt) : damp(this.curDist, allowed, 5, dt);
    const gy = w ? w.groundY(this.target.x + d.x * this.curDist, this.target.z + d.z * this.curDist) : 0;
    this.camera.position.set(this.target.x + d.x * this.curDist, Math.max(this.target.y + d.y * this.curDist, gy + 0.3), this.target.z + d.z * this.curDist);
    this.camera.lookAt(this.target);
  }
}
