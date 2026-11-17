// Life goals and achievements: progress tracking and unlock checks.
import { GOALS, GOAL_BY_ID } from '../data/goals.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { clamp } from '../core/utils.js';

export class Goals {
  constructor(sim) {
    this.sim = sim;
  }

  /** Goals this life is pursuing: [{ def, cur, target, pct, done, failed }] */
  list() {
    const st = this.sim.state;
    return (st.profile.goals || []).map((id) => {
      const def = GOAL_BY_ID[id];
      const [cur, target] = def.progress(this.sim);
      const done = !!st.goals.find((g) => g.id === id);
      return { def, cur, target, pct: clamp(cur / target, 0, 1), done, failed: !done && def.byAge && st.profile.age >= def.byAge };
    });
  }

  /** The first goal still open (shown as the HUD objective when nothing is urgent). */
  current() {
    return this.list().find((g) => !g.done && !g.failed) || null;
  }

  check() {
    const sim = this.sim;
    const st = sim.state;
    for (const g of this.list()) {
      if (g.done || g.failed || g.cur < g.target) continue;
      st.goals.push({ id: g.def.id, day: sim.day });
      st.flags.moodBoost = Math.min(12, (st.flags.moodBoost || 0) + 3);
      sim.bus.emit('toast', { icon: '🏆', title: `Life goal achieved: ${g.def.name}!`, text: 'This is what you came to the city for.', kind: 'good', long: true });
      sim.bus.emit('goalDone', { id: g.def.id });
    }
  }

  daily() {
    const st = this.sim.state;
    if (this.sim.finance.breakdown().debt > 1) st.flags.hadDebt = true;
    this.check();
  }
}

export class Achievements {
  constructor(sim) {
    this.sim = sim;
  }
  check() {
    const sim = this.sim;
    const st = sim.state;
    for (const a of ACHIEVEMENTS) {
      if (st.achievements[a.id] != null) continue;
      let ok = false;
      try {
        ok = !!a.check(sim);
      } catch {
        ok = false;
      }
      if (!ok) continue;
      st.achievements[a.id] = sim.day;
      sim.bus.emit('toast', { icon: a.icon, title: `Achievement: ${a.name}`, text: a.desc, kind: 'good', long: true });
      sim.bus.emit('achievement', { id: a.id });
      sim.bus.emit('badge', { app: 'goals' });
    }
  }
  count() {
    return Object.keys(this.sim.state.achievements).length;
  }
  daily() {
    this.check();
  }
}

export { GOALS, ACHIEVEMENTS };
