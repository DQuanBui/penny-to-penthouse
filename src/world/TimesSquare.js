// Times Square: four glass towers wrapped in giant LED billboards that cycle
// through ads (all for the game's fictional brands and shows), news tickers
// racing around the towers, the red glass steps to sit on, a countdown ball
// on a mast, and a plaza busy with tourists taking photos.
import * as THREE from 'three';
import { FACADE } from './Buildings.js';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { roleAppearance } from '../characters/Customization.js';

const ADS = [
  ['VOLTIX X1', 'Think ahead.', '📱', ['#2a1a6a', '#5a4fd0']],
  ['BREWLY COFFEE', 'Wake up the city', '☕', ['#0f3b2a', '#1e7a4a']],
  ['APEX STINGER', 'Zero to wow in 3.2 s', '🏎️', ['#3a0a0a', '#c53a3a']],
  ['THE LANTERN KING', 'Now on Broadway', '👑', ['#1a1408', '#c9a227']],
  ['MOONLIGHT AVENUE', 'The hit musical', '🌙', ['#120a2a', '#7a3fd0']],
  ['PULSEFIT', 'No excuses. Open 24/7', '🏋️', ['#1a1a1a', '#ff5a3c']],
  ['THREADLINE', 'The fall collection', '👗', ['#f2efe8', '#c9b9a0'], '#1d1f24'],
  ['MIDNIGHT RUN 3', 'Starlight Cinema · Friday', '🎬', ['#0a0a12', '#b5343c']],
  ['SKYLINE AIR', 'Fly to LA from $199', '✈️', ['#0a3a6a', '#3fa0e0']],
  ['FRESHCART', 'Groceries in 20 minutes', '🛒', ['#0f4a1a', '#4fd18b']],
  ['SUMMIT BANK', 'Your money, higher', '🏦', ['#0a1a3a', '#2f5aa3']],
  ['PIXEL PALACE', 'Game on, all night', '🕹️', ['#1a0a3a', '#ff4fd8']],
];
const TICKER = '  ★ CITY500 CLOSES AT A RECORD HIGH  ★  "THE LANTERN KING" BREAKS BROADWAY BOX OFFICE RECORD  ★  SUBWAY: GOOD SERVICE ON ALL LINES  ★  WEATHER: CLEAR SKIES TONIGHT  ★  NEW YEAR COUNTDOWN TICKETS ON SALE  ★  VOLTIX X1 SELLS OUT IN 4 MINUTES  ';

