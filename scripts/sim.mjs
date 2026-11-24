// Headless balance check:  npm run sim  [years] [city]
// Plays several strategies for N in-game years (default 5) with the real
// simulation code (no rendering) and prints net worth and key stats, so the
// economy can be tuned with data. Tuning numbers live in src/data/balance.js.
// Debug flags: ER_DETAIL=1 (why each collapse happened), BREAKDOWN=<strategy>
// (net worth parts per year), TRACE=<strategy> [TRACE_DAYS=n] (day-by-day log),
// NO_EVENTS=1 (no life events).
import { Sim } from '../src/sim/Sim.js';
import { installSystems } from '../src/sim/index.js';
import { newState } from '../src/sim/State.js';
import { Events } from '../src/core/Events.js';
import { getCity } from '../src/data/cities/index.js';
import { CAREER_BY_ID } from '../src/data/careers.js';
import { PROGRAMS, ONLINE, BOOKS } from '../src/data/courses.js';
import { BUSINESS } from '../src/data/businesses.js';
import { doActivity, sleep, hoursUntil, buyGroceries, foodBank, homeComfort } from '../src/sim/Activities.js';
import { skillLevel } from '../src/sim/Player.js';
import { payCard } from '../src/sim/Credit.js';
import { hourOf } from '../src/core/Clock.js';
import { mulberry32, fmtMoney } from '../src/core/utils.js';

const YEARS = Number(process.argv[2]) || 5;
const CITY = process.argv[3] || 'austin';
const DAYS = YEARS * 112;

// ---------------------------------------------------------------- strategies
// career: ladder to climb · play: mini-game score (null = skip shifts)
// study: improve whatever the next promotion needs · invest: share of spare cash
const STRATEGIES = [
  { name: 'Coaster (no effort)', archetype: 'dreamer', traits: ['lazy'], career: 'hospitality', play: null, study: false, invest: 0, social: false },
  { name: 'Server who saves', archetype: 'hustler', traits: ['frugal'], career: 'hospitality', play: 0.6, study: false, invest: 0.5, social: true },
  { name: 'Tech climber', archetype: 'dropout', traits: ['genius', 'ambitious'], career: 'tech', play: 0.75, study: true, invest: 0.4, social: true },
  { name: 'Trades + index fund', archetype: 'military', traits: ['frugal', 'fitness'], career: 'trades', play: 0.7, study: true, invest: 0.6, social: true },
  { name: 'Finance + landlord', archetype: 'hustler', traits: ['ambitious', 'frugal'], career: 'finance', play: 0.75, study: true, invest: 0.3, property: true, social: true },
  { name: 'Entrepreneur', archetype: 'citykid', traits: ['risktaker', 'charismatic'], career: 'hospitality', play: 0.7, study: true, invest: 0.1, business: 'food_truck', social: true },
  { name: 'Rich heir, lazy', archetype: 'heir', traits: ['lazy'], career: 'realestate', play: null, study: false, invest: 0.5, social: true },
];

