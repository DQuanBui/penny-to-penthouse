// The city zoo: a big walled park just beyond the city edge, across the road
// from a little park. Through the gate (with a day ticket from the booths) an
// avenue of trees leads past eleven habitats: giraffes and zebras, elephants,
// lions, tigers, brown bears, hippos, rhinos, monkeys, kangaroos, penguins and
// a flamingo lagoon, plus a café lawn. Animals wander their habitats; visitors
// lean on the walls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { labelTexture, Tex } from './Textures.js';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { roleAppearance } from '../characters/Customization.js';
import { addNeed } from '../sim/Needs.js';
import { hourOf } from '../core/Clock.js';
import { mulberry32, fmtMoney, dampAngle } from '../core/utils.js';
import { h, btn } from '../ui/dom.js';
import { dialog } from '../ui/Menus.js';

export const ZOO_HOURS = [9, 18];

/** Vertex-coloured geometry bag, merged into one mesh. */
class Bag {
  constructor() {
    this.list = [];
  }
  add(geo, color, x = 0, y = 0, z = 0) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    geo.translate(x, y, z);
    const n = geo.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(geo);
  }
  mesh(opts = {}) {
    const m = new THREE.Mesh(mergeGeometries(this.list), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, ...opts }));
    m.castShadow = m.receiveShadow = true;
    return m;
  }
}
const bx = (w, hh, d) => new THREE.BoxGeometry(w, hh, d);
const cy = (r0, r1, hh, s = 12) => new THREE.CylinderGeometry(r0, r1, hh, s);
const sp = (r, sx = 1, sy = 1, sz = 1, s = 12) => new THREE.SphereGeometry(r, s, Math.max(6, Math.round(s * 0.7))).scale(sx, sy, sz);

const ENCLOSURES = [
  { id: 'savanna', u: -64, v: 33, ground: '#cbb26a', label: 'Giraffes & Zebras', icon: '🦒', species: [['giraffe', 2], ['zebra', 3]], fact: 'A giraffe\'s tongue is about 50 cm long — and dark blue, so it does not sunburn.' },
  { id: 'elephants', u: -24, v: 33, ground: '#9a7a55', label: 'Elephants', icon: '🐘', species: [['elephant', 2]], fact: 'Elephants recognise themselves in a mirror and mourn their dead.' },
  { id: 'lions', u: 24, v: 33, ground: '#d6b878', label: 'Lions', icon: '🦁', species: [['lion', 3]], fact: 'A lion\'s roar can be heard 8 km away. They sleep up to 20 hours a day.' },
  { id: 'tigers', u: 64, v: 33, ground: '#8a9a5a', label: 'Tigers', icon: '🐅', species: [['tiger', 2]], fact: 'No two tigers have the same stripes — and the stripes are on their skin too.' },
  { id: 'bears', u: -64, v: 63, ground: '#7a6a4a', label: 'Brown Bears', icon: '🐻', species: [['bear', 2]], fact: 'A brown bear can smell food from more than 30 km away.' },
  { id: 'hippos', u: -24, v: 63, ground: '#8a7a5a', label: 'Hippos', icon: '🦛', species: [['hippo', 2]], fact: 'Hippos cannot really swim. They walk and bounce along the bottom of the river.' },
  { id: 'rhinos', u: 24, v: 63, ground: '#a08a64', label: 'Rhinos', icon: '🦏', species: [['rhino', 2]], fact: 'A rhino\'s horn is made of keratin, the same stuff as your fingernails.' },
  { id: 'monkeys', u: 64, v: 63, ground: '#6a8a4a', label: 'Monkeys', icon: '🐒', species: [['monkey', 5]], fact: 'Some monkeys use stones as tools to crack open nuts.' },
  { id: 'kangaroos', u: -64, v: 93, ground: '#b9a06a', label: 'Kangaroos', icon: '🦘', species: [['kangaroo', 4]], fact: 'Kangaroos cannot walk backwards. One hop can cover eight metres.' },
  { id: 'penguins', u: -24, v: 93, ground: '#e4edf2', label: 'Penguins', icon: '🐧', species: [['penguin', 7]], fact: 'Penguins can drink sea water: a gland above their eyes filters out the salt.' },
  { id: 'pandas', u: -64, v: 123, ground: '#7a9a4a', label: 'Giant Pandas', icon: '🐼', species: [['panda', 2]], fact: 'A giant panda eats up to 38 kg of bamboo a day — for about 14 hours.' },
  { id: 'gorillas', u: -24, v: 123, ground: '#6a7a4a', label: 'Gorillas', icon: '🦍', species: [['gorilla', 3]], fact: 'Gorillas share about 98% of our DNA and can learn sign language.' },
  { id: 'crocodiles', u: 24, v: 123, ground: '#a89a6a', label: 'Crocodiles', icon: '🐊', species: [['crocodile', 3]], fact: 'Crocodiles have been around for over 200 million years — since the dinosaurs.' },
  { id: 'aviary', u: 64, v: 123, ground: '#6f9a4a', label: 'Tropical Aviary', icon: '🦜', species: [['parrot', 10]], fact: 'Some parrots live more than 80 years and can learn hundreds of words.' },
  { id: 'flamingos', u: 64, v: 93, ground: '#9ab27a', label: 'Flamingo Lagoon', icon: '🦩', species: [['flamingo', 7]], fact: 'Flamingos are pink because of the shrimp and algae they eat.' },
];
const EU = 17; // enclosure half-size along the edge
const EV = 11; // and outward
const FU = 89; // fence half-width
const FV0 = 3; // fence: front line (gate) and back line, measured out from the road edge
const FV1 = 141;

