// Riding the city bus: wait at a bus shelter, and when a bus pulls in (or
// after a short wait, if none comes by) pick a district. The ride is slower
// than the subway but stops all over town, and a transit pass covers it.
import { h, btn } from './dom.js';
import { dialog } from './Menus.js';
import { fmtMoney } from '../core/utils.js';

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

  open(stop) {
    const game = this.game;
    const sim = game.sim;
    const cfg = game.city.cfg;
    const fare = cfg.transit?.kind === 'bus' ? cfg.transit.fare : Math.round((cfg.transit?.fare || 2.5) * 0.9 * 100) / 100;
    const pass = (game.state.transitPass || 0) > sim.day;
    const here = game.city.districtAt(stop.x, stop.z);
    const dests = game.city.places.filter((q) => q.station && q.district !== here);
    const el = dialog(game, {
      title: '🚌 The bus pulls in',
      body: h(
        'div.menu-col',
        h('div.muted', `"Where to?" The doors hiss open. Buses take longer than the train but stop on every street.${pass ? ' Your pass covers the fare.' : ''}`),
        dests.map((d) => {
          const minutes = Math.round(10 + Math.hypot(d.x - stop.x, d.z - stop.z) / 18);
          return btn(`🚌  ${d.district.name}  ·  ${minutes} min  ·  ${pass ? '🎟️ pass' : fmtMoney(fare)}`, () => {
            if (!pass && !sim.finance.spend(fare, 'transit', 'Bus fare')) return;
            game.closeOverlay(el);
            game.fade(() => {
              sim.advance(minutes, { rates: { energy: 1, fun: 1 } });
              game.state.stats.busRides = (game.state.stats.busRides || 0) + 1;
              game.placePlayerAt({ ...d, x: d.x, z: d.z });
              game.events.emit('travelled', { place: d });
            });
            game.events.emit('toast', { icon: '🚌', title: `Bus to ${d.district.name}`, text: 'You grab a window seat and watch the city roll by.', kind: 'info' });
          });
        }),
        btn('Not this one', () => game.closeOverlay(el)),
      ),
    });
  }
}
