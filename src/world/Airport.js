// The airport: a glass terminal on an edge block (its door is the check-in
// hall), a control tower, and an airfield beyond the city edge with a runway,
// parked jets, and planes landing and taking off. Airliners also cross the
// sky over every city, with blinking lights after dark.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FACADE, worldUniforms } from './Buildings.js';
import { labelTexture } from './Textures.js';

const LIVERIES = ['#1f5fa8', '#c53a3a', '#2f8f6a', '#e07b39', '#5a4fd0', '#1d2433'];

class Bag {
  constructor() {
    this.list = [];
  }
  add(geo, color) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    const n = geo.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(geo);
    return this;
  }
  geometry() {
    return mergeGeometries(this.list);
  }
}
const bx = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/** An airliner (nose +Z, ~36 m long, ~34 m span), tail in the livery colour. */
export function planeMesh(livery) {
  const b = new Bag();
  const white = '#f4f5f7';
  b.add(new THREE.CylinderGeometry(1.95, 1.95, 28, 18).rotateX(Math.PI / 2), white);
  b.add(new THREE.SphereGeometry(1.95, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 2.1).translate(0, 0, 14), white);
  b.add(new THREE.ConeGeometry(1.95, 7, 18).rotateX(-Math.PI / 2).scale(1, 0.8, 1).translate(0, 0.4, -17.5), white);
  // windows and the cockpit glass
  for (const s of [-1, 1]) b.add(bx(0.05, 0.32, 22, s * 1.93, 0.5, 0.5), '#1d2433');
  b.add(bx(1.8, 0.45, 0.6, 0, 0.8, 15.6).rotateX(0.5), '#1d2433');
  // belly stripe in the livery colour
  for (const s of [-1, 1]) b.add(bx(0.05, 0.28, 26, s * 1.94, -0.35, 0), livery);
  // wings: swept, with engines underneath
  for (const s of [-1, 1]) {
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(16.5, -6.5), new THREE.Vector2(16.5, -8.2), new THREE.Vector2(0, -6.4)]);
    const wing = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, -0.6, 3.2);
    if (s < 0) wing.scale(-1, 1, 1);
    b.add(wing, '#dfe3e8');
    b.add(new THREE.CylinderGeometry(0.95, 0.85, 4.2, 14).rotateX(Math.PI / 2).translate(s * 5.8, -1.7, 1.6), '#c9ced6');
    b.add(new THREE.CylinderGeometry(0.75, 0.75, 0.1, 14).rotateX(Math.PI / 2).translate(s * 5.8, -1.7, 3.72), '#2b2f38');
    // horizontal stabilisers
    const st = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(6, -3), new THREE.Vector2(6, -4.2), new THREE.Vector2(0, -3.6)]);
    const stab = new THREE.ExtrudeGeometry(st, { depth: 0.2, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, 0.9, -15);
    if (s < 0) stab.scale(-1, 1, 1);
    b.add(stab, '#dfe3e8');
  }
  // tail fin in the livery colour
  const fin = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-5.5, 0), new THREE.Vector2(-8.8, 7), new THREE.Vector2(-6.4, 7)]);
  b.add(new THREE.ExtrudeGeometry(fin, { depth: 0.3, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(0.15, 1.2, -12.5), livery);
  // landing gear
  for (const [x, z] of [[0, 12], [-2.2, -1], [2.2, -1]]) {
    b.add(new THREE.CylinderGeometry(0.12, 0.12, 1.6).translate(x, -2.4, z), '#6b7280');
    b.add(new THREE.CylinderGeometry(0.5, 0.5, 0.45, 12).rotateZ(Math.PI / 2).translate(x, -3.1, z), '#1d1f24');
  }
  const mesh = new THREE.Mesh(b.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25, side: THREE.DoubleSide }));
  mesh.castShadow = true;
  const g = new THREE.Group();
  mesh.position.y = 3.6; // wheels on the ground at y = 0
  g.add(mesh);
  // nav lights: red left, green right, white strobe on the tail
  const light = (color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    m.position.set(x, y + 3.6, z);
    g.add(m);
    return m;
  };
  g.userData.lights = [light('#ff3040', 16.5, -0.6, -4.3), light('#30ff70', -16.5, -0.6, -4.3), light('#ffffff', 0, 8.4, -21)];
  return g;
}

/** Which side of the city is dry land (for the airfield). */
export function airportSide(cfg) {
  const wf = cfg.waterfront || [];
  return ['east', 'north', 'west', 'south'].find((s) => !wf.includes(s)) || 'east';
}

/**
 * Build the terminal on edge block b. dir = outward unit vector [ox, oz]
 * (from the city towards the airfield).
 */
