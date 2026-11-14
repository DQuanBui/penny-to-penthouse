// Minimal in-game HUD: clock/date, cash, mood ring with expandable needs,
// current objective, minimap, interaction prompt, hints and toasts.
import { h, clear } from './dom.js';
import { fmtClock, fmtDate } from '../core/Clock.js';
import { fmtMoney } from '../core/utils.js';
import { NEEDS, moodLabel } from '../sim/Needs.js';
import { BALANCE } from '../data/balance.js';

const MINI = 176;

export class HUD {
  constructor(game) {
    this.game = game;
    this.cashShown = null;
    this.needEls = {};
    const ring = `<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" class="ring-bg"/><circle cx="22" cy="22" r="18" class="ring-fg" stroke-dasharray="113.1" stroke-dashoffset="0"/></svg>`;
    this.el = h(
      'div.hud.hidden',
      h('div.hud-tl', (this.clockCard = h('div.hud-card.clock', (this.timeEl = h('div.clock-time')), (this.dateEl = h('div.clock-date')), (this.placeEl = h('div.clock-place')))), (this.objEl = h('div.hud-card.objective.hidden'))),
      h(
        'div.hud-tr',
        h('div.hud-card.cash', { title: 'Checking balance', onclick: () => game.phone?.open('bank') }, h('span.cash-icon', '💵'), (this.cashEl = h('span.cash-val', '$0'))),
        (this.moodEl = h('div.hud-card.mood', h('div.mood-ring', { html: ring }, (this.moodFace = h('span.mood-face', '🙂'))), h('div.mood-text', (this.moodName = h('div.mood-name', 'Okay')), (this.lowEl = h('div.mood-low'))), (this.needsPanel = h('div.needs-panel')))),
        (this.toastEl = h('div.toasts')),
      ),
      h('div.hud-br', (this.miniCv = h('canvas.minimap', { width: MINI, height: MINI, onclick: () => game.map?.toggle() })), (this.wayEl = h('div.way-label.hidden'))),
      h('div.hud-bc', (this.hintEl = h('div.hint.hidden')), (this.promptEl = h('div.prompt.hidden'))),
      h('div.hud-bl', h('span', h('kbd', 'Tab'), ' Phone'), h('span', h('kbd', 'M'), ' Map'), h('span', h('kbd', 'T'), ' Wait'), h('span', h('kbd', 'Esc'), ' Menu')),
    );
    this.ringFg = this.el.querySelector('.ring-fg');
    for (const n of NEEDS) {
      const fill = h('div.bar-fill', { style: { background: n.color } });
      const val = h('span.need-val');
      this.needEls[n.id] = { fill, val };
      this.needsPanel.append(h('div.need-row', { title: n.tip }, h('span.need-icon', n.icon), h('span.need-name', n.name), h('div.bar', fill), val));
    }
    game.ui.append(this.el);
    this.miniCtx = this.miniCv.getContext('2d');
    game.events.on('toast', (t) => this.toast(t));
    game.events.on('waypoint', (w) => {
      this.wayEl.classList.toggle('hidden', !w);
      if (w) this.wayEl.textContent = '📍 ' + w.label;
    });
    this._acc = 0;
  }

  show(v = true) {
    this.el.classList.toggle('hidden', !v);
  }

  setPrompt(text, key = 'E') {
    if (text === this._prompt) return;
    this._prompt = text;
    this.promptEl.classList.toggle('hidden', !text);
    if (text) {
      clear(this.promptEl);
      this.promptEl.append(h('kbd', key), ' ', text);
    }
  }

  setObjective(text, sub) {
    const key = text + '|' + sub;
    if (key === this._obj) return;
    this._obj = key;
    this.objEl.classList.toggle('hidden', !text);
    if (text) {
      clear(this.objEl);
      this.objEl.append(h('div.obj-title', '🎯 ' + text), sub ? h('div.obj-sub', sub) : null);
      this.objEl.classList.remove('pulse');
      void this.objEl.offsetWidth;
      this.objEl.classList.add('pulse');
    }
  }

  /** One-time contextual hint (remembered in the save). */
  hint(id, text, seconds = 7) {
    const flags = this.game.state?.flags;
    if (!flags || flags.hints[id]) return;
    flags.hints[id] = 1;
    this.hintEl.textContent = '💡 ' + text;
    this.hintEl.classList.remove('hidden');
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => this.hintEl.classList.add('hidden'), seconds * 1000);
  }

  toast({ icon = 'ℹ️', title, text = '', kind = 'info', long = false }) {
    const t = h('div.toast.' + kind, h('div.toast-icon', icon), h('div', h('div.toast-title', title), text ? h('div.toast-text', text) : null));
    this.toastEl.prepend(t);
    this.game.audio?.play(kind === 'bad' ? 'error' : kind === 'good' ? 'success' : 'notify');
    while (this.toastEl.children.length > 5) this.toastEl.lastChild.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 400);
    }, long ? 9000 : 5200);
  }

  update(dt) {
    const game = this.game;
    const st = game.state;
    if (!st) return;
    // minimap every frame (cheap blit), text 5×/s
    const p = game.playerMapPos();
    game.map.drawMini(this.miniCtx, MINI, p.x, p.z, p.heading);
    this._acc += dt;
    if (this._acc < 0.2) return;
    this._acc = 0;

    const time = fmtClock(st.time.total);
    if (time !== this._time) this.timeEl.textContent = this._time = time;
    const date = fmtDate(st.time.total);
    if (date !== this._date) this.dateEl.textContent = this._date = date;
    const place = game.locationLabel();
    if (place !== this._place) this.placeEl.textContent = this._place = place;

    // cash ticks toward the real value
    const cash = st.money.checking;
    if (this.cashShown == null) this.cashShown = cash;
    if (Math.abs(cash - this.cashShown) > 0.5) {
      const diff = cash - this.cashShown;
      this.cashShown += Math.abs(diff) < 2 ? diff : diff * 0.35;
      this.cashEl.classList.toggle('up', diff > 0);
      this.cashEl.classList.toggle('down', diff < 0);
    } else {
      this.cashShown = cash;
      this.cashEl.classList.remove('up', 'down');
    }
    const cashText = fmtMoney(this.cashShown);
    if (cashText !== this._cash) this.cashEl.textContent = this._cash = cashText;

    // mood ring + needs
    const mood = Math.round(st.mood);
    if (mood !== this._mood) {
      this._mood = mood;
      const [name, face] = moodLabel(mood);
      this.moodName.textContent = name;
      this.moodFace.textContent = face;
      this.ringFg.setAttribute('stroke-dashoffset', (113.1 * (1 - mood / 100)).toFixed(1));
      this.ringFg.style.stroke = mood >= 68 ? 'var(--good)' : mood >= 40 ? 'var(--accent)' : 'var(--bad)';
    }
    let low = '';
    for (const n of NEEDS) {
      const v = st.needs[n.id];
      const e = this.needEls[n.id];
      e.fill.style.width = v.toFixed(0) + '%';
      e.val.textContent = v.toFixed(0);
      e.fill.parentElement.classList.toggle('low', v < BALANCE.needs.low);
      if (v < BALANCE.needs.low) low += n.icon;
    }
    if (low !== this._low) {
      this.lowEl.textContent = this._low = low;
      this.moodEl.classList.toggle('warn', !!low);
    }
  }
}
