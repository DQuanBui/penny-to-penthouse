// A skate park block: a concrete pad with two quarter pipes you can ride up
// (they are part of the ground height), a funbox with kickers, rails, ledges,
// a graffiti wall, benches and lights. SkateLife sends local skaters round it,
// popping ollies; a kiosk rents boards. Your own board (bike shop) rides with G.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { roleAppearance } from '../characters/Customization.js';

const QR = 3.2; // quarter pipe radius
const QH = 2.6; // ridable height (stops short of vertical)

/** A skateboard: deck, trucks, wheels (front faces +Z). */
export function makeBoard(color = '#c53a3a') {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.8), new THREE.MeshToonMaterial({ color }));
  deck.position.y = 0.11;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.004, 0.76), new THREE.MeshToonMaterial({ color: '#1d1f24' }));
  grip.position.y = 0.125;
  g.add(deck, grip);
  const wheel = new THREE.MeshToonMaterial({ color: '#f4f1ea' });
  for (const z of [-0.26, 0.26]) {
    const truck = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.05), new THREE.MeshStandardMaterial({ color: '#b9bdc3', metalness: 0.6, roughness: 0.3 }));
    truck.position.set(0, 0.08, z);
    g.add(truck);
    for (const x of [-0.1, 0.1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.035, 10).rotateZ(Math.PI / 2), wheel);
      w.position.set(x, 0.035, z);
      g.add(w);
    }
  }
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  g.userData.wheels = [];
  return g;
}

/** Height of the ramps at (x, z), or null when not on one. */
export function rampY(ramps, x, z) {
  let best = null;
  for (const r of ramps) {
    if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
    let y;
    if (r.kind === 'qp') {
      // distance from the coping wall, rising along a circle
      const d = r.dir > 0 ? z - r.z0 : r.z1 - z;
      const t = Math.min(QR, Math.max(0, d));
      y = Math.min(QH, QR - Math.sqrt(Math.max(0, QR * QR - (QR - t) ** 2)));
    } else if (r.kind === 'box') y = r.h;
    else if (r.kind === 'kick') {
      const t = r.dir > 0 ? (z - r.z0) / (r.z1 - r.z0) : (r.z1 - z) / (r.z1 - r.z0);
      y = r.h * Math.min(1, Math.max(0, t));
    }
    if (y != null && (best == null || y > best)) best = y;
  }
  return best;
}