function adTexture([title, sub, icon, [c0, c1], fg = '#ffffff'], tall = false) {
  const c = document.createElement('canvas');
  c.width = tall ? 256 : 512;
  c.height = tall ? 512 : 320;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, c.width, c.height);
  grd.addColorStop(0, c0);
  grd.addColorStop(1, c1);
  g.fillStyle = grd;
  g.fillRect(0, 0, c.width, c.height);
  // decorative glow circles
  g.globalAlpha = 0.18;
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.arc(((i * 137) % c.width) + 20, ((i * 89) % c.height) + 10, 30 + i * 18, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${tall ? 120 : 110}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
  g.fillText(icon, c.width / 2, c.height * (tall ? 0.3 : 0.32));
  g.fillStyle = fg;
  let size = tall ? 44 : 60;
  const font = (s) => `900 ${s}px Outfit,"Segoe UI",system-ui,sans-serif`;
  g.font = font(size);
  while (g.measureText(title).width > c.width * 0.9 && size > 20) g.font = font((size -= 3));
  g.fillText(title, c.width / 2, c.height * (tall ? 0.62 : 0.66));
  g.font = `600 ${tall ? 24 : 28}px Outfit,"Segoe UI",system-ui,sans-serif`;
  g.globalAlpha = 0.9;
  g.fillText(sub, c.width / 2, c.height * (tall ? 0.76 : 0.84));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let adCache = null;
/** The fictional ads as wide billboard textures (shared, never disposed). */
export function adTextures() {
  return (adCache ||= ADS.map((a) => adTexture(a)));
}

function tickerTexture() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0a0e';
  g.fillRect(0, 0, 2048, 64);
  g.fillStyle = '#ffb347';
  g.font = '700 38px Outfit,"Segoe UI",system-ui,sans-serif';
  g.textBaseline = 'middle';
  g.fillText(TICKER, 10, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function timesSquare(T) {
  const { ctx, b } = T;
  // four billboard towers on the corners of the square
  const towers = [
    [-17.5, -17.5, 62],
    [17.5, -17.5, 50],
    [-17.5, 17.5, 46],
    [17.5, 17.5, 70],
  ];
  const wide = ADS.map((a) => adTexture(a));
  const tall = ADS.map((a) => adTexture(a, true));
  const screens = [];
  const tickers = [];
  const tick = tickerTexture();
  const screenMat = (tex) => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  let k = 0;
  for (const [x, z, h] of towers) {
    T.box(x, z, 13, 13, h, '#5f7488', FACADE.GLASS);
    // every face: a giant screen low down, a second one above, and a tall banner
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ry = Math.atan2(nx, nz);
      const fx = x + nx * 6.55;
      const fz = z + nz * 6.55;
      const tx = -nz;
      const tz = nx;
      for (const [y, w, hh] of [[9, 11.5, 7], [19.5, 10, 6]]) {
        const m = T.mesh(new THREE.PlaneGeometry(w, hh), screenMat(wide[k % wide.length]), fx, y, fz, false);
        m.rotation.y = ry;
        screens.push({ m, k: k++, set: wide });
      }
      const ban = T.mesh(new THREE.PlaneGeometry(3.2, 9), screenMat(tall[k % tall.length]), fx + tx * 4.6 + nx * 0.02, 31, fz + tz * 4.6 + nz * 0.02, false);
      ban.rotation.y = ry;
      screens.push({ m: ban, k: k++, set: tall });
      // the news ticker running around the tower
      const tk = T.mesh(new THREE.PlaneGeometry(13, 1.4), new THREE.MeshBasicMaterial({ map: tick, toneMapped: false }), fx + nx * 0.03, 15.4, fz + nz * 0.03, false);
      tk.rotation.y = ry;
      tickers.push(tk);
    }
  }
  // countdown ball on a mast above the tallest tower
  T.mesh(new THREE.CylinderGeometry(0.3, 0.4, 14, 8), new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.7, roughness: 0.3 }), 17.5, 70 + 7, 17.5);
  const ball = T.mesh(new THREE.IcosahedronGeometry(2.4, 2), new THREE.MeshStandardMaterial({ color: '#dfe8ff', emissive: '#9fc6ff', emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.15, flatShading: true }), 17.5, 70 + 13, 17.5);
  // the red glass steps (a grandstand to sit on), facing south
  const stepMat = new THREE.MeshStandardMaterial({ color: '#c41e2a', emissive: '#ff2a3a', emissiveIntensity: 0.25, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 });
  const rows = 7;
  for (let r = 0; r < rows; r++) {
    const h = 0.42 * (r + 1);
    T.mesh(new THREE.BoxGeometry(14, h, 0.8), stepMat, 0, h / 2, -1.2 - r * 0.8);
  }
  // one collider per step (a single box would trap the camera against the player)
  for (let r = 0; r < rows; r++) ctx.colliders.add(b.cx - 7, b.cz - 1.6 - r * 0.8, b.cx + 7, b.cz - 0.8 - r * 0.8, 0.42 * (r + 1));
  // seats on the steps (sitting needs a lift above the plaza)
  const seats = [];
  for (let r = 0; r < rows; r++) {
    for (const x of [-5.5, -3.2, -1, 1.2, 3.4, 5.6]) seats.push({ x: b.cx + x, z: b.cz - 1.2 - r * 0.8, ry: 0, lift: 0.42 * (r + 1) - 0.48, row: r, exit: { x: b.cx + x, z: b.cz + 0.6 } });
  }
  // a show-ticket booth beside the steps
  T.mesh(new THREE.BoxGeometry(1.6, 2.6, 4), new THREE.MeshStandardMaterial({ color: '#1d1f24', roughness: 0.4 }), 9, 1.3, -3.6);
  T.mesh(new THREE.BoxGeometry(1.7, 0.5, 4.1), new THREE.MeshBasicMaterial({ color: '#ff3a4a', toneMapped: false }), 9, 2.85, -3.6, false);
  ctx.colliders.add(b.cx + 8.2, b.cz - 5.6, b.cx + 9.8, b.cz - 1.6, 3);
  ctx.timesSquare = { x: b.cx, z: b.cz, seats, front: { x: b.cx, z: b.cz + 0.8 }, rect: [b.cx - 24, b.cz - 24, b.cx + 24, b.cz + 24] };
  // ads flip every few seconds (staggered), tickers scroll, the ball sparkles
  let last = -1;
  ctx.animated.push((t) => {
    tick.offset.x = (t * 0.04) % 1;
    ball.rotation.y = t * 0.3;
    const slot = Math.floor(t / 6);
    if (slot === last) return;
    last = slot;
    for (const s of screens) {
      if ((s.k + slot) % 3 !== 0) continue;
      s.m.material.map = s.set[(s.k + slot) % s.set.length];
      s.m.material.needsUpdate = true;
    }
  });
}

