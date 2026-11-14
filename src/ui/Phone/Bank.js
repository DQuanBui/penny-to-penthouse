// Bank app: accounts, transfers, net-worth chart, upcoming bills, budget and
// activity. Credit card and loans appear here once they exist.
import { h } from '../dom.js';
import { fmtMoney } from '../../core/utils.js';
import { fmtDay, dayOf, fmtClock } from '../../core/Clock.js';
import { BALANCE } from '../../data/balance.js';
import { CATEGORIES, isBillDay, isMidBillDay, isPayday, nextDayMatching } from '../../sim/Finance.js';
import { creditLabel, creditColor, cardOffer, openCard, payCard, utilization } from '../../sim/Credit.js';
import { section, kv, row, tabs, money, amountPicker, lineChart, shareBars, empty } from './widgets.js';

const COLORS = ['#ffb347', '#5ab0ff', '#4fd18b', '#c77dff', '#ff7ab8', '#ff8a4a', '#5ac8fa', '#a8d84f', '#ff6b6b', '#9aa3b8'];

export const BankApp = {
  id: 'bank',
  name: 'Bank',
  icon: '🏦',
  color: 'linear-gradient(135deg,#2f9e7f,#1f6f8f)',
  tab: 'home',
  form: null,
  render(root, { sim, state, refresh }) {
    const m = state.money;
    const fin = sim.finance;
    const bd = fin.breakdown();
    const day = dayOf(state.time.total);
    root.append(
      tabs(
        [
          ['home', 'Accounts'],
          ['budget', 'Budget'],
          ['activity', 'Activity'],
        ],
        this.tab,
        (t) => {
          this.tab = t;
          this.form = null;
          refresh();
        },
      ),
    );

    if (this.tab === 'home') {
      const hist = m.history.map((p) => p.v);
      hist.push(Math.round(bd.total));
      root.append(
        h('div.card.hero', h('div.muted.small', 'Net worth'), h('div.big' + (bd.total < 0 ? '.bad' : ''), fmtMoney(bd.total)), lineChart(hist.slice(-120), { color: bd.total < 0 ? '#ff6b6b' : '#4fd18b', zero: false })),
        section(
          'Accounts',
          row({ icon: '💵', title: 'Checking', sub: 'Everyday spending', right: money(m.checking) }),
          row({ icon: '🐖', title: 'Savings', sub: `${(BALANCE.bank.savingsAPY * 100).toFixed(1)}% APY · interest paid monthly`, right: money(m.savings) }),
          h(
            'div.row',
            h('button.btn.small.grow', { onclick: () => ((this.form = this.form === 'save' ? null : 'save'), refresh()) }, '→ Move to savings'),
            h('button.btn.small.grow', { onclick: () => ((this.form = this.form === 'take' ? null : 'take'), refresh()) }, '← Move to checking'),
          ),
          this.form === 'save'
            ? amountPicker({ max: Math.max(0, m.checking), label: 'Save', onConfirm: (v) => (fin.transfer('checking', 'savings', v), (this.form = null), refresh()) })
            : this.form === 'take'
              ? amountPicker({ max: m.savings, label: 'Move', onConfirm: (v) => (fin.transfer('savings', 'checking', v), (this.form = null), refresh()) })
              : null,
        ),
        this.creditSection(sim, state, refresh),
        state.loans.length
          ? section(
              'Loans',
              state.loans.map((l) => row({ icon: l.icon || '🏦', title: l.label, sub: `${(l.apr * 100).toFixed(1)}% APR · ${fmtMoney(l.payment)}/mo · ${l.monthsLeft} payments left`, right: money(-l.balance) })),
            )
          : null,
        section(
          'Coming up',
          state.job ? row({ icon: '💼', title: 'Payday', sub: fmtDay(nextDayMatching(day - 1, isPayday)), right: state.job.accrued ? h('span.good', '≈ ' + fmtMoney(sim.jobs?.netPreview() || 0)) : '—' }) : null,
          this.billRows(fin, day),
        ),
        section('What you own and owe', kv('Cash', fmtMoney(bd.cash)), kv('Investments', fmtMoney(bd.investments)), kv('Property', fmtMoney(bd.property)), kv('Vehicles', fmtMoney(bd.vehicles)), kv('Businesses', fmtMoney(bd.business)), kv('Debt', fmtMoney(-bd.debt), bd.debt ? 'bad' : '')),
      );
    } else if (this.tab === 'budget') {
      const keys = Object.keys(m.budget)
        .map(Number)
        .sort((a, b) => b - a);
      if (!keys.length) root.append(empty('No activity yet. Your monthly budget appears here.'));
      keys.slice(0, 3).forEach((k, idx) => {
        const b = m.budget[k];
        const inc = Object.entries(b.inc).sort((a, c) => c[1] - a[1]);
        const exp = Object.entries(b.exp).sort((a, c) => c[1] - a[1]);
        const ti = inc.reduce((s, x) => s + x[1], 0);
        const te = exp.reduce((s, x) => s + x[1], 0);
        const rate = ti > 0 ? (ti - te) / ti : 0;
        root.append(
          section(
            idx === 0 ? 'This month' : `${idx} month${idx > 1 ? 's' : ''} ago`,
            h('div.card', h('div.row.between', h('span.muted', 'Income'), h('span.good', fmtMoney(ti))), h('div.row.between', h('span.muted', 'Spending'), h('span.bad', fmtMoney(te))), h('div.row.between', h('b', 'Saved'), h('b.' + (ti - te >= 0 ? 'good' : 'bad'), `${fmtMoney(ti - te)}${ti > 0 ? ` · ${Math.round(rate * 100)}%` : ''}`))),
            exp.length ? shareBars(exp.map(([c, v], i) => ({ label: `${CATEGORIES[c]?.icon || ''} ${CATEGORIES[c]?.name || c}`, value: v, color: COLORS[i % COLORS.length] })), te) : null,
            inc.length ? h('div.muted.small', 'Income: ' + inc.map(([c, v]) => `${CATEGORIES[c]?.name || c} ${fmtMoney(v)}`).join(' · ')) : null,
          ),
        );
      });
      root.append(h('div.tip', '💡 A healthy budget keeps rent under a third of income and saves at least 20%.'));
    } else {
      if (!m.txs.length) root.append(empty('No transactions yet.'));
      root.append(
        h(
          'div.sec',
          m.txs.slice(0, 60).map((t) =>
            row({
              icon: CATEGORIES[t.cat]?.icon || '🔁',
              title: t.label,
              sub: `${fmtDay(Math.floor(t.t / 1440))} · ${fmtClock(t.t)}`,
              right: t.amount ? money(t.amount, true) : '',
            }),
          ),
        ),
      );
    }
  },

  billRows(fin, day) {
    const bills = fin.monthlyBills();
    const first = bills.filter((b) => b.when === 'first');
    const mid = bills.filter((b) => b.when === 'mid');
    const sum = (l) => l.reduce((s, b) => s + b.amount, 0);
    return [
      row({ icon: '🏠', title: 'Rent & utilities', sub: `${fmtDay(nextDayMatching(day - 1, isBillDay))} · ${first.map((b) => b.label.split(' — ')[0]).join(', ')}`, right: money(-sum(first)) }),
      row({ icon: '📱', title: 'Monthly bills', sub: `${fmtDay(nextDayMatching(day - 1, isMidBillDay))} · ${mid.map((b) => b.label).join(', ')}`, right: money(-sum(mid)) }),
    ];
  },

  creditSection(sim, state, refresh) {
    const c = state.credit;
    const card = c.card;
    const score = h('div.row.between', h('span', 'Credit score'), h('b', { style: { color: creditColor(c.score) } }, `${c.score} · ${creditLabel(c.score)}`));
    const scoreBar = h('div.bar', h('div.bar-fill', { style: { width: ((c.score - 300) / 550) * 100 + '%', background: creditColor(c.score) } }));
    if (!card) {
      const offer = cardOffer(sim);
      return section(
        'Credit',
        h('div.card', score, scoreBar, h('div.muted.small', 'Pay rent and bills on time to raise it. A better score means cheaper loans.')),
        offer
          ? row({ icon: '💳', title: 'Summit Rewards Card', sub: `Pre-approved: ${fmtMoney(offer.limit)} limit · ${(offer.apr * 100).toFixed(1)}% APR`, right: h('button.btn.small.primary', { onclick: () => (openCard(sim), refresh()) }, 'Apply') })
          : row({ icon: '💳', title: 'Credit card', sub: 'Not eligible yet — your score is too low.' }),
      );
    }
    const util = utilization(state);
    return section(
      'Credit',
      h('div.card', score, scoreBar),
      h(
        'div.card',
        h('div.row.between', h('span', '💳 Summit Rewards Card'), h('b.' + (card.balance > 0 ? 'bad' : ''), fmtMoney(-card.balance))),
        h('div.bar', h('div.bar-fill', { style: { width: util * 100 + '%', background: util > 0.8 ? 'var(--bad)' : util > 0.3 ? 'var(--accent)' : 'var(--good)' } })),
        h('div.muted.small', `${Math.round(util * 100)}% of ${fmtMoney(card.limit)} used · ${(card.apr * 100).toFixed(1)}% APR${card.minDue ? ` · minimum due ${fmtMoney(card.minDue)}` : ''}`),
        card.balance > 0
          ? h(
              'div.row',
              card.minDue ? h('button.btn.small.grow', { onclick: () => (payCard(sim, card.minDue), refresh()) }, `Pay minimum`) : null,
              h('button.btn.small.primary.grow', { onclick: () => (payCard(sim, card.balance), refresh()) }, `Pay ${fmtMoney(Math.min(card.balance, Math.max(0, state.money.checking)))}`),
            )
          : h('div.good.small', 'Paid in full — no interest. Nice.'),
      ),
    );
  },
};
