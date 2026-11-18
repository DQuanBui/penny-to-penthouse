// Weekly city happenings (data/cityEvents.js) brought to life: market tents,
// a lit concert stage, a fun-run arch or festival bunting appear at the venue
// while the event runs, a crowd gathers (and dances), the event is announced
// in the news, and the player can join in.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CITY_EVENTS, eventOn } from '../data/cityEvents.js';
import { createImpostors } from '../characters/Crowd.js';
import { iconTexture } from './Textures.js';
import { addSkill, mod } from '../sim/Player.js';
import { hourOf, fmtHour } from '../core/Clock.js';
import { mulberry32, hashStr, fmtMoney } from '../core/utils.js';
import { h, btn } from '../ui/dom.js';
import { dialog } from '../ui/Menus.js';

class Bag {
  constructor() {
    this.solid = [];
    this.glow = [];
  }
  add(geo, color, glow = false) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    const n = geo.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    geo.deleteAttribute('uv');
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    (glow ? this.glow : this.solid).push(geo);
  }
}
const B = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const C = (r0, r1, hh, x, y, z, s = 8) => new THREE.CylinderGeometry(r0, r1, hh, s).translate(x, y, z);

function textTexture(text, bg, fg = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 192);
  g.fillStyle = fg;
  g.font = '800 104px Outfit, "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text.toUpperCase(), 512, 100);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class CityEvents {
  constructor(game) {
    this.game = game;
    this.live = new Map(); // event id -> { def, venue, group, people, ... }
    this._t = 0;
  }

  setCity(city) {
    this.clear();
    this.city = city;
    const parks = city.blocks.filter((b) => b.kind === 'park').sort((a, b) => Math.hypot(a.cx, a.cz) - Math.hypot(b.cx, b.cz));
    const plazas = city.landmarks || [];
    let pi = 0;
    let li = 0;
    this.venues = {};
    for (const e of CITY_EVENTS) {
      let v;
      if (e.venue === 'plaza' && plazas.length) {
        const lm = plazas[li++ % plazas.length];
        v = { kind: 'plaza', x: lm.x, z: lm.z, name: lm.name + ' Plaza', district: lm.district };
      } else {
        const p = parks[pi++ % parks.length];
        v = { kind: 'park', x: p.cx, z: p.cz, name: `${p.district.name} Park`, district: p.district };
      }
      this.venues[e.id] = v;
    }
  }

  clear() {
    for (const ev of this.live.values()) this.dispose(ev);
    this.live.clear();
  }

  dispose(ev) {
    this.game.scene.remove(ev.group);
    ev.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    if (ev.light) this.game.scene.remove(ev.light);
  }

  /** Events on a given day (for the Calendar app): [{ def, venue }] */
  onDay(day) {
    return CITY_EVENTS.filter((e) => eventOn(e, day)).map((def) => ({ def, venue: this.venues?.[def.id] }));
  }

  // ---- set dressing ------------------------------------------------------------
  build(def) {
    const v = this.venues[def.id];
    const Y = this.city.K.CURB;
    const rng = mulberry32(hashStr(def.id + this.city.cfg.id));
    const bag = new Bag();
    const group = new THREE.Group();
    // the active area: park = north lawn band; plaza = band south of the landmark
    const park = v.kind === 'park';
    const ax = v.x;
    const az = park ? v.z - 12 : v.z + 20.5;
    const face = park ? 1 : -1; // stalls / stage face toward +z in parks, -z on plazas
    const area = { x0: ax - 18, x1: ax + 18, z0: park ? v.z - 16 : v.z + 17.5, z1: park ? v.z - 5.5 : v.z + 24 };
    const sign = (text, bg, w, hh, x, y, z, ry = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ map: textTexture(text, bg), toneMapped: false }));
      m.position.set(x, y, z);
      m.rotation.y = ry;
      group.add(m);
    };
    let stageFront = null;

    if (def.set === 'market' || def.set === 'festival') {
      const rows = park ? [az - 3.5, az + 2.5] : [az];
      let k = 0;
      for (const rz of rows) {
        for (let x = area.x0 + 2; x <= area.x1 - 2; x += 4.6) {
          if (def.set === 'festival' && Math.abs(x - ax) < 4) continue; // room for the stage
          const col = def.tents[k++ % def.tents.length];
          for (const [px, pz] of [[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]]) bag.add(C(0.04, 0.04, 2.3, x + px, Y + 1.15, rz + pz, 6), '#d8dde3');
          bag.add(new THREE.ConeGeometry(2.05, 0.8, 4).rotateY(Math.PI / 4).translate(x, Y + 2.7, rz), col);
          bag.add(B(2.4, 0.08, 0.9, x, Y + 0.85, rz + face * 0.75), '#f4f1ea');
          bag.add(B(2.3, 0.82, 0.08, x, Y + 0.42, rz + face * 1.15), col);
          for (let g = 0; g < 4; g++) bag.add(B(0.4, 0.22, 0.35, x - 0.8 + g * 0.52, Y + 1.0, rz + face * 0.7), ['#d63b2f', '#f2a33a', '#7cb342', '#ffd23f', '#8e44ad', '#5a8fd0'][Math.floor(rng() * 6)]);
          if (def.easels) {
            bag.add(B(0.05, 1.5, 0.05, x + 1.6, Y + 0.75, rz + face * 1.8), '#7a5a3c');
            bag.add(B(0.8, 0.6, 0.04, x + 1.6, Y + 1.25, rz + face * 1.83), ['#3f76d0', '#e07b39', '#2f8f8f', '#a04fc0'][k % 4]);
          }
        }
      }
      // strings of lanterns or bunting over the aisle
      const lz = park ? az - 0.5 : az + face * 2.4;
      for (let x = area.x0; x <= area.x1; x += 0.9) {
        const sag = Math.sin(((x - area.x0) / (area.x1 - area.x0)) * Math.PI * 4) ** 2 * 0.35;
        if (def.lanterns) bag.add(new THREE.SphereGeometry(0.16, 8, 6).translate(x, Y + 3.6 - sag, lz), ['#ff6a3d', '#ffd24a', '#ff3d6a'][Math.round(x) % 3], true);
        else bag.add(new THREE.ConeGeometry(0.18, 0.4, 3).rotateX(Math.PI).translate(x, Y + 3.5 - sag, lz), def.tents[Math.round(x * 3) % def.tents.length]);
      }
      sign(def.name, '#1d2433', 7, 1.3, ax, Y + 5.2, (park ? area.z0 - 0.5 : area.z1 + 0.5), park ? 0 : Math.PI);
      for (const px of [ax - 3.6, ax + 3.6]) bag.add(C(0.07, 0.07, 5.5, px, Y + 2.75, park ? area.z0 - 0.5 : area.z1 + 0.5, 8), '#3a3f48');
    }
    if (def.set === 'stage' || def.set === 'festival') {
      const sx = ax;
      const sz = park ? v.z - 17 : v.z + 23;
      const w = def.set === 'stage' ? 11 : 7;
      bag.add(B(w, 1.1, 5, sx, Y + 0.55, sz), '#26282d');
      bag.add(B(w, 6, 0.3, sx, Y + 3.0, sz - face * 2.4), '#141519');
      for (const tx of [-w / 2, w / 2]) bag.add(B(0.4, 7.2, 0.4, sx + tx, Y + 3.6, sz), '#9aa2ad');
      bag.add(B(w + 0.4, 0.4, 0.4, sx, Y + 7.2, sz), '#9aa2ad');
      for (const tx of [-w / 2 - 0.9, w / 2 + 0.9]) bag.add(B(1.2, 2.6, 1, sx + tx, Y + 1.3, sz + face * 1.5), '#1a1b1f');
      const lightCols = ['#ff3d6a', '#3dd6ff', '#ffd24a', '#a64dff', '#3dff8a'];
      for (let i = 0; i < 7; i++) bag.add(new THREE.SphereGeometry(0.2, 8, 6).translate(sx - w / 2 + 0.8 + (i * (w - 1.6)) / 6, Y + 6.85, sz + face * 0.1), lightCols[i % lightCols.length], true);
      sign(def.name, '#c2185b', Math.min(w - 1, 8), 1.4, sx, Y + 5.2, sz - face * 2.22, park ? 0 : Math.PI);
      stageFront = { x: sx, z: sz + face * 3 };
      // a real light for the night show
      const light = new THREE.PointLight('#ffb3e6', 0, 30, 1.4);
      light.position.set(sx, Y + 6, sz + face * 4);
      this.game.scene.add(light);
      this._light = light;
    }
    if (def.set === 'arch') {
      const zz = v.z - 21;
      for (const tx of [-2.2, 2.2]) bag.add(C(0.45, 0.45, 4.2, ax + tx, Y + 2.1, zz, 14), '#e84a4a');
      bag.add(new THREE.CylinderGeometry(0.45, 0.45, 4.8, 14).rotateZ(Math.PI / 2).translate(ax, Y + 4.4, zz), '#e84a4a');
      sign('Start · Finish', '#e84a4a', 3.6, 0.7, ax, Y + 4.4, zz + 0.5);
      for (let i = 0; i < 6; i++) bag.add(new THREE.ConeGeometry(0.22, 0.6, 10).translate(ax - 5 + i * 2, Y + 0.3, zz + 1.5), '#ff7a1a');
    }

    const solid = new THREE.Mesh(mergeGeometries(bag.solid), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));
    solid.castShadow = true;
    solid.receiveShadow = true;
    group.add(solid);
    let glowMat = null;
    if (bag.glow.length) {
      glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
      group.add(new THREE.Mesh(mergeGeometries(bag.glow), glowMat));
    }
    // marker above the venue
    const mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(def.icon, '#ffb347'), depthWrite: false, fog: false }));
    mk.material.map = mk.material.map.clone(); // owned copy so dispose() is safe
    mk.material.map.needsUpdate = true;
    mk.scale.setScalar(2.4);
    mk.position.set(ax, Y + 9, (area.z0 + area.z1) / 2);
    group.add(mk);

    // the crowd
    const n = def.crowd;
    const imp = createImpostors(n, rng);
    group.add(imp.mesh);
    const people = { x: new Float32Array(n), z: new Float32Array(n), tx: new Float32Array(n), tz: new Float32Array(n), ry: new Float32Array(n), wait: new Float32Array(n) };
    const target = stageFront;
    for (let i = 0; i < n; i++) {
      if (target) {
        // gathered in front of the stage, facing it
        const a = (rng() - 0.5) * 1.6;
        const r = 3 + rng() * 9;
        people.x[i] = target.x + Math.sin(a) * r * 1.1;
        people.z[i] = target.z + face * Math.cos(a) * r;
        people.ry[i] = Math.atan2(target.x - people.x[i], target.z - people.z[i]);
        imp.gait.setXYZ(i, def.dance ? 7 + rng() * 2 : 5, rng() * 6.28, def.dance && rng() < 0.7 ? 1 : 0);
      } else {
        people.x[i] = area.x0 + rng() * (area.x1 - area.x0);
        people.z[i] = area.z0 + rng() * (area.z1 - area.z0);
        people.tx[i] = people.x[i];
        people.tz[i] = people.z[i];
        people.wait[i] = rng() * 6;
      }
    }
    imp.gait.needsUpdate = true;
    this.game.scene.add(group);
    const ev = { def, venue: v, group, imp, people, area, glowMat, rng, stageFront, light: this._light || null, spot: stageFront || { x: ax, z: (area.z0 + area.z1) / 2 } };
    this._light = null;
    this.place(ev, 0);
    return ev;
  }

  /** Move market-goers between stalls and write the instance matrices. */
  place(ev, dt) {
    const P = ev.people;
    const n = ev.def.crowd;
    const m = (this._m ||= new THREE.Matrix4());
    const q = (this._q ||= new THREE.Quaternion());
    const p = (this._p ||= new THREE.Vector3());
    const s = (this._s ||= new THREE.Vector3(1, 1, 1));
    const up = (this._up ||= new THREE.Vector3(0, 1, 0));
    const Y = this.city.K.CURB;
    for (let i = 0; i < n; i++) {
      if (!ev.stageFront && dt > 0) {
        const dx = P.tx[i] - P.x[i];
        const dz = P.tz[i] - P.z[i];
        const d = Math.hypot(dx, dz);
        if (d < 0.1) {
          ev.imp.gait.setZ(i, 0);
          P.wait[i] -= dt;
          if (P.wait[i] <= 0) {
            P.tx[i] = ev.area.x0 + ev.rng() * (ev.area.x1 - ev.area.x0);
            P.tz[i] = ev.area.z0 + ev.rng() * (ev.area.z1 - ev.area.z0);
            P.wait[i] = 3 + ev.rng() * 8;
          }
        } else {
          const step = Math.min(d, 0.9 * dt);
          P.x[i] += (dx / d) * step;
          P.z[i] += (dz / d) * step;
          P.ry[i] = Math.atan2(dx, dz);
          ev.imp.gait.setZ(i, 1);
        }
      }
      q.setFromAxisAngle(up, P.ry[i]);
      m.compose(p.set(P.x[i], Y, P.z[i]), q, s);
      ev.imp.mesh.setMatrixAt(i, m);
    }
    ev.imp.mesh.instanceMatrix.needsUpdate = true;
    ev.imp.gait.needsUpdate = true;
  }

  update(dt, playerPos, inside) {
    const st = this.game.state;
    if (!st || !this.venues) return;
    this._t -= dt;
    if (this._t <= 0) {
      this._t = 1;
      const day = Math.floor(st.time.total / 1440);
      const hour = hourOf(st.time.total);
      for (const def of CITY_EVENTS) {
        const on = eventOn(def, day, hour);
        const ev = this.live.get(def.id);
        if (on && !ev) {
          this.live.set(def.id, this.build(def));
          this.announce(def, day);
        } else if (!on && ev) {
          this.dispose(ev);
          this.live.delete(def.id);
        }
      }
    }
    const night = this.game.sky.night;
    for (const ev of this.live.values()) {
      ev.group.visible = !inside;
      if (inside) continue;
      if ((ev.spot.x - playerPos.x) ** 2 + (ev.spot.z - playerPos.z) ** 2 < 160 * 160) this.place(ev, dt);
      if (ev.glowMat) ev.glowMat.color.setScalar(0.6 + night * 1.4);
      if (ev.light) ev.light.intensity = inside ? 0 : night * 60 * (0.75 + 0.25 * Math.sin(performance.now() / 180));
    }
  }

  announce(def, day) {
    const st = this.game.state;
    st.flags.eventNews ||= {};
    const key = def.id + ':' + day;
    if (st.flags.eventNews[key]) return;
    st.flags.eventNews = { [key]: 1 }; // only remember the latest
    const v = this.venues[def.id];
    const when = `${fmtHour(def.hours[0])} – ${fmtHour(def.hours[1])}`;
    this.game.sim.market?.news(def.icon, `${def.name} today at ${v.name}`, `${def.blurb} ${when}.`, 'info');
    this.game.events.emit('toast', { icon: def.icon, title: `${def.name} is on now`, text: `${v.name}, ${v.district.name} · until ${fmtHour(def.hours[1])}. Open the map for directions.`, kind: 'info', long: true });
  }

  /** Interaction when the player is at a running event. */
  interactable(pos) {
    for (const ev of this.live.values()) {
      if ((ev.spot.x - pos.x) ** 2 + (ev.spot.z - pos.z) ** 2 > 9 * 9) continue;
      return { label: `${ev.def.icon} ${ev.def.name}: see what's on`, action: () => this.open(ev) };
    }
    return null;
  }

  /** The nearest running event as a map waypoint target. */
  waypointFor(def) {
    const ev = this.live.get(def.id);
    const v = this.venues[def.id];
    const s = ev ? ev.spot : { x: v.x, z: v.z };
    return { id: 'event_' + def.id, name: def.name, x: s.x, z: s.z };
  }

  open(ev) {
    const game = this.game;
    const sim = game.sim;
    const st = game.state;
    const pm = (sim.city.priceIndex || 1) * mod(st, 'priceMul');
    const el = dialog(game, {
      title: `${ev.def.icon} ${ev.def.name}`,
      wide: true,
      body: h(
        'div.menu-col',
        h('div.muted', `${ev.def.blurb} ${ev.venue.name} · until ${fmtHour(ev.def.hours[1])}.`),
        ev.def.activities.map((a) => {
          const price = a.price ? Math.round(a.price * pm) : 0;
          const fx = Object.entries(a.needs || {}).map(([k, v2]) => `${k} ${v2 > 0 ? '+' : ''}${v2}`);
          if (a.xp) for (const k in a.xp) fx.push(`${k} skill`);
          if (a.followers) fx.push(`+${a.followers} followers`);
          const label = h('div', h('div', `${a.icon}  ${a.label}  ·  ${a.minutes} min${price ? '  ·  ' + fmtMoney(price) : '  ·  free'}`), h('div.muted.small', fx.join(' · ')));
          return btn(label, async () => {
            if (price && !sim.finance.spend(price, 'fun', `${ev.def.name}: ${a.label}`)) return;
            game.closeOverlay(el);
            await game.fade(() => {
              const rates = {};
              for (const k in a.needs || {}) rates[k] = (a.needs[k] / a.minutes) * 60;
              sim.advance(a.minutes, { rates, noCollapse: true });
              for (const k in a.xp || {}) addSkill(sim, k, a.xp[k]);
              if (a.meals) st.inventory.meals += a.meals;
              if (a.followers) st.social.followers += a.followers;
              if (a.furniture) (st.inventory.furniture ||= {})[a.furniture] = (st.inventory.furniture[a.furniture] || 0) + 1;
              st.stats.cityEvents = (st.stats.cityEvents || 0) + 1;
            });
            game.events.emit('toast', { icon: a.icon, title: a.label, text: a.furniture ? 'Delivered to your storage: place it at home in build mode (B).' : a.meals ? `${a.meals} portions added to your fridge.` : 'Good times.', kind: 'good' });
            game.events.emit('cityEventJoined', { id: ev.def.id });
          }, 'answer');
        }),
      ),
    });
  }
}
