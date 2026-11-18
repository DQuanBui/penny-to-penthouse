// A university campus (classical halls around a green quad, a clock tower,
// students on the lawn) and a neighbourhood school (brick building, fenced
// yard with basketball hoops and a playground, kids at recess).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FACADE } from './Buildings.js';
import { labelTexture } from './Textures.js';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { roleAppearance } from '../characters/Customization.js';
import { hourOf, dayOf } from '../core/Clock.js';
import { mulberry32, dampAngle } from '../core/utils.js';

class Bag {
  constructor() {
    this.list = [];
  }
  add(geo, color, x = 0, y = 0, z = 0) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    geo.translate(x, y, z);
    const n = geo.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(geo);
  }
  mesh() {
    const m = new THREE.Mesh(mergeGeometries(this.list), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    m.castShadow = m.receiveShadow = true;
    return m;
  }
}
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cy = (r0, r1, h, s = 12) => new THREE.CylinderGeometry(r0, r1, h, s);

/** Diamond chain-link pattern (transparent between the wires). */
function chainLink() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = '#b9c0c8';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 32);
  g.lineTo(32, 0);
  g.lineTo(64, 32);
  g.lineTo(32, 64);
  g.closePath();
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signMesh(group, text, icon, x, y, z, ry, w = 6, h = 0.8, bg = '#2b2f5a') {
  const tex = labelTexture(text, { icon, bg, accent: '#e9c04c' });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  group.add(m);
}

/** University campus on block b. */
export function buildCampus(ctx, b) {
  const { group, colliders, K, places, batch } = ctx;
  const Y = K.CURB;
  const cx = b.cx;
  const cz = b.cz;
  const bag = new Bag();
  const name = ctx.cfg.university || `${ctx.cfg.name} University`;
  const stone = '#d8cfbd';
  const style = (seed) => ({ floorH: 4.2, bay: 3.4, seed, type: FACADE.MASONRY });
  const hall = (x0, z0, x1, z1, h, seed) => {
    batch.add((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, h, stone, style(seed));
    colliders.add(x0, z0, x1, z1, h + Y);
    // cornice
    bag.add(bx(x1 - x0 + 0.6, 0.5, z1 - z0 + 0.6), '#efe8da', (x0 + x1) / 2, Y + h + 0.25, (z0 + z1) / 2);
  };
  // north main hall, east and west wings around a quad open to the south
  hall(cx - 18, cz - 24, cx + 18, cz - 15, 15, 11);
  hall(cx + 15, cz - 13, cx + 24, cz + 14, 12, 23);
  hall(cx - 24, cz - 13, cx - 15, cz + 14, 12, 37);
  // clock tower on the main hall
  batch.add(cx, cz - 19.5, 5, 5, 16, '#cfc5b0', style(51), 15);
  bag.add(new THREE.ConeGeometry(3.8, 6, 4).rotateY(Math.PI / 4), '#5a6a7a', cx, Y + 34, cz - 19.5);
  colliders.add(cx - 2.5, cz - 22, cx + 2.5, cz - 17, 31 + Y);
  const clock = new THREE.Group();
  clock.position.set(cx, Y + 26.5, cz - 16.95);
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), new THREE.MeshStandardMaterial({ color: '#f6f2e6', emissive: '#fff4d0', emissiveIntensity: 0.15 }));
  clock.add(face);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.12, 6, 32), new THREE.MeshStandardMaterial({ color: '#3a3f48' }));
  clock.add(ring);
  const handMat = new THREE.MeshStandardMaterial({ color: '#1d1f24' });
  const hourH = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, 0.05).translate(0, 0.42, 0.04), handMat);
  const minH = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.05).translate(0, 0.65, 0.06), handMat);
  clock.add(hourH, minH);
  group.add(clock);
  // portico with columns at the main door
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const x = cx + i * 1.8;
    bag.add(cy(0.38, 0.42, 7, 14), '#f2ece0', x, Y + 3.5, cz - 13.6);
    colliders.add(x - 0.4, cz - 14, x + 0.4, cz - 13.2, 7 + Y);
  }
  bag.add(bx(13.5, 0.9, 3.2), '#efe8da', cx, Y + 7.45, cz - 14.2);
  bag.add(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-7, 0), new THREE.Vector2(7, 0), new THREE.Vector2(0, 2.2)]), { depth: 0.6, bevelEnabled: false }), '#efe8da', cx, Y + 7.9, cz - 13.3);
  for (let s = 0; s < 3; s++) bag.add(bx(14 - s * 0.6, 0.15, 3.6 - s * 0.6), '#cfc6b4', cx, Y + 0.07 + s * 0.15, cz - 13.4 + s * 0.3);
  signMesh(group, name, '🎓', cx, Y + 7.45, cz - 12.58, 0, 9, 0.75);
  // the quad: lawn, cross paths, a statue, trees and benches
  bag.add(bx(28, 0.04, 26), '#5f9a4a', cx, Y + 0.02, cz + 1);
  bag.add(bx(3, 0.05, 30), '#d8cfbd', cx, Y + 0.035, cz + 1);
  bag.add(bx(28, 0.05, 3), '#d8cfbd', cx, Y + 0.035, cz + 1);
  bag.add(bx(2.2, 1.4, 2.2), '#bdb4a2', cx, Y + 0.7, cz + 1);
  bag.add(cy(0.35, 0.45, 1.9, 10), '#5f7a6a', cx, Y + 2.35, cz + 1);
  bag.add(new THREE.SphereGeometry(0.32, 12, 8), '#5f7a6a', cx, Y + 3.5, cz + 1);
  colliders.add(cx - 1.1, cz - 0.1, cx + 1.1, cz + 2.1, 3.6);
  for (const [x, z] of [[-9, -6], [9, -6], [-9, 9], [9, 9], [-5, 12], [5, 12]]) {
    bag.add(cy(0.18, 0.24, 3, 8), '#6b4a2a', cx + x, Y + 1.5, cz + z);
    bag.add(new THREE.IcosahedronGeometry(2.2, 1), '#3f7a3a', cx + x, Y + 4.2, cz + z);
    colliders.add(cx + x - 0.25, cz + z - 0.25, cx + x + 0.25, cz + z + 0.25, 3);
  }
  for (const [x, z, ry] of [[-3, -6, Math.PI / 2], [3, 6, -Math.PI / 2], [-6, 3.2, 0], [6, -1.2, Math.PI]]) {
    bag.add(bx(ry % Math.PI ? 0.5 : 1.6, 0.45, ry % Math.PI ? 1.6 : 0.5), '#6b4a2a', cx + x, Y + 0.45, cz + z);
    ctx.benchSpots?.push({ x: cx + x, z: cz + z, ry });
  }
  // gate posts and a low wall on the south side
  for (const s of [-1, 1]) {
    bag.add(bx(14, 1.0, 0.5), '#bdb4a2', cx + s * 10, Y + 0.5, cz + 23.5);
    colliders.add(cx + s * 10 - 7, cz + 23.25, cx + s * 10 + 7, cz + 23.75, 1);
    bag.add(bx(0.9, 3.2, 0.9), '#bdb4a2', cx + s * 3.2, Y + 1.6, cz + 23.5);
  }
  signMesh(group, name, '🎓', cx, Y + 3.0, cz + 23.96, 0, 5.4, 0.62);
  group.add(bag.mesh());

  const place = {
    id: 'university', type: 'university', name, district: b.district, icon: '🎓', color: '#7a7fe0', label: 'University', custom: true,
    nx: 0, nz: 1, doorX: cx, doorZ: cz - 15, x: cx, z: cz - 12.4,
  };
  places.push(place);
  ctx.campus = { name, cx, cz, clock: { hourH, minH }, place };
  return ctx.campus;
}

