// Credit score (300–850) and the credit card.
import { BALANCE } from '../data/balance.js';
import { clamp, fmtMoney } from '../core/utils.js';

const C = BALANCE.credit;

export const creditLabel = (s) => (s >= 800 ? 'Exceptional' : s >= 740 ? 'Very good' : s >= 670 ? 'Good' : s >= 580 ? 'Fair' : 'Poor');
export const creditColor = (s) => (s >= 740 ? '#4fd18b' : s >= 670 ? '#a8d84f' : s >= 580 ? '#ffb347' : '#ff6b6b');

export function adjustScore(sim, delta) {
  const c = sim.state.credit;
  c.score = clamp(Math.round(c.score + delta), C.min, C.max);
}

/** Payment behaviour is the biggest driver of the score. */
export function creditEvent(sim, kind) {
  const c = sim.state.credit;
  if (kind === 'onTime') {
    c.onTime++;
    // gains taper off as the score rises
    adjustScore(sim, C.onTime * (1 - (c.score - C.min) / (C.max - C.min)) + 0.5);
  } else if (kind === 'missed') {
    c.missed++;
    adjustScore(sim, C.missed);
  } else if (kind === 'inquiry') {
    c.inquiries++;
    adjustScore(sim, C.hardInquiry);
  }
}

export function utilization(state) {
  const card = state.credit.card;
  return card && card.limit > 0 ? card.balance / card.limit : 0;
}

/** Limit the bank would offer right now. */
export function cardOffer(sim) {
  const st = sim.state;
  const score = st.credit.score;
  if (score < 560) return null;
  const income = sim.jobs ? sim.jobs.annualSalary() : 0;
  const limit = Math.round((C.cardLimitBase + income * 0.08) * (0.5 + (score - 560) / 290) / 100) * 100;
  const apr = Math.max(0.149, C.cardAPR - (score - 640) * 0.0004);
  return { limit: Math.max(500, limit), apr: Math.round(apr * 1000) / 1000 };
}

export function openCard(sim) {
  const st = sim.state;
  if (st.credit.card) return false;
  const offer = cardOffer(sim);
  if (!offer) return false;
  creditEvent(sim, 'inquiry');
  st.credit.card = { limit: offer.limit, apr: offer.apr, balance: 0, opened: Math.floor(st.time.total), minDue: 0 };
  sim.bus.emit('toast', { icon: '💳', title: 'Credit card approved', text: `Limit ${fmtMoney(offer.limit)} at ${(offer.apr * 100).toFixed(1)}% APR. Pay it in full to build credit for free.`, kind: 'good', long: true });
  return true;
}

export function payCard(sim, amount) {
  const st = sim.state;
  const card = st.credit.card;
  if (!card) return false;
  amount = Math.min(amount, card.balance, Math.max(0, st.money.checking));
  if (amount <= 0) return false;
  st.money.checking -= amount;
  card.balance -= amount;
  card.paidThisMonth = (card.paidThisMonth || 0) + amount;
  st.money.txs.unshift({ id: st.money.nextTx++, t: Math.floor(st.time.total), amount: 0, cat: 'transfer', label: `Card payment ${fmtMoney(amount)}`, account: 'card' });
  sim.bus.emit('money', {});
  return true;
}

/** Monthly statement: interest on what is carried, minimum payment check, score drift. */
export function creditMonthly(sim) {
  const st = sim.state;
  const c = st.credit;
  c.months++;
  const card = c.card;
  if (card) {
    const util = utilization(st);
    if (card.minDue > 0) {
      if ((card.paidThisMonth || 0) + 0.01 >= card.minDue) creditEvent(sim, 'onTime');
      else {
        creditEvent(sim, 'missed');
        const fee = 29;
        card.balance += fee;
        sim.finance.record(-fee, 'fees', 'Card late fee', 'card');
        sim.bus.emit('toast', { icon: '💳', title: 'Card payment missed', text: 'A late fee was added and your credit score dropped.', kind: 'bad' });
      }
    }
    if (card.balance > 0) {
      const interest = Math.round(card.balance * (card.apr / 12) * 100) / 100;
      card.balance += interest;
      sim.finance.record(-interest, 'fees', 'Credit card interest', 'card');
    }
    card.minDue = card.balance > 0 ? Math.max(25, Math.round(card.balance * C.cardMinPayment)) : 0;
    card.paidThisMonth = 0;
    if (util < C.utilizationGood) adjustScore(sim, 3);
    else if (util > C.utilizationBad) adjustScore(sim, -9);
    else if (util > 0.5) adjustScore(sim, -3);
    if (card.minDue > 0) sim.bus.emit('toast', { icon: '💳', title: 'Card statement', text: `Balance ${fmtMoney(card.balance)} · minimum ${fmtMoney(card.minDue)} due this month.`, kind: 'info' });
    // limit grows with good history
    if (c.score >= 700 && c.months % 4 === 0) card.limit = Math.round((card.limit * 1.15) / 100) * 100;
  }
  adjustScore(sim, C.ageBonusPerMonth);
}
