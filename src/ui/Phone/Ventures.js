// Gigs (side hustles) and Ventures (your businesses).
import { h, btn } from '../dom.js';
import { confirmBox } from '../Menus.js';
import { HUSTLES } from '../../sim/Hustles.js';
import { BUSINESS_TYPES, BUSINESS_BY_ID, BUSINESS } from '../../data/businesses.js';
import { fmtMoney } from '../../core/utils.js';
import { section, row, kv, lineChart, amountPicker } from './widgets.js';

export const GigsApp = {
  id: 'gigs',
  name: 'Gigs',
  icon: '🛵',
  color: 'linear-gradient(135deg,#f59e0b,#ef6a3a)',
  render(root, { game, sim, state, refresh }) {
    root.append(h('div.tip', '💡 Side hustles pay the same day. Each can be done once a day; 12% is withheld for tax.'));
    for (const id in HUSTLES) {
      const g = HUSTLES[id];
      const why = sim.hustles.blocked(id);
      const [lo, hi] = sim.hustles.payRange(id);
      root.append(
        h(
          'div.card.job',
          h('div.row.between', h('b', `${g.icon} ${g.name}`), h('b.good', `${fmtMoney(lo)}–${fmtMoney(hi)}`)),
          h('div.muted.small', `${g.minutes / 60} h · ${g.desc}`),
          h(
            'div.row.between',
            h('span.small.' + (why ? 'bad' : 'muted'), why || 'Available now'),
            btn('Start', async () => {
              game.phone.close();
              let res;
              await game.fade(() => {
                res = sim.hustles.run(id);
              });
              if (res) game.events.emit('toast', { icon: g.icon, title: `${g.name} done`, text: `+${fmtMoney(res.net)} after tax${res.followers ? ` · +${res.followers} followers` : ''} · ${res.minutes / 60} h`, kind: 'good' });
            }, 'small primary' + (why ? ' disabled' : '')),
          ),
        ),
      );
    }
    root.append(section('Lifetime', kv('Earned from gigs', fmtMoney(state.hustles.total))));
    void refresh;
  },
};

