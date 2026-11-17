// Build mode (B inside your home): top-down camera, grid placement of
// furniture from the catalog or storage, move / rotate / sell / store,
// undo / redo, and — for homes you own — inner walls, doorways, floors, paint
// and windows on one or two storeys. Renters can furnish but not renovate.
import * as THREE from 'three';
import { h, btn, clear } from '../ui/dom.js';
import { FURNITURE, FURNITURE_BY_ID, FURNITURE_CATS } from '../data/furniture.js';
import { HOME_BY_ID } from '../data/homes.js';
import { hasComputer } from '../data/items.js';
import { buildFurniture } from './FurnitureCatalog.js';
import { CELL, levelOf, sizeOf, snapCenter, rectOf, canPlace, snapToWall, styleScore } from './Grid.js';
import { wallRun, addWalls, removeWallAt, WALL_COST_PER_M } from './Walls.js';
import { FLOOR_TYPES } from '../world/Interiors.js';
import { fmtMoney, clamp } from '../core/utils.js';
import { mod } from '../sim/Player.js';

const USE_TEXT = { sleep: 'Sleep', relax: 'Relax', computer: 'Work & study', eat: 'Food storage', cook: 'Cooking', shower: 'Hygiene', bath: 'Hygiene + fun', tv: 'Fun', game: 'Fun', music: 'Fun', piano: 'Fun + creativity', workout: 'Fitness', paint: 'Creativity', read: 'Reading', wardrobe: 'Outfits' };
const PAINTS = ['#e9e2d4', '#f4f1ea', '#d9e4ea', '#dfe8d8', '#f1dcd0', '#e6d9ee', '#c9b79a', '#8fa3b5', '#39414f', '#2b3a4a', '#7a4a38', '#3f5f4a'];
const FLOOR_PRICE = { carpet: 6, concrete: 4, wood: 14, tile: 11 }; // per m²
const PAINT_PRICE = 140;
const WINDOW_PRICE = 2400;
const SELL_BACK = 0.5;

let uidN = Date.now() % 100000;
const newUid = () => 'b' + uidN++;

/** One-line description of what an item is good for. */
export function furnitureBlurb(def) {
  const parts = [];
  if (def.use && USE_TEXT[def.use]) parts.push(`${USE_TEXT[def.use]}${def.q && def.q !== 1 ? ` ×${def.q}` : ''}`);
  if (def.light) parts.push('Light');
  parts.push(`Style ${def.style}`);
  return parts.join(' · ');
}
export const furniturePrice = (game, def, discount = 1) => Math.round(def.price * mod(game.state, 'priceMul') * discount);

