// The player's cars: meshes parked in the city, entering/exiting (F), arcade
// driving on the road network, and kerb-side parking.
// Optional models: public/models/vehicles/<vehicle id>.glb replace the mesh.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VEHICLE_BY_ID } from '../data/vehicles.js';
import { loadAssetManifest } from '../core/Assets.js';
import { clamp, damp, dampAngle } from '../core/utils.js';
import { obbOverlap } from './Collision.js';
import { vehicleGeometry, carMaterial, glassMaterial, BODY_DIMS } from './CarModel.js';

export const LANE_IN = 1.75; // driving lanes (AI traffic)
export const LANE_OUT = 5.25; // kerb lanes (parking)

export { carGeometry } from './CarModel.js';
const geoCache = {};
let glassMat = null;

const glb = new Map();
let glbLoaded = false;
export async function loadVehicleModels() {
  if (glbLoaded) return;
  glbLoaded = true;
  const m = await loadAssetManifest();
  const loader = new GLTFLoader();
  for (const f of m.vehicles) {
    try {
      const g = await loader.loadAsync('./models/vehicles/' + f);
      glb.set(f.replace(/\.[^.]+$/, ''), g.scene);
    } catch {
      /* ignore unreadable files */
    }
  }
}
let sharedMat = null;
export function buildCarMesh(modelId, color) {
  const def = VEHICLE_BY_ID[modelId];
  const src = glb.get(modelId);
  const group = new THREE.Group();
  if (src) {
    const model = src.clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = (4.3 * def.size[2]) / Math.max(size.z, size.x, 0.01);
    model.scale.setScalar(s);
    model.position.y = -box.min.y * s;
    model.traverse((o) => o.isMesh && (o.castShadow = true));
    group.add(model);
    return group;
  }
  const type = def.body || 'sedan';
  const geo = (geoCache[type] ||= vehicleGeometry(type));
  // a one-instance InstancedMesh so only the paint takes the colour; glass is see-through
  const body = new THREE.InstancedMesh(geo.body, (sharedMat ||= carMaterial({ roughness: 0.25, metalness: 0.5 })), 1);
  body.setColorAt(0, new THREE.Color(color));
  body.castShadow = true;
  const glass = new THREE.Mesh(geo.glass, (glassMat ||= glassMaterial()));
  const shell = new THREE.Group();
  shell.add(body, glass);
  shell.scale.set(def.size[0], def.size[1], def.size[2]);
  group.add(shell);
  return group;
}

export class VehicleManager {
  constructor(game) {
    this.game = game;
    this.cars = new Map(); // vehicle id -> { v, def, group, speed }
    this.driving = null;
  }

  // ---- road helpers ---------------------------------------------------------
  nearestRoad(v) {
    const c = this.game.city;
    let best = c.roadCenter(0);
    for (let k = 1; k <= c.N; k++) if (Math.abs(c.roadCenter(k) - v) < Math.abs(best - v)) best = c.roadCenter(k);
    return best;
  }
  onRoad(x, z) {
    const c = this.game.city;
    return Math.abs(x) < c.half - 0.2 && Math.abs(z) < c.half - 0.2 && c.groundY(x, z) === 0;
  }
  /** Kerb-side parking pose nearest to a point: { x, z, ry } */
  kerbSpot(x, z) {
    const c = this.game.city;
    const half = c.K.ROAD / 2;
    const rx = this.nearestRoad(x);
    const rz = this.nearestRoad(z);
    const dx = Math.abs(x - rx);
    const dz = Math.abs(z - rz);
    // keep clear of intersections: slide along the road to the middle of the block edge
    const along = (v) => {
      const r = this.nearestRoad(v);
      return Math.abs(v - r) < half + 4 ? r + Math.sign(v - r || 1) * (half + 6) : v;
    };
    if (dx <= dz) {
      const side = Math.sign(x - rx) || 1; // road runs north–south
      return { x: rx + side * LANE_OUT, z: along(z), ry: side > 0 ? Math.PI : 0 };
    }
    const side = Math.sign(z - rz) || 1; // road runs east–west
    return { x: along(x), z: rz + side * LANE_OUT, ry: side > 0 ? Math.PI / 2 : -Math.PI / 2 };
  }

  // ---- lifecycle ---------------------------------------------------------------
  /** Create / remove car meshes so they match state.vehicles. */
  sync() {
    const game = this.game;
    const st = game.state;
    if (!st || !game.city) return;
    if (st.trip) return; // your cars are parked back home
    for (const [id, car] of this.cars) {
      if (!st.vehicles.find((v) => v.id === id)) {
        if (this.driving === car) this.exit(true);
        game.scene.remove(car.group);
        this.cars.delete(id);
      }
    }
    for (const v of st.vehicles) {
      let car = this.cars.get(v.id);
      if (!car) {
        car = { v, def: VEHICLE_BY_ID[v.model], group: buildCarMesh(v.model, v.color), speed: 0 };
        this.cars.set(v.id, car);
        game.scene.add(car.group);
      }
      car.v = v;
      if (!v.pos) {
        // a new car waits at the kerb outside the dealer (or your home)
        const p = game.city.placeById.dealer || game.homePlace();
        v.pos = this.freeKerbSpot(p.x + p.nx * 6, p.z + p.nz * 6) || this.kerbSpot(p.x + p.nx * 6, p.z + p.nz * 6);
      }
      car.group.position.set(v.pos.x, 0, v.pos.z);
      car.group.rotation.y = v.pos.ry;
    }
  }
  clear() {
    for (const car of this.cars.values()) this.game.scene.remove(car.group);
    this.cars.clear();
    this.driving = null;
  }

