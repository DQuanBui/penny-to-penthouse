// Finance mini-game: read the trend on each chart and call the next move.
import { h } from '../ui/dom.js';

export const Trading = {
  id: 'trading',
  title: 'Trading Floor',
  icon: '📈',
  how: 'Each chart has a trend hiding in the noise. Call the next move: BUY if it will rise, SELL if it will fall.',
  seconds: 34,
  setup(ctx) {
    const cv = h('canvas.trade-chart', { width: 520, height: 200 });
    const g = cv.getContext('2d');
    const msg = h('div.trade-msg', '');
    const buy = h('button.btn.trade-btn.good', { onclick: () => call(1) }, '▲ BUY');
    const sell = h('button.btn.trade-btn.danger', { onclick: () => call(-1) }, '▼ SELL');
    ctx.area.append(h('div.or-wrap', cv, msg, h('div.row', sell, buy)));
    let right = 0;
    let wrong = 0;
    let series = [];
    let next = 0;
    let locked = false;
    const target = 11 + Math.floor(ctx.level / 2);
    const draw = (reveal) => {
      const pts = reveal ? series.concat([next]) : series;
      const min = Math.min(...pts, next) - 2;
      const max = Math.max(...pts, next) + 2;
      const X = (i) => 20 + (i / 13) * 480;
      const Y = (v) => 185 - ((v - min) / (max - min)) * 170;
      g.clearRect(0, 0, 520, 200);
      g.strokeStyle = 'rgba(255,255,255,0.08)';
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(20, 15 + i * 42);
        g.lineTo(500, 15 + i * 42);
        g.stroke();
      }
      g.lineWidth = 3;
      g.strokeStyle = '#5ab0ff';
      g.beginPath();
      series.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))));
      g.stroke();
      if (reveal) {
        g.strokeStyle = next > series[series.length - 1] ? '#4fd18b' : '#ff6b6b';
        g.beginPath();
        g.moveTo(X(series.length - 1), Y(series[series.length - 1]));
        g.lineTo(X(series.length), Y(next));
        g.stroke();
      } else {
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.font = '700 26px Outfit, sans-serif';
        g.fillText('?', X(series.length) - 6, Y(series[series.length - 1]) + 9);
      }
    };
    const round = () => {
      locked = false;
      msg.textContent = '';
      // a drifting series: the trend persists into the next tick most of the time
      const drift = (ctx.rng() < 0.5 ? -1 : 1) * (1.2 + ctx.rng() * 1.6);
      const noise = 2.2 + ctx.level * 0.25;
      let v = 50;
      series = [];
      for (let i = 0; i < 12; i++) {
        v += drift + (ctx.rng() - 0.5) * noise * 2;
        series.push(v);
      }
      next = v + drift * 1.4 + (ctx.rng() - 0.5) * noise * 1.6;
      draw(false);
      ctx.setInfo(`Good calls ${right} · Bad ${wrong}`);
    };
    function call(dir) {
      if (locked) return;
      locked = true;
      const up = next > series[series.length - 1];
      const ok = (dir > 0) === up;
      if (ok) right++;
      else wrong++;
      msg.textContent = ok ? '✅ Good call' : '❌ Wrong way';
      msg.className = 'trade-msg ' + (ok ? 'good' : 'bad');
      ctx.sfx(ok ? 'cash' : 'error');
      draw(true);
      ctx.after(520, round);
    }
    round();
    return { score: () => (right - wrong * 0.6) / target };
  },
};
