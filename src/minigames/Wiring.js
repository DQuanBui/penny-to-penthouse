// Trades mini-game: wire each terminal on the left to the matching colour on
// the right. Finish a panel to get the next one.
import { h } from '../ui/dom.js';
import { shuffle } from '../core/utils.js';

const COLORS = ['#ff5b5b', '#ffb347', '#ffe24a', '#4fd18b', '#5ab0ff', '#c77dff'];

export const Wiring = {
  id: 'wiring',
  title: 'Wire It Up',
  icon: '🔌',
  how: 'Click a terminal on the left, then the same colour on the right. Finish panels fast.',
  seconds: 34,
  setup(ctx) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'wire-svg');
    const left = h('div.wire-col');
    const right = h('div.wire-col');
    const board = h('div.wire-board', left, svg, right);
    ctx.area.append(board);
    let pairs = 0;
    let wrong = 0;
    let sel = null;
    let remaining = 0;
    const target = 15 + ctx.level;
    const info = () => ctx.setInfo(`Connections ${pairs}`);
    const line = (a, b, color) => {
      const r = board.getBoundingClientRect();
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x1 = ra.right - r.left;
      const y1 = ra.top + ra.height / 2 - r.top;
      const x2 = rb.left - r.left;
      const y2 = rb.top + rb.height / 2 - r.top;
      const p = document.createElementNS(svgNS, 'path');
      const mx = (x1 + x2) / 2;
      p.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
      p.setAttribute('stroke', color);
      p.setAttribute('class', 'wire-line');
      svg.append(p);
    };
    const panel = () => {
      const n = Math.min(6, 4 + Math.floor(ctx.level / 3) + (pairs > 8 ? 1 : 0));
      const cols = shuffle(ctx.rng, COLORS).slice(0, n);
      left.replaceChildren();
      right.replaceChildren();
      svg.replaceChildren();
      sel = null;
      remaining = n;
      for (const c of cols) {
        const b = h('button.wire-term', { style: { background: c } });
        b.addEventListener('click', () => {
          if (b.disabled) return;
          left.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel'));
          b.classList.add('sel');
          sel = { el: b, color: c };
          ctx.sfx('click');
        });
        left.append(b);
      }
      for (const c of shuffle(ctx.rng, cols)) {
        const b = h('button.wire-term', { style: { background: c } });
        b.addEventListener('click', () => {
          if (!sel || b.disabled) return;
          if (sel.color === c) {
            line(sel.el, b, c);
            sel.el.disabled = b.disabled = true;
            sel.el.classList.remove('sel');
            sel = null;
            pairs++;
            remaining--;
            ctx.sfx('click');
            if (remaining === 0) {
              ctx.sfx('success');
              ctx.after(260, panel);
            }
          } else {
            wrong++;
            ctx.sfx('error');
            board.classList.add('shake');
            ctx.after(250, () => board.classList.remove('shake'));
          }
          info();
        });
        right.append(b);
      }
      info();
    };
    panel();
    return { score: () => (pairs - wrong * 0.5) / target };
  },
};
