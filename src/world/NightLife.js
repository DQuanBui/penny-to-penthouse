// Nightclub lines: from 10 PM to 3 AM a queue of dressed-up clubbers waits
// behind the velvet rope and a bouncer in black guards the door. Slip the
// bouncer a tip and walk straight in.
import * as THREE from 'three';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { randomAppearance } from '../characters/Customization.js';
import { hourOf } from '../core/Clock.js';
import { mulberry32, hashStr } from '../core/utils.js';

const NEAR = 60;
const PARTY = ['#c43bd6', '#1d1f24', '#e84a4a', '#f2f2f0', '#3f76d0', '#e9c04c', '#2f2f3a'];

export class ClubQueues {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.live = new Map();
  }

  setCity(city) {
    this.clear();
    this.city = city;
    this.clubs = city.places.filter((p) => p.type === 'club');
    this.game.scene.add(this.group);
  }

  clear() {
    for (const id of [...this.live.keys()]) this.drop(id);
    this.group.removeFromParent();
  }

  drop(id) {
    const q = this.live.get(id);
    if (!q) return;
    for (const p of q.people) {
      p.rig.group.removeFromParent();
      p.rig.dispose();
    }
    this.live.delete(id);
  }

  /** World position of a point in the club's facade frame (x along the wall, z out to the street). */
  at(c, x, z) {
    const tx = c.nz;
    const tz = -c.nx;
    return [c.doorX + tx * x + c.nx * z, c.doorZ + tz * x + c.nz * z];
  }

  open() {
    const hr = hourOf(this.game.state.time.total);
    return hr >= 22 || hr < 3;
  }

  spawn(c) {
    const rng = mulberry32(hashStr(c.id + 'queue'));
    const people = [];
    const face = Math.atan2(c.nx, c.nz);
    const Y = this.city.K.CURB;
    const along = Math.atan2(c.nz, -c.nx); // facing +x along the wall, toward the door
    const add = (look, x, z, ry, pose) => {
      const rig = createRig(look);
      const [wx, wz] = this.at(c, x, z);
      rig.group.position.set(wx, Y, wz);
      rig.group.rotation.y = ry;
      this.group.add(rig.group);
      people.push({ rig, pose, ph: rng() * 6 });
    };
    // the bouncer: big, in black, by the door
    add({ ...randomAppearance(rng), body: 'heavy', top: 'jacket', topColor: '#141418', bottom: 'slacks', bottomColor: '#141418', shoes: 'boots', shoeColor: '#141418', accessory: 'sunglasses', hat: 'none', carry: 'none', facial: rng() < 0.5 ? 'beard' : 'none' }, -1.0, 1.1, face, 'bouncer');
    // the line behind the rope, in their going-out clothes
    const n = 4 + Math.floor(rng() * 4);
    for (let k = 0; k < n; k++) {
      const look = { ...randomAppearance(rng), top: rng() < 0.4 ? 'dress' : rng() < 0.5 ? 'blazer' : 'shirt', topColor: PARTY[Math.floor(rng() * PARTY.length)], bottom: rng() < 0.5 ? 'slacks' : 'skirt', bottomColor: '#1d1f24', shoes: rng() < 0.5 ? 'dress' : 'boots', accessory: rng() < 0.4 ? 'necklace' : 'none', carry: 'none', hat: 'none' };
      add(look, -3.2 - k * 0.72, 1.05 + (k % 2) * 0.12, along + (rng() - 0.5) * 0.6, k % 3 === 0 ? 'phone' : 'chat');
    }
    this.live.set(c.id, { c, people });
  }

  update(dt, pos, inside) {
    if (!this.clubs?.length) return;
    const on = this.open() && !inside;
    for (const c of this.clubs) {
      const near = (c.doorX - pos.x) ** 2 + (c.doorZ - pos.z) ** 2 < NEAR * NEAR;
      if (!on || !near) {
        this.drop(c.id);
        continue;
      }
      if (!this.live.has(c.id)) this.spawn(c);
      const t = performance.now() / 1000;
      for (const p of this.live.get(c.id).people) {
        if (p.pose === 'bouncer') animateRig(p.rig, dt, { speed: 0, grounded: true, talking: Math.sin(t * 0.4 + p.ph) > 0.8 });
        else animateRig(p.rig, dt, { speed: 0, grounded: true, phone: p.pose === 'phone', talking: p.pose === 'chat' && Math.sin(t * 0.7 + p.ph) > 0, dancing: Math.sin(t * 0.3 + p.ph) > 0.93 });
      }
    }
  }

  interactable(pos) {
    for (const q of this.live.values()) {
      const [bx, bz] = this.at(q.c, -1.0, 1.1);
      if ((bx - pos.x) ** 2 + (bz - pos.z) ** 2 < 2.2 * 2.2) return { label: '🕶️ Slip the bouncer $20 and skip the line', action: () => this.skip(q.c) };
    }
    return null;
  }

  skip(c) {
    const game = this.game;
    if (!game.sim.finance.spend(20, 'fun', 'Tip for the bouncer')) return;
    game.sim.state.needs.social = Math.min(100, game.sim.state.needs.social + 5);
    game.events.emit('toast', { icon: '🕶️', title: '"Enjoy your night."', text: 'The rope unclips. The line watches you walk straight in.', kind: 'good' });
    game.enterPlace(c);
  }
}
