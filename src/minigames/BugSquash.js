// Tech mini-game: bugs pop up in the code — click them before they slip into
// production. Do not squash the features.
import { h } from '../ui/dom.js';

const LINES = ['const user = await db.find(id);', 'if (cart.total > 0) checkout();', 'for (let i = 0; i < n; i++) {', 'return res.json({ ok: true });', 'items.map(x => x.price * qty)', 'export default function App() {', 'await queue.publish(event);', 'setState(prev => prev + 1);'];

export const BugSquash = {
  id: 'bugsquash',
  title: 'Bug Squash',
  icon: '🐛',
  how: 'Click the bugs 🐛 before they escape. Leave the features ✨ alone.',
  seconds: 32,
  setup(ctx) {
    const cells = [];
    const grid = h('div.bug-grid');
    for (let i = 0; i < 24; i++) {
      const c = h('button.bug-cell', h('span.bug-code', LINES[i % LINES.length]), h('span.bug-icon', ''));
      c.addEventListener('click', () => hit(i));
      cells.push({ el: c, kind: null, t: 0 });
      grid.append(c);
    }
    ctx.area.append(grid);
    let squashed = 0;
    let spawned = 0;
    let wrong = 0;
    const show = () => ctx.setInfo(`Squashed ${squashed} · Missed ${Math.max(0, spawned - squashed - live())}`);
    const live = () => cells.filter((c) => c.kind === 'bug').length;
    const clear = (c) => {
      c.kind = null;
      c.el.classList.remove('bug', 'feat', 'pop');
      c.el.lastChild.textContent = '';
    };
    function hit(i) {
      const c = cells[i];
      if (c.kind === 'bug') {
        squashed++;
        ctx.sfx('click');
        c.el.classList.add('pop');
        c.kind = 'dead';
        c.el.lastChild.textContent = '💥';
        ctx.after(180, () => clear(c));
      } else if (c.kind === 'feat') {
        wrong++;
        ctx.sfx('error');
        c.el.lastChild.textContent = '❌';
        c.kind = 'dead';
        ctx.after(300, () => clear(c));
      }
      show();
    }
    const life = 1500 - ctx.level * 90;
    ctx.every(Math.max(330, 620 - ctx.level * 35), () => {
      const free = cells.filter((c) => !c.kind);
      if (!free.length) return;
      const c = free[Math.floor(ctx.rng() * free.length)];
      const feat = ctx.rng() < 0.18;
      c.kind = feat ? 'feat' : 'bug';
      c.el.classList.add(feat ? 'feat' : 'bug');
      c.el.lastChild.textContent = feat ? '✨' : '🐛';
      if (!feat) spawned++;
      ctx.after(life, () => {
        if (c.kind === 'bug' || c.kind === 'feat') clear(c);
        show();
      });
    });
    show();
    return { score: () => (spawned ? (squashed - wrong * 1.5) / (spawned * 0.85) : 0) };
  },
};
