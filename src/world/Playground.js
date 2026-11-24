// Kids at the park playground in the daytime: one on each swing, one climbing
// the ladder and whooshing down the slide, two playing tag on the soft ground,
// one in the sandbox; a couple of parents keep an eye on them.
import * as THREE from 'three';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { roleAppearance } from '../characters/Customization.js';
import { hourOf } from '../core/Clock.js';

const NEAR = 90;

export class PlaygroundLife {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.live = null;
  }

  setCity(city) {
    this.clear();
    this.city = city;
    // the playground sits in the south-east of every park (world/Parks.js)
    this.grounds = city.blocks.filter((b) => b.kind === 'park').map((b) => ({ x: b.cx + 16, z: b.cz + 15, b }));
    this.game.scene.add(this.group);
  }

  clear() {
    this.despawn();
    this.group.removeFromParent();
  }

  despawn() {
    if (!this.live) return;
    for (const p of this.live.people) {
      p.rig.group.removeFromParent();
      p.rig.dispose();
    }
    this.live = null;
  }

  spawn(gr) {
    const people = [];
    const add = (role, task, extra = {}) => {
      const rig = createRig(roleAppearance(role, Math.random));
      this.group.add(rig.group);
      const p = { rig, task, t: Math.random() * 6, x: gr.x, z: gr.z, ry: 0, ...extra };
      people.push(p);
      return p;
    };
    add('kid', 'swing', { sx: 2.0 });
    add('kid', 'swing', { sx: 3.2, ph: 1.3 });
    add('kid', 'slide');
    add('kid', 'tag', { ph: 0 });
    add('kid', 'tag', { ph: Math.PI });
    add('kid', 'sand');
    add('parent', 'watch', { ox: -5.8, oz: 1.5, look: { carry: 'none' } });
    add('civilian', 'watch', { ox: 6.2, oz: -3.4 });
    this.live = { gr, people };
  }

  update(dt, pos, inside) {
    if (!this.city || inside) return;
    const hr = hourOf(this.game.state.time.total);
    const day = hr >= 9 && hr < 19 && !this.game.weather.wet && this.game.weather.kind !== 'snow';
    let best = null;
    let bd = NEAR * NEAR;
    for (const g of this.grounds) {
      const d = (g.x - pos.x) ** 2 + (g.z - pos.z) ** 2;
      if (d < bd) {
        bd = d;
        best = g;
      }
    }
    if (!day || !best) return this.despawn();
    if (this.live && this.live.gr !== best) this.despawn();
    if (!this.live) this.spawn(best);
    const { x: px, z: pz } = best;
    const Y = this.city.K.CURB;
    for (const p of this.live.people) {
      p.t += dt;
      let x = px;
      let z = pz;
      let y = Y;
      let ry = 0;
      let pose = { speed: 0, grounded: true };
      if (p.task === 'swing') {
        // back and forth under the swing frame
        const a = Math.sin(p.t * 2.2 + (p.ph || 0)) * 0.7;
        x = px + 2.6 + (p.sx > 2.5 ? 0.6 : -0.6);
        z = pz + 1 + Math.sin(a) * 1.9;
        y = Y + 2.4 - Math.cos(a) * 1.9 - 0.46 + 0.5;
        ry = Math.PI;
        pose = { speed: 0, grounded: true, sitting: true, cheering: Math.abs(a) > 0.6 };
      } else if (p.task === 'slide') {
        // climb the ladder, slide down, run round to the ladder again (a 7 s loop)
        const c = p.t % 7;
        const lx = px - 2.5;
        if (c < 2) {
          x = lx;
          z = pz - 2.45;
          y = Y + (c / 2) * 1.55;
          ry = 0;
          pose = { speed: 1.2, grounded: true };
        } else if (c < 3.2) {
          const k = (c - 2) / 1.2;
          x = lx;
          z = pz - 1.0 + k * 2.6;
          y = Y + 1.55 - k * 1.45;
          ry = 0;
          pose = { speed: 0, grounded: true, sitting: true, cheering: true };
        } else {
          const k = (c - 3.2) / 3.8;
          const a = k * Math.PI * 2;
          x = lx + 1.8 + Math.cos(a + Math.PI) * 1.8;
          z = pz - 0.4 + Math.sin(a) * 2.2;
          ry = Math.atan2(-Math.sin(a + Math.PI), Math.cos(a));
          pose = { speed: 2.6, grounded: true };
        }
      } else if (p.task === 'tag') {
        // two kids chasing round in a loop
        const a = p.t * 1.1 + p.ph;
        x = px + 1 + Math.cos(a) * 3;
        z = pz - 1.5 + Math.sin(a) * 2.2;
        ry = Math.atan2(-Math.sin(a), Math.cos(a) * 0.73);
        pose = { speed: 3, grounded: true };
      } else if (p.task === 'sand') {
        x = px - 2.2;
        z = pz + 3;
        y = Y + 0.25;
        ry = Math.sin(p.t * 0.3) * 1.5;
        pose = { speed: 0, grounded: true, floor: true, talking: true };
      } else if (p.task === 'watch') {
        x = px + p.ox;
        z = pz + p.oz;
        ry = Math.atan2(px - x, pz - z);
        pose = { speed: 0, grounded: true, phone: Math.sin(p.t * 0.2) > 0.6, waving: Math.sin(p.t * 0.7) > 0.95 };
      }
      p.rig.group.position.set(x, y, z);
      p.rig.group.rotation.y = ry;
      animateRig(p.rig, dt, pose);
    }
  }
}
