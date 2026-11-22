// The taxi ride you can see: you climb into the back seat, the cab pulls out
// and drives off down the street (you are visible through the windows, the
// camera rides along), then the trip itself passes in a fade.
import * as THREE from 'three';
import { vehicleGeometry, carMaterial, glassMaterial } from './CarModel.js';
import { animateRig } from '../characters/Animation.js';

const RIDE = 6.5; // seconds of driving you watch

/** Where to start: the hailed cab's spot, a kerb lane beside you, or nearby on the road. */
function startSpot(game) {
  const h = game.hail;
  const p = game.player.pos;
  if (h?.spot && (h.spot.x - p.x) ** 2 + (h.spot.z - p.z) ** 2 < 15 * 15) return h.spot;
  const k = h?.kerb(p);
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
  const { g, s } = R;
  // pull out gently, then cruise
  const v = Math.min(9, R.t * 4);
  R.dist = (R.dist || 0) + v * dt;
  const fx = Math.sin(s.ry);
  const fz = Math.cos(s.ry);
  // pull out of the kerb lane into the traffic lane (3.5 m toward the middle of the road)
  const out = 3.5 * Math.min(1, R.t / 1.6) ** 2 * (3 - 2 * Math.min(1, R.t / 1.6));
  g.position.set(s.x + fx * R.dist + (s.nx || 0) * out, 0, s.z + fz * R.dist + (s.nz || 0) * out);
  // your seat: the back right, behind the passenger seat (local -x is right)
  const sx = 0.36;
  const sz = -0.65;
  const wx = g.position.x + Math.cos(s.ry) * sx + fx * sz;
  const wz = g.position.z - Math.sin(s.ry) * sx + fz * sz;
  const pl = game.player;
  pl.pos.set(wx, 0, wz);
  pl.heading = s.ry;
  game.playerRig.group.position.set(wx, 0.02, wz);
  game.playerRig.group.scale.setScalar((game.playerRig.appearance?.height || 1) * 0.9);
  game.playerRig.group.rotation.y = s.ry;
  animateRig(game.playerRig, dt, { speed: 0, grounded: true, sitting: true, talking: R.t > 3 && R.t < 4.5 });
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
