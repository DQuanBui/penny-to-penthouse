// Hail a cab from the kerb: wave, a yellow taxi pulls up beside you, and you
// choose where to go (door to door, priced by distance like the map's taxis).
import * as THREE from 'three';
import { h, btn } from './dom.js';
import { dialog } from './Menus.js';
import { fmtMoney } from '../core/utils.js';
import { takeTaxi, taxiQuote } from '../world/Transit.js';
import { vehicleGeometry, carMaterial, glassMaterial } from '../world/CarModel.js';
import { kerbSpot, kerbGap } from '../world/TaxiRide.js';

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
    return kerbSpot(c, p);
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
    const spot = kerbGap(game.city, k);
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
