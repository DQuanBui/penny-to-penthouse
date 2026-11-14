// Shared shell for the 30–45 second career mini-games: title, how-to, a
// countdown, a timer bar and a result. Each game only implements setup().
import { h } from '../ui/dom.js';
import { clamp } from '../core/utils.js';

/**
 * @param game
 * @param def { title, icon, how, seconds, setup(ctx) -> { score():0..1, stop?() } }
 *        ctx = { area, setInfo(text), every(ms, fn), after(ms, fn), level, rng, end() }
 * @returns Promise<number|null>  score 0..1, or null if the player skipped
 */
export function playMiniGame(game, def, level = 0) {
  return new Promise((resolve) => {
    const area = h('div.mg-area');
    const info = h('div.mg-info', '');
    const fill = h('div.bar-fill', { style: { width: '100%', background: 'var(--accent)' } });
    const cover = h('div.mg-cover', h('div.mg-count', '3'));
    const box = h('div.mg-box', h('div.mg-head', h('div.mg-title', `${def.icon} ${def.title}`), info), h('div.mg-how', def.how), h('div.bar.mg-timer', fill), h('div.mg-stage', area, cover));
    const el = h('div.overlay.dim.mg', box);
    game.openOverlay(el, { closable: false });

    const timers = [];
    let impl = null;
    let done = false;
    let raf = 0;
    const finish = (skipped) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      for (const t of timers) clearInterval(t), clearTimeout(t);
      impl?.stop?.();
      const score = skipped ? null : clamp(impl ? impl.score() : 0, 0, 1);
      if (skipped) {
        game.closeOverlay(el);
        return resolve(null);
      }
      const stars = score >= 0.85 ? '⭐⭐⭐' : score >= 0.55 ? '⭐⭐' : score >= 0.25 ? '⭐' : '—';
      const verdict = score >= 0.85 ? 'Outstanding shift!' : score >= 0.55 ? 'Solid work.' : score >= 0.25 ? 'You got through it.' : 'Rough day...';
      cover.replaceChildren(h('div.mg-result', h('div.mg-stars', stars), h('div.big', verdict), h('div.muted', `Score ${Math.round(score * 100)}%`), h('button.btn.primary', { onclick: () => (game.closeOverlay(el), resolve(score)) }, 'Finish shift')));
      cover.classList.remove('hidden');
      game.audio?.play(score >= 0.55 ? 'success' : 'notify');
    };

    const ctx = {
      area,
      level,
      rng: Math.random,
      setInfo: (t) => (info.textContent = t),
      every: (ms, fn) => timers.push(setInterval(() => !done && fn(), ms)),
      after: (ms, fn) => timers.push(setTimeout(() => !done && fn(), ms)),
      end: () => finish(false),
      sfx: (name) => game.audio?.play(name),
    };

    // 3-2-1 countdown, then run
    let n = 3;
    const count = cover.firstChild;
    const tick = () => {
      if (done) return;
      if (n > 0) {
        count.textContent = String(n--);
        game.audio?.play('click');
        timers.push(setTimeout(tick, 650));
        return;
      }
      cover.classList.add('hidden');
      impl = def.setup(ctx);
      const total = def.seconds * 1000;
      const t0 = performance.now();
      const step = () => {
        if (done) return;
        const left = total - (performance.now() - t0);
        fill.style.width = Math.max(0, (left / total) * 100) + '%';
        if (left < total * 0.25) fill.style.background = 'var(--bad)';
        if (left <= 0) return finish(false);
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    tick();
    box.append(h('button.btn.small.mg-skip', { onclick: () => finish(true) }, 'Skip — auto-resolve'));
  });
}
