// Enterable interiors. Each place is a small separate scene built from a
// layout: { w, d, floor, wall, walls[], items[{id,x,z,r}], doorX }.
// Homes store their layout in the save (build mode edits it); shops, offices
// and so on use the templates below.
import * as THREE from 'three';
import { ColliderWorld } from './Collision.js';
import { Tex } from './Textures.js';
import { buildFurniture } from '../build/FurnitureCatalog.js';
import { FURNITURE_BY_ID } from '../data/furniture.js';
import { HOME_BY_ID } from '../data/homes.js';
import { PLACE_TYPES } from '../data/placeTypes.js';

export const ROOM_H = 3.0;

const USE_LABEL = {
  sleep: 'Sleep', relax: 'Relax', computer: 'Use the computer', read: 'Read a book', eat: 'Open the fridge', cook: 'Cook a meal',
  shower: 'Take a shower', bath: 'Take a bath', wardrobe: 'Change outfit', tv: 'Watch TV', game: 'Play video games', music: 'Listen to music',
  piano: 'Play the piano', workout: 'Work out', paint: 'Paint', service: 'Talk to staff', work: 'Start your shift',
};

/** Footprint of an item after rotation (r = quarter turns). */
export function footprint(def, r) {
  return r % 2 ? [def.d, def.w] : [def.w, def.d];
}

/**
 * Line items up along the walls (clockwise from the back-left corner), each
 * facing into the room. Leaves the doorway on the south wall clear.
 */
export function autoFurnish(w, d, ids, doorX = w / 2) {
  const items = [];
  const gap = 0.25;
  // wall runs: [start, end, place(fn)]
  let side = 0; // 0 north, 1 east, 2 west, 3 south-left, 4 south-right
  let cur = gap;
  const limits = [w - gap, d - 1.2, d - 1.2, doorX - 1.2, w - gap];
  const starts = [gap, 1.3, 1.3, gap, doorX + 1.2];
  let firstNorth = null; // corner pieces on the back wall push the side-wall runs down
  let lastNorth = null;
  for (const entry of ids) {
    const it = typeof entry === 'string' ? { id: entry } : { ...entry };
    const def = FURNITURE_BY_ID[it.id];
    if (!def) continue;
    let placed = false;
    while (side < 5 && !placed) {
      const len = def.w;
      if (cur + len <= limits[side] + 1e-6) {
        const c = cur + len / 2;
        if (side === 0) {
          Object.assign(it, { x: c, z: def.d / 2 + 0.05, r: 0 });
          firstNorth ||= def;
          lastNorth = { def, end: cur + len };
        }
        else if (side === 1) Object.assign(it, { x: w - def.d / 2 - 0.05, z: c, r: 3 });
        else if (side === 2) Object.assign(it, { x: def.d / 2 + 0.05, z: c, r: 1 });
        else Object.assign(it, { x: c, z: d - def.d / 2 - 0.05, r: 2 });
        cur += len + gap;
        placed = true;
      } else {
        side++;
        cur = starts[side] ?? 0;
        // keep clear of furniture already in the back corners
        if (side === 1 && lastNorth && lastNorth.end > w - 1.3) cur = Math.max(cur, lastNorth.def.d + 0.4);
        if (side === 2 && firstNorth) cur = Math.max(cur, firstNorth.d + 0.4);
      }
    }
    if (placed) items.push(it);
  }
  return items;
}

let uidCounter = 1;
const withUids = (items) => items.map((i) => ({ uid: i.uid || 'i' + uidCounter++, ...i }));

