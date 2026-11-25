// Housing: renting and moving, listings, buying with a mortgage, property tax
// and maintenance, appreciation, and renting properties out to tenants.
import { BALANCE } from '../data/balance.js';
import { HOME_TYPES, HOME_BY_ID, rentFor, priceFor } from '../data/homes.js';
import { fmtMoney, pick, clamp } from '../core/utils.js';
import { amortPayment } from './Loans.js';
import { CITIES, getCity } from '../data/cities/index.js';

const RE = BALANCE.realEstate;
const H = BALANCE.housing;

// which home types each district style sells
const STYLE_TYPES = {
  skyscraper: ['studio', 'apartment', 'condo', 'condo', 'penthouse'],
  midrise: ['studio', 'apartment', 'apartment', 'condo', 'townhouse'],
  brownstone: ['studio', 'apartment', 'townhouse', 'townhouse', 'house'],
  beach: ['studio', 'apartment', 'condo', 'house', 'penthouse'],
  warehouse: ['studio', 'studio', 'apartment', 'condo', 'townhouse'],
  houses: ['apartment', 'townhouse', 'house', 'house', 'house'],
  campus: ['studio', 'apartment', 'condo', 'townhouse', 'penthouse'],
};
const STREETS = ['Maple', 'Harbor', 'Sunset', 'Cedar', 'Park', 'Union', 'Liberty', 'Orchard', 'Vine', 'Crescent', 'Lakeview', 'Summit'];

export class RealEstate {
  constructor(sim) {
    this.sim = sim;
  }
  district(id) {
    return this.sim.city.districts.find((d) => d.id === id) || this.sim.city.districts[0];
  }
  get index() {
    return this.sim.state.market?.homeIndex || 1;
  }

  // ---- properties in other cities ------------------------------------------------
  /** The city a property stands in (properties carry cityId once you have moved). */
  cityOf(p) {
    return getCity(p.cityId || this.sim.state.cityId);
  }
  /** A property in a city you moved away from: a manager lets it out for a fee. */
  isRemote(p) {
    return !!p.cityId && p.cityId !== this.sim.state.cityId;
  }
  managerFee(p) {
    return this.isRemote(p) && p.rented && !p.vacant ? Math.round(p.rent * RE.managerFee) : 0;
  }
  /** Each city's home-price index ({ cityId: n }); the one you live in is market.homeIndex. */
  cityIndexes() {
    const m = this.sim.state.market;
    if (!m) return {};
    if (!m.cityHome) {
      m.cityHome = {};
      for (const c of CITIES) m.cityHome[c.id] = m.homeIndex || 1;
    }
    return m.cityHome;
  }

  // ---- renting ----------------------------------------------------------------
  rent(typeId, districtId) {
    return Math.round((rentFor(typeId, this.sim.city, this.district(districtId)) * (0.7 + 0.3 * this.index)) / 10) * 10;
  }
  /** Rentable homes: every type with a rent, in every district. */
  rentals() {
    const out = [];
    for (const d of this.sim.city.districts) for (const t of HOME_TYPES) if (t.rent && t.id !== 'couch' && t.tier <= 6) out.push({ type: t.id, district: d.id, rent: this.rent(t.id, d.id) });
    return out;
  }
  /** Cash needed to move into a rental: deposit + first month + movers. */
  moveInCost(typeId, districtId) {
    const rent = this.rent(typeId, districtId);
    const refund = this.sim.state.home.deposit || 0;
    return { rent, deposit: rent * H.depositMonths, first: rent, movers: H.moveCost, refund, total: rent * (H.depositMonths + 1) + H.moveCost - refund };
  }

  /** Furniture the player bought goes into storage when they move out. */
  stashFurniture() {
    const st = this.sim.state;
    const layout = st.home.layout;
    if (!layout) return;
    const stash = (st.inventory.furniture ||= {});
    for (const it of layout.items) if (it.own) stash[it.id] = (stash[it.id] || 0) + 1;
    if (st.home.owned && st.home.propertyId) {
      // an owned home keeps its walls and fixtures; only loose furniture you bought moves with you
      layout.items = layout.items.filter((it) => !it.own);
      const p = st.properties.find((x) => x.id === st.home.propertyId);
      if (p) p.layout = layout;
    }
  }

