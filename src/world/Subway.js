// Riding the rails: underground subway platforms (New York) and elevated
// stations (Chicago's L, Miami's Metromover). Trains pull in, open their
// doors, and you ride inside a car while tunnel lights (or the skyline)
// stream past the windows, then come up at the station you picked.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { labelTexture, Tex } from './Textures.js';
import { openStation } from './Transit.js';

export const railKind = (cfg) => cfg.transit?.kind || 'bus';
export const isRail = (cfg) => railKind(cfg) !== 'bus';

const CAR = 15; // car length (m)
const CARS = 3;
const TRACK_Z = 2.0; // train centre line inside the platform room
const DWELL = 11; // seconds with the doors open
const HEADWAY = 16; // seconds between trains

class Bag {
  constructor() {
    this.list = [];
  }
  add(geo, color) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    const c = new THREE.Color(color);
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(geo);
  }
}
const bx = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/** A three-car train along X (front at +X), doors on the platform side (+Z). */
function trainMesh(line, elevated) {
  const body = new Bag();
  const lit = new Bag();
  const steel = elevated ? '#e6e9ec' : '#c3c8cf';
  const len = CAR * CARS;
  for (let c = 0; c < CARS; c++) {
    const x0 = -len / 2 + c * CAR;
    const cx = x0 + CAR / 2;
    body.add(bx(CAR - 0.5, 3.0, 2.9, cx, 1.95, 0), steel);
    body.add(bx(CAR - 0.5, 0.35, 2.95, cx, 1.0, 0), line); // stripe
    body.add(bx(CAR - 0.6, 0.15, 2.7, cx, 3.5, 0), '#9aa2ad'); // roof
    for (const s of [-1, 1]) {
      // window band (lit from inside) and doors on both sides
      lit.add(bx(CAR - 1.4, 0.8, 0.03, cx, 2.35, s * 1.465), '#d9ecff');
      for (const dx of [-4.2, 0, 4.2]) body.add(bx(1.3, 2.3, 0.04, cx + dx, 1.55, s * 1.47), '#7a828c');
    }
    // gangway between cars
    if (c > 0) body.add(bx(0.6, 2.4, 2.2, x0, 1.8, 0), '#2b2d33');
    // bogies
    for (const dx of [-5, 5]) body.add(bx(2.4, 0.5, 2.4, cx + dx, 0.35, 0), '#2b2d33');
  }
  // the front: headlights and a lit route sign
  lit.add(bx(0.04, 0.4, 1.6, len / 2 - 0.24, 3.0, 0), '#ffd27a');
  for (const s of [-0.9, 0.9]) lit.add(bx(0.04, 0.2, 0.3, len / 2 - 0.24, 1.0, s), '#fff6dc');
  const g = new THREE.Group();
  const m1 = new THREE.Mesh(mergeGeometries(body.list), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.55 }));
  const m2 = new THREE.Mesh(mergeGeometries(lit.list), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.3 }));
  m1.castShadow = true;
  g.add(m1, m2);
  // the platform-side doors slide open (separate meshes)
  g.userData.doors = [];
  const doorMat = new THREE.MeshStandardMaterial({ color: '#8a929c', roughness: 0.4, metalness: 0.5 });
  for (let c = 0; c < CARS; c++) {
    const cx = -len / 2 + c * CAR + CAR / 2;
    for (const dx of [-4.2, 0, 4.2]) {
      for (const s of [-1, 1]) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.64, 2.3, 0.06), doorMat);
        d.position.set(cx + dx + s * 0.33, 1.55, 1.5);
        d.userData.base = d.position.x;
        d.userData.side = s;
        g.add(d);
        g.userData.doors.push(d);
      }
    }
  }
  return g;
}

