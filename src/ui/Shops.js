// Counter services: café, restaurant, grocery, clothing, electronics, gym,
// hospital, bar... Later phases plug extra services in through SERVICES.
import { h, btn, tolerant } from './dom.js';
import { dialog } from './Menus.js';
import { ACTIVITIES, priceOf, GROCERY_PACKS, buyGroceries } from '../sim/Activities.js';
import { BALANCE } from '../data/balance.js';
import { OUTFITS, ELECTRONICS, wearOutfit } from '../data/items.js';
import { PLACE_TYPES } from '../data/placeTypes.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { mod } from '../sim/Player.js';
import { VIP_POPULARITY } from '../sim/Popularity.js';
import { fmtMoney } from '../core/utils.js';
import { runActivity, openShift } from './Interact.js';

/** A purchasable row. */
function item(icon, title, sub, price, onBuy, opts = {}) {
  return h(
    'div.slot',
    h('div.lrow-icon', icon),
    h('div.grow', h('div.slot-name', title), sub ? h('div.muted.small', sub) : null),
    opts.owned ? h('span.pill.trait', opts.owned) : btn(price ? fmtMoney(price) : opts.label || 'Free', onBuy, 'small primary'),
  );
}

/** Friends-and-family discount earned through a friend who works at this kind of shop. */
const disc = (game, place) => game.state.flags.discounts?.[place.type] || 1;
const discNote = (game, place) => (disc(game, place) < 1 ? h('div.good.small', '⭐ Friends-and-family discount applied: 15% off.') : null);

