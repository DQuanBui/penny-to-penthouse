// Money: accounts, transactions, monthly budget, recurring bills, net worth.
import { BALANCE } from '../data/balance.js';
import { calendar, dayOf } from '../core/Clock.js';
import { HOME_BY_ID, rentFor } from '../data/homes.js';
import { fmtMoney } from '../core/utils.js';
import { creditEvent } from './Credit.js';
import { VEHICLE_BY_ID } from '../data/vehicles.js';

export const CATEGORIES = {
  // income
  salary: { name: 'Salary', icon: '💼', income: true },
  tips: { name: 'Tips & bonuses', icon: '💵', income: true },
  hustle: { name: 'Side hustles', icon: '🛵', income: true },
  business: { name: 'Business', icon: '🏪', income: true },
  rent_income: { name: 'Rent collected', icon: '🔑', income: true },
  investment: { name: 'Investments', icon: '📈', income: true },
  gift: { name: 'Gifts & windfalls', icon: '🎁', income: true },
  other_in: { name: 'Other income', icon: '➕', income: true },
  // expenses
  rent: { name: 'Rent & mortgage', icon: '🏠' },
  utilities: { name: 'Utilities', icon: '💡' },
  phone: { name: 'Phone & subscriptions', icon: '📱' },
  food: { name: 'Food', icon: '🍔' },
  transit: { name: 'Transit & car', icon: '🚇' },
  shopping: { name: 'Shopping', icon: '🛍️' },
  health: { name: 'Health', icon: '🏥' },
  education: { name: 'Education', icon: '🎓' },
  insurance: { name: 'Insurance', icon: '🛡️' },
  loan: { name: 'Loan payments', icon: '🏦' },
  fun: { name: 'Fun & social', icon: '🎉' },
  housing: { name: 'Home & property', icon: '🔧' },
  biz_cost: { name: 'Business costs', icon: '📦' },
  fees: { name: 'Fees & interest', icon: '⚠️' },
  other: { name: 'Other', icon: '➖' },
};

export const isPayday = (day) => day % 14 === 4; // every other Friday
export const isBillDay = (day) => day > 0 && day % 28 === BALANCE.bills.dueDay - 1;
export const isMidBillDay = (day) => day % 28 === BALANCE.bills.midDay - 1;
export function nextDayMatching(day, fn) {
  for (let d = day + 1; d < day + 60; d++) if (fn(d)) return d;
  return day + 1;
}

export class Finance {
  constructor(sim) {
    this.sim = sim;
  }
  get m() {
    return this.sim.state.money;
  }

  /** Record a signed transaction and update budget + lifetime stats. */
  record(amount, cat, label, account = 'checking') {
    const st = this.sim.state;
    const m = st.money;
    amount = Math.round(amount * 100) / 100;
    if (!amount) return;
    m.txs.unshift({ id: m.nextTx++, t: Math.floor(st.time.total), amount, cat, label, account });
    if (m.txs.length > 160) m.txs.length = 160;
    const month = calendar(st.time.total).month;
    const b = (m.budget[month] ||= { inc: {}, exp: {} });
    if (amount > 0) {
      b.inc[cat] = (b.inc[cat] || 0) + amount;
      st.stats.totalEarned += amount;
    } else {
      b.exp[cat] = (b.exp[cat] || 0) - amount;
      st.stats.totalSpent -= amount;
    }
    // keep only the last 8 months of budget detail
    const keys = Object.keys(m.budget);
    if (keys.length > 8) delete m.budget[keys[0]];
    this.sim.bus.emit('money', { amount, cat, label });
  }

  earn(amount, cat, label) {
    if (amount <= 0) return 0;
    this.m.checking += amount;
    this.record(amount, cat, label);
    return amount;
  }

  /** Gig / business income with flat withholding. Returns the net amount. */
  earnTaxed(gross, cat, label) {
    const tax = Math.round(gross * BALANCE.tax.sideIncomeRate);
    this.sim.state.stats.taxesPaid += tax;
    return this.earn(gross - tax, cat, label);
  }

  cardRoom() {
    const c = this.sim.state.credit.card;
    return c ? Math.max(0, c.limit - c.balance) : 0;
  }
  /** Money the player can spend right now (checking + unused credit). */
  available() {
    return Math.max(0, this.m.checking) + this.cardRoom();
  }
  canPay(amount) {
    return this.available() >= amount - 0.005;
  }

  /**
   * Voluntary purchase. Uses checking first, then the credit card.
   * @returns true when paid
   */
  spend(amount, cat, label, opts = {}) {
    amount = Math.round(amount * 100) / 100;
    if (amount <= 0) return true;
    const m = this.m;
    if (m.checking >= amount) {
      m.checking -= amount;
      this.record(-amount, cat, label);
      return true;
    }
    const card = this.sim.state.credit.card;
    if (opts.credit !== false && card && card.limit - card.balance >= amount) {
      card.balance += amount;
      this.record(-amount, cat, label + ' (card)', 'card');
      return true;
    }
    if (!opts.silent) this.sim.bus.emit('toast', { icon: '💸', title: 'Not enough money', text: `${label} costs ${fmtMoney(amount)}.`, kind: 'bad' });
    return false;
  }

