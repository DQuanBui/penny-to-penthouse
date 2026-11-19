// Ducks and swans on the water off the waterfront promenade: mallard pairs,
// mothers leading a line of ducklings, and the odd pair of swans, paddling
// about and bobbing on the swell. Stand at the railing nearby to feed them and
// they come paddling over. Instanced (body / head / beak), only near clusters
// are simulated.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WATER_Y, onBeach } from './Beach.js';

const MAX = 90;
const NEAR = 160;

function bodyGeo() {
  const body = new THREE.SphereGeometry(0.2, 12, 8).scale(0.95, 0.62, 1.45);
  const tail = new THREE.ConeGeometry(0.1, 0.22, 8).rotateX(-Math.PI / 2 - 0.5).translate(0, 0.08, -0.32);
  return mergeGeometries([body.toNonIndexed(), tail.toNonIndexed()]);
}
const headGeo = () => mergeGeometries([new THREE.SphereGeometry(0.095, 10, 8).translate(0, 0.27, 0.24).toNonIndexed(), new THREE.CylinderGeometry(0.05, 0.065, 0.2, 8).rotateX(0.35).translate(0, 0.16, 0.2).toNonIndexed()]);
const beakGeo = () => new THREE.SphereGeometry(0.05, 8, 6).scale(0.85, 0.4, 1.5).translate(0, 0.255, 0.34);

const KINDS = {
  drake: { body: '#8a8478', head: '#1f6b3a', scale: 1.25 },
  hen: { body: '#8a6a48', head: '#7a5a3c', scale: 1.2 },
  duckling: { body: '#d9c46a', head: '#c9b25a', scale: 0.55 },
  swan: { body: '#f4f4f0', head: '#f4f4f0', scale: 2.4, beak: true },
};

