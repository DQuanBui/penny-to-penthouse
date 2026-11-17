// Homes app: your home, rentals, listings with a mortgage calculator, and the
// properties you own (live in, rent out, sell).
import { h, btn } from '../dom.js';
import { confirmBox } from '../Menus.js';
import { HOME_BY_ID } from '../../data/homes.js';
import { VEHICLE_BY_ID, CAR } from '../../data/vehicles.js';
import { fmtMoney } from '../../core/utils.js';
import { section, row, tabs, kv, empty } from './widgets.js';

export const HomesApp = {
  id: 'homes',
  name: 'Homes',
  icon: '🏠',
  color: 'linear-gradient(135deg,#f97316,#c2410c)',
  tab: 'mine',
  open: null, // listing id
  down: 0.2,
  years: 30,
  district: null,
  render(root, { game, sim, state, refresh, phone }) {
    const re = sim.re;
    const city = sim.city;
    if (this.open) return this.listing(root, game, sim, state, refresh);
    root.append(
      tabs(
        [
          ['mine', 'My home'],
          ['rent', 'Rent'],
          ['buy', 'Buy'],
          ['own', 'Owned'],
        ],
        this.tab,
        (t) => ((this.tab = t), refresh()),
      ),
    );
    const districtPicker = () => {
      this.district ||= state.home.districtId;
      return h('div.chips', city.districts.map((d) => h('button.chip' + (d.id === this.district ? '.active' : ''), { onclick: () => ((this.district = d.id), refresh()) }, d.name)));
    };

    if (this.tab === 'mine') {
      const hm = state.home;
      const t = HOME_BY_ID[hm.type];
      const d = re.district(hm.districtId);
      const place = game.homePlace();
      const mort = hm.owned ? state.loans.find((l) => l.propertyId === hm.propertyId) : null;
      root.append(
        h('div.card.hero', h('div.muted.small', hm.owned ? 'You own this home' : 'You rent this home'), h('div.big', `${t.icon} ${t.name}`), h('div.muted.small', `${d.name} · ${t.size[0]}×${t.size[1]} m${t.floors > 1 ? ' · 2 floors' : ''}`), h('div.small', t.desc)),
        hm.owned ? kv('Home value', fmtMoney(re.homeValue()), 'good') : kv('Rent', `${fmtMoney(Math.round(hm.rent * (hm.roommate ? 0.55 : 1)))} / month${hm.roommate ? ' (your share)' : ''}`),
        mort ? kv('Mortgage', `${fmtMoney(mort.payment)} / month · ${fmtMoney(mort.balance)} left`) : null,
        kv('Comfort', `${Math.round(t.comfort * 100)}%`),
        kv('Style score', String(Math.round(hm.styleScore || 0))),
        hm.roommate ? kv('Roommate', sim.rel.npc(hm.roommate)?.name || '—') : null,
        btn('📍 GPS home', () => (game.map.setWaypoint(place), phone.close()), 'small'),
        state.vehicles.length
          ? section(
              'Garage',
              state.vehicles.map((v) =>
                row({
                  icon: VEHICLE_BY_ID[v.model].icon,
                  title: VEHICLE_BY_ID[v.model].name,
                  sub: `Worth ${fmtMoney(v.value)} · ${fmtMoney(sim.garage.upkeep(v))}/mo upkeep`,
                  right: btn(`Valet ${fmtMoney(CAR.valetFee)}`, () => {
                    if (game.inside || game.vehicles.driving) return game.events.emit('toast', { icon: '🚗', title: 'Valet', text: 'Step outside first.', kind: 'info' });
                    if (!sim.finance.spend(CAR.valetFee, 'transit', 'Car valet')) return;
                    game.vehicles.valet(v.id);
                    phone.close();
                    game.events.emit('toast', { icon: '🚗', title: 'Your car is here', text: 'Parked at the nearest kerb. Press F next to it.', kind: 'good' });
                  }, 'small'),
                }),
              ),
            )
          : null,
        h('div.tip', hm.owned ? '💡 Press B inside to build: walls, floors, paint and furniture. Style raises mood, popularity and resale value.' : '💡 Renters can place furniture (B inside your home) but not move walls. Buying builds equity instead of paying a landlord.'),
      );
    } else if (this.tab === 'rent') {
      root.append(districtPicker());
      const list = re.rentals().filter((r) => r.district === this.district);
      for (const r of list) {
        const t = HOME_BY_ID[r.type];
        const c = re.moveInCost(r.type, r.district);
        const current = !state.home.owned && state.home.type === r.type && state.home.districtId === r.district;
        root.append(
          h(
            'div.card.job',
            h('div.row.between', h('b', `${t.icon} ${t.name}`), h('b', `${fmtMoney(r.rent)}/mo`)),
            h('div.muted.small', `${t.size[0]}×${t.size[1]} m · comfort ${Math.round(t.comfort * 100)}% · ${t.desc}`),
            h(
              'div.row.between',
              h('span.muted.small', current ? 'You live here' : `Move-in cost ${fmtMoney(c.total)} (deposit + first month + movers)`),
              btn('Move in', async () => {
                if (await confirmBox(game, { title: `Move to a ${t.name}?`, text: `${fmtMoney(c.total)} now, then ${fmtMoney(r.rent)} every month. Aim to keep rent under a third of your income.`, yes: 'Sign lease' })) {
                  re.rentHome(r.type, r.district);
                  this.tab = 'mine';
                  refresh();
                }
              }, 'small primary' + (current || state.money.checking < c.total ? ' disabled' : '')),
            ),
          ),
        );
      }
    } else if (this.tab === 'buy') {
      root.append(districtPicker());
      const list = re.refreshListings().filter((l) => l.district === this.district);
      if (!list.length) root.append(empty('Nothing for sale here this month.'));
      for (const l of list) {
        const t = HOME_BY_ID[l.type];
        root.append(row({ icon: t.icon, title: `${t.name} · ${l.address}`, sub: `${t.size[0]}×${t.size[1]} m${t.floors > 1 ? ' · 2 floors' : ''} · from ${fmtMoney(l.price * 0.1)} down`, right: fmtMoney(l.price, { compact: true }), onclick: () => ((this.open = l.id), refresh()) }));
      }
      root.append(h('div.tip', '💡 Listings change every month. Prices rise in booms and dip in recessions.'));
    } else {
      if (!state.properties.length) root.append(empty('You do not own property yet. Your first purchase can be a home — or a rental that pays you every month.'));
      for (const p of state.properties) {
        const t = HOME_BY_ID[p.type];
        const mort = re.mortgageOf(p);
        const home = state.home.propertyId === p.id;
        root.append(
          h(
            'div.card.biz',
            h('div.row.between', h('b', `${t.icon} ${p.address}`), h('span.pill' + (home ? '.trait' : p.rented && !p.vacant ? '' : '.warn'), home ? 'Home' : p.rented ? (p.vacant ? 'Vacant' : 'Rented') : 'Empty')),
            kv('Value', `${fmtMoney(p.value)} (paid ${fmtMoney(p.paid)})`, p.value >= p.paid ? 'good' : 'bad'),
            kv('Equity', fmtMoney(re.equity(p))),
            mort ? kv('Mortgage', `${fmtMoney(mort.payment)}/mo · ${fmtMoney(mort.balance)} left`) : kv('Mortgage', 'Paid off', 'good'),
            p.rented ? kv('Rent income', p.vacant ? 'No tenant right now' : `${fmtMoney(p.rent)}/mo before tax`, p.vacant ? 'bad' : 'good') : null,
            h(
              'div.biz-actions',
              !home && !p.rented ? btn('🔑 Rent it out', () => (re.rentOut(p.id), refresh()), 'small primary') : null,
              p.rented ? btn('Stop renting', () => (re.stopRenting(p.id), refresh()), 'small') : null,
              !home
                ? btn('🏠 Move in', async () => {
                    if (await confirmBox(game, { title: 'Move in here?', text: p.rented ? 'The tenant’s lease ends and this becomes your home.' : 'This becomes your home.', yes: 'Move in' })) {
                      re.moveIn(p.id);
                      refresh();
                    }
                  }, 'small')
                : null,
              !home
                ? btn('🏷 Sell', async () => {
                    if (await confirmBox(game, { title: `Sell ${p.address}?`, text: `Sale ${fmtMoney(p.value)}, 6% fees${mort ? `, mortgage payoff ${fmtMoney(mort.balance)}` : ''}.`, yes: 'Sell', danger: true })) {
                      re.sell(p.id);
                      refresh();
                    }
                  }, 'small danger')
                : h('span.muted.small', 'Move out before selling your home.'),
            ),
          ),
        );
      }
    }
  },

  /** Listing detail with the mortgage calculator. */
  listing(root, game, sim, state, refresh) {
    const re = sim.re;
    const l = state.listings.find((x) => x.id === this.open);
    if (!l) {
      this.open = null;
      return refresh();
    }
    const t = HOME_BY_ID[l.type];
    const q = re.mortgageQuote(l.price, this.down, this.years);
    const monthly = q.payment + q.pmi + q.tax + q.upkeep;
    const afford = state.money.checking >= q.cash;
    const buy = async (use) => {
      if (!(await confirmBox(game, { title: use === 'live' ? 'Buy and move in?' : 'Buy as a rental?', text: `${fmtMoney(q.cash)} leaves your account today. Then about ${fmtMoney(monthly)} a month.`, yes: 'Buy it' }))) return;
      const r = re.buy(l.id, { downPct: this.down, years: this.years, use });
      if (r && !r.ok) game.events.emit('toast', { icon: '🏦', title: 'Purchase declined', text: r.reason, kind: 'bad', long: true });
      else {
        this.open = null;
        this.tab = 'own';
      }
      refresh();
    };
    root.append(
      btn('‹ Listings', () => ((this.open = null), refresh()), 'small'),
      h('div.card.hero', h('div.muted.small', `${re.district(l.district).name} · ${l.address}`), h('div.big', `${t.icon} ${t.name}`), h('div.big.good', fmtMoney(l.price)), h('div.small', t.desc)),
      section(
        'Mortgage calculator',
        h('div.muted.small', `Down payment: ${Math.round(this.down * 100)}% = ${fmtMoney(q.down)}`),
        h('input.slider', { type: 'range', min: 0.1, max: 1, step: 0.05, value: this.down, onchange: (e) => ((this.down = +e.target.value), refresh()) }),
        h('div.seg', [15, 30].map((y) => h('button.seg-btn' + (this.years === y ? '.active' : ''), { onclick: () => ((this.years = y), refresh()) }, `${y}-year`))),
        h(
          'div.card',
          kv('Cash needed today', fmtMoney(q.cash), afford ? 'good' : 'bad'),
          kv('Loan', q.principal > 0 ? `${fmtMoney(q.principal)} at ${(q.apr * 100).toFixed(2)}%` : 'None — paid in cash'),
          kv('Mortgage payment', `${fmtMoney(q.payment)}/mo`),
          q.pmi ? kv('Mortgage insurance (under 20% down)', `${fmtMoney(q.pmi)}/mo`, 'bad') : null,
          kv('Property tax + upkeep', `${fmtMoney(q.tax + q.upkeep)}/mo`),
          kv('Total monthly cost', `${fmtMoney(monthly)}/mo`),
          kv('If rented out', `≈ ${fmtMoney(q.rentEstimate)}/mo income`, 'good'),
        ),
        q.approved ? null : h('div.bad.small', q.reason),
        afford ? null : h('div.bad.small', `You have ${fmtMoney(state.money.checking)} in checking — move savings over or keep saving.`),
      ),
      h('div.row', btn('🏠 Buy & move in', () => buy('live'), 'grow primary' + (afford && q.approved ? '' : ' disabled')), btn('🔑 Buy to rent out', () => buy('rent'), 'grow' + (afford && q.approved ? '' : ' disabled'))),
    );
  },
};
