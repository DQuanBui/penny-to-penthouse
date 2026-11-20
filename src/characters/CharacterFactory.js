// Procedural anime-style humanoid: cel-shaded (toon) with an ink outline, a
// larger head with big glossy eyes, lashes and a small nose and mouth, anime
// hair with bangs (17 styles), clothing and accessories. All parts are merged
// into ONE vertex-coloured SkinnedMesh bound to a 17-bone skeleton that
// Animation.js drives procedurally; the outline is a second, inflated copy
// drawn inside-out on the same skeleton.
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
const LONG_SLEEVE = { shirt: 1, hoodie: 1, sweater: 1, blazer: 1, jacket: 1, uniform: 1, labcoat: 1, chefcoat: 1, coat: 1, turnout: 1 };

const HEAD_SCALE = 1.15; // anime proportions: a slightly larger head
const HEAD_PIVOT = 1.515;
const LIFT = 0.065; // legs are shortened by this much; the mesh is lowered to keep feet on the ground

let sharedMaterial = null;
let outlineMaterial = null;
/** Cel shading: three flat tones of light instead of a smooth falloff. */
function toonRamp() {
  const t = new THREE.DataTexture(new Uint8Array([105, 105, 105, 255, 185, 185, 185, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
const material = () => (sharedMaterial ||= new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }));
/** The ink line: the same skinned mesh, pushed out along its normals and drawn inside-out. */
const outline = () => {
  if (outlineMaterial) return outlineMaterial;
  outlineMaterial = new THREE.MeshBasicMaterial({ color: '#1d1418', side: THREE.BackSide });
  outlineMaterial.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aOutline;')
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3( position ) + normal * 0.0068 * aOutline;');
  };
  outlineMaterial.customProgramCacheKey = () => 'char-outline';
  return outlineMaterial;
};

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
  add(geo, bone, color, ink = 1) {
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
    // tiny parts (buttons, strings, fingers) get no ink line: it would swamp them
    if (ink) {
      geo.computeBoundingSphere();
      if (geo.boundingSphere.radius < 0.032) ink = 0;
    }
    geo.setAttribute('aOutline', new THREE.BufferAttribute(new Float32Array(n).fill(ink), 1));
    this.list.push(geo);
    return geo;
  }

  /**
   * Smoothly skinned part: vertices below y0 follow boneA, above y1 boneB,
   * and blend linearly in between (no seam where the spine bends).
   */
  addBlend(geo, boneA, boneB, y0, y1, color) {
    this.add(geo, boneA, color);
    const pos = geo.attributes.position;
    const si = geo.attributes.skinIndex;
    const sw = geo.attributes.skinWeight;
    const a = BI[boneA];
    const b = BI[boneB];
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.max(0, (pos.getY(i) - y0) / (y1 - y0)));
      si.setXY(i, a, b);
      sw.setXY(i, 1 - t, t);
    }
    return geo;
  }
}

/** Turned (lathe) shape from [radius, y] pairs, squashed front-to-back by zr. */
function lathe(profile, zr, segments = 22) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, segments).scale(1, 1, zr);
}

const sph = (r, sx = 1, sy = 1, sz = 1, seg = 12) => new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))).scale(sx, sy, sz);
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
/** Tapered open cylinder from point a (radius r0) to point b (radius r1). */
function seg(a, b, r0, r1, radial = 14) {
  _v1.set(a[0], a[1], a[2]);
  _v2.set(b[0], b[1], b[2]);
  const len = _v1.distanceTo(_v2);
  const g = new THREE.CylinderGeometry(r0, r1, len, radial, 1, true);
  _q.setFromUnitVectors(UP, _v1.clone().sub(_v2).normalize());
  g.applyQuaternion(_q);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}
/**
 * A smooth limb section from joint a down to joint b. prof = [[t, radius]]
 * with t 0 (a) .. 1 (b); zr squashes it front-to-back. Open ends hide inside
 * the neighbouring parts, and the elbow / knee is skinned with a blend.
 */
