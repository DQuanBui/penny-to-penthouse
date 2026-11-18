// Real-world looking street fronts for every enterable place: shopfronts with
// awnings, fascia signs and lit display windows; classical banks and colleges
// with columns and steps; glass office lobbies with canopies and a company
// name near the roof; showrooms; residential entrances. All brands are
// fictional. Geometry is merged per material (a handful of draw calls for the
// whole city); only the text signs are separate meshes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PLACE_TYPES } from '../data/placeTypes.js';
import { labelTexture, iconTexture } from './Textures.js';
import { mulberry32, hashStr } from '../core/utils.js';

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const shade = (hex, f) => '#' + _c.set(hex).multiplyScalar(f).getHexString();

/** Geometry collector: one merged mesh per material key. */
class Bag {
  constructor() {
    this.parts = { solid: [], glass: [], neon: [], fabric: [] };
  }
  add(key, geo, color, matrix) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    if (matrix) geo.applyMatrix4(matrix);
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
    this.parts[key].push(geo);
  }
}

/** Text sign texture without the dark pill (white or dark letters on a colour band). */
function logoTexture(text, color, { fg = '#ffffff', w = 1024, h = 160, transparent = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!transparent) {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = h * 0.56;
  const font = (s) => `800 ${s}px Outfit, "Segoe UI", system-ui, sans-serif`;
  g.font = font(size);
  const label = text.toUpperCase();
  while (g.measureText(label).width > w * 0.9 && size > 18) g.font = font((size -= 4));
  if (transparent) {
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 10;
  }
  g.fillStyle = fg;
  g.fillText(label, w / 2, h * 0.54);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Build all storefronts. Returns { update(night) } for night lighting.
 * ctx: city generator context (group, places, colliders, K)
 */
export function buildStorefronts(ctx) {
  const { group, places, colliders, K } = ctx;
  const bag = new Bag();
  const signs = []; // materials that glow at night
  const Y = K.CURB;

  for (const p of places) {
    if (p.station) continue;
    const meta = PLACE_TYPES[p.type];
    const look = meta.look || { front: 'shopfront', brand: p.color, awning: 'slant', extras: [] };
    const rng = mulberry32(hashStr(p.id));
    const ry = Math.atan2(p.nx, p.nz);
    // local frame: +x along the facade, +y up, +z out to the street; origin = door on the wall
    const M = new THREE.Matrix4().makeRotationY(ry).setPosition(p.doorX, Y, p.doorZ);
    const lot = p.lot;
    const lotW = p.nz ? lot.x1 - lot.x0 : lot.z1 - lot.z0;
    const W = Math.max(7, Math.min(lotW - 0.8, 22));
    const H = lot.h || 12;
    const brand = look.brand;
    const trim = look.trim || '#efeae0';

    // helpers in local coordinates ---------------------------------------
    const box = (key, w, h, d, x, y, z, color, solid = 0) => {
      bag.add(key, new THREE.BoxGeometry(w, h, d).translate(x, y, z), color, M);
      if (solid) collide(x, z, w, d, Math.min(solid, h + y));
    };
    const cyl = (key, r0, r1, h, x, y, z, color, seg = 14) => bag.add(key, new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z), color, M);
    const sph = (key, r, x, y, z, color) => bag.add(key, new THREE.SphereGeometry(r, 8, 6).translate(x, y, z), color, M);
    /** Solid obstacle (walls block walking) from a local box footprint. */
    const collide = (x, z, w, d, h) => {
      const a = _v.set(x - w / 2, 0, z - d / 2).applyMatrix4(M).clone();
      const b = _v.set(x + w / 2, 0, z + d / 2).applyMatrix4(M);
      colliders.add(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), h + Y);
    };
    const sign = (tex, w, h, x, y, z, glow = true) => {
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false });
      mat.userData.ownMap = true;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.copy(_v.set(x, y, z).applyMatrix4(M));
      m.rotation.y = ry;
      m.renderOrder = 2;
      group.add(m);
      if (glow) signs.push(mat);
      return m;
    };

    // fronts ----------------------------------------------------------------
    if (look.front === 'shopfront') {
      const fh = 3.7; // window head height
      box('solid', 0.5, fh + 0.9, 0.3, -W / 2 + 0.25, (fh + 0.9) / 2, 0.15, trim); // pilasters
      box('solid', 0.5, fh + 0.9, 0.3, W / 2 - 0.25, (fh + 0.9) / 2, 0.15, trim);
      box('solid', W - 1, 0.55, 0.16, 0, 0.275, 0.08, shade(trim, 0.85)); // bulkhead
      box('glass', W - 1, fh - 0.6, 0.06, 0, 0.55 + (fh - 0.6) / 2, 0.05, '#ffffff'); // display window
      for (let x = -W / 2 + 0.5 + (W - 1) / 4; x < W / 2 - 0.6; x += (W - 1) / 4) box('solid', 0.08, fh - 0.6, 0.1, x, 0.55 + (fh - 0.6) / 2, 0.09, shade(trim, 0.6)); // mullions
      box('solid', 2.0, 2.7, 0.12, 0, 1.35, 0.07, shade(brand, 0.7)); // door frame
      box('glass', 1.7, 2.5, 0.08, 0, 1.3, 0.11, '#ffffff'); // glass door
      box('solid', 0.05, 0.6, 0.05, 0.55, 1.2, 0.18, '#d6d9de'); // handle
      box('solid', W, 0.9, 0.26, 0, fh + 0.45, 0.13, brand); // fascia
      sign(logoTexture(p.name, brand, { fg: trim }), Math.min(W - 1.4, 9), 0.72, 0, fh + 0.45, 0.27);
      if (look.awning === 'slant') {
        const g = new THREE.BoxGeometry(W - 0.6, 0.06, 1.5).translate(0, 0, 0.75).rotateX(0.32).translate(0, fh - 0.05, 0.05);
        bag.add('fabric', g, brand, M);
        // scalloped valance in the trim colour
        box('fabric', W - 0.6, 0.22, 0.04, 0, fh - 0.62, 1.47, trim);
      } else if (look.awning === 'flat') {
        box('solid', W - 0.4, 0.14, 1.3, 0, fh - 0.05, 0.65, shade(brand, 0.85));
      }
    } else if (look.front === 'classic') {
      // stone portico: steps, columns, entablature, pediment
      const pw = Math.min(W - 1, 10);
      for (let s = 0; s < 3; s++) box('solid', pw + 1.2 - s * 0.4, 0.12, 2.6 - s * 0.5, 0, 0.06 + s * 0.12, 1.3 - s * 0.25, shade(trim, 0.92 - s * 0.03));
      const cols = 4;
      for (let i = 0; i < cols; i++) {
        const x = -pw / 2 + 0.5 + (i * (pw - 1)) / (cols - 1);
        if (Math.abs(x) < 1.1) continue; // keep the door clear
        cyl('solid', 0.32, 0.36, 5.4, x, 0.36 + 2.7, 1.9, trim, 16);
        box('solid', 0.9, 0.2, 0.9, x, 0.46, 1.9, shade(trim, 0.9));
        box('solid', 0.85, 0.22, 0.85, x, 5.9, 1.9, shade(trim, 0.95));
        collide(x, 1.9, 0.75, 0.75, 6);
      }
      box('solid', pw + 0.4, 0.8, 2.6, 0, 6.4, 1.2, trim); // entablature
      const ped = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-pw / 2 - 0.2, 0), new THREE.Vector2(pw / 2 + 0.2, 0), new THREE.Vector2(0, 1.6)]), { depth: 0.5, bevelEnabled: false }).translate(0, 6.8, 2.0);
      bag.add('solid', ped, shade(trim, 0.97), M);
      box('solid', 2.4, 3.2, 0.14, 0, 1.96, 0.08, shade(brand, 0.6)); // tall door
      box('glass', 2.0, 2.9, 0.08, 0, 1.85, 0.13, '#ffffff');
      sign(logoTexture(p.name, brand, { fg: '#f2e2b0' }), Math.min(pw, 8), 0.62, 0, 6.4, 2.52);
    } else if (look.front === 'lobby') {
      // double-height glass lobby with a steel canopy on slim columns
      const lw = Math.min(W - 1, 12);
      box('glass', lw, 6.2, 0.1, 0, 3.1, 0.06, '#ffffff');
      for (let x = -lw / 2; x <= lw / 2 + 0.01; x += lw / 4) box('solid', 0.12, 6.2, 0.16, x, 3.1, 0.1, '#2b3038');
      box('solid', lw + 2, 0.32, 3.2, 0, 4.2, 1.6, '#2b3038'); // canopy
      box('neon', lw + 1.6, 0.05, 0.05, 0, 4.03, 3.18, '#fff4dc'); // downlight strip
      for (const x of [-lw / 2 - 0.4, lw / 2 + 0.4]) {
        cyl('solid', 0.09, 0.09, 4.1, x, 2.05, 2.9, '#3a3f48', 10);
        collide(x, 2.9, 0.25, 0.25, 4);
      }
      box('solid', 3.0, 0.32, 0.4, 0, 4.4, 3.2, brand);
      sign(logoTexture(p.name, brand, { fg: trim }), 2.8, 0.28, 0, 4.4, 3.42);
      box('glass', 2.6, 2.8, 0.1, 0, 1.4, 0.16, '#ffffff'); // revolving-door drum
      cyl('solid', 1.35, 1.35, 0.12, 0, 2.9, 0.75, '#2b3038', 20);
      bag.add('glass', new THREE.CylinderGeometry(1.3, 1.3, 2.8, 20, 1, true, -Math.PI / 2, Math.PI).translate(0, 1.4, 0.15), '#ffffff', M);
    } else if (look.front === 'showroom') {
      const sh = Math.min(H - 1.5, 7.5);
      box('glass', W - 0.8, sh, 0.08, 0, sh / 2, 0.05, '#ffffff');
      for (let x = -W / 2 + 0.4; x <= W / 2 - 0.39; x += (W - 0.8) / 5) box('solid', 0.14, sh, 0.18, x, sh / 2, 0.1, '#e9edf1');
      box('solid', W, 0.7, 0.4, 0, sh + 0.35, 0.2, brand);
      sign(logoTexture(p.name, brand, { fg: trim }), Math.min(W - 2, 12), 0.56, 0, sh + 0.35, 0.42);
      box('solid', 3.2, 0.2, 2.2, 0, 3.4, 1.1, '#e9edf1'); // entrance canopy
      box('glass', 2.4, 2.8, 0.08, 0, 1.4, 0.12, '#ffffff');
    } else {
      // residential: canopy, intercom, house number, lamps
      box('solid', 2.6, 3.2, 0.14, 0, 1.6, 0.07, shade(brand, 0.85));
      box('glass', 1.6, 2.5, 0.08, 0, 1.3, 0.13, '#ffffff');
      box('solid', 3.2, 0.12, 1.6, 0, 3.15, 0.8, brand);
      for (const x of [-1.5, 1.5]) cyl('neon', 0.07, 0.07, 0.3, x, 2.3, 0.18, '#ffe2a6', 10);
      box('solid', 0.22, 0.32, 0.05, 1.05, 1.4, 0.16, '#c9ced6'); // intercom
      sign(logoTexture(String(10 + (hashStr(p.id) % 890)), '#1d2433', { fg: '#ffffff', w: 256, h: 128 }), 0.5, 0.25, -1.05, 2.1, 0.16, false);
    }

    // extras ------------------------------------------------------------------
    const extras = look.extras || [];
    const side = (fn) => [-1, 1].forEach(fn);
    for (const ex of extras) {
      if (ex === 'bladeLogo') {
        // round logo sign projecting from the wall
        box('solid', 0.08, 0.08, 0.9, W / 2 - 1.2, 3.55, 0.45, '#2b2f38');
        bag.add('solid', new THREE.CylinderGeometry(0.55, 0.55, 0.1, 28).rotateZ(Math.PI / 2).translate(W / 2 - 1.2, 3.0, 0.9), brand, M);
        const t = iconTexture(meta.icon, '#ffffff');
        for (const s of [1, -1]) {
          const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false });
          const m = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), mat);
          m.position.copy(_v.set(W / 2 - 1.2 + s * 0.06, 3.0, 0.9).applyMatrix4(M));
          m.rotation.y = ry + (s * Math.PI) / 2;
          group.add(m);
        }
      } else if (ex === 'patio') {
        // two café tables with chairs and umbrellas against the window
        side((s) => {
          // tables sit between the door and the pilasters, or just outside narrow fronts
          const x = s * Math.max(2.4, W / 2 - 1.6);
          cyl('solid', 0.38, 0.38, 0.04, x, 0.74, 1.05, '#f4f1ea', 16);
          cyl('solid', 0.04, 0.05, 0.72, x, 0.36, 1.05, '#2b2f38', 6);
          for (const cx of [-0.62, 0.62]) {
            box('solid', 0.42, 0.05, 0.42, x + cx, 0.46, 1.05, '#7a5a3c');
            box('solid', 0.42, 0.45, 0.05, x + cx * 1.45, 0.7, 1.05, '#7a5a3c');
          }
          cyl('solid', 0.025, 0.025, 1.9, x, 1.69, 1.05, '#e8e4dc', 6);
          bag.add('fabric', new THREE.ConeGeometry(1.25, 0.45, 8).translate(x, 2.6, 1.05), s > 0 ? brand : look.trim || '#f2efe8', M);
          collide(x, 1.05, 1.9, 0.9, 1);
        });
      } else if (ex === 'chalkboard') {
        const x = 1.7;
        const g1 = new THREE.BoxGeometry(0.6, 0.9, 0.04).rotateX(0.18).translate(x, 0.5, 0.75);
        const g2 = new THREE.BoxGeometry(0.6, 0.9, 0.04).rotateX(-0.18).translate(x, 0.5, 1.05);
        bag.add('solid', g1, '#2a2d2b', M);
        bag.add('solid', g2, '#2a2d2b', M);
      } else if (ex === 'stringLights') {
        const n = 14;
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const x = -W / 2 + 0.6 + t * (W - 1.2);
          sph('neon', 0.05, x, 3.1 - Math.sin(t * Math.PI * 3) ** 2 * 0.28, 1.25, '#ffd9a0');
        }
      } else if (ex === 'planters') {
        side((s) => {
          const x = s * (W / 2 - 0.6);
          box('solid', 0.7, 0.55, 0.7, x, 0.275, 0.55, '#5a5f66', 0.6);
          sph('solid', 0.38, x, 0.75, 0.55, rng() < 0.5 ? '#3f7f3a' : '#4f8f45');
        });
      } else if (ex === 'produce') {
        const colors = ['#d63b2f', '#f2a33a', '#7cb342', '#ffd23f', '#8e44ad'];
        side((s) => {
          const x = s * (W / 2 - 2.3);
          box('solid', 2.0, 0.75, 0.8, x, 0.375, 0.6, '#8a6a4a', 0.8);
          for (let k = 0; k < 4; k++) for (let j = 0; j < 2; j++) sph('solid', 0.13, x - 0.75 + k * 0.5, 0.86, 0.42 + j * 0.36, colors[(k + j * 2 + (s > 0 ? 1 : 0)) % colors.length]);
        });
      } else if (ex === 'carts') {
        for (let k = 0; k < 3; k++) {
          const x = -W / 2 + 1.1 + k * 0.3;
          box('solid', 0.55, 0.45, 0.85, x, 0.7, 0.75, '#b9c0c8');
          box('solid', 0.5, 0.04, 0.8, x, 0.25, 0.75, '#8a929c');
        }
        collide(-W / 2 + 1.4, 0.75, 1.2, 0.9, 1);
      } else if (ex === 'mannequins') {
        const tops = ['#c53a3a', '#e9e6df', '#2f5aa3', '#d9b44a', '#2a2a2e'];
        for (let k = 0; k < 4; k++) {
          const x = -W / 2 + 1.4 + (k * (W - 2.8)) / 3;
          if (Math.abs(x) < 1.3) continue;
          cyl('solid', 0.2, 0.22, 0.1, x, 0.6, 0.3, '#d8d8d8', 12);
          cyl('solid', 0.025, 0.025, 0.7, x, 0.95, 0.3, '#c9c9c9', 6);
          bag.add('solid', new THREE.CapsuleGeometry(0.16, 0.36, 4, 10).scale(1, 1, 0.7).translate(x, 1.65, 0.3), tops[k % tops.length], M);
          sph('solid', 0.11, x, 2.2, 0.3, '#ece7e1');
        }
      } else if (ex === 'displaySofa') {
        box('solid', 2.2, 0.45, 0.8, -W / 4, 0.95, 0.4, '#7c6a58');
        box('solid', 2.2, 0.5, 0.2, -W / 4, 1.35, 0.15, '#6b5a4a');
        cyl('neon', 0.12, 0.2, 0.25, W / 4, 2.6, 0.35, '#ffe0a8', 12);
      } else if (ex === 'screens') {
        for (let k = 0; k < 3; k++) {
          const x = -W / 2 + 1.6 + (k * (W - 3.2)) / 2;
          if (Math.abs(x) < 1.3) continue;
          box('solid', 1.5, 0.95, 0.06, x, 1.9, 0.12, '#101216');
          box('neon', 1.38, 0.82, 0.02, x, 1.9, 0.16, k % 2 ? '#3d8bff' : '#38d1c7');
        }
      } else if (ex === 'neonStrip') {
        box('neon', W - 0.8, 0.07, 0.07, 0, 4.18, 0.3, look.trim || '#4fb3ff');
      } else if (ex === 'neonSign') {
        // glowing outline + script-like name
        const w = Math.min(W - 2, 5);
        for (const [x, y, ww, hh] of [[0, 5.0, w, 0.07], [0, 6.3, w, 0.07], [-w / 2, 5.65, 0.07, 1.3], [w / 2, 5.65, 0.07, 1.3]]) box('neon', ww, hh, 0.07, x, y, 0.2, look.trim);
        sign(logoTexture(p.name, look.trim, { fg: '#ffe9ff', transparent: true }), w - 0.4, 0.9, 0, 5.65, 0.24);
      } else if (ex === 'velvetRope') {
        for (const x of [-1.6, -2.6]) {
          cyl('solid', 0.04, 0.05, 0.9, x, 0.45, 1.3, '#d8b25a', 8);
          sph('solid', 0.07, x, 0.92, 1.3, '#d8b25a');
        }
        box('fabric', 1.0, 0.05, 0.05, -2.1, 0.78, 1.3, '#8a1430');
      } else if (ex === 'listings') {
        for (let k = 0; k < 4; k++) {
          const x = -W / 2 + 1.3 + k * 0.85;
          box('solid', 0.7, 0.55, 0.02, x, 1.9, 0.11, '#ffffff');
          box('solid', 0.6, 0.3, 0.025, x, 1.98, 0.115, ['#7aa6c9', '#9cc08a', '#d9b48a', '#a9a0c9'][k]);
        }
      } else if (ex === 'flags') {
        side((s) => {
          const x = s * Math.min(W / 2 - 0.8, 7);
          cyl('solid', 0.05, 0.06, 7, x, 3.5, 2.6, '#d8dde3', 8);
          sph('solid', 0.09, x, 7.05, 2.6, '#e0c060');
          box('fabric', 1.6, 1.0, 0.03, x + s * 0.82, 6.2, 2.6, s > 0 ? brand : '#ffffff');
          collide(x, 2.6, 0.2, 0.2, 7);
        });
      } else if (ex === 'banners') {
        side((s) => box('fabric', 0.9, 3.2, 0.04, s * (Math.min(W / 2, 7) - 1.6), 5.2, 0.35, brand));
      } else if (ex === 'banner') {
        box('fabric', 1.0, Math.min(H - 5, 7), 0.05, W / 2 - 0.9, 4.5 + Math.min(H - 5, 7) / 2, 0.4, look.trim || brand);
      } else if (ex === 'redCross') {
        box('neon', 1.6, 0.45, 0.06, W / 2 - 1.6, 5.2, 0.12, '#e3122e');
        box('neon', 0.45, 1.6, 0.06, W / 2 - 1.6, 5.2, 0.12, '#e3122e');
        sign(logoTexture('Emergency', '#c4142b'), 3.2, 0.5, W / 2 - 1.6, 4.1, 3.43);
      } else if (ex === 'bikeRack') {
        for (let k = 0; k < 4; k++) bag.add('solid', new THREE.TorusGeometry(0.35, 0.025, 4, 12, Math.PI).translate(-W / 2 + 1.0 + k * 0.5, 0.0, 1.4).rotateY(0), '#9aa2ad', M);
      } else if (ex === 'pennants') {
        const n = 12;
        for (let i = 0; i < n; i++) {
          const x = -W / 2 + 0.6 + (i / (n - 1)) * (W - 1.2);
          bag.add('fabric', new THREE.ConeGeometry(0.16, 0.4, 3).rotateX(Math.PI).translate(x, 6.6 - Math.sin((i / (n - 1)) * Math.PI) * 0.6, 1.0), ['#e05c5c', '#ffd24a', '#4f9dff'][i % 3], M);
        }
      } else if (ex === 'displayCar') {
        const x = W / 2 - 3;
        box('solid', 4.0, 0.12, 2.2, x, 0.06, 1.8, '#c9ced6');
      } else if (ex === 'crates') {
        side((s) => {
          const x = s * (W / 2 - 1.4);
          box('solid', 1.1, 0.9, 1.1, x, 0.45, 0.8, '#8a6a42', 0.9);
          box('solid', 0.8, 0.6, 0.8, x, 1.2, 0.8, '#9a7a52');
        });
      }
    }

    // company name near the roof, lit at night
    if (look.sky && H >= 14) {
      const w = Math.min(W * 0.75, 14);
      sign(logoTexture(p.name, brand, { fg: '#ffffff', transparent: true }), w, w / 6.4, 0, H - w / 6.4 - 0.8, 0.12);
    }
  }

  // ---- merge -----------------------------------------------------------------
  const mats = {
    solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 }),
    fabric: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }),
    // blue-grey glass that catches the sky by day and glows with warm interior light at night
    glass: new THREE.MeshStandardMaterial({ color: '#5f7a92', roughness: 0.12, metalness: 0.15, emissive: '#ffcf8a', emissiveIntensity: 0 }),
    neon: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };
  for (const key in bag.parts) {
    const list = bag.parts[key];
    if (!list.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(list, false), mats[key]);
    mesh.castShadow = key === 'solid' || key === 'fabric';
    mesh.receiveShadow = key !== 'neon';
    group.add(mesh);
    for (const g of list) g.dispose();
  }

  return {
    update(night) {
      mats.glass.emissiveIntensity = night * 1.1;
      mats.glass.color.setRGB(0.37 - night * 0.28, 0.48 - night * 0.36, 0.57 - night * 0.43);
      mats.neon.color.setScalar(0.55 + night * 1.25);
      const s = 0.85 + night * 0.9;
      for (const m of signs) m.color.setScalar(s);
    },
  };
}
