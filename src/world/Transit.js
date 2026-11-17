// Getting around: transit stations (fare, fast travel between districts) and
// taxis / rideshare (pricier, door to door). Owning a car makes trips free.
import { h, btn } from '../ui/dom.js';
import { dialog } from '../ui/Menus.js';
import { BALANCE } from '../data/balance.js';
import { fmtMoney } from '../core/utils.js';

/** Fare and minutes for a station-to-station ride. */
export function transitQuote(game, from, to) {
  const cfg = game.city.cfg;
  const dist = Math.hypot(from.x - to.x, from.z - to.z);
  return { fare: cfg.transit?.fare ?? BALANCE.prices.transitFare, minutes: Math.round(8 + dist / 28) };
}

/** Price and minutes for a taxi from where the player stands to a place. */
export function taxiQuote(game, place) {
  const p = game.playerMapPos();
  const dist = Math.hypot(p.x - place.x, p.z - place.z);
  const pi = game.city.cfg.priceIndex || 1;
  return { fare: Math.round((BALANCE.prices.taxiBase + (BALANCE.prices.taxiPerKm * dist) / 100) * pi), minutes: Math.round(4 + dist / 45), dist };
}

function travel(game, place, minutes) {
  return game.fade(() => {
    game.closeAllOverlays();
    game.vehicles?.exit(true);
    if (game.inside) game.leaveInterior(true);
    game.sim.advance(minutes, { rates: { energy: 1 } });
    game.placePlayerAt(place);
    game.events.emit('travelled', { place });
  });
}

/** E at a station: pick a destination. */
export function openStation(game, station) {
  const cfg = game.city.cfg;
  const others = game.city.places.filter((p) => p.station && p !== station);
  const el = dialog(game, {
    title: `${station.icon} ${station.name}`,
    body: h(
      'div.menu-col',
      h('div.muted', `${cfg.transit?.name || 'Transit'} runs between every district. Cheap, and it never gets stuck in traffic.`),
      others.map((o) => {
        const q = transitQuote(game, station, o);
        return btn(`${o.icon}  ${o.district.name}  ·  ${q.minutes} min  ·  ${fmtMoney(q.fare)}`, async () => {
          if (!game.sim.finance.spend(q.fare, 'transit', `${cfg.transit?.name || 'Transit'} fare`)) return;
          game.audio?.play('door');
          await travel(game, o, q.minutes);
        });
      }),
    ),
  });
  return el;
}

/** Call a cab to a place (from the map). */
export async function takeTaxi(game, place) {
  const q = taxiQuote(game, place);
  if (q.dist < 25) return game.events.emit('toast', { icon: '🚕', title: 'You are already there', text: 'It is a few steps away.', kind: 'info' });
  if (!game.sim.finance.spend(q.fare, 'transit', `Taxi to ${place.type === 'home' ? 'home' : place.name}`)) return;
  await travel(game, place, q.minutes);
  game.events.emit('toast', { icon: '🚕', title: 'Taxi ride', text: `${fmtMoney(q.fare)} · ${q.minutes} min. Transit is cheaper if you are not in a hurry.`, kind: 'info' });
}