  rentHome(typeId, districtId) {
    const sim = this.sim;
    const st = sim.state;
    const c = this.moveInCost(typeId, districtId);
    if (st.money.checking < c.total) {
      sim.bus.emit('toast', { icon: '🏠', title: 'Not enough to move', text: `You need ${fmtMoney(c.total)}: deposit, first month and movers.`, kind: 'bad' });
      return false;
    }
    sim.finance.spend(c.first + c.movers, 'rent', `Move-in: first month — ${HOME_BY_ID[typeId].name}`, { credit: false });
    sim.finance.assetTx(-(c.deposit - c.refund), c.refund ? 'Security deposit (net of refund)' : 'Security deposit');
    this.stashFurniture();
    st.home = { type: typeId, districtId, rent: c.rent, owned: false, propertyId: null, layout: null, styleScore: 0, deposit: c.deposit };
    st.bills.missedRent = 0;
    st.flags.newHome = true;
    sim.bus.emit('toast', { icon: HOME_BY_ID[typeId].icon, title: `Welcome home: ${HOME_BY_ID[typeId].name}`, text: `${this.district(districtId).name} · ${fmtMoney(c.rent)}/mo. Your own furniture is in storage — place it in build mode (B).`, kind: 'good', long: true });
    sim.bus.emit('homeChanged', { moved: true });
    return true;
  }

  // ---- listings -----------------------------------------------------------------
  price(typeId, districtId) {
    return priceFor(typeId, this.sim.city, this.district(districtId)) * this.index;
  }
  refreshListings(force) {
    const sim = this.sim;
    const st = sim.state;
    if (st.listings && !force) return st.listings;
    const list = [];
    let n = 1;
    for (const d of sim.city.districts) {
      const types = STYLE_TYPES[d.style] || STYLE_TYPES.midrise;
      for (let i = 0; i < RE.listingsPerDistrict; i++) {
        const type = types[i % types.length];
        const price = Math.round((this.price(type, d.id) * (0.9 + sim.rng() * 0.25)) / 1000) * 1000;
        list.push({ id: 'ls' + sim.day + '_' + n++, type, district: d.id, price, address: `${10 + Math.floor(sim.rng() * 890)} ${pick(sim.rng, STREETS)} St` });
      }
    }
    st.listings = list;
    return list;
  }

  /** Numbers for the mortgage calculator. */
  mortgageQuote(price, downPct, years) {
    const sim = this.sim;
    const down = Math.round(price * downPct);
    const closing = Math.round(price * RE.closingCost);
    const principal = price - down;
    const q = sim.loans.quote('mortgage', principal, { years });
    const pmi = downPct < BALANCE.loans.mortgage.pmiBelow ? Math.round((principal * BALANCE.loans.mortgage.pmiRate) / 12) : 0;
    const tax = Math.round((price * RE.propertyTaxPerYear) / 12);
    const upkeep = Math.round((price * RE.maintenancePerYear) / 12);
    return { down, closing, cash: down + closing, principal, apr: q.apr, payment: Math.round(amortPayment(principal, q.apr, years * 12)), pmi, tax, upkeep, approved: principal <= 0 ? true : q.approved, reason: q.reason, rentEstimate: Math.round((price * RE.rentYield) / 10) * 10 };
  }

