// The simulation orchestrator. Owns no rendering: it advances the clock on a
// plain state object and calls each system's hourly/daily/monthly hooks.
// The same class runs in the browser and in `npm run sim` (Node).
import { dayOf } from '../core/Clock.js';
import { tickNeeds, checkCollapse, computeMood } from './Needs.js';
import { Finance } from './Finance.js';
import { creditMonthly } from './Credit.js';

/** Optional systems register here (see installSystems in sim/index.js). */
export class Sim {
  /**
   * @param state from State.newState / a save
   * @param bus   Events instance (toast, money, newday, ...)
   * @param city  city data file (economy indices, districts)
   * @param rng   random source, defaults to Math.random
   */
  constructor(state, bus, city, rng = Math.random) {
    this.state = state;
    this.bus = bus;
    this.city = city;
    this.rng = rng;
    this.finance = new Finance(this);
    this.systems = []; // { hourly?(sim), daily?(sim, day), monthly?(sim, month) }
    this.headless = false;
    state.mood = computeMood(state);
  }

  use(system) {
    this.systems.push(system);
    return system;
  }

  get day() {
    return dayOf(this.state.time.total);
  }

  /**
   * Advance the clock by `minutes`, ticking needs and firing hourly/daily hooks.
   * activity: { sleeping, noDecay, rates:{need:perHour}, quiet }
   */
  advance(minutes, activity) {
    const st = this.state;
    let left = minutes;
    while (left > 1e-9) {
      const t = st.time.total;
      const toHour = 60 - (t % 60);
      const step = Math.min(left, toHour);
      tickNeeds(this, step, activity);
      st.time.total = t + step;
      left -= step;
      const h0 = Math.floor(t / 60);
      const h1 = Math.floor(st.time.total / 60 + 1e-9);
      if (h1 !== h0) {
        this.hourly();
        if (Math.floor(h1 / 24) !== Math.floor(h0 / 24)) this.daily();
      }
    }
    if (!activity || !activity.noCollapse) checkCollapse(this);
  }

  hourly() {
    for (const s of this.systems) s.hourly?.(this);
  }

  daily() {
    const st = this.state;
    const day = this.day;
    st.stats.daysPlayed = day;
    if (day > 0 && day % 112 === 0) {
      st.profile.age++;
      this.bus.emit('toast', { icon: '🎂', title: `Happy birthday — you are ${st.profile.age}!`, text: 'Another year in the city.', kind: 'good' });
    }
    for (const s of this.systems) s.daily?.(this, day);
    this.finance.daily();
    if (day > 0 && day % 28 === 0) {
      creditMonthly(this);
      for (const s of this.systems) s.monthly?.(this, day / 28);
    }
    this.bus.emit('newday', { day });
  }
}