/** Neighbourhood school on block b. */
export function buildSchool(ctx, b) {
  const { group, colliders, K, places, batch } = ctx;
  const Y = K.CURB;
  const cx = b.cx;
  const cz = b.cz;
  const bag = new Bag();
  const name = ctx.cfg.school || `P.S. 47 ${ctx.cfg.name} School`;
  // brick building along the north half
  batch.add(cx, cz - 17, 44, 14, 13, '#a8553a', { floorH: 4.0, bay: 3.2, seed: 7, type: FACADE.MASONRY });
  colliders.add(cx - 22, cz - 24, cx + 22, cz - 10, 13 + Y);
  bag.add(bx(44.6, 0.5, 14.6), '#e9e2d0', cx, Y + 13.25, cz - 17);
  // entrance canopy and steps
  bag.add(bx(6, 0.25, 2.4), '#2f5a7a', cx, Y + 3.4, cz - 8.8);
  for (const s of [-1, 1]) bag.add(cy(0.1, 0.1, 3.3, 8), '#e9e2d0', cx + s * 2.7, Y + 1.65, cz - 7.8);
  signMesh(group, name, '🏫', cx, Y + 4.4, cz - 9.92, 0, 7.6, 0.8, '#2f5a7a');
  // the yard: asphalt with a basketball court and a playground
  bag.add(bx(46, 0.04, 22), '#55595f', cx, Y + 0.02, cz + 12);
  bag.add(bx(15, 0.05, 0.12), '#f2f2f0', cx - 10, Y + 0.045, cz + 12);
  bag.add(bx(0.12, 0.05, 14), '#f2f2f0', cx - 10, Y + 0.045, cz + 12);
  bag.add(new THREE.TorusGeometry(2, 0.06, 4, 24).rotateX(Math.PI / 2), '#f2f2f0', cx - 10, Y + 0.05, cz + 12);
  for (const s of [-1, 1]) {
    const hz = cz + 12 + s * 7.6;
    bag.add(cy(0.08, 0.08, 3.4, 8), '#3a3f48', cx - 10, Y + 1.7, hz + s * 0.6);
    bag.add(bx(1.6, 1.0, 0.08), '#f4f4f2', cx - 10, Y + 3.25, hz);
    bag.add(new THREE.TorusGeometry(0.24, 0.025, 6, 16).rotateX(Math.PI / 2), '#e05c2c', cx - 10, Y + 2.95, hz - s * 0.32);
    colliders.add(cx - 10.15, hz + s * 0.6 - 0.15, cx - 9.85, hz + s * 0.6 + 0.15, 3.4);
  }
  // playground: slide, swings, climbing frame on soft red surface
  bag.add(bx(14, 0.05, 12), '#b5583e', cx + 13, Y + 0.045, cz + 13);
  bag.add(bx(1.4, 1.8, 1.4), '#2f8f8f', cx + 9, Y + 0.9, cz + 10);
  bag.add(bx(0.8, 0.08, 3.2).rotateX(0.5), '#e9c04c', cx + 9, Y + 1.0, cz + 12.2);
  bag.add(bx(4.2, 0.12, 0.12), '#c53a3a', cx + 15, Y + 2.4, cz + 10);
  for (const s of [-1, 1]) bag.add(bx(0.12, 2.4, 0.12).rotateZ(s * 0.25), '#c53a3a', cx + 15 + s * 2.2, Y + 1.2, cz + 10);
  for (const x of [-1, 1]) bag.add(bx(0.5, 0.06, 0.22), '#1d1f24', cx + 15 + x, Y + 0.6, cz + 10);
  bag.add(bx(3, 1.6, 3), '#4f9d5d', cx + 15, Y + 0.8, cz + 16);
  colliders.add(cx + 8.3, cz + 9.3, cx + 9.7, cz + 10.7, 1.8);
  colliders.add(cx + 13.5, cz + 14.5, cx + 16.5, cz + 17.5, 1.6);
  // chain-link fence around the yard with a gate on the south side
  const link = chainLink();
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    // see-through chain-link mesh between posts and rails
    const tex = link.clone();
    tex.repeat.set(len / 0.6, 2.2 / 0.6);
    tex.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.1), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.5 }));
    m.position.set((x0 + x1) / 2, Y + 1.1, (z0 + z1) / 2);
    if (!along) m.rotation.y = Math.PI / 2;
    group.add(m);
    bag.add(bx(along ? len : 0.05, 0.05, along ? 0.05 : len), '#9aa2ad', (x0 + x1) / 2, Y + 2.18, (z0 + z1) / 2);
    for (let t = 0; t <= len + 0.01; t += 2.5) {
      const k = t / len;
      bag.add(cy(0.035, 0.035, 2.2, 6), '#9aa2ad', x0 + (x1 - x0) * k, Y + 1.1, z0 + (z1 - z0) * k);
    }
    colliders.add(Math.min(x0, x1) - 0.08, Math.min(z0, z1) - 0.08, Math.max(x0, x1) + 0.08, Math.max(z0, z1) + 0.08, 2.2);
  };
  fence(cx - 23.5, cz - 9.5, cx - 23.5, cz + 23.5);
  fence(cx + 23.5, cz - 9.5, cx + 23.5, cz + 23.5);
  fence(cx - 23.5, cz + 23.5, cx - 2.5, cz + 23.5);
  fence(cx + 2.5, cz + 23.5, cx + 23.5, cz + 23.5);
  // flagpole
  bag.add(cy(0.06, 0.08, 9, 8), '#c9ced6', cx - 4, Y + 4.5, cz - 8.5);
  bag.add(bx(1.4, 0.8, 0.02), '#2f5aa3', cx - 3.3, Y + 8.4, cz - 8.5);
  group.add(bag.mesh());

  const place = {
    id: 'school', type: 'school', name, district: b.district, icon: '🏫', color: '#e0903c', label: 'School', custom: true,
    nx: 0, nz: 1, doorX: cx, doorZ: cz - 10, x: cx, z: cz - 8.2,
  };
  places.push(place);
  ctx.school = { name, cx, cz, place, yard: [cx - 22, cz - 7, cx + 22, cz + 22] };
  return ctx.school;
}

