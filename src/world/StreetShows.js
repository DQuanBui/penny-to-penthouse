// Street performers that make plazas and parks feel alive (late morning to
// evening): a breakdance crew with a ring of spectators and a boombox, a gold
// "living statue" on a crate, a magician at a little table, and a balloon
// seller. Tip the performers, or buy a balloon and carry it around.
import * as THREE from 'three';
import { createRig } from '../characters/CharacterFactory.js';
import { animateRig } from '../characters/Animation.js';
import { roleAppearance, randomAppearance } from '../characters/Customization.js';
import { hourOf } from '../core/Clock.js';
import { mulberry32, hashStr } from '../core/utils.js';

const SHOW_DIST = 75;
const KINDS = ['breakdance', 'statue', 'balloons', 'magician'];
const BALLOON = ['#e84a4a', '#f2c230', '#3f76d0', '#3fbf7a', '#e86ab0', '#ff7a45', '#7a3fd0'];

function balloonBunch(n, rng) {
  const g = new THREE.Group();
  const strings = [];
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10).scale(1, 1.2, 1), new THREE.MeshToonMaterial({ color: BALLOON[i % BALLOON.length] }));
    const a = (i / n) * Math.PI * 2;
    const r = n > 1 ? 0.28 + rng() * 0.12 : 0;
    b.position.set(Math.cos(a) * r, 1.0 + rng() * 0.35, Math.sin(a) * r);
    b.userData.base = b.position.clone();
    b.userData.ph = rng() * 6;
    g.add(b);
    strings.push(new THREE.Vector3(0, 0, 0), b.position.clone().setY(b.position.y - 0.24));
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(strings), new THREE.LineBasicMaterial({ color: '#f4f4f2' })));
  g.userData.tick = (t) => {
    for (const b of g.children) if (b.userData.base) b.position.set(b.userData.base.x + Math.sin(t * 1.3 + b.userData.ph) * 0.04, b.userData.base.y + Math.sin(t * 1.7 + b.userData.ph) * 0.05, b.userData.base.z);
  };
  return g;
}

