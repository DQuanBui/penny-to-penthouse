// Procedural vehicles (front faces +Z). One parametric builder makes every
// body style — compact hatchback, sedan, sport sedan, coupé, supercar, SUV,
// pickup, box truck, taxi and police car — from a side profile with wheel
// arches, a glass greenhouse, pillars, bumpers, grille, lights and wheels.
// Glass is a separate geometry so it can be see-through, with a driver inside.
//
// Vertex attributes:
//   color  base colour            aTint  1 = paint (takes the instance colour)
//   aLight 1 = head/tail light that glows after dark
//          2 / 3 = left / right indicator (blinks with the instance aSignal -1 / +1)
//          4 / 5 = red / blue police light bar (flashes when aSignal = 2)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldUniforms } from './Buildings.js';

let parts = [];
function add(geo, color, tint = 0, light = 0, list = parts) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const n = geo.attributes.position.count;
  const c = new THREE.Color(color);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal'].includes(k)) geo.deleteAttribute(k);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(n).fill(tint), 1));
  geo.setAttribute('aLight', new THREE.BufferAttribute(new Float32Array(n).fill(light), 1));
  list.push(geo);
}

let LOW = false;
/** Extrude a side profile (x = forward, y = up) across the width, centred. */
function profile(shape, width, bevel = 0.05) {
  const b = LOW ? 0 : bevel;
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - b * 2, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: LOW ? 3 : 10 });
  g.rotateY(-Math.PI / 2); // profile x -> world z, extrusion -> world -x
  g.translate(width / 2 - b, 0, 0);
  return g;
}

/** A thin bar from (z1,y1) to (z2,y2) at side offset x (pillars, rails). */
function beam(z1, y1, z2, y2, x, t, color, tint = 1) {
  const dz = z2 - z1;
  const dy = y2 - y1;
  const len = Math.hypot(dz, dy);
  add(new THREE.BoxGeometry(t, t, len).rotateX(Math.atan2(-dy, dz)).translate(x, (y1 + y2) / 2, (z1 + z2) / 2), color, tint);
}

// Body styles. Lengths are half-lengths along the car (profile x = world z).
//   L half length · W width · wb half wheelbase · wr wheel radius · sill body bottom
//   nose front face top · hood bonnet height at the windscreen · belt waist line
//   ws windscreen base · roofF/roofR roof front/rear · rear rear-glass base · roof height
export const BODIES = {
  compact: { L: 1.95, W: 1.72, wb: 1.23, wr: 0.31, sill: 0.3, nose: 0.62, hood: 0.86, belt: 0.92, ws: 1.02, roofF: 0.32, roofR: -1.5, rear: -1.86, roof: 1.5, tail: 'hatch' },
  sedan: { L: 2.12, W: 1.8, wb: 1.35, wr: 0.34, sill: 0.3, nose: 0.6, hood: 0.86, belt: 0.96, ws: 1.12, roofF: 0.32, roofR: -0.82, rear: -1.36, roof: 1.43, tail: 'sedan' },
  sport: { L: 2.32, W: 1.84, wb: 1.43, wr: 0.35, sill: 0.28, nose: 0.55, hood: 0.8, belt: 0.92, ws: 1.02, roofF: 0.12, roofR: -0.98, rear: -1.58, roof: 1.38, tail: 'sedan', grille: 'wide', skirts: true },
  coupe: { L: 2.2, W: 1.86, wb: 1.36, wr: 0.35, sill: 0.26, nose: 0.5, hood: 0.74, belt: 0.86, ws: 0.95, roofF: 0.0, roofR: -0.62, rear: -1.86, roof: 1.27, tail: 'fastback', spoiler: 'lip' },
  supercar: { L: 2.25, W: 1.98, wb: 1.34, wr: 0.34, sill: 0.2, nose: 0.36, hood: 0.6, belt: 0.76, ws: 1.15, roofF: 0.18, roofR: -0.5, rear: -1.62, roof: 1.12, tail: 'wedge', spoiler: 'wing', intakes: true, grille: 'slit' },
  suv: { L: 2.35, W: 1.92, wb: 1.45, wr: 0.4, sill: 0.42, nose: 0.86, hood: 1.08, belt: 1.15, ws: 1.25, roofF: 0.52, roofR: -2.02, rear: -2.26, roof: 1.84, tail: 'wagon', rails: true, cladding: true },
  pickup: { L: 2.7, W: 1.95, wb: 1.72, wr: 0.42, sill: 0.46, nose: 0.92, hood: 1.12, belt: 1.18, ws: 1.32, roofF: 0.62, roofR: -0.5, rear: -0.66, roof: 1.92, tail: 'bed', cladding: true },
  box: { L: 3.3, W: 2.2, wb: 2.05, wr: 0.45, sill: 0.5, nose: 1.02, hood: 1.28, belt: 1.36, ws: 2.62, roofF: 2.3, roofR: 1.35, rear: 1.3, roof: 2.45, tail: 'box' },
};
// variants of the sedan
BODIES.taxi = { ...BODIES.sedan, extra: 'taxi' };
BODIES.police = { ...BODIES.sedan, extra: 'police' };
// emergency trucks on the box-truck chassis
BODIES.firetruck = { ...BODIES.box, L: 3.9, extra: 'fire' };
// two wheels: scooters and sport bikes (with a rider), and riderless ones for you
BODIES.scooter = { L: 0.95, W: 0.75, moto: 'scooter' };
BODIES.motorbike = { L: 1.08, W: 0.8, moto: 'sport' };
BODIES.scooter_solo = { ...BODIES.scooter, solo: true };
BODIES.motorbike_solo = { ...BODIES.motorbike, solo: true };
BODIES.ambulance = { ...BODIES.box, extra: 'ambulance' };