export class DuckLife {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.ducks = [];
    this.clusters = [];
    this.feedT = 0;
    const mk = (geo, color) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.75 }), MAX);
      m.castShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      this.group.add(m);
      return m;
    };
    this.bodies = mk(bodyGeo(), '#ffffff');
    this.heads = mk(headGeo(), '#ffffff');
    this.beaks = mk(beakGeo(), '#ffffff');
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._e = new THREE.Euler();
    this._c = new THREE.Color();
  }

  setCity(city) {
    this.city = city;
    this.ducks = [];
    this.clusters = [];
    this.group.removeFromParent();
    if (!city.water.any) return;
    const { half, K, water } = city;
    const edge = half + K.PROM; // the promenade's water edge
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [side, ox, oz] of [['north', 0, -1], ['south', 0, 1], ['west', -1, 0], ['east', 1, 0]]) {
      if (!water[side]) continue;
      for (let t = -half + 60; t < half - 40; t += 105 + rnd() * 40) {
        const out = 9 + rnd() * 10;
        const x = ox ? ox * (edge + out) : t;
        const z = oz ? oz * (edge + out) : t;
        if (onBeach(city.beach, x, z, 20)) continue;
        if (city.bridge && Math.abs(t - city.bridge.along) < 30 && city.bridge.side === side) continue;
        const c = { x, z, ox, oz, ducks: [] };
        const r = rnd();
        if (r < 0.2) {
          // a pair of swans
          for (let i = 0; i < 2; i++) c.ducks.push(this.add('swan', c, rnd));
        } else if (r < 0.6) {
          // a mother and her ducklings in a line
          const mom = this.add('hen', c, rnd);
          c.ducks.push(mom);
          let lead = mom;
          const n = 3 + Math.floor(rnd() * 4);
          for (let i = 0; i < n; i++) {
            const d = this.add('duckling', c, rnd);
            d.follow = lead;
            lead = d;
            c.ducks.push(d);
          }
        } else {
          for (let i = 0; i < 2 + Math.floor(rnd() * 3); i++) c.ducks.push(this.add(rnd() < 0.5 ? 'drake' : 'hen', c, rnd));
        }
        this.clusters.push(c);
      }
    }
    this.game.scene.add(this.group);
  }

  add(kind, c, rnd) {
    const d = { kind, def: KINDS[kind], x: c.x + (rnd() - 0.5) * 6, z: c.z + (rnd() - 0.5) * 6, ry: rnd() * 6.28, tx: c.x, tz: c.z, wait: rnd() * 3, phase: rnd() * 6, c };
    this.ducks.push(d);
    return d;
  }

  /** Is the player at the railing next to some ducks? Returns the cluster. */
  nearCluster(p) {
    if (!this.city?.water.any || this.game.inside) return null;
    const edge = this.city.half + this.city.K.PROM;
    for (const c of this.clusters) {
      const o = c.ox ? p.x * c.ox : p.z * c.oz;
      if (o < edge - 6 || o > edge + 0.5) continue;
      if ((c.x - p.x) ** 2 + (c.z - p.z) ** 2 < 26 * 26) return c;
    }
    return null;
  }

  interactable(p) {
    const c = this.nearCluster(p);
    if (!c) return null;
    const swans = c.ducks[0].kind === 'swan';
    return { label: swans ? '🦢 Toss some crumbs to the swans' : '🦆 Feed the ducks', action: () => this.feed(c) };
  }

  feed(c) {
    const game = this.game;
    const p = game.player.pos;
    // they paddle over to the railing in front of you
    const edge = this.city.half + this.city.K.PROM;
    c.feed = { x: c.ox ? c.ox * (edge + 1.6) : p.x, z: c.oz ? c.oz * (edge + 1.6) : p.z, t: 25 };
    game.player.heading = Math.atan2(c.ox, c.oz);
    game.player.emote = { id: 'feed', t: 3, held: false };
    game.audio?.play('throw');
    const sim = game.sim;
    sim.advance(10, { noCollapse: true });
    sim.state.needs.fun = Math.min(100, sim.state.needs.fun + 9);
    sim.state.stats.ducksFed = (sim.state.stats.ducksFed || 0) + 1;
    const swans = c.ducks[0].kind === 'swan';
    game.events.emit('toast', { icon: swans ? '🦢' : '🦆', title: swans ? 'The swans glide over' : 'Quack!', text: swans ? 'Two swans drift over, dignified, and take the crumbs very politely.' : 'The ducks come paddling over as fast as their feet can go. The little ones squeak.', kind: 'good' });
  }

  update(dt, playerPos, visible) {
    if (!this.ducks.length) return;
    this.group.visible = visible;
    if (!visible) return;
    const t = performance.now() / 1000;
    let n = 0;
    for (const c of this.clusters) {
      const near = (c.x - playerPos.x) ** 2 + (c.z - playerPos.z) ** 2 < NEAR * NEAR;
      if (!near) continue;
      if (c.feed) {
        c.feed.t -= dt;
        if (c.feed.t <= 0) c.feed = null;
      }
      for (const d of c.ducks) {
        if (n >= MAX) break;
        this.step(d, dt, c);
        const s = d.def.scale;
        const bob = Math.sin(t * 1.6 + d.phase) * 0.025;
        this._p.set(d.x, WATER_Y - 0.05 * s + bob, d.z);
        this._q.setFromEuler(this._e.set(Math.sin(t * 1.3 + d.phase) * 0.06, d.ry, Math.sin(t * 1.1 + d.phase) * 0.05));
        this._s.set(s, s, s);
        this._m.compose(this._p, this._q, this._s);
        this.bodies.setMatrixAt(n, this._m);
        this.heads.setMatrixAt(n, this._m);
        this.beaks.setMatrixAt(n, this._m);
        this.bodies.setColorAt(n, this._c.set(d.def.body));
        this.heads.setColorAt(n, this._c.set(d.def.head));
        this.beaks.setColorAt(n, this._c.set(d.kind === 'swan' ? '#e8742a' : d.kind === 'duckling' ? '#3a3020' : d.kind === 'drake' ? '#e6c23a' : '#d88a2a'));
        n++;
      }
    }
    for (const m of [this.bodies, this.heads, this.beaks]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  step(d, dt, c) {
    let tx;
    let tz;
    let speed = d.kind === 'swan' ? 0.35 : 0.45;
    if (d.follow) {
      // ducklings: stay in line behind whoever is in front
      const f = d.follow;
      const gap = d.follow.kind === 'hen' ? 0.55 : 0.32;
      tx = f.x - Math.sin(f.ry) * gap;
      tz = f.z - Math.cos(f.ry) * gap;
      speed = 0.9;
      const dd = Math.hypot(tx - d.x, tz - d.z);
      if (dd < 0.05) return;
      speed = Math.min(1.4, dd * 2.2);
    } else if (c.feed) {
      tx = c.feed.x + Math.sin(d.phase) * 1.2;
      tz = c.feed.z + Math.cos(d.phase) * 1.2;
      speed = 0.9;
    } else {
      d.wait -= dt;
      if (d.wait > 0) {
        d.ry += Math.sin(d.phase + d.wait) * 0.2 * dt;
        return;
      }
      tx = d.tx;
      tz = d.tz;
      if (Math.hypot(tx - d.x, tz - d.z) < 0.4) {
        // pick somewhere nearby on the water (never up against the wall)
        const edge = this.city.half + this.city.K.PROM;
        const a = (c.ox ? c.z : c.x) + (Math.random() - 0.5) * 18;
        const o = edge + 4 + Math.random() * 16;
        d.tx = c.ox ? c.ox * o : a;
        d.tz = c.oz ? c.oz * o : a;
        d.wait = 1 + Math.random() * 6;
        return;
      }
    }
    const dx = tx - d.x;
    const dz = tz - d.z;
    const len = Math.hypot(dx, dz) || 1;
    if (len < 0.3 && c.feed) {
      d.ry += Math.sin(performance.now() / 300 + d.phase) * dt; // pecking around
      return;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - d.ry;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    d.ry += diff * Math.min(1, dt * 3);
    const step = Math.min(len, speed * dt);
    d.x += Math.sin(d.ry) * step;
    d.z += Math.cos(d.ry) * step;
  }
}