  /**
   * A bill: checking, then savings, then the card. No overdraft.
   * @returns true when fully paid, false when missed
   */
  payBill(amount, cat, label) {
    const m = this.m;
    amount = Math.round(amount * 100) / 100;
    if (amount <= 0) return true;
    if (m.checking + m.savings < amount) {
      const card = this.sim.state.credit.card;
      const need = amount - Math.max(0, m.checking) - m.savings;
      if (!card || card.limit - card.balance < need) return false;
      card.balance += need;
      this.record(-need, cat, label + ' (card)', 'card');
      amount -= need;
      if (amount <= 0) return true;
    }
    if (m.checking < amount) {
      const pull = amount - Math.max(0, m.checking);
      m.savings -= pull;
      m.checking += pull;
      this.sim.bus.emit('toast', { icon: '🏦', title: 'Savings tapped', text: `${fmtMoney(pull)} moved from savings to cover ${label}.`, kind: 'warn' });
    }
    m.checking -= amount;
    this.record(-amount, cat, label);
    return true;
  }

  /** Unavoidable charge (medical...). May overdraw checking, with a fee. */
  charge(amount, cat, label) {
    if (this.payBill(amount, cat, label)) return;
    const m = this.m;
    m.checking -= amount;
    this.record(-amount, cat, label);
    if (m.checking < 0) {
      m.checking -= BALANCE.bank.overdraftFee;
      this.record(-BALANCE.bank.overdraftFee, 'fees', 'Overdraft fee');
      this.sim.bus.emit('toast', { icon: '⚠️', title: 'Overdrawn', text: `Your account is negative. A ${fmtMoney(BALANCE.bank.overdraftFee)} fee was added.`, kind: 'bad' });
    }
  }

  /**
   * Money moving between cash and an asset (investments, property, deposits).
   * Shown in the activity list but kept out of the budget and earned/spent stats.
   * @returns false when a negative amount is not covered by checking
   */
  assetTx(amount, label) {
    const m = this.m;
    amount = Math.round(amount * 100) / 100;
    if (amount < 0 && m.checking < -amount - 0.005) {
      this.sim.bus.emit('toast', { icon: '💸', title: 'Not enough money', text: `${label} needs ${fmtMoney(-amount)} in checking.`, kind: 'bad' });
      return false;
    }
    m.checking += amount;
    m.txs.unshift({ id: m.nextTx++, t: Math.floor(this.sim.state.time.total), amount, cat: 'asset', label, account: 'checking' });
    if (m.txs.length > 160) m.txs.length = 160;
    this.sim.bus.emit('money', { amount, cat: 'asset', label });
    return true;
  }

  transfer(from, to, amount) {
    const m = this.m;
    amount = Math.floor(Math.min(amount, m[from]) * 100) / 100;
    if (amount <= 0) return false;
    m[from] -= amount;
    m[to] += amount;
    m.txs.unshift({ id: m.nextTx++, t: Math.floor(this.sim.state.time.total), amount: 0, cat: 'transfer', label: `Transfer ${fmtMoney(amount)} → ${to}`, account: to });
    this.sim.bus.emit('money', {});
    return true;
  }

  // ------------------------------------------------------------ net worth
  breakdown() {
    const st = this.sim.state;
    const cash = st.money.checking + st.money.savings;
    let investments = 0;
    const prices = st.market?.prices || {};
    for (const sym in st.portfolio.holdings) investments += st.portfolio.holdings[sym].qty * (prices[sym] ?? st.portfolio.holdings[sym].avg);
    let property = 0;
    for (const p of st.properties) property += p.value;
    let vehicles = 0;
    for (const v of st.vehicles) vehicles += v.value;
    let business = 0;
    for (const b of st.businesses) if (b.active) business += b.value || 0;
    let debt = st.credit.card ? st.credit.card.balance : 0;
    for (const l of st.loans) debt += l.balance;
    return { cash, investments, property, vehicles, business, debt, total: cash + investments + property + vehicles + business - debt };
  }
  netWorth() {
    return this.breakdown().total;
  }