// ---- animals: a group with legs on pivots so they can walk ------------------------------
function leg(group, x, y, z, len, r, color) {
  const pivot = new THREE.Object3D();
  pivot.position.set(x, y, z);
  const m = new THREE.Mesh(cy(r, r * 0.8, len, 8).translate(0, -len / 2, 0), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  m.castShadow = true;
  pivot.add(m);
  group.add(pivot);
  return pivot;
}
function part(group, geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  m.position.set(x, y, z);
  m.castShadow = true;
  group.add(m);
  return m;
}

const SPECIES = {
  giraffe: { eyes: [0.12, 4.28, 1.62], speed: 0.9, scale: 1, build(g) {
    const tan = '#d9a750';
    part(g, sp(1, 0.55, 0.55, 0.95), tan, 0, 2.15, 0);
    const neck = part(g, cy(0.16, 0.24, 2.2, 10), tan, 0, 3.15, 0.75);
    neck.rotation.x = 0.42;
    part(g, sp(1, 0.17, 0.2, 0.36), tan, 0, 4.2, 1.35);
    for (const s of [-1, 1]) part(g, cy(0.03, 0.03, 0.22, 6), '#5a3a1e', s * 0.08, 4.42, 1.25);
    // patches
    for (let i = 0; i < 26; i++) {
      const a = (i * 2.4) % 6.28;
      part(g, sp(0.13, 1, 1, 0.3), '#8a5a2a', Math.cos(a) * 0.5, 2.15 + Math.sin(a * 1.7) * 0.3, -0.7 + (i % 8) * 0.2).lookAt(0, 2.15, 0);
    }
    return { legs: [[-0.28, 1.75, 0.6], [0.28, 1.75, 0.6], [-0.28, 1.75, -0.6], [0.28, 1.75, -0.6]].map(([x, y, z]) => leg(g, x, y, z, 1.75, 0.07, tan)) };
  } },
  zebra: { eyes: [0.1, 1.9, 1.34], speed: 1.2, scale: 1, build(g) {
    // striped body: alternating slices
    for (let i = 0; i < 9; i++) part(g, cy(0.36, 0.36, 0.15, 12).rotateX(Math.PI / 2), i % 2 ? '#1d1d1f' : '#f4f2ec', 0, 1.15, -0.6 + i * 0.15);
    const neck = part(g, cy(0.14, 0.2, 0.75, 10), '#f4f2ec', 0, 1.55, 0.75);
    neck.rotation.x = 0.6;
    part(g, bx(0.06, 0.5, 0.25), '#1d1d1f', 0, 1.65, 0.7).rotation.x = 0.6;
    part(g, bx(0.2, 0.22, 0.55), '#f4f2ec', 0, 1.82, 1.12).rotation.x = 0.45;
    part(g, bx(0.21, 0.12, 0.16), '#1d1d1f', 0, 1.72, 1.36);
    return { legs: [[-0.18, 0.9, 0.5], [0.18, 0.9, 0.5], [-0.18, 0.9, -0.5], [0.18, 0.9, -0.5]].map(([x, y, z], k) => leg(g, x, y, z, 0.9, 0.06, k % 2 ? '#f4f2ec' : '#2b2b2e')) };
  } },
  elephant: { eyes: [0.36, 2.62, 1.86], speed: 0.6, scale: 1, build(g) {
    const grey = '#8d8e93';
    part(g, sp(1, 1.0, 1.0, 1.45), grey, 0, 2.0, 0);
    part(g, sp(1, 0.62, 0.66, 0.6), grey, 0, 2.45, 1.45);
    for (const s of [-1, 1]) part(g, sp(1, 0.08, 0.62, 0.5), shade(grey, 0.9), s * 0.62, 2.45, 1.2);
    // trunk: stacked, curling down
    for (let i = 0; i < 6; i++) part(g, cy(0.15 - i * 0.015, 0.16 - i * 0.015, 0.3, 8), grey, 0, 2.15 - i * 0.26, 1.95 + Math.sin(i * 0.35) * 0.18);
    for (const s of [-1, 1]) part(g, new THREE.ConeGeometry(0.06, 0.55, 8).rotateX(1.9), '#f4f0e2', s * 0.25, 1.95, 1.95);
    return { legs: [[-0.55, 1.4, 0.8], [0.55, 1.4, 0.8], [-0.55, 1.4, -0.8], [0.55, 1.4, -0.8]].map(([x, y, z]) => leg(g, x, y, z, 1.4, 0.28, grey)) };
  } },
  lion: { eyes: [0.12, 1.3, 1.16], speed: 0.8, scale: 1, build(g, k) {
    const tan = '#c99a52';
    part(g, sp(1, 0.38, 0.38, 0.85), tan, 0, 0.95, 0);
    part(g, sp(0.3), tan, 0, 1.2, 0.9);
    if (k === 0) part(g, sp(0.48, 1, 1, 0.8), '#7a4a22', 0, 1.2, 0.78); // mane
    part(g, bx(0.18, 0.14, 0.2), shade(tan, 1.1), 0, 1.12, 1.15);
    part(g, cy(0.04, 0.03, 0.9, 6), tan, 0, 0.95, -1.15).rotation.x = -0.9;
    return { legs: [[-0.2, 0.7, 0.5], [0.2, 0.7, 0.5], [-0.2, 0.7, -0.5], [0.2, 0.7, -0.5]].map(([x, y, z]) => leg(g, x, y, z, 0.7, 0.09, tan)) };
  } },
  penguin: { eyes: [0.06, 0.87, 0.13], speed: 0.45, scale: 1, waddle: true, build(g) {
    part(g, sp(1, 0.22, 0.36, 0.22), '#1d1f24', 0, 0.42, 0);
    part(g, sp(1, 0.17, 0.3, 0.12), '#f6f6f2', 0, 0.4, 0.11);
    part(g, sp(0.13), '#1d1f24', 0, 0.82, 0.02);
    part(g, new THREE.ConeGeometry(0.035, 0.14, 8).rotateX(Math.PI / 2), '#e8a33a', 0, 0.8, 0.18);
    for (const s of [-1, 1]) part(g, bx(0.04, 0.3, 0.14), '#1d1f24', s * 0.22, 0.45, 0).rotation.z = s * 0.25;
    return { legs: [[-0.08, 0.1, 0.04], [0.08, 0.1, 0.04]].map(([x, y, z]) => leg(g, x, y, z, 0.1, 0.05, '#e8a33a')) };
  } },
  flamingo: { eyes: [0.05, 1.81, 0.37], speed: 0.3, scale: 1, build(g) {
    const pink = '#f08aa8';
    part(g, sp(1, 0.2, 0.18, 0.34), pink, 0, 1.05, 0);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.1, 0.25), new THREE.Vector3(0, 1.45, 0.38), new THREE.Vector3(0, 1.6, 0.18), new THREE.Vector3(0, 1.75, 0.3)]);
    part(g, new THREE.TubeGeometry(curve, 12, 0.035, 6), pink, 0, 0, 0);
    part(g, sp(0.07), pink, 0, 1.78, 0.33);
    part(g, new THREE.ConeGeometry(0.03, 0.14, 6).rotateX(2.2), '#1d1f24', 0, 1.72, 0.42);
    return { legs: [leg(g, 0, 0.95, 0, 0.95, 0.018, '#e86a8a')] };
  } },
  tiger: { eyes: [0.11, 1.22, 1.18], speed: 0.9, scale: 1, build(g) {
    const org = '#e0852a';
    part(g, sp(1, 0.36, 0.36, 0.9), org, 0, 0.92, 0);
    part(g, sp(0.29), org, 0, 1.12, 0.92);
    part(g, bx(0.16, 0.12, 0.18), '#f4ead8', 0, 1.04, 1.16);
    for (const s of [-1, 1]) part(g, sp(0.07), org, s * 0.17, 1.38, 0.9);
    // black stripes wrapped over the back
    for (let i = 0; i < 7; i++) part(g, new THREE.TorusGeometry(0.34, 0.035, 4, 12, Math.PI).rotateY(Math.PI / 2), '#1d1d1f', 0, 0.95, -0.6 + i * 0.19);
    part(g, cy(0.04, 0.03, 0.95, 6), org, 0, 0.95, -1.2).rotation.x = -0.9;
    return { legs: [[-0.2, 0.68, 0.5], [0.2, 0.68, 0.5], [-0.2, 0.68, -0.5], [0.2, 0.68, -0.5]].map(([x, y, z]) => leg(g, x, y, z, 0.68, 0.09, org)) };
  } },
  bear: { eyes: [0.13, 1.5, 1.34], speed: 0.55, scale: 1, build(g) {
    const br = '#6b4a2e';
    part(g, sp(1, 0.6, 0.62, 1.0), br, 0, 1.05, 0);
    part(g, sp(1, 0.5, 0.5, 0.45), shade(br, 1.05), 0, 1.35, 0.55);
    part(g, sp(0.34), br, 0, 1.4, 1.05);
    part(g, sp(1, 0.15, 0.13, 0.18), '#4a3220', 0, 1.3, 1.36);
    for (const s of [-1, 1]) part(g, sp(0.1), br, s * 0.22, 1.7, 0.98);
    return { legs: [[-0.32, 0.7, 0.5], [0.32, 0.7, 0.5], [-0.32, 0.7, -0.5], [0.32, 0.7, -0.5]].map(([x, y, z]) => leg(g, x, y, z, 0.7, 0.16, br)) };
  } },
  hippo: { eyes: [0.25, 1.27, 1.42], speed: 0.4, scale: 1, build(g) {
    const gr = '#8a7a88';
    part(g, sp(1, 0.85, 0.65, 1.35), gr, 0, 0.85, 0);
    part(g, bx(0.9, 0.6, 0.85), gr, 0, 0.92, 1.45);
    part(g, bx(0.95, 0.35, 0.5), shade(gr, 1.1), 0, 0.72, 1.82);
    for (const s of [-1, 1]) {
      part(g, sp(0.08), '#2a2420', s * 0.25, 1.26, 1.35);
      part(g, sp(0.07), gr, s * 0.3, 1.3, 1.2);
    }
    return { legs: [[-0.45, 0.45, 0.7], [0.45, 0.45, 0.7], [-0.45, 0.45, -0.7], [0.45, 0.45, -0.7]].map(([x, y, z]) => leg(g, x, y, z, 0.45, 0.2, gr)) };
  } },
  rhino: { eyes: [0.26, 1.16, 1.62], speed: 0.5, scale: 1, build(g) {
    const gr = '#8a8a86';
    part(g, sp(1, 0.68, 0.7, 1.25), gr, 0, 1.15, 0);
    part(g, bx(0.55, 0.55, 0.9), gr, 0, 1.05, 1.45);
    part(g, new THREE.ConeGeometry(0.12, 0.5, 8), '#d8d0bc', 0, 1.45, 1.8).rotation.x = 0.4;
    part(g, new THREE.ConeGeometry(0.08, 0.25, 8), '#d8d0bc', 0, 1.42, 1.5);
    for (const s of [-1, 1]) part(g, new THREE.ConeGeometry(0.07, 0.2, 6), gr, s * 0.2, 1.42, 1.1);
    return { legs: [[-0.38, 0.65, 0.65], [0.38, 0.65, 0.65], [-0.38, 0.65, -0.65], [0.38, 0.65, -0.65]].map(([x, y, z]) => leg(g, x, y, z, 0.65, 0.17, gr)) };
  } },
  monkey: { eyes: [0.05, 0.96, 0.27], speed: 1.1, scale: 1, build(g) {
    const br = '#7a5232';
    part(g, sp(1, 0.2, 0.26, 0.24), br, 0, 0.62, 0);
    part(g, sp(0.17), br, 0, 0.92, 0.12);
    part(g, sp(1, 0.12, 0.1, 0.08), '#d9b48a', 0, 0.9, 0.24);
    for (const s of [-1, 1]) part(g, sp(0.05), '#d9b48a', s * 0.16, 0.95, 0.1);
    const tail = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.55, -0.2), new THREE.Vector3(0, 0.5, -0.55), new THREE.Vector3(0, 0.8, -0.75), new THREE.Vector3(0, 1.0, -0.6)]);
    part(g, new THREE.TubeGeometry(tail, 10, 0.025, 5), br, 0, 0, 0);
    return { legs: [[-0.1, 0.42, 0.08], [0.1, 0.42, 0.08], [-0.1, 0.42, -0.08], [0.1, 0.42, -0.08]].map(([x, y, z]) => leg(g, x, y, z, 0.42, 0.04, br)) };
  } },
  kangaroo: { eyes: [0.07, 1.6, 0.36], speed: 1.4, scale: 1, hop: true, build(g) {
    const tan = '#b88a5a';
    const body = part(g, sp(1, 0.28, 0.45, 0.32), tan, 0, 1.0, 0);
    body.rotation.x = 0.35;
    part(g, sp(1, 0.13, 0.16, 0.22), tan, 0, 1.55, 0.18);
    for (const s of [-1, 1]) part(g, new THREE.ConeGeometry(0.05, 0.2, 6), tan, s * 0.07, 1.74, 0.12);
    part(g, cy(0.03, 0.1, 0.9, 6), tan, 0, 0.55, -0.45).rotation.x = -1.0;
    for (const s of [-1, 1]) part(g, bx(0.09, 0.08, 0.38), shade(tan, 0.9), s * 0.13, 0.05, 0.12);
    return { legs: [[-0.13, 0.7, 0], [0.13, 0.7, 0]].map(([x, y, z]) => leg(g, x, y, z, 0.62, 0.08, tan)) };
  } },
  panda: { speed: 0.45, scale: 1, eyes: [0.12, 1.45, 1.3], build(g) {
    const w = '#f4f2ec';
    const k = '#1d1d20';
    part(g, sp(1, 0.58, 0.6, 0.95), w, 0, 1.0, 0);
    part(g, sp(1, 0.6, 0.42, 0.5), k, 0, 1.12, 0.3); // the black shoulder band
    part(g, sp(0.34), w, 0, 1.38, 1.0);
    for (const s of [-1, 1]) {
      part(g, sp(0.1), k, s * 0.22, 1.68, 0.95);
      part(g, sp(1, 0.08, 0.1, 0.05), k, s * 0.12, 1.43, 1.28); // eye patches
    }
    part(g, sp(1, 0.12, 0.1, 0.12), w, 0, 1.28, 1.3);
    part(g, sp(0.04), k, 0, 1.31, 1.42);
    return { legs: [[-0.3, 0.68, 0.5], [0.3, 0.68, 0.5], [-0.3, 0.68, -0.5], [0.3, 0.68, -0.5]].map(([x, y, z]) => leg(g, x, y, z, 0.68, 0.16, k)) };
  } },
  gorilla: { speed: 0.5, scale: 1, eyes: [0.09, 1.55, 0.88], build(g) {
    const c = '#2e2c2c';
    const body = part(g, sp(1, 0.5, 0.62, 0.55), c, 0, 1.15, 0.05);
    body.rotation.x = 0.45;
    part(g, sp(1, 0.42, 0.36, 0.4), '#5a5452', 0, 1.15, 0.45); // silver chest
    part(g, sp(0.25), c, 0, 1.55, 0.68);
    part(g, sp(1, 0.17, 0.12, 0.1), '#4a4442', 0, 1.47, 0.86);
    return { legs: [[-0.42, 1.25, 0.5], [0.42, 1.25, 0.5], [-0.22, 0.62, -0.28], [0.22, 0.62, -0.28]].map(([x, y, z], i) => leg(g, x, y, z, i < 2 ? 1.25 : 0.62, i < 2 ? 0.13 : 0.15, c)) };
  } },
  crocodile: { speed: 0.3, scale: 1, eyes: [0.12, 0.42, 1.25], build(g) {
    const c = '#4a6a3a';
    part(g, sp(1, 0.38, 0.2, 1.1), c, 0, 0.3, 0);
    part(g, bx(0.32, 0.16, 0.9), c, 0, 0.28, 1.4);
    part(g, bx(0.28, 0.06, 0.85), '#e8e0c8', 0, 0.2, 1.42);
    part(g, new THREE.ConeGeometry(0.22, 1.8, 6).rotateX(-Math.PI / 2).scale(1, 0.55, 1), c, 0, 0.3, -1.85);
    for (let i = 0; i < 8; i++) part(g, new THREE.ConeGeometry(0.04, 0.1, 4), shade(c, 0.8), 0, 0.5, -0.8 + i * 0.25);
    return { legs: [[-0.32, 0.2, 0.55], [0.32, 0.2, 0.55], [-0.32, 0.2, -0.55], [0.32, 0.2, -0.55]].map(([x, y, z]) => leg(g, x, y, z, 0.2, 0.08, c)) };
  } },
  parrot: { speed: 0, scale: 1, perch: true, eyes: [0.035, 0.32, 0.08], build(g, k) {
    const c = ['#d81e2e', '#2f7fd8', '#3fbf3a', '#f2c230'][k % 4];
    part(g, sp(1, 0.09, 0.14, 0.09), c, 0, 0.22, 0);
    part(g, sp(0.07), c, 0, 0.36, 0.03);
    part(g, new THREE.ConeGeometry(0.025, 0.06, 6).rotateX(2.4), '#f2e8c8', 0, 0.33, 0.1);
    for (const s of [-1, 1]) part(g, sp(1, 0.03, 0.11, 0.07), shade(c, 0.75), s * 0.08, 0.22, -0.01);
    part(g, bx(0.05, 0.22, 0.02), shade(c, 0.85), 0, 0.06, -0.08).rotation.x = 0.3;
    return { legs: [] };
  } },
};
function shade(hex, f) {
  return '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
}

