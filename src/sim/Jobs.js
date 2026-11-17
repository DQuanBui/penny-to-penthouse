// Employment: openings, interviews, shifts, pay accrual + biweekly paychecks,
// performance, promotions, raises and getting fired.
import { BALANCE, incomeTax } from '../data/balance.js';
import { CAREERS, CAREER_BY_ID, INTERVIEW_QUESTIONS } from '../data/careers.js';
import { SKILL_BY_ID } from '../data/archetypes.js';
import { calendar, hourOf, fmtHour } from '../core/Clock.js';
import { clamp, lerp, fmtMoney, shuffle } from '../core/utils.js';
import { mod, bonus, skillLevel, addSkill } from './Player.js';
import { moodFactor } from './Needs.js';
import { isPayday } from './Finance.js';

const J = BALANCE.jobs;

export class Jobs {
  constructor(sim) {
    this.sim = sim;
  }
  get job() {
    return this.sim.state.job;
  }
  career(id) {
    return CAREER_BY_ID[id ?? this.job?.career];
  }
  levelDef(careerId, level) {
    const j = this.job;
    return this.career(careerId)?.levels[level ?? j?.level];
  }
  title() {
    return this.job ? this.levelDef().title : '';
  }

  /** Annual salary of a career level in this city. */
  salaryFor(careerId, level, raise = 1) {
    const c = CAREER_BY_ID[careerId];
    const city = this.sim.city;
    return Math.round((c.levels[level].salary * (city.salaryIndex || 1) * (city.industries?.[careerId] || 1) * raise) / 100) * 100;
  }
  annualSalary() {
    const j = this.job;
    return j ? this.salaryFor(j.career, j.level, j.raise) : 0;
  }

  /** Check a requirement block against the player. */
  meets(req = {}) {
    const st = this.sim.state;
    const missing = [];
    for (const s in req.skills || {}) if (skillLevel(st, s) < req.skills[s]) missing.push(`${SKILL_BY_ID[s].name} ${req.skills[s]}`);
    const hasDeg = !req.degree || req.degree.some((d) => st.education.degrees.includes(d) || st.education.certs.includes(d));
    const hasCert = !req.cert || req.cert.some((d) => st.education.certs.includes(d));
    // "either" = a degree OR a certification is enough
    if (req.either && req.degree && req.cert) {
      if (!(req.degree.some((d) => st.education.degrees.includes(d)) || req.cert.some((d) => st.education.certs.includes(d)))) missing.push('a degree or licence (see Learn)');
    } else {
      if (!hasDeg) missing.push('a relevant degree (see Learn)');
      if (!hasCert) missing.push('a certification (see Learn)');
    }
    if (req.popularity && st.social.popularity < req.popularity) missing.push(`Popularity ${req.popularity}`);
    return { ok: missing.length === 0, missing };
  }

  /** Highest level (capped for outside hires) the player qualifies for, or -1. */
  bestLevel(careerId) {
    const c = CAREER_BY_ID[careerId];
    let best = -1;
    for (let i = 0; i < Math.min(c.levels.length, 4); i++) {
      if (this.meets(c.levels[i].req).ok) best = i;
      else break;
    }
    return best;
  }

  /** What the Jobs app lists. */
  openings() {
    const st = this.sim.state;
    const day = this.sim.day;
    const out = [];
    for (const c of CAREERS) {
      if (c.selfEmployed) continue;
      const best = this.bestLevel(c.id);
      const level = Math.max(0, best);
      const def = c.levels[level];
      const check = this.meets(def.req);
      const last = st.jobLog.applied[c.id];
      const wait = last != null ? Math.max(0, J.reapplyDays - (day - last)) : 0;
      out.push({ career: c, level, def, salary: this.salaryFor(c.id, level), qualified: check.ok, missing: check.missing, wait, current: st.job?.career === c.id, referral: !!st.flags.referrals?.[c.id] });
    }
    return out;
  }

  // ------------------------------------------------------------ interview
  interviewQuestions() {
    const st = this.sim.state;
    const top = Math.max(...Object.values(st.skills));
    return shuffle(this.sim.rng, INTERVIEW_QUESTIONS)
      .slice(0, 3)
      .map((q) => ({
        q: q.q,
        a: shuffle(
          this.sim.rng,
          q.a.filter((a) => !a.needs || Object.entries(a.needs).every(([k, v]) => (k === 'any' ? top >= v : skillLevel(st, k) >= v))),
        ),
      }));
  }

  /** Chance of an offer before answers are counted. */
  baseChance(careerId, level) {
    const st = this.sim.state;
    const c = CAREER_BY_ID[careerId];
    const def = c.levels[level];
    const need = def.req?.skills?.[c.skill] || 0;
    let p = J.interviewBase - level * 0.07;
    if (!def.req || !Object.keys(def.req).length) p += 0.28; // no-experience jobs are easy to land
    p += clamp((skillLevel(st, c.skill) - need) * 0.05, 0, 0.2);
    p += skillLevel(st, 'charisma') * 0.025;
    p += (st.profile.outfitStyle ?? 2) * 0.012;
    p += bonus(st, 'interview');
    if (st.flags.referrals?.[careerId]) p += J.referralBonus;
    return p;
  }

