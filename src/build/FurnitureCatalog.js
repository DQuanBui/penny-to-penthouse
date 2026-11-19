// Procedural furniture meshes. Every item in data/furniture.js names a `shape`
// built here from a handful of boxes/cylinders merged into ONE vertex-coloured
// mesh (1 draw call per item). If a matching GLB exists in
// public/models/furniture/<id>.glb it is used instead.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FURNITURE_BY_ID } from '../data/furniture.js';
import { loadAssetManifest } from '../core/Assets.js';

let sharedMat = null;
const mat = () => (sharedMat ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.74, metalness: 0.02 }));
const _c = new THREE.Color();
const shade = (hex, f) => '#' + _c.set(hex).multiplyScalar(f).getHexString();

class Sculpt {
  constructor() {
    this.geos = [];
    this.extras = [];
  }
  add(geo, color) {
    const n = geo.attributes.position.count;
    _c.set(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r;
      col[i * 3 + 1] = _c.g;
      col[i * 3 + 2] = _c.b;
    }
    geo.deleteAttribute('uv');
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geos.push(geo);
    return this;
  }
  /** box centred at x,y,z */
  box(w, h, d, x, y, z, color, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    return this.add(g.translate(x, y, z), color);
  }
  cyl(rt, rb, h, x, y, z, color, seg = 12, rotX = 0, rotZ = 0) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    if (rotX) g.rotateX(rotX);
    if (rotZ) g.rotateZ(rotZ);
    return this.add(g.translate(x, y, z), color);
  }
  sph(r, x, y, z, color, sx = 1, sy = 1, sz = 1) {
    return this.add(new THREE.SphereGeometry(r, 12, 8).scale(sx, sy, sz).translate(x, y, z), color);
  }
  /** self-lit part (screens, lamp shades) */
  glow(geo, color, intensity = 1) {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.5 }));
    this.extras.push(m);
    return this;
  }
  build() {
    const g = new THREE.Group();
    if (this.geos.length) {
      const geo = mergeGeometries(this.geos, false);
      for (const x of this.geos) x.dispose();
      const m = new THREE.Mesh(geo, mat());
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    for (const e of this.extras) g.add(e);
    return g;
  }
}

const WOOD = '#8a6a4a';
const STEEL = '#aab2bc';
const DARK = '#2b2f38';

