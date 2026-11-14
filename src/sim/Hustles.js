// Side hustles: quick cash any time — delivery runs, rideshare, freelancing,
// streaming, tutoring. Each can be done once a day and is taxed as gig income.
import { lerp } from '../core/utils.js';
import { hasComputer } from '../data/items.js';
import { addSkill, skillLevel } from './Player.js';
import { moodFactor } from './Needs.js';

export const HUSTLES = {
  delivery: { name: 'Delivery run', icon: '🛵', minutes: 120, pay: [26, 48], needs: { energy: -15, hunger: -4, fun: -3 }, xp: { fitness: 0.12 }, desc: 'On foot or by bike. No requirements.' },
  rideshare: { name: 'Rideshare shift', icon: '🚕', minutes: 150, pay: [48, 90], needs: { energy: -11, fun: -4, social: 7 }, xp: { charisma: 0.06 }, vehicle: true, desc: 'Needs your own car.' },
  freelance: { name: 'Freelance gig', icon: '💻', minutes: 180, needs: { energy: -13, fun: -6 }, computer: true, skillAny: ['coding', 'creativity'], min: 3, desc: 'Needs a computer and Coding or Creativity 3+. Pays more as you improve.' },
  stream: { name: 'Go live', icon: '🎥', minutes: 120, needs: { fun: 14, energy: -10, social: 6 }, computer: true, xp: { charisma: 0.08, creativity: 0.08 }, desc: 'Needs a computer. Grows your followers; tips grow with your audience.' },
  tutor: { name: 'Tutoring session', icon: '📚', minutes: 120, needs: { energy: -9, social: 10 }, xp: { charisma: 0.12 }, top: 5, desc: 'Needs any skill at 5+. Teach what you know.' },
};

export class Hustles {
  constructor(sim) {
    this.sim = sim;
  }

  /** null when available, otherwise the reason it is not. */
  blocked(id) {
    const st = this.sim.state;
    const h = HUSTLES[id];
    if (st.hustles.lastDay[id] === this.sim.day) return 'Done for today — come back tomorrow.';
    if (h.vehicle && !st.vehicles.length) return 'You need a car (visit the dealer).';
    if (h.computer && !hasComputer(st)) return 'You need a laptop or PC (electronics store).';
    if (h.skillAny && !h.skillAny.some((s) => skillLevel(st, s) >= h.min)) return `Needs ${h.skillAny.join(' or ')} ${h.min}+.`;
    if (h.top && Math.max(...Object.values(st.skills)) < h.top) return `Needs any skill at ${h.top}+.`;
    if (st.needs.energy < 15) return 'You are too tired.';
    return null;
  }

  /** Expected gross pay range for the UI. */
  payRange(id) {
    const st = this.sim.state;
    const pi = this.sim.city.priceIndex || 1;
    const h = HUSTLES[id];
    if (id === 'freelance') {
      const s = Math.max(skillLevel(st, 'coding'), skillLevel(st, 'creativity'));
      return [Math.round(18 * s * pi * 0.8), Math.round(18 * s * pi * 1.3) + 20];
    }
    if (id === 'stream') {
      const f = st.social.followers;
      return [Math.round(4 + f * 0.006), Math.round(14 + f * 0.016)];
    }
    if (id === 'tutor') {
      const top = Math.max(...Object.values(st.skills));
      return [Math.round((50 + top * 9) * pi), Math.round((70 + top * 12) * pi)];
    }
    return [Math.round(h.pay[0] * pi), Math.round(h.pay[1] * pi)];
  }

  run(id) {
    const sim = this.sim;
    const st = sim.state;
    const h = HUSTLES[id];
    if (this.blocked(id)) return null;
    const mf = moodFactor(st);
    const [lo, hi] = this.payRange(id);
    const rates = {};
    for (const k in h.needs) rates[k] = (h.needs[k] / h.minutes) * 60;
    sim.advance(h.minutes, { rates });
    const gross = Math.round(lerp(lo, hi, sim.rng()) * (0.75 + 0.25 * mf));
    const net = sim.finance.earnTaxed(gross, 'hustle', h.name);
    for (const k in h.xp || {}) addSkill(sim, k, h.xp[k]);
    let followers = 0;
    if (id === 'freelance') addSkill(sim, skillLevel(st, 'coding') >= skillLevel(st, 'creativity') ? 'coding' : 'creativity', 0.2);
    if (id === 'stream') {
      followers = Math.round((6 + sim.rng() * 34) * (1 + st.social.popularity / 40) * (st.inventory.items.gaming_pc ? 1.6 : 1) * (1 + Math.sqrt(st.social.followers) / 40));
      st.social.followers += followers;
    }
    st.hustles.lastDay[id] = sim.day;
    st.hustles.total += net;
    st.stats.hustles = (st.stats.hustles || 0) + 1;
    sim.bus.emit('hustle', { id, net });
    return { gross, net, followers, minutes: h.minutes };
  }
}
