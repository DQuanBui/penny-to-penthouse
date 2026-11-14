// Entrepreneur path: start a business, staff it, work in it, market it,
// upgrade it, take profits out — or watch it fail.
import { BUSINESS_TYPES, BUSINESS_BY_ID, BUSINESS as B } from '../data/businesses.js';
import { clamp, fmtMoney } from '../core/utils.js';
import { bonus, addSkill } from './Player.js';
import { moodFactor } from './Needs.js';
import { adjustScore } from './Credit.js';
import { hourOf } from '../core/Clock.js';

export class Businesses {
  constructor(sim) {
    this.sim = sim;
  }
  get list() {
    return this.sim.state.businesses.filter((b) => b.active);
  }
  type(b) {
    return BUSINESS_BY_ID[b.type];
  }

  startCost(typeId) {
    return Math.round(BUSINESS_BY_ID[typeId].cost * (0.7 + 0.3 * (this.sim.city.priceIndex || 1)));
  }

  start(typeId, name) {
    const sim = this.sim;
    const st = sim.state;
    const t = BUSINESS_BY_ID[typeId];
    if (this.list.length >= B.maxOwned) return null;
    const cost = this.startCost(typeId);
    if (!sim.finance.spend(cost, 'biz_cost', `Startup capital — ${t.name}`, { credit: false })) return null;
    const b = { id: 'B' + (st.flags.bizId = (st.flags.bizId || 0) + 1), type: typeId, name: name || t.name, level: 1, invested: cost, cash: Math.round(cost * 0.12), staff: 0, reputation: 30, avgProfit: 0, history: [], value: cost * 0.6, active: true, opened: sim.day, workedDay: -1, total: 0 };
    st.businesses.push(b);
    sim.bus.emit('toast', { icon: t.icon, title: `${b.name} is open for business`, text: 'Work in it, hire staff and build its reputation. Check Ventures on your phone.', kind: 'good', long: true });
    sim.bus.emit('bizStarted', { type: typeId });
    return b;
  }

  staffNeeded(b) {
    return b.level;
  }
  wage() {
    return Math.round(B.staffWage * (this.sim.city.salaryIndex || 1));
  }

  /** Owner skill fit 0.45..1.55 */
  skillFactor(b) {
    const st = this.sim.state;
    const t = this.type(b);
    let sum = 0;
    let w = 0;
    for (const s in t.skills) {
      sum += (st.skills[s] || 0) * t.skills[s];
      w += t.skills[s];
    }
    return 0.45 + 0.11 * (sum / w);
  }

  /** Expected daily profit right now (no randomness), for the UI. */
  expectedProfit(b, worked = false) {
    return this.dayProfit(b, worked, 1);
  }

  dayProfit(b, worked, rnd) {
    const sim = this.sim;
    const st = sim.state;
    const t = this.type(b);
    const city = sim.city;
    const need = this.staffNeeded(b);
    const hands = b.staff + (worked ? 1 : 0);
    const staffF = Math.min(1, 0.4 + 0.6 * (hands / need)) + (worked ? 0.25 : 0);
    const repF = 0.5 + b.reputation / 100;
    const demand = Math.sqrt(city.salaryIndex || 1) * (city.priceIndex || 1) * (city.industries?.entrepreneur || 1);
    const regime = { recession: 0.72, bear: 0.9, normal: 1, bull: 1.08, boom: 1.22 }[st.market?.regime || 'normal'] || 1;
    let gross = t.base * Math.pow(B.levelGrowth, b.level - 1) * this.skillFactor(b) * repF * staffF * demand * regime * rnd;
    if (t.fame) gross *= 0.8 + st.social.popularity / 60;
    if (t.perProperty) gross += t.perProperty * st.properties.length * b.level;
    const costs = b.staff * this.wage() + t.base * B.fixedCost * Math.pow(1.45, b.level - 1) * (city.priceIndex || 1);
    return gross - costs;
  }

  /** Put in a 4-hour shift yourself. */
  canWork(b) {
    const h = hourOf(this.sim.state.time.total);
    if (b.workedDay === this.sim.day) return 'You already worked here today.';
    if (h < 7 || h > 20) return 'Open 7 AM – 8 PM.';
    return null;
  }
  work(id) {
    const sim = this.sim;
    const b = this.list.find((x) => x.id === id);
    if (!b || this.canWork(b)) return null;
    const mf = moodFactor(sim.state);
    sim.advance(B.workHours * 60, { rates: { energy: -3, fun: -1, social: 2, hunger: 1.5 } });
    b.workedDay = sim.day;
    b.reputation = clamp(b.reputation + 1.4 * mf, 0, 100);
    const t = this.type(b);
    for (const s in t.skills) addSkill(sim, s, 0.12 * t.skills[s]);
    return { rep: b.reputation };
  }

