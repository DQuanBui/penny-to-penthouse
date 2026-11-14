// Creative mini-game: the playhead sweeps the timeline — hit CUT while it is
// inside the highlighted beat to make a clean edit.
import { h } from '../ui/dom.js';

export const BeatCut = {
  id: 'beatcut',
  title: 'Cut the Reel',
  icon: '🎬',
  how: 'Click CUT (or press Space) when the playhead is inside the glowing beat.',
  seconds: 32,
  setup(ctx) {
    const zone = h('div.cut-zone');
    const head = h('div.cut-head');
    const track = h('div.cut-track', zone, head);
    const msg = h('div.trade-msg', '');
    const cutBtn = h('button.btn.primary.cut-btn', { onclick: () => cut() }, '✂ CUT');
    ctx.area.append(h('div.or-wrap', track, msg, cutBtn));
    let pos = 0;
    let dir = 1;
    let z0 = 0.4;
    let zw = 0.16;
    let hits = 0;
    let miss = 0;
    let speed = 0.75 + ctx.level * 0.06;
    const target = 12 + Math.floor(ctx.level / 2);
    const place = () => {
      zw = Math.max(0.07, 0.17 - hits * 0.006 - ctx.level * 0.004);
      z0 = 0.05 + ctx.rng() * (0.9 - zw);
      zone.style.left = z0 * 100 + '%';
      zone.style.width = zw * 100 + '%';
      ctx.setInfo(`Clean cuts ${hits}`);
    };
    let last = performance.now();
    let alive = true;
    const loop = (t) => {
      if (!alive) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      pos += dir * speed * dt;
      if (pos > 1) (pos = 1), (dir = -1);
      if (pos < 0) (pos = 0), (dir = 1);
      head.style.left = pos * 100 + '%';
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    function cut() {
      const ok = pos >= z0 && pos <= z0 + zw;
      if (ok) {
        hits++;
        speed += 0.035;
        ctx.sfx('click');
      } else {
        miss++;
        ctx.sfx('error');
      }
      msg.textContent = ok ? '✅ Clean cut' : '❌ Off beat';
      msg.className = 'trade-msg ' + (ok ? 'good' : 'bad');
      place();
    }
    const onKey = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        cut();
      }
    };
    window.addEventListener('keydown', onKey);
    place();
    return {
      score: () => (hits - miss * 0.5) / target,
      stop: () => {
        alive = false;
        window.removeEventListener('keydown', onKey);
      },
    };
  },
};
