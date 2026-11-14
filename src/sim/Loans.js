// Amortised loans: student, auto, personal, mortgage. Monthly payments split
// into interest and principal; missed payments hurt the credit score.
import { BALANCE } from '../data/balance.js';
import { fmtMoney } from '../core/utils.js';
import { creditEvent } from './Credit.js';

const L = BALANCE.loans;
export const LOAN_META = {
  student: { icon: '🎓', name: 'Student loan' },
  auto: { icon: '🚗', name: 'Auto loan' },
  personal: { icon: '🤝', name: 'Personal loan' },
  mortgage: { icon: '🏠', name: 'Mortgage' },
};

/** Fixed monthly payment for principal P at annual rate apr over n months. */
export function amortPayment(P, apr, n) {
  const r = apr / 12;
  if (r <= 0) return P / n;
  return (P * r) / (1 - Math.pow(1 + r, -n));
}

export class Loans {
  constructor(sim) {
    this.sim = sim;
  }
  get list() {
    return this.sim.state.loans;
  }

  aprFor(kind, score = this.sim.state.credit.score) {
    return Math.max(0.025, L[kind].apr + (700 - score) * L.scoreAprSlope);
  }

  /** Monthly take-home income lenders count. */
  monthlyIncome() {
    const sim = this.sim;
    let m = sim.jobs ? (sim.jobs.annualSalary() * 0.78) / 12 : 0;
    for (const p of sim.state.properties) if (p.rented) m += p.rent * 0.75;
    for (const b of sim.state.businesses) if (b.active) m += Math.max(0, b.avgProfit || 0) * 28 * 0.6;
    return m;
  }
  monthlyDebt() {
    return this.list.reduce((s, l) => s + l.payment, 0) + (this.sim.state.credit.card?.minDue || 0);
  }

  /**
   * Quote a loan. opts: { years }
   * @returns { approved, reason, apr, months, payment }
   */
  quote(kind, amount, opts = {}) {
    const st = this.sim.state;
    const apr = this.aprFor(kind);
    const months = Math.round((opts.years || L[kind].years) * 12);
    const payment = amortPayment(amount, apr, months);
    let approved = true;
    let reason = '';
    if (kind !== 'student') {
      const min = L.minScore[kind] || 0;
      const income = this.monthlyIncome();
      if (st.credit.score < min) (approved = false), (reason = `Credit score ${st.credit.score} is below the ${min} this loan needs.`);
      else if (income <= 0) (approved = false), (reason = 'Lenders want to see steady income first.');
      else if ((this.monthlyDebt() + payment) / income > L.maxDTI) (approved = false), (reason = `The payment (${fmtMoney(payment)}/mo) is too large for your income.`);
    }
    return { approved, reason, apr, months, payment };
  }

  /** Create a loan. cash=true deposits the money; false means it paid for something directly. */
  take(kind, amount, label, opts = {}) {
    const st = this.sim.state;
    const q = this.quote(kind, amount, opts);
    const loan = {
      id: 'L' + (st.flags.loanId = (st.flags.loanId || 0) + 1),
      kind, label: label || LOAN_META[kind].name, icon: LOAN_META[kind].icon,
      principal: amount, balance: amount, apr: opts.apr ?? q.apr, payment: Math.round(q.payment * 100) / 100, monthsLeft: q.months, propertyId: opts.propertyId || null,
    };
    st.loans.push(loan);
    if (opts.cash) this.sim.finance.earn(amount, 'other_in', `${loan.label} funds`);
    if (!opts.existing && kind !== 'student') creditEvent(this.sim, 'inquiry');
    return loan;
  }

  /** Pay extra principal (or pay the loan off). */
  payExtra(id, amount) {
    const st = this.sim.state;
    const l = st.loans.find((x) => x.id === id);
    if (!l) return 0;
    amount = Math.min(amount, l.balance, Math.max(0, st.money.checking));
    if (amount <= 0) return 0;
    st.money.checking -= amount;
    this.sim.finance.record(-amount, 'loan', `${l.label} — extra payment`);
    l.balance -= amount;
    if (l.balance <= 0.5) this.close(l);
    else l.monthsLeft = Math.max(1, Math.ceil(Math.log(l.payment / (l.payment - (l.balance * l.apr) / 12)) / Math.log(1 + l.apr / 12)) || l.monthsLeft);
    return amount;
  }

  close(l) {
    const st = this.sim.state;
    st.loans = st.loans.filter((x) => x !== l);
    this.sim.bus.emit('toast', { icon: '🎉', title: `${l.label} paid off!`, text: 'One less payment every month.', kind: 'good', long: true });
    this.sim.bus.emit('loanPaid', { kind: l.kind });
  }

  /** Charge every loan's monthly payment. */
  monthly() {
    const sim = this.sim;
    for (const l of [...this.list]) {
      const interest = (l.balance * l.apr) / 12;
      const due = Math.min(l.payment, l.balance + interest);
      if (sim.finance.payBill(due, 'loan', `${l.label} payment`)) {
        l.balance = Math.max(0, l.balance + interest - due);
        l.monthsLeft = Math.max(0, l.monthsLeft - 1);
        l.missed = 0;
        creditEvent(sim, 'onTime');
        if (l.balance <= 0.5) this.close(l);
      } else {
        l.balance += interest + 35;
        l.missed = (l.missed || 0) + 1;
        creditEvent(sim, 'missed');
        sim.bus.emit('toast', { icon: '🏦', title: `${l.label}: payment missed`, text: `Interest and a late fee were added. Your credit score dropped.`, kind: 'bad', long: true });
        sim.bus.emit('loanMissed', { loan: l });
      }
    }
  }

  /** Turn an archetype's starting debt into a real loan / card balance. */
  applyStartingDebt() {
    const st = this.sim.state;
    const d = st.flags.pendingDebt;
    if (!d) return;
    delete st.flags.pendingDebt;
    if (d.type === 'card') {
      st.credit.card = { limit: Math.max(2000, Math.ceil((d.amount * 1.6) / 500) * 500), apr: BALANCE.credit.cardAPR, balance: d.amount, opened: 0, minDue: Math.max(25, Math.round(d.amount * BALANCE.credit.cardMinPayment)), paidThisMonth: 0 };
    } else this.take(d.type, d.amount, d.type === 'student' ? 'Student loan' : 'Personal loan', { existing: true });
  }
}