  /** Collision box of a car mesh at a pose (reuses `out`). */
  obbOf(car, x, z, ry, out = {}) {
    const sz = car.def.size;
    const dm = BODY_DIMS[car.def.body] || BODY_DIMS.sedan;
    out.x = x;
    out.z = z;
    out.ry = ry;
    out.hw = dm.hw * sz[0];
    out.hl = dm.hl * sz[2];
    return out;
  }

  /** Boxes of every parked (not driven) player car. */
  parkedOBBs() {
    const out = (this._parked ||= []);
    out.length = 0;
    for (const car of this.cars.values()) {
      if (car === this.driving) continue;
      const g = car.group.position;
      out.push(this.obbOf(car, g.x, g.z, car.group.rotation.y, (car._obb ||= {})));
    }
    return out;
  }

  /** Can the driven car stand at this pose? (asphalt only, no cars, no kerb-side objects) */
  poseFree(car, x, z, ry) {
    const game = this.game;
    const s = Math.sin(ry);
    const c = Math.cos(ry);
    const box = this.obbOf(car, x, z, ry, (this._me ||= {}));
    for (const [lx, lz] of CORNERS) {
      const px = x + c * lx * car.def.size[0] + s * lz * car.def.size[2];
      const pz = z - s * lx * car.def.size[0] + c * lz * car.def.size[2];
      if (!this.onRoad(px, pz)) return false;
      if (game.city.colliders.pointBlocked(px, 0.6, pz, 0)) return false; // parked cars, bollards
    }
    for (const car2 of this.cars.values()) {
      if (car2 === car) continue;
      const g = car2.group.position;
      if (obbOverlap(box, this.obbOf(car2, g.x, g.z, car2.group.rotation.y, (this._other ||= {})))) return false;
    }
    if (game.traffic?.overlapsOBB(box)) return false;
    return true;
  }

  nearest(pos, reach = 3.4) {
    let best = null;
    let bd = reach * reach;
    for (const car of this.cars.values()) {
      const p = car.group.position;
      const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
      if (d < bd) {
        bd = d;
        best = car;
      }
    }
    return best;
  }

  /** Nearest kerb space not taken by a parked car (slides along the street), or null. */
  freeKerbSpot(x, z) {
    const base = this.kerbSpot(x, z);
    const fx = Math.sin(base.ry);
    const fz = Math.cos(base.ry);
    const cols = this.game.city.colliders;
    for (const off of [0, 6.4, -6.4, 12.8, -12.8, 19.2, -19.2]) {
      const sx = base.x + fx * off;
      const sz = base.z + fz * off;
      if (!this.onRoad(sx, sz)) continue;
      let free = true;
      for (const t of [-2.2, 0, 2.2]) if (cols.pointBlocked(sx + fx * t, 0.6, sz + fz * t, 0.25)) free = false;
      for (const car of this.cars.values()) if (car !== this.driving && Math.hypot(car.group.position.x - sx, car.group.position.z - sz) < 4.6) free = false;
      if (free) return { x: sx, z: sz, ry: base.ry };
    }
    return null;
  }

  /** Bring a car to the kerb nearest the player (valet). */
  valet(vid) {
    const car = this.cars.get(vid);
    if (!car || this.driving) return false;
    const p = this.game.playerMapPos();
    car.v.pos = this.freeKerbSpot(p.x, p.z) || this.kerbSpot(p.x, p.z);
    car.group.position.set(car.v.pos.x, 0, car.v.pos.z);
    car.group.rotation.y = car.v.pos.ry;
    return true;
  }

  enter(car) {
    if (this.game.player.riding) this.game.dismountBike(false);
    const game = this.game;
    if (this.driving || game.inside) return;
    this.driving = car;
    car.speed = 0;
    game.playerRig.group.visible = false;
    game.player.frozen = true;
    this._dist = game.cam.dist;
    game.cam.dist = Math.max(game.cam.dist, 9.5);
    game.state.activeVehicle = car.v.id;
    game.audio?.play('door');
    game.hud.hint('drive', 'W / S throttle and brake · A / D steer · F to get out. You stop automatically for pedestrians.', 9);
    game.events.emit('carEntered', {});
  }