/** A dark tunnel with lights flashing by (scrolled on the train's windows). */
function tunnelTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#0b0d12';
  x.fillRect(0, 0, 512, 128);
  x.fillStyle = '#1a1e26';
  for (let i = 0; i < 512; i += 64) x.fillRect(i, 20, 30, 90);
  x.fillStyle = 'rgba(255,214,140,0.9)';
  for (let i = 10; i < 512; i += 128) x.fillRect(i, 56, 40, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class SubwayLife {
  constructor(game) {
    this.game = game;
    this.train = null;
    this.t = 0;
    this.ride = null;
  }

  /** Called after a platform or train interior is built. */
  attach(interior, place) {
    const game = this.game;
    const cfg = game.city.cfg;
    const kind = railKind(cfg);
    this.clear();
    this.interior = interior;
    if (place.type === 'subwaycar') {
      // the windows show the tunnel (underground) or the city (elevated) streaming past
      const tex = kind === 'subway' ? tunnelTexture() : Tex.skylineDay().clone();
      tex.wrapS = THREE.RepeatWrapping;
      tex.needsUpdate = true;
      interior.windowMat.map = tex;
      interior.windowMat.needsUpdate = true;
      interior.scrollTex = tex;
      interior.windowMat.userData.keep = true;
      return;
    }
    if (!place.station) return;
    const L = interior.layout;
    this.train = trainMesh(cfg.transit?.line || '#2f6fd0', kind === 'elevated');
    this.train.position.set(-200, 0, TRACK_Z);
    interior.root.add(this.train);
    this.state = 'away';
    this.t = HEADWAY * 0.5;
    // station name boards on the back wall above the tracks
    for (const x of [L.w * 0.25, L.w * 0.75]) {
      const tex = labelTexture(place.district.name, { icon: place.icon, bg: '#101418', fg: '#ffffff', accent: cfg.transit?.line || '#2f6fd0' });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      s.position.set(x, 2.55, 0.05);
      interior.root.add(s);
    }
  }

  clear() {
    this.train?.removeFromParent();
    this.train = null;
  }

  doorsOpen() {
    return this.state === 'stopped' && this.t < DWELL - 1.2 && this.t > 0.8;
  }

  /** Interaction on the platform edge. */
  board() {
    const game = this.game;
    if (!this.doorsOpen()) {
      const wait = this.state === 'stopped' ? 1 : Math.max(1, Math.round(this.state === 'away' ? this.t : 4));
      return game.events.emit('toast', { icon: '🚇', title: 'Train coming', text: `Next train in about ${wait} s. Stand back from the edge!`, kind: 'info' });
    }
    const station = game.inside.place;
    openStation(game, station, (dest, q) => this.startRide(station, dest, q));
  }

  /** Step aboard: a train car interior that ends at the destination station. */
  startRide(from, dest, q) {
    const game = this.game;
    game.closeAllOverlays();
    const cfg = game.city.cfg;
    const car = { id: 'train', type: 'subwaycar', name: `${cfg.transit?.name || 'Train'} to ${dest.district.name}`, icon: cfg.transit?.icon || '🚇', label: 'Train', x: dest.x, z: dest.z, nx: dest.nx, nz: dest.nz, district: dest.district, station: false };
    this.ride = { dest, minutes: q.minutes, t: 0, dur: 7 + Math.min(8, q.minutes / 6), announced: false };
    game.leaveInterior(true);
    game.enterPlace(car, true);
    game.audio?.play('door');
  }

  /** Off the train: up the stairs at the destination. */
  arrive() {
    const game = this.game;
    const r = this.ride;
    this.ride = null;
    game.fade(() => {
      game.sim.advance(r.minutes, { rates: { energy: 1 } });
      game.leaveInterior(true);
      game.placePlayerAt(r.dest);
      game.events.emit('travelled', { place: r.dest });
    });
  }

  update(dt) {
    const game = this.game;
    const inside = game.inside;
    // stepped off early through the door: the ride is over
    if (this.ride && inside?.place.type !== 'subwaycar' && !game.fading) this.ride = null;
    if (!inside) return;
    if (inside.place.type === 'subwaycar') {
      const tex = this.interior?.scrollTex;
      if (tex) tex.offset.x = (tex.offset.x + dt * (railKind(game.city.cfg) === 'subway' ? 1.6 : 0.08)) % 1;
      const r = this.ride;
      if (r) {
        r.t += dt;
        if (!r.announced && r.t > r.dur - 3) {
          r.announced = true;
          game.events.emit('toast', { icon: '🔔', title: `Next stop: ${r.dest.district.name}`, text: 'Stand clear of the closing doors, please.', kind: 'info' });
        }
        if (r.t >= r.dur && !game.fading) this.arrive();
      }
      return;
    }
    if (!this.train) return;
    // arrive, stop, open the doors, close them, leave; repeat
    this.t -= dt;
    const L = this.interior.layout;
    const stopX = L.w / 2;
    const tr = this.train;
    if (this.state === 'away' && this.t <= 0) {
      this.state = 'arriving';
      this.t = 4;
      game.audio?.play('hiss');
    }
    if (this.state === 'arriving') {
      const k = 1 - Math.max(0, this.t) / 4;
      tr.position.x = stopX + 90 * (1 - k) ** 2;
      if (this.t <= 0) {
        this.state = 'stopped';
        this.t = DWELL;
        game.audio?.play('door');
      }
    } else if (this.state === 'stopped') {
      tr.position.x = stopX;
      if (this.t <= 0) {
        this.state = 'leaving';
        this.t = 4;
      }
    } else if (this.state === 'leaving') {
      const k = 1 - Math.max(0, this.t) / 4;
      tr.position.x = stopX - 100 * k * k;
      if (this.t <= 0) {
        this.state = 'away';
        this.t = HEADWAY;
        tr.position.x = -300;
      }
    }
    // doors slide apart while stopped
    const open = this.state === 'stopped' ? Math.min(1, Math.min(DWELL - this.t, this.t) / 0.8) : 0;
    for (const d of tr.userData.doors) d.position.x = d.userData.base + d.userData.side * open * 0.6;
  }
}