/** Collision half-sizes per style (hw half width, hl half length). */
export const BODY_DIMS = Object.fromEntries(Object.entries(BODIES).map(([k, b]) => [k, { hw: b.W / 2 + 0.02, hl: b.L + 0.05 }]));

const cache = new Map();

/**
 * Geometry for a body style. Returns { body, glass } (glass null when low).
 * low = light version for parked cars (glass merged in, no driver, fewer segments).
 */
export function vehicleGeometry(type = 'sedan', { low = false } = {}) {
  const key = type + (low ? ':low' : '');
  if (!cache.has(key)) {
    LOW = low;
    const B = BODIES[type] || BODIES.sedan;
    cache.set(key, B.moto ? buildMoto(B, low) : buildBody(B, low));
    LOW = false;
  }
  const c = cache.get(key);
  return { body: c.body.clone(), glass: c.glass ? c.glass.clone() : null, dims: BODY_DIMS[type] || BODY_DIMS.sedan };
}

/** Back-compat: a single sedan geometry (glass merged in). */
export function carGeometry(opts = {}) {
  return vehicleGeometry(opts.type || 'sedan', { low: true }).body;
}

/** See-through tinted glass for the separate glass geometry. */
export function glassMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#2a3a4a', transparent: true, opacity: 0.5, roughness: 0.06, metalness: 0.5, depthWrite: false });
}