function limbTube(a, b, prof, zr = 1, radial = 14) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const pts = [...prof].sort((p, q) => q[0] - p[0]).map(([t, r]) => new THREE.Vector2(r, -t * len));
  const g = new THREE.LatheGeometry(pts, radial);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = -pos.getY(i) / len;
    pos.setXYZ(i, a[0] + dx * t + pos.getX(i), a[1] + dy * t, a[2] + dz * t + pos.getZ(i) * zr);
  }
  g.computeVertexNormals();
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
  // a hi-vis vest is worn over a tee: the sleeves are the tee's colour
  const sleeveUpper = a.top === 'tank' ? skin : a.top === 'vest' ? a.shirtColor || '#e9e6df' : topC;
  const sleeveLower = LONG_SLEEVE[a.top] ? topC : skin;

  // ---- torso: one smooth turned shape from the hem to the collar ----
  const zr = B.td / B.tr;
  const bel = B.belly * 0.028;
  const hipW = Math.max(B.hip, B.tr * 0.95);
  const torso = lathe(
    [
      [hipW * 1.035, 0.925],
      [hipW * 1.03, 0.965],
      [B.tr * 0.93 + bel * 0.6, 1.04],
      [B.tr * 0.95 + bel, 1.12],
      [B.tr * 1.0 + bel * 0.4, 1.2],
      [B.tr * 1.03, 1.27],
      [B.tr * 1.0, 1.34],
      [(B.sh + B.tr) * 0.5, 1.4],
      [B.tr * 0.62, 1.445],
      [0.058, 1.47],
    ],
    zr,
  );
  P.addBlend(torso, 'spine', 'chest', 1.1, 1.24, topC);
  // shoulder yoke so the torso flows into the arms
  P.add(sph(1, B.sh + 0.004, 0.064, B.td * 0.94, 16).translate(0, 1.378, 0), 'chest', topC);
  // hem band: a slightly darker edge reads as fabric
  P.add(lathe([[hipW * 1.045, 0.922], [hipW * 1.045, 0.945]], zr), 'spine', shade(topC, 0.86));
  // trousers / skirt waist: sits just inside the top's hem, so no seam shows
  P.add(lathe([[0.03, 0.845], [B.hip * 0.7, 0.855], [B.hip * 0.93, 0.89], [B.hip * 1.0, 0.94], [B.hip * 0.98, 1.0]], zr * 0.92), 'hips', botC);
  P.add(new THREE.CylinderGeometry(0.046, 0.054, 0.13, 12).translate(0, 1.485, 0), 'neck', skin);

  // ---- arms + legs (mirrored) ----
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    const sh = J['arm' + s];
    const el = J['fore' + s];
    const wr = J['hand' + s];
    P.add(sph(0.053 * L, 1, 0.9, 0.95).translate(sh[0] - m * 0.014, sh[1] - 0.012, sh[2]), 'chest', sleeveUpper);
    // one continuous arm: shoulder, bicep, a soft elbow, forearm, wrist. The two
    // sections overlap at the elbow and share a skin blend, so it bends smoothly.
    const ea = [el[0], el[1] - 0.035, el[2]];
    const eb = [el[0], el[1] + 0.035, el[2]];
    P.addBlend(limbTube(sh, ea, [[0, 0.057], [0.3, 0.054], [0.55, 0.051], [0.85, 0.046], [1, 0.044]].map(([t, r]) => [t, r * L]), 0.92), 'fore' + s, 'arm' + s, el[1] - 0.045, el[1] + 0.045, sleeveUpper);
    P.addBlend(limbTube(eb, wr, [[0, 0.043], [0.25, 0.045], [0.6, 0.04], [1, 0.033]].map(([t, r]) => [t, r * L * (LONG_SLEEVE[a.top] ? 1 : 0.97)]), 0.9), 'fore' + s, 'arm' + s, el[1] - 0.045, el[1] + 0.045, sleeveLower);
    // hand: palm, fingers and thumb (palms face the thighs)
    P.add(sph(0.04, 0.62, 1.12, 1.05, 10).translate(wr[0], wr[1] - 0.04, wr[2]), 'hand' + s, skin);
    P.add(sph(0.033, 0.55, 1.15, 0.95, 10).translate(wr[0], wr[1] - 0.088, wr[2] + 0.004), 'hand' + s, skin);
    P.add(new THREE.CapsuleGeometry(0.011, 0.03, 3, 6).rotateX(0.5).translate(wr[0] - m * 0.004, wr[1] - 0.05, wr[2] + 0.034), 'hand' + s, skin);
    if (LONG_SLEEVE[a.top]) P.add(new THREE.CylinderGeometry(0.04 * L, 0.04 * L, 0.03, 10).translate(wr[0], wr[1] + 0.012, wr[2]), 'fore' + s, shade(topC, 0.85));

    const hp = J['thigh' + s];
    const kn = J['shin' + s];
    const an = J['foot' + s];
    const thighC = bareLegs ? skin : botC;
    const shinC = bareLegs || a.bottom === 'shorts' ? skin : botC;
    const tw = a.bottom === 'slacks' ? 0.92 : a.bottom === 'joggers' ? 1.06 : 1;
    P.add(sph(0.09 * L, 1, 1, 1, 16).translate(hp[0], hp[1], hp[2]), 'thigh' + s, thighC);
    // one continuous leg: full thigh, knee, calf, slim ankle (blended at the knee)
    const ka = [kn[0], kn[1] - 0.04, kn[2]];
    const kb = [kn[0], kn[1] + 0.04, kn[2]];
    const lw = L * tw;
    P.addBlend(limbTube(hp, ka, [[0, 0.09], [0.25, 0.088], [0.6, 0.078], [0.9, 0.068], [1, 0.066]].map(([t, r]) => [t, r * lw]), 0.95), 'shin' + s, 'thigh' + s, kn[1] - 0.055, kn[1] + 0.055, thighC);
    P.addBlend(limbTube(kb, an, [[0, 0.064], [0.3, 0.067], [0.55, 0.06], [0.85, 0.05], [1, 0.047]].map(([t, r]) => [t, r * lw * (bareLegs || a.bottom === 'shorts' ? 0.97 : 1)]), 0.95), 'shin' + s, 'thigh' + s, kn[1] - 0.055, kn[1] + 0.055, shinC);
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
  addWorkwear(P, a, { B, J, zf, zr, topC, hipW, bel });

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
    P.add(sph(0.022, 0.45, 1, 0.7, 8).translate(m * hx * 0.98, HY - 0.006, -0.004), 'head', shade(skin, 0.96));
    // big anime eyes: white, a tall iris that darkens toward the top, pupil, two catchlights
    const es = EYE[a.eyeShape] || EYE.round;
    const ex = m * 0.041;
    const ey = -0.006;
    const ez = faceZ(ex, ey);
    const ew = 0.0235 * Math.min(1.15, es[0]);
    const eh = 0.03 * Math.max(0.72, Math.min(1.1, es[1]));
    const D = 0; // details: no ink outline
    P.add(sph(1, ew, eh, 0.009, 16).translate(ex, HY + ey, ez - 0.0025), 'head', '#fbfaf7', D);
    P.add(sph(1, ew * 0.8, eh * 0.88, 0.009, 16).translate(ex, HY + ey - eh * 0.05, ez + 0.0008), 'head', a.eyes, D);
    P.add(sph(1, ew * 0.76, eh * 0.42, 0.009, 14).translate(ex, HY + ey + eh * 0.4, ez + 0.0016), 'head', shade(a.eyes, 0.5), D);
    P.add(sph(1, ew * 0.36, eh * 0.44, 0.009, 12).translate(ex, HY + ey - eh * 0.04, ez + 0.0024), 'head', '#0c0b10', D);
    P.add(sph(1, ew * 0.26, eh * 0.22, 0.007, 10).translate(ex - ew * 0.28, HY + ey + eh * 0.3, ez + 0.0036), 'head', '#ffffff', D);
    P.add(sph(1, ew * 0.13, eh * 0.11, 0.007, 8).translate(ex + ew * 0.3, HY + ey - eh * 0.36, ez + 0.0036), 'head', '#ffffff', D);
    // a bold upper lash line that flicks out at the corner, a light lower one
    const lash = '#1c1216';
    P.add(new THREE.TorusGeometry(ew * 1.04, 0.0046, 4, 16, Math.PI).scale(1, (eh / ew) * 0.97, 1).rotateZ(m * 0.06).translate(ex, HY + ey, ez + 0.0028), 'head', lash, D);
    P.add(bx(0.013, 0.0045, 0.004).rotateZ(m * 0.55).translate(ex + m * ew * 1.08, HY + ey + eh * 0.12, ez + 0.0024), 'head', lash, D);
    P.add(new THREE.TorusGeometry(ew * 0.72, 0.0016, 3, 10, Math.PI * 0.6).rotateZ(-Math.PI * 0.8).scale(1, (eh / ew) * 0.9, 1).translate(ex, HY + ey, ez + 0.0026), 'head', shade(lash, 1.6), D);
    // thin brows set high, a touch of blush under the eyes
    const browC = a.hair === 'bald' ? '#3a2a1e' : mix(a.hairColor, '#1a1410', 0.3);
    const br = a.brows === 'arched' ? 0.22 : a.brows === 'straight' ? 0 : 0.1;
    const bt = a.brows === 'thick' ? 0.0075 : 0.0048;
    const by = ey + eh + 0.017;
    P.add(bx(0.034, bt, 0.006).rotateZ(-m * br).translate(ex + m * 0.002, HY + by, faceZ(ex, by) + 0.003), 'head', browC, D);
    P.add(sph(1, 0.016, 0.0065, 0.004, 10).translate(m * 0.052, HY - 0.034, faceZ(m * 0.052, -0.034) + 0.0004), 'head', mix(skin, '#ff6f86', 0.32), D);
  }
  // a small nose and a little smiling mouth
  P.add(sph(0.0062, 1, 1.25, 0.9, 6).translate(0, HY - 0.026, faceZ(0, -0.026) + 0.0004), 'head', shade(skin, 0.88), 0);
  P.add(new THREE.TorusGeometry(0.0115, 0.0022, 4, 12, Math.PI * 0.75).rotateZ(-Math.PI * 0.875).translate(0, HY - 0.042, faceZ(0, -0.046) + 0.0012), 'head', '#8a3a44', 0);

  addHair(P, a, { hx, hy, hz, HY, faceZ });
  addFacialHair(P, a, { hx, hy, hz, HY, faceZ });
  addAccessory(P, a, { hx, hy, hz, HY, faceZ, B, J });
  addHat(P, a, { hx, hy, hz, HY });
  addCarry(P, a, { B, J });

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
  // the ink outline shares the geometry and the skeleton
  if (opts.outline !== false) {
    const ink = new THREE.SkinnedMesh(geo, outline());
    ink.bind(mesh.skeleton, mesh.bindMatrix);
    ink.frustumCulled = false;
    mesh.add(ink);
  }

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
  const hat = a.accessory === 'cap' || a.accessory === 'beanie' || !!(a.hat && a.hat !== 'none');
  /** Tilted spherical cap hugging the skull. */
  const cap = (s, theta, tilt, dy = 0) => new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, theta).scale(hx * s, hy * s, hz * s).rotateX(tilt).translate(0, HY + dy, 0);
  const top = (g) => {
    if (!hat) P.add(g, 'head', c);
  };
  const PI = Math.PI;
  // anime bangs: a fringe of tapered locks over the forehead
  const bangs = (n = 7, len = 0.07, spread = 0.9) => {
    if (hat) return;
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1) - 0.5) * spread;
      const ang = t * 1.6;
      const x = Math.sin(ang) * hx * 0.98;
      const z = Math.cos(ang) * hz * 0.93;
      const l = len * (1 - Math.abs(t) * 0.5) * (0.85 + ((i * 37) % 10) / 40);
      P.add(new THREE.ConeGeometry(0.019, l, 5).rotateX(PI).rotateZ(-t * 0.5).translate(x, HY + 0.07 - l / 2, z), 'head', c);
    }
  };
  const spikes = (n, len, y0 = 0.2) => {
    for (let i = 0; i < n; i++) {
      const th = y0 + ((i * 0.618) % 1) * 1.15;
      const ph = i * 2.39996;
      const dx = Math.sin(th) * Math.cos(ph);
      const dy = Math.cos(th);
      const dz = Math.sin(th) * Math.sin(ph);
      if (dz > 0.6 && dy < 0.5) continue;
      const g = new THREE.ConeGeometry(0.03, len, 6).translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz)));
      g.translate(dx * hx * 0.85, HY + dy * hy * 0.85, dz * hz * 0.85);
      top(g);
    }
  };
  if (!['buzz', 'afro', 'mohawk', 'curly', 'bald'].includes(style)) bangs(style === 'hime' ? 9 : 7, style === 'short' || style === 'quiff' ? 0.05 : 0.075);
  switch (style) {
    case 'spiky':
      top(cap(1.07, 0.55 * PI, -0.35));
      spikes(16, 0.11);
      break;
    case 'twintails':
      top(cap(1.08, 0.53 * PI, -0.3));
      for (const m of [-1, 1]) {
        P.add(sph(0.03).translate(m * 0.1, HY + 0.06, -0.03), 'head', a.accColor || '#e05a8a');
        P.add(new THREE.CapsuleGeometry(0.036, 0.3, 4, 10).rotateZ(m * 0.25).translate(m * 0.15, HY - 0.12, -0.04), 'head', c);
        P.add(new THREE.ConeGeometry(0.036, 0.1, 8).rotateX(PI).translate(m * 0.19, HY - 0.33, -0.04), 'head', c);
      }
      break;
    case 'hime':
      top(cap(1.08, 0.52 * PI, -0.3));
      // long straight hair falling past the shoulders, with side locks framing the face
      P.add(new THREE.SphereGeometry(1, 20, 12, PI / 2 + 0.85, PI * 2 - 1.7, 0.28 * PI, 0.62 * PI).scale(hx * 1.1, hy * 2.3, hz * 1.06).translate(0, HY - 0.07, -0.01), 'head', c);
      for (const m of [-1, 1]) P.add(bx(0.03, 0.16, 0.035).translate(m * hx * 0.93, HY - 0.06, hz * 0.55), 'head', c);
      break;
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
      // a shell around the back and sides that falls to the shoulders (face left open)
      P.add(new THREE.SphereGeometry(1, 20, 12, PI / 2 + 0.9, PI * 2 - 1.8, 0.28 * PI, 0.6 * PI).scale(hx * 1.1, hy * 1.75, hz * 1.08).translate(0, HY - 0.035, -0.006), 'head', c);
      P.add(sph(1, hx * 0.92, 0.07, hz * 0.62, 14).translate(0, HY - 0.15, -0.045), 'head', shade(c, 0.92));
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

/** Uniforms and work clothes layered over the torso (see Customization ROLES). */
function addWorkwear(P, a, H) {
  const { B, J, zf, zr, topC, hipW, bel } = H;
  const t = a.top;
  const coatSkirt = (len, flare, color) => P.add(new THREE.CylinderGeometry(hipW * 1.06, hipW * flare, len, 18, 1, true).scale(1, 1, zr * 1.05).translate(0, 0.95 - len / 2, 0), 'hips', color);
  const lapels = (color) => {
    for (const m of [-1, 1]) P.add(bx(0.034, 0.24, 0.01).rotateZ(-m * 0.22).translate(m * 0.052, 1.32, zf * 0.985 + 0.003), 'chest', color);
  };
  if (t === 'uniform') {
    // badge, name tag, pocket flaps, shoulder patches, duty belt and radio
    P.add(bx(0.03, 0.036, 0.008).translate(0.07, 1.335, zf + 0.004), 'chest', a.badgeColor || '#d8b44a');
    P.add(bx(0.05, 0.012, 0.006).translate(-0.07, 1.335, zf + 0.004), 'chest', '#d8dde6');
    for (const m of [-1, 1]) {
      P.add(bx(0.065, 0.014, 0.008).translate(m * 0.07, 1.375, zf + 0.002), 'chest', shade(topC, 0.75));
      P.add(bx(0.01, 0.055, 0.045).translate(m * (B.sh + 0.052), 1.31, 0), m > 0 ? 'armL' : 'armR', a.patchColor || '#c9a227');
      P.add(bx(0.06, 0.03, 0.02).rotateZ(m * 0.5).translate(m * 0.035, 1.455, 0.045), 'chest', shade(topC, 1.15));
    }
    P.add(lathe([[hipW * 1.07, 0.915], [hipW * 1.07, 0.955]], zr), 'hips', '#141518');
    P.add(bx(0.04, 0.03, 0.01).translate(0, 0.935, zf * 1.02 + 0.012), 'hips', '#b9bdc3');
    P.add(bx(0.032, 0.07, 0.03).translate(-0.085, 1.39, zf * 0.8 + 0.01), 'chest', '#1a1b1f');
    P.add(bx(0.05, 0.08, 0.05).translate(-hipW * 1.05, 0.9, 0.02), 'hips', '#1a1b1f');
  } else if (t === 'vest') {
    // reflective bands around a hi-vis vest, and over the shoulders
    const r1 = B.tr * 0.95 + bel;
    P.add(new THREE.TorusGeometry(r1 * 1.04, 0.012, 4, 28).rotateX(Math.PI / 2).scale(1, 1, zr).translate(0, 1.12, 0), 'spine', '#dfe3e8');
    P.add(new THREE.TorusGeometry(B.tr * 1.06, 0.012, 4, 28).rotateX(Math.PI / 2).scale(1, 1, zr).translate(0, 1.25, 0), 'chest', '#dfe3e8');
    for (const m of [-1, 1]) P.add(bx(0.03, 0.012, B.td * 2.2).translate(m * 0.1, 1.405, 0), 'chest', '#dfe3e8');
  } else if (t === 'scrubs') {
    P.add(bx(0.07, 0.06, 0.006).translate(0.07, 1.3, zf + 0.002), 'chest', shade(topC, 0.85));
    P.add(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6).translate(0.085, 1.33, zf + 0.006), 'chest', '#2b2f38');
    P.add(bx(0.05, 0.05, 0.006).rotateZ(Math.PI / 4).translate(0, 1.43, zf * 0.8), 'chest', a.skin);
  } else if (t === 'labcoat') {
    coatSkirt(0.42, 1.28, topC);
    lapels(shade(topC, 0.92));
    P.add(bx(0.07, 0.24, 0.006).translate(0, 1.3, zf * 0.98), 'chest', a.shirtColor || '#a9c7e8');
    for (const m of [-1, 1]) P.add(bx(0.09, 0.08, 0.008).translate(m * 0.1, 0.84, hipW * zr * 1.12), 'hips', shade(topC, 0.9));
    P.add(new THREE.TorusGeometry(0.05, 0.006, 5, 16, Math.PI).rotateX(-0.4).translate(0, 1.39, zf * 0.9 + 0.01), 'chest', '#2b2f38');
  } else if (t === 'chefcoat') {
    for (const x of [-0.045, 0.045]) for (const y of [1.17, 1.25, 1.33]) P.add(sph(0.009).translate(x, y, zf + 0.004), 'chest', '#d8d8d8');
    P.add(new THREE.CylinderGeometry(0.06, 0.062, 0.035, 14).translate(0, 1.455, 0), 'neck', shade(topC, 0.95));
    P.add(lathe([[hipW * 1.06, 0.86], [hipW * 1.08, 0.97]], zr), 'hips', a.apronColor || '#f4f1ea');
  }
  if (t === 'turnout') {
    // firefighter's turnout coat: long, with reflective bands at chest, hem and cuffs
    coatSkirt(0.3, 1.22, topC);
    const band = '#e2ef5a';
    P.add(new THREE.TorusGeometry(B.tr * 1.07, 0.016, 4, 28).rotateX(Math.PI / 2).scale(1, 1, zr).translate(0, 1.2, 0), 'chest', band);
    P.add(new THREE.TorusGeometry(hipW * 1.25, 0.016, 4, 28).rotateX(Math.PI / 2).scale(1, 1, zr * 1.05).translate(0, 0.7, 0), 'hips', band);
    for (const m of [-1, 1]) {
      const wr = J['hand' + (m > 0 ? 'L' : 'R')];
      P.add(new THREE.TorusGeometry(0.047, 0.012, 4, 14).rotateX(Math.PI / 2).translate(wr[0], wr[1] + 0.07, wr[2]), m > 0 ? 'foreL' : 'foreR', band);
    }
    for (const y of [1.1, 1.2, 1.3]) P.add(bx(0.03, 0.012, 0.008).translate(0.02, y, zf + 0.006), 'chest', '#9aa2ad');
  }
  if (a.apron && t !== 'chefcoat') {
    // a bib apron over the clothes
    P.add(lathe([[hipW * 1.07, 0.6], [hipW * 1.09, 0.97]], zr), 'hips', a.apronColor || '#f4f1ea');
    P.add(bx(0.2, 0.22, 0.012).translate(0, 1.2, zf + 0.006), 'chest', a.apronColor || '#f4f1ea');
  }
  if (t === 'coat') {
    coatSkirt(0.36, 1.24, topC);
    lapels(shade(topC, 0.8));
    for (const y of [1.12, 1.22, 1.32]) P.add(sph(0.01).translate(0.03, y, zf + 0.004), 'chest', shade(topC, 0.6));
    P.add(new THREE.TorusGeometry(0.066, 0.022, 6, 16).rotateX(Math.PI / 2).translate(0, 1.45, 0), 'chest', a.scarfColor || shade(topC, 0.85));
  }
}