/** Starter layout for a home type (rentals come with basic furniture). */
export function defaultHomeLayout(typeId) {
  const t = HOME_BY_ID[typeId];
  const [w, d] = t.size;
  const sets = {
    couch: [{ id: 'loveseat', use: 'sleep', q: 0.7 }, 'table_small', 'mini_fridge', { id: 'shower_basic' }, 'lamp_table'],
    room: ['bed_single', 'lamp_table', 'desk_basic', 'mini_fridge', 'hotplate', 'shower_basic', 'dresser'],
    studio: ['bed_single', 'lamp_table', 'desk_basic', 'bookshelf', 'fridge', 'stove', 'counter', 'shower_basic', 'toilet', 'loveseat', 'tv_small', 'dresser'],
    apartment: ['bed_double', 'lamp_table', 'wardrobe', 'desk_basic', 'bookshelf', 'fridge', 'stove', 'sink_kitchen', 'counter', 'shower_basic', 'toilet', 'sink', 'sofa', 'tv_small', 'plant_floor'],
  };
  const owned = ['bed_single', 'fridge', 'stove', 'sink_kitchen', 'shower_basic', 'toilet', 'sink'];
  const items = autoFurnish(w, d, sets[typeId] || owned);
  if (typeId !== 'couch') items.push({ id: 'rug_small', x: w / 2, z: d / 2, r: 0 });
  if (typeId === 'room' || typeId === 'studio' || typeId === 'apartment') {
    const desk = items.find((i) => i.id === 'desk_basic');
    if (desk) items.push({ id: 'chair_basic', x: desk.x + (desk.r === 1 ? 0.9 : desk.r === 3 ? -0.9 : 0), z: desk.z + (desk.r === 0 ? 0.9 : desk.r === 2 ? -0.9 : 0), r: (desk.r + 2) % 4 });
  }
  return { w, d, floors: t.floors, floor: typeId === 'couch' || typeId === 'room' ? 'carpet' : 'wood', wall: '#e9e2d4', walls: [], items: withUids(items), doorX: w / 2 };
}

