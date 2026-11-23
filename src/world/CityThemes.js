// Signature touches that make each city feel like itself (on top of its own
// building colours, cfg.theme):
//  · Miami — neon Art Deco bands on the low buildings, pink and aqua after dark
//  · Chicago — sailboats tacking back and forth on the lake
//  · Los Angeles — giant white letters on the hillside spelling the hills' name
//  · Austin — festoon lights strung across the streets of South Congress, and
//    at dusk a river of bats pouring out from under the bridge
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hillH, toXZ } from './Hills.js';
import { hourOf, dayOf } from '../core/Clock.js';
import { mulberry32, hashStr, pick } from '../core/utils.js';

const NEON = ['#ff4fa3', '#3fe0e0', '#9cff5a', '#b06cff', '#ffb347', '#ff6b6b'];

/** Static theme pieces, built with the city (before it is chunked). */
export function buildTheme(ctx) {
  const T = ctx.cfg.theme || {};
  const rng = mulberry32(hashStr(ctx.cfg.name + ':theme'));
  if (T.neon) neonDeco(ctx, T.neon, rng);
  if (T.hillsign && ctx.hills) hillSign(ctx, ctx.hills);
  if (T.festoons) festoons(ctx, T.festoons);
}

/** Vertex-coloured box. */
function cbox(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const c = new THREE.Color(color);
  const a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

/** A material that glows with the street lamps (dim tubes by day, bright at night). */
function glowMat(ctx, day = 0.45) {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  ctx.animated.push(() => {
    const l = ctx.lampMat.color;
    mat.color.setScalar(Math.max(day, ((l.r + l.g + l.b) / 3) * 1.9));
  });
  return mat;
}

function neonDeco(ctx, districtIds, rng) {
  const { blocks, batch } = ctx;
  const ids = new Set(districtIds);
  const blockAt = (x, z) => blocks.find((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);
  const parts = [];
  for (const b of batch.items) {
    if (b.y0 > 0.5 || b.h < 7 || b.h > 34 || b.w < 5 || b.d < 5 || rng() > 0.65) continue;
    const blk = blockAt(b.x, b.z);
    if (!blk || !ids.has(blk.district.id)) continue;
    const c1 = pick(rng, NEON);
    const c2 = pick(rng, NEON);
    // a band under the parapet, all the way round
    const y = b.h - 0.55;
    parts.push(cbox(b.w + 0.12, 0.16, 0.08, b.x, y, b.z - b.d / 2 - 0.02, c1), cbox(b.w + 0.12, 0.16, 0.08, b.x, y, b.z + b.d / 2 + 0.02, c1));
    parts.push(cbox(0.08, 0.16, b.d + 0.12, b.x - b.w / 2 - 0.02, y, b.z, c1), cbox(0.08, 0.16, b.d + 0.12, b.x + b.w / 2 + 0.02, y, b.z, c1));
    // a second band over the ground floor, and a tall stripe up one corner
    if (rng() < 0.6) {
      parts.push(cbox(b.w + 0.12, 0.12, 0.08, b.x, 4.3, b.z - b.d / 2 - 0.02, c2), cbox(b.w + 0.12, 0.12, 0.08, b.x, 4.3, b.z + b.d / 2 + 0.02, c2));
      parts.push(cbox(0.08, 0.12, b.d + 0.12, b.x - b.w / 2 - 0.02, 4.3, b.z, c2), cbox(0.08, 0.12, b.d + 0.12, b.x + b.w / 2 + 0.02, 4.3, b.z, c2));
    }
    if (rng() < 0.5) {
      const sx = rng() < 0.5 ? -1 : 1;
      const sz = rng() < 0.5 ? -1 : 1;
      parts.push(cbox(0.14, b.h * 0.7, 0.14, b.x + sx * (b.w / 2 + 0.03), b.h * 0.42, b.z + sz * (b.d / 2 + 0.03), c2));
    }
  }
  if (!parts.length) return;
  // merge in chunks so the city tiler can cull them
  const mat = glowMat(ctx, 0.5);
  for (let i = 0; i < parts.length; i += 600) ctx.group.add(new THREE.Mesh(mergeGeometries(parts.slice(i, i + 600)), mat));
  ctx.themeStats = { neon: parts.length };
}

/** Giant white letters on the slope, facing the city. */
function hillSign(ctx, S) {
  const text = S.name.toUpperCase();
  const dir = S.side === 'north' || S.side === 'east' ? 1 : -1; // so it reads left to right from the city
  const face = { north: 0, south: Math.PI, west: Math.PI / 2, east: -Math.PI / 2 }[S.side];
  const step = 5.4;
  const span = (text.length - 1) * step;
  const uStart = S.pu + 14;
  const H = 18; // stand the letters along this contour
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, side: THREE.DoubleSide, alphaTest: 0.5 });
  const posts = [];
  const grp = new THREE.Group(); // a group, so the letters aren't culled with the small signs when far away
  ctx.group.add(grp);
  for (let k = 0; k < text.length; k++) {
    const ch = text[k];
    if (ch === ' ') continue;
    const u = dir > 0 ? uStart + k * step : uStart + span - k * step;
    let v = 12;
    while (v < S.pv && hillH(S, u, v) < H) v += 0.5;
    const y = ctx.K.CURB + hillH(S, u, v);
    const [x, z] = toXZ(S, u, v);
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 160;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff';
    g.font = 'bold 150px Arial, Helvetica, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, 64, 88);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 6.25), mat.clone());
    m.material.map = tex;
    m.position.set(x, y + 3.2, z);
    m.rotation.y = face;
    m.rotateX(-0.12); // leaning back into the hill
    m.castShadow = true;
    grp.add(m);
    // scaffolding behind each letter
    const bx = x - Math.sin(face) * 0.6;
    const bz = z - Math.cos(face) * 0.6;
    for (const s of [-1.6, 0, 1.6]) {
      const px = bx + Math.cos(face) * s;
      const pz = bz - Math.sin(face) * s;
      posts.push(new THREE.BoxGeometry(0.12, 6, 0.12).translate(px, y + 2.6, pz));
    }
    ctx.colliders.add(Math.min(x, bx) - 2.6, Math.min(z, bz) - 2.6, Math.max(x, bx) + 2.6, Math.max(z, bz) + 2.6, y + 6.5, y - 1);
  }
  if (posts.length) grp.add(new THREE.Mesh(mergeGeometries(posts), new THREE.MeshStandardMaterial({ color: '#7a7f86', roughness: 0.6, metalness: 0.4 })));
}

