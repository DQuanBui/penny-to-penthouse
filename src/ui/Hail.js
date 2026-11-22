// Hail a cab from the kerb: wave, a yellow taxi pulls up beside you, and you
// choose where to go (door to door, priced by distance like the map's taxis).
import * as THREE from 'three';
import { h, btn } from './dom.js';
import { dialog } from './Menus.js';
import { fmtMoney } from '../core/utils.js';
import { takeTaxi, taxiQuote } from '../world/Transit.js';
import { vehicleGeometry, carMaterial, glassMaterial } from '../world/CarModel.js';

export class TaxiHail {
  constructor(game) {
    this.game = game;
    this.cab = null;
    this.t = 0;
  }

  /** Standing on the sidewalk right by the road? Returns the kerb lane point. */
  kerb(p) {
    const c = this.game.city;
    if (!c || this.game.inside || this.game.vehicles.driving || this.game.player.riding) return null;
    const K = c.K;
    const i = Math.floor((p.x + c.half - K.ROAD) / K.PITCH);
    const j = Math.floor((p.z + c.half - K.ROAD) / K.PITCH);
    if (i < 0 || j < 0 || i >= c.N || j >= c.N) return null;
    const x0 = c.blockMin(i);
    const z0 = c.blockMin(j);
    const lx = p.x - x0;
    const lz = p.z - z0;
    if (lx < 0 || lz < 0 || lx > K.BLOCK || lz > K.BLOCK) return null;
    // within 1.6 m of a block edge that has a road beyond it
    const lane = 5.25;
    if (lz < 1.6 && j > 0) return { x: p.x, z: c.roadCenter(j) + lane, ry: Math.PI / 2, nx: 0, nz: -1 };
    if (lz > K.BLOCK - 1.6 && j < c.N - 1) return { x: p.x, z: c.roadCenter(j + 1) - lane, ry: -Math.PI / 2, nx: 0, nz: 1 };
    if (lx < 1.6 && i > 0) return { x: c.roadCenter(i) + lane, z: p.z, ry: Math.PI, nx: -1, nz: 0 };
    if (lx > K.BLOCK - 1.6 && i < c.N - 1) return { x: c.roadCenter(i + 1) - lane, z: p.z, ry: 0, nx: 1, nz: 0 };
    return null;
  }

  interactable(p) {
    if (this.cab) return this.t > 0 ? { label: '🚕 A cab is on its way…', action: null } : { label: '🚕 Get in the taxi', action: () => this.destinations() };
    const k = this.kerb(p);
    if (!k) return null;
    return { label: '🚕 Hail a taxi', action: () => this.hail(k) };
  }

  hail(k) {
    const game = this.game;
    game.player.emote = { id: 'wave', t: 2.2, held: false };
    game.audio?.play('click');
    // pull in at a free gap along the kerb, or double-park beside the parked cars
    const parked = game.city.parkedCars || [];
    const fx = Math.sin(k.ry);
    const fz = Math.cos(k.ry);
    const free = (x, z) => !parked.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < 5.2 * 5.2);
    let spot = null;
    for (const o of [0, 4, -4, 8, -8, 12, -12]) {
      const x = k.x + fx * o;
      const z = k.z + fz * o;
      if (free(x, z)) {
        spot = { ...k, x, z };
        break;
      }
    }
    // (n points from the sidewalk out into the road)
    if (!spot) spot = { ...k, x: k.x + k.nx * 2.6, z: k.z + k.nz * 2.6 };
    this.spot = spot;
    k = spot;
    this.t = 3.2; // a cab spots you and pulls in
    const { body, glass } = vehicleGeometry('taxi');
    const g = new THREE.Group();
    const m = new THREE.InstancedMesh(body, carMaterial(), 1);
    m.setMatrixAt(0, new THREE.Matrix4());
    m.setColorAt(0, new THREE.Color('#f2c230'));
    m.castShadow = true;
    g.add(m);
    if (glass) {
      const gm = new THREE.InstancedMesh(glass, glassMaterial(), 1);
      gm.setMatrixAt(0, new THREE.Matrix4());
      g.add(gm);
    }
    g.rotation.y = k.ry;
    g.visible = false;
    game.scene.add(g);
    this.cab = g;
  }

  update(dt) {
    if (!this.cab) return;
    const game = this.game;
    const k = this.spot;
    if (this.t > 0) {
      this.t -= dt;
      // roll in along the kerb lane and stop beside you
      const f = Math.max(0, this.t) / 3.2;
      const back = f * f * 30;
      this.cab.visible = true;
      this.cab.position.set(k.x - Math.sin(k.ry) * back, 0, k.z - Math.cos(k.ry) * back);
      if (this.t <= 0) game.audio?.play('hiss');
    }
    // walked away or went indoors: the cab leaves
    const p = game.player.pos;
    if (game.inside || (this.t <= 0 && (this.cab.position.x - p.x) ** 2 + (this.cab.position.z - p.z) ** 2 > 14 * 14)) this.dismiss();
  }

  dismiss() {
    this.cab?.removeFromParent();
    this.cab = null;
  }

  destinations() {
    const game = this.game;
    const st = game.state;
    const home = game.city.places.find((q) => q.type === 'home' && q.id === 'home_' + st.home.districtId);
    const keys = game.city.places.filter((q) => !q.minor && !q.station && q.type !== 'home' && q.type !== 'zoo').sort((a, b) => a.name.localeCompare(b.name));
    const list = [home, game.city.zoo?.place, ...keys].filter(Boolean).slice(0, 18);
    const el = dialog(game, {
      title: '🚕 "Where to?"',
      body: h(
        'div.menu-col',
        h('div.muted', 'The driver taps the meter. Door to door, priced by distance.'),
        list.map((pl) => {
          const q = taxiQuote(game, pl);
          return btn(`${pl.icon}  ${pl.type === 'home' ? 'Home' : pl.name}  ·  ${q.minutes} min  ·  ${fmtMoney(q.fare)}`, async () => {
            game.closeOverlay(el);
            this.dismiss();
            await takeTaxi(game, pl);
          });
        }),
        btn('Never mind', () => {
          game.closeOverlay(el);
          this.dismiss();
        }),
      ),
    });
  }
}