  /**
   * Buy a listing. opts: { downPct, years, use: 'live' | 'rent' }
   */
  buy(listingId, opts) {
    const sim = this.sim;
    const st = sim.state;
    const ls = st.listings.find((l) => l.id === listingId);
    if (!ls) return null;
    const q = this.mortgageQuote(ls.price, opts.downPct, opts.years);
    if (!q.approved) return { ok: false, reason: q.reason };
    if (st.money.checking < q.cash) return { ok: false, reason: `You need ${fmtMoney(q.cash)} in checking for the down payment and closing costs.` };
    sim.finance.assetTx(-q.down, `Down payment — ${ls.address}`);
    sim.finance.spend(q.closing, 'housing', 'Closing costs', { credit: false });
    const id = 'P' + (st.flags.propId = (st.flags.propId || 0) + 1);
    if (q.principal > 0) sim.loans.take('mortgage', q.principal, `Mortgage — ${ls.address}`, { years: opts.years, propertyId: id });
    const p = { id, type: ls.type, districtId: ls.district, address: ls.address, paid: ls.price, value: ls.price, bought: sim.day, rented: false, rent: 0, vacant: false, layout: null, pmi: q.pmi };
    st.properties.push(p);
    st.listings = st.listings.filter((l) => l !== ls);
    sim.bus.emit('toast', { icon: '🔑', title: 'You bought a home!', text: `${HOME_BY_ID[ls.type].name} at ${ls.address} is yours.`, kind: 'good', long: true });
    sim.bus.emit('propertyBought', { id, type: ls.type });
    if (opts.use === 'live') this.moveIn(id);
    else this.rentOut(id);
    return { ok: true, property: p };
  }

  mortgageOf(p) {
    return this.sim.state.loans.find((l) => l.propertyId === p.id);
  }
  equity(p) {
    return p.value - (this.mortgageOf(p)?.balance || 0);
  }

  /** Make an owned property your home. */
  moveIn(id) {
    const sim = this.sim;
    const st = sim.state;
    const p = st.properties.find((x) => x.id === id);
    if (!p) return false;
    if (st.home.deposit) sim.finance.assetTx(st.home.deposit, 'Security deposit refunded');
    this.stashFurniture();
    p.rented = false;
    p.vacant = false;
    st.home = { type: p.type, districtId: p.districtId, rent: 0, owned: true, propertyId: p.id, layout: p.layout, styleScore: p.styleScore || 0, deposit: 0 };
    st.flags.newHome = true;
    sim.bus.emit('homeChanged', { moved: true });
    return true;
  }

  marketRent(p) {
    // that city's rent-to-price ratio: pricey markets (NYC, LA) yield a little less
    const c = this.cityOf(p);
    const ratio = (c.rentIndex || 1) / (c.homePriceIndex || c.rentIndex || 1);
    return Math.round((p.value * RE.rentYield * ratio * (1 + (p.styleScore || 0) / 400)) / 10) * 10;
  }
  rentOut(id) {
    const st = this.sim.state;
    const p = st.properties.find((x) => x.id === id);
    if (!p || st.home.propertyId === id) return false;
    p.rented = true;
    p.vacant = false;
    p.rent = this.marketRent(p);
    this.sim.bus.emit('rentedOut', { id });
    return true;
  }
  stopRenting(id) {
    const p = this.sim.state.properties.find((x) => x.id === id);
    if (p) p.rented = false;
  }

  /** Sell a property you do not live in. */
  sell(id) {
    const sim = this.sim;
    const st = sim.state;
    const p = st.properties.find((x) => x.id === id);
    if (!p || st.home.propertyId === id) return null;
    const m = this.mortgageOf(p);
    const fee = Math.round(p.value * RE.sellCost);
    const payoff = m ? m.balance : 0;
    const net = p.value - fee - payoff;
    if (m) st.loans = st.loans.filter((l) => l !== m);
    st.properties = st.properties.filter((x) => x !== p);
    sim.finance.assetTx(net, `Sold ${p.address}`);
    const gain = p.value - fee - p.paid;
    if (gain > 0) st.stats.totalEarned += gain;
    sim.bus.emit('toast', { icon: '🏷️', title: 'Property sold', text: `${fmtMoney(p.value)} sale − ${fmtMoney(fee)} fees${payoff ? ` − ${fmtMoney(payoff)} mortgage` : ''} = ${fmtMoney(net)} to you.`, kind: net >= 0 ? 'good' : 'bad', long: true });
    sim.bus.emit('propertySold', { gain });
    return { net, gain };
  }

