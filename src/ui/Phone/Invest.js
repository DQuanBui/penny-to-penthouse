// Invest app (portfolio + markets) and the News app.
import { h, btn } from '../dom.js';
import { ASSETS, ASSET_BY_SYM } from '../../data/stocks.js';
import { BALANCE } from '../../data/balance.js';
import { GAINS_TAX } from '../../sim/Market.js';
import { fmtMoney } from '../../core/utils.js';
import { fmtDay } from '../../core/Clock.js';
import { section, row, tabs, kv, lineChart, amountPicker, empty } from './widgets.js';

const pct = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
const KIND = { index: 'Index fund', stock: 'Stock', bond: 'Bonds', crypto: 'Crypto' };

export const InvestApp = {
  id: 'invest',
  name: 'Invest',
  icon: '📈',
  color: 'linear-gradient(135deg,#0ea5e9,#2563eb)',
  tab: 'portfolio',
  open: null,
  form: null,
  render(root, { sim, state, refresh }) {
    const mk = sim.market;
    const m = state.market;
    const R = BALANCE.market.regimes[m.regime];
    if (this.open) return this.detail(root, sim, state, refresh);
    root.append(
      tabs(
        [
          ['portfolio', 'Portfolio'],
          ['markets', 'Markets'],
        ],
        this.tab,
        (t) => ((this.tab = t), refresh()),
      ),
      h('div.pill.' + (R.drift < 0 ? 'warn' : 'trait'), `${R.drift < 0 ? '📉' : '📈'} ${R.label}`),
    );
    if (this.tab === 'portfolio') {
      const value = mk.portfolioValue();
      const cost = mk.costBasis();
      const gain = value - cost;
      const holds = Object.keys(state.portfolio.holdings);
      root.append(
        h('div.card.hero', h('div.muted.small', 'Portfolio value'), h('div.big', fmtMoney(value)), h('div.' + (gain >= 0 ? 'good' : 'bad'), `${gain >= 0 ? '+' : ''}${fmtMoney(gain)} unrealised${cost ? ` (${pct(gain / cost)})` : ''}`)),
        holds.length
          ? section(
              'Holdings',
              holds
                .sort((a, b) => state.portfolio.holdings[b].qty * m.prices[b] - state.portfolio.holdings[a].qty * m.prices[a])
                .map((sym) => {
                  const hd = state.portfolio.holdings[sym];
                  const v = hd.qty * m.prices[sym];
                  const g = m.prices[sym] / hd.avg - 1;
                  return row({ icon: KIND_ICON(sym), title: `${sym} · ${ASSET_BY_SYM[sym].name}`, sub: `${hd.qty.toFixed(2)} units · avg ${fmtMoney(hd.avg)}`, right: h('div', { style: { textAlign: 'right' } }, h('div', fmtMoney(v)), h('div.small.' + (g >= 0 ? 'good' : 'bad'), pct(g))), onclick: () => ((this.open = sym), refresh()) });
                }),
            )
          : empty('You own nothing yet. Start with the index fund: it holds every company at once.'),
        section('Lifetime', kv('Realised profit (after tax)', fmtMoney(state.portfolio.realized), state.portfolio.realized >= 0 ? 'good' : 'bad'), kv('Dividends & interest', fmtMoney(state.portfolio.dividends), 'good')),
        h('div.tip', `💡 Time in the market beats timing the market. Profits are taxed ${GAINS_TAX * 100}% when you sell.`),
      );
    } else {
      for (const kind of ['index', 'bond', 'stock', 'crypto']) {
        root.append(
          section(
            KIND[kind],
            ASSETS.filter((a) => a.kind === kind).map((a) => {
              const c = mk.change(a.sym, 1);
              return row({ icon: KIND_ICON(a.sym), title: a.sym, sub: a.name, right: h('div', { style: { textAlign: 'right' } }, h('div', fmtMoney(m.prices[a.sym])), h('div.small.' + (c >= 0 ? 'good' : 'bad'), pct(c))), onclick: () => ((this.open = a.sym), refresh()) });
            }),
          ),
        );
      }
    }
  },

  detail(root, sim, state, refresh) {
    const mk = sim.market;
    const a = ASSET_BY_SYM[this.open];
    const price = mk.price(a.sym);
    const hd = mk.holding(a.sym);
    const hist = state.market.hist[a.sym];
    const c30 = mk.change(a.sym, 28);
    root.append(
      btn('‹ Back', () => ((this.open = null), (this.form = null), refresh()), 'small'),
      h('div.card.hero', h('div.muted.small', `${KIND[a.kind]} · ${a.sym}`), h('div.big', a.name), h('div.row.between', h('b', fmtMoney(price)), h('span.' + (c30 >= 0 ? 'good' : 'bad'), `${pct(c30)} this month`)), lineChart(hist, { color: c30 >= 0 ? '#4fd18b' : '#ff6b6b', fill: true })),
      h('div.muted.small', a.desc),
      a.div ? kv('Yield', `${(a.div * 100).toFixed(1)}% per year, paid monthly`) : null,
      hd ? h('div.card', kv('You own', `${hd.qty.toFixed(3)} units`), kv('Value', fmtMoney(hd.qty * price)), kv('Profit / loss', `${fmtMoney((price - hd.avg) * hd.qty)} (${pct(price / hd.avg - 1)})`, price >= hd.avg ? 'good' : 'bad')) : null,
      h('div.row', btn('Buy', () => ((this.form = this.form === 'buy' ? null : 'buy'), refresh()), 'grow primary'), hd ? btn('Sell', () => ((this.form = this.form === 'sell' ? null : 'sell'), refresh()), 'grow') : null),
      this.form === 'buy' ? amountPicker({ max: Math.max(0, state.money.checking), chips: [100, 500, 2000, 10000], label: 'Buy', onConfirm: (v) => (mk.buy(a.sym, v), (this.form = null), refresh()) }) : null,
      this.form === 'sell' && hd
        ? h(
            'div.amount',
            h('div.muted.small', `Selling is taxed ${GAINS_TAX * 100}% on any profit.`),
            h('div.row', [0.25, 0.5, 1].map((f) => btn(f === 1 ? 'Sell all' : `Sell ${f * 100}%`, () => {
              const r = mk.sell(a.sym, f);
              if (r) sim.bus.emit('toast', { icon: '📈', title: `Sold ${a.sym}`, text: `${fmtMoney(r.proceeds)} to checking${r.tax ? ` (${fmtMoney(r.tax)} tax)` : ''}.`, kind: r.gain >= 0 ? 'good' : 'warn' });
              this.form = null;
              refresh();
            }, 'small grow'))),
          )
        : null,
    );
  },
};

function KIND_ICON(sym) {
  const k = ASSET_BY_SYM[sym].kind;
  return k === 'index' ? '🧺' : k === 'bond' ? '🏛️' : k === 'crypto' ? '🪙' : '🏢';
}

export const NewsApp = {
  id: 'news',
  name: 'News',
  icon: '📰',
  color: 'linear-gradient(135deg,#ef4444,#b91c1c)',
  render(root, { state }) {
    if (!state.news.length) return root.append(empty('No headlines yet. Market moves and city news appear here.'));
    root.append(h('div.sec', state.news.map((n) => h('div.card.msg', h('div.row.between', h('b', `${n.icon} ${n.title}`), h('span.muted.small', fmtDay(n.day))), h('div.muted.small', n.text)))));
  },
};