function makeSim(strat, seed) {
  const city = getCity(CITY);
  const state = newState({ name: strat.name, archetype: strat.archetype, traits: strat.traits, appearance: {}, goals: ['millionaire'] }, city);
  state.seed = seed;
  const sim = installSystems(new Sim(state, new Events(), city, mulberry32(seed)));
  sim.headless = true;
  sim.events.policy = process.env.NO_EVENTS ? null : () => 0; // always the first (sensible) choice
  sim.log = { collapses: 0, mood: 0, days: 0, why: {}, name: strat.name };
  sim.bus.on('collapse', (c) => {
    sim.log.collapses++;
    // ER_DETAIL=1: what led to it (kind @ hour, during which activity)
    const k = `${c.kind}@${Math.floor(hourOf(sim.state.time.total - c.hours * 60))}h/${sim.log.doing || "?"}`;
    sim.log.why[k] = (sim.log.why[k] || 0) + 1;
    if (process.env.TRACE && sim.state.seed === 11 && sim.day < (+process.env.TRACE_DAYS || 300) && strat.name.startsWith(process.env.TRACE)) console.log('   COLLAPSE', c.kind, new Error().stack.split('\n').slice(3, 9).map((l) => l.trim().replace(/\(.*[\/]/, '(')).join(' < '));
  });
  if (process.env.ER_DETAIL) {
    const adv = sim.advance.bind(sim);
    sim.advance = (min, act) => {
      const prev = sim.log.doing;
      if (!sim.log.doing) sim.log.doing = act?.sleeping ? 'sleep' : act?.rates?.energy < -3 ? 'work' : act?.rates ? 'activity' : 'idle';
      const r = adv(min, act);
      sim.log.doing = prev;
      return r;
    };
  }
  return sim;
}

// ------------------------------------------------------------------ the bot
const cash = (sim) => sim.state.money.checking;

function eat(sim) {
  const st = sim.state;
  if (st.needs.hunger > 62) return;
  if (st.inventory.meals < 2 && cash(sim) > 80) buyGroceries(sim, cash(sim) > 400 ? 'week' : 'basic');
  if (st.inventory.meals < 1) foodBank(sim);
  if (st.inventory.meals > 0) doActivity(sim, 'cook', { atHome: true });
  else if (cash(sim) > 15) doActivity(sim, 'cafe_meal');
}

/** Let time pass in one-hour steps, eating when hungry (a person does not sit still and starve). */
function idle(sim, hours) {
  while (hours > 0.01) {
    // a person who is dead on their feet goes to bed early
    if (sim.state.needs.energy < 10) {
      eat(sim);
      hours -= sleep(sim, Math.min(8, Math.max(1, hours)), 1);
      continue;
    }
    const step = Math.min(1, hours);
    sim.advance(step * 60);
    hours -= step;
    if (sim.state.needs.hunger < 45) eat(sim);
  }
}

/** Work on whatever the next promotion (or the first job) needs. Returns true if time was spent. */
function improve(sim, strat) {
  const st = sim.state;
  const career = CAREER_BY_ID[strat.career];
  const level = st.job?.career === strat.career ? st.job.level + 1 : Math.max(0, sim.jobs.bestLevel(strat.career) + 1);
  const next = career.levels[Math.min(level, career.levels.length - 1)];
  const req = next.req || {};
  // 1) classes for a degree / licence we are enrolled in
  if (st.education.enrolled) {
    if (!sim.edu.classBlock()) {
      sim.edu.attendClass();
      return true;
    }
    return false;
  }
  // 2) enrol when a qualification is the blocker (student loan)
  const needsQual = (req.degree || req.cert) && sim.jobs.meets(req).missing.some((m) => /degree|certification|licence/.test(m));
  if (needsQual) {
    const ids = [...(req.cert || []), ...(req.degree || [])];
    const prog = PROGRAMS.filter((p) => ids.includes(p.id) && sim.edu.canEnroll(p.id).ok).sort((a, b) => a.tuition - b.tuition)[0];
    if (prog) {
      sim.edu.enroll(prog.id, cash(sim) > sim.edu.tuition(prog.id) * 2 ? 'cash' : 'loan');
      return false;
    }
  }
  // 3) skills: online course -> book -> practice
  const skills = Object.entries(req.skills || {}).filter(([s, v]) => skillLevel(st, s) < v).sort((a, b) => b[1] - skillLevel(st, b[0]) - (a[1] - skillLevel(st, a[0])));
  const target = skills[0]?.[0] || career.skill;
  if (skillLevel(st, target) >= 10) return false;
  const course = ONLINE.find((o) => o.skill === target && skillLevel(st, target) >= o.min && (sim.edu.onlineState(o.id)?.done ?? 0) < o.lessons);
  if (course) {
    if (!sim.edu.onlineState(course.id) && cash(sim) > course.price + 150) sim.edu.buyOnline(course.id);
    if (sim.edu.onlineState(course.id)) {
      const r = sim.edu.lesson(course.id);
      if (r && !r.blocked) return true;
    }
  }
  const book = BOOKS.find((b) => b.skill === target && (st.inventory.books[b.id] ?? 0) < b.sittings);
  if (book) {
    if (st.inventory.books[book.id] == null && cash(sim) > book.price + 100) sim.edu.buyBook(book.id);
    if (st.inventory.books[book.id] != null && sim.edu.readBook(book.id)) return true;
  }
  // courses and books run out around level 4: after that it takes a degree
  if (!course && !book && skillLevel(st, target) >= 3) {
    const prog = PROGRAMS.filter((p) => p.skills[target] >= 2 && sim.edu.canEnroll(p.id).ok).sort((a, b) => b.skills[target] / b.tuition - a.skills[target] / a.tuition)[0];
    if (prog && sim.loans.monthlyIncome() > 2500) {
      sim.edu.enroll(prog.id, cash(sim) > sim.edu.tuition(prog.id) * 1.5 ? 'cash' : 'loan');
      return false;
    }
  }
  if (target === 'coding') {
    if (!st.inventory.items.laptop && cash(sim) > 1000) {
      sim.finance.spend(650, 'shopping', 'Laptop');
      st.inventory.items.laptop = 1;
    }
    if (st.inventory.items.laptop) return doActivity(sim, 'code_practice').ok;
  }
  if (target === 'cooking' && st.inventory.meals > 0) return doActivity(sim, 'cook', { atHome: true }).ok;
  if (target === 'fitness') return doActivity(sim, 'workout').ok;
  return false;
}

function socialise(sim) {
  const rel = sim.rel;
  const all = rel.all;
  const day = sim.day;
  // talk to three people a day; hang out with the closest friend
  for (let i = 0; i < 3; i++) rel.talk(all[(day * 3 + i) % all.length].id, i === 1 ? 'compliment' : 'chat');
  const best = rel.known(1)[0];
  if (best && rel.rel(best.id).hangDay !== day) rel.hangout(best.id, 'walk');
}

function jobHunt(sim, strat) {
  const st = sim.state;
  const best = sim.jobs.bestLevel(strat.career);
  if (best < 0) {
    // not qualified for the target ladder yet: take any entry job to pay rent
    if (!st.job) for (const c of ['hospitality', 'trades']) if (!st.job && (st.jobLog.applied[c] ?? -9) < sim.day - 3) sim.jobs.resolveInterview(c, 0, [2, 1, 1]);
    return;
  }
  const better = !st.job || st.job.career !== strat.career ? true : false;
  if (better && (st.jobLog.applied[strat.career] ?? -9) < sim.day - 3) sim.jobs.resolveInterview(strat.career, best, strat.play == null ? [1, 1, 0] : [2, 2, 1]);
}

function money(sim, strat) {
  const st = sim.state;
  const m = st.money;
  const bills = sim.finance.monthlyBills().reduce((s, b) => s + b.amount, 0) + sim.loans.monthlyDebt();
  const buffer = bills * 1.5 + 300;
  // card first, then an emergency fund, then invest the rest
  if (st.credit.card?.balance > 0 && m.checking > buffer * 0.6) payCard(sim, m.checking - buffer * 0.6);
  if (m.savings < bills * 3 && m.checking > buffer) sim.finance.transfer('checking', 'savings', (m.checking - buffer) * 0.5);
  // invest a share of what is left over, once per paycheck
  if (strat.invest && m.checking > buffer && sim.day % 14 === 5) sim.market.buy('CITY500', (m.checking - buffer) * strat.invest);
  // housing: move up when rent stays under 30% of take-home
  const income = sim.loans.monthlyIncome();
  if (!st.home.owned && sim.day % 28 === 3) {
    for (const type of ['apartment', 'studio']) {
      const c = sim.re.moveInCost(type, st.home.districtId);
      if (st.home.type !== type && HOME_TIER[type] > HOME_TIER[st.home.type] && c.rent < income * 0.3 && m.checking > c.total + buffer) {
        sim.re.rentHome(type, st.home.districtId);
        break;
      }
    }
  }
  if (strat.property && sim.day % 28 === 5 && st.properties.length < 4) {
    const ls = [...st.listings].sort((a, b) => a.price - b.price)[0];
    if (ls) {
      const q = sim.re.mortgageQuote(ls.price, 0.2, 30);
      const liquid = m.checking + m.savings + sim.market.portfolioValue();
      if (q.approved && liquid > q.cash + buffer * 2) {
        // sell index fund / pull savings to fund the down payment
        if (m.checking < q.cash + buffer) sim.finance.transfer('savings', 'checking', m.savings);
        if (m.checking < q.cash + buffer && st.portfolio.holdings.CITY500) sim.market.sell('CITY500', 1);
        if (m.checking >= q.cash) sim.re.buy(ls.id, { downPct: 0.2, years: 30, use: 'rent' });
      }
    }
  }
  if (strat.business) {
    const biz = sim.biz;
    if (!biz.list.length && m.checking > biz.startCost(strat.business) + buffer * 2) biz.start(strat.business);
    for (const b of biz.list) {
      while (b.staff < biz.staffNeeded(b)) biz.hire(b.id);
      if (b.reputation < 70 && b.cash > biz.marketingCost(b) * 3) biz.market(b.id);
      if (b.level < BUSINESS.maxLevel && b.cash + Math.max(0, m.checking - buffer * 2) > biz.upgradeCost(b) * 1.2 && b.avgProfit > 0) biz.upgrade(b.id);
      if (b.cash > 4000 && b.level >= 3) biz.withdraw(b.id, b.cash - 3000);
      if (b.cash < 0 && m.checking > buffer * 2) biz.inject(b.id, Math.min(-b.cash + 500, m.checking - buffer));
    }
  }
}
const HOME_TIER = { couch: 0, room: 1, studio: 2, apartment: 3, condo: 4, townhouse: 5, house: 6, penthouse: 7 };

function playDay(sim, strat) {
  const st = sim.state;
  const trace = process.env.TRACE && strat.name.startsWith(process.env.TRACE) && sim.state.seed === 11 && sim.day < (+process.env.TRACE_DAYS || 300);
  if (trace) console.log(`d${sim.day} wake ${hourOf(st.time.total).toFixed(1)}h E${st.needs.energy.toFixed(0)} H${st.needs.hunger.toFixed(0)} ${st.home.type} comfort ${homeComfort(st).toFixed(2)} job ${st.job?.career || '-'}:${st.job?.level ?? '-'} enrolled ${!!st.education.enrolled}`);
  eat(sim);
  if (strat.social !== false && st.needs.hygiene < 60) doActivity(sim, 'shower', { atHome: true });
  jobHunt(sim, strat);
  // morning before the shift
  let info = sim.jobs.shiftInfo();
  if (info.status === 'early') {
    const spare = info.start - 1 - hourOf(st.time.total);
    if (strat.study && spare >= 1) improve(sim, strat);
    info = sim.jobs.shiftInfo();
    if (info.status === 'early') idle(sim, Math.max(0, info.start - 0.5 - hourOf(st.time.total)));
  }
  info = sim.jobs.shiftInfo();
  if (trace) console.log(`   shift @${hourOf(st.time.total).toFixed(1)} E${st.needs.energy.toFixed(1)} H${st.needs.hunger.toFixed(0)} status ${info.status}`);
  if (info.status === 'ready' || info.status === 'late') sim.jobs.workShift(strat.play);
  eat(sim);
  sim.events.decideNow(); // life events wait for a free moment, as the dialog does in the game
  // own business: put in a shift on days off or after work when there is energy
  if (strat.business) for (const b of sim.biz.list) if (!sim.biz.canWork(b) && st.needs.energy > 45) sim.biz.work(b.id);
  // evening: study, hustle, people, fun
  if (strat.study && st.needs.energy > 30) improve(sim, strat);
  if (strat.study && st.needs.energy > 40 && hourOf(st.time.total) < 21) improve(sim, strat);
  if (!st.job && st.needs.energy > 40 && !sim.hustles.blocked('delivery')) sim.hustles.run('delivery');
  if (strat.social) socialise(sim);
  if (st.needs.fun < 55) doActivity(sim, 'tv', { atHome: true });
  if (st.needs.fun < 40) doActivity(sim, 'game', { atHome: true });
  if (st.needs.hygiene < 70) doActivity(sim, 'shower', { atHome: true });
  eat(sim);
  money(sim, strat);
  // sleep until an hour and a half before work (7 AM on days off)
  const def = st.job ? sim.jobs.levelDef() : null;
  const wake = def ? Math.max(5, def.hours[0] - 1.5) : 7;
  let h = hoursUntil(st, wake);
  if (h > 9) {
    idle(sim, h - 8.5);
    h = hoursUntil(st, wake);
  }
  if (trace) console.log(`   bed ${hourOf(st.time.total).toFixed(1)}h E${st.needs.energy.toFixed(0)} sleep ${h.toFixed(1)}h ER ${sim.log.collapses}`);
  sleep(sim, h, 1);
  sim.log.mood += st.mood;
  sim.log.days++;
}

// --------------------------------------------------------------------- run
const pad = (s, n) => String(s).padEnd(n).slice(0, n);
const padL = (s, n) => String(s).padStart(n);
console.log(`\nPENNY TO PENTHOUSE — balance simulation · ${getCity(CITY).name} · ${YEARS} in-game years (${DAYS} days)\n`);
console.log(pad('Strategy', 22) + Array.from({ length: YEARS }, (_, i) => padL(`Year ${i + 1}`, 11)).join('') + padL('Salary', 11) + padL('Credit', 8) + padL('Mood', 6) + padL('ER', 7) + '  Final role');
console.log('-'.repeat(22 + YEARS * 11 + 30 + 28));

for (const strat of STRATEGIES) {
  // average three seeds so one lucky market does not decide the verdict
  const seeds = [11, 23, 47];
  const sums = Array(YEARS).fill(0);
  let last = null;
  let salary = 0;
  let score = 0;
  let mood = 0;
  let er = 0;
  for (const seed of seeds) {
    const sim = makeSim(strat, seed);
    for (let d = 0; d < DAYS; d++) {
      playDay(sim, strat);
      if ((d + 1) % 112 === 0) sums[(d + 1) / 112 - 1] += sim.finance.netWorth();
      if (process.env.BREAKDOWN && (d + 1) % 112 === 0 && seed === 11 && strat.name.startsWith(process.env.BREAKDOWN)) {
        const b = sim.finance.breakdown();
        const biz = sim.state.businesses.filter((x) => x.active).map((x) => `L${x.level} avg ${Math.round(x.avgProfit)}/d cash ${Math.round(x.cash)}`).join('; ');
        console.log(`   y${(d + 1) / 112}`, Object.entries(b).map(([k, v]) => `${k} ${Math.round(v / 1000)}K`).join(' '), '| salary', Math.round(sim.jobs.annualSalary() / 1000) + 'K', '|', biz);
      }
    }
    last = sim;
    salary += sim.jobs.annualSalary();
    score += sim.state.credit.score;
    mood += sim.log.mood / sim.log.days;
    er += sim.log.collapses;
    if (process.env.ER_DETAIL && sim.log.collapses) console.log('   ', strat.name, seed, JSON.stringify(sim.log.why));
  }
  const n = seeds.length;
  const st = last.state;
  const role = (last.jobs.title() || 'Unemployed') + (st.businesses.some((b) => b.active) ? ` + ${st.businesses.filter((b) => b.active).map((b) => `L${b.level} biz`).join(', ')}` : '') + (st.properties.length ? ` + ${st.properties.length} propert${st.properties.length > 1 ? 'ies' : 'y'}` : '');
  console.log(pad(strat.name, 22) + sums.map((s) => padL(fmtMoney(s / n, { compact: true }), 11)).join('') + padL(fmtMoney(salary / n, { compact: true }), 11) + padL(Math.round(score / n), 8) + padL(Math.round(mood / n), 6) + padL((er / n).toFixed(1), 7) + '  ' + role);
}
console.log('\nSalary = final annual salary · Credit = final score · Mood = average · ER = collapses (avg of 3 runs).');
console.log('Targets: early game tight (year 1 under ~$15K for most), mid game choices matter, a focused player can approach $1M by year 8.\n');
