// Bicycles: the bike you ride (frame, spinning wheels), the city's bike-share
// docks with their parked bikes, and cyclists riding in the bike lanes (one
// instanced mesh whose riders pedal in the vertex shader).
import * as THREE from 'three';
import { vehicleGeometry, carMaterial } from './CarModel.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldUniforms } from './Buildings.js';

export const SHARE_COLOR = '#18a999';
export const SHARE = { unlock: 4, includedMin: 45, per15: 1.5, strayFee: 10, max: 6, accel: 2.4 };
export const OWN_BIKES = {
  cruiser: { name: 'City cruiser', max: 6.5, accel: 2.6, color: '#27406b', effort: 1 },
  road: { name: 'Road bike', max: 8, accel: 3.2, color: '#c53a3a', effort: 1.2 },
  ebike: { name: 'E-bike', max: 9.5, accel: 4.2, color: '#1d1f24', effort: 0.2 },
  scooter: { name: 'Scooter', max: 13, accel: 5.5, color: '#e9c04c', effort: 0, moto: 'scooter' },
  motorbike: { name: 'Sport motorbike', max: 21, accel: 8, color: '#c53a3a', effort: 0, moto: 'motorbike' },
};

const tube = (a, b, r = 0.022) => {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), 6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// key points of a bike frame (front faces +Z, wheels r = 0.34)
const P = { rear: V(0, 0.34, -0.52), front: V(0, 0.34, 0.52), crank: V(0, 0.3, -0.02), seat: V(0, 0.9, -0.2), head: V(0, 0.86, 0.36), bar: V(0, 1.02, 0.42) };

/** Frame parts (no wheels) as an array of [geometry, colour]. */
function frameParts(color) {
  return [
    [tube(P.crank, P.seat, 0.024), color], // seat tube
    [tube(P.seat.clone().setY(0.86), P.head, 0.024), color], // top tube
    [tube(P.crank, P.head.clone().setY(0.78), 0.028), color], // down tube
    [tube(P.crank, P.rear, 0.016), color], // chainstay
    [tube(P.seat.clone().setY(0.86), P.rear, 0.016), color], // seatstay
    [tube(P.head.clone().setY(0.72), P.front, 0.018), '#b9bdc3'], // fork
    [tube(P.head, P.bar, 0.02), '#2b2d33'], // stem
    [new THREE.CylinderGeometry(0.016, 0.016, 0.52, 6).rotateZ(Math.PI / 2).translate(P.bar.x, P.bar.y, P.bar.z), '#2b2d33'], // handlebar
    [new THREE.BoxGeometry(0.12, 0.05, 0.24).translate(0, 0.94, -0.22), '#1d1f24'], // saddle
    [new THREE.CylinderGeometry(0.09, 0.09, 0.02, 12).rotateZ(Math.PI / 2).translate(0.04, 0.3, -0.02), '#6b7280'], // chainring
    [new THREE.BoxGeometry(0.16, 0.12, 0.18).translate(0, 0.84, 0.56), '#3a3f48'], // front basket / lamp
  ];
}
function wheelGeo(low = false) {
  const parts = [new THREE.TorusGeometry(0.33, 0.03, 6, low ? 14 : 22).rotateY(Math.PI / 2)];
  for (let k = 0; k < (low ? 3 : 6); k++) parts.push(new THREE.BoxGeometry(0.006, 0.62, 0.01).rotateX((k / (low ? 3 : 6)) * Math.PI));
  parts.push(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8).rotateZ(Math.PI / 2));
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    return g;
  }));
}
function colored(list) {
  return mergeGeometries(
    list.map(([g, c]) => {
      g = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      const col = new THREE.Color(c);
      const n = g.attributes.position.count;
      const a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
      return g;
    }),
  );
}

/** A rideable bike: a group with wheels that spin (userData.wheels). */
export function makeBike(color) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(colored(frameParts(color)), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.4 }));
  frame.castShadow = true;
  g.add(frame);
  const wmat = new THREE.MeshStandardMaterial({ color: '#1d1f24', roughness: 0.7 });
  g.userData.wheels = [P.rear, P.front].map((p) => {
    const w = new THREE.Mesh(wheelGeo(), wmat);
    w.position.copy(p);
    w.castShadow = true;
    g.add(w);
    return w;
  });
  return g;
}