  /** Value of the home the player lives in (0 when renting). */
  homeValue() {
    const st = this.sim.state;
    const p = st.properties.find((x) => x.id === st.home.propertyId);
    return p ? p.value : 0;
  }

  // ---- sim hooks -------------------------------------------------------------------
  monthly(sim) {
    const st = sim.state;
    const m = st.market;
    // prices drift with the economy
    const regime = { recession: -0.012, bear: -0.003, normal: 0, bull: 0.004, boom: 0.012 }[m?.regime || 'normal'];
    // every city's housing market moves on its own trend; the economy's mood is shared
    const idx = this.cityIndexes();
    const growthOf = {};
    for (const c of CITIES) {
      growthOf[c.id] = (c.homeGrowth ?? RE.appreciationPerYear) / 4 + regime + (sim.rng() - 0.5) * 0.01;
      if (idx[c.id]) idx[c.id] *= 1 + growthOf[c.id];
    }
    if (m) m.homeIndex = idx[st.cityId] || m.homeIndex * (1 + growthOf[st.cityId]);
    for (const p of st.properties) {
      const remote = this.isRemote(p);
      const growth = growthOf[p.cityId || st.cityId] ?? growthOf[st.cityId];
      p.value = Math.round(p.value * (1 + growth + (sim.rng() - 0.5) * 0.006));
      // a home in a city you left is always let out: the manager finds the tenants
      if (remote && !p.rented) (p.rented = true), (p.vacant = true);
      const tax = Math.round((p.value * RE.propertyTaxPerYear) / 12);
      const upkeep = Math.round((p.value * RE.maintenancePerYear) / 12);
      const mort = this.mortgageOf(p);
      let costs = tax + upkeep;
      if (p.pmi && mort && mort.balance / p.value < 0.8) p.pmi = 0; // PMI drops once you own 20%
      costs += p.pmi || 0;
      sim.finance.charge(costs, 'housing', `Property tax & upkeep — ${p.address}`);
      if (p.rented) {
        if (p.vacant) {
          p.vacant = sim.rng() < 0.45; // a new tenant is usually found within a month or two
          if (!p.vacant) sim.bus.emit('toast', { icon: '🔑', title: 'New tenant', text: `${p.address} is rented again.`, kind: 'good' });
        } else if (sim.rng() < RE.vacancyChance) {
          p.vacant = true;
          sim.bus.emit('toast', { icon: '🚪', title: 'Tenant moved out', text: `${p.address} is empty. No rent until a new tenant signs.`, kind: 'bad' });
        }
        if (!p.vacant) {
          p.rent = Math.round(p.rent * 0.7 + this.marketRent(p) * 0.3);
          sim.finance.earnTaxed(p.rent, 'rent_income', `Rent — ${p.address}`);
          const fee = this.managerFee(p);
          if (fee) sim.finance.charge(fee, 'housing', `Property manager — ${p.address}`);
        }
        if (sim.rng() < RE.repairChance) {
          const cost = Math.round(p.value * (RE.repairCost[0] + sim.rng() * (RE.repairCost[1] - RE.repairCost[0])));
          sim.finance.charge(cost, 'housing', `Repairs — ${p.address}`);
          sim.bus.emit('toast', { icon: '🔧', title: 'Repair bill', text: `${pick(sim.rng, ['Burst pipe', 'Broken boiler', 'Roof leak', 'Dead fridge', 'Electrical fault'])} at ${p.address}: ${fmtMoney(cost)}.`, kind: 'bad' });
        }
      }
    }
    // rents follow the market for the player's own lease
    if (!st.home.owned && st.home.type !== 'couch') st.home.rent = Math.round(clamp(this.rent(st.home.type, st.home.districtId), st.home.rent * 0.98, st.home.rent * 1.03) / 10) * 10;
    this.refreshListings(true);
  }
}