export class StreetShows {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.shows = [];
  }

  setCity(city) {
    this.clear();
    this.city = city;
    const spots = [];
    const ts = city.timesSquare;
    if (ts) spots.push({ x: ts.x - 9, z: ts.z + 12 });
    for (const lm of city.landmarks || []) if (lm.type !== 'times_square' && lm.type !== 'ballpark') spots.push({ x: lm.x - 8, z: lm.z + 21.5 }); // the plaza in front of the building
    for (const b of city.blocks.filter((q) => q.kind === 'park').slice(0, 6)) spots.push({ x: b.cx + 8, z: b.cz + 7 });
    this.shows = spots.map((s, i) => ({ ...s, id: 'show' + i, kind: KINDS[i % KINDS.length], live: null }));
    this.game.scene.add(this.group);
  }

  clear() {
    for (const s of this.shows) this.despawn(s);
    this.shows = [];
    this.group.removeFromParent();
  }

  despawn(s) {
    if (!s.live) return;
    for (const p of s.live.people) {
      p.rig.group.removeFromParent();
      p.rig.dispose();
    }
    s.live.group.removeFromParent();
    s.live = null;
  }

  spawn(s) {
    const rng = mulberry32(hashStr(s.id + this.city.cfg.id));
    const group = new THREE.Group();
    group.position.set(s.x, this.city.groundY(s.x, s.z), s.z);
    this.group.add(group);
    const people = [];
    const person = (look, x, z, ry, pose = {}) => {
      const rig = createRig(look);
      rig.group.position.set(x, 0, z);
      rig.group.rotation.y = ry;
      group.add(rig.group);
      const p = { rig, x, z, ry, pose };
      people.push(p);
      return p;
    };
    const ring = (n, r) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng() * 0.3;
        person(roleAppearance(['tourist', 'student', 'civilian', 'kid', 'shopper', 'cosplayer'][i % 6], rng), Math.cos(a) * r, Math.sin(a) * r, Math.atan2(-Math.cos(a), -Math.sin(a)), { watch: true, ph: rng() * 6 });
      }
    };
    if (s.kind === 'breakdance') {
      const mat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 2.4), new THREE.MeshStandardMaterial({ color: '#a8875a', roughness: 1 }));
      mat.position.y = 0.01;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.25), new THREE.MeshToonMaterial({ color: '#2b2d33' }));
      box.position.set(1.6, 0.18, -1.2);
      group.add(mat, box);
      for (let i = 0; i < 2; i++) person({ ...roleAppearance('athlete', rng), accessory: 'cap' }, i ? 0.5 : -0.5, 0, i ? -1.5 : 1.5, { dancer: true, ph: i * 1.7 });
      ring(7, 2.6);
    } else if (s.kind === 'statue') {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), new THREE.MeshToonMaterial({ color: '#8a6a42' }));
      crate.position.y = 0.3;
      group.add(crate);
      const gold = '#c9a24a';
      const look = { ...randomAppearance(rng), skin: gold, hairColor: gold, topColor: gold, bottomColor: gold, shoeColor: gold, top: 'coat', bottom: 'slacks', hat: 'none', accessory: 'none', eyes: '#8a6a2a' };
      const st = person(look, 0, 0, 0, { statue: true });
      st.rig.group.position.y = 0.6;
      ring(3, 2.4);
    } else if (s.kind === 'balloons') {
      const seller = person({ ...roleAppearance('vendor', rng), accessory: 'cap' }, 0, 0, 0, { talk: true });
      const bunch = balloonBunch(9, rng);
      bunch.position.set(0.35, 1.1, 0.25);
      seller.rig.group.add(bunch);
      s.bunch = bunch;
    } else if (s.kind === 'magician') {
      const table = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 14), new THREE.MeshToonMaterial({ color: '#7a1f2b' }));
      table.position.set(0, 0.4, 0.55);
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.24, 14), new THREE.MeshToonMaterial({ color: '#141418' }));
      hat.position.set(0.1, 0.92, 0.55);
      group.add(table, hat);
      person({ ...randomAppearance(rng), top: 'blazer', topColor: '#141418', bottom: 'slacks', bottomColor: '#141418', hat: 'none' }, 0, 0, 0, { magician: true });
      ring(5, 2.4);
      for (const p of people) if (p.pose.watch) {
        // the audience stands in front, not behind the table
        const a = Math.atan2(p.z, p.x);
        p.x = Math.cos(a) * 2.4;
        p.z = Math.abs(Math.sin(a)) * 2.4 + 0.6;
        p.rig.group.position.set(p.x, 0, p.z);
        p.rig.group.rotation.y = Math.atan2(-p.x, -p.z + 0.5);
      }
    }
    s.live = { group, people, t: 0 };
  }

  update(dt, pos, inside) {
    if (!this.city || inside) {
      this.group.visible = !inside;
      return;
    }
    this.group.visible = true;
    const hr = hourOf(this.game.state.time.total);
    const on = hr >= 11 && hr < 21 && this.game.weather.kind !== 'rain' && this.game.weather.kind !== 'snow';
    const t = performance.now() / 1000;
    for (const s of this.shows) {
      const near = (s.x - pos.x) ** 2 + (s.z - pos.z) ** 2 < SHOW_DIST * SHOW_DIST;
      if (!near || !on) {
        this.despawn(s);
        continue;
      }
      if (!s.live) this.spawn(s);
      s.bunch?.userData.tick(t);
      for (const p of s.live.people) {
        const P = p.pose;
        if (P.dancer) {
          // toprock, then drop for a windmill spin
          const cycle = (t * 0.4 + P.ph) % 2;
          const down = cycle > 1.2;
          p.rig.group.rotation.y = p.ry + (down ? t * 7 : Math.sin(t * 3) * 0.4);
          animateRig(p.rig, dt, { speed: 0, grounded: true, dancing: !down, floor: down, cheering: down && Math.sin(t * 7) > 0 });
        } else if (P.statue) {
          // perfectly still... unless someone just tipped
          animateRig(p.rig, dt, { speed: 0, grounded: true, waving: s.tipT > 0 });
        } else if (P.magician) animateRig(p.rig, dt, { speed: 0, grounded: true, talking: true, waving: Math.sin(t * 0.8) > 0.85 });
        else if (P.watch) animateRig(p.rig, dt, { speed: 0, grounded: true, cheering: Math.sin(t * 0.9 + P.ph) > 0.82, talking: Math.sin(t * 0.5 + P.ph) > 0.6 });
        else animateRig(p.rig, dt, { speed: 0, grounded: true, talking: P.talk && Math.sin(t * 0.6) > 0.3 });
      }
      if (s.tipT > 0) s.tipT -= dt;
    }
  }

  interactable(pos) {
    for (const s of this.shows) {
      if (!s.live || (s.x - pos.x) ** 2 + (s.z - pos.z) ** 2 > 4.2 * 4.2) continue;
      if (s.kind === 'balloons') return { label: '🎈 Buy a balloon · $3', action: () => this.buyBalloon() };
      const what = { breakdance: '🕺 Tip the breakdancers', statue: '🗿 Drop a coin for the living statue', magician: '🎩 Watch the magic show and tip' }[s.kind];
      return { label: what, action: () => this.tip(s) };
    }
    return null;
  }

  tip(s) {
    const game = this.game;
    const sim = game.sim;
    if (!sim.finance.spend(2, 'fun', 'Tipped a street performer')) return;
    s.tipT = 3;
    sim.advance(10, { noCollapse: true });
    sim.state.needs.fun = Math.min(100, sim.state.needs.fun + (s.kind === 'magician' ? 12 : 8));
    sim.state.needs.social = Math.min(100, sim.state.needs.social + 3);
    game.audio?.play('cash');
    const line = { breakdance: 'One of them lands a headspin right in front of you. The crowd roars.', statue: 'The statue comes alive just long enough to wink at you — then freezes again.', magician: 'Your card was inside a lemon. Nobody knows how.' }[s.kind];
    game.events.emit('toast', { icon: { breakdance: '🕺', statue: '🗿', magician: '🎩' }[s.kind], title: 'Thanks for the tip!', text: line, kind: 'good' });
  }

  buyBalloon() {
    const game = this.game;
    if (!game.sim.finance.spend(3, 'fun', 'A balloon')) return;
    game.playerBalloon?.removeFromParent();
    const hand = game.playerRig.bones?.handL;
    const b = balloonBunch(1, Math.random);
    b.position.set(0, -0.05, 0);
    if (hand) hand.add(b);
    game.playerBalloon = b;
    game.sim.state.needs.fun = Math.min(100, game.sim.state.needs.fun + 6);
    game.audio?.play('click');
    game.events.emit('toast', { icon: '🎈', title: 'A balloon!', text: 'It bobs along behind you wherever you go.', kind: 'good' });
  }
}