export class BuildMode {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    this.center = new THREE.Vector3();
    this.height = 14;
    this.ray = new THREE.Raycaster();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.mouse = new THREE.Vector2();
    this.point = new THREE.Vector3();
    this.helpers = new THREE.Group();
    this.ghostOk = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.8, emissive: '#1f9d55', emissiveIntensity: 0.5 });
    this.ghostBad = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.7, emissive: '#d03030', emissiveIntensity: 0.8 });
    this.pad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#4fd18b', transparent: true, opacity: 0.35, depthWrite: false }));
    this.wallPreview = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.6 }));
    this.tab = 'furnish';
    this.cat = 'bed';
    this.level = 0;
    this._onMove = (e) => this.onMove(e);
    this._onDown = (e) => this.onDown(e);
    this._onKey = (e) => this.onKey(e);
    this._onWheel = (e) => this.onWheel(e);
  }

  get layout() {
    return this.game.state.home.layout;
  }
  get lv() {
    return levelOf(this.layout, this.level);
  }
  get owned() {
    return this.game.state.home.owned;
  }
  get stash() {
    return (this.game.state.inventory.furniture ||= {});
  }

  // ------------------------------------------------------------ enter / exit
  enter() {
    const game = this.game;
    if (this.active || !game.inside?.home) return;
    this.active = true;
    this.level = game.inside.level || 0;
    this.mode = 'idle';
    this.held = null;
    this.undo = [];
    this.redo = [];
    this.ghost = null;
    const { w, d } = this.layout;
    this.center.set(w / 2, 0, d / 2);
    this.height = Math.max(w, d) * 1.35 + 4;
    game.playerRig.group.visible = false;
    this.buildHelpers();
    game.interior.scene.add(this.helpers);
    this.buildUi();
    const cv = game.canvas;
    cv.addEventListener('pointermove', this._onMove);
    cv.addEventListener('pointerdown', this._onDown);
    cv.addEventListener('wheel', this._onWheel, { passive: true });
    window.addEventListener('keydown', this._onKey);
    this.resize();
    game.hud.show(false);
    game.audio?.play('swoosh');
  }

  exit() {
    if (!this.active) return;
    const game = this.game;
    const st = game.state;
    this.cancel();
    this.active = false;
    const cv = game.canvas;
    cv.removeEventListener('pointermove', this._onMove);
    cv.removeEventListener('pointerdown', this._onDown);
    cv.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('keydown', this._onKey);
    game.interior.scene.remove(this.helpers);
    const el = this.el;
    this.el = null;
    game.closeOverlay(el);
    const before = st.home.styleScore || 0;
    st.home.styleScore = styleScore(this.layout);
    const prop = st.properties.find((p) => p.id === st.home.propertyId);
    if (prop) (prop.styleScore = st.home.styleScore), (prop.layout = this.layout);
    game.inside.level = this.level;
    game.refreshInterior();
    game.playerRig.group.visible = true;
    const p = game.player.pos;
    if (game.interior.world.colliders.pointBlocked(p.x, 0.5, p.z, 0.3) || p.x < 0.3 || p.z < 0.3 || p.x > this.layout.w - 0.3 || p.z > this.layout.d - 0.3) game.player.teleport(this.layout.doorX ?? this.layout.w / 2, this.layout.d - 1.1, Math.PI);
    game.hud.show(true);
    if (st.home.styleScore !== before) game.events.emit('toast', { icon: '✨', title: `Home style ${st.home.styleScore}`, text: st.home.styleScore > before ? 'Looking good. A stylish home lifts your mood, your popularity and your parties.' : 'Style score changed.', kind: 'good' });
    game.events.emit('built', { style: st.home.styleScore });
    game.saveNow(true);
  }

  resize() {
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    this.camera.aspect = w / hgt;
    // keep the room clear of the catalogue panel on the left
    this.camera.setViewOffset(w, hgt, w > 900 ? -w * 0.13 : 0, 0, w, hgt);
    this.camera.updateProjectionMatrix();
  }

  buildHelpers() {
    this.helpers.clear();
    const { w, d } = this.layout;
    // grid lines every half metre across the room
    const pts = [];
    for (let x = 0; x <= w + 1e-6; x += CELL) pts.push(x, 0.012, 0, x, 0.012, d);
    for (let z = 0; z <= d + 1e-6; z += CELL) pts.push(0, 0.012, z, w, 0.012, z);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.13 }));
    const edge = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0.02, 0, w, 0.02, 0, w, 0.02, 0, w, 0.02, d, w, 0.02, d, 0, 0.02, d, 0, 0.02, d, 0, 0.02, 0], 3)),
      new THREE.LineBasicMaterial({ color: '#ffb347' }),
    );
    this.pad.visible = false;
    this.wallPreview.visible = false;
    this.helpers.add(lines, edge, this.pad, this.wallPreview);
  }

  // --------------------------------------------------------------- snapshots
  snapshot() {
    const st = this.game.state;
    return { layout: JSON.stringify(st.home.layout), stash: JSON.stringify(this.stash), cash: st.money.checking };
  }
  push() {
    this.undo.push(this.snapshot());
    if (this.undo.length > 40) this.undo.shift();
    this.redo = [];
  }
  restore(snap) {
    const st = this.game.state;
    st.home.layout = JSON.parse(snap.layout);
    st.inventory.furniture = JSON.parse(snap.stash);
    const diff = Math.round((snap.cash - st.money.checking) * 100) / 100;
    if (diff) {
      st.money.checking += diff;
      this.game.sim.finance.record(diff, 'shopping', diff > 0 ? 'Build mode: undone' : 'Build mode: redone');
    }
    this.cancel();
    this.rebuild();
  }
  doUndo() {
    if (!this.undo.length) return;
    this.redo.push(this.snapshot());
    this.restore(this.undo.pop());
  }
  doRedo() {
    if (!this.redo.length) return;
    this.undo.push(this.snapshot());
    this.restore(this.redo.pop());
  }

  rebuild() {
    const game = this.game;
    game.interior.build(this.layout, { place: game.inside.place, home: true, hasPc: hasComputer(game.state), level: this.level });
    game.inside.layout = this.layout;
    this.renderUi();
  }

  // --------------------------------------------------------------------- UI
  buildUi() {
    const game = this.game;
    this.top = h('div.build-top');
    this.side = h('div.build-side');
    this.bar = h('div.build-bar');
    this.el = h('div.overlay.build-ui', this.top, this.side, this.bar);
    game.openOverlay(this.el, { closable: true, onClose: () => this.active && this.exit() });
    this.renderUi();
  }

  renderUi() {
    if (!this.el) return;
    const game = this.game;
    const st = game.state;
    const t = HOME_BY_ID[st.home.type];
    clear(this.top).append(
      h('div.build-title', `🔨 ${t.name}`, h('span.muted.small', this.owned ? ' · you own it: renovate freely' : ' · rented: furniture only')),
      (t.floors || 1) > 1 ? h('div.seg', [0, 1].map((l) => h('button.seg-btn' + (this.level === l ? '.active' : ''), { onclick: () => ((this.level = l), this.cancel(), this.rebuild()) }, l ? 'Upstairs' : 'Ground floor'))) : h('span'),
      h('div.grow'),
      h('span.pill', `💵 ${fmtMoney(st.money.checking)}`),
      h('span.pill.trait', `✨ Style ${styleScore(this.layout)}`),
      btn('↶', () => this.doUndo(), 'small' + (this.undo.length ? '' : ' disabled')),
      btn('↷', () => this.doRedo(), 'small' + (this.redo.length ? '' : ' disabled')),
      btn('✔ Done', () => this.exit(), 'small primary'),
    );

    const tabs = [
      ['furnish', '🛋️ Furnish'],
      ['storage', `📦 Storage${Object.values(this.stash).reduce((a, b) => a + b, 0) ? ' •' : ''}`],
      ['renovate', '🧱 Renovate'],
    ];
    const side = clear(this.side);
    side.append(h('div.seg', tabs.map(([id, label]) => h('button.seg-btn' + (this.tab === id ? '.active' : ''), { onclick: () => ((this.tab = id), this.cancel(), this.renderUi()) }, label))));
    const body = h('div.build-list');
    side.append(body);
    const card = (def, right, onclick, active) => h('button.build-item' + (active ? '.active' : ''), { onclick }, h('div.grow', h('div.build-name', def.name), h('div.muted.small', furnitureBlurb(def))), h('div.build-price', right));

    if (this.tab === 'furnish') {
      side.insertBefore(h('div.chips.build-cats', FURNITURE_CATS.map(([id, label, icon]) => h('button.chip' + (this.cat === id ? '.active' : ''), { onclick: () => ((this.cat = id), this.renderUi()) }, `${icon} ${label}`))), body);
      for (const def of FURNITURE.filter((f) => f.cat === this.cat && !f.shop)) {
        const price = furniturePrice(game, def);
        body.append(card(def, fmtMoney(price), () => this.startPlace(def.id, false), this.held?.id === def.id && !this.held.fromStash));
      }
    } else if (this.tab === 'storage') {
      const ids = Object.keys(this.stash).filter((id) => this.stash[id] > 0);
      if (!ids.length) body.append(h('div.empty', 'Storage is empty. Furniture you buy at the store, or pack up when you move, waits here.'));
      for (const id of ids) body.append(card(FURNITURE_BY_ID[id], `×${this.stash[id]}`, () => this.startPlace(id, true), this.held?.id === id && this.held.fromStash));
    } else {
      if (!this.owned) body.append(h('div.tip', '🔒 You rent this place. Buy a home (Homes app) to move walls, change floors and paint.'));
      const dis = this.owned ? '' : ' disabled';
      const area = this.layout.w * this.layout.d;
      body.append(
        h('div.opt-title', 'Walls'),
        h('div.row', btn(`🧱 Draw wall · ${fmtMoney(WALL_COST_PER_M)}/m`, () => this.setMode('wall'), 'small grow' + (this.mode === 'wall' ? ' primary' : '') + dis), btn('🚪 Doorway / remove', () => this.setMode('erase'), 'small grow' + (this.mode === 'erase' ? ' primary' : '') + dis)),
        h('div.muted.small', 'Click two grid points to draw a wall between them. A doorway is a 1 m gap: click a wall piece to remove it.'),
        h('div.opt-title', 'Floor'),
        h('div.chips', FLOOR_TYPES.map((f) => h('button.chip' + (this.layout.floor === f ? '.active' : '') + dis.replace(' ', '.'), { onclick: () => this.setFloor(f) }, `${f[0].toUpperCase() + f.slice(1)} · ${fmtMoney(Math.round(FLOOR_PRICE[f] * area))}`))),
        h('div.opt-title', `Wall paint · ${fmtMoney(PAINT_PRICE)}`),
        h('div.swatches', PAINTS.map((c) => h('button.swatch' + (this.layout.wall === c ? '.active' : '') + dis.replace(' ', '.'), { style: { background: c }, onclick: () => this.setPaint(c) }))),
        h('div.opt-title', 'Windows'),
        h('div.row', btn(this.layout.windows === 'panorama' ? '✓ Panorama windows installed' : `🪟 Panorama windows · ${fmtMoney(WINDOW_PRICE)}`, () => this.setWindows(), 'small grow' + (this.layout.windows === 'panorama' ? ' disabled' : dis))),
      );
    }
    this.renderBar();
  }

  renderBar() {
    if (!this.el) return;
    const bar = clear(this.bar);
    const hd = this.held;
    if (this.mode === 'place' || this.mode === 'move') {
      const def = FURNITURE_BY_ID[hd.id];
      const mine = hd.existing && (hd.existing.own || this.owned);
      bar.append(
        h('b', def.name),
        h('span.muted', this.reason || (def.wall ? 'Move it against a wall and click' : 'Click to place')),
        h('div.grow'),
        btn('⟳ Rotate (R)', () => this.rotate(), 'small'),
        hd.existing ? btn('📦 Store', () => this.storeHeld(), 'small') : null,
        hd.existing && mine ? btn(`💵 Sell ${fmtMoney(Math.round(def.price * SELL_BACK))}`, () => this.sellHeld(), 'small') : null,
        btn('✕ Cancel', () => (this.cancel(), this.renderUi()), 'small'),
      );
    } else if (this.mode === 'wall') bar.append(h('span.muted', this.anchor ? 'Click the end point (same row or column). Right-click to stop.' : 'Click a grid point to start a wall.'));
    else if (this.mode === 'erase') bar.append(h('span.muted', 'Click a wall piece to remove it and make a doorway.'));
    else bar.append(h('span.muted', 'Click furniture in the room to move it · choose from the catalogue to buy · W A S D pan · wheel zoom'));
  }

  // ------------------------------------------------------------------ tools
  setMode(m) {
    this.cancel();
    this.mode = this.mode === m ? 'idle' : m;
    this.anchor = null;
    this.renderUi();
  }

  cancel() {
    if (this.held?.existing) this.game.interior.itemNodes.get(this.held.existing.uid) && (this.game.interior.itemNodes.get(this.held.existing.uid).visible = true);
    if (this.ghost) this.helpers.remove(this.ghost);
    this.ghost = null;
    this.held = null;
    this.anchor = null;
    this.reason = '';
    this.pad.visible = false;
    this.wallPreview.visible = false;
    if (this.mode === 'place' || this.mode === 'move') this.mode = 'idle';
  }

  makeGhost(id) {
    if (this.ghost) this.helpers.remove(this.ghost);
    this.ghost = buildFurniture(id, { pc: false });
    this.ghost.traverse((o) => {
      if (o.isMesh && o.material.vertexColors) o.material = this.ghostOk;
    });
    this.helpers.add(this.ghost);
  }

  startPlace(id, fromStash) {
    this.cancel();
    this.mode = 'place';
    this.held = { id, r: 0, x: this.layout.w / 2, z: this.layout.d / 2, fromStash };
    this.makeGhost(id);
    this.updateGhost();
    this.renderUi();
  }

  startMove(it) {
    this.cancel();
    this.mode = 'move';
    this.held = { id: it.id, r: it.r || 0, x: it.x, z: it.z, existing: it };
    const node = this.game.interior.itemNodes.get(it.uid);
    if (node) node.visible = false;
    this.makeGhost(it.id);
    this.updateGhost();
    this.renderUi();
  }

  rotate() {
    if (!this.held) return;
    this.held.r = (this.held.r + 1) % 4;
    this.updateGhost();
  }

  /** Snap the held item under the cursor and colour the ghost by validity. */
  updateGhost() {
    const hd = this.held;
    if (!hd || !this.ghost) return;
    const def = FURNITURE_BY_ID[hd.id];
    if (def.wall) {
      const s = snapToWall(this.layout, def, this.point.x, this.point.z);
      if (s) Object.assign(hd, s);
      hd.offWall = !s;
    } else {
      const [w, d] = sizeOf(def, hd.r);
      hd.x = clamp(snapCenter(this.point.x, w), w / 2, this.layout.w - w / 2);
      hd.z = clamp(snapCenter(this.point.z, d), d / 2, this.layout.d - d / 2);
    }
    let res = canPlace(this.layout, this.level, def, hd, hd.existing?.uid);
    if (hd.offWall) res = { ok: false, reason: 'Hang it on a wall' };
    if (res.ok && !hd.existing && !hd.fromStash && this.game.state.money.checking + this.game.sim.finance.cardRoom() < furniturePrice(this.game, def)) res = { ok: false, reason: 'Not enough money' };
    hd.ok = res.ok;
    const reason = res.ok ? '' : res.reason;
    this.ghost.position.set(hd.x, 0.02, hd.z);
    this.ghost.rotation.y = hd.r * (Math.PI / 2);
    this.ghost.traverse((o) => {
      if (o.isMesh && (o.material === this.ghostOk || o.material === this.ghostBad)) o.material = res.ok ? this.ghostOk : this.ghostBad;
    });
    const [w, d] = sizeOf(def, hd.r);
    this.pad.visible = true;
    this.pad.scale.set(w, 1, d);
    this.pad.position.set(hd.x, 0.03, hd.z);
    this.pad.material.color.set(res.ok ? '#4fd18b' : '#ff5b5b');
    if (reason !== this.reason) {
      this.reason = reason;
      this.renderBar();
    }
  }

  commit() {
    const hd = this.held;
    if (!hd || !hd.ok) return this.game.audio?.play('error');
    const game = this.game;
    const def = FURNITURE_BY_ID[hd.id];
    this.push();
    if (hd.existing) {
      Object.assign(hd.existing, { x: hd.x, z: hd.z, r: hd.r });
      this.held = null;
      this.cancel();
    } else {
      if (hd.fromStash) {
        this.stash[hd.id]--;
        if (this.stash[hd.id] <= 0) delete this.stash[hd.id];
      } else if (!game.sim.finance.spend(furniturePrice(game, def), 'shopping', `Furniture — ${def.name}`)) {
        this.undo.pop();
        return;
      }
      this.lv.items.push({ uid: newUid(), id: hd.id, x: hd.x, z: hd.z, r: hd.r, own: true });
      game.audio?.play(hd.fromStash ? 'click' : 'cash');
      // keep placing the same catalogue item; storage items stop when they run out
      if (hd.fromStash && !this.stash[hd.id]) {
        this.held = null;
        this.cancel();
      }
    }
    this.rebuild();
    if (this.held) {
      this.makeGhost(this.held.id);
      this.updateGhost();
    }
  }

  removeHeld() {
    const it = this.held?.existing;
    if (!it) return null;
    this.push();
    const lv = this.lv;
    lv.items = lv.items.filter((x) => x.uid !== it.uid);
    if (!this.level) this.layout.items = lv.items;
    this.held = null;
    this.cancel();
    return it;
  }
  storeHeld() {
    const it = this.removeHeld();
    if (!it) return;
    this.stash[it.id] = (this.stash[it.id] || 0) + 1;
    this.rebuild();
  }
  sellHeld() {
    const def = FURNITURE_BY_ID[this.held?.id];
    const it = this.removeHeld();
    if (!it) return;
    this.game.sim.finance.earn(Math.round(def.price * SELL_BACK), 'other_in', `Sold ${def.name}`);
    this.game.audio?.play('cash');
    this.rebuild();
  }

  pay(cost, label) {
    return this.game.sim.finance.spend(cost, 'housing', label);
  }
  setFloor(f) {
    if (!this.owned || this.layout.floor === f) return;
    this.push();
    if (!this.pay(Math.round(FLOOR_PRICE[f] * this.layout.w * this.layout.d), `New ${f} floor`)) return this.undo.pop();
    this.layout.floor = f;
    this.rebuild();
  }
  setPaint(c) {
    if (!this.owned || this.layout.wall === c) return;
    this.push();
    if (!this.pay(PAINT_PRICE, 'Wall paint')) return this.undo.pop();
    this.layout.wall = c;
    this.layout.painted = true;
    this.rebuild();
  }
  setWindows() {
    if (!this.owned || this.layout.windows === 'panorama') return;
    this.push();
    if (!this.pay(WINDOW_PRICE, 'Panorama windows')) return this.undo.pop();
    this.layout.windows = 'panorama';
    this.rebuild();
  }

  // ------------------------------------------------------------------ input
  toGround(e) {
    const r = this.game.canvas.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.mouse, this.camera);
    this.ray.ray.intersectPlane(this.ground, this.point);
  }

  onMove(e) {
    this.toGround(e);
    if (this.held) this.updateGhost();
    else if (this.mode === 'wall' && this.anchor) {
      const [bx, bz] = this.wallEnd();
      const len = Math.abs(bx - this.anchor[0]) + Math.abs(bz - this.anchor[1]);
      this.wallPreview.visible = len > 0;
      this.wallPreview.scale.set(Math.abs(bx - this.anchor[0]) || 0.14, 1.2, Math.abs(bz - this.anchor[1]) || 0.14);
      this.wallPreview.position.set((bx + this.anchor[0]) / 2, 0.6, (bz + this.anchor[1]) / 2);
    }
  }

  /** End point of the wall being drawn: locked to the anchor's row or column. */
  wallEnd() {
    const [ax, az] = this.anchor;
    const x = clamp(Math.round(this.point.x), 0, this.layout.w);
    const z = clamp(Math.round(this.point.z), 0, this.layout.d);
    return Math.abs(x - ax) >= Math.abs(z - az) ? [x, az] : [ax, z];
  }

  itemAt(x, z) {
    let hit = null;
    for (const it of this.lv.items) {
      const def = FURNITURE_BY_ID[it.id];
      if (!def) continue;
      const r = rectOf(def, it);
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && (!hit || def.h > 0)) hit = it;
    }
    return hit;
  }

  onDown(e) {
    if (e.button === 2) {
      this.cancel();
      if (this.mode === 'wall') this.anchor = null;
      this.renderUi();
      return;
    }
    if (e.button !== 0) return;
    this.toGround(e);
    if (this.mode === 'place' || this.mode === 'move') return this.commit();
    if (this.mode === 'wall') {
      if (!this.anchor) {
        this.anchor = [clamp(Math.round(this.point.x), 0, this.layout.w), clamp(Math.round(this.point.z), 0, this.layout.d)];
        return this.renderBar();
      }
      const [bx, bz] = this.wallEnd();
      const run = wallRun(this.anchor[0], this.anchor[1], bx, bz);
      if (run.length) {
        this.push();
        const before = this.lv.walls.length;
        const added = addWalls(this.layout, this.lv, this.level, run);
        if (!added || !this.pay(added * WALL_COST_PER_M, `Interior wall (${added} m)`)) {
          this.lv.walls.length = before;
          this.undo.pop();
          this.game.audio?.play('error');
        }
      }
      this.anchor = [bx, bz];
      this.wallPreview.visible = false;
      return this.rebuild();
    }
    if (this.mode === 'erase') {
      const snap = this.snapshot();
      if (removeWallAt(this.lv, this.point.x, this.point.z)) {
        this.undo.push(snap);
        this.redo = [];
        this.rebuild();
      }
      return;
    }
    const it = this.itemAt(this.point.x, this.point.z);
    if (it) this.startMove(it);
  }

  onWheel(e) {
    this.height = clamp(this.height * (1 + Math.sign(e.deltaY) * 0.1), 5, 46);
  }

  onKey(e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'KeyR') this.rotate();
    else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) e.shiftKey ? this.doRedo() : this.doUndo();
    else if (e.code === 'KeyY' && (e.ctrlKey || e.metaKey)) this.doRedo();
    else if ((e.code === 'Delete' || e.code === 'KeyX') && this.held?.existing) this.storeHeld();
  }

  /** Called every frame by the Game while build mode is active. */
  update(dt, input) {
    const sp = this.height * 0.9 * dt;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) this.center.z -= sp;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) this.center.z += sp;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) this.center.x -= sp;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) this.center.x += sp;
    this.center.x = clamp(this.center.x, 0, this.layout.w);
    this.center.z = clamp(this.center.z, 0, this.layout.d);
    this.camera.position.set(this.center.x, this.height, this.center.z + 0.01);
    this.camera.lookAt(this.center);
  }
}
