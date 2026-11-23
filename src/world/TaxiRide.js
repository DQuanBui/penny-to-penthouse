// The taxi ride you can see: you climb into the back seat, the cab pulls out
// and drives off down the street (you are visible through the windows, the
// camera rides along), then the trip itself passes in a fade. At the other end
// the cab pulls up at the kerb by the door, you step out and it drives away.
import * as THREE from 'three';
import { vehicleGeometry, carMaterial, glassMaterial } from './CarModel.js';
import { animateRig } from '../characters/Animation.js';

const RIDE = 6.5; // seconds of driving you watch
const ARRIVE = 3.4; // seconds of the cab slowing to the kerb
const LANE = 5.25; // kerb lane centre from the road centre line

/**
 * The kerb lane next to a point on the pavement (within 1.6 m of a block edge
 * with a road beyond it): { x, z, ry, nx, nz }, heading with the kerb on the
 * right; n points from the pavement out into the road. Null elsewhere.
 */
export function kerbSpot(c, p) {
  const K = c.K;
  const i = Math.floor((p.x + c.half - K.ROAD) / K.PITCH);
  const j = Math.floor((p.z + c.half - K.ROAD) / K.PITCH);
  if (i < 0 || j < 0 || i >= c.N || j >= c.N) return null;
  const lx = p.x - c.blockMin(i);
  const lz = p.z - c.blockMin(j);
  if (lx < 0 || lz < 0 || lx > K.BLOCK || lz > K.BLOCK) return null;
  if (lz < 1.6 && j > 0) return { x: p.x, z: c.roadCenter(j) + LANE, ry: Math.PI / 2, nx: 0, nz: -1 };
  if (lz > K.BLOCK - 1.6 && j < c.N - 1) return { x: p.x, z: c.roadCenter(j + 1) - LANE, ry: -Math.PI / 2, nx: 0, nz: 1 };
  if (lx < 1.6 && i > 0) return { x: c.roadCenter(i) + LANE, z: p.z, ry: Math.PI, nx: -1, nz: 0 };
  if (lx > K.BLOCK - 1.6 && i < c.N - 1) return { x: c.roadCenter(i + 1) - LANE, z: p.z, ry: 0, nx: 1, nz: 0 };
  return null;
}

/** A free gap along the kerb near a spot (or double-parked beside the parked cars). */
export function kerbGap(c, k) {
  const parked = c.parkedCars || [];
  const fx = Math.sin(k.ry);
  const fz = Math.cos(k.ry);
  const free = (x, z) => !parked.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < 5.2 * 5.2);
  for (const o of [0, 4, -4, 8, -8, 12, -12]) {
    const x = k.x + fx * o;
    const z = k.z + fz * o;
    if (free(x, z)) return { ...k, x, z, dbl: 0 };
  }
  return { ...k, x: k.x + k.nx * 2.6, z: k.z + k.nz * 2.6, dbl: 2.6 };
}

function makeCab(s) {
  const g = new THREE.Group();
  const { body, glass } = vehicleGeometry('taxi');
  const m = new THREE.InstancedMesh(body, carMaterial(), 1);
  m.setMatrixAt(0, new THREE.Matrix4());
  m.setColorAt(0, new THREE.Color('#f2c230'));
  m.castShadow = true;
  g.add(m);
  if (glass) {
    const gm = new THREE.InstancedMesh(glass, glassMaterial(), 1);
    gm.setMatrixAt(0, new THREE.Matrix4());
    g.add(gm);
  }
  g.position.set(s.x, 0, s.z);
  g.rotation.y = s.ry;
  return g;
}

/** Keep the player in the back seat of a cab (the back right, behind the passenger seat). */
function seat(game, g, ry, dt, talking = false) {
  const fx = Math.sin(ry);
  const fz = Math.cos(ry);
  const sx = 0.36;
  const sz = -0.65;
  const wx = g.position.x + Math.cos(ry) * sx + fx * sz;
  const wz = g.position.z - Math.sin(ry) * sx + fz * sz;
  const pl = game.player;
  pl.pos.set(wx, 0, wz);
  pl.heading = ry;
  game.playerRig.group.position.set(wx, 0.02, wz);
  game.playerRig.group.scale.setScalar((game.playerRig.appearance?.height || 1) * 0.9);
  game.playerRig.group.rotation.y = ry;
  animateRig(game.playerRig, dt, { speed: 0, grounded: true, sitting: true, talking });
}

/** Where to start: the hailed cab's spot, a kerb lane beside you, or nearby on the road. */
function startSpot(game) {
  const h = game.hail;
  const p = game.player.pos;
  if (h?.spot && (h.spot.x - p.x) ** 2 + (h.spot.z - p.z) ** 2 < 15 * 15) return h.spot;
  const k = kerbSpot(game.city, p);
  if (k) return k;
  // the nearest road centre line, heading along it
  const c = game.city;
  const K = c.K;
  let best = null;
  for (let a = 0; a <= c.N; a++) {
    const rc = c.roadCenter(a);
    const dx = Math.abs(p.x - rc);
    const dz = Math.abs(p.z - rc);
    if (!best || dx < best.d) best = { d: dx, x: rc + 5.25, z: p.z, ry: 0, nx: -1, nz: 0 };
    if (dz < best.d) best = { d: dz, x: p.x, z: rc + 5.25, ry: Math.PI / 2, nx: 0, nz: -1 };
  }
  void K;
  return best;
}