const SHAPES = {
  bed(S, f, p) {
    const { w, d } = f;
    const base = p.low ? 0.08 : 0.3;
    if (p.frame) {
      S.box(w, base, d, 0, base / 2, 0, p.frame);
      S.box(w, p.head || 0.9, 0.1, 0, (p.head || 0.9) / 2, -d / 2 + 0.05, p.gold ? '#3a2f2a' : p.frame);
      if (p.gold) S.box(w * 0.9, 0.06, 0.12, 0, (p.head || 0.9) - 0.1, -d / 2 + 0.06, '#e8c45a');
    }
    S.box(w - 0.08, 0.22, d - 0.12, 0, base + 0.11, 0.02, '#f4f2ec');
    S.box(w - 0.06, 0.1, d * 0.62, 0, base + 0.25, d * 0.17, p.sheet);
    const n = w >= 1.5 ? 2 : 1;
    for (let i = 0; i < n; i++) S.box(w / n - 0.2, 0.12, 0.36, (i - (n - 1) / 2) * (w / n), base + 0.28, -d / 2 + 0.36, '#ffffff');
  },
  beanbag(S, f, p) {
    S.sph(0.45, 0, 0.3, 0, p.color, 1, 0.68, 1);
    S.sph(0.3, 0, 0.5, -0.12, shade(p.color, 0.9), 1.1, 0.8, 0.8);
  },
  sofa(S, f, p) {
    const { w, d } = f;
    const legs = p.legs || '#3a2f2a';
    S.box(w, 0.28, d - 0.1, 0, 0.3, 0.02, p.color);
    S.box(w, 0.5, 0.22, 0, 0.62, -d / 2 + 0.13, shade(p.color, 0.92));
    S.box(0.18, 0.42, d - 0.1, -w / 2 + 0.09, 0.5, 0.02, shade(p.color, 0.88));
    S.box(0.18, 0.42, d - 0.1, w / 2 - 0.09, 0.5, 0.02, shade(p.color, 0.88));
    const n = p.seats || 2;
    const sw = (w - 0.4) / n;
    for (let i = 0; i < n; i++) S.box(sw - 0.04, 0.12, d - 0.4, -w / 2 + 0.2 + sw * (i + 0.5), 0.5, 0.1, shade(p.color, 1.08));
    for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) for (const z of [-d / 2 + 0.12, d / 2 - 0.12]) S.cyl(0.03, 0.03, 0.16, x, 0.08, z, legs, 6);
  },
  desk(S, f, p) {
    const { w, d } = f;
    S.box(w, 0.05, d - 0.15, 0, 0.74, 0, p.top);
    if (p.drawers) {
      S.box(0.4, 0.68, d - 0.25, -w / 2 + 0.22, 0.37, 0, p.leg);
      S.box(0.4, 0.68, d - 0.25, w / 2 - 0.22, 0.37, 0, p.leg);
      S.box(0.3, 0.02, 0.02, w / 2 - 0.22, 0.52, d / 2 - 0.12, '#d8dde6');
    } else {
      for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) for (const z of [-d / 2 + 0.16, d / 2 - 0.16]) S.box(0.05, 0.72, 0.05, x, 0.36, z, p.leg);
    }
    if (p.pc) SHAPES.pc(S, 0, 0.765, -0.1);
  },
  /** monitor + keyboard, placed on desks that have a computer */
  pc(S, x, y, z) {
    S.box(0.06, 0.16, 0.06, x, y + 0.08, z - 0.08, DARK);
    S.box(0.3, 0.02, 0.18, x, y + 0.01, z - 0.08, DARK);
    S.box(0.62, 0.38, 0.03, x, y + 0.36, z - 0.06, '#15171c');
    S.glow(new THREE.PlaneGeometry(0.57, 0.33).translate(x, y + 0.36, z - 0.043), '#5ab0ff', 0.75);
    S.box(0.42, 0.02, 0.14, x, y + 0.012, z + 0.2, '#3a3f4c');
  },
  chair(S, f, p) {
    if (p.office) {
      S.cyl(0.03, 0.03, 0.4, 0, 0.25, 0, DARK, 6);
      S.cyl(0.26, 0.26, 0.04, 0, 0.05, 0, DARK, 5);
    } else for (const x of [-0.18, 0.18]) for (const z of [-0.18, 0.18]) S.box(0.035, 0.45, 0.035, x, 0.225, z, shade(p.color, 0.8));
    S.box(0.44, 0.06, 0.44, 0, 0.47, 0, p.color);
    S.box(0.44, 0.45, 0.05, 0, 0.74, -0.2, p.color);
  },
  stool(S, f, p) {
    S.cyl(0.03, 0.03, 0.7, 0, 0.35, 0, STEEL, 6);
    S.cyl(0.2, 0.2, 0.03, 0, 0.02, 0, STEEL, 12);
    S.cyl(0.19, 0.19, 0.07, 0, 0.73, 0, p.color, 14);
  },
  bookshelf(S, f, p) {
    const { w } = f;
    S.box(w, 1.9, 0.34, 0, 0.95, 0, p.color);
    const cols = ['#c53a3a', '#3f76d0', '#e9c04c', '#4f9d5d', '#a04fc0', '#e07b39', '#f4f4f2'];
    for (let r = 0; r < 4; r++) {
      S.box(w - 0.08, 0.36, 0.3, 0, 0.3 + r * 0.44, 0.03, shade(p.color, 0.55));
      for (let i = 0; i < 7; i++) S.box(0.09, 0.22 + ((i * 7 + r * 3) % 5) * 0.022, 0.2, -w / 2 + 0.14 + i * ((w - 0.28) / 6), 0.25 + r * 0.44, 0.07, cols[(i + r * 2) % cols.length]);
    }
  },
  fridge(S, f, p) {
    const w = Math.min(f.w, 0.9) - 0.06;
    const d = Math.min(f.d, 0.8) - 0.06;
    S.box(w, p.h, d, 0, p.h / 2, 0, p.color);
    S.box(w + 0.01, 0.012, d + 0.01, 0, p.h * 0.62, 0, shade(p.color, 0.7));
    S.box(0.03, p.h * 0.25, 0.03, w / 2 - 0.08, p.h * 0.78, d / 2 + 0.02, p.steel ? DARK : STEEL);
    S.box(0.03, p.h * 0.3, 0.03, w / 2 - 0.08, p.h * 0.36, d / 2 + 0.02, p.steel ? DARK : STEEL);
    if (p.steel) S.glow(new THREE.PlaneGeometry(0.22, 0.14).translate(-w * 0.18, p.h * 0.8, d / 2 + 0.005), '#7fd4ff', 0.6);
  },
  stove(S, f, p) {
    const { w, d } = f;
    if (p.small) {
      S.box(0.46, 0.84, 0.46, 0, 0.42, 0, '#b98a5a');
      S.box(0.4, 0.06, 0.34, 0, 0.87, 0, p.color);
      S.cyl(0.12, 0.12, 0.02, 0, 0.91, 0, '#1d1f24', 12);
      return;
    }
    S.box(w - 0.04, 0.88, d - 0.2, 0, 0.44, 0, p.color);
    S.box(w - 0.02, 0.03, d - 0.18, 0, 0.895, 0, '#1d1f24');
    const n = p.long ? 6 : w > 1.2 ? 4 : 2;
    for (let i = 0; i < n; i++) S.cyl(0.11, 0.11, 0.015, -w / 2 + (w / n) * (i + 0.5), 0.915, i % 2 ? 0.14 : -0.14, '#4a4f5a', 12);
    S.box(w - 0.2, 0.36, 0.02, 0, 0.42, (d - 0.2) / 2 + 0.01, p.steel ? '#1d1f24' : '#2b2f38');
    S.box(w - 0.24, 0.025, 0.04, 0, 0.66, (d - 0.2) / 2 + 0.04, STEEL);
    if (p.long) S.box(w - 0.04, 0.5, 0.3, 0, 1.75, -d / 2 + 0.25, STEEL);
  },
  counter(S, f, p) {
    const { w } = f;
    const d = p.slim ? 0.45 : f.d - 0.2;
    S.box(w - 0.02, 0.84, d, 0, 0.42, 0, p.color);
    S.box(w, 0.05, d + 0.04, 0, 0.865, 0, p.top);
    if (p.sink) {
      S.box(w * 0.5, 0.02, d * 0.6, 0, 0.892, 0, '#8a929c');
      S.cyl(0.015, 0.015, 0.22, 0, 1.0, -d * 0.35, STEEL, 6);
      S.box(0.02, 0.02, 0.14, 0, 1.1, -d * 0.35 + 0.07, STEEL);
    }
    S.box(0.14, 0.02, 0.02, -w * 0.25, 0.6, d / 2 + 0.01, STEEL);
    S.box(0.14, 0.02, 0.02, w * 0.25, 0.6, d / 2 + 0.01, STEEL);
  },
  table(S, f, p) {
    const { w, d } = f;
    S.box(w - 0.1, 0.05, d - 0.1, 0, 0.73, 0, p.color);
    const leg = p.leg || shade(p.color, 0.75);
    for (const x of [-w / 2 + 0.14, w / 2 - 0.14]) for (const z of [-d / 2 + 0.14, d / 2 - 0.14]) S.box(0.06, 0.7, 0.06, x, 0.35, z, leg);
  },
  shower(S, f, p) {
    const { w, d } = f;
    S.box(w, 0.08, d, 0, 0.04, 0, '#e9e7e1');
    S.box(w, 2.1, 0.06, 0, 1.05, -d / 2 + 0.03, '#e9e7e1');
    S.box(0.06, 2.1, d, -w / 2 + 0.03, 1.05, 0, '#e9e7e1');
    S.cyl(0.015, 0.015, 0.5, -w / 2 + 0.3, 1.9, -d / 2 + 0.15, STEEL, 6, 0, 0.9);
    S.cyl(p.lux ? 0.16 : 0.08, p.lux ? 0.16 : 0.08, 0.02, -w / 2 + 0.48, 2.02, -d / 2 + 0.15, STEEL, 12);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.95, d - 0.1), new THREE.MeshStandardMaterial({ color: p.color, transparent: true, opacity: 0.28, roughness: 0.1 }));
    glass.position.set(w / 2 - 0.03, 1.02, 0);
    S.extras.push(glass);
  },
  tub(S, f, p) {
    const { w, d } = f;
    S.box(w - 0.1, 0.55, d - 0.2, 0, 0.3, 0, p.color);
    S.box(w - 0.3, 0.04, d - 0.4, 0, 0.56, 0, '#9fd3e8');
    S.cyl(0.02, 0.02, 0.25, -w / 2 + 0.2, 0.7, 0, '#e8c45a', 6);
    for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) for (const z of [-0.3, 0.3]) S.sph(0.06, x, 0.05, z, '#e8c45a');
  },
  toilet(S) {
    S.box(0.36, 0.38, 0.5, 0, 0.19, 0.05, '#f7f5f0');
    S.box(0.4, 0.04, 0.46, 0, 0.4, 0.07, '#ffffff');
    S.box(0.4, 0.5, 0.18, 0, 0.55, -0.3, '#f7f5f0');
  },
  mirror(S, f) {
    S.box(f.w - 0.2, 1.0, 0.04, 0, 1.5, -f.d / 2 + 0.03, '#d8dde6');
    S.glow(new THREE.PlaneGeometry(f.w - 0.28, 0.92).translate(0, 1.5, -f.d / 2 + 0.055), '#bcd6e8', 0.18);
  },
  rug(S, f, p) {
    S.box(f.w, 0.015, f.d, 0, 0.008, 0, p.trim);
    S.box(f.w - 0.24, 0.018, f.d - 0.24, 0, 0.01, 0, p.color);
    S.box(f.w - 0.7, 0.02, f.d - 0.7, 0, 0.011, 0, shade(p.color, 1.25));
  },
  painting(S, f, p) {
    const hgt = p.big ? 1.0 : 0.6;
    const z = -f.d / 2 + 0.03;
    S.box(f.w - 0.1, hgt, 0.04, 0, 1.55, z, p.gold ? '#e8c45a' : '#2a2420');
    S.box(f.w - 0.2, hgt - 0.1, 0.02, 0, 1.55, z + 0.02, p.a);
    S.box((f.w - 0.2) * 0.5, (hgt - 0.1) * 0.6, 0.02, -(f.w - 0.2) * 0.12, 1.5, z + 0.025, p.b);
    S.cyl(0.1, 0.1, 0.02, (f.w - 0.2) * 0.22, 1.66, z + 0.03, '#f4f4f2', 12, Math.PI / 2);
  },
  wardrobe(S, f, p) {
    const hgt = p.low ? 0.9 : 2.0;
    S.box(f.w - 0.04, hgt, 0.42, 0, hgt / 2, 0, p.color);
    S.box(0.012, hgt - 0.1, 0.01, 0, hgt / 2, 0.215, shade(p.color, 0.6));
    if (p.low) for (let i = 0; i < 3; i++) S.box(f.w - 0.14, 0.012, 0.01, 0, 0.2 + i * 0.28, 0.215, shade(p.color, 0.6));
    S.cyl(0.015, 0.015, 0.1, -0.06, hgt * 0.5, 0.23, STEEL, 6);
    S.cyl(0.015, 0.015, 0.1, 0.06, hgt * 0.5, 0.23, STEEL, 6);
  },
  tv(S, f, p) {
    const sw = p.size;
    const sh = sw * 0.56;
    S.box(Math.max(sw * 0.7, 0.8), 0.45, 0.38, 0, 0.225, 0, '#3a2f2a');
    S.box(0.3, 0.03, 0.2, 0, 0.465, 0, DARK);
    S.box(0.05, 0.12, 0.04, 0, 0.53, 0, DARK);
    S.box(sw, sh, 0.04, 0, 0.6 + sh / 2, 0, '#101216');
    S.glow(new THREE.PlaneGeometry(sw - 0.06, sh - 0.06).translate(0, 0.6 + sh / 2, 0.022), '#4a7fd0', 0.55);
    if (p.speakers) for (const x of [-sw / 2 - 0.2, sw / 2 + 0.2]) S.box(0.22, 1.1, 0.24, x, 0.55, 0, '#1d1f24');
  },
  console(S) {
    S.box(0.4, 0.3, 0.36, 0, 0.15, 0, '#3a2f2a');
    S.box(0.3, 0.06, 0.22, 0, 0.33, 0, '#f4f4f2');
    S.glow(new THREE.BoxGeometry(0.2, 0.01, 0.01).translate(0, 0.34, 0.112), '#5ab0ff', 1.2);
  },
  speaker(S) {
    for (const x of [-0.12, 0.12]) {
      S.box(0.18, 1.0, 0.22, x, 0.5, 0, '#22252c');
      S.cyl(0.06, 0.06, 0.01, x, 0.75, 0.112, '#5a5f6a', 12, Math.PI / 2);
      S.cyl(0.07, 0.07, 0.01, x, 0.4, 0.112, '#5a5f6a', 12, Math.PI / 2);
    }
  },
  sculpture(S) {
    S.box(0.6, 0.5, 0.6, 0, 0.25, 0, '#f0eee9');
    S.add(new THREE.TorusKnotGeometry(0.3, 0.09, 48, 8).translate(0, 1.05, 0), '#e8c45a');
  },
  piano(S, f) {
    S.box(f.w - 0.2, 0.3, f.d - 0.3, 0, 0.85, -0.05, '#15171c');
    S.box(f.w - 0.3, 0.05, 0.22, 0, 0.76, f.d / 2 - 0.2, '#f7f5f0');
    for (const [x, z] of [[-0.7, 0.4], [0.7, 0.4], [0, -0.5]]) S.cyl(0.05, 0.04, 0.7, x, 0.35, z, '#15171c', 8);
    S.box(0.7, 0.08, 0.35, 0, 0.45, f.d / 2 + 0.1, '#2a2420');
  },
  treadmill(S) {
    S.box(0.7, 0.14, 1.6, 0, 0.12, 0.1, DARK);
    S.box(0.56, 0.02, 1.3, 0, 0.2, 0.15, '#4a4f5a');
    for (const x of [-0.32, 0.32]) S.box(0.05, 1.1, 0.05, x, 0.7, -0.6, STEEL);
    S.box(0.7, 0.3, 0.06, 0, 1.2, -0.62, '#1d1f24');
    S.glow(new THREE.PlaneGeometry(0.4, 0.18).translate(0, 1.22, -0.585), '#4fd18b', 0.7);
  },
  weights(S) {
    S.box(0.36, 0.1, 1.3, 0, 0.45, 0.1, '#b5343c');
    for (const z of [-0.4, 0.6]) S.box(0.3, 0.42, 0.06, 0, 0.21, z, DARK);
    for (const x of [-0.42, 0.42]) S.box(0.05, 1.0, 0.05, x, 0.5, -0.5, STEEL);
    S.cyl(0.02, 0.02, 1.3, 0, 0.98, -0.5, STEEL, 6, 0, Math.PI / 2);
    for (const x of [-0.56, 0.56]) S.cyl(0.17, 0.17, 0.06, x, 0.98, -0.5, '#1d1f24', 14, 0, Math.PI / 2);
  },
  easel(S) {
    for (const x of [-0.25, 0.25]) S.box(0.04, 1.7, 0.04, x, 0.85, 0.05, WOOD);
    S.box(0.04, 1.6, 0.04, 0, 0.8, -0.3, WOOD);
    S.box(0.7, 0.9, 0.03, 0, 1.15, 0.09, '#f7f5f0');
    S.box(0.3, 0.4, 0.01, -0.1, 1.2, 0.11, '#e07b39');
    S.box(0.25, 0.3, 0.01, 0.15, 1.05, 0.112, '#3f76d0');
  },
  plant(S, f, p) {
    if (p.box) {
      S.box(f.w - 0.1, 0.4, 0.36, 0, 0.2, 0, '#e8e2d6');
      for (let i = 0; i < 5; i++) S.sph(0.2, -f.w / 2 + 0.25 + i * ((f.w - 0.5) / 4), 0.55, 0, i % 2 ? '#4f9d5d' : '#3f8f4a', 1, 1.2, 1);
      return;
    }
    const pot = Math.min(0.2, 0.1 + p.h * 0.06);
    S.cyl(pot, pot * 0.75, pot * 1.5, 0, pot * 0.75, 0, '#c98b6a', 10);
    if (p.h < 0.6) {
      S.sph(0.13, 0, pot * 1.5 + 0.08, 0, '#5fa04a', 1, 0.8, 1);
      return;
    }
    S.cyl(0.025, 0.035, p.h * 0.7, 0, pot * 1.5 + p.h * 0.35, 0, '#6b4a32', 6);
    if (p.palm) {
      for (let i = 0; i < 7; i++) {
        const g = new THREE.BoxGeometry(0.16, 0.02, 0.9).translate(0, 0, 0.45);
        g.rotateX(0.5);
        g.rotateY((i / 7) * Math.PI * 2);
        S.add(g.translate(0, pot * 1.5 + p.h * 0.7, 0), i % 2 ? '#3f8f4a' : '#4a9a52');
      }
    } else {
      S.sph(0.3, 0, p.h * 0.85, 0, '#4f9d5d', 1, 1.15, 1);
      S.sph(0.22, 0.12, p.h * 1.0, 0.05, '#5fa04a');
      S.sph(0.2, -0.14, p.h * 0.72, -0.04, '#3f8f4a');
    }
  },
  lamp(S, f, p) {
    if (p.h < 1) {
      S.box(0.4, 0.5, 0.4, 0, 0.25, 0, WOOD);
      S.cyl(0.07, 0.09, 0.06, 0, 0.53, 0, DARK, 10);
      S.cyl(0.012, 0.012, 0.25, 0, 0.68, 0, DARK, 6);
      S.glow(new THREE.CylinderGeometry(0.1, 0.15, 0.2, 14, 1, true).translate(0, 0.86, 0), '#ffd9a0', 0.9);
      return;
    }
    S.cyl(0.16, 0.18, 0.04, 0, 0.02, 0, DARK, 14);
    S.cyl(0.015, 0.015, p.h - 0.2, 0, p.h / 2 - 0.08, 0, DARK, 6);
    const lx = p.arc ? 0.5 : 0;
    if (p.arc) S.add(new THREE.TorusGeometry(0.25, 0.015, 6, 14, Math.PI).translate(0.25, p.h - 0.2, 0), DARK);
    S.glow(new THREE.CylinderGeometry(0.12, 0.19, 0.26, 14, 1, true).translate(lx, p.h - (p.arc ? 0.3 : 0.05), 0), '#ffd9a0', 0.9);
  },
  chandelier(S) {
    S.cyl(0.01, 0.01, 0.5, 0, 2.75, 0, '#e8c45a', 6);
    S.add(new THREE.TorusGeometry(0.35, 0.02, 6, 20).rotateX(Math.PI / 2).translate(0, 2.45, 0), '#e8c45a');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      S.glow(new THREE.SphereGeometry(0.05, 8, 6).translate(Math.cos(a) * 0.35, 2.4, Math.sin(a) * 0.35), '#fff0c8', 1.6);
    }
  },
  // ---- commercial ----
  register(S, f, p) {
    const { w, d } = f;
    S.box(w, 1.0, d - 0.3, 0, 0.5, -0.05, p.color);
    S.box(w + 0.06, 0.06, d - 0.2, 0, 1.03, -0.05, p.bar ? '#6b4a32' : '#3a3f4c');
    S.box(w, 0.2, 0.03, 0, 0.5, (d - 0.3) / 2 - 0.03, shade(p.color, 1.3));
    if (p.bar) {
      S.box(w, 1.6, 0.3, 0, 1.3, -d / 2 - 0.5, '#2a2420');
      const cols = ['#4f9d5d', '#e9c04c', '#b5343c', '#3f76d0', '#f4f4f2', '#a04fc0'];
      for (let i = 0; i < 14; i++) S.cyl(0.035, 0.045, 0.26, -w / 2 + 0.25 + i * ((w - 0.5) / 13), 1.5 + (i % 2) * 0.45, -d / 2 - 0.4, cols[i % cols.length], 8);
    } else if (!p.reception) {
      S.box(0.34, 0.26, 0.3, w * 0.28, 1.19, -0.05, DARK);
      S.glow(new THREE.PlaneGeometry(0.26, 0.16).rotateY(Math.PI).translate(w * 0.28, 1.24, -0.205), '#7fd4ff', 0.7);
    } else SHAPES.pc(S, -w * 0.25, 1.06, 0.05);
  },
  shelf(S, f) {
    const { w } = f;
    S.box(w, 1.9, 0.08, 0, 0.95, -0.17, '#e8e2d6');
    const cols = ['#e07b39', '#3f76d0', '#e9c04c', '#4f9d5d', '#c53a3a', '#a04fc0', '#2f8f8f'];
    for (let r = 0; r < 4; r++) {
      S.box(w, 0.04, 0.42, 0, 0.3 + r * 0.45, 0, '#d9d2c4');
      for (let i = 0; i < 8; i++) S.box(0.16, 0.2 + ((i + r) % 3) * 0.04, 0.2, -w / 2 + 0.15 + i * ((w - 0.3) / 7), 0.43 + r * 0.45, 0.02, cols[(i * 3 + r) % cols.length]);
    }
  },
  rack(S, f) {
    const { w } = f;
    for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) S.box(0.04, 1.6, 0.04, x, 0.8, 0, STEEL);
    S.cyl(0.015, 0.015, w - 0.1, 0, 1.55, 0, STEEL, 6, 0, Math.PI / 2);
    const cols = ['#c53a3a', '#3f76d0', '#f4f4f2', '#1d1f24', '#e9c04c', '#4f9d5d', '#e06a9a', '#8a5a3c', '#5a4fd0'];
    for (let i = 0; i < 9; i++) S.box(0.05, 0.7, 0.4, -w / 2 + 0.2 + i * ((w - 0.4) / 8), 1.15, 0, cols[i]);
  },
  workbench(S, f) {
    const { w, d } = f;
    S.box(w, 0.08, d - 0.2, 0, 0.86, 0, '#8a6a4a');
    for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) S.box(0.08, 0.82, 0.08, x, 0.41, z, '#5a5f6a');
    S.box(w, 0.9, 0.04, 0, 1.4, -d / 2 + 0.12, '#6b7280');
    S.box(0.3, 0.16, 0.2, -w * 0.3, 0.98, 0, '#c53a3a');
    S.box(0.5, 0.05, 0.1, w * 0.2, 0.93, 0.1, '#e9c04c');
    for (let i = 0; i < 5; i++) S.box(0.04, 0.3, 0.02, -w / 2 + 0.3 + i * 0.3, 1.45, -d / 2 + 0.15, i % 2 ? '#e07b39' : '#2b2f38');
  },
  lectern(S) {
    S.box(0.6, 1.1, 0.4, 0, 0.55, 0, '#6b4a32');
    S.box(0.7, 0.05, 0.5, 0, 1.13, 0, '#3a2f2a');
  },
  car(S, f, p) {
    S.box(1.8, 0.55, 4.3, 0, 0.55, 0, p.color);
    S.box(1.6, 0.5, 2.2, 0, 1.05, -0.2, '#1d2a3a');
    S.box(1.62, 0.06, 2.1, 0, 1.31, -0.2, p.color);
    for (const x of [-0.9, 0.9]) for (const z of [-1.35, 1.35]) S.cyl(0.34, 0.34, 0.24, x, 0.34, z, '#15171c', 14, 0, Math.PI / 2);
    S.glow(new THREE.BoxGeometry(1.5, 0.1, 0.04).translate(0, 0.62, 2.16), '#fff3c8', 0.8);
  },
  tracks(S, f) {
    S.box(f.w, 0.02, f.d, 0, 0.01, 0, '#2a2622');
    for (let x = -f.w / 2 + 0.3; x < f.w / 2; x += 0.6) S.box(0.24, 0.04, 2.0, x, 0.03, 0, '#4a3a2a');
    for (const z of [-0.72, 0.72]) S.box(f.w, 0.09, 0.07, 0, 0.08, z, '#8a8f99');
    S.box(f.w, 0.1, 0.12, 0, 0.08, 1.45, '#b9a24a');
  },
  platformEdge(S, f) {
    S.box(f.w, 0.012, 0.5, 0, 0.006, 0, '#f2c230');
    S.box(f.w, 0.012, 0.06, 0, 0.007, 0.32, '#f4f4f2');
  },
  column(S) {
    S.box(0.3, 3, 0.3, 0, 1.5, 0, '#2f5a4a');
    S.box(0.44, 0.12, 0.44, 0, 0.06, 0, '#24463a');
    S.box(0.44, 0.12, 0.44, 0, 2.94, 0, '#24463a');
  },
  platformBench(S, f) {
    S.box(f.w, 0.07, 0.42, 0, 0.45, 0.02, '#7a5a3c');
    S.box(f.w, 0.4, 0.06, 0, 0.72, -0.18, '#7a5a3c');
    for (const x of [-f.w / 2 + 0.2, f.w / 2 - 0.2]) S.box(0.06, 0.45, 0.4, x, 0.22, 0, '#2b2d33');
  },
  turnstile(S) {
    S.box(0.28, 1.0, 0.8, -0.35, 0.5, 0, '#9aa2ad');
    S.box(0.3, 0.06, 0.82, -0.35, 1.03, 0, '#3a3f48');
    for (const a of [0, 2.1, 4.2]) S.add(new THREE.CylinderGeometry(0.02, 0.02, 0.5).rotateZ(Math.PI / 2).rotateY(a).translate(-0.05, 0.85, 0), '#c9ced6');
  },
  subwaySeat(S, f) {
    S.box(f.w, 0.08, 0.46, 0, 0.45, 0.02, '#e9a33a');
    S.box(f.w, 0.42, 0.06, 0, 0.7, -0.2, '#e9a33a');
    S.box(f.w, 0.4, 0.3, 0, 0.2, -0.05, '#9aa2ad');
  },
  pole(S) {
    S.cyl(0.025, 0.025, 2.4, 0, 1.2, 0, '#c9ced6', 10);
  },
  grillTable(S, f) {
    S.box(f.w - 0.2, 0.06, f.d - 0.4, 0, 0.74, 0, '#5a3a2a');
    S.box(0.5, 0.72, 0.5, 0, 0.36, 0, '#2b2d33');
    S.cyl(0.26, 0.26, 0.05, 0, 0.79, 0, '#1d1f24', 18);
    S.glow(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16).translate(0, 0.82, 0), '#ff6a2a', 0.9);
    S.cyl(0.06, 0.06, 1.3, 0, 1.65, 0, '#9aa2ad', 10);
    S.cyl(0.24, 0.12, 0.25, 0, 1.05, 0, '#9aa2ad', 14);
    for (const z of [-0.6, 0.6]) for (const x of [-0.45, 0.45]) S.box(0.36, 0.45, 0.36, x, 0.23, z, '#3a2a24');
  },
  lantern(S) {
    for (const [x, c] of [[-0.25, '#d81e1e'], [0.25, '#e9a33a']]) {
      S.add(new THREE.SphereGeometry(0.18, 12, 8).scale(1, 1.2, 1).translate(x, 2.35, 0), c);
      S.cyl(0.08, 0.08, 0.04, x, 2.58, 0, '#d8b25a', 10);
      S.cyl(0.08, 0.08, 0.04, x, 2.12, 0, '#d8b25a', 10);
      S.cyl(0.006, 0.006, 0.4, x, 2.8, 0, '#1d1f24', 4);
    }
  },
  bikeDisplay(S, f) {
    const cols = ['#c53a3a', '#27406b', '#18a999'];
    for (let k = 0; k < 3; k++) {
      const x = -f.w / 2 + 0.5 + k * ((f.w - 1) / 2);
      for (const z of [-0.36, 0.36]) S.add(new THREE.TorusGeometry(0.3, 0.025, 6, 18).rotateY(Math.PI / 2).translate(x, 0.32, z), '#1d1f24');
      S.box(0.04, 0.04, 0.72, x, 0.75, 0, cols[k]);
      S.box(0.04, 0.5, 0.04, x, 0.55, -0.15, cols[k]);
      S.box(0.04, 0.45, 0.04, x, 0.55, 0.3, cols[k]);
      S.box(0.44, 0.03, 0.03, x, 0.98, 0.34, '#2b2d33');
      S.box(0.1, 0.04, 0.2, x, 0.83, -0.18, '#1d1f24');
    }
  },
  chalkboard(S, f) {
    S.box(f.w, 1.3, 0.05, 0, 1.6, -0.22, '#6b4a2a');
    S.box(f.w - 0.12, 1.18, 0.06, 0, 1.6, -0.2, '#2f4a3a');
    S.box(f.w - 0.2, 0.05, 0.1, 0, 0.98, -0.15, '#6b4a2a');
    for (let i = 0; i < 5; i++) S.box(0.3 + (i % 3) * 0.2, 0.025, 0.01, -f.w / 2 + 0.5 + i * 0.45, 1.85 - (i % 3) * 0.22, -0.165, '#e8e8e2');
  },
  schoolDesk(S) {
    S.box(0.7, 0.04, 0.5, 0, 0.68, -0.1, '#c9a26b');
    for (const x of [-0.3, 0.3]) for (const z of [-0.3, 0.1]) S.box(0.04, 0.66, 0.04, x, 0.33, z, '#7a8494');
    S.box(0.42, 0.04, 0.4, 0, 0.42, 0.3, '#3f76d0');
    S.box(0.42, 0.4, 0.04, 0, 0.64, 0.5, '#3f76d0');
    for (const x of [-0.18, 0.18]) S.box(0.03, 0.42, 0.03, x, 0.21, 0.3, '#7a8494');
  },
  washer(S) {
    S.box(0.78, 0.95, 0.72, 0, 0.475, 0, '#f2f4f6');
    S.box(0.7, 0.12, 0.05, 0, 0.86, 0.35, '#cfd5db');
    S.cyl(0.24, 0.24, 0.04, 0, 0.47, 0.36, '#9aa2ad', 24, Math.PI / 2);
    S.cyl(0.19, 0.19, 0.05, 0, 0.47, 0.37, '#7fb0d0', 24, Math.PI / 2);
    S.sph(0.03, 0.25, 0.86, 0.38, '#3a3f4c');
  },
  barberChair(S, f, p) {
    S.cyl(0.22, 0.28, 0.1, 0, 0.05, 0, '#2b2f38', 16);
    S.cyl(0.05, 0.05, 0.42, 0, 0.3, 0, '#b9bdc3', 10);
    S.box(0.62, 0.14, 0.6, 0, 0.56, 0, p.color);
    S.box(0.62, 0.7, 0.12, 0, 0.95, -0.26, p.color);
    S.box(0.3, 0.14, 0.1, 0, 1.36, -0.27, '#1d1f24');
    for (const x of [-0.33, 0.33]) S.box(0.08, 0.06, 0.5, x, 0.76, 0.02, '#b9bdc3');
    S.box(0.4, 0.04, 0.2, 0, 0.18, 0.42, '#b9bdc3');
  },
  arcade(S, f, p) {
    S.box(0.8, 1.75, 0.75, 0, 0.875, -0.02, p.color);
    S.box(0.76, 0.12, 0.42, 0, 0.98, 0.32, '#1d1f24');
    S.cyl(0.03, 0.03, 0.1, -0.15, 1.08, 0.33, '#d81e1e', 8);
    for (const [x, c] of [[0.05, '#ffd24a'], [0.15, '#4fd18b'], [0.25, '#4f9dff']]) S.cyl(0.03, 0.03, 0.03, x, 1.05, 0.34, c, 10);
    S.glow(new THREE.PlaneGeometry(0.6, 0.48).rotateX(-0.25).translate(0, 1.32, 0.31), ['#4fe0ff', '#ff4fd8', '#9cff4f'][Math.floor(Math.random() * 3)], 1.1);
    S.glow(new THREE.BoxGeometry(0.78, 0.2, 0.06).translate(0, 1.68, 0.34), '#ffb347', 1.2);
  },
  djBooth(S, f) {
    const { w } = f;
    S.box(w, 1.05, 0.8, 0, 0.525, 0, '#121318');
    S.box(w + 0.04, 0.05, 0.84, 0, 1.07, 0, '#2b2f38');
    for (const x of [-0.7, 0.7]) S.cyl(0.18, 0.18, 0.03, x, 1.1, -0.05, '#1d1f24', 20);
    S.box(0.5, 0.05, 0.3, 0, 1.11, -0.05, '#3a3f4c');
    S.glow(new THREE.BoxGeometry(w - 0.1, 0.08, 0.02).translate(0, 0.75, 0.41), '#ff4fd8', 1.5);
    S.glow(new THREE.BoxGeometry(w - 0.1, 0.08, 0.02).translate(0, 0.45, 0.41), '#4fe0ff', 1.5);
    for (const x of [-w / 2 - 0.35, w / 2 + 0.35]) {
      S.box(0.55, 1.5, 0.5, x, 0.75, 0, '#16171b');
      S.cyl(0.18, 0.18, 0.04, x, 1.05, 0.26, '#2b2f38', 16, Math.PI / 2);
      S.cyl(0.11, 0.11, 0.04, x, 0.5, 0.26, '#2b2f38', 16, Math.PI / 2);
    }
  },
  danceFloor(S, f) {
    const cols = ['#ff4fd8', '#4fe0ff', '#ffd24a', '#8a5bff', '#4fd18b'];
    let k = 0;
    for (let x = -f.w / 2 + 0.5; x < f.w / 2; x += 1) {
      for (let z = -f.d / 2 + 0.5; z < f.d / 2; z += 1) {
        S.glow(new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2).translate(x, 0.012, z), cols[(k++ * 7) % cols.length], 0.55);
      }
    }
  },
  dartboard(S) {
    S.cyl(0.24, 0.24, 0.04, 0, 1.7, -0.2, '#1d1f24', 24, Math.PI / 2);
    S.cyl(0.19, 0.19, 0.045, 0, 1.7, -0.2, '#d8cfb4', 24, Math.PI / 2);
    S.cyl(0.12, 0.12, 0.05, 0, 1.7, -0.2, '#2f8f4a', 24, Math.PI / 2);
    S.cyl(0.05, 0.05, 0.055, 0, 1.7, -0.2, '#c53a3a', 16, Math.PI / 2);
  },
  displayCase(S, f, p) {
    const { w } = f;
    S.box(w, 0.85, 0.7, 0, 0.425, -0.1, p.color);
    S.box(w, 0.05, 0.75, 0, 0.88, -0.1, '#5a4632');
    S.box(w - 0.1, 0.32, 0.02, 0, 1.06, 0.24, '#dfeaf2');
    const cols = ['#d9a35a', '#7a4a2a', '#f2d7a0', '#e06a9a', '#c9853a'];
    for (let i = 0; i < 8; i++) S.sph(0.07, -w / 2 + 0.25 + i * ((w - 0.5) / 7), 0.96, -0.05, cols[i % cols.length], 1.2, 0.6, 1);
  },
  cinemaSeats(S, f, p) {
    const n = Math.round(f.w / 0.62);
    for (let i = 0; i < n; i++) {
      const x = -f.w / 2 + 0.31 + i * 0.62;
      S.box(0.56, 0.14, 0.55, x, 0.42, 0.05, p.color);
      S.box(0.56, 0.6, 0.12, x, 0.75, -0.24, p.color);
      S.box(0.06, 0.25, 0.5, x + 0.3, 0.55, 0.05, '#1d1f24');
    }
    S.box(f.w, 0.35, 0.6, 0, 0.17, 0.02, '#1d1f24');
  },
  camera(S) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      S.cyl(0.02, 0.02, 1.4, Math.cos(a) * 0.25, 0.68, Math.sin(a) * 0.25, DARK, 6, Math.sin(a) * 0.35, -Math.cos(a) * 0.35);
    }
    S.box(0.3, 0.26, 0.5, 0, 1.5, 0, '#1d1f24');
    S.cyl(0.1, 0.12, 0.2, 0, 1.5, 0.34, '#3a3f4c', 12, Math.PI / 2);
  },
};