  hire(id) {
    const b = this.list.find((x) => x.id === id);
    if (!b || b.staff >= b.level + 1) return false;
    b.staff++;
    return true;
  }
  fire(id) {
    const b = this.list.find((x) => x.id === id);
    if (!b || b.staff <= 0) return false;
    b.staff--;
    b.reputation = clamp(b.reputation - 2, 0, 100);
    return true;
  }

  marketingCost(b) {
    return B.marketingCost * b.level;
  }
  market(id) {
    const b = this.list.find((x) => x.id === id);
    if (!b || b.cash < this.marketingCost(b)) return false;
    b.cash -= this.marketingCost(b);
    b.reputation = clamp(b.reputation + B.marketingRep, 0, 100);
    return true;
  }

  upgradeCost(b) {
    return Math.round(this.type(b).cost * B.upgradeCost * b.level);
  }
  /** Pay from the business account first, then from checking. */
  upgrade(id) {
    const sim = this.sim;
    const b = this.list.find((x) => x.id === id);
    if (!b || b.level >= B.maxLevel) return false;
    const cost = this.upgradeCost(b);
    const fromBiz = Math.min(Math.max(0, b.cash), cost);
    if (cost - fromBiz > 0 && !sim.finance.spend(cost - fromBiz, 'biz_cost', `Expansion — ${b.name}`, { credit: false })) return false;
    b.cash -= fromBiz;
    b.invested += cost;
    b.level++;
    sim.bus.emit('toast', { icon: this.type(b).icon, title: `${b.name} expanded to level ${b.level}`, text: 'Bigger operation, bigger numbers — and it needs more staff.', kind: 'good', long: true });
    sim.bus.emit('bizLevel', { level: b.level });
    return true;
  }

  /** Owner's draw: business cash -> checking (taxed as business income). */
  withdraw(id, amount) {
    const b = this.list.find((x) => x.id === id);
    if (!b) return 0;
    amount = Math.floor(Math.min(amount, b.cash));
    if (amount <= 0) return 0;
    b.cash -= amount;
    return this.sim.finance.earnTaxed(amount, 'business', `Owner's draw — ${b.name}`);
  }
  inject(id, amount) {
    const b = this.list.find((x) => x.id === id);
    if (!b || !this.sim.finance.spend(amount, 'biz_cost', `Capital injection — ${b.name}`, { credit: false })) return false;
    b.cash += amount;
    return true;
  }

  valueOf(b) {
    const t = this.type(b);
    return Math.max(0, Math.round(Math.max(t.cost * 0.5 * Math.pow(b.level, 0.8), b.avgProfit * 28 * B.sellMultiple) + Math.max(0, b.cash)));
  }
  sell(id, price) {
    const sim = this.sim;
    const b = this.list.find((x) => x.id === id);
    if (!b) return 0;
    const proceeds = Math.round(price ?? this.valueOf(b) * 0.9);
    b.active = false;
    sim.finance.earnTaxed(proceeds, 'business', `Sold ${b.name}`);
    sim.bus.emit('bizSold', { proceeds });
    return proceeds;
  }

  daily(sim, day) {
    const st = sim.state;
    for (const b of this.list) {
      const t = this.type(b);
      const worked = b.workedDay === day - 1;
      const luck = bonus(st, 'bizLuck');
      const rnd = 1 + (sim.rng() - 0.45 + luck) * 2 * t.vol;
      const profit = this.dayProfit(b, worked, rnd);
      b.cash += profit;
      b.total += profit;
      b.avgProfit = b.avgProfit * 0.9 + profit * 0.1;
      b.history.push(Math.round(profit));
      if (b.history.length > 60) b.history.shift();
      // reputation drifts with how well the place is run
      const need = this.staffNeeded(b);
      const hands = b.staff + (worked ? 1 : 0);
      b.reputation = clamp(b.reputation + (hands >= need ? 0.35 : -0.6) + (this.skillFactor(b) > 1 ? 0.2 : -0.1), 0, 100);
      b.value = this.valueOf(b);
      if (b.cash < -t.cost * B.bankruptAt) {
        b.active = false;
        adjustScore(sim, -40);
        sim.bus.emit('toast', { icon: '💥', title: `${b.name} went under`, text: 'The business ran out of money and closed. Painful — and a lesson every founder learns once.', kind: 'bad', long: true });
        sim.bus.emit('bizFailed', {});
      } else if (b.cash < 0 && day % 5 === 0) sim.bus.emit('toast', { icon: t.icon, title: `${b.name} is losing money`, text: `Account ${fmtMoney(b.cash)}. Work shifts, hire staff, market it — or add capital.`, kind: 'bad' });
    }
  }
}

export { BUSINESS_TYPES };