export function taxiRide(game) {
  return new Promise((resolve) => {
    if (game.inside || !game.city) return resolve();
    const s = startSpot(game);
    const g = makeCab(s);
    game.scene.add(g);
    game.hail?.dismiss();
    const pl = game.player;
    pl.sitting = true;
    pl.emote = null;
    game.ride = { t: 0, g, s, done: resolve };
    game.audio?.play('door');
    game.hud.hint('taxi_ride', 'Sit back and watch the city go by…', 4);
  });
}

/** Per frame while riding: drive the cab, keep you in the back seat, follow with the camera. */
export function updateTaxiRide(game, dt) {
  const R = game.ride;
  if (!R) return;
  R.t += dt;
  if (R.arrive) return updateArrival(game, R, dt);
  const { g, s } = R;
  // pull out gently, then cruise
  const v = Math.min(9, R.t * 4);
  R.dist = (R.dist || 0) + v * dt;
  const fx = Math.sin(s.ry);
  const fz = Math.cos(s.ry);
  // pull out of the kerb lane into the traffic lane (3.5 m toward the middle of the road)
  const out = 3.5 * Math.min(1, R.t / 1.6) ** 2 * (3 - 2 * Math.min(1, R.t / 1.6));
  g.position.set(s.x + fx * R.dist + (s.nx || 0) * out, 0, s.z + fz * R.dist + (s.nz || 0) * out);
  seat(game, g, s.ry, dt, R.t > 3 && R.t < 4.5);
  // after a while the trip itself fades by (the cab keeps driving under the fade)
  if (R.t > RIDE && !R.ending) {
    R.ending = true;
    R.done();
  }
}

/** At black: put the cab away and get out. */
export function endTaxiRide(game) {
  const R = game.ride;
  if (!R) return;
  R.g.removeFromParent();
  game.ride = null;
  game.player.sitting = false;
  game.playerRig.group.scale.setScalar(game.playerRig.appearance?.height || 1);
}

/**
 * After the trip (at black): the cab is a little way up the street, carrying you
 * to the kerb beside the place's door. Returns false where no kerb is near.
 */
export function taxiArrive(game, place) {
  const c = game.city;
  if (!c || game.inside || !place) return false;
  let k = null;
  const nx = place.nx || 0;
  const nz = place.nz || 0;
  for (let d = 0; d <= 14 && !k; d += 0.5) k = kerbSpot(c, { x: place.x + nx * d, z: place.z + nz * d });
  if (!k) return false;
  const s = kerbGap(c, k);
  const g = makeCab(s);
  game.scene.add(g);
  game.player.sitting = true;
  game.player.emote = null;
  game.ride = { arrive: true, t: 0, g, s, door: { x: place.x, z: place.z }, done: null };
  updateArrival(game, game.ride, 0);
  game.cam.snapBehind(s.ry + 0.9);
  return true;
}

function updateArrival(game, R, dt) {
  const { g, s } = R;
  const fx = Math.sin(s.ry);
  const fz = Math.cos(s.ry);
  // slow to a stop at the kerb, swinging in from the traffic lane
  const u = Math.min(1, R.t / ARRIVE);
  const back = 24 * (1 - u) ** 2;
  const w = Math.min(1, Math.max(0, (R.t - ARRIVE * 0.25) / (ARRIVE * 0.65)));
  const out = (3.5 + (s.dbl ? -2.6 : 0)) * (1 - w * w * (3 - 2 * w));
  g.position.set(s.x - fx * back + s.nx * Math.max(0, out), Math.sin(R.t * 9) * 0.008 * (1 - u), s.z - fz * back + s.nz * Math.max(0, out));
  seat(game, g, s.ry, dt, R.t > ARRIVE - 0.4 && R.t < ARRIVE + 0.3);
  if (R.t > ARRIVE + 0.15 && !R.opened) {
    R.opened = true;
    game.audio?.play('door');
  }
  if (R.t < ARRIVE + 0.7) return;
  // step out onto the pavement beside the cab, facing the door
  const off = 1.75 + (s.dbl || 0) + 1.1;
  const ex = g.position.x - s.nx * off - fx * 0.65;
  const ez = g.position.z - s.nz * off - fz * 0.65;
  const pl = game.player;
  pl.sitting = false;
  game.playerRig.group.scale.setScalar(game.playerRig.appearance?.height || 1);
  const face = Math.atan2(R.door.x - ex, R.door.z - ez);
  pl.teleport(ex, ez, face);
  game.ride = null;
  game.cabOff = { g, s, t: 0, x0: g.position.x, z0: g.position.z, d: 0 };
}

/** The cab that dropped you off pulls away and is gone. */
export function updateCabOff(game, dt) {
  const C = game.cabOff;
  if (!C) return;
  C.t += dt;
  const { g, s } = C;
  const v = Math.min(11, Math.max(0, C.t - 0.4) * 3.2);
  C.d += v * dt;
  const w = Math.min(1, Math.max(0, (C.t - 0.4) / 1.8));
  const out = (3.5 - (s.dbl || 0)) * w * w * (3 - 2 * w);
  g.position.set(C.x0 + Math.sin(s.ry) * C.d + s.nx * Math.max(0, out), 0, C.z0 + Math.cos(s.ry) * C.d + s.nz * Math.max(0, out));
  if (C.t > 8 || game.inside) {
    g.removeFromParent();
    game.cabOff = null;
  }
}