/** Template layout for a commercial place. */
export function commercialLayout(place) {
  const kind = PLACE_TYPES[place.type].interior;
  const L = (w, d, floor, wall, items) => ({ w, d, floor, wall, walls: [], items: withUids(items), doorX: w / 2 });
  const cafeTables = (x0, z0, nx, nz, sx = 2.6, sz = 2.4) => {
    const out = [];
    for (let a = 0; a < nx; a++)
      for (let c = 0; c < nz; c++) {
        const x = x0 + a * sx;
        const z = z0 + c * sz;
        out.push({ id: 'table_small', x, z, r: 0 }, { id: 'dining_chair', x: x - 0.8, z, r: 1 }, { id: 'dining_chair', x: x + 0.8, z, r: 3 });
      }
    return out;
  };
  switch (kind) {
    case 'cafe':
      return L(10, 8, 'wood', '#efe4d2', [
        { id: 'shop_counter', x: 3, z: 1.4, r: 0 },
        { id: 'shop_shelf', x: 3, z: 0.3, r: 0 },
        { id: 'plant_floor', x: 0.5, z: 0.5, r: 0 },
        { id: 'plant_tree', x: 9.3, z: 0.7, r: 0 },
        { id: 'sofa', x: 9.4, z: 3.2, r: 3 },
        { id: 'painting_l', x: 7.2, z: 0.3, r: 0 },
        ...cafeTables(2, 4.4, 3, 1),
        ...cafeTables(6.2, 6.4, 1, 1),
      ]);
    case 'restaurant':
      return L(13, 10, 'wood', '#3f2f2a', [
        { id: 'reception', x: 10.4, z: 8.2, r: 2 },
        { id: 'kitchen_line', x: 3, z: 0.6, r: 0 },
        { id: 'counter', x: 6, z: 0.6, r: 0 },
        { id: 'fridge_steel', x: 7.4, z: 0.6, r: 0 },
        { id: 'plant_tree', x: 12.3, z: 0.7, r: 0 },
        { id: 'painting_l', x: 10.4, z: 0.3, r: 0 },
        ...cafeTables(2, 3.6, 4, 2, 2.8, 2.6),
      ]);
    case 'shop': {
      const rack = place.type === 'clothing' ? 'clothes_rack' : 'shop_shelf';
      const rows = [];
      for (let a = 0; a < 3; a++) for (let c = 0; c < 2; c++) rows.push({ id: rack, x: 2 + a * 2.6, z: 2.6 + c * 2.2, r: 0 });
      return L(11, 8, 'tile', '#eef0f2', [
        { id: 'shop_counter', x: 8.9, z: 6.2, r: 3 },
        { id: 'shop_shelf', x: 1.2, z: 0.3, r: 0 },
        { id: 'shop_shelf', x: 3.6, z: 0.3, r: 0 },
        { id: 'shop_shelf', x: 6, z: 0.3, r: 0 },
        { id: rack, x: 8.6, z: 0.3, r: 0 },
        { id: 'plant_floor', x: 10.5, z: 0.5, r: 0 },
        ...rows,
      ]);
    }
    case 'gym':
      return L(13, 10, 'concrete', '#39414f', [
        { id: 'reception', x: 10.5, z: 8.3, r: 2 },
        { id: 'gym_treadmill', x: 1.2, z: 1.5, r: 0 },
        { id: 'gym_treadmill', x: 2.8, z: 1.5, r: 0 },
        { id: 'gym_treadmill', x: 4.4, z: 1.5, r: 0 },
        { id: 'gym_weights', x: 1.2, z: 5, r: 0 },
        { id: 'gym_weights', x: 3, z: 5, r: 0 },
        { id: 'gym_weights', x: 4.8, z: 5, r: 0 },
        { id: 'gym_shower', x: 11.5, z: 0.6, r: 0 },
        { id: 'gym_shower', x: 12.4, z: 2, r: 3 },
        { id: 'mirror', x: 7.5, z: 0.3, r: 0 },
        { id: 'mirror', x: 8.7, z: 0.3, r: 0 },
        { id: 'plant_floor', x: 0.5, z: 9.4, r: 0 },
      ]);
    case 'office': {
      const desks = [];
      for (let a = 0; a < 3; a++)
        for (let c = 0; c < 2; c++) {
          const x = 2 + a * 3;
          const z = 2 + c * 2.8;
          desks.push({ id: 'work_desk', x, z, r: 0 }, { id: 'office_chair', x, z: z + 0.85, r: 2 });
        }
      return L(12, 9, 'carpet', '#e6e9ee', [
        { id: 'reception', x: 9.6, z: 7.3, r: 2 },
        { id: 'plant_floor', x: 0.5, z: 0.5, r: 0 },
        { id: 'plant_tree', x: 11.3, z: 0.7, r: 0 },
        { id: 'sofa', x: 2, z: 8.3, r: 2 },
        { id: 'painting_l', x: 10.3, z: 0.3, r: 0 },
        ...desks,
      ]);
    }
    case 'college': {
      const desks = [];
      for (let a = 0; a < 4; a++) for (let c = 0; c < 2; c++) desks.push({ id: 'table_small', x: 2 + a * 2.2, z: 4 + c * 2, r: 0 }, { id: 'chair_basic', x: 2 + a * 2.2, z: 4.8 + c * 2, r: 2 });
      return L(12, 10, 'wood', '#e9e2d4', [
        { id: 'reception', x: 10, z: 8.3, r: 2 },
        { id: 'lectern', x: 5, z: 1.4, r: 0 },
        { id: 'bookshelf', x: 0.9, z: 0.3, r: 0 },
        { id: 'bookshelf', x: 2.1, z: 0.3, r: 0 },
        { id: 'bookshelf', x: 10.9, z: 0.3, r: 0 },
        { id: 'painting_s', x: 7.5, z: 0.3, r: 0 },
        ...desks,
      ]);
    }
    case 'bar':
      return L(12, 9, 'wood', '#2a2238', [
        { id: 'bar_counter', x: 4, z: 1.9, r: 0 },
        { id: 'bar_stool', x: 2.6, z: 3, r: 2 },
        { id: 'bar_stool', x: 3.6, z: 3, r: 2 },
        { id: 'bar_stool', x: 4.6, z: 3, r: 2 },
        { id: 'bar_stool', x: 5.6, z: 3, r: 2 },
        { id: 'sectional', x: 10, z: 0.6, r: 0 },
        { id: 'sofa', x: 11.4, z: 3, r: 3 },
        { id: 'table_small', x: 9.8, z: 2.6, r: 0 },
        { id: 'speaker', x: 0.5, z: 8.4, r: 2 },
        { id: 'lamp_floor', x: 11.5, z: 8.4, r: 0 },
        { id: 'plant_tree', x: 7.8, z: 0.7, r: 0 },
        ...cafeTables(3, 6.2, 3, 1, 2.6),
      ]);
    case 'showroom':
      return L(15, 11, 'tile', '#f2f4f6', [
        { id: 'reception', x: 12.5, z: 9.3, r: 2 },
        { id: 'show_car', x: 3.5, z: 3.5, r: 0 },
        { id: 'show_car', x: 8, z: 3.5, r: 0, p: 1 },
        { id: 'plant_tree', x: 14.3, z: 0.7, r: 0 },
        { id: 'sofa', x: 13.6, z: 4, r: 3 },
      ]);
    case 'clinic':
      return L(11, 8, 'tile', '#eaf2f4', [
        { id: 'reception', x: 8.6, z: 6.3, r: 2 },
        { id: 'hospital_bed', x: 1.2, z: 1.2, r: 0 },
        { id: 'hospital_bed', x: 3.2, z: 1.2, r: 0 },
        { id: 'hospital_bed', x: 5.2, z: 1.2, r: 0 },
        { id: 'work_desk', x: 9, z: 1.4, r: 0 },
        { id: 'office_chair', x: 9, z: 2.25, r: 2 },
        { id: 'plant_floor', x: 0.5, z: 7.4, r: 0 },
        { id: 'sofa', x: 2.6, z: 7.3, r: 2 },
      ]);
    case 'workshop':
      return L(12, 9, 'concrete', '#5a5f6a', [
        { id: 'reception', x: 9.6, z: 7.3, r: 2 },
        { id: 'workbench', x: 1.6, z: 0.8, r: 0 },
        { id: 'workbench', x: 4.4, z: 0.8, r: 0 },
        { id: 'workbench', x: 7.2, z: 0.8, r: 0 },
        { id: 'workbench', x: 0.8, z: 4.5, r: 1 },
        { id: 'shop_shelf', x: 10.6, z: 0.3, r: 0 },
        { id: 'shop_shelf', x: 11.6, z: 3, r: 3 },
      ]);
    case 'studio':
    default:
      return L(12, 9, 'concrete', '#2b2f3c', [
        { id: 'reception', x: 9.6, z: 7.3, r: 2 },
        { id: 'camera_rig', x: 3, z: 4.6, r: 2 },
        { id: 'camera_rig', x: 5.5, z: 5, r: 2 },
        { id: 'sofa', x: 4, z: 1, r: 0 },
        { id: 'plant_tree', x: 6.6, z: 1, r: 0 },
        { id: 'lamp_arc', x: 1.6, z: 1, r: 0 },
        { id: 'work_desk', x: 10.6, z: 1.4, r: 0 },
        { id: 'office_chair', x: 10.6, z: 2.25, r: 2 },
        { id: 'speaker', x: 0.5, z: 8.4, r: 2 },
      ]);
  }
}