export const VenturesApp = {
  id: 'ventures',
  name: 'Ventures',
  icon: '🏪',
  color: 'linear-gradient(135deg,#10b981,#0e7490)',
  form: null,
  badge: (state) => state.businesses.filter((b) => b.active && b.cash < 0).length,
  render(root, { game, sim, state, refresh }) {
    const biz = sim.biz;
    const list = biz.list;
    for (const b of list) {
      const t = BUSINESS_BY_ID[b.type];
      const need = biz.staffNeeded(b);
      const why = biz.canWork(b);
      const exp = biz.expectedProfit(b, false);
      root.append(
        h(
          'div.card.biz',
          h('div.row.between', h('b', `${t.icon} ${b.name}`), h('span.pill', `Level ${b.level}`)),
          h('div.row.between', h('span.muted.small', 'Business account'), h('b.' + (b.cash < 0 ? 'bad' : 'good'), fmtMoney(b.cash))),
          b.history.length > 1 ? lineChart(b.history.slice(-30), { hgt: 60, color: b.avgProfit >= 0 ? '#4fd18b' : '#ff6b6b', zero: true }) : null,
          kv('Typical day', `${exp >= 0 ? '+' : ''}${fmtMoney(exp)}`, exp >= 0 ? 'good' : 'bad'),
          kv('Staff', `${b.staff} / ${need} needed · ${fmtMoney(biz.wage())}/day each`, b.staff < need ? 'bad' : ''),
          h('div', h('div.row.between', h('span.muted.small', 'Reputation'), h('span.small', String(Math.round(b.reputation)))), h('div.bar', h('div.bar-fill', { style: { width: b.reputation + '%', background: 'var(--accent)' } }))),
          kv('Estimated value', fmtMoney(biz.valueOf(b))),
          h(
            'div.biz-actions',
            btn(why ? '✓ Worked today' : `🧑‍🍳 Work ${BUSINESS.workHours} h`, async () => {
              game.phone.close();
              await game.fade(() => biz.work(b.id));
              game.events.emit('toast', { icon: t.icon, title: `Shift at ${b.name}`, text: 'Reputation up, and today will be a better day for the business.', kind: 'good' });
            }, 'small' + (why ? ' disabled' : ' primary')),
            btn('➕ Hire', () => (biz.hire(b.id), refresh()), 'small' + (b.staff >= b.level + 1 ? ' disabled' : '')),
            btn('➖ Let go', () => (biz.fire(b.id), refresh()), 'small' + (b.staff ? '' : ' disabled')),
            btn(`📣 Marketing ${fmtMoney(biz.marketingCost(b))}`, () => (biz.market(b.id), refresh()), 'small' + (b.cash >= biz.marketingCost(b) ? '' : ' disabled')),
            b.level < BUSINESS.maxLevel ? btn(`⬆ Expand ${fmtMoney(biz.upgradeCost(b))}`, () => (biz.upgrade(b.id), refresh()), 'small') : null,
            btn('💵 Take profit', () => ((this.form = this.form === b.id ? null : b.id), refresh()), 'small' + (b.cash >= 1 ? '' : ' disabled')),
            btn('🏷 Sell', async () => {
              const price = Math.round(biz.valueOf(b) * 0.9);
              if (await confirmBox(game, { title: `Sell ${b.name}?`, text: `A buyer offers ${fmtMoney(price)} (taxed as business income).`, yes: 'Sell', danger: true })) {
                biz.sell(b.id);
                refresh();
              }
            }, 'small danger'),
          ),
          this.form === b.id ? amountPicker({ max: Math.max(0, b.cash), label: 'Withdraw', onConfirm: (v) => (biz.withdraw(b.id, v), (this.form = null), refresh()) }) : null,
          b.cash < 0 ? h('div.row', h('span.bad.small.grow', 'Running at a loss — add capital before it goes under.'), btn('Add $1,000', () => (biz.inject(b.id, 1000), refresh()), 'small')) : null,
        ),
      );
    }
    if (list.length < BUSINESS.maxOwned) {
      root.append(
        section(
          list.length ? 'Start another venture' : 'Start a business',
          list.length ? null : h('div.tip', '💡 Be your own boss. Profit depends on your skills, staffing and reputation — and bad months can sink you. Keep a cash cushion.'),
          BUSINESS_TYPES.map((t) => {
            const cost = biz.startCost(t.id);
            return h(
              'div.card.job',
              h('div.row.between', h('b', `${t.icon} ${t.name}`), h('b', fmtMoney(cost))),
              h('div.muted.small', t.desc),
              h('div.muted.small', `Key skills: ${Object.keys(t.skills).join(', ')} · risk: ${t.vol > 0.7 ? 'very high' : t.vol > 0.4 ? 'high' : t.vol > 0.25 ? 'medium' : 'low'}`),
              h('div.row.between', h('span.muted.small', state.money.checking >= cost ? 'You can afford this' : `You need ${fmtMoney(cost - state.money.checking)} more in checking`), btn('Launch', async () => {
                if (await confirmBox(game, { title: `Launch a ${t.name}?`, text: `${fmtMoney(cost)} of startup capital leaves your checking account today.`, yes: 'Launch' })) {
                  biz.start(t.id);
                  refresh();
                }
              }, 'small primary' + (state.money.checking >= cost ? '' : ' disabled'))),
            );
          }),
        ),
      );
    }
    const closed = state.businesses.filter((b) => !b.active);
    if (closed.length) root.append(section('Past ventures', closed.map((b) => row({ icon: BUSINESS_BY_ID[b.type].icon, title: b.name, sub: `Lifetime profit ${fmtMoney(b.total)}` }))));
  },
};