/** Strings of bulbs zigzagging between the street lamps across the road. */
function festoons(ctx, districtIds) {
  const { blocks, K } = ctx;
  const ids = new Set(districtIds);
  const L = ctx.lampPositions || [];
  const heads = [];
  for (let i = 0; i < L.length; i += 2) {
    const x = L[i];
    const z = L[i + 1];
    const b = blocks.find((q) => x >= q.x0 - 2 && x <= q.x1 + 2 && z >= q.z0 - 2 && z <= q.z1 + 2);
    if (b && ids.has(b.district.id)) heads.push({ x, z });
  }
  const Y = K.CURB + 5.7;
  const bulbs = [];
  const wire = [];
  const seen = new Set();
  const link = (a, b) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.floor(len / 0.8);
    let px = a.x;
    let py = Y;
    let pz = a.z;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      const y = Y - Math.sin(t * Math.PI) * 0.9;
      wire.push(px, py, pz, x, y, z);
      if (i < n) bulbs.push([x, y - 0.12, z]);
      px = x;
      py = y;
      pz = z;
    }
  };
  for (const a of heads) {
    for (const b of heads) {
      if (a === b) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      const key = [heads.indexOf(a), heads.indexOf(b)].sort().join(':');
      if (seen.has(key)) continue;
      // straight across the road, and diagonals between neighbouring pairs
      const across = d > 11.5 && d < 14.5 && (Math.abs(a.x - b.x) < 0.5 || Math.abs(a.z - b.z) < 0.5);
      const diag = d > 24 && d < 27 && Math.abs(Math.abs(a.x - b.x) - 13) < 1.6 !== Math.abs(Math.abs(a.z - b.z) - 13) < 1.6;
      if (!across && !diag) continue;
      seen.add(key);
      link(a, b);
    }
  }
  if (!bulbs.length) return;
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  ctx.group.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#2a2a2e' })));
  const COLORS = ['#ffd58a', '#ff8a6a', '#8ad0ff', '#a8ff8a', '#ffb3e0'];
  const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 6, 4), mat, bulbs.length);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  bulbs.forEach(([x, y, z], i) => {
    inst.setMatrixAt(i, m.makeTranslation(x, y, z));
    inst.setColorAt(i, c.set(COLORS[i % COLORS.length]));
  });
  ctx.group.add(inst);
  ctx.animated.push(() => {
    const l = ctx.lampMat.color;
    mat.color.setScalar(Math.max(0.3, ((l.r + l.g + l.b) / 3) * 2.2));
  });
  ctx.themeStats = { ...(ctx.themeStats || {}), festoonBulbs: bulbs.length };
}