const FLOORS = { wood: () => Tex.wood(), tile: () => Tex.tile(), carpet: () => Tex.carpet(), concrete: () => Tex.concrete() };
export const FLOOR_TYPES = Object.keys(FLOORS);

export class Interior {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0d0f16');
    this.hemi = new THREE.HemisphereLight('#fff4e4', '#6a5f58', 1.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1dc', 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.lamps = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight('#ffcf90', 0, 9, 1.6);
      this.scene.add(l);
      this.lamps.push(l);
    }
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.windowMat = new THREE.MeshBasicMaterial({ color: '#9fd0ff' });
    this.world = null;
    this.points = [];
    this.layout = null;
    this.itemNodes = new Map();
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry && !o.userData.shared) o.geometry.dispose();
    });
    this.root.clear();
    this.itemNodes.clear();
  }

  /**
   * Build the room. opts: { place, home:boolean, hasPc:boolean }
   */
  build(layout, opts = {}) {
    this.dispose();
    this.layout = layout;
    this.opts = opts;
    const { w, d } = layout;
    const H = ROOM_H;
    const root = this.root;
    const colliders = new ColliderWorld(4);
    colliders.bounds = { minX: 0.02, maxX: w - 0.02, minZ: 0.02, maxZ: d - 0.02 };
    this.world = { colliders, groundY: () => 0, ceiling: H };

    // floor + ceiling
    const tex = (FLOORS[layout.floor] || FLOORS.wood)().clone();
    tex.repeat.set(w / 2, d / 2);
    tex.needsUpdate = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    floor.position.set(w / 2, 0, d / 2);
    floor.receiveShadow = true;
    root.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 1 }));
    ceil.position.set(w / 2, H, d / 2);
    root.add(ceil);

    // perimeter walls: inward-facing planes (invisible from outside, dollhouse style)
    const wallMat = new THREE.MeshStandardMaterial({ color: layout.wall || '#e9e2d4', roughness: 0.95 });
    const trim = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
    const wall = (len, x, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, H), wallMat);
      m.position.set(x, H / 2, z);
      m.rotation.y = ry;
      m.receiveShadow = true;
      root.add(m);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.12), trim);
      b.position.set(x + Math.sin(ry) * 0.005, 0.06, z + Math.cos(ry) * 0.005);
      b.rotation.y = ry;
      root.add(b);
    };
    wall(w, w / 2, 0, 0);
    wall(w, w / 2, d, Math.PI);
    wall(d, 0, d / 2, Math.PI / 2);
    wall(d, w, d / 2, -Math.PI / 2);

    // windows on the back wall glow with the sky colour
    const nWin = Math.max(1, Math.floor(w / 4));
    for (let i = 0; i < nWin; i++) {
      const x = (w / nWin) * (i + 0.5);
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.3), trim);
      frame.position.set(x, 1.95, 0.012);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.16), this.windowMat);
      glass.position.set(x, 1.95, 0.02);
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 1.16), trim);
      bar.position.set(x, 1.95, 0.025);
      root.add(frame, glass, bar);
    }

    // door on the south wall
    const dx = layout.doorX ?? w / 2;
    // a plane facing into the room, so it never hides the player from a camera outside the wall
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2).rotateY(Math.PI), new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.6 }));
    door.position.set(dx, 1.1, d - 0.02);
    const mat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.6), new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 1 }));
    mat.position.set(dx, 0.012, d - 0.5);
    root.add(door, mat);
    this.door = { x: dx, z: d - 0.9 };

    // inner walls
    for (const s of layout.walls || []) {
      const horiz = s.z1 === s.z2;
      const len = horiz ? Math.abs(s.x2 - s.x1) : Math.abs(s.z2 - s.z1);
      const m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.12, H, horiz ? 0.12 : len), wallMat);
      m.position.set((s.x1 + s.x2) / 2, H / 2, (s.z1 + s.z2) / 2);
      m.castShadow = m.receiveShadow = true;
      root.add(m);
      colliders.add(Math.min(s.x1, s.x2) - 0.07, Math.min(s.z1, s.z2) - 0.07, Math.max(s.x1, s.x2) + 0.07, Math.max(s.z1, s.z2) + 0.07, H);
    }

    // furniture
    this.points = [];
    let lampI = 0;
    for (const l of this.lamps) l.intensity = 0;
    this.lampBase = [];
    for (const it of layout.items) {
      const def = FURNITURE_BY_ID[it.id];
      if (!def) continue;
      const use = it.use ?? def.use;
      const node = buildFurniture(it.id, { pc: (use === 'computer' && opts.hasPc) || def.p?.pc });
      node.position.set(it.x, 0, it.z);
      node.rotation.y = (it.r || 0) * (Math.PI / 2);
      root.add(node);
      this.itemNodes.set(it.uid, node);
      const [fw, fd] = footprint(def, it.r || 0);
      if (def.h > 0) colliders.add(it.x - fw / 2 + 0.06, it.z - fd / 2 + 0.06, it.x + fw / 2 - 0.06, it.z + fd / 2 - 0.06, def.h);
      if (use) {
        // interaction spot: just in front of the item
        const a = (it.r || 0) * (Math.PI / 2);
        const reach = def.d / 2 + 0.45;
        this.points.push({ x: it.x + Math.sin(a) * reach, z: it.z + Math.cos(a) * reach, ix: it.x, iz: it.z, r: Math.max(1.15, def.w / 2 + 0.5), use, item: it, def, label: USE_LABEL[use] || 'Use' });
      }
      if (def.light && lampI < this.lamps.length) {
        this.lamps[lampI].position.set(it.x, Math.min(2.4, (def.p?.h || 2) + 0.2), it.z);
        this.lampBase[lampI] = def.light * 7;
        lampI++;
      }
    }

    // lighting rig sized to the room
    this.sun.position.set(w * 0.35, 7, d * 0.75);
    this.sun.target.position.set(w * 0.5, 0, d * 0.4);
    const sc = this.sun.shadow.camera;
    const ext = Math.max(w, d) * 0.75;
    sc.left = sc.bottom = -ext;
    sc.right = sc.top = ext;
    sc.near = 0.5;
    sc.far = 20;
    sc.updateProjectionMatrix();
    this.sun.target.updateMatrixWorld();
    return this;
  }

  /** Up to n open floor positions (for NPCs), away from furniture and the door. */
  freeSpots(n, rng = Math.random) {
    const { w, d } = this.layout;
    const out = [];
    for (let x = 1; x <= w - 1; x += 1) {
      for (let z = 1; z <= d - 1.6; z += 1) {
        const px = x + (rng() - 0.5) * 0.4;
        const pz = z + (rng() - 0.5) * 0.4;
        if (this.world.colliders.pointBlocked(px, 0.4, pz, 0.5)) continue;
        if (Math.hypot(px - this.door.x, pz - this.door.z) < 1.8) continue;
        out.push({ x: px, z: pz, k: rng() });
      }
    }
    return out.sort((a, b) => a.k - b.k).slice(0, n);
  }

  /** Nearest usable thing to a position: furniture point or the exit door. */
  nearest(pos) {
    let best = null;
    let bd = 1e9;
    for (const p of this.points) {
      // closest interaction spot wins (each spot sits just in front of its item)
      const reach = Math.hypot(p.x - pos.x, p.z - pos.z);
      if (reach < p.r && reach < bd) {
        bd = reach;
        best = p;
      }
    }
    if (best) return best;
    if (Math.hypot(this.door.x - pos.x, this.door.z + 0.5 - pos.z) < 1.5) return { exit: true, label: 'Leave' };
    return null;
  }

  /** @param night 0..1  @param skyColor THREE.Color of the horizon/top mix */
  update(night, skyColor) {
    this.windowMat.color.copy(skyColor).lerp(_white, (1 - night) * 0.25);
    this.sun.intensity = 1.7 - night * 0.9;
    this.hemi.intensity = 1.9 - night * 0.5;
    for (let i = 0; i < this.lamps.length; i++) this.lamps[i].intensity = (this.lampBase?.[i] || 0) * (0.35 + night * 0.65);
  }
}
const _white = new THREE.Color('#ffffff');