/**
 * Build the zoo beyond the city edge. spec = { side, uc } — the edge it sits
 * on and its centre along that edge. u runs along the edge, v outward from
 * the road (0 at the edge of the outermost road).
 */
export function zooAt(ctx, spec) {
  const { half } = ctx;
  const [ox, oz] = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[spec.side];
  return (u, v) => (ox ? [ox * (half + v), spec.uc + u] : [spec.uc + u, oz * (half + v)]);
}

export function buildZoo(ctx, spec) {
  const { group, colliders, K, places, rng } = ctx;
  const Y = K.CURB;
  const at = zooAt(ctx, spec);
  const name = ctx.cfg.zoo || `${ctx.cfg.name} Zoo`;
  const bag = new Bag();
  // a flat piece of ground (u0..u1, v0..v1) at height y
  const pad = (u0, v0, u1, v1, color, y) => {
    const [x0, z0] = at(u0, v0);
    const [x1, z1] = at(u1, v1);
    bag.add(bx(Math.abs(x1 - x0), 0.04, Math.abs(z1 - z0)), color, (x0 + x1) / 2, y, (z0 + z1) / 2);
  };
  const solid = (u0, v0, u1, v1, top = 1.4) => {
    const [x0, z0] = at(u0, v0);
    const [x1, z1] = at(u1, v1);
    colliders.add(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), Y + top);
  };
  const put = (geo, color, u, v, y = 0) => {
    const [x, z] = at(u, v);
    bag.add(geo, color, x, Y + y, z);
  };
  // lawns all around, paving inside the fence
  const grass = new THREE.MeshStandardMaterial({ map: Tex.grass(), roughness: 1 });
  grass.map = grass.map.clone();
  grass.map.wrapS = grass.map.wrapT = THREE.RepeatWrapping;
  grass.map.repeat.set(40, 30);
  grass.map.needsUpdate = true;
  grass.userData.ownMap = true;
  {
    const [x0, z0] = at(-108, -0.5);
    const [x1, z1] = at(108, 150);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0)).rotateX(-Math.PI / 2), grass);
    m.position.set((x0 + x1) / 2, Y - 0.005, (z0 + z1) / 2);
    m.receiveShadow = true;
    group.add(m);
  }
  pad(-FU, 0, FU, FV1, '#cfc6b4', Y + 0.01);
  for (const e of ENCLOSURES) {
    const [ax, az] = at(e.u - EU, e.v - EV);
    const [bx2, bz] = at(e.u + EU, e.v + EV);
    e.rect = [Math.min(ax, bx2), Math.min(az, bz), Math.max(ax, bx2), Math.max(az, bz)];
    pad(e.u - EU, e.v - EV, e.u + EU, e.v + EV, e.ground, Y + 0.04);
    // a low stone wall with a rail all the way round
    for (const [u0, v0, u1, v1] of [[e.u - EU, e.v - EV, e.u + EU, e.v - EV], [e.u - EU, e.v + EV, e.u + EU, e.v + EV], [e.u - EU, e.v - EV, e.u - EU, e.v + EV], [e.u + EU, e.v - EV, e.u + EU, e.v + EV]]) {
      const [x0, z0] = at(u0, v0);
      const [x1, z1] = at(u1, v1);
      const w = Math.max(0.35, Math.abs(x1 - x0));
      const d = Math.max(0.35, Math.abs(z1 - z0));
      bag.add(bx(w, 0.9, d), '#a39a8a', (x0 + x1) / 2, Y + 0.45, (z0 + z1) / 2);
      bag.add(bx(Math.max(0.06, w - 0.29), 0.06, Math.max(0.06, d - 0.29)), '#4a4f58', (x0 + x1) / 2, Y + 1.35, (z0 + z1) / 2);
      const len = Math.max(w, d);
      for (let t = 0; t <= len; t += 2.5) {
        const k = t / len;
        bag.add(bx(0.06, 0.5, 0.06), '#4a4f58', x0 + (x1 - x0) * k, Y + 1.12, z0 + (z1 - z0) * k);
      }
      colliders.add(Math.min(x0, x1) - 0.2, Math.min(z0, z1) - 0.2, Math.max(x0, x1) + 0.2, Math.max(z0, z1) + 0.2, Y + 1.4);
    }
    // scenery for each habitat
    const tree = (du, dv, s = 1) => {
      put(cy(0.18 * s, 0.25 * s, 3.2 * s, 8).translate(0, 1.6 * s, 0), '#6b4a2a', e.u + du, e.v + dv);
      put(sp(2.2 * s, 1, 0.65, 1).translate(0, 3.4 * s, 0), '#5a8a3a', e.u + du, e.v + dv);
    };
    const rock = (du, dv, r, c = '#8a8072') => put(new THREE.DodecahedronGeometry(r, 0).scale(1.3, 0.75, 1).translate(0, r * 0.45, 0), c, e.u + du, e.v + dv);
    const pool = (du, dv, w, d, c = '#4f8fb0') => pad(e.u + du - w / 2, e.v + dv - d / 2, e.u + du + w / 2, e.v + dv + d / 2, c, Y + 0.07);
    const id = e.id;
    if (id === 'savanna') [tree(-9, -4), tree(8, 5, 1.2), rock(-3, 6, 1.2)];
    else if (id === 'elephants') [pool(7, 4, 9, 6), rock(-9, -5, 1.6), rock(-11, 2, 1.1)];
    else if (id === 'lions') [rock(5, -3, 2.4, '#b59a72'), rock(-6, 5, 1.6, '#b59a72'), tree(-10, -5)];
    else if (id === 'tigers') [pool(-7, 5, 8, 5), tree(8, -4, 1.1), tree(10, 6), rock(0, -6, 1.5)];
    else if (id === 'bears') [pool(6, 5, 9, 5), rock(-6, -4, 2.2), rock(-10, 4, 1.5), tree(10, -6)];
    else if (id === 'hippos') [pool(2, 2, 22, 13, '#4f7f90'), rock(-12, -7, 1.1)];
    else if (id === 'rhinos') [pad(e.u - 6, e.v - 2, e.u + 4, e.v + 6, '#6a5238', Y + 0.06), tree(10, -6), rock(-10, -6, 1.3)];
    else if (id === 'monkeys') {
      tree(-9, -5, 1.3);
      tree(9, 5, 1.2);
      // a climbing frame of poles and ropes
      for (const [du, dv] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) put(cy(0.12, 0.12, 5, 8).translate(0, 2.5, 0), '#7a5a3c', e.u + du, e.v + dv);
      put(bx(6.4, 0.2, 0.2).translate(0, 4.6, 0), '#7a5a3c', e.u, e.v - 3);
      put(bx(6.4, 0.2, 0.2).translate(0, 4.6, 0), '#7a5a3c', e.u, e.v + 3);
      put(bx(5.8, 0.15, 5.8).translate(0, 2.6, 0), '#8a6a4a', e.u, e.v);
    } else if (id === 'kangaroos') [tree(-10, -4), tree(9, 6), rock(4, -6, 1)];
    else if (id === 'penguins') [pool(3, 2, 14, 10, '#3f9fd0'), rock(-10, -5, 1.3, '#f2f6f8'), rock(-9, 5, 1.0, '#f2f6f8')];
    else if (id === 'flamingos') [pool(0, 1, 24, 14, '#5fb0c8'), tree(-13, -7, 0.9)];
    else if (id === 'pandas') {
      // bamboo groves and a wooden platform
      for (const [du, dv] of [[-10, -5], [-12, 4], [9, -6], [11, 5]]) for (let i = 0; i < 7; i++) put(cy(0.06, 0.07, 3.4 + (i % 3) * 0.6, 6).translate((i % 3) * 0.35 - 0.35, 1.8, Math.floor(i / 3) * 0.35), '#7aa83a', e.u + du, e.v + dv);
      put(bx(5, 0.3, 4).translate(0, 0.9, 0), '#8a6a4a', e.u, e.v);
      for (const [x, z2] of [[-2.2, -1.7], [2.2, -1.7], [-2.2, 1.7], [2.2, 1.7]]) put(cy(0.1, 0.1, 0.9, 6).translate(x, 0.45, z2), '#6b4a2a', e.u, e.v);
    } else if (id === 'gorillas') [tree(-10, -5, 1.3), tree(10, 4, 1.2), rock(2, -5, 1.8), rock(-4, 5, 1.3), put(bx(6, 0.25, 0.25).translate(0, 3.2, 0), '#7a5a3c', e.u + 6, e.v - 2)];
    else if (id === 'crocodiles') [pool(3, 1, 22, 14, '#4f7a5a'), pad(e.u - 15, e.v - 9, e.u - 7, e.v + 9, '#c8b07a', Y + 0.06), rock(-12, 0, 1.0)];
    else if (id === 'aviary') {
      // a net dome over the habitat, with branching perches
      for (const [du, dv] of [[-8, -4], [0, 3], [8, -3], [-4, 6]]) {
        put(cy(0.12, 0.18, 4.5, 6).translate(0, 2.25, 0), '#6b4a2a', e.u + du, e.v + dv);
        put(cy(0.05, 0.05, 3, 5).rotateZ(Math.PI / 2).translate(0, 3.6, 0), '#6b4a2a', e.u + du, e.v + dv);
        put(cy(0.05, 0.05, 2.4, 5).rotateX(Math.PI / 2).translate(0, 2.7, 0), '#6b4a2a', e.u + du, e.v + dv);
        put(sp(1.5, 1, 0.6, 1).translate(0, 4.6, 0), '#4f8a3f', e.u + du, e.v + dv);
      }
      const [dx, dz] = at(e.u, e.v);
      const net = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2a3a2a', wireframe: true, transparent: true, opacity: 0.55 }));
      net.scale.set(EU * 1.15, 7.5, EV * 1.35);
      net.position.set(dx, Y, dz);
      group.add(net);
      e.perches = [[-8, -4], [0, 3], [8, -3], [-4, 6]].flatMap(([du, dv]) => [-1.3, 0, 1.3].map((o) => at(e.u + du + o, e.v + dv)));
    }
    // the sign on the path side (toward the gate)
    const [sgx, sgz] = at(e.u + 6, e.v - EV - 1.4);
    bag.add(bx(0.08, 1.2, 0.08), '#3a3f48', sgx, Y + 0.6, sgz);
    const tex = labelTexture(e.label, { icon: e.icon, bg: '#2f5a3a', accent: '#e9c04c' });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
    sign.material.userData.ownMap = true;
    sign.position.set(sgx, Y + 1.4, sgz);
    sign.rotation.y = Math.atan2(sgx - at(e.u + 6, e.v - EV - 3)[0], sgz - at(e.u + 6, e.v - EV - 3)[1]) + Math.PI;
    group.add(sign);
    const [vx, vz] = at(e.u, e.v - EV - 1.6);
    e.sign = { x: vx, z: vz };
    // where visitors stand to look in
    e.views = [-12, -4, 4, 12].map((du) => at(e.u + du, e.v - EV - 1.1));
  }
  // the café and picnic lawn (the empty slot), with the snack kiosk
  pad(7, 82, 41, 104, '#6f9f4a', Y + 0.04);
  put(bx(3, 2.4, 2).translate(0, 1.2, 0), '#f4f1ea', 24, 86);
  put(new THREE.ConeGeometry(2.6, 0.9, 8).translate(0, 3.0, 0), '#e85c8a', 24, 86);
  solid(22.5, 85, 25.5, 87, 2.5);
  for (const [du, dv] of [[16, 92], [24, 96], [32, 92], [20, 100], [30, 100]]) {
    put(bx(1.9, 0.07, 0.8).translate(0, 0.75, 0), '#8a6a4a', du, dv);
    for (const s of [-1, 1]) put(bx(1.9, 0.06, 0.3).translate(0, 0.45, s * 0.65), '#7a5a3c', du, dv);
    put(cy(0.05, 0.05, 2.4, 6).translate(0, 1.2, 0), '#b9bdc3', du, dv);
    put(new THREE.ConeGeometry(1.4, 0.5, 8).translate(0, 2.55, 0), ['#e84a4a', '#2f6db5', '#f2b33d'][Math.floor(rng() * 3)], du, dv);
    solid(du - 1, dv - 0.8, du + 1, dv + 0.8, 0.8);
  }
  // planters with trees down the main avenue and benches facing the enclosures
  for (let v = 22; v < 108; v += 14) {
    for (const s of [-1, 1]) {
      put(bx(1.6, 0.5, 1.6).translate(0, 0.25, 0), '#8a8072', s * 5, v);
      put(sp(1.5, 1, 0.9, 1).translate(0, 2.4, 0), '#4f8a3f', s * 5, v);
      put(cy(0.12, 0.16, 1.6, 6).translate(0, 1.3, 0), '#6b4a2a', s * 5, v);
      solid(s * 5 - 0.8, v - 0.8, s * 5 + 0.8, v + 0.8, 1.2);
    }
  }
  // outer iron fence, the gate in the middle of the front
  const fence = (u0, v0, u1, v1) => {
    const [x0, z0] = at(u0, v0);
    const [x1, z1] = at(u1, v1);
    const len = Math.hypot(x1 - x0, z1 - z0);
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    bag.add(bx(along ? len : 0.06, 0.06, along ? 0.06 : len), '#24382c', (x0 + x1) / 2, Y + 2.4, (z0 + z1) / 2);
    bag.add(bx(along ? len : 0.06, 0.06, along ? 0.06 : len), '#24382c', (x0 + x1) / 2, Y + 0.25, (z0 + z1) / 2);
    for (let t = 0; t <= len; t += 0.5) {
      const k = t / len;
      bag.add(bx(0.04, 2.5, 0.04), '#24382c', x0 + (x1 - x0) * k, Y + 1.25, z0 + (z1 - z0) * k);
    }
    colliders.add(Math.min(x0, x1) - 0.1, Math.min(z0, z1) - 0.1, Math.max(x0, x1) + 0.1, Math.max(z0, z1) + 0.1, Y + 2.6);
  };
  fence(-FU, FV0, -3, FV0);
  fence(3, FV0, FU, FV0);
  fence(-FU, FV0, -FU, FV1);
  fence(FU, FV0, FU, FV1);
  fence(-FU, FV1, FU, FV1);
  // tall hedges inside the fence: you cannot see in for free
  for (const [u0, v0, u1, v1] of [[-FU + 0.8, FV0 + 0.8, -8, FV0 + 1.8], [8, FV0 + 0.8, FU - 0.8, FV0 + 1.8]]) {
    const [x0, z0] = at(u0, v0);
    const [x1, z1] = at(u1, v1);
    bag.add(bx(Math.abs(x1 - x0), 2.8, Math.abs(z1 - z0)), '#3f6f34', (x0 + x1) / 2, Y + 1.4, (z0 + z1) / 2);
    colliders.add(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), Y + 2.8);
  }
  // the entrance arch over the gate
  for (const s of [-1, 1]) {
    put(bx(0.8, 5.2, 0.8).translate(0, 2.6, 0), '#7a5a3c', s * 3.4, FV0);
    solid(s * 3.4 - 0.4, FV0 - 0.4, s * 3.4 + 0.4, FV0 + 0.4, 5.2);
  }
  put(bx(7.8, 1.0, 0.6).translate(0, 5.5, 0), '#2f5a3a', 0, FV0);
  const archTex = labelTexture(name, { icon: '🦁', bg: '#2f5a3a', accent: '#e9c04c' });
  const [gx, gz] = at(0, FV0);
  const [ox2, oz2] = at(0, FV0 - 1);
  const face = Math.atan2(ox2 - gx, oz2 - gz);
  for (const s of [0, Math.PI]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 0.9), new THREE.MeshBasicMaterial({ map: archTex, toneMapped: false }));
    m.material.userData.ownMap = s === 0;
    m.position.set(gx + Math.sin(face + s) * 0.32, Y + 5.5, gz + Math.cos(face + s) * 0.32);
    m.rotation.y = face + s;
    group.add(m);
  }
  // ticket booths outside the gate
  for (const s of [-1, 1]) {
    put(bx(2.2, 2.5, 1.4).translate(0, 1.25, 0), '#e9e2d0', s * 7, 1.3);
    put(bx(2.5, 0.16, 1.7).translate(0, 2.58, 0), '#2f5a3a', s * 7, 1.3);
    solid(s * 7 - 1.1, 0.6, s * 7 + 1.1, 2.0, 2.5);
  }
  group.add(bag.mesh());

  // the zoo is a walled park: free to walk in through the gate with a ticket
  const [c0x, c0z] = at(-FU - 2, -0.5);
  const [c1x, c1z] = at(FU + 2, FV1 + 2);
  colliders.corridors = [...(colliders.corridors || []), { minX: Math.min(c0x, c1x), maxX: Math.max(c0x, c1x), minZ: Math.min(c0z, c1z), maxZ: Math.max(c0z, c1z) }];
  const [px, pz] = at(7, -0.2);
  const [dx, dz] = at(0, FV0);
  const [nx, nz] = [Math.sign(ox2 - gx), Math.sign(oz2 - gz)];
  const place = { id: 'zoo', type: 'zoo', name, district: spec.district, icon: '🦁', color: '#4f8a3a', label: 'Zoo', outdoor: true, nx, nz, doorX: dx, doorZ: dz, x: px, z: pz };
  places.push(place);
  const [kx, kz] = at(24, 84);
  const [cx, cz] = at(0, 57);
  const [fx0, fz0] = at(-FU, FV0);
  const [fx1, fz1] = at(FU, FV1);
  const [ox, oz] = at(0, FV0 - 1.6);
  const [gox, goz] = at(4.4, FV0 + 1.4);
  const [glx, glz] = at(4.4, FV0 - 2);
  ctx.zoo = {
    name, cx, cz, place, enclosures: ENCLOSURES.map((e) => ({ ...e })), kiosk: { x: kx, z: kz },
    rect: [Math.min(fx0, fx1), Math.min(fz0, fz1), Math.max(fx0, fx1), Math.max(fz0, fz1)], outside: { x: ox, z: oz },
    gate: { x: gox, z: goz, ry: Math.atan2(glx - gox, glz - goz) },
  };
  return ctx.zoo;
}

