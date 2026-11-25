// Moving permanently to another city: movers and a flight, the first month and
// a deposit on a rental there, half a month to break your lease here. Savings,
// investments, properties (managed from afar), businesses, cars, your pet and
// your friends (in your phone) all come along. Your job can transfer with you
// (same role, a fresh start on performance) or you hand in your notice.
import { getCity } from '../data/cities/index.js';
import { HOME_BY_ID, rentFor } from '../data/homes.js';
import { BALANCE } from '../data/balance.js';
import { fmtMoney } from '../core/utils.js';
import { flightInfo } from './Trips.js';

/** Movers by the size of the place you are moving out of (before distance). */
const MOVERS = { couch: 250, room: 500, studio: 1100, apartment: 2200, condo: 3200, townhouse: 4500, house: 6000, penthouse: 8500 };
/** Homes you can rent sight unseen from another city. */
export const MOVE_TYPES = ['room', 'studio', 'apartment', 'condo'];

export function relocationQuote(sim, toId, districtId, typeId = 'room') {
  const st = sim.state;
  const to = getCity(toId);
  const district = to.districts.find((d) => d.id === districtId) || to.districts[0];
  const f = flightInfo(st.cityId, toId);
  const movers = Math.round(((MOVERS[st.home.type] ?? 1100) * (1 + f.km / 3000)) / 10) * 10;
  const flight = Math.round(f.fare * (sim.city.priceIndex || 1));
  const rent = Math.round((rentFor(typeId, to, district) * (0.7 + 0.3 * (sim.re?.index ?? 1))) / 10) * 10;
  const deposit = rent * BALANCE.housing.depositMonths;
  const renting = !st.home.owned && st.home.type !== 'couch';
  const refund = renting ? st.home.deposit || 0 : 0;
  const leaseBreak = renting ? Math.round((st.home.rent * 0.5) / 10) * 10 : 0;
  const total = movers + flight + rent + deposit + leaseBreak - refund;
  return { to, district, typeId, movers, flight, rent, deposit, refund, leaseBreak, total, minutes: f.minutes, km: f.km };
}

/** Apply a quote. Returns { ok, reason? }. The Game rebuilds the world and the sim afterwards. */
export function relocate(sim, q, { keepJob = true } = {}) {
  const st = sim.state;
  if (q.to.id === st.cityId) return { ok: false, reason: 'You already live here.' };
  if (st.money.checking < q.total) return { ok: false, reason: `Moving costs ${fmtMoney(q.total)} up front. Move money into checking first.` };
  const from = st.cityId;
  // work: transfer to the same role in the new city, or hand in your notice
  if (st.job) {
    if (keepJob) {
      st.job.perf = Math.min(st.job.perf, 30);
      st.job.levelDay = sim.day; // the new office wants to see you settle in before a promotion
      st.job.lastShiftDay = sim.day;
    } else sim.jobs.leave('relocated', true);
  }
  // the place you leave: furniture you bought goes in the moving truck
  sim.re.stashFurniture();
  for (const p of st.properties) p.cityId ||= from;
  sim.re.cityIndexes(); // start tracking every city's housing market before home changes
  const lived = st.home.owned && st.properties.find((p) => p.id === st.home.propertyId);
  sim.finance.spend(q.movers + q.flight + q.leaseBreak + q.rent, 'housing', `Moving to ${q.to.name}`, { credit: false });
  sim.finance.assetTx(-(q.deposit - q.refund), q.refund ? 'Security deposit (net of refund)' : 'Security deposit');
  st.home = { type: q.typeId, districtId: q.district.id, rent: q.rent, owned: false, propertyId: null, layout: null, styleScore: 0, deposit: q.deposit };
  st.bills.missedRent = 0;
  st.flags.newHome = true;
  st.cityId = q.to.id;
  if (st.market) st.market.homeIndex = sim.re.cityIndexes()[q.to.id] || st.market.homeIndex;
  st.trip = null;
  st.listings = null; // the new city's market fills in on load
  (st.stats.citiesVisited ||= {})[from] = 1;
  st.stats.citiesVisited[q.to.id] = 1;
  st.stats.relocations = (st.stats.relocations || 0) + 1;
  st.flags.movedFrom = from;
  // the home you owned and lived in is let out to tenants (manage it from the Homes app)
  if (lived) sim.re.rentOut?.(lived.id);
  sim.bus.emit('relocated', { from, to: q.to.id });
  return { ok: true, from, lived: !!lived, type: HOME_BY_ID[q.typeId] };
}
