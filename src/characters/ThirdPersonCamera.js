// Orbiting third-person camera with zoom, smoothing and collision: a ray from
// the head to the camera is cast against the building / interior colliders and
// the camera is pulled in front of the first hit (fast in, slow back out).
// Small occluders (awnings, planters, tree crowns) dissolve instead.
import * as THREE from 'three';
import { clamp, damp } from '../core/utils.js';
import { occluderUniforms } from '../world/OccluderFade.js';

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

    // Collision: cast the boom against the colliders (boxes grown by the near-plane margin).
    let allowed = this.dist;
    const w = this.world;
    if (w) {
      const hit = w.colliders.raycast(this.target.x, this.target.y, this.target.z, d.x, d.y, d.z, this.dist, 0.3);
      if (hit < this.dist) allowed = Math.max(0.6, hit - 0.1);
      // cars and buses: they move, so a hit holds for a moment before the boom may ease out
      // again (a bus rolling past does not make it pump in and out)
      const mv = w.moverRay ? w.moverRay(this.target.x, this.target.y, this.target.z, d.x, d.y, d.z, this.dist, 0.3) : this.dist;
      if (mv < this.dist) {
        this._mvHold = 0.45;
        this._mvAllowed = Math.max(0.6, mv - 0.15);
      } else if ((this._mvHold = (this._mvHold || 0) - dt) <= 0) this._mvAllowed = this.dist;
      allowed = Math.min(allowed, this._mvAllowed ?? this.dist);
    }
    // pull in fast, ease out slowly
    this.curDist = allowed < this.curDist ? damp(this.curDist, allowed, 30, dt) : damp(this.curDist, allowed, 5, dt);
    const gy = w ? w.groundY(this.target.x + d.x * this.curDist, this.target.z + d.z * this.curDist) : 0;
    this.camera.position.set(this.target.x + d.x * this.curDist, Math.max(this.target.y + d.y * this.curDist, gy + 0.3), this.target.z + d.z * this.curDist);
    this.camera.lookAt(this.target);
    occluderUniforms.uOccCam.value.copy(this.camera.position);
    occluderUniforms.uOccHead.value.set(this.target.x, this.target.y - 0.4, this.target.z);
    occluderUniforms.uOccOn.value = 1;
  }
}
