// Named NPCs in the world. Their schedule (data/npcs) says whether they are at
// home, at work, inside a favourite place or out in the city; this manager
// puts a rig where they are when the player is close enough to see them —
// on a bench, outside a shop door, behind a counter or in a café.
import * as THREE from 'three';
import { createRig } from './CharacterFactory.js';
import { animateRig } from './Animation.js';
import { randomAppearance } from './Customization.js';
import { npcsOf, npcWhere } from '../data/npcs/index.js';
import { relLevel, REL_ICONS } from '../sim/Relationships.js';
import { hourOf } from '../core/Clock.js';
import { mulberry32, hashStr, dampAngle } from '../core/utils.js';
import { glbNpcModels } from './GLBCharacters.js';

const SHOW_DIST = 75;
const MAX_OUT = 10;

function nameTag(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.font = '600 28px Outfit, "Segoe UI Emoji", system-ui, sans-serif';
  const w = Math.min(250, g.measureText(text).width + 28);
  g.fillStyle = 'rgba(16,20,34,0.82)';
  g.beginPath();
  g.roundRect((256 - w) / 2, 8, w, 46, 23);
  g.fill();
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(1.5, 0.375, 1);
  s.position.y = 2.12;
  return s;
}

export class NPCManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.out = new Map(); // npc id -> actor (outdoors)
    this.indoor = []; // actors in the current interior
    this._timer = 0;
  }

  setCity(city) {
    this.clearOutdoor();
    this.city = city;
    this.list = npcsOf(city.cfg.id);
    // benches grouped by district for quick spot lookup
    this.benches = {};
    for (const b of city.benchSpots) {
      const d = city.districtAt(b.x, b.z).id;
      (this.benches[d] ||= []).push(b);
    }
  }

  makeActor(npc, look) {
    // optional GLB models (public/models/characters, not named player*) dress the NPCs
    const models = glbNpcModels();
    const base = look || npc.look;
    const rig = createRig(models.length ? { ...base, model: models[hashStr(npc ? npc.id : JSON.stringify(base).slice(0, 40)) % models.length] } : base);
    const actor = { npc, rig, sit: false, talking: false, heading: 0, baseHeading: 0, tagLevel: -2 };
    this.refreshTag(actor);
    return actor;
  }

  refreshTag(actor) {
    if (!actor.npc) return;
    const rel = this.game.state?.relationships[actor.npc.id];
    const lvl = rel ? relLevel(rel.score) : -1;
    if (lvl === actor.tagLevel) return;
    actor.tagLevel = lvl;
    if (actor.tag) {
      actor.rig.group.remove(actor.tag);
      actor.tag.material.map.dispose();
      actor.tag.material.dispose();
    }
    actor.tag = nameTag(`${lvl >= 0 ? REL_ICONS[lvl] + ' ' : ''}${actor.npc.first}`);
    actor.rig.group.add(actor.tag);
  }

  disposeActor(a) {
    a.rig.group.parent?.remove(a.rig.group);
    if (a.tag) {
      a.tag.material.map.dispose();
      a.tag.material.dispose();
    }
    a.rig.dispose();
  }

  clearOutdoor() {
    for (const a of this.out.values()) this.disposeActor(a);
    this.out.clear();
  }
  clearIndoor() {
    for (const a of this.indoor) this.disposeActor(a);
    this.indoor = [];
  }

  // ---- schedule ---------------------------------------------------------------
  where(npc) {
    const st = this.game.state;
    return npcWhere(npc, hourOf(st.time.total), Math.floor(st.time.total / 1440));
  }

  /** Human-readable location for the Contacts app. */
  whereText(npc) {
    const w = this.where(npc);
    const name = (type) => this.city.places.find((p) => p.type === type)?.name || type;
    if (w.kind === 'home') return 'At home';
    if (w.kind === 'work') return `At work · ${name(w.type)}`;
    if (w.kind === 'in') return `At ${name(w.type)}`;
    return `Out in ${this.city.districts.find((d) => d.id === npc.district)?.name || 'the city'}`;
  }

  /** Deterministic outdoor spot for an NPC during a schedule slot. */
  outdoorSpot(npc, slot) {
    const rng = mulberry32(hashStr(npc.id + slot));
    const benches = this.benches[npc.district] || [];
    if (benches.length && rng() < 0.55) {
      const b = benches[Math.floor(rng() * benches.length)];
      return { x: b.x + Math.sin(b.ry) * 0.06, z: b.z + Math.cos(b.ry) * 0.06, ry: b.ry, sit: true };
    }
    const types = npc.fav.concat(npc.work ? [npc.work] : []);
    const type = types[Math.floor(rng() * types.length)];
    const p = this.city.places.find((q) => q.type === type) || this.city.places.find((q) => q.type === 'home' && q.district.id === npc.district);
    const side = (rng() < 0.5 ? -1 : 1) * (2.4 + rng() * 1.6);
    // step sideways along the facade and a little out from the door
    return { x: p.x - p.nz * side + p.nx * 0.6, z: p.z + p.nx * side + p.nz * 0.6, ry: Math.atan2(p.nx, p.nz), sit: false };
  }

  // ---- interiors ----------------------------------------------------------------
  /** Fill an interior with whoever is there right now, plus counter staff. */
  populateInterior(interior, place) {
    this.clearIndoor();
    if (place.type === 'home') return;
    const here = this.list.filter((n) => {
      const w = this.where(n);
      return (w.kind === 'work' || w.kind === 'in') && w.type === place.type;
    });
    const workers = here.filter((n) => n.work === place.type);
    const guests = here.filter((n) => n.work !== place.type).slice(0, 4);
    const rng = mulberry32(hashStr(place.id + Math.floor(this.game.state.time.total / 240)));
    const add = (actor, x, z, ry) => {
      actor.rig.group.position.set(x, 0, z);
      actor.heading = actor.baseHeading = ry;
      actor.rig.group.rotation.y = ry;
      interior.root.add(actor.rig.group);
      this.indoor.push(actor);
    };
    // someone behind every counter
    const counters = interior.points.filter((p) => p.use === 'service');
    for (const c of counters) {
      const a = (c.item.r || 0) * (Math.PI / 2);
      const x = c.ix - Math.sin(a) * 0.95;
      const z = c.iz - Math.cos(a) * 0.95;
      const who = workers.shift();
      add(who ? this.makeActor(who) : this.makeActor(null, randomAppearance(mulberry32(hashStr(place.id + 'staff')))), x, z, a);
    }
    const spots = interior.freeSpots(workers.length + guests.length, rng);
    for (const n of workers.slice(0, 3).concat(guests)) {
      const s = spots.shift();
      if (!s) break;
      add(this.makeActor(n), s.x, s.z, rng() * Math.PI * 2);
    }
  }

  // ---- per frame ------------------------------------------------------------------
  update(dt, playerPos, inside) {
    const game = this.game;
    if (inside) {
      for (const a of this.indoor) this.animate(a, dt, playerPos);
      return;
    }
    this._timer -= dt;
    if (this._timer <= 0) {
      this._timer = 0.6;
      const seen = new Set();
      for (const n of this.list) {
        const w = this.where(n);
        if (w.kind !== 'out') continue;
        let a = this.out.get(n.id);
        const spot = a && a.slot === w.slot ? a.spot : this.outdoorSpot(n, w.slot);
        const d2 = (spot.x - playerPos.x) ** 2 + (spot.z - playerPos.z) ** 2;
        if (d2 > SHOW_DIST * SHOW_DIST || seen.size >= MAX_OUT) continue;
        seen.add(n.id);
        if (!a) {
          a = this.makeActor(n);
          this.out.set(n.id, a);
          game.scene.add(a.rig.group);
        }
        if (a.slot !== w.slot) {
          a.slot = w.slot;
          a.spot = spot;
          a.sit = spot.sit;
          a.heading = a.baseHeading = spot.ry;
          a.rig.group.position.set(spot.x, this.city.groundY(spot.x, spot.z), spot.z);
          a.rig.group.rotation.y = spot.ry;
        }
        this.refreshTag(a);
      }
      for (const [id, a] of this.out) {
        if (!seen.has(id) && !a.talking) {
          this.disposeActor(a);
          this.out.delete(id);
        }
      }
    }
    for (const a of this.out.values()) this.animate(a, dt, playerPos);
  }

  animate(a, dt, playerPos) {
    const g = a.rig.group;
    const dx = playerPos.x - g.position.x;
    const dz = playerPos.z - g.position.z;
    const near = dx * dx + dz * dz < 9;
    // standing NPCs turn to look at a nearby player
    const target = (a.talking || (near && !a.sit)) ? Math.atan2(dx, dz) : a.baseHeading;
    a.heading = dampAngle(a.heading, target, 5, dt);
    g.rotation.y = a.heading;
    if (a.tag) a.tag.visible = dx * dx + dz * dz < 14 * 14;
    animateRig(a.rig, dt, { speed: 0, grounded: true, sitting: a.sit && !a.talking, talking: a.talking, waving: near && !a.talking && !a.sit && a.npc && a.tagLevel >= 2 && (a.waveT = (a.waveT || 0) + dt) < 1.6 });
    if (!near) a.waveT = 0;
  }

  /** Closest named NPC within reach (current scene only). */
  nearest(pos, inside, reach = 2.0) {
    let best = null;
    let bd = reach * reach;
    const scan = (a) => {
      if (!a.npc) return;
      const p = a.rig.group.position;
      const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
      if (d < bd) {
        bd = d;
        best = a;
      }
    };
    if (inside) this.indoor.forEach(scan);
    else this.out.forEach(scan);
    return best;
  }
}