// ---- moving theme life --------------------------------------------------------
export class ThemeLife {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
  }

  setCity(city) {
    this.group.removeFromParent();
    this.group.clear();
    this.city = city;
    this.boats = [];
    this.bats = null;
    const T = city.cfg.theme || {};
    if (T.sailboats) this.makeBoats(city, T.sailboats);
    if (T.bats && city.bridge) this.makeBats(city);
    this.game.scene.add(this.group);
  }

  makeBoats(city, n) {
    const side = (city.cfg.waterfront || [])[0];
    if (!side) return;
    const rng = mulberry32(hashStr(city.cfg.name + ':boats'));
    const SAILS = ['#ffffff', '#ffffff', '#f2c230', '#c53a3a', '#2f6db5', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 5).translate(0, 0.2, 0), new THREE.MeshStandardMaterial({ color: pick(rng, ['#f4f4f2', '#1f3a5a', '#7a2230', '#f4f4f2']), roughness: 0.5 }));
      const bow = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4).scale(1, 0.5, 1).translate(0, 0.25, 3.2), hull.material);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 7, 6).translate(0, 4, 0.4), new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.6, roughness: 0.3 }));
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(0, 6.2);
      shape.lineTo(-2.8, 0.2);
      const sail = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateY(Math.PI / 2).translate(0, 1, 0.5), new THREE.MeshStandardMaterial({ color: pick(rng, SAILS), roughness: 0.8, side: THREE.DoubleSide }));
      g.add(hull, bow, mast, sail);
      this.group.add(g);
      this.boats.push({ g, sail, side, off: 70 + rng() * 160, a: (rng() - 0.5) * city.half * 2, v: (1.6 + rng() * 2.2) * (rng() < 0.5 ? 1 : -1), ph: rng() * 6 });
    }
  }

  makeBats(city) {
    const N = 420;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#1a1416', size: 0.28, sizeAttenuation: true }));
    pts.frustumCulled = false;
    pts.visible = false;
    this.group.add(pts);
    const b = city.bridge;
    // along the river, away from the bridge
    const ox = b.ox || 0;
    const oz = b.oz || 0;
    this.bats = { pts, N, seeds: Array.from({ length: N }, () => [Math.random(), Math.random() * 6.28, Math.random()]), x: b.mid.x, z: b.mid.z, dx: ox ? 0 : 1, dz: ox ? 1 : 0, ox, oz };
  }

  update(dt, pos, inside) {
    if (!this.city || !this.game.state) return;
    this.group.visible = !inside;
    if (inside) return;
    const t = performance.now() / 1000;
    // sailboats drift along the shore, heeling in the wind
    const half = this.city.half;
    for (const B of this.boats) {
      B.a += B.v * dt;
      if (B.a > half + 120) B.a = -half - 120;
      if (B.a < -half - 120) B.a = half + 120;
      const e = half + this.city.K.PROM + B.off;
      const s = B.side;
      const x = s === 'east' ? e : s === 'west' ? -e : B.a;
      const z = s === 'south' ? e : s === 'north' ? -e : B.a;
      B.g.position.set(x, Math.sin(t * 1.3 + B.ph) * 0.12, z);
      const along = s === 'east' || s === 'west' ? (B.v > 0 ? 0 : Math.PI) : B.v > 0 ? Math.PI / 2 : -Math.PI / 2;
      B.g.rotation.set(0, along, 0);
      B.g.rotateZ(0.14 + Math.sin(t * 0.7 + B.ph) * 0.05);
    }
    // Austin's bats: a river of them out from under the bridge at dusk
    const bats = this.bats;
    if (bats) {
      const st = this.game.state;
      const h = hourOf(st.time.total);
      const season = Math.floor(dayOf(st.time.total) / 28) % 4; // no bats in winter
      const on = h > 19.2 && h < 20.6 && season !== 3;
      bats.pts.visible = on;
      if (on) {
        const k = Math.min(1, (h - 19.2) / 0.3) * Math.min(1, (20.6 - h) / 0.3); // the stream thickens, then thins
        const a = bats.pts.geometry.attributes.position;
        for (let i = 0; i < bats.N; i++) {
          const [s0, ph, w] = bats.seeds[i];
          if (s0 > k) {
            a.setXYZ(i, 0, -50, 0);
            continue;
          }
          const s = (s0 * 160 + t * 7) % 160; // along the stream
          const lat = Math.sin(s * 0.05 + ph) * (4 + s * 0.12) + (w - 0.5) * (3 + s * 0.08);
          const y = 2.5 + s * 0.28 + Math.sin(t * 9 + ph) * 0.15 + Math.sin(s * 0.08 + ph) * 2;
          // out from under the deck, then off along the river
          a.setXYZ(i, bats.x + bats.dx * s + bats.ox * lat, y, bats.z + bats.dz * s + bats.oz * lat);
        }
        a.needsUpdate = true;
        if (st.flags.batsDay !== dayOf(st.time.total) && (pos.x - bats.x) ** 2 + (pos.z - bats.z) ** 2 < 220 * 220) {
          st.flags.batsDay = dayOf(st.time.total);
          this.game.events.emit('toast', { icon: '🦇', title: 'The bats are out!', text: 'A ribbon of bats pours out from under the bridge into the dusk. People on the bank cheer.', kind: 'info', long: true });
        }
      }
    }
  }
}
