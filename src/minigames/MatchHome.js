// Real-estate mini-game: every client has a budget and a wish list — show
// them the one listing that fits.
import { h } from '../ui/dom.js';
import { shuffle } from '../core/utils.js';

const TYPES = [
  ['🏢', 'Studio'],
  ['🏬', 'Apartment'],
  ['🏘️', 'Townhouse'],
  ['🏡', 'House'],
];
const EXTRAS = [
  ['🐕', 'pet-friendly'],
  ['🚇', 'near transit'],
  ['🌳', 'by a park'],
  ['🅿️', 'parking'],
];

export const MatchHome = {
  id: 'matchhome',
  title: 'Match the Client',
  icon: '🏘️',
  how: 'Pick the listing that matches the type, stays within budget AND has the must-have.',
  seconds: 36,
  setup(ctx) {
    const brief = h('div.match-brief');
    const cards = h('div.match-cards');
    ctx.area.append(h('div.or-wrap', brief, cards));
    let ok = 0;
    let bad = 0;
    const target = 10 + Math.floor(ctx.level / 2);
    const fmt = (n) => '$' + n.toLocaleString('en-US');
    const round = () => {
      const type = TYPES[Math.floor(ctx.rng() * TYPES.length)];
      const extra = EXTRAS[Math.floor(ctx.rng() * EXTRAS.length)];
      const budget = 1200 + Math.floor(ctx.rng() * 20) * 100;
      const other = (list, x) => list.filter((y) => y !== x)[Math.floor(ctx.rng() * (list.length - 1))];
      // one correct listing and three that each break exactly one rule
      const listings = shuffle(ctx.rng, [
        { type, extra, price: budget - 100 - Math.floor(ctx.rng() * 3) * 100, good: true },
        { type: other(TYPES, type), extra, price: budget - 200 },
        { type, extra: other(EXTRAS, extra), price: budget - 100 },
        { type, extra, price: budget + 200 + Math.floor(ctx.rng() * 3) * 100 },
      ]).slice(0, ctx.level > 2 ? 4 : 3);
      if (!listings.some((l) => l.good)) listings[0] = { type, extra, price: budget - 100, good: true };
      brief.replaceChildren(h('div.muted.small', 'Client wants'), h('div.big', `${type[0]} ${type[1]} · under ${fmt(budget)} · ${extra[0]} ${extra[1]}`));
      cards.replaceChildren(
        ...shuffle(ctx.rng, listings).map((l) =>
          h(
            'button.match-card',
            {
              onclick: () => {
                if (l.good) ok++;
                else bad++;
                ctx.sfx(l.good ? 'cash' : 'error');
                round();
              },
            },
            h('div.match-icon', l.type[0]),
            h('b', l.type[1]),
            h('div', fmt(l.price) + '/mo'),
            h('div.muted.small', `${l.extra[0]} ${l.extra[1]}`),
          ),
        ),
      );
      ctx.setInfo(`Deals ${ok} · Lost ${bad}`);
    };
    round();
    return { score: () => (ok - bad) / target };
  },
};
