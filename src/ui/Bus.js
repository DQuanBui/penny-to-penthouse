// Riding the city bus: wait at a bus shelter, and when a bus pulls in (or
// after a short wait, if none comes by) pick a district. The ride is slower
// than the subway but stops all over town, and a transit pass covers it.
import { h, btn } from './dom.js';
import { dialog } from './Menus.js';
import { fmtMoney } from '../core/utils.js';
import { taxiRide, endTaxiRide, taxiArrive, nearestKerb } from '../world/TaxiRide.js';

const WAIT_MAX = 25; // seconds before the next bus "arrives" anyway

export class BusRides {
  constructor(game) {
    this.game = game;
    this.wait = null;
  }

  nearestStop(p, r = 2.6) {
    let best = null;
    let bd = r * r;
    for (const s of this.game.city?.busStops || []) {
      const d = (s.x - p.x) ** 2 + (s.z - p.z) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  interactable(p) {
    if (this.wait) return { label: '🚌 Waiting for the bus… (walk away to give up)', action: null };
    const s = this.nearestStop(p);
    if (!s) return null;
    return { label: '🚌 Wait for the bus', action: () => this.start(s) };
  }

  start(stop) {
    this.wait = { stop, t: 0 };
    this.game.player.emote = { id: 'phone', held: true, t: 0 };
    this.game.hud.hint('bus', 'A bus will pull in soon. Pick where to ride when it does.', 6);
  }

  update(dt) {
    const w = this.wait;
    if (!w) return;
    const game = this.game;
    const p = game.player.pos;
    if (game.inside || (w.stop.x - p.x) ** 2 + (w.stop.z - p.z) ** 2 > 5 * 5) {
      this.wait = null;
      return;
    }
    w.t += dt;
    // a real bus stopping right here, or the timetable catching up
    const t = game.traffic;
    let here = false;
    for (let i = t.bus0 ?? t.n; i < t.n; i++) {
      if (t.alive?.[i] && t.speed[i] < 0.4 && (t.x[i] - w.stop.x) ** 2 + (t.z[i] - w.stop.z) ** 2 < 14 * 14) here = true;
    }
    if (here || w.t > WAIT_MAX) {
      this.wait = null;
      game.player.emote = null;
      game.audio?.play('hiss');
      this.open(w.stop);
    }
  }

  /** A stop's name: the best-known place within a short walk, or the district. */
  stopName(stop) {
    const c = this.game.city;
    let best = null;
    let bd = 70 * 70;
    for (const q of c.places) {
      if (q.minor || q.type === 'home') continue;
      const d = (q.x - stop.x) ** 2 + (q.z - stop.z) ** 2;
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    for (const l of c.landmarks) if ((l.x - stop.x) ** 2 + (l.z - stop.z) ** 2 < bd) return l.name;
    if (best) return best.name;
    // otherwise the corner shop everybody knows
    bd = 140 * 140;
    for (const q of c.places) {
      if (q.type === 'home') continue;
      const d = (q.x - stop.x) ** 2 + (q.z - stop.z) ** 2;
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best ? `${best.name} corner` : `${c.districtAt(stop.x, stop.z).name} Ave`;
  }

  /** Stops to ride to: the nearest few in every district (a short hop in your own too). */
  destinations(from) {
    const c = this.game.city;
    const by = new Map();
    for (const s of c.busStops || []) {
      const d = Math.hypot(s.x - from.x, s.z - from.z);
      if (d < 90) continue; // walkable
      const dist = c.districtAt(s.x, s.z);
      if (!by.has(dist)) by.set(dist, []);
      by.get(dist).push({ stop: s, d });
    }
    const out = [];
    for (const dist of c.districts) {
      const list = (by.get(dist) || []).sort((a, b) => a.d - b.d);
      // spread the picks across the district rather than four neighbouring shelters
      const picks = [];
      for (const e of list) if (picks.length < 4 && picks.every((q) => Math.hypot(q.stop.x - e.stop.x, q.stop.z - e.stop.z) > 120)) picks.push(e);
      for (const e of picks) out.push({ ...e, district: dist, name: this.stopName(e.stop) });
    }
    return out;
  }

  open(stop) {
    const game = this.game;
    const sim = game.sim;
    const cfg = game.city.cfg;
    const fare = cfg.transit?.kind === 'bus' ? cfg.transit.fare : Math.round((cfg.transit?.fare || 2.5) * 0.9 * 100) / 100;
    const pass = (game.state.transitPass || 0) > sim.day;
    const dests = this.destinations(stop);
    let last = null;
    const rows = [];
    for (const e of dests) {
      if (e.district !== last) rows.push(h('div.map-district', e.district.name));
      last = e.district;
      const minutes = Math.round(6 + e.d / 16);
      rows.push(btn(`🚏  ${e.name}  ·  ${minutes} min  ·  ${pass ? '🎟️ pass' : fmtMoney(fare)}`, () => this.ride(stop, e, minutes, pass ? 0 : fare, el)));
    }
    const el = dialog(game, {
      title: '🚌 The bus pulls in',
      body: h(
        'div.menu-col',
        h('div.muted', `"Where to?" The doors hiss open. Pick a stop: buses take longer than the train but stop on every street.${pass ? ' Your pass covers the fare.' : ''}`),
        h('div.menu-col.bus-stops', { style: 'max-height: 52vh; overflow-y: auto' }, rows),
        btn('Not this one', () => game.closeOverlay(el)),
      ),
    });
  }

  /** Board, ride (you watch the bus pull out), and step off at the chosen stop. */
  async ride(from, e, minutes, fare, el) {
    const game = this.game;
    const sim = game.sim;
    if (fare && !sim.finance.spend(fare, 'transit', 'Bus fare')) return;
    game.closeOverlay(el);
    game.events.emit('toast', { icon: '🚌', title: `Bus to ${e.name}`, text: `${fare ? fmtMoney(fare) + ' fare. ' : ''}You grab a window seat and watch the city roll by.`, kind: 'info' });
    const c = game.city;
    const startK = nearestKerb(c, from);
    const endK = nearestKerb(c, e.stop);
    if (startK) await taxiRide(game, { kind: 'bus', spot: startK });
    await game.fade(() => {
      endTaxiRide(game);
      sim.advance(minutes, { rates: { energy: 1, fun: 1 } });
      game.state.stats.busRides = (game.state.stats.busRides || 0) + 1;
      // stand at the shelter, then ride the last stretch in and step off
      const n = endK ? { nx: -endK.nx, nz: -endK.nz } : { nx: 0, nz: 1 };
      const place = { x: e.stop.x, z: e.stop.z, nx: -n.nx, nz: -n.nz, name: e.name, district: e.district };
      game.placePlayerAt(place);
      if (endK) taxiArrive(game, place, { kind: 'bus', spot: endK });
      game.events.emit('travelled', { place });
    });
  }
}
