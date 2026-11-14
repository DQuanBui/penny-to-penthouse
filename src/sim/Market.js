// Market simulation: random walk + sector trends + news shocks, under market
// regimes (bull, bear, recession, boom) announced through in-game news.
// Also the player's portfolio: buy, sell, dividends, capital-gains tax.
import { BALANCE } from '../data/balance.js';
import { ASSETS, ASSET_BY_SYM, SECTORS, HEADLINES } from '../data/stocks.js';
import { clamp, fmtMoney, pick } from '../core/utils.js';
import { mod } from './Player.js';

const M = BALANCE.market;
const HIST = 90;
export const GAINS_TAX = 0.15;

export class Market {
  constructor(sim) {
    this.sim = sim;
  }
  get m() {
    return this.sim.state.market;
  }

  /** Standard normal from the sim's rng. */
  gauss() {
    const r = this.sim.rng;
    return Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
  }

  init() {
    const st = this.sim.state;
    if (st.market) {
      st.market.homeIndex ||= 1;
      return;
    }
    const m = (st.market = { regime: 'normal', regimeLeft: 30, prices: {}, hist: {}, sectors: {}, pending: [], homeIndex: 1 });
    for (const s of SECTORS) m.sectors[s] = 0;
    for (const a of ASSETS) {
      m.prices[a.sym] = a.price;
      m.hist[a.sym] = [];
    }
    // a little history so charts are not empty on day one
    for (let i = 0; i < 40; i++) this.step(true);
  }

  news(icon, title, text, kind = 'info', loud = false) {
    const st = this.sim.state;
    st.news.unshift({ day: this.sim.day, icon, title, text, kind });
    if (st.news.length > 40) st.news.length = 40;
    this.sim.bus.emit('badge', { app: 'news' });
    if (loud) this.sim.bus.emit('toast', { icon, title, text, kind, long: true });
  }

  nextRegime() {
    const m = this.m;
    const R = M.regimes;
    const keys = Object.keys(R).filter((k) => k !== m.regime);
    let total = 0;
    for (const k of keys) total += R[k].weight;
    let r = this.sim.rng() * total;
    let chosen = keys[0];
    for (const k of keys) {
      r -= R[k].weight;
      if (r <= 0) {
        chosen = k;
        break;
      }
    }
    m.regime = chosen;
    m.regimeLeft = Math.round(R[chosen].minDays + this.sim.rng() * (R[chosen].maxDays - R[chosen].minDays));
    const text = {
      bull: 'Confidence is back. Stocks are climbing.',
      normal: 'Markets settle into a steady rhythm.',
      bear: 'Investors turn cautious. Prices are sliding.',
      recession: 'The economy is shrinking. Stocks, hiring and business profits all take a hit.',
      boom: 'Everything is up and everyone is buying. Enjoy it — booms end.',
    }[chosen];
    this.news(chosen === 'recession' || chosen === 'bear' ? '📉' : chosen === 'normal' ? '📊' : '📈', R[chosen].label, text, chosen === 'recession' || chosen === 'bear' ? 'bad' : 'good', true);
    this.sim.bus.emit('regime', { regime: chosen });
  }

  /** One trading day. quiet = no news/regime changes (used to build history). */
  step(quiet = false) {
    const sim = this.sim;
    const m = this.m;
    const R = M.regimes[m.regime];
    const volMul = mod(sim.state, 'investVol');
    if (!quiet && --m.regimeLeft <= 0) this.nextRegime();
    for (const s of SECTORS) m.sectors[s] = m.sectors[s] * 0.9 + this.gauss() * 0.0011;
    const rm = M.indexDrift * R.drift + M.indexVol * R.vol * this.gauss() * volMul;

    // company / crypto news
    let shockSym = null;
    let shock = 0;
    if (!quiet && sim.rng() < 0.14) {
      const a = pick(sim.rng, ASSETS.filter((x) => x.kind === 'stock' || x.kind === 'crypto'));
      const good = sim.rng() < (m.regime === 'bear' || m.regime === 'recession' ? 0.38 : 0.56);
      shock = (good ? 1 : -1) * (0.04 + sim.rng() * 0.1) * (a.kind === 'crypto' ? 2.2 : 1);
      shockSym = a.sym;
      const line = pick(sim.rng, HEADLINES[a.sector] || HEADLINES.tech)[good ? 0 : 1].replace('{n}', a.name);
      this.news(good ? '🟢' : '🔴', line, `${a.sym} ${shock > 0 ? '+' : ''}${(shock * 100).toFixed(1)}% on the news.`, good ? 'good' : 'bad');
    }
    for (let i = m.pending.length - 1; i >= 0; i--) {
      const p = m.pending[i];
      if (sim.day >= p.day) {
        m.pending.splice(i, 1);
        if (!shockSym) (shockSym = p.sym), (shock = p.shock);
        const a = ASSET_BY_SYM[p.sym];
        this.news(p.shock > 0 ? '🟢' : '🔴', p.shock > 0 ? `${a.name} surges on surprise results` : `${a.name} stumbles — the rumours were wrong`, `${a.sym} ${p.shock > 0 ? '+' : ''}${(p.shock * 100).toFixed(1)}%.`, p.shock > 0 ? 'good' : 'bad', true);
      }
    }

    for (const a of ASSETS) {
      let r;
      if (a.kind === 'index') r = rm;
      else if (a.kind === 'bond') r = a.vol * this.gauss() + (m.regime === 'recession' ? 0.0003 : 0);
      else if (a.kind === 'crypto') r = M.cryptoDrift * R.drift * 0.6 + M.cryptoVol * R.vol * this.gauss() * volMul + rm * a.beta;
      else r = a.beta * rm + (m.sectors[a.sector] || 0) + a.vol * R.vol * this.gauss() * volMul;
      if (a.sym === shockSym) r += shock;
      m.prices[a.sym] = Math.max(0.5, m.prices[a.sym] * (1 + clamp(r, -0.6, 0.9)));
      const hst = m.hist[a.sym];
      hst.push(Math.round(m.prices[a.sym] * 100) / 100);
      if (hst.length > HIST) hst.shift();
    }
  }

