// Hospitality mini-game: tickets come in, build each order in the right
// sequence before the rush buries you.
import { h } from '../ui/dom.js';

const FOOD = ['🍔', '🍟', '🥤', '🥗', '🍕', '🍰'];

export const OrderRush = {
  id: 'orderrush',
  title: 'Order Rush',
  icon: '🍽️',
  how: 'Tap the items in the same order as the ticket. A wrong item restarts that ticket.',
  seconds: 36,
  setup(ctx) {
    const ticket = h('div.or-ticket');
    const pad = h('div.or-pad', FOOD.map((f) => h('button.or-btn', { onclick: () => press(f) }, f)));
    ctx.area.append(h('div.or-wrap', h('div.muted', 'Order up!'), ticket, pad));
    let order = [];
    let pos = 0;
    let done = 0;
    let slips = 0;
    const target = 9 + ctx.level;
    const draw = () => {
      ticket.replaceChildren(...order.map((f, i) => h('span.or-item' + (i < pos ? '.done' : i === pos ? '.next' : ''), f)));
      ctx.setInfo(`Orders served ${done}`);
    };
    const next = () => {
      const n = 3 + (done > 3 ? 1 : 0) + (ctx.level > 3 && done > 6 ? 1 : 0);
      order = Array.from({ length: n }, () => FOOD[Math.floor(ctx.rng() * FOOD.length)]);
      pos = 0;
      draw();
    };
    function press(f) {
      if (f === order[pos]) {
        pos++;
        ctx.sfx('click');
        if (pos >= order.length) {
          done++;
          ctx.sfx('cash');
          ticket.classList.add('flash');
          ctx.after(140, () => ticket.classList.remove('flash'));
          next();
          return;
        }
      } else {
        slips++;
        pos = 0;
        ctx.sfx('error');
        ticket.classList.add('shake');
        ctx.after(250, () => ticket.classList.remove('shake'));
      }
      draw();
    }
    next();
    return { score: () => (done - slips * 0.25) / target };
  },
};