  /** scores: array of answer scores (0..2). Returns { hired, chance }. */
  resolveInterview(careerId, level, scores) {
    const st = this.sim.state;
    let p = this.baseChance(careerId, level);
    for (const s of scores) p += s === 2 ? 0.14 : s === 1 ? 0.04 : -0.1;
    p = clamp(p, 0.05, 0.97);
    const hired = this.sim.rng() < p;
    st.jobLog.applied[careerId] = this.sim.day;
    if (hired) this.hire(careerId, level);
    this.sim.bus.emit('interview', { hired, career: careerId });
    return { hired, chance: p };
  }

  hire(careerId, level) {
    const st = this.sim.state;
    if (st.job) this.leave('quit', true);
    st.job = { career: careerId, level, perf: 10, accrued: 0, raise: 1, hiredDay: this.sim.day, lastShiftDay: -1, shifts: 0, lates: 0, warned: false };
    if (st.flags.referrals) delete st.flags.referrals[careerId];
    st.flags.careerNews = true;
    const def = this.levelDef();
    this.sim.bus.emit('toast', { icon: '🎉', title: `Hired: ${def.title}`, text: `${fmtMoney(this.annualSalary())}/yr · weekdays ${fmtHour(def.hours[0])}–${fmtHour(def.hours[1])}. Do not be late!`, kind: 'good', long: true });
    this.sim.bus.emit('hired', { career: careerId, level });
  }

  /** Quit or get fired; the final paycheck is paid out immediately. */
  leave(reason = 'quit', silent = false) {
    const st = this.sim.state;
    const j = st.job;
    if (!j) return;
    const title = this.title();
    if (j.accrued > 0) this.payday(true);
    st.jobLog.history.push({ career: j.career, level: j.level, from: j.hiredDay, to: this.sim.day, reason });
    if (reason === 'quit') st.jobLog.lastQuitDay = this.sim.day;
    st.job = null;
    if (!silent) this.sim.bus.emit('toast', reason === 'fired' ? { icon: '📦', title: 'You were let go', text: `Your time as ${title} is over. Check the Jobs app for a fresh start.`, kind: 'bad', long: true } : { icon: '👋', title: `You quit as ${title}`, text: 'Final paycheck sent.', kind: 'info' });
    this.sim.bus.emit('jobLost', { reason });
  }

  // ---------------------------------------------------------------- shifts
  /**
   * Where the player stands with today's shift.
   * status: none | off | done | early | ready | late | missed
   */
  shiftInfo() {
    const j = this.job;
    if (!j) return { status: 'none' };
    const st = this.sim.state;
    const cal = calendar(st.time.total);
    const def = this.levelDef();
    const [s, e] = def.hours;
    const now = hourOf(st.time.total);
    const base = { start: s, end: e, def, now };
    if (cal.weekend) return { ...base, status: 'off' };
    if (j.lastShiftDay === cal.day) return { ...base, status: 'done' };
    if (now < s - 1) return { ...base, status: 'early' };
    if (now <= s + J.lateGraceMin / 60) return { ...base, status: 'ready' };
    if (now < e - 1) return { ...base, status: 'late', lateBy: now - s };
    return { ...base, status: 'missed' };
  }

  /** Text for the HUD / Jobs app. */
  nextShiftText() {
    const i = this.shiftInfo();
    if (i.status === 'none') return '';
    const range = `${fmtHour(i.start)}–${fmtHour(i.end)}`;
    switch (i.status) {
      case 'off': return `Weekend — next shift Monday ${fmtHour(i.start)}`;
      case 'done': return 'Shift done for today';
      case 'early': return `Shift today ${range}`;
      case 'ready': return `Shift starting now (${range})`;
      case 'late': return `You are late! Shift ${range}`;
      default: return 'You missed today’s shift';
    }
  }

