// Procedural humanoid: rounded torso and tapered limbs, a modelled face
// (eyes, lashes, brows, nose, smile), 14 hairstyles, clothing and accessories.
// All parts are merged into ONE vertex-coloured SkinnedMesh (a single draw
// call) bound to a 17-bone skeleton that Animation.js drives procedurally.
// If GLB character models are present they are used instead (see GLBCharacters.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Tex } from '../world/Textures.js';
import { defaultAppearance } from './Customization.js';
import { buildGLBCharacter } from './GLBCharacters.js';

/** Preferred entry point: uses a GLB model when the look names one that is loaded, else the procedural body. */
export function createRig(appearance, opts) {
  if (appearance?.model) {
    const rig = buildGLBCharacter(appearance.model, appearance.height || 1);
    if (rig) return rig;
  }
  return buildCharacter(appearance, opts);
}

export const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const BI = Object.fromEntries(BONES.map((n, i) => [n, i]));
const PARENT = { spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', armL: 'chest', foreL: 'armL', handL: 'foreL', armR: 'chest', foreR: 'armR', handR: 'foreR', thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR' };

// shoulder half-width, torso radius (x), torso depth (z), hip radius, limb thickness
const BODY = {
  slim: { sh: 0.172, tr: 0.126, td: 0.09, hip: 0.128, limb: 0.9, belly: 0 },
  average: { sh: 0.188, tr: 0.142, td: 0.1, hip: 0.142, limb: 1.0, belly: 0 },
  athletic: { sh: 0.214, tr: 0.156, td: 0.106, hip: 0.142, limb: 1.13, belly: 0 },
  curvy: { sh: 0.178, tr: 0.138, td: 0.104, hip: 0.166, limb: 1.02, belly: 0.3 },
  heavy: { sh: 0.204, tr: 0.176, td: 0.142, hip: 0.18, limb: 1.2, belly: 1 },
};
const FACE = { oval: [0.94, 1.1, 1.0], round: [1.03, 1.03, 1.03], square: [1.0, 1.06, 0.98], heart: [0.98, 1.08, 1.0] };
const EYE = { round: [1, 1], almond: [1.25, 0.78], wide: [1.15, 1.12], narrow: [1.2, 0.6] };
const LONG_SLEEVE = { shirt: 1, hoodie: 1, sweater: 1, blazer: 1, jacket: 1 };

const HEAD_SCALE = 1.17;
const HEAD_PIVOT = 1.515;
const LIFT = 0.065; // legs are shortened by this much; the mesh is lowered to keep feet on the ground

let sharedMaterial = null;
const material = () => (sharedMaterial ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 }));

const _c = new THREE.Color();
const _q = new THREE.Quaternion();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Collects positioned geometries, each rigidly skinned to one bone. */
class Parts {
  constructor() {
    this.list = [];
  }
  add(geo, bone, color) {
    if (bone === 'head') geo.translate(0, -HEAD_PIVOT, 0).scale(HEAD_SCALE, HEAD_SCALE, HEAD_SCALE).translate(0, HEAD_PIVOT, 0);
    const n = geo.attributes.position.count;
    _c.set(color);
    const col = new Float32Array(n * 3);
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    const b = BI[bone];
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r;
      col[i * 3 + 1] = _c.g;
      col[i * 3 + 2] = _c.b;
      si[i * 4] = b;
      sw[i * 4] = 1;
    }
    geo.deleteAttribute('uv');
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    this.list.push(geo);
    return geo;
  }
}

const sph = (r, sx = 1, sy = 1, sz = 1, seg = 12) => new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))).scale(sx, sy, sz);
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
/** Tapered open cylinder from point a (radius r0) to point b (radius r1). */
function seg(a, b, r0, r1, radial = 10) {
  _v1.set(a[0], a[1], a[2]);
  _v2.set(b[0], b[1], b[2]);
  const len = _v1.distanceTo(_v2);
  const g = new THREE.CylinderGeometry(r0, r1, len, radial, 1, true);
  _q.setFromUnitVectors(UP, _v1.clone().sub(_v2).normalize());
  g.applyQuaternion(_q);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}
