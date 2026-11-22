// Doormen in uniform outside the grand hotel, banks and finance towers (7 AM
// to 11 PM). Say hello and they'll pass on a tip about the city.
import * as THREE from 'three';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { randomAppearance } from '../characters/Customization.js';
import { hourOf } from '../core/Clock.js';
import { mulberry32, hashStr } from '../core/utils.js';

const TYPES = ['hotel', 'bank', 'office_finance'];
const NEAR = 60;
const TIPS = [
  'Fireworks over the harbor on Friday and Saturday nights, nine o\'clock. Best seat is the bridge.',
  'The skate park lets you rent a board for five bucks. Ride the quarter pipes, if you dare.',
  'Lines at the clubs get long after ten. A twenty to the bouncer works wonders.',
  'Food trucks park by the parks at lunchtime. The lobster roll is worth the price.',
  'A 7-day transit pass pays for itself in about twelve rides.',
  'The zoo opens at nine. Go early and you\'ll see the keepers feeding the pandas.',
  'Wave at the kerb and a cab will pull right up. Or wait at a shelter for the bus.',
  'Times Square is something else at night. Sit on the red steps and just look up.',
];

export class Doormen {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.live = new Map();
  }

  setCity(city) {
    this.clear();
    this.city = city;
    this.spots = city.places.filter((p) => TYPES.includes(p.type) && p.lot).map((p) => ({ p, x: p.doorX + p.nx * 1.3 + p.nz * 1.7, z: p.doorZ + p.nz * 1.3 - p.nx * 1.7, ry: Math.atan2(p.nx, p.nz) }));
    this.game.scene.add(this.group);
  }

  clear() {
    for (const s of this.live.values()) {
      s.rig.group.removeFromParent();
      s.rig.dispose();
    }
    this.live.clear();
    this.group.removeFromParent();
  }

  update(dt, pos, inside) {
    if (!this.spots) return;
    const hr = hourOf(this.game.state.time.total);
    const on = !inside && hr >= 7 && hr < 23;
    for (const s of this.spots) {
      const near = on && (s.x - pos.x) ** 2 + (s.z - pos.z) ** 2 < NEAR * NEAR;
      let d = this.live.get(s.p.id);
      if (!near) {
        if (d) {
          d.rig.group.removeFromParent();
          d.rig.dispose();
          this.live.delete(s.p.id);
        }
        continue;
      }
      if (!d) {
        const rng = mulberry32(hashStr(s.p.id + 'door'));
        const hotel = s.p.type === 'hotel';
        const c = hotel ? '#6b1f2b' : '#1f2a44';
        const rig = createRig({ ...randomAppearance(rng), top: 'uniform', topColor: c, badgeColor: '#e9c04c', patchColor: '#e9c04c', bottom: 'slacks', bottomColor: c, shoes: 'dress', shoeColor: '#141518', hat: 'policecap', hatColor: c, accessory: 'none', carry: 'none', facial: 'none' });
        rig.group.position.set(s.x, this.city.K.CURB, s.z);
        rig.group.rotation.y = s.ry;
        this.group.add(rig.group);
        d = { rig, s, wave: 0 };
        this.live.set(s.p.id, d);
      }
      // a wave when you walk up
      const close = (s.x - pos.x) ** 2 + (s.z - pos.z) ** 2 < 4 * 4;
      d.wave = close ? d.wave + dt : 0;
      animateRig(d.rig, dt, { speed: 0, grounded: true, waving: d.wave > 0 && d.wave < 1.6, talking: d.chat > 0 });
      if (d.chat > 0) d.chat -= dt;
    }
  }

  interactable(pos) {
    for (const d of this.live.values()) {
      if ((d.s.x - pos.x) ** 2 + (d.s.z - pos.z) ** 2 < 2 * 2) return { label: '🎩 Say hello to the doorman', action: () => this.chat(d) };
    }
    return null;
  }

  chat(d) {
    const game = this.game;
    d.chat = 5;
    game.sim.state.needs.social = Math.min(100, game.sim.state.needs.social + 4);
    game.events.emit('toast', { icon: '🎩', title: '"Good day to you!"', text: TIPS[Math.floor(Math.random() * TIPS.length)], kind: 'info', long: true });
  }
}
