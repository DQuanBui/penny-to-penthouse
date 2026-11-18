// Food-cart vendors and buskers: people who appear at their spots during
// working hours, things the player can do with them, and the busker's guitar
// you can hear as you walk past.
import * as THREE from 'three';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { randomAppearance, roleAppearance } from '../characters/Customization.js';
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

/** Cardboard, a paper cup, a hand-written sign, bags and sometimes a cart. */
function sitterProps(withCart) {
  const g = new THREE.Group();
  const card = new THREE.MeshStandardMaterial({ color: '#a8875a', roughness: 1 });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.015, 1.25).translate(0, 0.008, 0.25), card));
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.11, 10).translate(0.32, 0.07, 0.72), new THREE.MeshStandardMaterial({ color: '#f1ece2', roughness: 0.8 }));
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 192;
  const x = c.getContext('2d');
  x.fillStyle = '#b8955f';
  x.fillRect(0, 0, 256, 192);
  x.fillStyle = '#2a2420';
  x.font = '700 34px "Segoe Print","Comic Sans MS",cursive';
  x.textAlign = 'center';
  x.fillText('ANYTHING', 128, 62);
  x.fillText('HELPS', 128, 104);
  x.font = '28px "Segoe Print","Comic Sans MS",cursive';
  x.fillText('thank you', 128, 150);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.27), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  sign.position.set(-0.3, 0.16, 0.7);
  sign.rotation.x = -0.5;
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8).scale(1.3, 0.8, 0.9).translate(-0.48, 0.17, -0.1), new THREE.MeshStandardMaterial({ color: '#3a4a3a', roughness: 1 }));
  g.add(cup, sign, bag);
  if (withCart) {
    const wire = new THREE.MeshStandardMaterial({ color: '#b9bdc3', metalness: 0.6, roughness: 0.4, wireframe: true });
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.85, 3, 3, 4).translate(0.95, 0.68, 0.1), wire);
    const fill = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.8).translate(0.95, 0.66, 0.1), new THREE.MeshStandardMaterial({ color: '#4a5560', roughness: 1 }));
    g.add(basket, fill);
    for (const [wx, wz] of [[0.72, -0.25], [1.18, -0.25], [0.72, 0.45], [1.18, 0.45]]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6).translate(wx, 0.27, wz), new THREE.MeshStandardMaterial({ color: '#b9bdc3', metalness: 0.6, roughness: 0.4 })));
    for (const [wx, wz] of [[0.72, -0.25], [1.18, -0.25], [0.72, 0.45], [1.18, 0.45]]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10).rotateZ(Math.PI / 2).translate(wx, 0.06, wz), new THREE.MeshStandardMaterial({ color: '#1d1f24' })));
  }
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

const SITTER_STORIES = [
  'I cooked on the line at a diner for twelve years. Then the place closed, then the rent went up. It happens faster than you think.',
  'My shelter bed opens at seven. Mornings are the hard part. Thanks for stopping — most people look right through me.',
  'I used to drive a delivery van. Back went out, bills piled up. I\'m on a list for housing. Fingers crossed.',
  'Been sober eight months now. Got an interview at the warehouse on Thursday. Wish me luck.',
  'This corner\'s alright. The bakery guy gives me yesterday\'s bread. People are kinder than they get credit for.',
];

export class StreetLife {
  constructor(game) {
    this.game = game;
    this.actors = new Map(); // spot id -> { spot, rig, kind }
    this.noteT = 0;
  }

  setCity(city) {
    this.clear();
    this.city = city;
    this.spots = [...(city.vendors || []).map((s) => ({ ...s, kind: 'vendor' })), ...(city.buskers || []).map((s) => ({ ...s, kind: 'busker' })), ...(city.sitters || []).map((s) => ({ ...s, kind: 'sitter' }))];
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
    if (spot.kind === 'sitter') return true;
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
        const r = mulberry32(hashStr(s.id));
        const rig = createRig(s.kind === 'sitter' ? roleAppearance('homeless', r) : randomAppearance(r));
        // vendors stand behind the cart, buskers on their spot
        const back = s.kind === 'vendor' ? -0.95 : 0;
        rig.group.position.set(s.x + Math.sin(s.ry) * back, this.city.groundY(s.x, s.z), s.z + Math.cos(s.ry) * back);
        rig.group.rotation.y = s.ry;
        if (s.kind === 'busker') rig.group.add(guitar());
        if (s.kind === 'sitter') rig.group.add(sitterProps(s.cart));
        this.game.scene.add(rig.group);
        a = { spot: s, rig, kind: s.kind };
        this.actors.set(s.id, a);
      }
      animateRig(a.rig, dt, { speed: 0, grounded: true, floor: a.kind === 'sitter', talking: a.kind === 'busker' || (a.kind !== 'sitter' && d2 < 9) || (a.kind === 'sitter' && a.chatT > 0) });
      if (a.chatT > 0) a.chatT -= dt;
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
      if (a.kind === 'sitter') return { label: 'Stop and say hello', action: () => this.openSitter(a) };
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

  /** Someone sitting on the pavement: give, buy a meal, or simply talk. */
  openSitter(a) {
    const game = this.game;
    const sim = game.sim;
    const st = game.state;
    const today = sim.day;
    a.helped ||= -1;
    const help = (amount, fun, social, minutes, line, cat = 'other') => {
      if (amount && !sim.finance.spend(amount, cat, 'Helping someone on the street')) return;
      game.closeOverlay(el);
      sim.advance(minutes, { noCollapse: true });
      addNeed(sim, 'fun', fun);
      addNeed(sim, 'social', social);
      if (a.helped !== today) st.stats.kindness = (st.stats.kindness || 0) + 1;
      a.helped = today;
      a.chatT = 6;
      game.events.emit('toast', { icon: '💛', title: 'A small kindness', text: line, kind: 'good' });
    };
    const story = SITTER_STORIES[Math.abs(hashStr(a.spot.id)) % SITTER_STORIES.length];
    const pm = sim.city.priceIndex || 1;
    const el = dialog(game, {
      title: '💛 Someone in need',
      body: h(
        'div.menu-col',
        h('div.muted', 'They sit on a flattened box with a paper cup and a hand-written sign. They look up as you stop.'),
        btn('🪙  Drop a couple of dollars in the cup  ·  $2', () => help(2, 2, 2, 2, '"Thank you. Really."')),
        btn('💵  Give $10', () => help(10, 5, 3, 2, 'They look surprised, then smile. "You have a good day now."')),
        btn(`🥪  Buy them a hot meal  ·  ${fmtMoney(Math.round(9 * pm))}`, () => help(Math.round(9 * pm), 8, 6, 15, 'You come back with a sandwich and a hot coffee. "Nobody has stopped all day. Thank you."', 'food')),
        btn('💬  Sit and talk for a few minutes', () => help(0, 3, 9, 15, story)),
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