  // -------------------------------------------------------------- bills
  /** Recurring monthly bills as [{label, amount, cat, when:'first'|'mid'}]. */
  monthlyBills() {
    const st = this.sim.state;
    const city = this.sim.city;
    const pi = city.priceIndex || 1;
    const B = BALANCE.bills;
    const out = [];
    const home = st.home;
    const ht = HOME_BY_ID[home.type];
    // a roommate covers 45% of the rent
    if (!home.owned && home.rent > 0) out.push({ label: `Rent — ${ht.name}${home.roommate ? ' (your share)' : ''}`, amount: Math.round(home.rent * (home.roommate ? 0.55 : 1)), cat: 'rent', when: 'first', rent: true });
    out.push({ label: 'Utilities', amount: Math.round(BALANCE.housing.utilitiesPerRoom * Math.max(1, ht.tier) * pi * (home.type === 'couch' ? 0.4 : 1)), cat: 'utilities', when: 'first' });
    out.push({ label: 'Phone plan', amount: Math.round(B.phone * pi), cat: 'phone', when: 'mid' });
    const insured = st.job && st.job.level >= 2;
    if (!insured) out.push({ label: 'Health insurance', amount: Math.round(B.healthInsurance * pi), cat: 'insurance', when: 'mid' });
    if (!home.owned && home.type !== 'couch') out.push({ label: "Renter's insurance", amount: B.rentersInsurance, cat: 'insurance', when: 'mid' });
    for (const v of st.vehicles) out.push({ label: `Car insurance & fuel — ${VEHICLE_BY_ID[v.model]?.name || 'car'}`, amount: Math.round((VEHICLE_BY_ID[v.model]?.upkeep || 150) * pi), cat: 'transit', when: 'mid' });
    for (const e of st.bills.extras) out.push({ label: e.label, amount: e.amount, cat: e.cat || 'other', when: 'first', extra: e });
    for (const s of st.bills.subscriptions) out.push({ label: s.label, amount: s.amount, cat: s.cat || 'phone', when: 'mid' });
    return out;
  }

  chargeBills(when) {
    const st = this.sim.state;
    const bus = this.sim.bus;
    let total = 0;
    let missed = 0;
    for (const b of this.monthlyBills()) {
      if (b.when !== when) continue;
      if (this.payBill(b.amount, b.cat, b.label)) {
        total += b.amount;
        if (b.extra?.once) b.extra.paid = true;
        if (b.rent) {
          st.bills.missedRent = 0;
          creditEvent(this.sim, 'onTime');
        }
      } else {
        missed++;
        creditEvent(this.sim, 'missed');
        if (b.rent) {
          st.bills.missedRent++;
          const fee = Math.round(b.amount * BALANCE.housing.lateFee);
          st.bills.extras.push({ label: 'Late rent + fee', amount: b.amount + fee, cat: 'rent', once: true });
          bus.emit('toast', { icon: '🚨', title: 'Rent missed!', text: `You could not pay ${fmtMoney(b.amount)}. It is added to next month with a ${fmtMoney(fee)} late fee, and your credit took a hit.`, kind: 'bad', long: true });
          if (st.bills.missedRent >= BALANCE.housing.evictAfterMissed) this.evict();
        } else bus.emit('toast', { icon: '⚠️', title: `${b.label} missed`, text: 'Not enough money. Your credit score dropped.', kind: 'bad' });
      }
    }
    // one-off extras are cleared once charged
    st.bills.extras = st.bills.extras.filter((e) => !(e.once && e.paid));
    if (total > 0) bus.emit('toast', { icon: '🧾', title: when === 'first' ? 'Rent & bills paid' : 'Monthly bills paid', text: `${fmtMoney(total)} left your account.`, kind: missed ? 'warn' : 'info' });
  }
  evict() {
    const st = this.sim.state;
    const city = this.sim.city;
    const d = city.districts.find((x) => x.id === st.home.districtId) || city.districts[0];
    st.home = { type: 'couch', districtId: d.id, rent: rentFor('couch', city, d), owned: false, propertyId: null, layout: null, furniture: null, styleScore: 0 };
    st.bills.missedRent = 0;
    st.bills.extras = st.bills.extras.filter((e) => !e.once);
    this.sim.bus.emit('toast', { icon: '📦', title: 'Evicted', text: 'Two missed rents. A friend lets you crash on their couch while you get back on your feet.', kind: 'bad', long: true });
    this.sim.bus.emit('homeChanged', {});
  }

  // ----------------------------------------------------------- periodic
  daily() {
    const st = this.sim.state;
    const day = dayOf(st.time.total);
    if (isBillDay(day)) this.chargeBills('first');
    if (isMidBillDay(day)) this.chargeBills('mid');
    if (day % 28 === 0 && day > 0) this.monthly();
    // net-worth history (one point per day, capped)
    const nw = this.netWorth();
    st.money.history.push({ d: day, v: Math.round(nw) });
    if (st.money.history.length > 400) st.money.history.splice(0, st.money.history.length - 400);
    if (nw > st.stats.maxNetWorth) st.stats.maxNetWorth = nw;
    // heads-up the day before rent
    if (isBillDay(day + 1)) {
      const due = this.monthlyBills().filter((b) => b.when === 'first').reduce((s, b) => s + b.amount, 0);
      const have = st.money.checking + st.money.savings;
      this.sim.bus.emit('toast', { icon: '📅', title: 'Rent is due tomorrow', text: `${fmtMoney(due)} will be charged. You have ${fmtMoney(have)}.`, kind: have >= due ? 'info' : 'bad', long: true });
    }
  }

  monthly() {
    const m = this.m;
    if (m.savings > 0) {
      const interest = Math.round(m.savings * (BALANCE.bank.savingsAPY / 12) * 100) / 100;
      if (interest >= 0.01) {
        m.savings += interest;
        this.record(interest, 'investment', 'Savings interest', 'savings');
      }
    }
  }
}