function buildBody(B, low) {
  parts = [];
  const glassParts = [];
  const PAINT = '#ffffff';
  const { L, W, wb, wr, sill, nose, hood, belt, ws, roofF, roofR, rear, roof } = B;
  const arch = wr + 0.05;
  // ---- lower body: wheel arches, nose, bonnet, waist, tail ----
  const s = new THREE.Shape();
  s.moveTo(-L, sill);
  s.lineTo(-wb - arch, sill);
  s.absarc(-wb, sill, arch, Math.PI, 0, true);
  s.lineTo(wb - arch, sill);
  s.absarc(wb, sill, arch, Math.PI, 0, true);
  s.lineTo(L, sill);
  s.lineTo(L + 0.03, nose);
  s.quadraticCurveTo(L, hood + 0.02, L - 0.3, hood);
  s.lineTo(ws, belt);
  if (B.tail === 'sedan') {
    s.lineTo(rear, belt);
    s.quadraticCurveTo(-L + 0.05, belt + 0.02, -L, belt - 0.16);
  } else if (B.tail === 'fastback' || B.tail === 'wedge') {
    s.lineTo(rear, belt);
    s.lineTo(-L, belt - (B.tail === 'wedge' ? 0.02 : 0.12));
  } else {
    s.lineTo(-L + 0.06, belt);
  }
  s.lineTo(-L, sill);
  add(profile(s, W, 0.06), PAINT, 1);

  // ---- greenhouse: windscreen, side windows, rear glass ----
  const g = new THREE.Shape();
  const gl = low ? parts : glassParts;
  const glassC = '#141a22';
  if (B.tail === 'box') {
    // truck cab: upright glass at the front of a tall cab
    g.moveTo(ws, belt);
    g.lineTo(roofF, roof);
    g.lineTo(roofR, roof);
    g.lineTo(rear, belt);
  } else {
    g.moveTo(ws, belt - 0.02);
    g.quadraticCurveTo((ws + roofF) / 2 + 0.05, roof - 0.04, roofF, roof);
    g.lineTo(roofR, roof);
    if (B.tail === 'sedan') g.quadraticCurveTo(roofR - 0.25, roof - 0.12, rear, belt - 0.02);
    else if (B.tail === 'hatch' || B.tail === 'wagon') g.lineTo(rear, belt - 0.02);
    else if (B.tail === 'bed') g.lineTo(rear, belt - 0.02);
    else g.quadraticCurveTo(roofR - 0.4, roof - 0.1, rear, belt - 0.02);
  }
  g.closePath();
  add(profile(g, W - 0.24, 0.03), glassC, 0, 0, gl);
  // roof panel over the glass
  const r = new THREE.Shape();
  r.moveTo(roofF + 0.04, roof - 0.05);
  r.lineTo(roofF - 0.02, roof + 0.03);
  r.lineTo(roofR + 0.02, roof + 0.04);
  r.lineTo(roofR - 0.03, roof - 0.05);
  r.closePath();
  add(profile(r, W - 0.3, 0.02), PAINT, 1);
  // pillars on both sides, and mirrors
  const px = W / 2 - 0.14;
  for (const x of [-px, px]) {
    beam(ws - 0.02, belt, roofF, roof, x, 0.07, PAINT);
    beam(roofR, roof, rear, belt, x, 0.08, PAINT);
    if (B.tail !== 'box') add(new THREE.BoxGeometry(0.06, roof - belt - 0.06, 0.1).translate(x, (roof + belt) / 2, (roofF + roofR) / 2 + 0.1), PAINT, 1);
    add(new THREE.BoxGeometry(0.16, 0.09, 0.1).translate(x * 1.28, belt + 0.08, ws - 0.15), PAINT, 1);
  }

  // ---- style details ----
  if (B.tail === 'bed') {
    // open cargo bed behind the cab: liner, side rails, tailgate
    const bl = rear + L;
    add(new THREE.BoxGeometry(W - 0.25, 0.03, bl - 0.15).translate(0, belt + 0.01, (rear - L) / 2), '#24262b');
    for (const x of [-(W / 2 - 0.06), W / 2 - 0.06]) add(new THREE.BoxGeometry(0.1, 0.36, bl).translate(x, belt + 0.18, (rear - L) / 2), PAINT, 1);
    add(new THREE.BoxGeometry(W - 0.02, 0.36, 0.08).translate(0, belt + 0.18, -L + 0.04), PAINT, 1);
    add(new THREE.BoxGeometry(W - 0.02, 0.36, 0.08).translate(0, belt + 0.18, rear - 0.04), PAINT, 1);
  }
  if (B.tail === 'box') {
    // cargo box: white sides with a band in the company colour
    const bx0 = -L;
    const bx1 = roofR - 0.15;
    const len = bx1 - bx0;
    add(new THREE.BoxGeometry(W + 0.1, 2.5, len).translate(0, sill + 0.15 + 1.25 + 0.3, (bx0 + bx1) / 2), '#f2f3f5');
    for (const x of [-(W / 2 + 0.06), W / 2 + 0.06]) add(new THREE.BoxGeometry(0.02, 0.5, len - 0.4).translate(x, sill + 1.8, (bx0 + bx1) / 2), PAINT, 1);
    add(new THREE.BoxGeometry(W - 0.2, 2.2, 0.03).translate(0, sill + 1.75, bx0 - 0.02), '#d6d9de');
  }
  if (B.rails) for (const x of [-(W / 2 - 0.3), W / 2 - 0.3]) add(new THREE.BoxGeometry(0.05, 0.06, roofF - roofR - 0.2).translate(x, roof + 0.08, (roofF + roofR) / 2), '#2b2d33');
  if (B.cladding) for (const x of [-(W / 2 + 0.005), W / 2 + 0.005]) add(new THREE.BoxGeometry(0.02, 0.14, 2 * wb - 2 * arch - 0.1).translate(x, sill + 0.12, 0), '#2b2d33');
  if (B.skirts) for (const x of [-(W / 2 + 0.01), W / 2 + 0.01]) add(new THREE.BoxGeometry(0.03, 0.08, 2 * wb - 2 * arch - 0.1).translate(x, sill + 0.05, 0), '#1d1f24');
  if (B.intakes) for (const x of [-(W / 2 + 0.01), W / 2 + 0.01]) add(new THREE.BoxGeometry(0.04, 0.22, 0.7).translate(x, belt - 0.25, -wb + arch + 0.5), '#121316');
  if (B.spoiler === 'wing') {
    add(new THREE.BoxGeometry(W - 0.2, 0.05, 0.38).translate(0, belt + 0.38, -L + 0.25), PAINT, 1);
    for (const x of [-0.55, 0.55]) add(new THREE.BoxGeometry(0.05, 0.36, 0.1).translate(x, belt + 0.18, -L + 0.3), '#1d1f24');
  } else if (B.spoiler === 'lip') add(new THREE.BoxGeometry(W - 0.4, 0.04, 0.14).translate(0, belt + 0.02, -L + 0.1), PAINT, 1);
  if (B.extra === 'taxi') {
    add(new THREE.BoxGeometry(0.62, 0.2, 0.26).translate(0, roof + 0.13, (roofF + roofR) / 2), '#fff3c4', 0, 1);
    for (const x of [-(W / 2 + 0.005), W / 2 + 0.005]) add(new THREE.BoxGeometry(0.02, 0.1, 2.2).translate(x, belt - 0.12, 0), '#1d1f24');
  }
  if (B.extra === 'police') {
    add(new THREE.BoxGeometry(0.62, 0.1, 0.24).translate(-0.33, roof + 0.08, (roofF + roofR) / 2), '#e3122e', 0, 4);
    add(new THREE.BoxGeometry(0.62, 0.1, 0.24).translate(0.33, roof + 0.08, (roofF + roofR) / 2), '#1f5fe0', 0, 5);
    for (const x of [-(W / 2 + 0.005), W / 2 + 0.005]) {
      add(new THREE.BoxGeometry(0.02, 0.16, 2.6).translate(x, belt - 0.16, 0.1), '#1f3a7a');
      add(new THREE.BoxGeometry(0.02, 0.06, 2.6).translate(x, belt - 0.02, 0.1), '#2f6fd0');
    }
  }

  if (B.extra === 'fire' || B.extra === 'ambulance') {
    // a light bar over the cab: alternating flashers (aLight 4 / 5)
    const zc = L - 0.95;
    const c2 = B.extra === 'fire' ? '#ffffff' : '#1f5fe0';
    add(new THREE.BoxGeometry(0.62, 0.12, 0.26).translate(-0.4, roof + 0.08, zc), '#e3122e', 0, 4);
    add(new THREE.BoxGeometry(0.62, 0.12, 0.26).translate(0.4, roof + 0.08, zc), c2, 0, 5);
    for (const x of [-(W / 2 + 0.005), W / 2 + 0.005]) {
      add(new THREE.BoxGeometry(0.02, 0.14, L * 1.7).translate(x, belt - 0.1, -0.2), B.extra === 'fire' ? '#f2d24a' : '#d81e1e');
      add(new THREE.BoxGeometry(0.02, 0.05, L * 1.7).translate(x, belt + 0.06, -0.2), B.extra === 'fire' ? '#f4f4f2' : '#1f5fe0');
    }
    if (B.extra === 'fire') {
      // the ladder along the roof, chrome compartment doors on the side
      for (const x of [-0.45, 0.45]) add(new THREE.BoxGeometry(0.06, 0.08, L * 1.55).translate(x, roof + 0.2, -0.45), '#c9ced6');
      for (let z = -L + 0.4; z < L - 1.4; z += 0.38) add(new THREE.BoxGeometry(0.9, 0.04, 0.04).translate(0, roof + 0.2, z), '#c9ced6');
      for (const x of [-(W / 2 + 0.01), W / 2 + 0.01]) for (let z = -L + 0.5; z < L - 2; z += 0.9) add(new THREE.BoxGeometry(0.02, 0.6, 0.75).translate(x, sill + 0.55, z), '#b9bdc3');
    }
  }

  // ---- front and back ----
  const bw = W - 0.1;
  add(new THREE.BoxGeometry(bw, 0.2, 0.12).translate(0, sill + 0.12, L + 0.04), B.tail === 'box' ? '#2b2d33' : '#26282d');
  add(new THREE.BoxGeometry(bw, 0.2, 0.12).translate(0, sill + 0.12, -L - 0.01), '#26282d');
  if (B.grille === 'slit') add(new THREE.BoxGeometry(W * 0.6, 0.06, 0.05).translate(0, sill + 0.22, L + 0.06), '#0d0e10');
  else add(new THREE.BoxGeometry(B.grille === 'wide' ? W * 0.62 : W * 0.5, (nose - sill) * 0.45, 0.05).translate(0, sill + (nose - sill) * 0.62, L + 0.03), '#1a1b1f');
  add(new THREE.BoxGeometry(0.46, 0.12, 0.02).translate(0, sill + 0.14, L + 0.11), '#f2f2f0');
  add(new THREE.BoxGeometry(0.46, 0.12, 0.02).translate(0, Math.min(belt - 0.25, sill + 0.35), -L - 0.07), '#f2f2f0');
  const lx = W / 2 - 0.28;
  for (const x of [-lx, lx]) {
    const hy = (nose + hood) / 2 - 0.04;
    add(new THREE.BoxGeometry(B.extra === undefined && B.tail === 'wedge' ? 0.4 : 0.34, B.tail === 'wedge' ? 0.06 : 0.11, 0.06).translate(x, hy, L + 0.01), '#fff6dc', 0, 1);
    const ty = B.tail === 'box' ? sill + 0.5 : belt - 0.16;
    add(new THREE.BoxGeometry(B.tail === 'wedge' ? 0.5 : 0.32, 0.1, 0.05).translate(x, ty, -L - 0.01), '#d81e1e', 0, 1);
    const side = x > 0 ? 2 : 3;
    add(new THREE.BoxGeometry(0.12, 0.07, 0.06).translate(x * 1.2, hy - 0.08, L + 0.0), '#ff9a1a', 0, side);
    add(new THREE.BoxGeometry(0.1, 0.07, 0.05).translate(x * 1.18, ty + 0.1, -L - 0.01), '#ff9a1a', 0, side);
  }
  // ---- wheels ----
  const wx = W / 2 - 0.1;
  const tyre = B.tail === 'box' || B.tail === 'bed' ? 0.3 : 0.24;
  for (const x of [-wx, wx]) {
    for (const z of [-wb, wb]) {
      add(new THREE.CylinderGeometry(wr, wr, tyre, low ? 12 : 18).rotateZ(Math.PI / 2).translate(x, wr, z), '#16171a');
      add(new THREE.CylinderGeometry(wr * 0.6, wr * 0.6, tyre + 0.01, low ? 8 : 12).rotateZ(Math.PI / 2).translate(x * 1.01, wr, z), B.tail === 'wedge' ? '#2b2d33' : '#a9afb7');
    }
  }
  // ---- a driver behind the wheel (visible through the glass) ----
  if (!low) {
    const dz = B.tail === 'box' ? ws - 0.6 : (ws + roofR) / 2 + 0.15;
    const seatY = belt - 0.32;
    add(new THREE.BoxGeometry(0.38, 0.5, 0.26).translate(0.38, seatY + 0.3, dz - 0.1), '#2b3448');
    add(new THREE.SphereGeometry(0.11, 10, 8).translate(0.38, seatY + 0.68, dz - 0.04), '#c99a7a');
    add(new THREE.SphereGeometry(0.115, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5).translate(0.38, seatY + 0.7, dz - 0.07), '#2e1f16');
    add(new THREE.TorusGeometry(0.16, 0.02, 5, 14).rotateX(-0.4).translate(0.38, seatY + 0.42, dz + 0.32), '#1d1f24');
  }
  const body = mergeGeometries(parts);
  const glass = low ? null : mergeGeometries(glassParts);
  parts = [];
  return { body, glass };
}