/** Work and fashion hats: police cap, hard hat, chef's toque, sun hat. */
function addHat(P, a, H) {
  const { hx, hy, hz, HY } = H;
  const c = a.hatColor || '#1f2a44';
  const zs = hz / hx;
  if (a.hat === 'policecap') {
    P.add(new THREE.CylinderGeometry(hx * 1.2, hx * 1.06, 0.075, 20).scale(1, 1, zs * 1.04).translate(0, HY + hy * 0.82, -0.008), 'head', c);
    P.add(new THREE.CylinderGeometry(hx * 1.07, hx * 1.07, 0.03, 20).scale(1, 1, zs * 1.04).translate(0, HY + hy * 0.6, 0), 'head', '#121316');
    P.add(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 16, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 0.75).rotateX(0.18).translate(0, HY + hy * 0.52, hz * 0.88), 'head', '#121316');
    P.add(bx(0.03, 0.032, 0.008).translate(0, HY + hy * 0.8, hz * 1.12), 'head', '#d8b44a');
  } else if (a.hat === 'hardhat') {
    P.add(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, 0.5 * Math.PI).scale(hx * 1.22, hy * 1.08, hz * 1.22).translate(0, HY + 0.018, 0), 'head', c);
    P.add(new THREE.CylinderGeometry(hx * 1.4, hx * 1.4, 0.012, 20).scale(1, 1, zs * 1.12).translate(0.0, HY + 0.02, 0.012), 'head', c);
    P.add(bx(0.022, 0.03, hz * 2.2).translate(0, HY + hy * 1.08, 0), 'head', shade(c, 0.9));
  } else if (a.hat === 'chefhat') {
    P.add(new THREE.CylinderGeometry(hx * 1.06, hx * 1.06, 0.06, 18).scale(1, 1, zs).translate(0, HY + hy * 0.62, 0), 'head', '#f8f8f6');
    P.add(new THREE.CylinderGeometry(hx * 1.2, hx * 1.04, 0.12, 18).scale(1, 1, zs).translate(0, HY + hy * 0.62 + 0.09, 0), 'head', '#f8f8f6');
    P.add(sph(1, hx * 1.28, 0.055, hz * 1.28, 16).translate(0, HY + hy * 0.62 + 0.155, 0), 'head', '#f8f8f6');
  } else if (a.hat === 'beret') {
    P.add(new THREE.CylinderGeometry(hx * 1.18, hx * 1.05, 0.05, 20).scale(1, 1, zs).rotateZ(-0.22).translate(0.02, HY + hy * 0.88, -0.01), 'head', c);
    P.add(sph(0.012).translate(0.02, HY + hy * 0.88 + 0.03, 0), 'head', shade(c, 0.8));
  } else if (a.hat === 'firehelmet') {
    P.add(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, 0.5 * Math.PI).scale(hx * 1.24, hy * 1.12, hz * 1.24).translate(0, HY + 0.02, 0), 'head', c);
    // long brim, sweeping down at the back
    P.add(new THREE.CylinderGeometry(hx * 1.55, hx * 1.62, 0.014, 22).scale(1, 1, zs * 1.25).rotateX(-0.12).translate(0, HY + 0.01, -0.03), 'head', c);
    P.add(bx(0.024, 0.03, hz * 2.3).translate(0, HY + hy * 1.12, 0), 'head', shade(c, 0.8));
    // the front shield
    P.add(bx(0.085, 0.1, 0.012).rotateX(-0.2).translate(0, HY + hy * 0.72, hz * 1.2), 'head', '#e9c04c');
  } else if (a.hat === 'sunhat') {
    P.add(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, 0.5 * Math.PI).scale(hx * 1.12, hy * 1.0, hz * 1.12).translate(0, HY + 0.02, 0), 'head', c);
    P.add(new THREE.CylinderGeometry(0.2, 0.21, 0.01, 22).translate(0, HY + 0.03, 0), 'head', c);
    P.add(new THREE.TorusGeometry(hx * 1.12, 0.008, 4, 22).rotateX(Math.PI / 2).scale(1, 1, zs).translate(0, HY + 0.05, 0), 'head', shade(c, 0.6));
  }
}

