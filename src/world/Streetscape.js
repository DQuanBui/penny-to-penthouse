// Everyday street detail that makes a city read as real:
//   parked cars along the kerbs · fire hydrants · trash cans · newspaper boxes
//   mailboxes · bus shelters · shop awnings on ordinary buildings
//   rooftop water towers, AC units and stone cornices
// Everything is instanced; obstacles get colliders.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { InstanceBatch, FACADE } from './Buildings.js';
import { LANE_OUT } from './Vehicles.js';
import { carGeometry, carMaterial } from './CarModel.js';
import { pick } from '../core/utils.js';

const CAR_COLORS = ['#f4f4f2', '#1d1f24', '#8a8d92', '#b0463c', '#27406b', '#d9c7a8', '#3f5f4a', '#5a6270', '#a8adb4', '#7a2230', '#2f4f6f', '#c9b16b'];
const AWNING = ['#1e5b3a', '#6e1f2b', '#27406b', '#c46a3a', '#3a3f48', '#7a4a8a', '#2f6e78', '#b5343c', '#d9b44a'];

const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cyl = (r0, r1, h, x = 0, y = 0, z = 0, s = 10) => new THREE.CylinderGeometry(r0, r1, h, s).translate(x, y, z);

/** Rooftop clutter and cornices. Must run BEFORE ctx.batch.build(). */
export function addRooftops(ctx) {
  const { batch, rng, group } = ctx;
  const wood = new THREE.MeshStandardMaterial({ color: '#7a5a3c', roughness: 0.9 });
  const tankGeo = mergeGeometries([
    cyl(1.25, 1.25, 2.6, 0, 3.0, 0, 14),
    new THREE.ConeGeometry(1.4, 1.0, 14).translate(0, 4.8, 0),
    ...[[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].map(([x, z]) => box(0.12, 1.7, 0.12, x, 0.85, z)),
    box(2.0, 0.12, 2.0, 0, 1.7, 0),
  ]);
  const tanks = new InstanceBatch(tankGeo, wood, { castShadow: true });
  const units = new InstanceBatch(mergeGeometries([box(1.6, 1.0, 1.1, 0, 0.5, 0), cyl(0.38, 0.38, 0.08, 0.3, 1.04, 0, 12)]), new THREE.MeshStandardMaterial({ color: '#b9bdc3', roughness: 0.6, metalness: 0.3 }), { castShadow: true });
  const items = batch.items.slice();
  for (const b of items) {
    if (b.y0 > 0.5 || b.style?.type === FACADE.PLAIN || b.w < 6 || b.d < 6) continue;
    const top = b.y0 + b.h;
    // stone cornice on masonry walls
    if (b.style?.type === FACADE.MASONRY && b.h < 70) batch.add(b.x, b.z, b.w + 0.5, b.d + 0.5, 0.5, shadeHex(b.color, 0.82), { type: FACADE.PLAIN }, top - 0.2);
    if (b.h > 9 && b.h < 48 && rng() < 0.32) tanks.add(b.x + (rng() - 0.5) * b.w * 0.4, top, b.z + (rng() - 0.5) * b.d * 0.4, { ry: rng() * 6 });
    const n = b.h > 60 ? 0 : Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) units.add(b.x + (rng() - 0.5) * (b.w - 2.5), top, b.z + (rng() - 0.5) * (b.d - 2.5), { ry: Math.floor(rng() * 4) * (Math.PI / 2) });
  }
  for (const m of [tanks.build(), units.build()]) if (m) group.add(m);
}

const _c = new THREE.Color();
function shadeHex(hex, f) {
  return '#' + _c.set(hex).multiplyScalar(f).getHexString();
}

