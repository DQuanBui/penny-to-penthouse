// Food-cart vendors and buskers: people who appear at their spots during
// working hours, things the player can do with them, and the busker's guitar
// you can hear as you walk past.
import * as THREE from 'three';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { randomAppearance } from '../characters/Customization.js';
import { STREET_FOOD } from '../data/items.js';
import { addNeed } from '../sim/Needs.js';
import { mod } from '../sim/Player.js';
import { mulberry32, hashStr, fmtMoney } from '../core/utils.js';
import { hourOf } from '../core/Clock.js';
import { h, btn } from '../ui/dom.js';
import { dialog } from '../ui/Menus.js';

const SHOW = 70;
const PENTA = [0, 3, 5, 7, 10, 12, 15];

function guitar() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#b5651d', roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8).scale(1, 1.25, 0.35), wood);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.03).translate(0, 0.38, 0), new THREE.MeshStandardMaterial({ color: '#3a2a1e' }));
  g.add(body, neck);
  g.rotation.z = 1.1;
  g.position.set(0.02, 1.05, 0.2);
  return g;
}

export class StreetLife {
  constructor(game) {
    this.game = game;
    this.actors = new Map(); // spot id -> { spot, rig, kind }
    this.noteT = 0;
  }

  setCity(city) {
    this.clear();
    this.city = city;
    this.spots = [...(city.vendors || []).map((s) => ({ ...s, kind: 'vendor' })), ...(city.buskers || []).map((s) => ({ ...s, kind: 'busker' }))];
  }

  clear() {
    for (const a of this.actors.values()) {
      a.rig.group.parent?.remove(a.rig.group);
      a.rig.dispose();
    }
    this.actors.clear();
  }

  active(spot) {
    const hr = hourOf(this.game.state.time.total);
    if (this.game.weather.kind === 'rain' || this.game.weather.kind === 'snow') return spot.kind === 'vendor' && hr >= 8 && hr < 20;
    return spot.kind === 'vendor' ? hr >= 8 && hr < 21 : hr >= 10 && hr < 22;
  }

  update(dt, pos, inside) {
    if (!this.spots || !this.game.state) return;
    if (inside) return;
    for (const s of this.spots) {
      const d2 = (s.x - pos.x) ** 2 + (s.z - pos.z) ** 2;
      let a = this.actors.get(s.id);
      const want = d2 < SHOW * SHOW && this.active(s);
      if (!want) {
        if (a) {
          a.rig.group.parent?.remove(a.rig.group);
          a.rig.dispose();
          this.actors.delete(s.id);
        }
        continue;
      }
      if (!a) {
        const rig = createRig(randomAppearance(mulberry32(hashStr(s.id))));
        // vendors stand behind the cart, buskers on their spot
        const back = s.kind === 'vendor' ? -0.95 : 0;
        rig.group.position.set(s.x + Math.sin(s.ry) * back, this.city.groundY(s.x, s.z), s.z + Math.cos(s.ry) * back);
        rig.group.rotation.y = s.ry;
        if (s.kind === 'busker') rig.group.add(guitar());
        this.game.scene.add(rig.group);
        a = { spot: s, rig, kind: s.kind };
        this.actors.set(s.id, a);
      }
      animateRig(a.rig, dt, { speed: 0, grounded: true, talking: a.kind === 'busker' || d2 < 9 });
    }
    // the busker's guitar: plucked pentatonic notes, louder as you get closer
    this.noteT -= dt;
    if (this.noteT <= 0) {
      this.noteT = 0.28 + Math.random() * 0.35;
      let best = 1e9;
      for (const a of this.actors.values()) if (a.kind === 'busker') best = Math.min(best, (a.spot.x - pos.x) ** 2 + (a.spot.z - pos.z) ** 2);
      const d = Math.sqrt(best);
      if (d < 22) this.game.audio?.pluck(196 * Math.pow(2, PENTA[Math.floor(Math.random() * PENTA.length)] / 12), 0.14 * (1 - d / 22));
    }
  }

  /** Interaction for the nearest vendor or busker, or null. */
  interactable(pos) {
    for (const a of this.actors.values()) {
      const s = a.spot;
      if ((s.x - pos.x) ** 2 + (s.z - pos.z) ** 2 > 2.6 * 2.6) continue;
      if (a.kind === 'vendor') return { label: 'Buy street food', action: () => this.openCart() };
      return { label: 'Listen to the busker', action: () => this.openBusker() };
    }
    return null;
  }

  openCart() {
    const game = this.game;
    const sim = game.sim;
    const pm = (sim.city.priceIndex || 1) * mod(game.state, 'priceMul');
    const el = dialog(game, {
      title: '🌭 Street cart',
      body: h(
        'div.menu-col',
        h('div.muted', 'Quick, cheap and handed over with a smile.'),
        STREET_FOOD.map((f) => {
          const price = Math.round(f.price * pm * 100) / 100;
          return btn(`${f.icon}  ${f.name}  ·  ${Object.entries(f.needs).map(([k, v]) => `${k} +${v}`).join(' · ')}  ·  ${fmtMoney(price)}`, () => {
            if (!sim.finance.spend(price, 'food', f.name)) return;
            for (const k in f.needs) addNeed(sim, k, f.needs[k]);
            sim.advance(8, { noCollapse: true });
            game.audio?.play('cash');
            game.closeOverlay(el);
            game.events.emit('toast', { icon: f.icon, title: f.name, text: f.line, kind: 'good' });
            game.events.emit('activityDone', { id: f.id });
          });
        }),
      ),
    });
  }

  openBusker() {
    const game = this.game;
    const sim = game.sim;
    const st = game.state;
    const tip = (amount, fun, social, minutes, line) => {
      if (amount && !sim.finance.spend(amount, 'fun', 'Tip for a busker')) return;
      game.closeOverlay(el);
      game.fade(() => {
        sim.advance(minutes, { noCollapse: true });
        addNeed(sim, 'fun', fun);
        addNeed(sim, 'social', social);
      });
      if (amount) st.stats.buskerTips = (st.stats.buskerTips || 0) + 1;
      game.events.emit('toast', { icon: '🎸', title: 'Street music', text: line, kind: 'good' });
    };
    const el = dialog(game, {
      title: '🎸 Busker',
      body: h(
        'div.menu-col',
        h('div.muted', 'A guitar case lies open at their feet. They nod as you stop to listen.'),
        btn('👂  Listen for a while  ·  20 min  ·  free', () => tip(0, 10, 3, 20, 'A small crowd gathers. For twenty minutes the city sounds better.')),
        btn('💵  Drop a tip in the case  ·  $5', () => tip(5, 12, 5, 5, '"Thank you, friend!" They play your way for the next song.')),
        btn('🎶  Request a song  ·  $20', () => tip(20, 24, 9, 15, 'They play your favourite. People around you start singing along.')),
      ),
    });
  }
}
