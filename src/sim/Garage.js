// Owning cars: buying (cash or auto loan), selling, depreciation and upkeep.
import { VEHICLE_BY_ID, CAR } from '../data/vehicles.js';
import { fmtMoney } from '../core/utils.js';
import { mod } from './Player.js';

export class Garage {
  constructor(sim) {
    this.sim = sim;
  }
  get list() {
    return this.sim.state.vehicles;
  }
  price(id) {
    return Math.round(VEHICLE_BY_ID[id].price * mod(this.sim.state, 'priceMul') * (this.sim.state.flags.discounts?.dealer || 1));
  }
  upkeep(v) {
    return Math.round(VEHICLE_BY_ID[v.model].upkeep * (this.sim.city.priceIndex || 1));
  }

  /** Loan terms for financing a model with `downPct` down. */
  quote(id, downPct) {
    const price = this.price(id);
    const down = Math.round(price * downPct);
    const q = this.sim.loans.quote('auto', price - down);
    return { price, down, ...q };
  }

  /** pay: 'cash' | 'loan' */
  buy(id, color, pay, downPct = CAR.minDown) {
    const sim = this.sim;
    const st = sim.state;
    const def = VEHICLE_BY_ID[id];
    const price = this.price(id);
    const v = { id: 'V' + (st.flags.carId = (st.flags.carId || 0) + 1), model: id, color: color || def.colors[0], value: price, condition: 1, pos: null };
    if (pay === 'loan') {
      const q = this.quote(id, downPct);
      if (!q.approved) return { ok: false, reason: q.reason };
      if (st.money.checking < q.down) return { ok: false, reason: `You need ${fmtMoney(q.down)} for the down payment.` };
      sim.finance.assetTx(-q.down, `Down payment — ${def.name}`);
      sim.loans.take('auto', price - q.down, `Auto loan — ${def.name}`, { vehicleId: v.id });
    } else if (!sim.finance.assetTx(-price, def.name)) return { ok: false, reason: 'Not enough money in checking.' };
    st.vehicles.push(v);
    st.activeVehicle = v.id;
    sim.bus.emit('toast', { icon: def.icon, title: `You bought the ${def.name}`, text: 'It is parked outside. Walk up and press F to drive. Upkeep is billed monthly.', kind: 'good', long: true });
    sim.bus.emit('carBought', { id: v.id });
    return { ok: true, vehicle: v };
  }

  sellValue(v) {
    return Math.round(v.value * CAR.sellBack);
  }
  sell(vid) {
    const sim = this.sim;
    const st = sim.state;
    const v = st.vehicles.find((x) => x.id === vid);
    if (!v) return 0;
    let got = this.sellValue(v);
    st.vehicles = st.vehicles.filter((x) => x !== v);
    // the sale pays off what is left of the car loan first
    const loan = st.loans.find((l) => l.vehicleId === v.id);
    if (loan) {
      const payoff = Math.min(loan.balance, got);
      loan.balance -= payoff;
      got -= payoff;
      if (loan.balance <= 0.5) st.loans = st.loans.filter((l) => l !== loan);
      else loan.vehicleId = null;
    }
    sim.finance.assetTx(got, `Sold ${VEHICLE_BY_ID[v.model].name}`);
    sim.bus.emit('carSold', { id: vid });
    return got;
  }

  monthly(sim) {
    for (const v of sim.state.vehicles) v.value = Math.round(v.value * (1 - CAR.depreciationPerMonth * (2 - (v.condition ?? 1))));
  }
}
