// The player's cars: meshes parked in the city, entering/exiting (F), arcade
// driving on the road network, and kerb-side parking.
// Optional models: public/models/vehicles/<vehicle id>.glb replace the mesh.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VEHICLE_BY_ID } from '../data/vehicles.js';
import { loadAssetManifest } from '../core/Assets.js';
import { clamp, damp, dampAngle } from '../core/utils.js';

export const LANE_IN = 1.75; // driving lanes (AI traffic)
export const LANE_OUT = 5.25; // kerb lanes (parking)

/** Base car geometry (front faces +Z). Body is white so a colour can tint it. */
export function carGeometry() {
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
  const parts = [
    paint(new THREE.BoxGeometry(1.8, 0.52, 4.3).translate(0, 0.56, 0), 1, 1, 1),
    paint(new THREE.BoxGeometry(1.62, 0.2, 3.9).translate(0, 0.9, -0.05), 1, 1, 1),
    paint(new THREE.BoxGeometry(1.56, 0.48, 2.2).translate(0, 1.2, -0.2), 0.1, 0.13, 0.18),
    paint(new THREE.BoxGeometry(1.5, 0.05, 2.0).translate(0, 1.46, -0.2), 1, 1, 1),
    paint(new THREE.BoxGeometry(1.5, 0.12, 0.06).translate(0, 0.7, 2.16), 2.2, 2.0, 1.5),
    paint(new THREE.BoxGeometry(1.5, 0.1, 0.06).translate(0, 0.72, -2.16), 1.6, 0.1, 0.1),
  ];
  for (const x of [-0.9, 0.9]) for (const z of [-1.35, 1.35]) parts.push(paint(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12).rotateZ(Math.PI / 2).translate(x, 0.34, z), 0.03, 0.03, 0.035));
  return mergeGeometries(parts);
}

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

let sharedGeo = null;
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
  sharedGeo ||= carGeometry();
  const mesh = new THREE.Mesh(sharedGeo, new THREE.MeshStandardMaterial({ vertexColors: true, color, roughness: 0.32, metalness: 0.45 }));
  mesh.scale.set(def.size[0], def.size[1], def.size[2]);
  mesh.castShadow = true;
  group.add(mesh);
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
        v.pos = this.kerbSpot(p.x + p.nx * 6, p.z + p.nz * 6);
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

  /** Bring a car to the kerb nearest the player (valet). */
  valet(vid) {
    const car = this.cars.get(vid);
    if (!car || this.driving) return false;
    const p = this.game.playerMapPos();
    car.v.pos = this.kerbSpot(p.x, p.z);
    car.group.position.set(car.v.pos.x, 0, car.v.pos.z);
    car.group.rotation.y = car.v.pos.ry;
    return true;
  }

  enter(car) {
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
    const spot = this.kerbSpot(g.position.x, g.position.z);
    if (Math.hypot(spot.x - g.position.x, spot.z - g.position.z) < 9) {
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

    const turn = steer * def.grip * 1.9 * clamp(car.speed / 7, -1, 1) * (1 - 0.45 * clamp(Math.abs(car.speed) / top, 0, 1));
    const ry = g.rotation.y + turn * dt;
    const nx = g.position.x + Math.sin(ry) * car.speed * dt;
    const nz = g.position.z + Math.cos(ry) * car.speed * dt;
    // stay on the asphalt: test the four corners
    const s = Math.sin(ry);
    const c = Math.cos(ry);
    let ok = true;
    for (const [lx, lz] of CORNERS) {
      if (!this.onRoad(nx + c * lx + s * lz, nz - s * lx + c * lz)) {
        ok = false;
        break;
      }
    }
    if (ok && game.traffic?.blocked(nx, nz, 2.6)) ok = false;
    if (ok) {
      g.position.set(nx, 0, nz);
      g.rotation.y = ry;
    } else {
      g.rotation.y = ry; // let the player steer out of a scrape
      car.speed *= -0.25;
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