/** Animals, visitors, the ticket and things to do inside the zoo. */
// one shared material for every animal body, and one per leg colour
const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();
const ANIMAL_MAT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
const INK = new THREE.MeshBasicMaterial({ color: '#1d1418', side: THREE.BackSide });
INK.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3( position ) + normal * 0.022;');
};
INK.customProgramCacheKey = () => 'animal-ink';
const LEG_MATS = new Map();
/** Merge an animal's body parts into a single mesh (legs stay on their pivots, for walking). */
function mergeAnimal(g) {
  const geos = [];
  for (const o of [...g.children]) {
    if (!o.isMesh) {
      // a leg pivot: share materials by colour
      for (const m of o.children) {
        if (!m.isMesh) continue;
        const hex = m.material.color.getHex();
        if (!LEG_MATS.has(hex)) LEG_MATS.set(hex, new THREE.MeshToonMaterial({ color: hex, gradientMap: ramp }));
        m.material.dispose();
        m.material = LEG_MATS.get(hex);
      }
      continue;
    }
    o.updateMatrix();
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.applyMatrix4(o.matrix);
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    const c = o.material.color;
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geos.push(geo);
    g.remove(o);
    o.geometry.dispose();
    o.material.dispose();
  }
  if (!geos.length) return;
  const body = new THREE.Mesh(mergeGeometries(geos), ANIMAL_MAT);
  body.castShadow = true;
  g.add(body);
  body.add(new THREE.Mesh(body.geometry, INK));
}

