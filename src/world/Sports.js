// A neighbourhood sports block: a fenced basketball court (blue with red keys,
// two hoops with chain nets) and a five-a-side soccer pitch on artificial turf,
// with benches, court lights and a water fountain. SportsLife runs pickup games:
// players dribble, pass and shoot; spectators watch from the benches. Join in.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { roleAppearance } from '../characters/Customization.js';

const BB = { cz: -12.5, L: 26, W: 14, hoop: 11.6, rim: 3.05 };
const SO = { cz: 11.5, L: 32, W: 18, goal: 16, gw: 3.6, gh: 2 };

function courtTexture() {
  const c = document.createElement('canvas');
  c.width = 1040;
  c.height = 560;
  const g = c.getContext('2d');
  const s = 40; // px per metre
  g.fillStyle = '#2f6aa8';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#c23b3b';
  for (const side of [0, 1]) {
    const x = side ? c.width - 5.8 * s : 0;
    g.fillRect(x, c.height / 2 - 2.45 * s, 5.8 * s, 4.9 * s);
  }
  g.strokeStyle = '#f4f4f2';
  g.lineWidth = 5;
  g.strokeRect(4, 4, c.width - 8, c.height - 8);
  g.beginPath();
  g.moveTo(c.width / 2, 0);
  g.lineTo(c.width / 2, c.height);
  g.stroke();
  g.beginPath();
  g.arc(c.width / 2, c.height / 2, 1.8 * s, 0, Math.PI * 2);
  g.stroke();
  for (const side of [0, 1]) {
    const hx = side ? c.width - 1.6 * s : 1.6 * s;
    const dir = side ? -1 : 1;
    // key, free-throw circle, three-point arc
    g.strokeRect(side ? c.width - 5.8 * s : 0, c.height / 2 - 2.45 * s, 5.8 * s, 4.9 * s);
    g.beginPath();
    g.arc(hx + dir * 4.2 * s, c.height / 2, 1.8 * s, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(hx, c.height / 2, 6.75 * s, side ? Math.PI / 2 + 0.33 : -Math.PI / 2 + 0.33, side ? (Math.PI * 3) / 2 - 0.33 : Math.PI / 2 - 0.33, false);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function pitchTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 576;
  const g = c.getContext('2d');
  const s = 32;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#3f8f3f' : '#46993f';
    g.fillRect((i * c.width) / 8, 0, c.width / 8, c.height);
  }
  g.strokeStyle = '#f4f4f2';
  g.lineWidth = 5;
  g.strokeRect(6, 6, c.width - 12, c.height - 12);
  g.beginPath();
  g.moveTo(c.width / 2, 0);
  g.lineTo(c.width / 2, c.height);
  g.stroke();
  g.beginPath();
  g.arc(c.width / 2, c.height / 2, 3 * s, 0, Math.PI * 2);
  g.stroke();
  for (const side of [0, 1]) {
    g.strokeRect(side ? c.width - 5 * s : 0, c.height / 2 - 4.5 * s, 5 * s, 9 * s);
    g.beginPath();
    g.arc(side ? c.width - 3.6 * s : 3.6 * s, c.height / 2, 4, 0, Math.PI * 2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function linkTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  g.strokeStyle = '#b9bdc3';
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(32, 32);
  g.moveTo(32, 0);
  g.lineTo(0, 32);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

class Bag {
  constructor() {
    this.list = [];
  }
  add(geo, color, x = 0, y = 0, z = 0, ry = 0) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    if (ry) geo.rotateY(ry);
    geo.translate(x, y, z);
    const n = geo.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    geo.deleteAttribute('uv');
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(geo);
  }
}
const bx = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cy = (r0, r1, h, x = 0, y = 0, z = 0, s = 8) => new THREE.CylinderGeometry(r0, r1, h, s).translate(x, y, z);

export function buildSports(ctx, b) {
  const { group, colliders, K } = ctx;
  const Y = K.CURB;
  const cx = b.cx;
  const cz = b.cz;
  const flat = (w, d, mat, x, z, y = 0.02) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat);
    m.position.set(cx + x, Y + y, cz + z);
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const inner = K.BLOCK - 2 * K.SIDEWALK;
  flat(inner, inner, new THREE.MeshStandardMaterial({ color: '#5d6168', roughness: 0.95 }), 0, 0, 0.008);
  flat(BB.L + 2, BB.W + 2, new THREE.MeshStandardMaterial({ color: '#3a4a5a', roughness: 0.9 }), 0, BB.cz, 0.014);
  flat(BB.L, BB.W, new THREE.MeshStandardMaterial({ map: courtTexture(), roughness: 0.75 }), 0, BB.cz);
  flat(SO.L + 2, SO.W + 2, new THREE.MeshStandardMaterial({ color: '#3a7a3a', roughness: 1 }), 0, SO.cz, 0.014);
  flat(SO.L, SO.W, new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 1 }), 0, SO.cz);
  for (const m of group.children.slice(-5)) if (m.material.map) m.material.userData.ownMap = true;

  const bag = new Bag();
  const put = (geo, color, x, z, ry = 0) => bag.add(geo, color, cx + x, Y, cz + z, ry);
  // hoops: padded pole, arm, backboard with a square, orange rim, chain net
  for (const s of [-1, 1]) {
    const px = s * (BB.hoop + 1.4);
    put(cy(0.1, 0.12, 3.6, 0, 1.8, 0), '#2b2d33', px, BB.cz);
    put(bx(0.3, 1.2, 0.3, 0, 0.6, 0), '#c23b3b', px, BB.cz);
    put(bx(1.1, 0.12, 0.12, -s * 0.55, 3.55, 0), '#2b2d33', px, BB.cz);
    put(bx(0.05, 1.05, 1.8, -s * 1.1, 3.45, 0), '#f4f4f2', px, BB.cz);
    put(bx(0.06, 0.45, 0.6, -s * 1.12, 3.3, 0), '#c23b3b', px, BB.cz);
    put(new THREE.TorusGeometry(0.23, 0.02, 6, 18).rotateX(Math.PI / 2).translate(-s * 1.4, BB.rim, 0), '#e8742a', px, BB.cz);
    put(new THREE.CylinderGeometry(0.23, 0.15, 0.4, 12, 1, true).translate(-s * 1.4, BB.rim - 0.2, 0), '#d8dde6', px, BB.cz);
    colliders.add(cx + px - 0.2, cz + BB.cz - 0.2, cx + px + 0.2, cz + BB.cz + 0.2, 3.6);
  }
  // soccer goals: posts, crossbar, a net box
  for (const s of [-1, 1]) {
    const gx = s * SO.goal;
    for (const m of [-1, 1]) put(cy(0.06, 0.06, SO.gh, 0, SO.gh / 2, m * SO.gw / 2), '#f4f4f2', gx, SO.cz);
    put(cy(0.06, 0.06, SO.gw, 0, SO.gh, 0).rotateX(Math.PI / 2).translate(0, 0, 0), '#f4f4f2', gx, SO.cz);
    for (const m of [-1, 1]) colliders.add(cx + gx - 0.1, cz + SO.cz + m * SO.gw / 2 - 0.1, cx + gx + 0.1, cz + SO.cz + m * SO.gw / 2 + 0.1, 2);
  }
  // benches for spectators between the courts, a water fountain, court lights
  const benches = [];
  for (const x of [-15, -9, 9, 15]) {
    put(bx(3, 0.07, 0.45, 0, 0.45, 0), '#7a5a3c', x, -2.8);
    put(bx(3, 0.45, 0.06, 0, 0.75, -0.22), '#7a5a3c', x, -2.8);
    for (const m of [-1.3, 1.3]) put(bx(0.08, 0.45, 0.42, m, 0.22, 0), '#2b2d33', x, -2.8);
    colliders.add(cx + x - 1.5, cz - 3.05, cx + x + 1.5, cz - 2.55, 0.9);
    for (const o of [-0.9, 0.9]) benches.push({ x: cx + x + o, z: cz - 2.55, ry: 0 });
  }
  put(cy(0.22, 0.26, 0.95, 0, 0.47, 0), '#5a6068', 3.2, -3);
  put(cy(0.28, 0.28, 0.08, 0, 0.98, 0), '#8a9098', 3.2, -3);
  colliders.add(cx + 2.9, cz - 3.3, cx + 3.5, cz - 2.7, 1);
  const lightHeads = [];
  for (const [x, z] of [[-22.5, -22.5], [22.5, -22.5], [-22.5, 22.5], [22.5, 22.5]]) {
    put(cy(0.12, 0.16, 9, 0, 4.5, 0), '#2b2d33', x, z);
    put(bx(1.4, 0.5, 0.3, 0, 9.1, 0), '#2b2d33', x, z, Math.atan2(-x, -z));
    lightHeads.push([x, z]);
    colliders.add(cx + x - 0.2, cz + z - 0.2, cx + x + 0.2, cz + z + 0.2, 9);
  }
  // chain-link fence: posts every 3 m, gates in the middle of the north and south sides
  const F = 23.5;
  const FH = 3.2;
  const segs = [];
  const run = (x0, z0, x1, z1) => segs.push([x0, z0, x1, z1]);
  for (const s of [-1, 1]) {
    run(-F, s * F, -1.6, s * F);
    run(1.6, s * F, F, s * F);
    run(s * F, -F, s * F, F);
  }
  run(-F, -1.2, -2, -1.2); // between the courts (a gap in the middle)
  run(2, -1.2, F, -1.2);
  const linkMat = new THREE.MeshBasicMaterial({ map: linkTexture(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
  linkMat.userData.ownMap = true;
  const panels = [];
  for (const [x0, z0, x1, z1] of segs) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const h = z0 === -1.2 && z1 === -1.2 ? 1.6 : FH; // the divider between the courts is low
    const p = new THREE.PlaneGeometry(len, h);
    const uv = p.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len * 4, uv.getY(i) * h * 4);
    p.rotateY(x0 === x1 ? Math.PI / 2 : 0);
    p.translate(cx + (x0 + x1) / 2, Y + h / 2, cz + (z0 + z1) / 2);
    panels.push(p);
    const n = Math.max(1, Math.round(len / 3));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      put(cy(0.04, 0.04, h + 0.05, 0, (h + 0.05) / 2, 0, 6), '#8a9098', x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
    }
    put(cy(0.035, 0.035, len, 0, h, 0, 6).rotateZ(Math.PI / 2).rotateY(x0 === x1 ? Math.PI / 2 : 0), '#8a9098', (x0 + x1) / 2, (z0 + z1) / 2);
    colliders.add(cx + Math.min(x0, x1) - 0.06, cz + Math.min(z0, z1) - 0.06, cx + Math.max(x0, x1) + 0.06, cz + Math.max(z0, z1) + 0.06, h);
  }
  group.add(new THREE.Mesh(mergeGeometries(panels), linkMat));
  const mesh = new THREE.Mesh(mergeGeometries(bag.list), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  // lamp heads glow at night
  const glow = new THREE.MeshBasicMaterial({ color: '#40382c' });
  for (const [x, z] of lightHeads) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.3), glow);
    m.position.set(cx + x, Y + 8.84, cz + z);
    m.rotation.y = Math.atan2(-x, -z);
    group.add(m);
  }
  ctx.animated.push(() => glow.color.copy(ctx.lampMat.color));
  ctx.sports = { x: cx, z: cz, Y, bb: { x: cx, z: cz + BB.cz, hoops: [[cx - BB.hoop, cz + BB.cz], [cx + BB.hoop, cz + BB.cz]], L: BB.L, W: BB.W }, so: { x: cx, z: cz + SO.cz, goals: [[cx - SO.goal, cz + SO.cz], [cx + SO.goal, cz + SO.cz]], L: SO.L, W: SO.W }, benches };
  ctx.benchSpots?.push(...benches);
}

