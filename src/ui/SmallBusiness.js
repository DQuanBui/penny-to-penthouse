// Counter service for the neighbourhood businesses (data/shops.js): one menu
// renderer for bars, clubs, delis, pizzerias, pharmacies, barbers, cinemas...
import { h, btn } from './dom.js';
import { dialog } from './Menus.js';
import { SHOP_TYPES } from '../data/shops.js';
import { HAIR_STYLES, HAIR_COLORS, FACIAL_HAIR, label } from '../characters/Customization.js';
import { addNeed } from '../sim/Needs.js';
import { mod } from '../sim/Player.js';
import { LearnApp } from './Phone/Learn.js';
import { fmtMoney } from '../core/utils.js';

const NEED_ICON = { hunger: '🍔', energy: '⚡', hygiene: '🚿', fun: '🎮', social: '💬', health: '❤️' };
const fx = (needs) =>
  Object.entries(needs)
    .map(([k, v]) => `${NEED_ICON[k] || k} ${v > 0 ? '+' : ''}${v}`)
    .join('  ');

const GREETING = {
  food: 'Something smells amazing. What can I get you?',
  night: 'The music is loud and the lights are low.',
  shop: 'Take your time and have a look around.',
  service: 'Welcome in! Who is next?',
  fun: 'Grab a ticket and enjoy.',
};

export function minorService(game, place, body, refresh) {
  const t = SHOP_TYPES[place.type];
  const sim = game.sim;
  const pm = (sim.city.priceIndex || 1) * mod(game.state, 'priceMul');
  body.append(h('div.muted', GREETING[t.cat] || ''));
  for (const it of t.menu) {
    const price = Math.round(it.price * pm * 100) / 100;
    body.append(
      h(
        'div.slot',
        h('div.lrow-icon', it.icon),
        h('div.grow', h('div.slot-name', it.name), h('div.muted.small', [it.minutes ? `${it.minutes} min` : '', fx(it.needs)].filter(Boolean).join('  ·  '))),
        btn(price ? fmtMoney(price) : 'Free', () => buy(game, place, it, price), 'small primary'),
      ),
    );
  }
  void refresh;
}

function buy(game, place, it, price) {
  const sim = game.sim;
  const st = game.state;
  if (it.special === 'books') {
    game.closeTop();
    LearnApp.tab = 'books';
    game.phone.open('learn');
    return;
  }
  if (it.special === 'haircut') return chooseHair(game, place, it, price);
  if (price && !sim.finance.spend(price, it.needs.hunger ? 'food' : 'fun', `${it.name} · ${place.name}`)) return;
  game.closeTop();
  let line = it.line;
  if (it.special === 'gift') st.inventory.gifts = (st.inventory.gifts || 0) + 1;
  if (it.special === 'lottery') {
    const r = sim.rng();
    const win = r < 0.002 ? 1000 : r < 0.02 ? 100 : r < 0.12 ? 10 : r < 0.3 ? 2 : 0;
    if (win) sim.finance.earn(win, 'gift', 'Lottery scratch-off');
    line = win >= 100 ? `🎉 WINNER! ${fmtMoney(win)}! The cashier rings a bell.` : win ? `You win ${fmtMoney(win)}. Not retiring yet.` : 'Nothing. So close on the last square.';
  }
  if (it.special === 'popularity') {
    st.social.followers += 250 + Math.round(sim.rng() * 500);
    st.social.parties = (st.social.parties || 0) + 1;
    sim.social.recompute();
  }
  const run = () => {
    if (it.minutes) sim.advance(it.minutes, { noCollapse: true });
    for (const k in it.needs) addNeed(sim, k, it.needs[k]);
    game.audio?.play(price ? 'cash' : 'success');
    game.events.emit('toast', { icon: it.icon, title: it.name, text: line, kind: 'good' });
    game.events.emit('activityDone', { id: it.id, place: place.type });
  };
  if (it.minutes >= 20) game.fade(run);
  else run();
}

/** Barber: pick a new hairstyle (and beard) before the cut. */
function chooseHair(game, place, it, price) {
  const sim = game.sim;
  const look = { ...game.state.profile.appearance };
  const body = h('div.menu-col');
  const el = dialog(game, { title: `✂️ ${place.name}`, body, wide: true });
  const render = () => {
    body.replaceChildren(
      h('div.muted', '"What are we doing today?"'),
      h('div.sec-title', 'Style'),
      h('div.chips', HAIR_STYLES.map((s) => h('button.chip' + (look.hair === s ? '.active' : ''), { onclick: () => ((look.hair = s), render()) }, label(s)))),
      h('div.sec-title', 'Colour'),
      h('div.swatches', HAIR_COLORS.map((c) => h('button.swatch' + (look.hairColor === c ? '.active' : ''), { style: { background: c }, onclick: () => ((look.hairColor = c), render()) }))),
      h('div.sec-title', 'Facial hair'),
      h('div.chips', FACIAL_HAIR.map((s) => h('button.chip' + (look.facial === s ? '.active' : ''), { onclick: () => ((look.facial = s), render()) }, label(s)))),
      btn(`Get the cut · ${fmtMoney(price)}`, () => {
        if (!sim.finance.spend(price, 'shopping', `Haircut · ${place.name}`)) return;
        game.closeOverlay(el);
        game.closeTop();
        game.fade(() => {
          sim.advance(it.minutes, { noCollapse: true });
          for (const k in it.needs) addNeed(sim, k, it.needs[k]);
          game.state.profile.appearance = look;
          game.setPlayerLook(look);
          game.events.emit('toast', { icon: '💈', title: 'Fresh cut', text: it.line, kind: 'good' });
        });
      }, 'primary'),
    );
  };
  render();
}