  exit(silent) {
    const game = this.game;
    const car = this.driving;
    if (!car) return;
    if (!silent && Math.abs(car.speed) > 2.5) return game.events.emit('toast', { icon: '🚗', title: 'Slow down first', text: 'Stop the car before getting out.', kind: 'info' });
    // park at the kerb when on a street, otherwise leave it where it stands
    const g = car.group;
    const spot = this.freeKerbSpot(g.position.x, g.position.z);
    if (spot && Math.hypot(spot.x - g.position.x, spot.z - g.position.z) < 22) {
      g.position.set(spot.x, 0, spot.z);
      g.rotation.y = spot.ry;
    }
    car.speed = 0;
    car.v.pos = { x: g.position.x, z: g.position.z, ry: g.rotation.y };
    this.driving = null;
    // step out on the kerb side
    const rx = Math.cos(g.rotation.y);
    const rz = -Math.sin(g.rotation.y);
    let px = g.position.x - rx * 2.2;
    let pz = g.position.z - rz * 2.2;
    if (game.city.groundY(px, pz) === 0) {
      px = g.position.x + rx * 2.2;
      pz = g.position.z + rz * 2.2;
    }
    game.player.frozen = false;
    game.player.teleport(px, pz, g.rotation.y);
    game.playerRig.group.visible = true;
    game.cam.dist = this._dist || 6.5;
    if (!silent) game.audio?.play('door');
  }

  /** Per-frame driving. Returns true while the player is at the wheel. */
  update(dt, input) {
    const car = this.driving;
    if (!car) return false;
    const game = this.game;
    const def = car.def;
    const g = car.group;
    const cond = car.v.condition ?? 1;
    const top = def.top * (0.6 + 0.4 * cond);
    let throttle = 0;
    let steer = 0;
    if (input) {
      if (input.isDown('KeyW') || input.isDown('ArrowUp')) throttle += 1;
      if (input.isDown('KeyS') || input.isDown('ArrowDown')) throttle -= 1;
      if (input.isDown('KeyA') || input.isDown('ArrowLeft')) steer += 1;
      if (input.isDown('KeyD') || input.isDown('ArrowRight')) steer -= 1;
    }
    if (throttle > 0) car.speed += def.accel * dt * (car.speed < 0 ? 2.5 : 1);
    else if (throttle < 0) car.speed -= (car.speed > 0 ? def.accel * 2.4 : def.accel * 0.6) * dt;
    else car.speed = damp(car.speed, 0, 0.9, dt);
    car.speed = clamp(car.speed, -5, top);

    // safety assist: never drive into a pedestrian
    const fx = Math.sin(g.rotation.y);
    const fz = Math.cos(g.rotation.y);
    const cr = game.crowd;
    if (car.speed > 0.5 && cr.n) {
      const look = 3 + car.speed * 0.55;
      for (let i = 0; i < cr.n; i++) {
        if (!cr.alive[i]) continue;
        const dx = cr.x[i] - g.position.x;
        const dz = cr.z[i] - g.position.z;
        const ahead = dx * fx + dz * fz;
        if (ahead > 0 && ahead < look && Math.abs(dx * fz - dz * fx) < 1.5) {
          car.speed = damp(car.speed, 0, 9, dt);
          break;
        }
      }
    }

    // the wheel turns gradually and self-centres; less lock at speed (bicycle model)
    car.steer = damp(car.steer || 0, steer, steer ? 5 : 7, dt);
    const lock = (0.62 / (1 + Math.abs(car.speed) / 9)) * def.grip;
    const turn = (car.speed * Math.tan(car.steer * lock)) / 2.2;
    const ry = g.rotation.y + turn * dt;
    const nx = g.position.x + Math.sin(ry) * car.speed * dt;
    const nz = g.position.z + Math.cos(ry) * car.speed * dt;
    // stay on the asphalt and never pass through another car
    if (this.poseFree(car, nx, nz, ry)) {
      g.position.set(nx, 0, nz);
      g.rotation.y = ry;
    } else {
      // bump: stop, bounce back a little, and allow steering on the spot if there is room
      if (Math.abs(car.speed) > 3) game.audio?.play('bump');
      car.speed *= -0.2;
      if (this.poseFree(car, g.position.x, g.position.z, ry)) g.rotation.y = ry;
    }
    // body motion: lean out of corners, squat under power, dip under braking
    const body = g.children[0];
    if (body && dt > 1e-4) {
      const acc = (car.speed - (car.prevSp ?? car.speed)) / dt;
      car.prevSp = car.speed;
      car.roll = damp(car.roll || 0, clamp(car.speed * turn * 0.011, -0.07, 0.07), 6, dt);
      car.pitch = damp(car.pitch || 0, clamp(-acc * 0.01, -0.045, 0.045), 6, dt);
      body.rotation.set(car.pitch, 0, car.roll, 'YXZ');
    }
    // the player "is" the car while driving (map, crowd, sky all follow it)
    game.player.pos.set(g.position.x, 0, g.position.z);
    game.player.heading = g.rotation.y;
    game.player.speed = 0;
    if (input && !(input.buttons & 7)) game.cam.yaw = dampAngle(game.cam.yaw, g.rotation.y + Math.PI, 2.2, dt);
    return true;
  }

  /** Speed of the driven car in mph (for the HUD). */
  mph() {
    return this.driving ? Math.round(Math.abs(this.driving.speed) * 2.237) : 0;
  }
}
const CORNERS = [
  [-0.85, 2.0],
  [0.85, 2.0],
  [-0.85, -2.0],
  [0.85, -2.0],
];
