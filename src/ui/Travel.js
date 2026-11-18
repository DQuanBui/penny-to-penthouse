// Airport check-in (flights to the other cities) and the hotel front desk.
import { h, btn } from './dom.js';
import { CITIES, CITY_BY_ID } from '../data/cities/index.js';
import { flightInfo, hotelRate, hotelName } from '../sim/Trips.js';
import { addNeed } from '../sim/Needs.js';
import { fmtMoney } from '../core/utils.js';

const dur = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;

export function flightsService(game, place, body) {
  const st = game.state;
  const sim = game.sim;
  const here = game.city.cfg.id;
  const home = st.cityId;
  body.append(
    h('div.muted', st.trip ? `You are visiting ${CITY_BY_ID[here].name} and staying at ${hotelName(here)}. Your home in ${CITY_BY_ID[home].name} is waiting.` : 'Departures every hour. Pick a city, grab a window seat.'),
    h('div.sec-title', 'Departures'),
  );
  for (const c of CITIES) {
    if (c.id === here) continue;
    const f = flightInfo(here, c.id);
    const fare = Math.round(f.fare * (sim.city.priceIndex || 1));
    const goingHome = c.id === home;
    body.append(
      h(
        'div.slot',
        h('div.lrow-icon', goingHome ? '🏠' : '✈️'),
        h('div.grow', h('div.slot-name', goingHome ? `Home to ${c.name}` : c.name), h('div.muted.small', `${dur(f.minutes)} · ${f.km.toLocaleString()} km · ${goingHome ? 'back to your own bed' : `hotel ${fmtMoney(hotelRate(c.id))}/night`}`)),
        btn(`Fly · ${fmtMoney(fare)}`, () => {
          if (!sim.finance.spend(fare, 'transit', `Flight to ${c.name}`)) return;
          game.travelTo(c.id, f.minutes);
        }, 'small primary'),
      ),
    );
  }
  if (st.job) body.append(h('div.tip', '💡 Your job keeps going while you travel: missed weekday shifts lower your performance. Weekends are perfect for trips.'));
}

export function hotelService(game, place, body) {
  const st = game.state;
  const sim = game.sim;
  const here = game.city.cfg.id;
  const rate = hotelRate(here);
  const staying = st.trip?.cityId === here || (st.flags.hotelUntil || 0) > st.time.total;
  body.append(h('div.muted', 'Marble floors, a chandelier, and a concierge who knows every restaurant in town.'));
  if (staying) {
    body.append(
      h('div.good', '🔑 Your room is ready.'),
      btn('🛏️  Go up to your room', () => {
        game.closeTop();
        game.enterHotelRoom(place);
      }, 'primary'),
    );
  } else {
    body.append(
      btn(`🛎️  Book a night · ${fmtMoney(rate)}`, () => {
        if (!sim.finance.spend(rate, 'housing', `Hotel night · ${place.name}`)) return;
        const day = sim.day;
        st.flags.hotelUntil = (day + 1) * 1440 + 12 * 60;
        game.closeTop();
        game.enterHotelRoom(place);
      }, 'primary'),
    );
  }
  const bfast = Math.round(28 * (sim.city.priceIndex || 1));
  body.append(
    btn(`🍳  Room service breakfast · ${fmtMoney(bfast)}`, () => {
      if (!sim.finance.spend(bfast, 'food', 'Room service')) return;
      game.closeTop();
      game.fade(() => {
        sim.advance(30, { noCollapse: true });
        addNeed(sim, 'hunger', 45);
        addNeed(sim, 'fun', 8);
      });
      game.events.emit('toast', { icon: '🍳', title: 'Room service', text: 'Eggs, pastries and fresh orange juice on a silver tray. Fancy.', kind: 'good' });
    }),
  );
}