// ---- optional GLB overrides -------------------------------------------------
const glb = new Map();
let glbLoaded = false;
export async function loadFurnitureModels() {
  if (glbLoaded) return;
  glbLoaded = true;
  const m = await loadAssetManifest();
  const loader = new GLTFLoader();
  for (const f of m.furniture) {
    try {
      const g = await loader.loadAsync('./models/furniture/' + f);
      g.scene.traverse((o) => {
        if (o.isMesh) o.castShadow = o.receiveShadow = true;
      });
      glb.set(f.replace(/\.[^.]+$/, ''), g.scene);
    } catch {
      /* ignore unreadable files */
    }
  }
}

/** Build the mesh for a furniture id. opts.pc adds a computer to desks. */
export function buildFurniture(id, opts = {}) {
  const f = FURNITURE_BY_ID[id];
  if (!f) return new THREE.Group();
  const src = glb.get(id);
  if (src) {
    // fit the model into the item's footprint
    const model = src.clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = Math.min(f.w / Math.max(size.x, 0.01), f.d / Math.max(size.z, 0.01));
    model.scale.setScalar(s);
    model.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s);
    const g = new THREE.Group();
    g.add(model);
    return g;
  }
  const S = new Sculpt();
  const p = { ...(f.p || {}) };
  if (opts.pc && f.shape === 'desk') p.pc = true;
  (SHAPES[f.shape] || SHAPES.table)(S, f, p);
  return S.build();
}
