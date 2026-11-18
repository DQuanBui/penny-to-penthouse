// Schedules and resolves random life events (data/events.js).
import { BALANCE } from '../data/balance.js';
import { LIFE_EVENTS, LIFE_EVENT_BY_ID } from '../data/events.js';
import { fmtMoney } from '../core/utils.js';

export class LifeEvents {
  constructor(sim) {
    this.sim = sim;
    /** Headless runs set this to pick choices: (event, ctx) => choiceIndex */
    this.policy = null;
  }
  get e() {
    return this.sim.state.events;
  }

  /** The event waiting for the player's decision: { def, ctx, text } or null. */
  pending() {
    const p = this.e.pending;
    if (!p) return null;
    const def = LIFE_EVENT_BY_ID[p.id];
    if (!def) {
      this.e.pending = null;
      return null;
    }
    return { def, ctx: p.ctx, text: def.text(this.sim, p.ctx) };
  }

  /** Force a specific event (debug panel) or roll one from the eligible pool. */
  trigger(id) {
    const sim = this.sim;
    const day = sim.day;
    let def = id ? LIFE_EVENT_BY_ID[id] : null;
    // a forced event may skip its timing conditions but never its hard
    // requirements (no car breakdown without a car)
    if (def && def.needs && !safe(() => def.needs(sim))) return null;
    if (!def) {
      const pool = LIFE_EVENTS.filter((ev) => (this.e.cooldown[ev.id] ?? -999) <= day && (!ev.when || safe(() => ev.when(sim))));
      if (!pool.length) return null;
      let total = 0;
      for (const ev of pool) total += ev.weight || 1;
      let r = sim.rng() * total;
      def = pool[pool.length - 1];
      for (const ev of pool) {
        r -= ev.weight || 1;
        if (r <= 0) {
          def = ev;
          break;
        }
      }
    }
    this.e.pending = { id: def.id, ctx: def.setup ? def.setup(sim) : {}, day };
    this.e.cooldown[def.id] = day + (def.cooldown || 10);
    sim.bus.emit('lifeEvent', { id: def.id });
    return def;
  }

  /** Apply the chosen option. Returns the outcome text. */
  resolve(index) {
    const sim = this.sim;
    const p = this.pending();
    if (!p) return '';
    const choice = p.def.choices[index] || p.def.choices[0];
    const result = choice.run(sim, p.ctx) || '';
    this.e.pending = null;
    this.e.log.unshift({ id: p.def.id, day: sim.day, choice: choice.label, result });
    if (this.e.log.length > 30) this.e.log.length = 30;
    sim.state.stats.eventsSeen++;
    sim.bus.emit('lifeEventDone', { id: p.def.id });
    return result;
  }

  daily(sim, day) {
    const st = sim.state;
    // friends repay what they borrowed
    const owed = st.flags.owed;
    if (owed) {
      for (let i = owed.length - 1; i >= 0; i--) {
        if (day < owed[i].day) continue;
        const o = owed.splice(i, 1)[0];
        sim.finance.earn(o.amount, 'other_in', 'Loan repaid by a friend');
        sim.rel.message(o.npc, `Paid you back the ${fmtMoney(o.amount)}. You are a lifesaver.`);
      }
    }
    if (day < this.e.nextDay) return;
    this.e.nextDay = day + BALANCE.events.minDays + Math.floor(sim.rng() * (BALANCE.events.maxDays - BALANCE.events.minDays + 1));
    // an undecided event simply expires when the next one comes along
    if (this.e.pending && !this.policy) this.e.pending = null;
    const def = this.trigger();
    if (def && this.policy) this.resolve(this.policy(def, this.e.pending.ctx));
  }
}

function safe(fn) {
  try {
    return fn();
  } catch {
    return false;
  }
}