/** Kerbside parked cars, street furniture and ground-floor awnings. */
export function buildStreetscape(ctx) {
  const { group, colliders, rng, K, blocks, roadCenter, N, reserved } = ctx;
  const Y = K.CURB;
  const clear = (x, z, r = 2.6) => {
    for (const p of reserved) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) return false;
    return true;
  };

  // ---- parked cars -----------------------------------------------------------
  const cars = new InstanceBatch(carGeometry(), carMaterial(), { castShadow: true });
  ctx.parkedCars = [];
  for (const b of blocks) {
    // [side, kerb-lane position, heading, along-axis]
    const sides = [
      [b.j > 0, 'z', roadCenter(b.j) + LANE_OUT, Math.PI / 2],
      [b.j < N - 1, 'z', roadCenter(b.j + 1) - LANE_OUT, -Math.PI / 2],
      [b.i > 0, 'x', roadCenter(b.i) + LANE_OUT, Math.PI],
      [b.i < N - 1, 'x', roadCenter(b.i + 1) - LANE_OUT, 0],
    ];
    for (const [inner, axis, lane, ry] of sides) {
      if (!inner) continue;
      const c0 = axis === 'z' ? b.x0 : b.z0;
      for (let t = c0 + 6; t < c0 + K.BLOCK - 6; t += 6.4) {
        if (rng() > 0.42) continue;
        const x = axis === 'z' ? t : lane;
        const z = axis === 'z' ? lane : t;
        cars.add(x, 0, z, { ry, color: pick(rng, CAR_COLORS), sx: 0.95 + rng() * 0.1 });
        const hw = axis === 'z' ? 2.15 : 0.9;
        const hd = axis === 'z' ? 0.9 : 2.15;
        colliders.add(x - hw, z - hd, x + hw, z + hd, 1.5);
        ctx.parkedCars.push({ x, z, ry });
      }
    }
  }

  // ---- street furniture ------------------------------------------------------------
  const red = new THREE.MeshStandardMaterial({ color: '#c0352b', roughness: 0.5, metalness: 0.2 });
  const hydrants = new InstanceBatch(mergeGeometries([cyl(0.13, 0.15, 0.55, 0, 0.3, 0, 10), new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.57, 0), cyl(0.05, 0.05, 0.36, 0, 0.38, 0, 8).rotateZ(Math.PI / 2), cyl(0.18, 0.18, 0.06, 0, 0.03, 0, 10)]), red, { castShadow: true });
  const bins = new InstanceBatch(mergeGeometries([cyl(0.28, 0.24, 0.85, 0, 0.43, 0, 12), cyl(0.3, 0.3, 0.06, 0, 0.88, 0, 12)]), new THREE.MeshStandardMaterial({ color: '#2f4a3a', roughness: 0.7 }), { castShadow: true });
  const newsGeo = mergeGeometries([box(0.42, 0.95, 0.38, 0, 0.6, 0), box(0.36, 0.25, 0.02, 0, 0.82, 0.2)]);
  const news = new InstanceBatch(newsGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), { castShadow: true });
  const mail = new InstanceBatch(mergeGeometries([box(0.5, 0.95, 0.5, 0, 0.6, 0), cyl(0.25, 0.25, 0.5, 0, 1.07, 0, 12).rotateX(Math.PI / 2).translate(0, 0, 0), box(0.06, 0.12, 0.5, -0.22, 0.06, 0), box(0.06, 0.12, 0.5, 0.22, 0.06, 0)]), new THREE.MeshStandardMaterial({ color: '#1f4a8a', roughness: 0.5 }), { castShadow: true });
  const glass = new THREE.MeshStandardMaterial({ color: '#9fc4dc', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.35, depthWrite: false });
  const shelterFrame = new InstanceBatch(
    mergeGeometries([box(3.6, 0.12, 1.5, 0, 2.5, 0), ...[[-1.75, -0.65], [1.75, -0.65], [-1.75, 0.65], [1.75, 0.65]].map(([x, z]) => box(0.08, 2.5, 0.08, x, 1.25, z)), box(2.6, 0.08, 0.4, 0, 0.45, -0.45), box(2.6, 0.45, 0.06, 0, 0.75, -0.66)]),
    new THREE.MeshStandardMaterial({ color: '#3a3f48', roughness: 0.5, metalness: 0.5 }),
    { castShadow: true },
  );
  const shelterGlass = new InstanceBatch(box(3.5, 2.2, 0.03, 0, 1.3, -0.7), glass);
  ctx.adPanelMat = new THREE.MeshBasicMaterial({ color: '#ffffff', map: adTexture(), toneMapped: false });
  const ads = new InstanceBatch(box(1.1, 1.7, 0.06, 1.75, 1.2, 0), ctx.adPanelMat);
  const NEWS_COLORS = ['#c53a3a', '#2f5aa3', '#e9c04c', '#f4f4f2', '#2f8f4a'];

  const commercial = (st) => st.lots !== 'houses';
  for (const b of blocks) {
    const dense = commercial(b.style);
    const S = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];
    S.forEach(([nx, nz], si) => {
      const ex = b.cx + nx * (K.BLOCK / 2 - 0.65);
      const ez = b.cz + nz * (K.BLOCK / 2 - 0.65);
      const tx = -nz;
      const tz = nx;
      const ry = Math.atan2(nx, nz);
      const at = (t, off = 0) => [ex + tx * t - nx * off, ez + tz * t - nz * off];
      let [x, z] = at(16.5);
      if (clear(x, z)) {
        hydrants.add(x, Y, z, { ry: rng() * 6 });
        colliders.add(x - 0.15, z - 0.15, x + 0.15, z + 0.15, 0.8);
      }
      [x, z] = at(-16.5, 0.1);
      if (clear(x, z)) {
        bins.add(x, Y, z);
        colliders.add(x - 0.28, z - 0.28, x + 0.28, z + 0.28, 0.9);
      }
      if (dense && rng() < 0.6) {
        for (let k = 0; k < 2 + Math.floor(rng() * 2); k++) {
          [x, z] = at(19 + k * 0.48, 0.1);
          if (!clear(x, z)) break;
          news.add(x, Y, z, { ry: ry + Math.PI, color: NEWS_COLORS[(si + k) % NEWS_COLORS.length] });
          colliders.add(x - 0.22, z - 0.22, x + 0.22, z + 0.22, 1.1);
        }
      }
      if (rng() < 0.3) {
        [x, z] = at(-20, 0.1);
        if (clear(x, z)) {
          mail.add(x, Y, z, { ry: ry + Math.PI });
          colliders.add(x - 0.27, z - 0.27, x + 0.27, z + 0.27, 1.3);
        }
      }
      // a bus shelter on one side of every other block
      if (si === (b.i + b.j) % 4 && (b.i + b.j) % 2 === 0 && dense) {
        [x, z] = at(6, 0.35);
        if (clear(x, z, 4)) {
          shelterFrame.add(x, Y, z, { ry: ry + Math.PI });
          shelterGlass.add(x, Y, z, { ry: ry + Math.PI });
          ads.add(x, Y, z, { ry: ry + Math.PI });
          // back wall only, so the shelter can be walked into
          const bx = x + nx * 0.7;
          const bz = z + nz * 0.7;
          colliders.add(bx - (nz ? 1.8 : 0.1), bz - (nx ? 1.8 : 0.1), bx + (nz ? 1.8 : 0.1), bz + (nx ? 1.8 : 0.1), 2.5);
          ctx.benchSpots?.push({ x: x - nx * 0.2, z: z - nz * 0.2, ry: ry + Math.PI });
          (ctx.busStops ||= []).push({ x, z });
        }
      }
    });
  }

  // ---- awnings on ordinary ground-floor shops -------------------------------
  const awnGeo = new THREE.BoxGeometry(1, 0.06, 1.3).translate(0, 0, 0.65).rotateX(0.33);
  const awnings = new InstanceBatch(awnGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), { castShadow: true });
  const signs = new InstanceBatch(box(1, 0.7, 0.12, 0, 0, 0.06), new THREE.MeshStandardMaterial({ roughness: 0.6 }));
  for (const b of blocks) {
    if (b.kind !== 'build' || b.style.lots === 'houses') continue;
    for (const lot of b.lots) {
      if (lot.place || !lot.sides.length || lot.empty) continue;
      const side = lot.sides[0];
      const nx = side === 'e' ? 1 : side === 'w' ? -1 : 0;
      const nz = side === 's' ? 1 : side === 'n' ? -1 : 0;
      const fx = nx ? (nx > 0 ? lot.x1 : lot.x0) : (lot.x0 + lot.x1) / 2;
      const fz = nz ? (nz > 0 ? lot.z1 : lot.z0) : (lot.z0 + lot.z1) / 2;
      const W = (nz ? lot.x1 - lot.x0 : lot.z1 - lot.z0) - 2.4;
      // now and then someone with nowhere else to go sits against a quiet wall
      if (rng() < 0.07 && W > 6) {
        const tx = -nz;
        const tz = nx;
        const sx = fx + nx * 0.65 + tx * (W / 2 - 1.2);
        const sz = fz + nz * 0.65 + tz * (W / 2 - 1.2);
        (ctx.sitters ||= []).push({ id: `sit_${b.i}_${b.j}_${Math.round(sx)}`, x: sx, z: sz, ry: Math.atan2(nx, nz), cart: rng() < 0.3 });
        colliders.add(sx - 0.55, sz - 0.55, sx + 0.55, sz + 0.55, 0.6);
      }
      if (rng() > 0.45) continue;
      if (W < 3) continue;
      const ry = Math.atan2(nx, nz);
      const color = pick(rng, AWNING);
      awnings.add(fx + nx * 0.05, Y + 3.5, fz + nz * 0.05, { ry, sx: W, color });
      signs.add(fx + nx * 0.02, Y + 4.35, fz + nz * 0.02, { ry, sx: Math.min(W * 0.6, 5), color: shadeHex(color, 0.75) });
    }
  }

  for (const m of [cars.build(), hydrants.build(), bins.build(), news.build(), mail.build(), shelterFrame.build(), ads.build(), awnings.build(), signs.build()]) if (m) group.add(m);
  const g = shelterGlass.build();
  if (g) {
    g.renderOrder = 3;
    group.add(g);
  }
}

/** A simple bright poster for bus-shelter ad panels. */
function adTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 200;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 200);
  grd.addColorStop(0, '#ff9a5a');
  grd.addColorStop(1, '#6a3fd0');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 200);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.arc(64, 78, 34, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = '800 22px Outfit, sans-serif';
  g.textAlign = 'center';
  g.fillText('PULSE', 64, 150);
  g.font = '600 13px Outfit, sans-serif';
  g.fillText('share your city', 64, 172);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