/** A scooter or a sport motorbike (front faces +Z), with a rider unless B.solo. */
function buildMoto(B, low) {
  parts = [];
  const PAINT = '#ffffff';
  const sport = B.moto === 'sport';
  const wr = sport ? 0.31 : 0.24;
  const wz = sport ? 0.7 : 0.6;
  const seg = low ? 10 : 16;
  for (const z of [-wz, wz]) {
    add(new THREE.CylinderGeometry(wr, wr, sport ? 0.17 : 0.12, seg).rotateZ(Math.PI / 2).translate(0, wr, z), '#16171a');
    add(new THREE.CylinderGeometry(wr * 0.55, wr * 0.55, (sport ? 0.17 : 0.12) + 0.01, 10).rotateZ(Math.PI / 2).translate(0, wr, z), '#a9afb7');
  }
  if (sport) {
    add(new THREE.BoxGeometry(0.34, 0.3, 0.46).translate(0, 0.5, 0.02), '#3a3d44'); // engine
    add(new THREE.BoxGeometry(0.36, 0.22, 0.5).translate(0, 0.86, 0.14), PAINT, 1); // tank
    add(new THREE.BoxGeometry(0.44, 0.38, 0.34).translate(0, 0.8, 0.56), PAINT, 1); // fairing
    add(new THREE.BoxGeometry(0.3, 0.16, 0.06).rotateX(-0.6).translate(0, 1.05, 0.64), '#2a3a4a'); // windscreen
    add(new THREE.BoxGeometry(0.3, 0.08, 0.5).translate(0, 0.9, -0.33), '#1d1f24'); // seat
    add(new THREE.BoxGeometry(0.26, 0.14, 0.34).translate(0, 0.94, -0.64), PAINT, 1); // tail
    add(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 8).rotateX(Math.PI / 2).translate(0.2, 0.42, -0.45), '#b9bdc3'); // exhaust
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 6).rotateX(-0.45).translate(0, 0.62, 0.66), '#b9bdc3'); // fork
    add(new THREE.CylinderGeometry(0.016, 0.016, 0.62, 6).rotateZ(Math.PI / 2).translate(0, 0.98, 0.5), '#2b2d33'); // bars
    add(new THREE.BoxGeometry(0.16, 0.08, 0.04).translate(0, 0.82, 0.74), '#fff6dc', 0, 1);
    add(new THREE.BoxGeometry(0.14, 0.05, 0.04).translate(0, 0.94, -0.82), '#d81e1e', 0, 1);
  } else {
    add(new THREE.BoxGeometry(0.36, 0.07, 0.72).translate(0, 0.3, 0.02), '#2b2d33'); // floorboard
    add(new THREE.BoxGeometry(0.42, 0.38, 0.62).translate(0, 0.52, -0.36), PAINT, 1); // rear body
    add(new THREE.BoxGeometry(0.34, 0.1, 0.56).translate(0, 0.76, -0.3), '#1d1f24'); // seat
    add(new THREE.BoxGeometry(0.44, 0.72, 0.1).rotateX(-0.2).translate(0, 0.62, 0.42), PAINT, 1); // leg shield
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6).rotateX(-0.25).translate(0, 0.86, 0.5), '#b9bdc3'); // column
    add(new THREE.CylinderGeometry(0.016, 0.016, 0.62, 6).rotateZ(Math.PI / 2).translate(0, 1.08, 0.46), '#2b2d33'); // bars
    add(new THREE.BoxGeometry(0.2, 0.14, 0.12).translate(0, 1.04, 0.52), PAINT, 1); // headset
    add(new THREE.BoxGeometry(0.12, 0.08, 0.04).translate(0, 1.02, 0.59), '#fff6dc', 0, 1);
    add(new THREE.BoxGeometry(0.16, 0.05, 0.04).translate(0, 0.62, -0.68), '#d81e1e', 0, 1);
    add(new THREE.SphereGeometry(0.26, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.9, 0.5, 1.2).translate(0, 0.38, wz), PAINT, 1); // front mudguard
  }
  if (!B.solo) {
    // the rider: jacket, jeans, a helmet in the bike's colour
    const lean = sport ? 0.55 : 0.12;
    const hipY = sport ? 0.98 : 0.86;
    const hz = sport ? -0.28 : -0.22;
    add(new THREE.CapsuleGeometry(0.15, 0.32, 4, 10).rotateX(lean).translate(0, hipY + 0.28, hz + Math.sin(lean) * 0.25), '#2b3448');
    add(new THREE.SphereGeometry(0.15, 12, 9).translate(0, hipY + 0.62 - lean * 0.12, hz + Math.sin(lean) * 0.5 + 0.02), PAINT, 1);
    add(new THREE.BoxGeometry(0.2, 0.07, 0.03).translate(0, hipY + 0.6 - lean * 0.12, hz + Math.sin(lean) * 0.5 + 0.17), '#1d1f24');
    for (const s of [-1, 1]) {
      add(new THREE.CapsuleGeometry(0.05, 0.42, 4, 8).rotateX(-1.1 + lean * 0.4).translate(s * 0.2, hipY + 0.36, hz + 0.32), '#2b3448');
      add(new THREE.CapsuleGeometry(0.065, 0.36, 4, 8).rotateX(-1.4).translate(s * 0.13, hipY, hz + 0.18), '#27406b');
      add(new THREE.CapsuleGeometry(0.055, 0.34, 4, 8).rotateX(sport ? 0.5 : 0.1).translate(s * 0.15, hipY - 0.32, hz + 0.32), '#27406b');
    }
  }
  const body = mergeGeometries(parts);
  parts = [];
  return { body, glass: null };
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
  const { signals, ...rest } = opts;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.4, ...rest });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = worldUniforms.uNight;
    shader.uniforms.uTime = worldUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTint;\nattribute float aLight;\nvarying float vLight;\nuniform float uTime;' + (signals ? '\nattribute float aSignal;' : ''))
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        #if defined( USE_INSTANCING_COLOR ) && defined( USE_COLOR )
          vColor.rgb = color.rgb * mix(vec3(1.0), instanceColor.rgb, aTint);
        #endif
        vLight = aLight;
        ` +
          (signals
            ? 'if (aLight > 3.5) { float ph = step(0.5, fract(uTime * 2.2)); vLight = aSignal > 1.5 ? (aLight < 4.5 ? ph : 1.0 - ph) * 3.0 : 0.4; } else if (aLight > 1.5) { float side = aLight < 2.5 ? -1.0 : 1.0; vLight = (abs(aSignal - side) < 0.1 && fract(uTime * 1.5) < 0.5) ? 3.0 : 0.0; }'
            : 'if (aLight > 1.5) vLight = 0.0;'),
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying float vLight;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * (vLight > 2.5 ? 1.8 : vLight * (0.25 + uNight * 2.4));');
  };
  mat.customProgramCacheKey = () => (signals ? 'car-sig' : 'car');
  return mat;
}