/** Tourists milling around the square, taking photos and sitting on the steps. */
export class TimesSquareLife {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.people = [];
  }

  setCity(city) {
    this.clear();
    this.city = city;
    this.ts = city.timesSquare;
    if (this.ts) this.game.scene.add(this.group);
  }

  clear() {
    for (const p of this.people) p.rig.dispose();
    this.people = [];
    this.group.clear();
    this.group.removeFromParent();
  }

  /** A random open spot on the plaza (not inside the towers, steps or booth). */
  spot() {
    const [x0, z0, x1, z1] = this.ts.rect;
    for (let i = 0; i < 20; i++) {
      const x = x0 + 3 + Math.random() * (x1 - x0 - 6);
      const z = z0 + 3 + Math.random() * (z1 - z0 - 6);
      if (!this.city.colliders.pointBlocked(x, this.city.K.CURB + 0.3, z, 0.5)) return [x, z];
    }
    return [this.ts.front.x, this.ts.front.z + 4];
  }

  spawn() {
    const ts = this.ts;
    const roles = ['tourist', 'tourist', 'tourist', 'civilian', 'student', 'business', 'tourist', 'shopper', 'police', 'tourist', 'civilian', 'tourist', 'student', 'tourist'];
    roles.forEach((role, k) => {
      const rig = createRig(roleAppearance(role, Math.random));
      const [sx, sz] = this.spot();
      const p = { rig, x: sx, z: sz, tx: 0, tz: 0, ry: Math.random() * 6, moving: false, wait: Math.random() * 4, photo: role === 'tourist' && Math.random() < 0.6 };
      // a few on the red steps
      if (k < 5) {
        const s = ts.seats[(k * 7 + 3) % ts.seats.length];
        Object.assign(p, { x: s.x, z: s.z, seat: s, ry: 0 });
      }
      this.group.add(rig.group);
      this.people.push(p);
    });
  }

  update(dt, playerPos, visible) {
    const ts = this.ts;
    if (!ts) return;
    this.group.visible = visible;
    if (!visible) return;
    const near = (playerPos.x - ts.x) ** 2 + (playerPos.z - ts.z) ** 2 < 140 * 140;
    if (!near) return;
    if (!this.people.length) this.spawn();
    const col = this.city.colliders;
    const Y = this.city.K.CURB;
    for (const p of this.people) {
      if (p.seat) {
        p.rig.group.position.set(p.x, Y + p.seat.lift, p.z);
        p.rig.group.rotation.y = 0;
        animateRig(p.rig, dt, { speed: 0, grounded: true, sitting: true });
        continue;
      }
      if (!p.moving) {
        p.wait -= dt;
        if (p.wait <= 0) {
          [p.tx, p.tz] = this.spot();
          p.moving = true;
        }
      } else {
        const dx = p.tx - p.x;
        const dz = p.tz - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.4 || col.pointBlocked(p.x + (dx / d) * 0.6, Y + 0.5, p.z + (dz / d) * 0.6, 0.25)) {
          p.moving = false;
          p.wait = 2 + Math.random() * 6;
          p.ry = Math.atan2(ts.x - p.x, ts.z - 30 - p.z) + (Math.random() - 0.5);
        } else {
          p.x += (dx / d) * 1.1 * dt;
          p.z += (dz / d) * 1.1 * dt;
          p.ry = Math.atan2(dx, dz);
        }
      }
      p.rig.group.position.set(p.x, Y, p.z);
      p.rig.group.rotation.y = p.ry;
      animateRig(p.rig, dt, { speed: p.moving ? 1.1 : 0, grounded: true, phone: !p.moving && p.photo, talking: !p.moving && !p.photo });
    }
  }
}