/** Students on the quad and kids in the school yard. */
export class CampusLife {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.people = [];
    this.key = '';
  }

  setCity(city) {
    this.clear();
    this.city = city;
    game(this).scene.add(this.group);
  }

  clear() {
    for (const p of this.people) {
      p.rig.group.removeFromParent();
      p.rig.dispose();
    }
    this.people = [];
    this.group.removeFromParent();
    this.key = '';
  }

  /** Who should be around right now: '' none, or a key describing the crowd. */
  wanted(hr, day) {
    const weekday = day % 7 < 5;
    const recess = weekday && ((hr >= 10 && hr < 10.5) || (hr >= 12 && hr < 13) || (hr >= 15 && hr < 16.5));
    const weekendPlay = !weekday && hr >= 10 && hr < 17;
    const campus = hr >= 8 && hr < 21;
    return `${recess || weekendPlay ? 'kids' : ''}|${campus ? 'students' : ''}`;
  }

  rebuild(key) {
    for (const p of this.people) {
      p.rig.group.removeFromParent();
      p.rig.dispose();
    }
    this.people = [];
    const rng = mulberry32(4711 + key.length);
    const Y = this.city.K.CURB;
    const sc = this.city.school;
    if (sc && key.startsWith('kids')) {
      const [x0, z0, x1, z1] = sc.yard;
      for (let k = 0; k < 12; k++) {
        const look = { ...roleAppearance('student', rng), height: 0.58 + rng() * 0.14, carry: 'none', accessory: rng() < 0.3 ? 'cap' : 'none' };
        const rig = createRig(look);
        const p = { rig, x: x0 + 2 + rng() * (x1 - x0 - 4), z: z0 + 4 + rng() * (z1 - z0 - 6), rect: [x0 + 1, z0 + 3, x1 - 1, z1 - 1], speed: 2.2 + rng() * 1.5, wait: rng() * 2, tx: 0, tz: 0, ry: rng() * 6, moving: false, Y };
        rig.group.position.set(p.x, Y, p.z);
        this.group.add(rig.group);
        this.people.push(p);
      }
    }
    const cp = this.city.campus;
    if (cp && key.endsWith('students')) {
      for (let k = 0; k < 10; k++) {
        const rig = createRig(roleAppearance('student', rng));
        const sitting = k < 4;
        const p = { rig, x: cp.cx + (rng() - 0.5) * 22, z: cp.cz + 1 + (rng() - 0.5) * 20, rect: [cp.cx - 12, cp.cz - 10, cp.cx + 12, cp.cz + 12], speed: sitting ? 0 : 1.1 + rng() * 0.4, wait: rng() * 4, tx: 0, tz: 0, ry: rng() * 6, moving: false, Y, sitting, talk: rng() < 0.5 };
        if (Math.abs(p.x - cp.cx) < 2 && Math.abs(p.z - cp.cz - 1) < 2) p.x += 4;
        rig.group.position.set(p.x, Y, p.z);
        this.group.add(rig.group);
        this.people.push(p);
      }
    }
  }

  update(dt, playerPos, visible) {
    if (!this.city || !this.game.state) return;
    this.group.visible = visible;
    const t = this.game.state.time.total;
    const cp = this.city.campus;
    if (cp) {
      const m = t % 1440;
      cp.clock.minH.rotation.z = -((m % 60) / 60) * Math.PI * 2;
      cp.clock.hourH.rotation.z = -(((m / 60) % 12) / 12) * Math.PI * 2;
    }
    if (!visible) return;
    const near = [this.city.school, cp].some((s) => s && (s.cx - playerPos.x) ** 2 + (s.cz - playerPos.z) ** 2 < 110 * 110);
    const key = near ? this.wanted(hourOf(t), dayOf(t)) : '|';
    if (key !== this.key) {
      this.key = key;
      this.rebuild(key);
    }
    for (const p of this.people) {
      if (p.speed > 0) {
        if (!p.moving) {
          p.wait -= dt;
          if (p.wait <= 0) {
            p.tx = p.rect[0] + Math.random() * (p.rect[2] - p.rect[0]);
            p.tz = p.rect[1] + Math.random() * (p.rect[3] - p.rect[1]);
            p.moving = true;
          }
        } else {
          const dx = p.tx - p.x;
          const dz = p.tz - p.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.3 || this.city.colliders.pointBlocked(p.x + (dx / d) * 0.6, p.Y + 0.5, p.z + (dz / d) * 0.6, 0.2)) {
            p.moving = false;
            p.wait = 0.5 + Math.random() * 3;
          } else {
            const st = Math.min(d, p.speed * dt);
            p.x += (dx / d) * st;
            p.z += (dz / d) * st;
            p.ry = dampAngle(p.ry, Math.atan2(dx, dz), 8, dt);
          }
        }
      }
      p.rig.group.position.set(p.x, p.Y, p.z);
      p.rig.group.rotation.y = p.ry;
      animateRig(p.rig, dt, { speed: p.moving ? p.speed : 0, grounded: true, floor: p.sitting, talking: p.talk && !p.moving });
    }
  }
}
const game = (c) => c.game;