  /**
   * Work today's shift. score = 0..1 from the mini-game, or null to auto-resolve.
   * Advances the clock to the end of the shift.
   */
  workShift(score = null) {
    const info = this.shiftInfo();
    if (info.status !== 'ready' && info.status !== 'late') return null;
    const sim = this.sim;
    const st = sim.state;
    const j = st.job;
    const def = info.def;
    const c = this.career();
    const from = Math.max(info.now, info.start);
    const hours = info.end - from;
    const full = info.end - info.start;
    const late = info.status === 'late';

    const mf = moodFactor(st); // mood at the start of the shift decides how it goes
    sim.advance(Math.max(0, info.end - info.now) * 60, { rates: { energy: -J.energyPerHour, fun: -J.funPerHour, hunger: J.lunchPerHour, social: J.socialPerHour } });

    const gross = (this.annualSalary() / J.paychecksPerYear / J.shiftsPerPeriod) * (hours / full);
    j.accrued += gross;

    const skillFit = clamp(0.8 + 0.045 * skillLevel(st, c.skill), 0.8, 1.25);
    let perf = score != null ? lerp(J.miniGamePerf[0], J.miniGamePerf[1], score) : lerp(J.skipShiftPerf[0], J.skipShiftPerf[1], sim.rng());
    perf *= skillFit * mf * mod(st, 'perfGain') * (hours / full);
    if (late) {
      perf -= J.latePerfPenalty;
      j.lates++;
    }
    j.perf += perf;

    let tips = 0;
    if (def.tips) {
      tips = lerp(def.tips[0], def.tips[1], sim.rng()) * (0.7 + 0.06 * skillLevel(st, 'charisma')) * mf * (sim.city.priceIndex || 1) * (hours / full);
      if (score != null) tips *= 1 + J.miniGameTipBonus * score;
      tips = Math.round(tips);
      sim.finance.earn(tips, 'tips', 'Tips');
    }
    addSkill(sim, c.skill, 0.13 * (score != null ? 1 + 0.6 * score : 1));
    addSkill(sim, 'charisma', 0.025);

    j.lastShiftDay = calendar(st.time.total - 1).day;
    j.shifts++;
    st.stats.shifts++;
    const out = { hours, gross, tips, perf, total: j.perf, late, score };
    Object.assign(out, this.review());
    sim.bus.emit('shiftDone', out);
    return out;
  }

  /** Promotion / raise / firing check. */
  review() {
    const sim = this.sim;
    const st = sim.state;
    const j = st.job;
    if (!j) return {};
    const c = this.career();
    if (j.perf >= J.promoPerf) {
      const next = c.levels[j.level + 1];
      const check = next ? this.meets(next.req) : { ok: false, missing: [] };
      if (next && check.ok) {
        j.level++;
        j.perf = 15;
        j.warned = false;
        st.stats.promotions++;
        st.flags.careerNews = true;
        const bonusPay = Math.round(this.annualSalary() * 0.02);
        sim.finance.earn(bonusPay, 'tips', 'Promotion bonus');
        sim.bus.emit('toast', { icon: '🚀', title: `Promoted to ${next.title}!`, text: `New salary ${fmtMoney(this.annualSalary())}/yr plus a ${fmtMoney(bonusPay)} bonus.`, kind: 'good', long: true });
        sim.bus.emit('promoted', { career: c.id, level: j.level, exec: !!next.exec, ceo: !!next.ceo });
        return { promoted: next.title };
      }
      j.raise *= 1 + J.raiseOnReview;
      j.perf = 55;
      const why = next ? `Promotion to ${next.title} needs ${check.missing.join(', ')}.` : 'You are at the top of this ladder.';
      sim.bus.emit('toast', { icon: '💰', title: `Raise: now ${fmtMoney(this.annualSalary())}/yr`, text: `Great review. ${why}`, kind: 'good', long: true });
      return { raise: true, blocked: next ? check.missing : null };
    }
    if (j.perf <= J.fireBelow) {
      this.leave('fired');
      return { fired: true };
    }
    if (j.perf <= J.warnBelow && !j.warned) {
      j.warned = true;
      sim.bus.emit('toast', { icon: '⚠️', title: 'Performance warning', text: 'Your manager is unhappy. Show up on time and do good work or you will be fired.', kind: 'bad', long: true });
    }
    return {};
  }

  // ------------------------------------------------------------------- pay
  /** Net amount of the next paycheck from what is accrued so far. */
  netPreview() {
    const j = this.job;
    if (!j || !j.accrued) return 0;
    return j.accrued - incomeTax(j.accrued * J.paychecksPerYear) / J.paychecksPerYear;
  }

  payday(final = false) {
    const sim = this.sim;
    const st = sim.state;
    const j = st.job;
    if (!j || j.accrued <= 0) return 0;
    const gross = j.accrued;
    const tax = incomeTax(gross * J.paychecksPerYear) / J.paychecksPerYear;
    const net = Math.round((gross - tax) * 100) / 100;
    j.accrued = 0;
    st.stats.taxesPaid += tax;
    st.stats.paychecks = (st.stats.paychecks || 0) + 1;
    sim.finance.earn(net, 'salary', `${final ? 'Final paycheck' : 'Paycheck'} — ${this.title()}`);
    sim.bus.emit('toast', { icon: '💸', title: final ? 'Final paycheck' : 'Payday!', text: `${fmtMoney(net)} deposited (${fmtMoney(gross)} gross − ${fmtMoney(tax)} tax).`, kind: 'good', long: true });
    sim.bus.emit('payday', { net, gross, tax });
    return net;
  }

  // ------------------------------------------------------------- sim hooks
  daily(sim, day) {
    const st = sim.state;
    const j = st.job;
    if (j) {
      const y = day - 1;
      const wasWorkday = y % 7 < 5;
      if (wasWorkday && j.hiredDay < y && j.lastShiftDay !== y) {
        j.perf -= J.missPerfPenalty;
        sim.bus.emit('toast', { icon: '⏰', title: 'Missed shift', text: 'You did not show up for work yesterday. Your performance took a hit.', kind: 'bad' });
        this.review();
      }
    }
    if (isPayday(day) && st.job) this.payday();
  }
}
