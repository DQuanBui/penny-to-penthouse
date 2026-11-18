// Procedural car (front faces +Z, length 4.3 m, width 1.8 m): a sculpted
// side-profile body with wheel arches, a glass greenhouse with body-colour
// pillars and roof, bumpers, grille, mirrors, rims and lights.
//
// Vertex attributes:
//   color  base colour            aTint  1 = car paint (takes the instance colour)
//   aLight 1 = head/tail light that glows after dark
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldUniforms } from './Buildings.js';

const parts = [];
function add(geo, color, tint = 0, light = 0) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const n = geo.attributes.position.count;
  const c = new THREE.Color(color);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  geo.deleteAttribute('uv');
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal'].includes(k)) geo.deleteAttribute(k);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(n).fill(tint), 1));
  geo.setAttribute('aLight', new THREE.BufferAttribute(new Float32Array(n).fill(light), 1));
  parts.push(geo);
}

/** Extrude a side profile (x = forward, y = up) across the car's width, centred. */
function profile(shape, width, bevel = 0.05) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  g.rotateY(-Math.PI / 2); // profile x -> world z, extrusion -> world -x
  g.translate(width / 2 - bevel, 0, 0);
  return g;
}

let cached = null;
export function carGeometry() {
  if (cached) return cached.clone();
  parts.length = 0;
  const PAINT = '#ffffff';
  // ---- lower body with wheel arches ----
  const s = new THREE.Shape();
  s.moveTo(-2.12, 0.3);
  s.lineTo(-1.74, 0.3);
  s.absarc(-1.35, 0.3, 0.39, Math.PI, 0, true);
  s.lineTo(0.96, 0.3);
  s.absarc(1.35, 0.3, 0.39, Math.PI, 0, true);
  s.lineTo(2.12, 0.3);
  s.lineTo(2.15, 0.6);
  s.quadraticCurveTo(2.12, 0.8, 1.9, 0.84);
  s.lineTo(1.15, 0.95);
  s.lineTo(-1.25, 0.98);
  s.quadraticCurveTo(-2.05, 0.96, -2.12, 0.78);
  s.lineTo(-2.12, 0.3);
  add(profile(s, 1.8, 0.06), PAINT, 1);

  // ---- glass cabin ----
  const g = new THREE.Shape();
  g.moveTo(1.12, 0.94);
  g.quadraticCurveTo(0.7, 1.22, 0.32, 1.4);
  g.lineTo(-0.82, 1.42);
  g.quadraticCurveTo(-1.18, 1.25, -1.36, 0.97);
  g.lineTo(1.12, 0.94);
  add(profile(g, 1.54, 0.03), '#141a22');
  // roof panel
  const r = new THREE.Shape();
  r.moveTo(0.36, 1.38);
  r.lineTo(0.3, 1.44);
  r.lineTo(-0.83, 1.46);
  r.lineTo(-0.8, 1.39);
  r.lineTo(0.36, 1.38);
  add(profile(r, 1.5, 0.02), PAINT, 1);
  // pillars (A, B, C) on both sides
  for (const x of [-0.77, 0.77]) {
    // A-pillar follows the windscreen from the bonnet up to the roof
    const a = new THREE.BoxGeometry(0.06, 0.06, 0.92).rotateX(0.53).translate(x, 1.17, 0.72);
    add(a, PAINT, 1);
    add(new THREE.BoxGeometry(0.06, 0.46, 0.09).translate(x, 1.18, -0.18), PAINT, 1);
    add(new THREE.BoxGeometry(0.06, 0.06, 0.7).rotateX(-0.69).translate(x, 1.19, -1.09), PAINT, 1); // C-pillar
    // mirror
    add(new THREE.BoxGeometry(0.16, 0.09, 0.1).translate(x * 1.2, 1.02, 0.95), PAINT, 1);
  }
  // ---- front and back ----
  add(new THREE.BoxGeometry(1.7, 0.2, 0.12).translate(0, 0.42, 2.16), '#26282d'); // front bumper
  add(new THREE.BoxGeometry(1.7, 0.2, 0.12).translate(0, 0.42, -2.13), '#26282d'); // rear bumper
  add(new THREE.BoxGeometry(0.9, 0.16, 0.05).translate(0, 0.6, 2.16), '#1a1b1f'); // grille
  add(new THREE.BoxGeometry(0.46, 0.12, 0.02).translate(0, 0.44, 2.23), '#f2f2f0'); // plates
  add(new THREE.BoxGeometry(0.46, 0.12, 0.02).translate(0, 0.62, -2.15), '#f2f2f0');
  for (const x of [-0.62, 0.62]) {
    add(new THREE.BoxGeometry(0.36, 0.11, 0.06).translate(x, 0.7, 2.13), '#fff6dc', 0, 1); // headlights
    add(new THREE.BoxGeometry(0.34, 0.1, 0.05).translate(x, 0.78, -2.12), '#d81e1e', 0, 1); // taillights
  }
  // ---- wheels ----
  for (const x of [-0.82, 0.82]) {
    for (const z of [-1.35, 1.35]) {
      add(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16).rotateZ(Math.PI / 2).translate(x, 0.34, z), '#16171a');
      add(new THREE.CylinderGeometry(0.2, 0.2, 0.25, 10).rotateZ(Math.PI / 2).translate(x * 1.01, 0.34, z), '#a9afb7');
    }
  }
  cached = mergeGeometries(parts);
  parts.length = 0;
  return cached.clone();
}