const effects = (id) =>
  Object.entries(ACTIVITIES[id].needs)
    .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`)
    .join(' · ');

/**
 * Service renderers. Each gets (game, place, body, refresh) and fills `body`.
 * Other modules add entries (college, real estate, dealer, furniture...).
 */
export const SERVICES = {
  cafe(game, place, body) {
    const d = disc(game, place);
    const act = (id) => item(ACTIVITIES[id].icon, ACTIVITIES[id].label, effects(id), priceOf(game.sim, ACTIVITIES[id].price, d), () => (game.closeTop(), runActivity(game, id, { discount: d })));
    body.append(h('div.muted', 'Fresh coffee, fast.'), discNote(game, place), act('coffee'), act('pastry'), act('cafe_meal'));
  },
  restaurant(game, place, body) {
    const act = (id) => item(ACTIVITIES[id].icon, ACTIVITIES[id].label, effects(id), priceOf(game.sim, ACTIVITIES[id].price), () => (game.closeTop(), runActivity(game, id)));
    body.append(h('div.muted', 'A table for one? Right this way.'), act('restaurant_meal'), act('fancy_dinner'));
  },
  bar(game, place, body) {
    const act = (id) => item(ACTIVITIES[id].icon, ACTIVITIES[id].label, effects(id), priceOf(game.sim, ACTIVITIES[id].price), () => (game.closeTop(), runActivity(game, id)));
    const st = game.state;
    const vip = st.social.popularity >= VIP_POPULARITY;
    body.append(
      h('div.muted', 'The night is young.'),
      act('drink'),
      act('mocktail'),
      item('⭐', 'VIP table', vip ? 'fun +38 · social +30 · get noticed' : `Reserved for well-known faces (Popularity ${VIP_POPULARITY}+). Yours: ${Math.round(st.social.popularity)}`, priceOf(game.sim, 'fancyDinner'), async () => {
        if (!game.sim.finance.spend(priceOf(game.sim, 'fancyDinner'), 'fun', 'VIP table')) return;
        game.closeTop();
        await game.fade(() => game.sim.advance(120, { rates: { fun: 19, social: 15, energy: -3 }, noCollapse: true }));
        const gain = Math.round(30 + st.social.followers * 0.01);
        st.social.followers += gain;
        game.events.emit('toast', { icon: '⭐', title: 'VIP night', text: `People noticed. +${gain} followers.`, kind: 'good' });
      }, { owned: vip ? null : '🔒 VIP' }),
    );
  },
  grocery(game, place, body, refresh) {
    const st = game.state;
    const pi = (game.sim.city.priceIndex || 1) * mod(st, 'priceMul') * disc(game, place);
    body.append(
      discNote(game, place),
      h('div.muted', `You have ${st.inventory.meals} portions at home. A home-cooked meal costs a fraction of eating out.`),
      GROCERY_PACKS.map(([id, label, n, price]) =>
        item('🛍️', label, `${n} portions · ${fmtMoney((price * pi) / n)} per meal`, Math.round(price * pi), () => {
          if (buyGroceries(game.sim, id, disc(game, place))) {
            game.audio?.play('cash');
            refresh();
          }
        }),
      ),
    );
  },
  clothing(game, place, body, refresh) {
    const st = game.state;
    const pm = mod(st, 'priceMul') * (game.sim.city.priceIndex || 1) * disc(game, place);
    body.append(
      discNote(game, place),
      h('div.muted', 'Better outfits help in interviews and make your posts more popular. Change any time at a wardrobe.'),
      OUTFITS.filter((o) => o.price > 0).map((o) => {
        const owned = st.inventory.outfits.includes(o.id);
        return item(o.icon, o.name, `Style ${o.style} · ${o.desc}`, Math.round(o.price * pm), () => {
          if (!game.sim.finance.spend(Math.round(o.price * pm), 'shopping', o.name)) return;
          st.inventory.outfits.push(o.id);
          st.flags.newOutfit = true;
          wearOutfit(st, o.id);
          game.setPlayerLook(st.profile.appearance);
          game.audio?.play('cash');
          game.events.emit('toast', { icon: o.icon, title: `${o.name} bought`, text: 'You are wearing it now.', kind: 'good' });
          game.events.emit('boughtOutfit', { id: o.id });
          refresh();
        }, { owned: owned ? (st.profile.outfit === o.id ? 'Wearing' : 'Owned') : null });
      }),
    );
  },
  electronics(game, place, body, refresh) {
    const st = game.state;
    const pm = mod(st, 'priceMul') * disc(game, place);
    body.append(
      discNote(game, place),
      h('div.muted', 'Tools that pay for themselves — if you use them.'),
      ELECTRONICS.map((e) =>
        item(e.icon, e.name, e.desc, Math.round(e.price * pm), () => {
          if (!game.sim.finance.spend(Math.round(e.price * pm), 'shopping', e.name)) return;
          st.inventory.items[e.id] = 1;
          game.audio?.play('cash');
          game.events.emit('toast', { icon: e.icon, title: `${e.name} bought`, text: 'Delivered to your home.', kind: 'good' });
          refresh();
        }, { owned: st.inventory.items[e.id] ? 'Owned' : null }),
      ),
    );
  },
  hospital(game, place, body) {
    const st = game.state;
    body.append(
      h('div.muted', `Health ${Math.round(st.needs.health)}/100. ${st.job && st.job.level >= 2 ? 'Your employer plan covers part of the visit.' : ''}`),
      item('🩺', 'See a doctor', 'health +45 · 45 min', priceOf(game.sim, 'doctorVisit', st.job && st.job.level >= 2 ? 0.4 : 1), () => (game.closeTop(), runActivity(game, 'doctor', { discount: st.job && st.job.level >= 2 ? 0.4 : 1 }))),
    );
  },
  gym(game, place, body, refresh) {
    const st = game.state;
    const pi = game.sim.city.priceIndex || 1;
    const member = st.bills.subscriptions.some((s) => s.id === 'gym');
    const day = game.sim.day;
    body.append(
      h('div.muted', 'Use any machine to train Fitness. Showers are free for members and day-pass holders.'),
      item('🎟️', 'Day pass', 'Unlimited training today', Math.round(BALANCE.prices.gymDay * pi), () => {
        if (!game.sim.finance.spend(Math.round(BALANCE.prices.gymDay * pi), 'health', 'Gym day pass')) return;
        st.flags.gymPassUntil = day;
        refresh();
      }, { owned: member ? 'Member' : st.flags.gymPassUntil >= day ? 'Active today' : null }),
      member
        ? item('💳', 'Monthly membership', 'Billed with your monthly bills', 0, () => {
            st.bills.subscriptions = st.bills.subscriptions.filter((s) => s.id !== 'gym');
            st.flags.gymPassUntil = day;
            refresh();
          }, { label: 'Cancel' })
        : item('💳', 'Monthly membership', 'Cheaper from the 4th visit each month', Math.round(BALANCE.prices.gymMonth * pi), () => {
            if (!game.sim.finance.spend(Math.round(BALANCE.prices.gymMonth * pi), 'health', 'Gym membership (first month)')) return;
            st.bills.subscriptions.push({ id: 'gym', label: 'Gym membership', amount: Math.round(BALANCE.prices.gymMonth * pi), cat: 'health' });
            st.flags.gymPassUntil = 1e9;
            refresh();
          }),
    );
  },
  bank(game) {
    game.closeTop();
    game.phone.open('bank');
  },
};

/** Open the counter dialog for a place. */
export function openService(game, place) {
  const meta = PLACE_TYPES[place.type];
  const service = meta.service;
  // workplaces without a shop: go straight to the shift dialog
  if (service === 'work') return openShift(game, place);
  const body = tolerant(h('div.menu-col'));
  const el = dialog(game, { title: `${place.icon} ${place.name}`, body, wide: true });
  const refresh = () => {
    body.replaceChildren();
    const fn = SERVICES[service];
    if (fn) fn(game, place, body, refresh);
    else body.append(h('div.muted', 'Nobody is at the counter right now. Come back later.'));
    // staff entrance for people who work here
    const j = game.state.job;
    if (meta.career && j && CAREER_BY_ID[j.career].place === place.type) body.append(btn('💼  Start your shift', () => (game.closeOverlay(el), openShift(game, place)), 'primary'));
    else if (meta.career) body.append(h('div.muted.small', `Hiring: see the Jobs app for ${CAREER_BY_ID[meta.career]?.name || 'open'} roles here.`));
  };
  refresh();
  return el;
}