/** A rideable scooter or motorbike (no rider: you are the rider). */
export function makeMoto(kind, color) {
  const g = new THREE.Group();
  const m = new THREE.InstancedMesh(vehicleGeometry(kind + '_solo').body, carMaterial(), 1);
  m.setMatrixAt(0, new THREE.Matrix4());
  m.setColorAt(0, new THREE.Color(color));
  m.castShadow = true;
  g.add(m);
  g.userData.wheels = [];
  return g;
}

/** A helmet for whoever is riding (sits on the head bone). */
export function helmet(color) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.158, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), new THREE.MeshToonMaterial({ color }));
  shell.scale.set(1, 1.02, 1.08);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.162, 14, 8, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.32, Math.PI * 0.22), new THREE.MeshStandardMaterial({ color: '#1d2a3a', roughness: 0.1, metalness: 0.4 }));
  g.add(shell, visor);
  g.position.set(0, 0.13, 0.005);
  return g;
}

/** Static geometry for a docked share bike (frame + wheels merged). */
export function dockedBikeGeometry() {
  const wheels = [P.rear, P.front].map((p) => {
    const w = wheelGeo(true).translate(p.x, p.y, p.z);
    const n = w.attributes.position.count;
    w.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.12), 3));
    return w;
  });
  return mergeGeometries([colored(frameParts(SHARE_COLOR)), ...wheels]);
}

// ---- cyclists in traffic -----------------------------------------------------------------
/**
 * Bike + rider, one geometry. Attributes: color, aTint (1 = takes the jersey
 * colour), aSwing (sign, pivotY, pivotZ, 0) for pedalling legs.
 */
export function cyclistGeometry(skin = '#c99a7a', pants = '#2b3448') {
  const list = [];
  const add = (g, c, tint = 0, swing = [0, 0, 0, 0]) => {
    g = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.attributes.position.count;
    const col = new THREE.Color(c);
    const a = new Float32Array(n * 3);
    const sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      a.set([col.r, col.g, col.b], i * 3);
      sw.set(swing, i * 4);
    }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(n).fill(tint), 1));
    g.setAttribute('aSwing', new THREE.BufferAttribute(sw, 4));
    list.push(g);
  };
  for (const [g, c] of frameParts('#3a3f48')) add(g, c);
  for (const p of [P.rear, P.front]) add(wheelGeo(true).translate(p.x, p.y, p.z), '#1d1f24');
  // rider leaning over the bars
  const hip = V(0, 0.98, -0.18);
  const sh = V(0, 1.42, 0.14);
  add(tube(hip, sh, 0.15).scale(1, 1, 0.75), '#ffffff', 1); // torso (jersey)
  add(new THREE.SphereGeometry(0.105, 10, 8).translate(0, 1.6, 0.26), skin);
  add(new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 0.85, 1.2).translate(0, 1.63, 0.24), '#ffffff', 1); // helmet
  for (const m of [-1, 1]) {
    add(tube(V(m * 0.17, 1.38, 0.12), V(m * 0.22, 1.04, 0.42), 0.04), '#ffffff', 1); // arms
    // legs: thigh + shin swing around the hip (pedalling)
    const knee = V(m * 0.11, 0.66, 0.08);
    const foot = V(m * 0.1, 0.32, -0.04);
    add(tube(V(m * 0.1, 0.98, -0.16), knee, 0.06), pants, 0, [m, 0.98, -0.16, 0]);
    add(tube(knee, foot, 0.05), pants, 0, [m, 0.98, -0.16, 0]);
    add(new THREE.BoxGeometry(0.09, 0.06, 0.2).translate(m * 0.1, 0.3, 0.0), '#1d1f24', 0, [m, 0.98, -0.16, 0]);
  }
  return mergeGeometries(list);
}

export function cyclistMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = worldUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aTint;\nattribute vec4 aSwing;\nattribute vec3 aAnim; // pedal rate, phase, moving')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        if (aSwing.x != 0.0) {
          float ang = sin(uTime * aAnim.x + aAnim.y) * 0.55 * aAnim.z * aSwing.x;
          float yy = transformed.y - aSwing.y; float zz = transformed.z - aSwing.z;
          float cs = cos(ang); float sn = sin(ang);
          transformed.y = aSwing.y + yy * cs - zz * sn;
          transformed.z = aSwing.z + yy * sn + zz * cs;
        }`,
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        #if defined( USE_INSTANCING_COLOR ) && defined( USE_COLOR )
          vColor.rgb = color.rgb * mix(vec3(1.0), instanceColor.rgb, aTint);
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => 'cyclist';
  return mat;
}
