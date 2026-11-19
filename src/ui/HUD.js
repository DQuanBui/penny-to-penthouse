// Minimal in-game HUD: clock/date, cash, mood ring with expandable needs,
// current objective, minimap, interaction prompt, hints and toasts.
import { h, clear } from './dom.js';
import { fmtClock, fmtDate } from '../core/Clock.js';
import { fmtMoney } from '../core/utils.js';
import { NEEDS, moodLabel } from '../sim/Needs.js';
import { BALANCE } from '../data/balance.js';
import { BREED_BY_ID, PET, petMood } from '../data/pets.js';

const COMPASS_W = 420; // px shown
const COMPASS_SPAN = 180; // degrees visible
const PX = COMPASS_W / COMPASS_SPAN;
const DIRS = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

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
        (this.pipsEl = h('div.hud-card.need-pips')),
        (this.petEl = h('div.hud-card.pet-chip.hidden')),
        (this.toastEl = h('div.toasts')),
      ),
      (this.compassEl = h('div.hud-tc.compass.hidden', (this.stripEl = h('div.compass-strip')), (this.wayMark = h('div.compass-mark.way.hidden')), (this.homeMark = h('div.compass-mark.home.hidden', '🏠')), h('div.compass-needle'))),
      h('div.hud-br', (this.miniCv = h('canvas.minimap', { width: MINI, height: MINI, onclick: () => game.map?.toggle() })), (this.wayEl = h('div.way-label.hidden'))),
      h('div.hud-bc', (this.hintEl = h('div.hint.hidden')), (this.promptEl = h('div.prompt.hidden'))),
      h('div.hud-bl', h('span', h('kbd', 'E'), ' Use'), h('span', h('kbd', 'Tab'), ' Phone'), h('span', h('kbd', 'M'), ' Map'), h('span', h('kbd', 'T'), ' Wait'), h('span', h('kbd', 'H'), ' Photo'), h('span', h('kbd', 'G'), ' Bike'), h('span', h('kbd', 'X'), ' Actions'), h('span', h('kbd', 'Esc'), ' Menu')),
    );
    this.ringFg = this.el.querySelector('.ring-fg');
    // compass: three turns of ticks so it can scroll either way without a seam
    for (let d = -360; d < 720; d += 15) {
      const a = ((d % 360) + 360) % 360;
      const lbl = DIRS[a];
      this.stripEl.append(h('div.compass-tick' + (lbl ? (a % 90 ? '.mid' : '.major') : ''), { style: { left: (d + 360) * PX + 'px' } }, lbl || ''));
    }
    // always-visible need meters (the mood card still expands to the full panel)
    this.pips = {};
    for (const n of NEEDS) {
      const pip = h('div.pip', { title: n.name + ': ' + n.tip }, h('span', n.icon));
      pip.style.setProperty('--c', n.color);
      this.pips[n.id] = pip;
      this.pipsEl.append(pip);
    }
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
    const life = long ? 9000 : 5200;
    const t = h('div.toast.' + kind, { title: 'Click to dismiss', onclick: () => t.classList.add('out') }, h('div.toast-icon', icon), h('div', h('div.toast-title', title), text ? h('div.toast-text', text) : null), h('div.toast-timer', { style: { animationDuration: life + 'ms' } }));
    this.toastEl.prepend(t);
    this.game.audio?.play(kind === 'bad' ? 'error' : kind === 'good' ? 'success' : 'notify');
    while (this.toastEl.children.length > 5) this.toastEl.lastChild.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 400);
    }, life);
  }

  /** Compass bar: camera heading, waypoint and home bearings (outdoors only). */
  updateCompass(game) {
    const show = !game.inside && !game.build?.active;
    this.compassEl.classList.toggle('hidden', !show);
    if (!show) return;
    // the camera looks along (-sin yaw, -cos yaw); north is -z on the map
    const bearing = ((((-game.cam.yaw * 180) / Math.PI) % 360) + 360) % 360;
    this.stripEl.style.transform = 'translateX(' + (-(bearing + 360) * PX + COMPASS_W / 2).toFixed(1) + 'px)';
    const p = game.player.pos;
    const mark = (el, x, z, text) => {
      if (x == null) return el.classList.add('hidden');
      const b = (Math.atan2(x - p.x, -(z - p.z)) * 180) / Math.PI;
      const d = wrap180(b - bearing);
      el.classList.remove('hidden');
      el.classList.toggle('edge', Math.abs(d) > COMPASS_SPAN / 2 - 8);
      const cl = Math.max(-COMPASS_SPAN / 2 + 8, Math.min(COMPASS_SPAN / 2 - 8, d));
      el.style.left = (COMPASS_W / 2 + cl * PX).toFixed(1) + 'px';
      if (text != null) el.textContent = text;
    };
    const w = game.map.waypoint;
    if (w) {
      const dist = Math.hypot(w.x - p.x, w.z - p.z);
      mark(this.wayMark, w.x, w.z, '📍 ' + (dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist) + ' m'));
    } else mark(this.wayMark, null);
    const home = game.homePlace?.();
    if (home && (!w || w.id !== home.id) && (home.x - p.x) ** 2 + (home.z - p.z) ** 2 > 30 * 30) mark(this.homeMark, home.x, home.z);
    else mark(this.homeMark, null);
  }

  update(dt) {
    const game = this.game;
    const st = game.state;
    if (!st) return;
    // minimap every frame (cheap blit), text 5×/s
    const p = game.playerMapPos();
    game.map.drawMini(this.miniCtx, MINI, p.x, p.z, p.heading);
    this.updateCompass(game);
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
    for (const n of NEEDS) {
      const v = Math.round(st.needs[n.id]);
      const pip = this.pips[n.id];
      if (pip._v === v) continue;
      pip._v = v;
      pip.style.setProperty('--v', v);
      pip.classList.toggle('low', v < BALANCE.needs.low);
    }
    // your dog: happiness and today's walk
    const pet = st.pet;
    this.petEl.classList.toggle('hidden', !pet);
    if (pet) {
      const walked = Math.min(PET.walkMinutes, Math.floor(pet.walked));
      const key = pet.name + Math.round(pet.happy) + '|' + walked;
      if (key !== this._pet) {
        this._pet = key;
        const [mood, face] = petMood(pet.happy);
        clear(this.petEl);
        this.petEl.append(
          h('span.pet-icon', BREED_BY_ID[pet.breed]?.icon || '🐕'),
          h('div', h('div.pet-name', pet.name + ' ' + face), h('div.pet-sub', walked >= PET.walkMinutes ? mood + ' · walked ✓' : 'Walk ' + walked + '/' + PET.walkMinutes + ' min')),
        );
        this.petEl.classList.toggle('warn', pet.happy < 30);
      }
    }
    if (low !== this._low) {
      this.lowEl.textContent = this._low = low;
      this.moodEl.classList.toggle('warn', !!low);
    }
  }
}