function graffiti() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8a8d92';
  g.fillRect(0, 0, 1024, 256);
  const cols = ['#ff4fd8', '#3fd0ff', '#ffd23f', '#7cff6b', '#ff6a3c', '#a06bff'];
  for (let i = 0; i < 14; i++) {
    g.fillStyle = cols[i % cols.length];
    g.globalAlpha = 0.85;
    g.beginPath();
    g.ellipse(40 + i * 72, 60 + ((i * 53) % 140), 50 + (i % 3) * 20, 26 + (i % 4) * 10, i, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  g.font = '900 120px Impact, "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 10;
  g.strokeStyle = '#1d1f24';
  for (const [t, x, col] of [['SK8', 200, '#ffd23f'], ['CITY', 520, '#3fd0ff'], ['PARK', 840, '#ff4fd8']]) {
    g.strokeText(t, x, 170);
    g.fillStyle = col;
    g.fillText(t, x, 170);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildSkatePark(ctx, b) {
  const { group, colliders, K } = ctx;
  const Y = K.CURB;
  const cx = b.cx;
  const cz = b.cz;
  const inner = K.BLOCK - 2 * K.SIDEWALK;
  const parts = [];
  const add = (geo, color) => {
    geo = geo.index ? geo.toNonIndexed() : geo;
    const n = geo.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(geo);
  };
  const concrete = '#b9b4aa';
  add(new THREE.BoxGeometry(inner, 0.04, inner).translate(cx, Y + 0.02, cz), concrete);
  const ramps = [];
  // two long quarter pipes, facing each other across the pad
  const qpW = 30;
  for (const dir of [1, -1]) {
    const wallZ = cz - dir * 21; // the coping
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0, QH + 0.2);
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const d = t * QR;
      const y = Math.min(QH, QR - Math.sqrt(Math.max(0, QR * QR - (QR - d) ** 2)));
      shape.lineTo(d, y);
    }
    shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: qpW, bevelEnabled: false, curveSegments: 1 });
    // extrusion runs along +z: turn it to run along x, profile outward from the wall
    geo.rotateY(dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    geo.translate(cx + (dir > 0 ? qpW / 2 : -qpW / 2), Y, wallZ);
    add(geo, '#c9c4b8');
    // the deck behind the coping, and the steel coping pipe
    add(new THREE.BoxGeometry(qpW, QH + 0.2, 2.2).translate(cx, Y + (QH + 0.2) / 2, wallZ - dir * 1.1), '#a9a49a');
    add(new THREE.CylinderGeometry(0.05, 0.05, qpW, 8).rotateZ(Math.PI / 2).translate(cx, Y + QH + 0.2, wallZ), '#d8dde6');
    colliders.add(cx - qpW / 2, Math.min(wallZ, wallZ - dir * 2.2), cx + qpW / 2, Math.max(wallZ, wallZ - dir * 2.2), Y + QH + 0.3);
    ramps.push({ kind: 'qp', dir, x0: cx - qpW / 2, x1: cx + qpW / 2, z0: dir > 0 ? wallZ : wallZ - QR, z1: dir > 0 ? wallZ + QR : wallZ });
  }
  // the funbox in the middle: flat top, kickers at both ends
  const fb = { x: cx, z: cz, w: 6, d: 4, h: 0.6 };
  add(new THREE.BoxGeometry(fb.w, fb.h, fb.d).translate(fb.x, Y + fb.h / 2, fb.z), '#a9a49a');
  ramps.push({ kind: 'box', h: fb.h, x0: fb.x - fb.w / 2, x1: fb.x + fb.w / 2, z0: fb.z - fb.d / 2, z1: fb.z + fb.d / 2 });
  for (const dir of [1, -1]) {
    const z0 = fb.z + dir * fb.d / 2;
    const z1 = z0 + dir * 2.4;
    const kick = new THREE.BufferGeometry();
    const xa = fb.x - fb.w / 2;
    const xb = fb.x + fb.w / 2;
    const v = [xa, Y, z1, xb, Y, z1, xb, Y + fb.h, z0, xa, Y, z1, xb, Y + fb.h, z0, xa, Y + fb.h, z0];
    kick.setAttribute('position', new THREE.Float32BufferAttribute(dir > 0 ? v : [xa, Y, z1, xb, Y + fb.h, z0, xb, Y, z1, xa, Y, z1, xa, Y + fb.h, z0, xb, Y + fb.h, z0], 3));
    kick.computeVertexNormals();
    add(kick, '#c9c4b8');
    ramps.push({ kind: 'kick', h: fb.h, dir: -dir, x0: xa, x1: xb, z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
  }
  // rails and ledges
  for (const [x, z] of [[-14, -6], [14, 6]]) {
    add(new THREE.CylinderGeometry(0.04, 0.04, 6, 8).rotateX(Math.PI / 2).translate(cx + x, Y + 0.45, cz + z), '#d8dde6');
    for (const dz of [-2.6, 2.6]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6).translate(cx + x, Y + 0.225, cz + z + dz), '#9aa2ad');
  }
  for (const [x, z] of [[-14, 7], [14, -7]]) {
    add(new THREE.BoxGeometry(1.2, 0.5, 5).translate(cx + x, Y + 0.25, cz + z), '#9a958a');
    colliders.add(cx + x - 0.6, cz + z - 2.5, cx + x + 0.6, cz + z + 2.5, Y + 0.5);
  }
  // benches and a rental kiosk on the east edge, a graffiti wall on the west
  for (const z of [-10, 10]) {
    add(new THREE.BoxGeometry(0.5, 0.45, 2.4).translate(cx + 22.5, Y + 0.225, cz + z), '#7a5a3c');
    ctx.benchSpots?.push({ x: cx + 22.4, z: cz + z, ry: -Math.PI / 2 });
  }
  add(new THREE.BoxGeometry(2, 2.4, 1.6).translate(cx + 22, Y + 1.2, cz), '#2f5aa3');
  add(new THREE.BoxGeometry(2.3, 0.15, 1.9).translate(cx + 22, Y + 2.48, cz), '#ffd23f');
  colliders.add(cx + 21, cz - 0.8, cx + 23, cz + 0.8, Y + 2.5);
  add(new THREE.BoxGeometry(0.4, 2.6, 30).translate(cx - 23.4, Y + 1.3, cz), '#8a8d92');
  colliders.add(cx - 23.6, cz - 15, cx - 23.2, cz + 15, Y + 2.6);
  const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 2.6), new THREE.MeshStandardMaterial({ map: graffiti(), roughness: 0.9 }));
  wall.material.userData.ownMap = true;
  wall.position.set(cx - 23.18, Y + 1.3, cz);
  wall.rotation.y = Math.PI / 2;
  group.add(wall);
  ctx.skatepark = { x: cx, z: cz, Y, ramps, kiosk: { x: cx + 20.6, z: cz }, rect: [cx - inner / 2 + 1, cz - inner / 2 + 1, cx + inner / 2 - 1, cz + inner / 2 - 1] };
}

