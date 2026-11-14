// Everyday activities (eat, shower, sleep, relax, work out, buy a coffee...).
// Pure sim code, used by the game UI and by the headless balance simulation.
import { BALANCE } from '../data/balance.js';
import { HOME_BY_ID } from '../data/homes.js';
import { mod, addSkill } from './Player.js';
import { minuteOfDay } from '../core/Clock.js';

// minutes: time taken · needs: total change · xp: skill gains · price: key in BALANCE.prices
// meals: home-cooked portions used · cat: finance category · home: gets the home comfort bonus
export const ACTIVITIES = {
  shower: { label: 'Shower', icon: '🚿', minutes: 20, needs: { hygiene: 78 }, home: true },
  bath: { label: 'Long bath', icon: '🛁', minutes: 45, needs: { hygiene: 90, fun: 14, energy: 4 }, home: true },
  eat_home: { label: 'Quick meal', icon: '🥪', minutes: 15, needs: { hunger: 40 }, meals: 1, home: true },
  cook: { label: 'Cook a proper meal', icon: '🍳', minutes: 45, needs: { hunger: 64, fun: 6 }, meals: 1, xp: { cooking: 0.22 }, home: true },
  tv: { label: 'Watch TV', icon: '📺', minutes: 60, needs: { fun: 24, energy: 2 }, home: true },
  game: { label: 'Play video games', icon: '🎮', minutes: 60, needs: { fun: 34, energy: -2 }, home: true },
  relax: { label: 'Relax', icon: '🛋️', minutes: 45, needs: { fun: 12, energy: 7 }, home: true },
  music: { label: 'Listen to music', icon: '🎵', minutes: 30, needs: { fun: 15 }, home: true },
  piano: { label: 'Play the piano', icon: '🎹', minutes: 60, needs: { fun: 20 }, xp: { creativity: 0.3 }, home: true },
  paint: { label: 'Paint', icon: '🎨', minutes: 90, needs: { fun: 16, energy: -3 }, xp: { creativity: 0.4 }, home: true },
  read: { label: 'Read for fun', icon: '📖', minutes: 60, needs: { fun: 12 }, home: true },
  workout: { label: 'Work out', icon: '🏋️', minutes: 60, needs: { energy: -16, hygiene: -22, fun: 6, health: 9 }, xp: { fitness: 0.36 } },
  browse: { label: 'Browse the web', icon: '🌐', minutes: 45, needs: { fun: 16 }, home: true },
  code_practice: { label: 'Practise coding', icon: '⌨️', minutes: 90, needs: { fun: -4, energy: -6 }, xp: { coding: 0.3 } },
  // paid things
  coffee: { label: 'Coffee', icon: '☕', minutes: 10, price: 'coffee', needs: { energy: 16, fun: 3 }, cat: 'food' },
  pastry: { label: 'Pastry', icon: '🥐', minutes: 10, price: 'pastry', needs: { hunger: 18, fun: 3 }, cat: 'food' },
  cafe_meal: { label: 'Sandwich & soup', icon: '🥗', minutes: 25, price: 'cafeMeal', needs: { hunger: 52, fun: 4 }, cat: 'food' },
  restaurant_meal: { label: 'Dinner', icon: '🍝', minutes: 50, price: 'restaurantMeal', needs: { hunger: 78, fun: 12, social: 4 }, cat: 'food' },
  fancy_dinner: { label: 'Tasting menu', icon: '🥂', minutes: 80, price: 'fancyDinner', needs: { hunger: 95, fun: 26, social: 6 }, cat: 'food' },
  drink: { label: 'Cocktail', icon: '🍸', minutes: 30, price: 'barDrink', needs: { fun: 18, social: 7, energy: -3 }, cat: 'fun' },
  mocktail: { label: 'House lemonade', icon: '🍋', minutes: 20, price: 'pastry', needs: { fun: 9, social: 4, hunger: 4 }, cat: 'fun' },
  doctor: { label: 'See a doctor', icon: '🩺', minutes: 45, price: 'doctorVisit', needs: { health: 45 }, cat: 'health' },
  haircut: { label: 'Fresh haircut', icon: '💇', minutes: 40, price: 'haircut', needs: { hygiene: 20, fun: 8 }, cat: 'shopping' },
};

/** Price of a BALANCE.prices entry in this city for this player. */
export function priceOf(sim, key, discount = 1) {
  const base = BALANCE.prices[key] ?? 0;
  return Math.round(base * (sim.city.priceIndex || 1) * mod(sim.state, 'priceMul') * discount * 100) / 100;
}

/** How well needs recover at home: home type comfort + trait. */
export function homeComfort(state) {
  return (HOME_BY_ID[state.home.type]?.comfort || 1) * mod(state, 'homeBonus');
}

/**
 * Do an activity. opts: { q (quality multiplier), atHome, free }
 * @returns { ok, reason?, minutes, cost }
 */
export function doActivity(sim, id, opts = {}) {
  const a = ACTIVITIES[id];
  const st = sim.state;
  if (!a) return { ok: false, reason: 'Unknown activity' };
  if (a.meals && st.inventory.meals < a.meals) return { ok: false, reason: 'The fridge is empty. Buy groceries first.' };
  let cost = 0;
  if (a.price && !opts.free) {
    cost = priceOf(sim, a.price, opts.discount || 1);
    if (!sim.finance.spend(cost, a.cat || 'other', a.label)) return { ok: false, reason: 'Not enough money' };
  }
  if (a.meals) st.inventory.meals -= a.meals;
  const q = (opts.q || 1) * (a.home && opts.atHome ? homeComfort(st) : 1);
  const rates = {};
  for (const k in a.needs) {
    const v = a.needs[k];
    rates[k] = ((v > 0 ? v * q : v) / a.minutes) * 60;
  }
  sim.advance(a.minutes, { rates });
  if (a.xp) for (const k in a.xp) addSkill(sim, k, a.xp[k] * (opts.q || 1));
  return { ok: true, minutes: a.minutes, cost };
}

/** Sleep for `hours` in a bed of quality q. */
export function sleep(sim, hours, q = 1) {
  const B = BALANCE.sleep;
  hours = Math.max(B.minHours, Math.min(B.maxHours, hours));
  const rate = B.energyPerHour * q * homeComfort(sim.state);
  sim.advance(hours * 60, { sleeping: true, rates: { energy: rate } });
  return hours;
}

/** Hours from now until the next time the clock shows `hour` (0..24). */
export function hoursUntil(state, hour) {
  const now = minuteOfDay(state.time.total) / 60;
  let h = hour - now;
  if (h <= 0.25) h += 24;
  return h;
}

/** Grocery packs: [id, label, portions, base price]. */
export const GROCERY_PACKS = [
  ['basic', 'Basics bag', 5, 22],
  ['week', 'Weekly shop', 14, 56],
  ['bulk', 'Bulk stock-up', 30, 108],
];

export function buyGroceries(sim, packId, discount = 1) {
  const pack = GROCERY_PACKS.find((p) => p[0] === packId);
  if (!pack) return false;
  const price = Math.round(pack[3] * (sim.city.priceIndex || 1) * mod(sim.state, 'priceMul') * discount);
  if (!sim.finance.spend(price, 'food', `Groceries — ${pack[1]}`)) return false;
  sim.state.inventory.meals += pack[2];
  return true;
}