export class ZooLife {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.animals = [];
    this.visitors = [];
    this.prevInside = false;
  }

  setCity(city) {
    this.clear();
    this.city = city;
    this.data = city.zoo || null;
    if (!this.data) return;
    game(this).scene.add(this.group);
    const rng = mulberry32(31337);
    const Y = city.K.CURB;
    for (const e of this.data.enclosures) {
      this.perches = e.perches || null;
      for (const [kind, n] of e.species) {
        for (let k = 0; k < n; k++) this.spawn(kind, e.rect, rng, Y, k);
      }
    }
  }

  spawn(kind, rect, rng, Y, k) {
    const g = new THREE.Group();
    const parts = SPECIES[kind].build(g, k);
    const ey = SPECIES[kind].eyes;
    if (ey) {
      const r = Math.max(0.025, ey[0] * 0.28);
      for (const s of [-1, 1]) {
        part(g, sp(r, 1, 1.15, 0.6), '#fbfaf7', s * ey[0], ey[1], ey[2]);
        part(g, sp(r * 0.62, 1, 1.15, 0.6), '#121014', s * ey[0], ey[1], ey[2] + r * 0.35);
        part(g, sp(r * 0.22, 1, 1, 0.6), '#ffffff', s * ey[0] - r * 0.2, ey[1] + r * 0.3, ey[2] + r * 0.55);
      }
    }
    mergeAnimal(g);
    const pad = 2;
    const a = { kind, g, legs: parts.legs, rect: [rect[0] + pad, rect[1] + pad, rect[2] - pad, rect[3] - pad], x: 0, z: 0, ry: rng() * 6.28, tx: 0, tz: 0, wait: rng() * 4, phase: rng() * 6, moving: false, Y };
    a.x = a.rect[0] + rng() * (a.rect[2] - a.rect[0]);
    a.z = a.rect[1] + rng() * (a.rect[3] - a.rect[1]);
    if (SPECIES[kind].perch && this.perches?.length) {
      const [px, pz] = this.perches[k % this.perches.length];
      a.x = px;
      a.z = pz;
      a.Y = Y + 3.66 + (k % 3 === 1 ? -0.9 : 0);
    }
    g.position.set(a.x, a.Y, a.z);
    this.group.add(g);
    this.animals.push(a);
  }

  clear() {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.group.clear();
    for (const v of this.visitors) v.rig.dispose();
    this.visitors = [];
    if (this.staff) {
      this.staff.officer.dispose();
      for (const k of this.staff.keepers) k.rig.dispose();
    }
    this.staff = null;
    this.feedingAt = null;
    this.animals = [];
  }

  open(hr = hourOf(this.game.state.time.total)) {
    return hr >= ZOO_HOURS[0] && hr < ZOO_HOURS[1];
  }

  hasTicket() {
    return this.game.state?.flags.zooDay === this.game.sim?.day;
  }

  inside(p) {
    const r = this.data?.rect;
    return !!r && p.x > r[0] && p.x < r[2] && p.z > r[1] && p.z < r[3];
  }

  /** Turnstile: without a ticket (or after closing) you cannot walk in through the gate. */
  blockPlayer(pos) {
    const d = this.data;
    if (!d) return false;
    const wasOutside = !this.prevInside;
    this.prevInside = this.inside(pos);
    if (!this.prevInside || !wasOutside) return false;
    if (this.hasTicket() && this.open()) return false;
    pos.x = d.outside.x;
    pos.z = d.outside.z;
    this.prevInside = false;
    if (!this._warned || performance.now() - this._warned > 4000) {
      this._warned = performance.now();
      this.game.events.emit('toast', { icon: '👮', title: this.open() ? '"Ticket, please!"' : 'The zoo is closed', text: this.open() ? 'Buy a ticket at the booth by the gate.' : `Open ${ZOO_HOURS[0]} AM – ${ZOO_HOURS[1] - 12} PM.`, kind: 'info' });
    }
    return true;
  }

  update(dt, playerPos, visible) {
    if (!this.data) return;
    const d2 = (playerPos.x - this.data.cx) ** 2 + (playerPos.z - this.data.cz) ** 2;
    this.group.visible = visible && d2 < 280 * 280;
    if (!this.group.visible || d2 > 200 * 200) return;
    const t = performance.now() / 1000;
    for (const a of this.animals) {
      const sp = SPECIES[a.kind];
      if (sp.perch) {
        // birds on their perches: bob, turn, flutter
        a.g.position.y = a.Y + Math.abs(Math.sin(t * 2 + a.phase)) * 0.04;
        a.g.rotation.y = a.ry + Math.sin(t * 0.7 + a.phase) * 0.9;
        continue;
      }
      // feeding time: animals gather round their keeper
      const kp = this.feedingAt?.(a);
      if (kp && !a.moving) {
        a.tx = kp.x + Math.sin(a.phase) * 1.6;
        a.tz = kp.z + Math.cos(a.phase) * 1.6;
        a.moving = Math.hypot(a.tx - a.x, a.tz - a.z) > 0.6;
        a.wait = 1;
      }
      if (!a.moving) {
        a.wait -= dt;
        if (a.wait <= 0) {
          a.tx = a.rect[0] + Math.random() * (a.rect[2] - a.rect[0]);
          a.tz = a.rect[1] + Math.random() * (a.rect[3] - a.rect[1]);
          a.moving = true;
        }
      } else {
        const dx = a.tx - a.x;
        const dz = a.tz - a.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.2) {
          a.moving = false;
          a.wait = 3 + Math.random() * 8;
        } else {
          const step = Math.min(d, sp.speed * dt);
          a.x += (dx / d) * step;
          a.z += (dz / d) * step;
          a.ry = dampAngle(a.ry, Math.atan2(dx, dz), 2.5, dt);
        }
      }
      a.phase += dt * (a.moving ? sp.speed * 4.2 : 0);
      const swing = a.moving ? 0.45 : 0;
      if (sp.hop) a.legs.forEach((l) => (l.rotation.x = a.moving ? -Math.abs(Math.sin(a.phase * 0.5)) * 0.8 : 0));
      else a.legs.forEach((l, k) => (l.rotation.x = Math.sin(a.phase + (k === 0 || k === 3 ? 0 : Math.PI)) * swing));
      const lift = sp.hop && a.moving ? Math.abs(Math.sin(a.phase * 0.5)) * 0.45 : a.moving ? Math.abs(Math.sin(a.phase)) * 0.03 : 0;
      a.g.position.set(a.x, a.Y + lift, a.z);
      a.g.rotation.y = a.ry;
      a.g.rotation.z = sp.waddle && a.moving ? Math.sin(a.phase) * 0.15 : 0;
    }
    this.updateVisitors(dt, playerPos);
    this.updateStaff(dt);
  }

  /** The gate officer and the keepers: each keeper walks into a habitat with a bucket at feeding time. */
  updateStaff(dt) {
    const d = this.data;
    if (!this.staff) {
      const rng = mulberry32(4242);
      const look = (role) => ({ ...roleAppearance(role, rng), top: 'uniform', topColor: '#6b7a4a', badgeColor: '#e9c04c', patchColor: '#3f6e4a', bottom: role === 'officer' ? 'slacks' : 'shorts', bottomColor: '#5a5a3a', shoes: 'boots', shoeColor: '#3a2f28', hat: role === 'officer' ? 'policecap' : 'sunhat', hatColor: role === 'officer' ? '#3f4a2a' : '#c9b98a', carry: role === 'officer' ? 'none' : 'bucket', carryColor: '#9aa2ad' });
      const officer = createRig(look('officer'));
      officer.group.position.set(d.gate.x, this.city.K.CURB, d.gate.z);
      officer.group.rotation.y = d.gate.ry;
      this.group.add(officer.group);
      this.staff = { officer, keepers: [] };
      const habitats = d.enclosures.filter((e) => !e.perches);
      for (let i = 0; i < 5; i++) {
        const rig = createRig(look('keeper'));
        this.group.add(rig.group);
        const e = habitats[(i * 3) % habitats.length];
        this.staff.keepers.push({ rig, e, x: e.views[0][0], z: e.views[0][1], phase: 'walk', t: rng() * 8, target: null, habitats, k: i });
      }
      // animals in a habitat with a keeper inside come over to eat
      this.feedingAt = (a) => {
        for (const kp of this.staff.keepers) if (kp.phase === 'feed' && a.rect[0] - 2 < kp.x && kp.x < a.rect[2] + 2 && a.rect[1] - 2 < kp.z && kp.z < a.rect[3] + 2) return kp;
        return null;
      };
    }
    const Y = this.city.K.CURB;
    const off = this.staff.officer;
    animateRig(off, dt, { speed: 0, grounded: true, talking: !this.hasTicket() && this.prevInside === false && Math.sin(performance.now() / 900) > 0.6 });
    for (const kp of this.staff.keepers) {
      kp.t -= dt;
      const e = kp.e;
      const cxE = (e.rect[0] + e.rect[2]) / 2;
      const czE = (e.rect[1] + e.rect[3]) / 2;
      if (kp.phase === 'feed') {
        animateRig(kp.rig, dt, { speed: 0, grounded: true, floor: true });
        if (kp.t <= 0) {
          kp.phase = 'walk';
          kp.e = kp.habitats[(kp.habitats.indexOf(e) + 4 + kp.k) % kp.habitats.length];
          kp.t = 0;
        }
      } else {
        // walk to the middle of the habitat (keepers can go in), then feed for a while
        const tx = cxE + Math.sin(kp.k * 1.7) * 3;
        const tz = czE + Math.cos(kp.k * 1.7) * 2;
        const dx = tx - kp.x;
        const dz = tz - kp.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.4) {
          kp.phase = 'feed';
          kp.t = 25 + Math.random() * 20;
        } else {
          const step = Math.min(dist, 1.4 * dt * (dist > 20 ? 8 : 1)); // hurry along the paths when far
          kp.x += (dx / dist) * step;
          kp.z += (dz / dist) * step;
          kp.ry = Math.atan2(dx, dz);
        }
        animateRig(kp.rig, dt, { speed: 1.4, grounded: true });
      }
      kp.rig.group.position.set(kp.x, Y, kp.z);
      if (kp.ry != null) kp.rig.group.rotation.y = kp.ry;
    }
  }

  /** A few visitors at the enclosure walls during opening hours. */
  updateVisitors(dt, playerPos) {
    const want = this.open() ? 16 : 0;
    if (this.visitors.length !== want) {
      for (const v of this.visitors) {
        v.rig.group.removeFromParent();
        v.rig.dispose();
      }
      this.visitors = [];
      const rng = mulberry32(777 + (this.game.sim?.day || 0));
      const d = this.data;
      for (let k = 0; k < want; k++) {
        const e = d.enclosures[k % d.enclosures.length];
        const [x, z] = e.views[Math.floor(rng() * e.views.length)];
        const ex = (e.rect[0] + e.rect[2]) / 2;
        const ez = (e.rect[1] + e.rect[3]) / 2;
        const rig = createRig(roleAppearance(rng() < 0.5 ? 'tourist' : rng() < 0.5 ? 'student' : 'civilian', rng));
        rig.group.position.set(x, this.city.K.CURB, z);
        rig.group.rotation.y = Math.atan2(ex - x, ez - z);
        this.group.add(rig.group);
        this.visitors.push({ rig, talk: rng() < 0.4 });
      }
    }
    for (const v of this.visitors) animateRig(v.rig, dt, { speed: 0, grounded: true, talking: v.talk, waving: false });
    void playerPos;
  }

  /** Things to do: watch an enclosure, buy a snack, the ticket booth. */
  interactable(pos) {
    const d = this.data;
    if (!d) return null;
    if (this.inside(pos)) {
      for (const e of d.enclosures) {
        if ((e.sign.x - pos.x) ** 2 + (e.sign.z - pos.z) ** 2 < 2.4 * 2.4) return { label: `${e.icon} Watch the ${e.label.toLowerCase()}`, action: () => this.watch(e) };
      }
      if ((d.kiosk.x - pos.x) ** 2 + (d.kiosk.z - pos.z) ** 2 < 2.2 * 2.2) return { label: '🍦 Zoo snack kiosk', action: () => this.kiosk() };
    }
    return null;
  }

  watch(e) {
    const game = this.game;
    game.fade(() => {
      game.sim.advance(20, { noCollapse: true });
      addNeed(game.sim, 'fun', 10);
      addNeed(game.sim, 'social', 2);
      game.state.stats.zooAnimals = (game.state.stats.zooAnimals || 0) + 1;
    });
    game.events.emit('toast', { icon: e.icon, title: e.label, text: e.fact, kind: 'good', long: true });
  }

  kiosk() {
    const game = this.game;
    const sim = game.sim;
    const price = Math.round(5 * (sim.city.priceIndex || 1));
    if (!sim.finance.spend(price, 'food', 'Zoo ice cream')) return;
    addNeed(sim, 'hunger', 10);
    addNeed(sim, 'fun', 6);
    game.events.emit('toast', { icon: '🍦', title: 'Ice cream', text: 'Strawberry, dripping down the cone. A flamingo looks jealous.', kind: 'good' });
  }

  /** Ticket booth at the gate. */
  openBooth(place) {
    const game = this.game;
    const sim = game.sim;
    const st = game.state;
    const price = Math.round(28 * (sim.city.priceIndex || 1));
    const has = this.hasTicket();
    const el = dialog(game, {
      title: `🦁 ${place.name}`,
      body: h(
        'div.menu-col',
        h('div.muted', `Giraffes, zebras, elephants, lions, tigers, bears, hippos, rhinos, monkeys, kangaroos, penguins, flamingos, pandas, gorillas, crocodiles and parrots. Open ${ZOO_HOURS[0]} AM – ${ZOO_HOURS[1] - 12} PM daily.`),
        has
          ? h('div.good', '🎟️ You have a ticket for today. Walk through the gate!')
          : !this.open()
            ? h('div.bad', 'The zoo is closed right now. Come back in the morning.')
            : btn(`🎟️  Day ticket  ·  ${fmtMoney(price)}`, () => {
                if (!sim.finance.spend(price, 'fun', `Ticket · ${place.name}`)) return;
                st.flags.zooDay = sim.day;
                st.stats.zooVisits = (st.stats.zooVisits || 0) + 1;
                game.audio?.play('cash');
                game.closeOverlay(el);
                game.events.emit('toast', { icon: '🎟️', title: 'Enjoy the zoo!', text: 'Your ticket is good all day. The gate is right here.', kind: 'good' });
              }, 'primary'),
      ),
    });
  }
}
const game = (z) => z.game;