/** Local skaters cruising the park, popping ollies and riding the quarter pipes. */
export class SkateLife {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.people = [];
  }

  setCity(city) {
    this.clear();
    this.city = city;
    this.S = city.skatepark;
    if (this.S) this.game.scene.add(this.group);
  }

  clear() {
    for (const p of this.people) p.rig.dispose();
    this.people = [];
    this.group.clear();
    this.group.removeFromParent();
  }

  spawn() {
    const S = this.S;
    for (let i = 0; i < 7; i++) {
      const look = roleAppearance('skater', Math.random);
      look.carry = 'none';
      const rig = createRig(look);
      const board = makeBoard(['#c53a3a', '#1d1f24', '#e9c04c', '#2f8f8f', '#7a3fd0'][i % 5]);
      rig.group.add(board);
      this.group.add(rig.group);
      const [x0, z0, x1, z1] = S.rect;
      this.people.push({ rig, board, x: x0 + 4 + Math.random() * (x1 - x0 - 8), z: z0 + 6 + Math.random() * (z1 - z0 - 12), ry: Math.random() * 6, speed: 3 + Math.random() * 1.5, turn: 0, hop: 0, tT: 0 });
    }
  }

  update(dt, pos, visible) {
    const S = this.S;
    if (!S) return;
    this.group.visible = visible;
    if (!visible || (S.x - pos.x) ** 2 + (S.z - pos.z) ** 2 > 130 * 130) return;
    if (!this.people.length) this.spawn();
    const [x0, z0, x1, z1] = S.rect;
    for (const p of this.people) {
      p.tT -= dt;
      if (p.tT <= 0) {
        p.tT = 1 + Math.random() * 2.5;
        p.turn = (Math.random() - 0.5) * 1.6;
        if (Math.random() < 0.35) p.hop = 0.6;
      }
      // steer back toward the middle near the edges
      const toC = Math.atan2(S.x - p.x, S.z - p.z);
      if (p.x < x0 + 3 || p.x > x1 - 3 || p.z < z0 + 2 || p.z > z1 - 2) p.ry += Math.atan2(Math.sin(toC - p.ry), Math.cos(toC - p.ry)) * Math.min(1, dt * 3);
      else p.ry += p.turn * dt;
      p.x += Math.sin(p.ry) * p.speed * dt;
      p.z += Math.cos(p.ry) * p.speed * dt;
      // keep out of the funbox sides and the decks
      if (this.city.colliders.pointBlocked(p.x, S.Y + 0.3, p.z, 0.3)) {
        p.ry += Math.PI * 0.8;
        p.x += Math.sin(p.ry) * 0.5;
        p.z += Math.cos(p.ry) * 0.5;
      }
      const ground = this.city.groundY(p.x, p.z);
      p.hop = Math.max(0, p.hop - dt);
      const air = p.hop > 0 ? Math.sin((p.hop / 0.6) * Math.PI) * 0.45 : 0;
      p.rig.group.position.set(p.x, ground + air, p.z);
      p.rig.group.rotation.y = p.ry;
      p.board.rotation.z = p.hop > 0.15 && p.hop < 0.45 ? (1 - (p.hop - 0.15) / 0.3) * Math.PI * 2 : 0; // a kickflip
      animateRig(p.rig, dt, { speed: 0, grounded: p.hop <= 0, skate: true, push: Math.sin(performance.now() / 600 + p.x) > 0.7 });
    }
  }

  interactable(pos) {
    const S = this.S;
    if (!S || this.game.player.riding) return null;
    if ((S.kiosk.x - pos.x) ** 2 + (S.kiosk.z - pos.z) ** 2 > 2.4 * 2.4) return null;
    return { label: '🛹 Rent a skateboard · $5', action: () => this.rent() };
  }

  rent() {
    const game = this.game;
    const price = Math.round(5 * (game.sim.city.priceIndex || 1));
    if (!game.sim.finance.spend(price, 'fun', 'Skateboard rental')) return;
    game.mountBike('rental_board');
    game.events.emit('toast', { icon: '🛹', title: 'Board rented', text: 'Space to ollie, ride up the quarter pipes. Press G to hop off.', kind: 'good' });
  }
}