// ------------------------------------------------------------------ the games
const HOOPS = { size: 0.12, color: '#d8661e', speed: 2.6 };
const SOCCER = { size: 0.11, color: '#f4f4f2', speed: 3 };

export class SportsLife {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.people = [];
    this.games = [];
  }

  setCity(city) {
    this.clear();
    this.city = city;
    this.S = city.sports;
    if (this.S) this.game.scene.add(this.group);
  }

  clear() {
    for (const p of this.people) p.rig.dispose();
    this.people = [];
    this.games = [];
    this.group.clear();
    this.group.removeFromParent();
  }

  rig(look) {
    const r = createRig(look);
    this.group.add(r.group);
    return r;
  }

  spawn() {
    const S = this.S;
    const jersey = (c) => ({ top: Math.random() < 0.5 ? 'tank' : 'tee', topColor: c, bottom: 'shorts', bottomColor: Math.random() < 0.5 ? '#1d1f24' : '#f4f4f2', shoes: 'sneakers', accessory: 'none', hat: 'none', carry: 'none' });
    const mkGame = (kind, area, n, colors) => {
      const g = { kind, area, cfg: kind === 'hoops' ? HOOPS : SOCCER, players: [], holder: 0, hold: 1.5, flight: null };
      for (let i = 0; i < n; i++) {
        const team = i % 2;
        const r = this.rig({ ...roleAppearance('jogger', Math.random), ...jersey(colors[team]) });
        const p = { rig: r, team, x: area.x + (Math.random() - 0.5) * area.L * 0.6, z: area.z + (Math.random() - 0.5) * area.W * 0.6, ry: 0, speed: 0, hit: 0 };
        g.players.push(p);
        this.people.push(p);
      }
      const ball = new THREE.Mesh(new THREE.SphereGeometry(g.cfg.size, 14, 10), new THREE.MeshStandardMaterial({ color: g.cfg.color, roughness: 0.6 }));
      ball.castShadow = true;
      this.group.add(ball);
      g.ball = ball;
      this.games.push(g);
      return g;
    };
    this.hoops = mkGame('hoops', S.bb, 6, ['#c53a3a', '#f4f4f2']);
    this.soccer = mkGame('soccer', S.so, 8, ['#2f6db5', '#f2c230']);
    // spectators on the benches
    for (const s of S.benches.slice(0, 5)) {
      const r = this.rig(roleAppearance(['student', 'civilian', 'tourist', 'elderly', 'student'][this.people.length % 5], Math.random));
      const p = { rig: r, x: s.x, z: s.z, ry: Math.PI, seat: true };
      this.people.push(p);
    }
  }

  /** Everyone who can get the ball in a game (and you, once you join). */
  members(g) {
    const list = g.players.map((p) => ({ p }));
    const em = this.game.player.emote?.id;
    if ((em === 'hoops' && g.kind === 'hoops') || (em === 'soccer' && g.kind === 'soccer')) list.push({ you: true });
    return list;
  }

  posOf(m) {
    return m.you ? this.game.player.pos : m.p;
  }

  update(dt, pos, visible) {
    const S = this.S;
    if (!S) return;
    this.group.visible = visible;
    if (!visible) return;
    if ((S.x - pos.x) ** 2 + (S.z - pos.z) ** 2 > 150 * 150) return;
    // walking off the court leaves the game
    const em = this.game.player.emote;
    if (em && (em.id === 'hoops' || em.id === 'soccer')) {
      const a = em.id === 'hoops' ? S.bb : S.so;
      if (Math.abs(pos.x - a.x) > a.L / 2 + 4 || Math.abs(pos.z - a.z) > a.W / 2 + 4) this.game.player.emote = null;
    }
    if (!this.people.length) this.spawn();
    const t = performance.now() / 1000;
    for (const g of this.games) this.play(g, dt, t);
    for (const p of this.people) {
      if (p.seat) {
        p.rig.group.position.set(p.x, S.Y, p.z);
        p.rig.group.rotation.y = Math.sin(t * 0.3 + p.x) * 0.25; // facing the pitch, following the play
        animateRig(p.rig, dt, { speed: 0, grounded: true, sitting: true, talking: Math.sin(t * 0.4 + p.x) > 0.5 });
        continue;
      }
      p.hit = Math.max(0, p.hit - dt);
      p.rig.group.position.set(p.x, S.Y + (p.hit > 0 ? Math.sin((p.hit / 0.5) * Math.PI) * 0.35 : 0), p.z);
      p.rig.group.rotation.y = p.ry;
      animateRig(p.rig, dt, { speed: p.speed, grounded: true, cheering: p.hit > 0 });
    }
  }

  play(g, dt, t) {
    const A = g.area;
    const M = this.members(g);
    const S = this.S;
    if (g.holder >= M.length) g.holder = 0;
    const ballY = S.Y + g.cfg.size;
    if (g.flight) {
      const f = g.flight;
      f.t += dt / f.dur;
      const k = Math.min(1, f.t);
      g.ball.position.set(f.x0 + (f.x1 - f.x0) * k, f.y0 + (f.y1 - f.y0) * k + Math.sin(k * Math.PI) * f.h, f.z0 + (f.z1 - f.z0) * k);
      if (f.t >= 1) {
        g.flight = null;
        if (f.shot) {
          if (f.you && f.made) {
            this.game.audio?.play('success');
            this.game.events.emit('toast', { icon: g.kind === 'hoops' ? '🏀' : '⚽', title: g.kind === 'hoops' ? 'Swish!' : 'GOAL!', text: g.kind === 'hoops' ? 'Nothing but net. Your team erupts.' : 'Top corner. They will be talking about that one.', kind: 'good' });
            this.game.state.stats.pickupScores = (this.game.state.stats.pickupScores || 0) + 1;
          }
          // rebound / restart: someone near the basket or goal gets it
          g.holder = Math.floor(Math.random() * M.length);
          g.hold = 1.2 + Math.random();
        } else g.holder = f.to;
        if (M[g.holder]?.p) M[g.holder].p.hit = 0.5;
      }
    } else {
      // the holder dribbles toward the goal they attack
      g.hold -= dt;
      const m = M[g.holder];
      const h = this.posOf(m);
      const team = m.you ? 1 : m.p.team;
      const goal = g.kind === 'hoops' ? S.bb.hoops[team] : S.so.goals[team];
      if (m.p) {
        const tx = goal[0] - Math.sign(goal[0] - A.x) * (g.kind === 'hoops' ? 4 : 6);
        this.moveTo(m.p, tx, A.z + Math.sin(t * 0.7 + team) * A.W * 0.25, g.cfg.speed * 0.8, dt);
      }
      const fy = Math.sin(m.p ? m.p.ry : this.game.player.heading);
      const fz = Math.cos(m.p ? m.p.ry : this.game.player.heading);
      const bounce = g.kind === 'hoops' ? Math.abs(Math.sin(t * 7)) * 0.75 : 0;
      g.ball.position.set(h.x + fy * 0.45 + fz * 0.15, ballY + bounce + (g.kind === 'hoops' ? 0.1 : 0), h.z + fz * 0.45 - fy * 0.15);
      if (g.hold <= 0) {
        const near = Math.hypot(goal[0] - h.x, goal[1] - h.z) < (g.kind === 'hoops' ? 7.5 : 11);
        if (near && Math.random() < (m.you ? 1 : 0.55)) {
          // shoot
          const made = Math.random() < (m.you ? 0.62 : 0.45);
          const gx = goal[0] + (made ? 0 : (Math.random() - 0.5) * 1.6);
          const gz = goal[1] + (made ? 0 : (Math.random() - 0.5) * 1.6);
          g.flight = { x0: g.ball.position.x, y0: g.ball.position.y, z0: g.ball.position.z, x1: gx, y1: g.kind === 'hoops' ? S.Y + BB.rim : S.Y + 0.6, z1: gz, h: g.kind === 'hoops' ? 2.6 : 0.8, t: 0, dur: 1.1, shot: true, made, you: !!m.you };
          if (m.p) m.p.hit = 0.5;
        } else {
          // pass, mostly to a teammate
          let to = g.holder;
          for (let k = 0; k < 6 && to === g.holder; k++) {
            const c = Math.floor(Math.random() * M.length);
            const ct = M[c].you ? 1 : M[c].p.team;
            if (c !== g.holder && (ct === team || Math.random() < 0.25)) to = c;
          }
          if (to === g.holder) to = (g.holder + 1) % M.length;
          const d = this.posOf(M[to]);
          g.flight = { x0: g.ball.position.x, y0: g.ball.position.y, z0: g.ball.position.z, x1: d.x, y1: ballY + (g.kind === 'hoops' ? 1.1 : 0), z1: d.z, h: g.kind === 'hoops' ? 0.4 : 0.05, t: 0, dur: 0.7 + Math.hypot(d.x - h.x, d.z - h.z) / 14, to };
        }
        g.hold = m.you ? 1.2 : 0.9 + Math.random() * 1.6;
      }
    }
    // everyone else: drift into space on their side, turning to watch the ball
    for (let i = 0; i < g.players.length; i++) {
      const p = g.players[i];
      if (M[g.holder]?.p === p && !g.flight) continue;
      p.tT = (p.tT || 0) - dt;
      if (p.tT <= 0 || p.tx == null) {
        p.tT = 1.5 + Math.random() * 2.5;
        const bx2 = g.ball.position.x;
        p.tx = Math.max(A.x - A.L / 2 + 1, Math.min(A.x + A.L / 2 - 1, bx2 + (Math.random() - 0.5) * A.L * 0.5));
        p.tz = A.z + (Math.random() - 0.5) * A.W * 0.8;
      }
      this.moveTo(p, p.tx, p.tz, g.cfg.speed * (0.6 + (i % 3) * 0.15), dt, g.ball.position);
    }
  }

  moveTo(p, tx, tz, speed, dt, look) {
    const dx = tx - p.x;
    const dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) {
      p.speed = Math.max(0, p.speed - dt * 6);
      if (look) p.ry = Math.atan2(look.x - p.x, look.z - p.z);
      return;
    }
    p.speed = Math.min(speed, p.speed + dt * 5);
    p.x += (dx / d) * p.speed * dt;
    p.z += (dz / d) * p.speed * dt;
    p.ry = Math.atan2(dx, dz);
  }

  interactable(pos) {
    const S = this.S;
    if (!S || (S.x - pos.x) ** 2 + (S.z - pos.z) ** 2 > 30 * 30) return null;
    const em = this.game.player.emote?.id;
    const inArea = (a) => Math.abs(pos.x - a.x) < a.L / 2 + 1.5 && Math.abs(pos.z - a.z) < a.W / 2 + 1.5;
    if (em !== 'hoops' && inArea(S.bb)) return { label: '🏀 Join the pickup game', action: () => this.join('hoops') };
    if (em !== 'soccer' && inArea(S.so)) return { label: '⚽ Join the kickabout', action: () => this.join('soccer') };
    return null;
  }

  join(kind) {
    const game = this.game;
    game.player.emote = { id: kind, held: true, t: 0, move: true };
    game.hud.hint('sport_' + kind, kind === 'hoops' ? 'You are in! The ball comes to you; near the hoop you take the shot. Move away to leave.' : 'You are in! Get the ball near the goal and you will shoot. Move away to leave.', 7);
    game.events.emit('toast', { icon: kind === 'hoops' ? '🏀' : '⚽', title: kind === 'hoops' ? '"We got next!"' : '"You can be on our team!"', text: 'You join the game.', kind: 'info' });
  }
}