export function buildAirport(ctx, b, side) {
  const { group, colliders, K, places, batch, cfg } = ctx;
  const Y = K.CURB;
  const [ox, oz] = { east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1] }[side];
  const tx = -oz; // along the terminal
  const tz = ox;
  const cx = b.cx;
  const cz = b.cz;
  const at = (out, along) => [cx + ox * out + tx * along, cz + oz * out + tz * along];
  const name = cfg.airport || `${cfg.name} International Airport`;
  // terminal: long glass hall on the outer half of the block
  const [tcx, tcz] = at(7, 0);
  const tw = ox ? 32 : 44;
  const td = ox ? 44 : 32;
  batch.add(tcx, tcz, ox ? 32 : 44, ox ? 44 : 32, 15, '#a9c3d6', { floorH: 5, bay: 4, seed: 9, type: FACADE.GLASS });
  colliders.add(tcx - tw / 2, tcz - td / 2, tcx + tw / 2, tcz + td / 2, 15 + Y);
  const bag = new Bag();
  // wavy roof canopy and a front canopy over the drop-off
  const roof = new THREE.CylinderGeometry(30, 30, ox ? 46 : 46, 32, 1, false, -0.42, 0.84).rotateZ(Math.PI / 2);
  if (!ox) roof.rotateY(Math.PI / 2);
  bag.add(roof.scale(1, 0.12, 1).translate(tcx, 15 + 0.2 - 30 * 0.12 + 3.6, tcz), '#e8ecef');
  const [fcx, fcz] = at(-9.8, 0);
  bag.add(bx(ox ? 4 : 30, 0.5, ox ? 30 : 4, fcx, Y + 6, fcz), '#e8ecef');
  for (const k of [-12, -4, 4, 12]) {
    const [px, pz] = at(-11.4, k);
    bag.add(new THREE.CylinderGeometry(0.22, 0.22, 6, 10).translate(px, Y + 3, pz), '#c9ced6');
    colliders.add(px - 0.25, pz - 0.25, px + 0.25, pz + 0.25, 6);
  }
  // control tower at a corner
  const [kx, kz] = at(-2, ox ? -20 : 20);
  bag.add(new THREE.CylinderGeometry(2.2, 2.8, 38, 16).translate(kx, 19, kz), '#dfe3e8');
  bag.add(new THREE.CylinderGeometry(4.2, 3.4, 4.5, 16).translate(kx, 40.2, kz), '#2b3a4a');
  bag.add(new THREE.CylinderGeometry(4.6, 4.6, 0.6, 16).translate(kx, 42.7, kz), '#dfe3e8');
  bag.add(new THREE.CylinderGeometry(0.1, 0.1, 5, 6).translate(kx, 45.5, kz), '#c9ced6');
  colliders.add(kx - 2.8, kz - 2.8, kx + 2.8, kz + 2.8, 45);
  // forecourt: planters and flags
  for (const k of [-16, 16]) {
    const [px, pz] = at(-18, k);
    bag.add(bx(1.4, 0.8, 1.4, px, Y + 0.4, pz), '#8a8f99');
    bag.add(new THREE.IcosahedronGeometry(0.9, 1).translate(px, Y + 1.4, pz), '#3f7a3a');
    colliders.add(px - 0.7, pz - 0.7, px + 0.7, pz + 0.7, 1);
  }
  const mesh = new THREE.Mesh(bag.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 }));
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  // the name over the entrance
  const tex = labelTexture(name, { icon: '✈️', bg: '#1d2b44', accent: '#4fb3ff' });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  const [sx, sz] = at(-9.05, 0);
  sign.position.set(sx, Y + 8.6, sz);
  sign.rotation.y = Math.atan2(-ox, -oz);
  group.add(sign);

  const [dx, dz] = at(-9, 0);
  const place = {
    id: 'airport', type: 'airport', name, district: b.district, icon: '✈️', color: '#4f9dff', label: 'Airport', custom: true,
    nx: -ox, nz: -oz, doorX: dx, doorZ: dz, x: dx - ox * 3.5, z: dz - oz * 3.5,
  };
  places.push(place);

  // ---- airfield beyond the city edge: grass, runway, taxiway, apron ----
  const edge = ctx.roadCenter(ctx.N) + K.ROAD / 2; // outer kerb of the edge road
  const field = new Bag();
  const along = (ox ? cz : cx);
  const F = (out, alongOff, w, l, color, y) => {
    // w across (outwards), l along the runway
    const px = ox ? ox * (edge + out) : cx + alongOff;
    const pz = ox ? cz + alongOff : oz * (edge + out);
    field.add(bx(ox ? w : l, 0.04, ox ? l : w, px, y, pz), color);
  };
  F(72, 0, 140, 460, '#6f8a5a', 0.01);
  F(26, 0, 30, 160, '#5d6168', 0.025); // apron
  F(100, 0, 42, 440, '#3d4148', 0.03); // runway
  F(60, 0, 16, 300, '#4a4e55', 0.028); // taxiway
  for (let k = -200; k <= 200; k += 24) F(100, k, 1, 12, '#f2f2f0', 0.035); // centreline
  for (const e of [-1, 1]) for (let s = -3; s <= 3; s++) F(100 + s * 5, e * 205, 2.2, 22, '#f2f2f0', 0.035); // thresholds
  const fieldMesh = new THREE.Mesh(field.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  fieldMesh.receiveShadow = true;
  group.add(fieldMesh);
  const P = (out, a) => (ox ? new THREE.Vector3(ox * (edge + out), 0, cz + a) : new THREE.Vector3(cx + a, 0, oz * (edge + out)));
  ctx.airport = { name, place, side, ox, oz, along, runway: { a: P(100, -210), b: P(100, 210) }, gates: [P(26, -45), P(26, 0), P(26, 45)], edge };
  return ctx.airport;
}

