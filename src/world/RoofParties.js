// Rooftop parties: from 8 PM to 2 AM the roof gardens nearest you fill with
// people dancing and chatting under strings of party lights.
import * as THREE from 'three';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { roleAppearance } from '../characters/Customization.js';
import { hourOf } from '../core/Clock.js';

const NEAR = 110;
const MAX_ROOFS = 2;

export class RoofParties {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.live = new Map();
  }

  setCity(city) {
    this.clear();
    this.city = city;
    this.roofs = city.roofGardens || [];
    this.game.scene.add(this.group);
  }

  clear() {
    for (const k of [...this.live.keys()]) this.drop(k);
    this.group.removeFromParent();
  }

  drop(k) {
    for (const p of this.live.get(k) || []) {
      p.rig.group.removeFromParent();
      p.rig.dispose();
    }
    this.live.delete(k);
  }

  spawn(r) {
    const people = [];
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const rig = createRig(roleAppearance(['civilian', 'hipster', 'cosplayer', 'student', 'rich', 'artist'][i % 6], Math.random));
      const x = r.x + (Math.random() - 0.5) * r.w;
      const z = r.z + (Math.random() - 0.5) * r.d;
      rig.group.position.set(x, r.y, z);
      rig.group.rotation.y = Math.atan2(r.x - x, r.z - z) + (Math.random() - 0.5);
      this.group.add(rig.group);
      people.push({ rig, mode: i % 3 === 0 ? 'chat' : 'dance', ph: Math.random() * 6 });
    }
    return people;
  }

  update(dt, pos, inside) {
    if (!this.roofs?.length) return;
    const hr = hourOf(this.game.state.time.total);
    const on = !inside && (hr >= 20 || hr < 2) && this.game.weather.kind !== 'rain' && this.game.weather.kind !== 'snow';
    // the nearest few roofs host a party
    const want = on
      ? this.roofs
          .map((r, k) => ({ r, k, d: (r.x - pos.x) ** 2 + (r.z - pos.z) ** 2 }))
          .filter((q) => q.d < NEAR * NEAR)
          .sort((a, b) => a.d - b.d)
          .slice(0, MAX_ROOFS)
      : [];
    const keep = new Set(want.map((q) => q.k));
    for (const k of [...this.live.keys()]) if (!keep.has(k)) this.drop(k);
    for (const q of want) if (!this.live.has(q.k)) this.live.set(q.k, this.spawn(q.r));
    const t = performance.now() / 1000;
    for (const people of this.live.values()) {
      for (const p of people) animateRig(p.rig, dt, { speed: 0, grounded: true, dancing: p.mode === 'dance', talking: p.mode === 'chat', cheering: p.mode === 'dance' && Math.sin(t * 0.6 + p.ph) > 0.92 });
    }
  }
}
