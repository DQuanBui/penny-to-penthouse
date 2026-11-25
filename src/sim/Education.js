// Learning: college programmes (degrees/certifications, one class a day),
// online courses and books.
import { PROGRAMS, PROGRAM_BY_ID, ONLINE_BY_ID, BOOK_BY_ID } from '../data/courses.js';
import { SKILL_BY_ID } from '../data/archetypes.js';
import { hourOf } from '../core/Clock.js';
import { fmtMoney } from '../core/utils.js';
import { addSkill, skillLevel, mod } from './Player.js';
import { moodFactor } from './Needs.js';

export class Education {
  constructor(sim) {
    this.sim = sim;
  }
  get e() {
    return this.sim.state.education;
  }
  has(id) {
    return this.e.degrees.includes(id) || this.e.certs.includes(id);
  }

  /** Can the player enrol? Returns { ok, reason }. */
  canEnroll(id) {
    const p = PROGRAM_BY_ID[id];
    const st = this.sim.state;
    if (this.has(id)) return { ok: false, reason: 'Completed' };
    if (this.e.enrolled) return { ok: false, reason: this.e.enrolled.id === id ? 'Enrolled' : 'Finish your current programme first' };
    const r = p.req || {};
    if (r.anyDegree && !this.e.degrees.length) return { ok: false, reason: 'Needs a bachelor degree' };
    if (r.degree && !r.degree.some((d) => this.e.degrees.includes(d))) return { ok: false, reason: `Needs ${r.degree.map((d) => PROGRAM_BY_ID[d].name).join(' or ')}` };
    if (r.cert && !r.cert.some((c) => this.has(c))) return { ok: false, reason: `Needs ${r.cert.map((c) => PROGRAM_BY_ID[c].name).join(' or ')}` };
    for (const s in r.skills || {}) if (skillLevel(st, s) < r.skills[s]) return { ok: false, reason: `Needs ${SKILL_BY_ID[s].name} ${r.skills[s]}` };
    return { ok: true };
  }

  tuition(id) {
    const st = this.sim.state;
    let t = PROGRAM_BY_ID[id].tuition * (this.sim.city.priceIndex ? 0.85 + this.sim.city.priceIndex * 0.15 : 1);
    if (st.flags.scholarship) t *= 1 - st.flags.scholarship;
    return Math.round(t / 50) * 50;
  }

  /** pay: 'cash' | 'loan' */
  enroll(id, pay) {
    const sim = this.sim;
    const p = PROGRAM_BY_ID[id];
    if (!this.canEnroll(id).ok) return false;
    const cost = this.tuition(id);
    if (pay === 'loan') sim.loans.take('student', cost, `Student loan — ${p.name}`);
    else if (!sim.finance.spend(cost, 'education', `Tuition — ${p.name}`, { credit: false })) return false;
    this.e.enrolled = { id, done: 0, lastDay: -1 };
    sim.state.flags.scholarship = 0;
    sim.bus.emit('toast', { icon: p.icon, title: `Enrolled: ${p.name}`, text: `${p.sessions} classes at the college, one per day (8 AM–8 PM).${pay === 'loan' ? ` Financed with a ${fmtMoney(cost)} student loan.` : ''}`, kind: 'good', long: true });
    sim.bus.emit('enrolled', { id });
    return true;
  }

  /** Why the player cannot attend class right now, or null. */
  classBlock() {
    const en = this.e.enrolled;
    if (!en) return 'You are not enrolled in a programme.';
    if (en.lastDay === this.sim.day) return 'You already attended class today.';
    const h = hourOf(this.sim.state.time.total);
    if (h < 8 || h >= 20) return 'Classes run from 8 AM to 8 PM.';
    return null;
  }

  attendClass() {
    const sim = this.sim;
    const st = sim.state;
    if (this.classBlock()) return null;
    const en = this.e.enrolled;
    const p = PROGRAM_BY_ID[en.id];
    const focus = moodFactor(st);
    sim.advance(p.hours * 60, { rates: { energy: -3.2, fun: -2.2, social: 2.5 } });
    for (const s in p.skills) addSkill(sim, s, (p.skills[s] / p.sessions) * focus * 1.6);
    en.done++;
    en.lastDay = sim.day;
    const out = { done: en.done, total: p.sessions, finished: false };
    if (en.done >= p.sessions) {
      (p.kind === 'degree' ? this.e.degrees : this.e.certs).push(p.id);
      this.e.enrolled = null;
      st.flags.careerNews = true;
      out.finished = true;
      sim.bus.emit('toast', { icon: '🎓', title: `Graduated: ${p.name}!`, text: 'New career levels are now open to you.', kind: 'good', long: true });
      sim.bus.emit('graduated', { id: p.id, kind: p.kind });
    }
    return out;
  }

  dropOut() {
    this.e.enrolled = null;
  }

  // ---- online courses ---------------------------------------------------------
  onlineState(id) {
    return this.e.online?.[id];
  }
  buyOnline(id) {
    const o = ONLINE_BY_ID[id];
    const sim = this.sim;
    if (skillLevel(sim.state, o.skill) < o.min) return false;
    if (!sim.finance.spend(Math.round(o.price * mod(sim.state, 'priceMul')), 'education', `Online course — ${o.name}`)) return false;
    (this.e.online ||= {})[id] = { done: 0, day: -1, n: 0 };
    return true;
  }
  /** One 1-hour lesson; at most two lessons per course per day. */
  lesson(id) {
    const sim = this.sim;
    const o = ONLINE_BY_ID[id];
    const s = this.e.online?.[id];
    if (!s || s.done >= o.lessons) return null;
    if (s.day !== sim.day) (s.day = sim.day), (s.n = 0);
    if (s.n >= 2) return { blocked: 'Two lessons a day is the limit — let it sink in.' };
    s.n++;
    sim.advance(60, { rates: { energy: -2.5, fun: sim.state.inventory.items.headphones ? -1 : -3 } });
    addSkill(sim, o.skill, o.xp * moodFactor(sim.state));
    s.done++;
    if (s.done >= o.lessons) {
      addSkill(sim, o.skill, o.xp);
      sim.bus.emit('toast', { icon: o.icon, title: `Course finished: ${o.name}`, text: 'Completion bonus added.', kind: 'good' });
      sim.bus.emit('courseDone', { id });
    }
    return { done: s.done, total: o.lessons };
  }

  // ---- books ---------------------------------------------------------------------
  buyBook(id) {
    const b = BOOK_BY_ID[id];
    const st = this.sim.state;
    if (st.inventory.books[id] != null) return false;
    if (!this.sim.finance.spend(Math.round(b.price * mod(st, 'priceMul')), 'education', `Book — ${b.name}`)) return false;
    st.inventory.books[id] = 0;
    return true;
  }
  readBook(id) {
    const sim = this.sim;
    const st = sim.state;
    const b = BOOK_BY_ID[id];
    if (st.inventory.books[id] == null || st.inventory.books[id] >= b.sittings) return null;
    sim.advance(60, { rates: { fun: 4, energy: -1 } });
    addSkill(sim, b.skill, b.xp * moodFactor(st));
    st.inventory.books[id]++;
    return { done: st.inventory.books[id], total: b.sittings };
  }
}

export { PROGRAMS };