/** Planes: parked at the gates, landing / taking off, and cruising overhead. */
export class AirTraffic {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.t = 0;
  }

  setCity(city) {
    this.group.removeFromParent();
    this.group.clear();
    this.city = city;
    this.game.scene.add(this.group);
    const ap = city.airport;
    this.parked = [];
    this.active = null;
    this.cruise = [];
    if (ap) {
      const face = Math.atan2(-ap.ox, -ap.oz); // nose towards the terminal
      ap.gates.forEach((g, k) => {
        const p = planeMesh(LIVERIES[k % LIVERIES.length]);
        p.position.copy(g);
        p.rotation.y = face;
        this.group.add(p);
        this.parked.push(p);
      });
      this.active = { plane: planeMesh(LIVERIES[4]), phase: 'idle', t: 0, mode: 0 };
      this.group.add(this.active.plane);
      this.active.plane.visible = false;
    }
    for (let k = 0; k < 2; k++) {
      const p = planeMesh(LIVERIES[(k + 2) % LIVERIES.length]);
      p.scale.setScalar(1);
      p.visible = false;
      this.group.add(p);
      this.cruise.push({ plane: p, t: -k * 40 - 10, from: new THREE.Vector3(), to: new THREE.Vector3(), dur: 90 });
    }
  }

  update(dt, playerPos, visible) {
    if (!this.city) return;
    this.group.visible = visible;
    if (!visible) return;
    this.t += dt;
    const night = worldUniforms.uNight?.value ?? 0;
    const blink = Math.floor(this.t * 1.4) % 2 === 0;
    // nav lights always on; the white tail strobe blinks (brighter-looking at night)
    const setLights = (p) => p.userData.lights.forEach((l, k) => (l.visible = k < 2 || blink || night < 0.2));
    // landings and take-offs on the runway
    const ap = this.city.airport;
    const A = this.active;
    if (ap && A) {
      A.t += dt;
      const { a, b } = ap.runway;
      const dir = new THREE.Vector3().subVectors(b, a).normalize();
      const p = A.plane;
      if (A.phase === 'idle' && A.t > 12) {
        A.phase = A.mode % 2 ? 'takeoff' : 'landing';
        A.t = 0;
        A.mode++;
        p.visible = true;
      }
      if (A.phase === 'landing') {
        // glide in from 1.2 km out at 90 m, flare, touch down, roll out
        const T = 38;
        const k = Math.min(1, A.t / T);
        const startDist = 1200;
        const touch = 0.72;
        const along = k < touch ? -startDist + (startDist + 40) * (k / touch) : 40 + 300 * (1 - (1 - (k - touch) / (1 - touch)) ** 2);
        const alt = k < touch ? 90 * (1 - k / touch) ** 1.3 : 0;
        p.position.copy(a).addScaledVector(dir, along);
        p.position.y = alt;
        p.rotation.set(k < touch ? -0.05 : 0, Math.atan2(dir.x, dir.z), 0, 'YXZ');
        if (k >= 1) {
          A.phase = 'idle';
          A.t = 0;
          p.visible = false;
        }
      } else if (A.phase === 'takeoff') {
        const T = 34;
        const k = Math.min(1, A.t / T);
        const roll = 0.45;
        const along = k < roll ? 40 + 330 * (k / roll) ** 2 : 370 + 1500 * (k - roll);
        const alt = k < roll ? 0 : 260 * ((k - roll) / (1 - roll)) ** 1.4;
        p.position.copy(a).addScaledVector(dir, along);
        p.position.y = alt;
        p.rotation.set(k < roll ? 0 : -0.16, Math.atan2(dir.x, dir.z), 0, 'YXZ');
        if (k >= 1) {
          A.phase = 'idle';
          A.t = 0;
          p.visible = false;
        }
      }
      setLights(p);
    }
    for (const p of this.parked) setLights(p);
    // airliners crossing the sky high above the city
    for (const c of this.cruise) {
      c.t += dt;
      if (c.t < 0) continue;
      if (!c.plane.visible || c.t > c.dur) {
        const ang = Math.random() * Math.PI * 2;
        const r = 900;
        c.from.set(playerPos.x + Math.cos(ang) * r, 260 + Math.random() * 160, playerPos.z + Math.sin(ang) * r);
        c.to.set(playerPos.x - Math.cos(ang + 0.5) * r, c.from.y, playerPos.z - Math.sin(ang + 0.5) * r);
        c.dur = 70 + Math.random() * 30;
        c.t = 0;
        c.plane.visible = true;
        c.plane.rotation.y = Math.atan2(c.to.x - c.from.x, c.to.z - c.from.z);
      }
      c.plane.position.lerpVectors(c.from, c.to, c.t / c.dur);
      setLights(c.plane);
    }
  }
}
