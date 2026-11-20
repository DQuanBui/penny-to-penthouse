// Details that make the blocks read as a real city:
//  · black iron fire escapes zig-zagging down the fronts of walk-ups
//  · red aircraft warning lights blinking on top of the towers at night
//  · billboards on rooftops (the game's fictional brands)
//  · roof gardens with planters and little trees on low buildings
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FACADE, InstanceBatch } from './Buildings.js';
import { adTextures } from './TimesSquare.js';

// fictional names for apartment buildings and towers
const HOME_NAMES = ['The Beaumont', 'Maple Court', 'Riverside Lofts', 'The Ashford', 'Linden House', 'Park View', 'The Wellington', 'Harbor House', 'The Calloway', 'Willow Gardens', 'The Hartley', 'Cedar Hall', 'The Marlowe', 'Briarwood', 'The Ellison', 'Juniper Lofts', 'The Sterling', 'Oakmont', 'The Adeline', 'Sycamore Place'];
const TOWER_NAMES = ['MERIDIAN TOWER', 'APEX ONE', 'SUMMIT PLAZA', 'HALCYON TOWER', 'NORTHSTAR', 'THE VANTAGE', 'ORION CENTER', 'SILVERLINE', 'ZENITH TOWER', 'CROWN POINT', 'AURORA PLAZA', 'THE PINNACLE'];
const texCache = new Map();
/** A name plaque (gold letters on dark) or a lit tower name (white letters, no background). */
function nameTexture(text, tower) {
  const key = (tower ? 't:' : 'h:') + text;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = tower ? 1024 : 512;
  c.height = tower ? 128 : 128;
  const g = c.getContext('2d');
  if (!tower) {
    g.fillStyle = '#1d1f24';
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = '#c9a24a';
    g.lineWidth = 6;
    g.strokeRect(8, 8, c.width - 16, c.height - 16);
  }
  g.fillStyle = tower ? '#f4f6ff' : '#e8c45a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = tower ? 96 : 62;
  const font = (s) => (tower ? `800 ${s}px Outfit,"Segoe UI",sans-serif` : `600 ${s}px Georgia,"Times New Roman",serif`);
  g.font = font(size);
  while (g.measureText(text).width > c.width * 0.86 && size > 20) g.font = font((size -= 4));
  g.fillText(text, c.width / 2, c.height / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

const N4 = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

class Bag {
  constructor() {
    this.list = [];
  }
  add(geo) {
    this.list.push(geo.index ? geo.toNonIndexed() : geo);
  }
}

/** Box in facade space: u along the wall, y up, v out from the wall. */
function facadeBox(f, u, y, v, w, h, d, roll = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (roll) g.rotateZ(roll);
  g.translate(u, y, v);
  // facade space -> world: along the wall, up, and out along its normal (nx, nz)
  // (tangent (nz, -nx) keeps it a rotation, not a mirror, so faces stay outward)
  const m = new THREE.Matrix4().set(f.nz, 0, f.nx, f.x, 0, 1, 0, 0, -f.nx, 0, f.nz, f.z, 0, 0, 0, 1);
  g.applyMatrix4(m);
  return g;
}

export function buildFacadeDetails(ctx) {
  const { group, rng, K } = ctx;
  const list = ctx.facades || [];
  const iron = new Bag();
  const warn = [];
  const boards = new Map();
  const ads = adTextures();
  const grass = new InstanceBatch(new THREE.BoxGeometry(1, 0.12, 1).translate(0, 0.06, 0), new THREE.MeshStandardMaterial({ color: '#4f8a3f', roughness: 1 }), { receiveShadow: true });
  const planters = new InstanceBatch(new THREE.BoxGeometry(1, 0.5, 1).translate(0, 0.25, 0), new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.9 }), { castShadow: true });
  const shrubs = new InstanceBatch(new THREE.IcosahedronGeometry(0.6, 1), new THREE.MeshStandardMaterial({ color: '#3f7a34', roughness: 0.9, flatShading: true }), { castShadow: true });
  const posts = new Bag();
  let escapes = 0;
  const plaques = new Map(); // texture -> plane geometries
  const entry = new Bag();
  const canopies = new Bag();
  const towers = new Map();
  let named = 0;
  const sample = [];
  const addPlane = (map, tex, geo) => {
    if (!map.has(tex)) map.set(tex, []);
    map.get(tex).push(geo);
  };

  for (const b of list) {
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const side = b.sides?.[0];
    const masonry = b.type === FACADE.MASONRY || b.type === FACADE.BALCONY;
    // ---- fire escapes on walk-ups (not on the shopfront of a place)
    if (side && masonry && !b.place && b.h > 11 && b.h < 42 && rng() < 0.42) {
      const [nx, nz] = N4[side];
      const len = nz ? w : d;
      const fw = Math.min(4.6, len - 2.4);
      if (fw > 2.6) {
        const off = (rng() - 0.5) * (len - fw - 2) * 0.8;
        const f = { nx, nz, x: cx + nx * (w / 2), z: cz + nz * (d / 2) };
        const fh = b.floorH || 3.4;
        const floors = Math.floor(b.h / fh);
        for (let k = 1; k < floors; k++) {
          const y = K.CURB + k * fh - 0.1;
          iron.add(facadeBox(f, off, y, 0.55, fw, 0.06, 1.05));
          iron.add(facadeBox(f, off, y + 1.0, 1.06, fw, 0.04, 0.04)); // top rail
          iron.add(facadeBox(f, off, y + 0.5, 1.06, fw, 0.03, 0.03)); // mid rail
          for (const s of [-1, 1]) iron.add(facadeBox(f, off + s * fw / 2, y + 0.5, 0.55, 0.04, 1.0, 1.05));
          for (let p = -fw / 2; p <= fw / 2 + 0.01; p += fw / 6) iron.add(facadeBox(f, off + p, y + 0.5, 1.06, 0.025, 1.0, 0.025));
          // the stair up to the next landing, alternating direction
          if (k < floors - 1) {
            const run = fw * 0.62;
            const ang = Math.atan2(fh, run) * (k % 2 ? 1 : -1);
            iron.add(facadeBox(f, off, y + fh / 2, 0.75, Math.hypot(run, fh), 0.05, 0.6, ang));
          }
        }
        // the drop ladder hanging from the first landing
        iron.add(facadeBox(f, off + fw / 2 - 0.4, K.CURB + fh - 1.3, 0.95, 0.04, 2.4, 0.04));
        iron.add(facadeBox(f, off + fw / 2 - 0.85, K.CURB + fh - 1.3, 0.95, 0.04, 2.4, 0.04));
        for (let r = 0; r < 6; r++) iron.add(facadeBox(f, off + fw / 2 - 0.625, K.CURB + fh - 2.4 + r * 0.38, 0.95, 0.45, 0.03, 0.03));
        escapes++;
      }
    }
    // ---- apartment entrances with a canopy and the building's name
    if (side && !b.place && b.h > 9 && b.h < 70 && rng() < 0.55) {
      const [nx, nz] = N4[side];
      const len = nz ? w : d;
      if (len > 7) {
        const f = { nx, nz, x: cx + nx * (w / 2), z: cz + nz * (d / 2) };
        const u = (rng() - 0.5) * (len - 6) * 0.6;
        entry.add(facadeBox(f, u, K.CURB + 1.25, 0.06, 1.7, 2.5, 0.12)); // a dark double door
        canopies.add(facadeBox(f, u, K.CURB + 2.85, 0.75, 2.4, 0.14, 1.5));
        for (const s of [-1, 1]) canopies.add(facadeBox(f, u + s * 1.05, K.CURB + 1.4, 1.4, 0.06, 2.8, 0.06));
        const name = HOME_NAMES[Math.floor(rng() * HOME_NAMES.length)];
        const geo = new THREE.PlaneGeometry(2.2, 0.55);
        geo.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(nx, nz)));
        geo.translate(f.x + nx * 1.52, K.CURB + 3.05, f.z + nz * 1.52);
        geo.translate(nz * u, 0, -nx * u);
        addPlane(plaques, nameTexture(name, false), geo);
        named++;
        if (sample.length < 12) sample.push({ x: f.x + nz * u, z: f.z - nx * u, nx, nz, name });
      }
    }
    // ---- tower names lit near the top
    if (side && !b.place && b.h > 60 && rng() < 0.5) {
      const [nx, nz] = N4[side];
      const len = nz ? w : d;
      const tw = Math.min(len * 0.8, 22);
      const geo = new THREE.PlaneGeometry(tw, tw / 8);
      geo.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(nx, nz)));
      geo.translate(cx + nx * (w / 2 + 0.12), K.CURB + b.h - tw / 8 - 1.5, cz + nz * (d / 2 + 0.12));
      addPlane(towers, nameTexture(TOWER_NAMES[Math.floor(rng() * TOWER_NAMES.length)], true), geo);
      named++;
    }
    // ---- warning lights on the tallest towers
    const top = b.top || b.h;
    if (top > 85) {
      warn.push([cx, top + 0.4, cz]);
      if (top > 150) for (const [sx, sz] of [[-1, -1], [1, 1]]) warn.push([cx + sx * (w * 0.3), top - 2, cz + sz * (d * 0.3)]);
    }
    // ---- rooftop billboards on mid-height buildings facing a street
    if (side && b.h > 14 && b.h < 46 && !b.place && rng() < 0.09) {
      const [nx, nz] = N4[side];
      const f = { nx, nz, x: cx + nx * (w / 2 - 1.5), z: cz + nz * (d / 2 - 1.5) };
      const bw = Math.min(10, (nz ? w : d) - 2);
      if (bw > 5) {
        const y0 = K.CURB + b.h + 1.6;
        for (const u of [-bw / 2 + 0.6, 0, bw / 2 - 0.6]) {
          posts.add(facadeBox(f, u, K.CURB + b.h + 0.8, -0.3, 0.14, 1.6 + bw * 0.3, 0.14));
          posts.add(facadeBox(f, u, K.CURB + b.h + 0.6, -1.2, 0.1, 1.2, 0.1));
        }
        posts.add(facadeBox(f, 0, y0 + bw * 0.3 + 0.05, -0.32, bw + 0.3, bw * 0.6 + 0.3, 0.12));
        const geo = new THREE.PlaneGeometry(bw, bw * 0.6);
        geo.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(nx, nz)));
        geo.translate(f.x + nx * -0.24, y0 + bw * 0.3 + 0.05, f.z + nz * -0.24);
        const tex = ads[Math.floor(rng() * ads.length)];
        if (!boards.has(tex)) boards.set(tex, []);
        boards.get(tex).push(geo);
      }
    }
    // ---- roof gardens on low buildings
    if (b.h < 22 && b.h > 7 && w > 9 && d > 9 && rng() < 0.12) {
      const y = K.CURB + b.h;
      grass.add(cx, y, cz, { sx: w * 0.6, sz: d * 0.5 });
      for (let i = 0; i < 4; i++) {
        const px = cx + (rng() - 0.5) * w * 0.5;
        const pz = cz + (rng() - 0.5) * d * 0.4;
        planters.add(px, y, pz, { sx: 1.2, sz: 1.2 });
        shrubs.add(px, y + 0.9, pz, { sx: 0.8 + rng() * 0.6, sy: 0.9 + rng() * 0.6, sz: 0.8 + rng() * 0.6 });
      }
    }
  }

  if (entry.list.length) group.add(new THREE.Mesh(mergeGeometries(entry.list), new THREE.MeshStandardMaterial({ color: '#2a3340', roughness: 0.2, metalness: 0.5 })));
  if (canopies.list.length) {
    const m = new THREE.Mesh(mergeGeometries(canopies.list), new THREE.MeshStandardMaterial({ color: '#1f3a2f', roughness: 0.6 }));
    m.castShadow = true;
    group.add(m);
  }
  for (const [tex, geos] of plaques) group.add(new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ map: tex })));
  for (const [tex, geos] of towers) group.add(new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })));
  if (iron.list.length) {
    const m = new THREE.Mesh(mergeGeometries(iron.list), new THREE.MeshStandardMaterial({ color: '#1e1f23', roughness: 0.6, metalness: 0.5 }));
    m.castShadow = true;
    group.add(m);
  }
  if (posts.list.length) {
    const m = new THREE.Mesh(mergeGeometries(posts.list), new THREE.MeshStandardMaterial({ color: '#3a3d44', roughness: 0.7, metalness: 0.4 }));
    m.castShadow = true;
    group.add(m);
  }
  for (const [tex, geos] of boards) group.add(new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
  for (const m of [grass.build(), planters.build(), shrubs.build()]) if (m) group.add(m);
  if (warn.length) {
    const mat = new THREE.MeshBasicMaterial({ color: '#ff2a2a', toneMapped: false });
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 8, 6), mat, warn.length);
    const mx = new THREE.Matrix4();
    warn.forEach(([x, y, z], i) => inst.setMatrixAt(i, mx.makeTranslation(x, y, z)));
    group.add(inst);
    ctx.animated.push((t) => {
      const on = t % 1.6 < 0.5;
      mat.color.set(on ? '#ff2a2a' : '#3a0a0a');
    });
  }
  return { escapes, named, sample, beacons: warn.length, billboards: [...boards.values()].reduce((s, l) => s + l.length, 0) };
}