const shade = (hex, f) => '#' + _c.set(hex).multiplyScalar(f).getHexString();
const mix = (a, b, t) => '#' + _c.set(a).lerp(new THREE.Color(b), t).getHexString();

/**
 * Build a procedural character.
 * @returns rig { group, mesh, bones, bind, anim, type:'procedural', dispose() }
 */
export function buildCharacter(appearance = defaultAppearance(), opts = {}) {
  const a = { ...defaultAppearance(), ...appearance };
  const B = BODY[a.body] || BODY.average;
  const P = new Parts();
  const skin = a.skin;
  const L = B.limb;

  // ---- joint positions (bind pose, metres, character faces +Z) ----
  const J = {
    hips: [0, 0.96, 0], spine: [0, 1.06, 0], chest: [0, 1.22, 0], neck: [0, 1.46, 0], head: [0, 1.52, 0],
    armL: [B.sh, 1.405, 0], foreL: [B.sh + 0.032, 1.13, 0], handL: [B.sh + 0.05, 0.875, 0.01],
    thighL: [0.085, 0.92, 0], shinL: [0.09, 0.5 + LIFT * 0.55, 0], footL: [0.09, 0.085 + LIFT, 0],
  };
  for (const k of ['arm', 'fore', 'hand', 'thigh', 'shin', 'foot']) {
    const p = J[k + 'L'];
    J[k + 'R'] = [-p[0], p[1], p[2]];
  }

  const dress = a.top === 'dress';
  const skirt = !dress && a.bottom === 'skirt';
  const bareLegs = dress || skirt;
  const topC = a.topColor;
  const botC = dress ? a.topColor : a.bottomColor;
  const sleeveUpper = a.top === 'tank' ? skin : topC;
  const sleeveLower = LONG_SLEEVE[a.top] ? topC : skin;

  // ---- torso ----
  const chest = new THREE.CapsuleGeometry(B.tr, 0.17, 6, 16).scale(1, 1, B.td / B.tr).translate(0, 1.235, 0);
  P.add(chest, 'chest', topC);
  P.add(sph(1, B.sh + 0.004, 0.066, B.td * 0.94, 14).translate(0, 1.378, 0), 'chest', topC);
  // clean hem ring hides the seam where torso and hips meet
  P.add(new THREE.CylinderGeometry(B.tr * 1.05, B.tr * 1.06, 0.07, 20, 1, true).scale(1, 1, (B.td * (1.12 + B.belly * 0.26)) / B.tr).translate(0, 1.012, B.belly * 0.02), 'spine', shade(topC, 0.9));
  P.add(sph(1, B.tr * 0.96, 0.12 + B.belly * 0.03, B.td * (1 + B.belly * 0.22), 14).translate(0, 1.07 + B.belly * 0.02, B.belly * 0.022), 'spine', topC);
  P.add(sph(1, B.hip, 0.125, B.td * 1.06, 14).translate(0, 0.965, 0), 'hips', botC);
  P.add(new THREE.CylinderGeometry(0.046, 0.054, 0.13, 12).translate(0, 1.485, 0), 'neck', skin);

  // ---- arms + legs (mirrored) ----
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    const sh = J['arm' + s];
    const el = J['fore' + s];
    const wr = J['hand' + s];
    P.add(sph(0.056 * L).translate(sh[0] - m * 0.012, sh[1] - 0.012, sh[2]), 'chest', sleeveUpper);
    P.add(seg(sh, el, 0.055 * L, 0.046 * L), 'arm' + s, sleeveUpper);
    P.add(sph(0.047 * L).translate(el[0], el[1], el[2]), 'fore' + s, sleeveLower);
    P.add(seg(el, wr, 0.045 * L, 0.035 * L), 'fore' + s, sleeveLower);
    P.add(sph(0.045, 0.8, 1.15, 1).translate(wr[0], wr[1] - 0.038, wr[2]), 'hand' + s, skin);
    if (LONG_SLEEVE[a.top]) P.add(new THREE.CylinderGeometry(0.04 * L, 0.04 * L, 0.03, 10).translate(wr[0], wr[1] + 0.012, wr[2]), 'fore' + s, shade(topC, 0.85));

    const hp = J['thigh' + s];
    const kn = J['shin' + s];
    const an = J['foot' + s];
    const thighC = bareLegs ? skin : botC;
    const shinC = bareLegs || a.bottom === 'shorts' ? skin : botC;
    const tw = a.bottom === 'slacks' ? 0.92 : a.bottom === 'joggers' ? 1.06 : 1;
    P.add(sph(0.088 * L).translate(hp[0], hp[1], hp[2]), 'thigh' + s, thighC);
    P.add(seg(hp, kn, 0.088 * L * tw, 0.066 * L * tw), 'thigh' + s, thighC);
    P.add(sph(0.066 * L * tw).translate(kn[0], kn[1], kn[2]), 'shin' + s, shinC);
    P.add(seg(kn, an, 0.065 * L * tw, 0.05 * L * tw), 'shin' + s, shinC);
    if (a.bottom === 'shorts' && !bareLegs) P.add(new THREE.CylinderGeometry(0.074 * L, 0.078 * L, 0.05, 10).translate(kn[0], kn[1] + 0.07, kn[2]), 'thigh' + s, shade(botC, 0.9));

    // feet / shoes
    const sandal = a.shoes === 'sandals';
    const shoeC = sandal ? skin : a.shoeColor;
    const fy = a.shoes === 'dress' ? 0.7 : 0.86;
    P.add(new THREE.CapsuleGeometry(0.044, 0.13, 4, 10).rotateX(Math.PI / 2).scale(1.16, fy, 1.05).translate(an[0], 0.046 + LIFT, 0.05), 'foot' + s, shoeC);
    P.add(sph(0.052 * L).translate(an[0], an[1], an[2]), 'foot' + s, sandal ? skin : shoeC);
    if (a.shoes === 'sneakers') P.add(bx(0.092, 0.016, 0.24).translate(an[0], 0.009 + LIFT, 0.05), 'foot' + s, '#e9e9e4');
    if (a.shoes === 'boots') P.add(new THREE.CylinderGeometry(0.06 * L, 0.057 * L, 0.15, 10).translate(an[0], an[1] + 0.07, 0), 'shin' + s, shoeC);
    if (sandal) {
      P.add(bx(0.1, 0.016, 0.25).translate(an[0], 0.009 + LIFT, 0.05), 'foot' + s, a.shoeColor);
      P.add(bx(0.11, 0.02, 0.03).translate(an[0], 0.078 + LIFT, 0.08), 'foot' + s, a.shoeColor);
    }
  }

  // ---- clothing details ----
  const zf = B.td; // torso front
  if (dress) P.add(new THREE.CylinderGeometry(B.hip * 0.98, B.hip * 1.6, 0.44, 16, 1, true).translate(0, 0.8, 0), 'hips', topC);
  if (skirt) P.add(new THREE.CylinderGeometry(B.hip * 1.0, B.hip * 1.38, 0.3, 16, 1, true).translate(0, 0.86, 0), 'hips', botC);
  if (a.top === 'hoodie') {
    P.add(sph(1, 0.115, 0.07, 0.075).translate(0, 1.455, -0.075), 'chest', topC);
    P.add(bx(0.17, 0.075, 0.02).translate(0, 1.1, zf + 0.002), 'spine', shade(topC, 0.82));
    P.add(bx(0.008, 0.09, 0.008).translate(-0.025, 1.36, zf * 0.92), 'chest', '#f2f2f2');
    P.add(bx(0.008, 0.09, 0.008).translate(0.025, 1.36, zf * 0.92), 'chest', '#f2f2f2');
  } else if (a.top === 'shirt') {
    P.add(bx(0.014, 0.3, 0.006).translate(0, 1.25, zf + 0.001), 'chest', shade(topC, 1.25));
    P.add(bx(0.06, 0.03, 0.02).rotateZ(0.5).translate(-0.035, 1.455, 0.045), 'chest', shade(topC, 1.2));
    P.add(bx(0.06, 0.03, 0.02).rotateZ(-0.5).translate(0.035, 1.455, 0.045), 'chest', shade(topC, 1.2));
  } else if (a.top === 'blazer') {
    P.add(bx(0.075, 0.2, 0.006).translate(0, 1.325, zf * 0.985), 'chest', '#f4f4f2');
    P.add(bx(0.028, 0.17, 0.008).translate(0, 1.32, zf * 0.99 + 0.003), 'chest', a.accentColor || '#b5343c');
    P.add(bx(0.036, 0.21, 0.01).rotateZ(0.2).translate(-0.05, 1.325, zf * 0.985 + 0.002), 'chest', shade(topC, 0.78));
    P.add(bx(0.036, 0.21, 0.01).rotateZ(-0.2).translate(0.05, 1.325, zf * 0.985 + 0.002), 'chest', shade(topC, 0.78));
  } else if (a.top === 'jacket') {
    P.add(bx(0.075, 0.33, 0.006).translate(0, 1.25, zf + 0.001), 'chest', '#f1efe9');
    P.add(sph(1, 0.075, 0.03, 0.06).translate(0, 1.46, -0.01), 'chest', shade(topC, 0.8));
  } else if (a.top === 'sweater') {
    P.add(new THREE.TorusGeometry(0.052, 0.017, 6, 14).rotateX(Math.PI / 2).translate(0, 1.455, 0), 'chest', shade(topC, 0.88));
  }

  // ---- head + face ----
  const R = 0.112;
  const fs = FACE[a.face] || FACE.oval;
  const hx = fs[0] * R;
  const hy = fs[1] * R;
  const hz = fs[2] * R;
  const HY = 1.635;
  const faceZ = (x, y) => hz * Math.sqrt(Math.max(0.05, 1 - (x / hx) ** 2 - (y / hy) ** 2));
  P.add(sph(1, hx, hy, hz, 20).translate(0, HY, 0), 'head', skin);
  if (a.face === 'square') P.add(sph(1, hx * 0.9, hy * 0.5, hz * 0.86, 14).translate(0, HY - 0.052, 0.004), 'head', skin);
  for (const m of [-1, 1]) {
    P.add(sph(0.023, 0.45, 1, 0.7, 8).translate(m * hx * 0.98, HY - 0.002, -0.004), 'head', shade(skin, 0.96));
    // eye
    const es = EYE[a.eyeShape] || EYE.round;
    const ex = m * 0.043;
    const ey = 0.012;
    const ez = faceZ(ex, ey);
    P.add(sph(0.02, es[0], es[1], 0.34, 10).translate(ex, HY + ey, ez - 0.0045), 'head', '#f7f5f0');
    P.add(sph(0.0122, 1, Math.min(1, es[1] + 0.15), 0.4, 10).translate(ex, HY + ey, ez + 0.0015), 'head', a.eyes);
    P.add(sph(0.0062, 1, 1, 0.4, 8).translate(ex, HY + ey, ez + 0.0052), 'head', '#0c0c0e');
    P.add(sph(0.0026, 1, 1, 0.5, 6).translate(ex + 0.004, HY + ey + 0.004, ez + 0.0072), 'head', '#ffffff');
    P.add(bx(0.042 * es[0], 0.004, 0.006).rotateZ(-m * 0.06).translate(ex, HY + ey + 0.019 * es[1], ez + 0.0005), 'head', '#241a14');
    // brow
    const browC = a.hair === 'bald' ? '#3a2a1e' : mix(a.hairColor, '#1a1410', 0.35);
    const bt = a.brows === 'thick' ? 0.013 : 0.008;
    const br = a.brows === 'arched' ? 0.24 : a.brows === 'straight' ? 0 : 0.1;
    P.add(bx(0.042, bt, 0.009).rotateZ(-m * br).translate(ex, HY + 0.046, faceZ(ex, 0.046) + 0.003), 'head', browC);
  }
  P.add(sph(0.0125, 0.9, 1.15, 0.9, 8).translate(0, HY - 0.014, faceZ(0, -0.014) - 0.001), 'head', shade(skin, 0.94));
  P.add(new THREE.TorusGeometry(0.02, 0.0042, 5, 10, Math.PI).rotateZ(Math.PI).translate(0, HY - 0.04, faceZ(0, -0.05) + 0.001), 'head', mix(skin, '#8a2f3a', 0.6));

  addHair(P, a, { hx, hy, hz, HY, faceZ });
  addFacialHair(P, a, { hx, hy, hz, HY, faceZ });
  addAccessory(P, a, { hx, hy, hz, HY, faceZ, B, J });

  // ---- merge + skin ----
  const geo = mergeGeometries(P.list, false);
  for (const g of P.list) g.dispose();
  const bones = {};
  const boneList = BONES.map((n) => {
    const b = new THREE.Bone();
    b.name = n;
    bones[n] = b;
    return b;
  });
  for (const n of BONES) {
    const p = PARENT[n];
    const j = J[n];
    if (p) {
      const pj = J[p];
      bones[n].position.set(j[0] - pj[0], j[1] - pj[1], j[2] - pj[2]);
      bones[p].add(bones[n]);
    } else bones[n].position.set(j[0], j[1], j[2]);
  }
  const mesh = new THREE.SkinnedMesh(geo, material());
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.position.y = -LIFT;
  mesh.add(bones.hips);
  mesh.bind(new THREE.Skeleton(boneList));

  const group = new THREE.Group();
  group.add(mesh);
  group.scale.setScalar(a.height || 1);
  if (opts.blobShadow !== false) {
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: Tex.glow(), color: '#000000', transparent: true, opacity: 0.32, depthWrite: false }),
    );
    blob.position.y = 0.025;
    blob.renderOrder = 3;
    group.add(blob);
  }

  return {
    type: 'procedural',
    group,
    mesh,
    bones,
    hipsY: J.hips[1],
    appearance: a,
    anim: { phase: 0, amp: 0, air: 0, sit: 0, t: Math.random() * 10, talk: 0, wave: 0 },
    dispose() {
      geo.dispose();
      mesh.skeleton.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
function addHair(P, a, H) {
  const { hx, hy, hz, HY } = H;
  const style = a.hair;
  if (style === 'bald') return;
  const c = a.hairColor;
  const hat = a.accessory === 'cap' || a.accessory === 'beanie';
  /** Tilted spherical cap hugging the skull. */
  const cap = (s, theta, tilt, dy = 0) => new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, theta).scale(hx * s, hy * s, hz * s).rotateX(tilt).translate(0, HY + dy, 0);
  const top = (g) => {
    if (!hat) P.add(g, 'head', c);
  };
  const PI = Math.PI;
  switch (style) {
    case 'buzz':
      top(cap(1.035, 0.5 * PI, -0.3));
      break;
    case 'short':
      top(cap(1.075, 0.52 * PI, -0.38));
      top(sph(0.05, 1.6, 0.55, 1).translate(0, HY + 0.088, 0.066));
      break;
    case 'sidepart':
      top(cap(1.075, 0.52 * PI, -0.38));
      top(sph(0.058, 1.5, 0.5, 1.1).rotateZ(-0.3).translate(0.03, HY + 0.094, 0.058));
      break;
    case 'quiff':
      top(cap(1.065, 0.5 * PI, -0.42));
      top(sph(0.056, 1.25, 1.05, 1).translate(0, HY + 0.112, 0.058));
      break;
    case 'curly': {
      top(cap(1.05, 0.5 * PI, -0.35));
      for (let i = 0; i < 22; i++) {
        const t = (i + 0.5) / 22;
        const th = Math.acos(1 - t * 1.05); // polar angle from the top
        const ph = i * 2.39996;
        const x = Math.sin(th) * Math.cos(ph);
        const y = Math.cos(th);
        const z = Math.sin(th) * Math.sin(ph);
        if (z > 0.55 && y < 0.45) continue; // keep the face clear
        top(sph(0.04, 1, 1, 1, 8).translate(x * hx * 1.05, HY + y * hy * 1.05, z * hz * 1.05));
      }
      break;
    }
    case 'afro':
      top(cap(1.45, 0.5 * PI, -0.42, 0.012));
      break;
    case 'long':
      top(cap(1.075, 0.52 * PI, -0.3));
      P.add(sph(1, hx * 1.06, 0.2, hz * 0.74, 14).translate(0, HY - 0.1, -0.046), 'head', c);
      break;
    case 'wavy':
      top(cap(1.1, 0.52 * PI, -0.32));
      P.add(sph(0.068).translate(-0.088, HY - 0.055, -0.02), 'head', c);
      P.add(sph(0.068).translate(0.088, HY - 0.055, -0.02), 'head', c);
      P.add(sph(0.09, 1.1, 1, 0.8).translate(0, HY - 0.06, -0.066), 'head', c);
      break;
    case 'bob':
      top(cap(1.085, 0.52 * PI, -0.3));
      P.add(new THREE.SphereGeometry(1, 18, 8, PI / 2 + 0.95, PI * 2 - 1.9, 0.3 * PI, 0.42 * PI).scale(hx * 1.11, hy * 1.08, hz * 1.11).translate(0, HY, 0), 'head', c);
      break;
    case 'ponytail':
      top(cap(1.065, 0.52 * PI, -0.36));
      P.add(sph(0.034).translate(0, HY + 0.055, -0.118), 'head', c);
      P.add(new THREE.CapsuleGeometry(0.028, 0.18, 4, 8).rotateX(-0.35).translate(0, HY - 0.06, -0.15), 'head', c);
      break;
    case 'bun':
      top(cap(1.065, 0.52 * PI, -0.36));
      top(sph(0.054).translate(0, HY + 0.128, -0.04));
      break;
    case 'mohawk':
      top(cap(1.03, 0.5 * PI, -0.3));
      top(sph(1, 0.022, 0.062, 0.115, 10).translate(0, HY + 0.11, -0.012));
      break;
    case 'braids':
      top(cap(1.065, 0.52 * PI, -0.3));
      for (const m of [-1, 1]) {
        P.add(new THREE.CapsuleGeometry(0.022, 0.24, 4, 8).translate(m * 0.098, HY - 0.13, 0.012), 'head', c);
        P.add(sph(0.026).translate(m * 0.098, HY - 0.27, 0.012), 'head', shade(c, 1.3));
      }
      break;
    default:
      top(cap(1.07, 0.52 * PI, -0.38));
  }
}

function addFacialHair(P, a, H) {
  const { hx, hy, hz, HY, faceZ } = H;
  const f = a.facial;
  if (!f || f === 'none') return;
  const hairC = a.hair === 'bald' ? '#3a2a1e' : a.hairColor;
  const jaw = (s, color) =>
    P.add(new THREE.SphereGeometry(1, 16, 6, Math.PI / 2 - 1.2, 2.4, 0.66 * Math.PI, 0.3 * Math.PI).scale(hx * s, hy * s, hz * s).translate(0, HY, 0), 'head', color);
  const stache = () => P.add(new THREE.BoxGeometry(0.05, 0.011, 0.012).translate(0, HY - 0.029, faceZ(0, -0.03) + 0.004), 'head', hairC);
  if (f === 'stubble') jaw(1.012, mix(a.skin, hairC, 0.32));
  if (f === 'beard') {
    jaw(1.06, hairC);
    stache();
  }
  if (f === 'mustache') stache();
  if (f === 'goatee') {
    stache();
    P.add(sph(0.03, 1, 1.1, 0.7, 8).translate(0, HY - 0.09, faceZ(0, -0.09) * 0.86), 'head', hairC);
  }
}

function addAccessory(P, a, H) {
  const { hx, hy, hz, HY, faceZ, B, J } = H;
  const acc = a.accessory;
  if (!acc || acc === 'none') return;
  const accC = a.accColor || '#c53a3a';
  const ez = faceZ(0.043, 0.012);
  if (acc === 'glasses' || acc === 'sunglasses') {
    const dark = '#17181c';
    for (const m of [-1, 1]) {
      if (acc === 'glasses') P.add(new THREE.TorusGeometry(0.024, 0.0032, 5, 14).translate(m * 0.043, HY + 0.012, ez + 0.012), 'head', dark);
      else P.add(new THREE.CylinderGeometry(0.027, 0.027, 0.006, 14).rotateX(Math.PI / 2).scale(1.1, 0.85, 1).translate(m * 0.043, HY + 0.012, ez + 0.012), 'head', '#0b0b0d');
      P.add(bx(0.004, 0.004, 0.1).translate(m * (hx * 0.92), HY + 0.014, ez - 0.04), 'head', dark);
    }
    P.add(bx(0.024, 0.004, 0.004).translate(0, HY + 0.016, ez + 0.014), 'head', dark);
  } else if (acc === 'cap') {
    P.add(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, 0.44 * Math.PI).scale(hx * 1.1, hy * 1.08, hz * 1.1).rotateX(-0.12).translate(0, HY + 0.012, 0), 'head', accC);
    P.add(new THREE.CylinderGeometry(0.085, 0.085, 0.012, 14).scale(1, 1, 1.25).translate(0, HY + 0.045, 0.105), 'head', shade(accC, 0.8));
  } else if (acc === 'beanie') {
    P.add(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, 0.5 * Math.PI).scale(hx * 1.11, hy * 1.12, hz * 1.11).rotateX(-0.2).translate(0, HY + 0.01, 0), 'head', accC);
    P.add(sph(0.03).translate(0, HY + hy * 1.13, -0.02), 'head', shade(accC, 1.25));
  } else if (acc === 'headphones') {
    P.add(new THREE.TorusGeometry(hx * 1.13, 0.012, 6, 16, Math.PI).translate(0, HY, 0), 'head', '#22252c');
    for (const m of [-1, 1]) P.add(new THREE.CylinderGeometry(0.036, 0.036, 0.032, 12).rotateZ(Math.PI / 2).translate(m * hx * 1.1, HY - 0.004, 0), 'head', accC);
  } else if (acc === 'watch') {
    const w = J.handL;
    P.add(new THREE.TorusGeometry(0.034, 0.009, 6, 12).rotateX(Math.PI / 2).translate(w[0], w[1] + 0.035, w[2]), 'foreL', '#1d1f24');
    P.add(bx(0.03, 0.03, 0.012).translate(w[0] + 0.03, w[1] + 0.035, w[2]), 'foreL', '#d8dde6');
  } else if (acc === 'necklace') {
    P.add(new THREE.TorusGeometry(0.062, 0.005, 5, 18).rotateX(Math.PI / 2 - 0.5).translate(0, 1.425, 0.03), 'chest', '#e8c45a');
  } else if (acc === 'backpack') {
    P.add(new THREE.CapsuleGeometry(0.1, 0.16, 4, 10).scale(1.15, 1, 0.6).translate(0, 1.25, -B.td - 0.05), 'chest', accC);
    for (const m of [-1, 1]) P.add(bx(0.03, 0.3, 0.012).translate(m * 0.09, 1.28, B.td * 0.9), 'chest', shade(accC, 0.75));
  }
}