let busCached = null;
/** City bus (front faces +Z, length 11.4 m, width 2.5 m). Livery = instance colour. */
export function busGeometry() {
  if (busCached) return busCached.clone();
  parts.length = 0;
  const PAINT = '#ffffff';
  const L = 5.7;
  // body with wheel arches and a rounded front roof edge
  const s = new THREE.Shape();
  s.moveTo(-L, 0.45);
  s.lineTo(-3.95, 0.45);
  s.absarc(-3.4, 0.45, 0.55, Math.PI, 0, true);
  s.lineTo(3.35, 0.45);
  s.absarc(3.9, 0.45, 0.55, Math.PI, 0, true);
  s.lineTo(L, 0.45);
  s.lineTo(L, 2.75);
  s.quadraticCurveTo(L, 3.05, L - 0.3, 3.05);
  s.lineTo(-L + 0.15, 3.05);
  s.lineTo(-L, 2.9);
  s.lineTo(-L, 0.45);
  add(profile(s, 2.5, 0.05), PAINT, 1);
  // side window bands, a light stripe under them, doors on the right (-x) side
  for (const x of [-1.262, 1.262]) {
    add(new THREE.BoxGeometry(0.02, 1.15, 9.6).translate(x, 2.0, -0.35), '#1a2430');
    add(new THREE.BoxGeometry(0.02, 0.16, 11.0).translate(x, 1.3, 0), '#f2f2ee');
    for (let z = -4.7; z <= 4.3; z += 1.5) add(new THREE.BoxGeometry(0.03, 1.15, 0.06).translate(x * 1.002, 2.0, z), PAINT, 1); // window pillars
  }
  for (const z of [4.75, 0.1]) add(new THREE.BoxGeometry(0.03, 2.2, 1.05).translate(-1.27, 1.6, z), '#25313d');
  // windscreen, rear window, destination signs (lit), headlights and taillights
  add(new THREE.BoxGeometry(2.3, 1.55, 0.03).translate(0, 1.95, L + 0.01), '#1a2430');
  add(new THREE.BoxGeometry(2.0, 0.24, 0.04).translate(0, 2.85, L + 0.01), '#ffb347', 0, 1);
  add(new THREE.BoxGeometry(0.03, 0.22, 1.6).translate(-1.27, 2.78, 3.6), '#ffb347', 0, 1);
  add(new THREE.BoxGeometry(1.9, 0.9, 0.03).translate(0, 2.25, -L - 0.01), '#1a2430');
  add(new THREE.BoxGeometry(2.4, 0.3, 0.14).translate(0, 0.6, L + 0.05), '#2a2c31'); // bumpers
  add(new THREE.BoxGeometry(2.4, 0.3, 0.14).translate(0, 0.6, -L - 0.05), '#2a2c31');
  for (const x of [-0.95, 0.95]) {
    add(new THREE.BoxGeometry(0.34, 0.16, 0.05).translate(x, 0.95, L + 0.03), '#fff6dc', 0, 1);
    add(new THREE.BoxGeometry(0.2, 0.36, 0.05).translate(x, 1.0, -L - 0.03), '#d81e1e', 0, 1);
  }
  add(new THREE.BoxGeometry(1.6, 0.28, 2.6).translate(0, 3.19, -1.5), '#d8dadd'); // roof AC pod
  // mirrors on stalks
  for (const x of [-1, 1]) add(new THREE.BoxGeometry(0.08, 0.38, 0.12).translate(x * 1.45, 2.25, L - 0.1), '#1d1f24');
  // wheels: single at the front, dual at the back
  for (const x of [-1.06, 1.06]) {
    for (const z of [3.9, -3.4]) {
      add(new THREE.CylinderGeometry(0.5, 0.5, 0.32, 16).rotateZ(Math.PI / 2).translate(x, 0.5, z), '#16171a');
      add(new THREE.CylinderGeometry(0.28, 0.28, 0.33, 10).rotateZ(Math.PI / 2).translate(x * 1.01, 0.5, z), '#a9afb7');
    }
  }
  busCached = mergeGeometries(parts);
  parts.length = 0;
  return busCached.clone();
}

/**
 * Material for car geometry. Only paint takes the per-instance colour; lights
 * glow at night. Works for InstancedMesh (use setColorAt for the paint).
 */
export function carMaterial(opts = {}) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.4, ...opts });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = worldUniforms.uNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTint;\nattribute float aLight;\nvarying float vLight;')
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        #if defined( USE_INSTANCING_COLOR ) && defined( USE_COLOR )
          vColor.rgb = color.rgb * mix(vec3(1.0), instanceColor.rgb, aTint);
        #endif
        vLight = aLight;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying float vLight;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vLight * (0.25 + uNight * 2.4);');
  };
  mat.customProgramCacheKey = () => 'car';
  return mat;
}