  /** A friend in finance passes on a rumour. Usually right. */
  friendTip(npc) {
    const sim = this.sim;
    const a = pick(sim.rng, ASSETS.filter((x) => x.kind === 'stock'));
    const right = sim.rng() < 0.8;
    this.m.pending.push({ sym: a.sym, day: sim.day + 1 + Math.floor(sim.rng() * 3), shock: (right ? 1 : -1) * (0.07 + sim.rng() * 0.08) });
    sim.state.flags.lastTip = a.name;
    this.news('🤫', `${npc.first} mentioned ${a.name}`, `“Something is coming for ${a.sym} this week.” Tips are usually — not always — right.`, 'info');
  }

  // ---- portfolio -------------------------------------------------------------
  price(sym) {
    return this.m.prices[sym];
  }
  change(sym, days = 1) {
    const hst = this.m.hist[sym];
    if (hst.length <= days) return 0;
    return hst[hst.length - 1] / hst[hst.length - 1 - days] - 1;
  }
  holding(sym) {
    return this.sim.state.portfolio.holdings[sym];
  }
  portfolioValue() {
    const st = this.sim.state;
    let v = 0;
    for (const sym in st.portfolio.holdings) v += st.portfolio.holdings[sym].qty * this.m.prices[sym];
    return v;
  }
  costBasis() {
    const st = this.sim.state;
    let v = 0;
    for (const sym in st.portfolio.holdings) v += st.portfolio.holdings[sym].qty * st.portfolio.holdings[sym].avg;
    return v;
  }

  buy(sym, dollars) {
    const sim = this.sim;
    const st = sim.state;
    dollars = Math.floor(dollars * 100) / 100;
    if (dollars < 1) return false;
    // buying is a transfer into an asset, not spending: it stays out of the budget
    if (!sim.finance.assetTx(-dollars, `Bought ${sym}`)) return false;
    const p = this.m.prices[sym];
    const h = (st.portfolio.holdings[sym] ||= { qty: 0, avg: p });
    const qty = dollars / p;
    h.avg = (h.avg * h.qty + dollars) / (h.qty + qty);
    h.qty += qty;
    st.stats.invested = (st.stats.invested || 0) + dollars;
    sim.bus.emit('invested', { sym, dollars });
    return true;
  }

  /** Sell a fraction (0..1) of a holding. Returns { proceeds, gain, tax }. */
  sell(sym, fraction = 1) {
    const sim = this.sim;
    const st = sim.state;
    const h = st.portfolio.holdings[sym];
    if (!h || h.qty <= 0) return null;
    const qty = h.qty * clamp(fraction, 0, 1);
    const p = this.m.prices[sym];
    const gross = qty * p;
    const gain = (p - h.avg) * qty;
    const tax = gain > 0 ? gain * GAINS_TAX : 0;
    h.qty -= qty;
    if (h.qty < 1e-6) delete st.portfolio.holdings[sym];
    st.portfolio.realized += gain - tax;
    st.stats.taxesPaid += tax;
    sim.finance.assetTx(gross - tax, `Sold ${sym}`);
    if (gain - tax > 0) st.stats.totalEarned += gain - tax; // only the profit counts as earnings
    return { proceeds: gross - tax, gain, tax };
  }

  daily(sim, day) {
    this.step(false);
    const st = sim.state;
    if (day % M.dividendEveryDays === 0 && day > 0) {
      let total = 0;
      for (const sym in st.portfolio.holdings) {
        const a = ASSET_BY_SYM[sym];
        if (!a.div) continue;
        total += st.portfolio.holdings[sym].qty * this.m.prices[sym] * (a.div / 4);
      }
      if (total >= 0.01) {
        sim.finance.earn(Math.round(total * 100) / 100, 'investment', 'Dividends & interest');
        st.portfolio.dividends += total;
        sim.bus.emit('toast', { icon: '💰', title: 'Dividends paid', text: `${fmtMoney(total)} from your investments.`, kind: 'good' });
      }
    }
  }
}