/** Things people carry: briefcase, coffee, shopping bag, tote, camera, delivery bag, mail bag. */
function addCarry(P, a, H) {
  const { B, J } = H;
  const w = J.handR;
  const c = a.carryColor || '#3a2a1e';
  switch (a.carry) {
    case 'briefcase':
      P.add(bx(0.075, 0.27, 0.37).translate(w[0] - 0.01, w[1] - 0.25, w[2]), 'handR', c);
      P.add(bx(0.02, 0.03, 0.1).translate(w[0] - 0.01, w[1] - 0.1, w[2]), 'handR', shade(c, 0.7));
      break;
    case 'coffee':
      P.add(new THREE.CylinderGeometry(0.034, 0.027, 0.1, 12).translate(w[0], w[1] - 0.08, w[2] + 0.045), 'handR', '#f4f1ea');
      P.add(new THREE.CylinderGeometry(0.034, 0.033, 0.035, 12).translate(w[0], w[1] - 0.075, w[2] + 0.045), 'handR', c);
      P.add(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 12).translate(w[0], w[1] - 0.025, w[2] + 0.045), 'handR', '#2b2b2e');
      break;
    case 'shoppingbag':
    case 'tote':
      P.add(bx(0.11, 0.3, 0.26).translate(w[0] - 0.02, w[1] - 0.27, w[2]), 'handR', c);
      P.add(new THREE.TorusGeometry(0.05, 0.006, 4, 10, Math.PI).rotateY(Math.PI / 2).translate(w[0] - 0.02, w[1] - 0.12, w[2]), 'handR', shade(c, 0.7));
      break;
    case 'camera':
      P.add(bx(0.11, 0.07, 0.05).translate(0, 1.22, B.td + 0.04), 'chest', '#1a1b1f');
      P.add(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 12).rotateX(Math.PI / 2).translate(0, 1.22, B.td + 0.085), 'chest', '#2b2d33');
      P.add(new THREE.TorusGeometry(0.11, 0.005, 4, 18).rotateX(Math.PI / 2 - 0.5).translate(0, 1.36, 0.02), 'chest', '#1a1b1f');
      break;
    case 'deliverybag':
      P.add(bx(0.36, 0.36, 0.26).translate(0, 1.24, -B.td - 0.16), 'chest', c);
      P.add(bx(0.37, 0.04, 0.27).translate(0, 1.36, -B.td - 0.16), 'chest', shade(c, 0.75));
      for (const m of [-1, 1]) P.add(bx(0.03, 0.3, 0.012).translate(m * 0.09, 1.28, B.td * 0.9), 'chest', '#1a1b1f');
      break;
    case 'bucket':
      P.add(new THREE.CylinderGeometry(0.1, 0.08, 0.2, 12, 1, true).translate(w[0], w[1] - 0.24, w[2]), 'handR', c);
      P.add(new THREE.CircleGeometry(0.08, 12).rotateX(Math.PI / 2).translate(w[0], w[1] - 0.34, w[2]), 'handR', shade(c, 0.7));
      P.add(new THREE.TorusGeometry(0.1, 0.006, 4, 12, Math.PI).translate(w[0], w[1] - 0.14, w[2]), 'handR', '#5a5d62');
      break;
    case 'cane': {
      const len = w[1] - 0.02;
      P.add(new THREE.CylinderGeometry(0.011, 0.011, len, 6).translate(w[0] + 0.03, w[1] - len / 2 - 0.02, w[2] + 0.06), 'handR', c);
      P.add(new THREE.TorusGeometry(0.04, 0.011, 5, 10, Math.PI).rotateY(Math.PI / 2).translate(w[0] + 0.03, w[1] - 0.02, w[2] + 0.02), 'handR', c);
      break;
    }
    case 'stroller': {
      // pushed in front: frame, seat, canopy and four wheels (moves with the hips)
      const fz = 0.48;
      P.add(new THREE.CylinderGeometry(0.014, 0.014, 0.46, 6).rotateZ(Math.PI / 2).translate(0, 1.0, fz), 'hips', '#2b2d33');
      for (const m of [-1, 1]) P.add(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 6).rotateX(0.62).translate(m * 0.2, 0.7, fz + 0.22), 'hips', '#2b2d33');
      P.add(bx(0.4, 0.26, 0.48).translate(0, 0.52, fz + 0.48), 'hips', c);
      P.add(new THREE.SphereGeometry(0.26, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.82, 0.9, 1).rotateX(-0.5).translate(0, 0.66, fz + 0.36), 'hips', shade(c, 0.8));
      for (const m of [-1, 1]) for (const wz of [fz + 0.28, fz + 0.72]) P.add(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12).rotateZ(Math.PI / 2).translate(m * 0.2, 0.07, wz), 'hips', '#1a1b1f');
      break;
    }
    case 'skateboard':
      P.add(bx(0.025, 0.78, 0.2).translate(w[0] + 0.06, w[1] + 0.05, w[2]), 'handR', c);
      for (const y of [-0.27, 0.37]) for (const m of [-1, 1]) P.add(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 10).rotateZ(Math.PI / 2).translate(w[0] + 0.1, w[1] + y, w[2] + m * 0.07), 'handR', '#f4f1ea');
      break;
    case 'guitarcase':
      P.add(new THREE.CapsuleGeometry(0.14, 0.62, 4, 10).scale(1, 1, 0.42).rotateZ(0.32).translate(0.02, 1.08, -B.td - 0.09), 'chest', c);
      P.add(bx(0.03, 0.5, 0.012).rotateZ(-0.55).translate(0, 1.27, B.td + 0.012), 'chest', '#3a3a3a');
      break;
    case 'mailbag':
      P.add(bx(0.09, 0.24, 0.32).translate(B.tr + 0.09, 0.98, 0.02), 'hips', c);
      P.add(bx(0.03, 0.62, 0.012).rotateZ(-0.62).translate(0, 1.22, B.td + 0.012), 'chest', shade(c, 0.7));
      break;
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
