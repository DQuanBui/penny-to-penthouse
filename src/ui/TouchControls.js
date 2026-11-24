// On-screen controls for phones and tablets: a floating joystick on the left,
// drag anywhere on the right to look around (pinch to zoom), and buttons for
// Use / Jump / Run / Phone / Map / Actions / Bike / Menu. Everything is fed
// into the same Input object the keyboard and mouse use, so the game itself
// does not need to know whether it is being played by touch.
import { h } from './dom.js';

const R = 56; // joystick radius in px

/** Touch UI wanted? Settings 'touch' = auto | on | off; ?touch=1 forces it on. */
export function touchWanted(settings) {
  const pref = settings?.get('touch') ?? 'auto';
  if (pref === 'on') return true;
  if (pref === 'off') return false;
  try {
    if (new URLSearchParams(location.search).has('touch')) return true;
    return matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches;
  } catch {
    return false;
  }
}

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.input = game.input;
    this.on = false;
    this.stick = null; // { id, x0, y0 }
    this.looks = new Map(); // pointerId -> { x, y }
    this.pinch = 0;
    this.run = false;
    this.el = null;
  }

  enable(on) {
    if (on === this.on) return;
    this.on = on;
    document.body.classList.toggle('touch-ui', on);
    if (on && !this.el) this.build();
    if (this.el) this.el.style.display = on ? '' : 'none';
    if (!on) this.release();
  }

  build() {
    const zone = (cls, down) => {
      const z = h('div.' + cls);
      z.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        z.setPointerCapture?.(e.pointerId);
        down(e);
      });
      z.addEventListener('pointermove', (e) => this.move(e));
      const up = (e) => this.up(e);
      z.addEventListener('pointerup', up);
      z.addEventListener('pointercancel', up);
      return z;
    };
    const key = (cls, label, code, title) => {
      const b = h('button.tbtn.' + cls, { title }, label);
      const press = (e) => {
        e.preventDefault();
        this.buzz();
        const c = typeof code === 'function' ? code() : code;
        if (!c) return;
        b._code = c;
        this.input.justPressed.add(c);
        this.input.down.add(c);
        b.classList.add('down');
      };
      const release = (e) => {
        e?.preventDefault();
        if (b._code) this.input.down.delete(b._code);
        b._code = null;
        b.classList.remove('down');
      };
      b.addEventListener('pointerdown', press);
      b.addEventListener('pointerup', release);
      b.addEventListener('pointercancel', release);
      b.addEventListener('pointerleave', release);
      return b;
    };
    this.base = h('div.tstick-base', (this.knob = h('div.tstick-knob')));
    this.useBtn = key('t-use', h('span.tuse-label', 'Use'), () => (this.game.interactable?.key === 'F' ? 'KeyF' : 'KeyE'), 'Use / talk / enter');
    this.runBtn = h('button.tbtn.t-run', { title: 'Run' }, '🏃');
    this.runBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.buzz();
      this.run = !this.run;
      this.runBtn.classList.toggle('down', this.run);
      if (!this.run) this.input.down.delete('ShiftLeft');
    });
    this.closeBtn = key('t-close', '✕', 'Escape', 'Close');
    this.el = h(
      'div.touch',
      zone('tzone.left', (e) => this.startStick(e)),
      zone('tzone.right', (e) => this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY })),
      this.base,
      h('div.tbtns', this.useBtn, key('t-jump', '⤒', 'Space', 'Jump'), this.runBtn, key('t-act', '😀', 'KeyX', 'Actions'), key('t-bike', '🚲', 'KeyG', 'Bike')),
      h('div.ttop', key('t-phone', '📱', 'Tab', 'Phone'), key('t-map', '🗺️', 'KeyM', 'Map'), key('t-menu', '☰', 'Escape', 'Menu')),
      this.closeBtn,
    );
    this.base.style.display = 'none';
    document.body.append(this.el);
  }

  /** A short tick from the vibration motor on button presses (Settings: Vibrate on touch buttons). */
  buzz(ms = 12) {
    if (this.game.settings.get('haptics') === false) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* not supported */
    }
  }

  startStick(e) {
    this.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
    this.base.style.display = '';
    this.base.style.left = e.clientX - R + 'px';
    this.base.style.top = e.clientY - R + 'px';
    this.setStick(0, 0);
  }

  move(e) {
    if (this.stick?.id === e.pointerId) {
      let dx = e.clientX - this.stick.x0;
      let dy = e.clientY - this.stick.y0;
      const m = Math.hypot(dx, dy);
      if (m > R) {
        dx = (dx / m) * R;
        dy = (dy / m) * R;
      }
      this.setStick(dx / R, dy / R);
      return;
    }
    const p = this.looks.get(e.pointerId);
    if (!p) return;
    if (this.looks.size >= 2) {
      // pinch: the distance between the two fingers zooms the camera
      p.x = e.clientX;
      p.y = e.clientY;
      const [a, b] = [...this.looks.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch) this.input.wheel += (this.pinch - d) / 60;
      this.pinch = d;
      return;
    }
    const s = 2.2 * (this.game.settings.get('touchLook') || 1);
    this.input.mouseDX += (e.clientX - p.x) * s;
    this.input.mouseDY += (e.clientY - p.y) * s;
    p.x = e.clientX;
    p.y = e.clientY;
  }

  up(e) {
    if (this.stick?.id === e.pointerId) {
      this.stick = null;
      this.base.style.display = 'none';
      this.setStick(0, 0);
    }
    this.looks.delete(e.pointerId);
    if (this.looks.size < 2) this.pinch = 0;
  }

  /** Joystick -> analog axis (PlayerController) and WASD (cars, bikes, sitting up). */
  setStick(x, y) {
    this.knob.style.transform = `translate(${x * R}px, ${y * R}px)`;
    const m = Math.hypot(x, y);
    const inp = this.input;
    inp.axis = m > 0.15 ? { x, y, m } : null;
    const set = (code, on) => {
      if (on && !inp.down.has(code)) {
        inp.down.add(code);
        inp.justPressed.add(code);
      } else if (!on) inp.down.delete(code);
    };
    set('KeyW', y < -0.35);
    set('KeyS', y > 0.35);
    set('KeyA', x < -0.35);
    set('KeyD', x > 0.35);
    set('ShiftLeft', this.run || m > 0.95);
  }

  release() {
    this.stick = null;
    this.looks.clear();
    if (this.base) this.base.style.display = 'none';
    for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) this.input.down.delete(c);
    this.input.axis = null;
  }

  /** Per frame: show what the Use button will do, and step aside while menus are open. */
  update() {
    if (!this.on || !this.el) return;
    const g = this.game;
    const playing = g.mode === 'play';
    const blocked = !playing || g.overlays.length > 0 || g.fading || g.build?.active;
    this.el.classList.toggle('blocked', blocked);
    this.el.classList.toggle('offplay', !playing);
    this.closeBtn.style.display = playing && g.overlays.length ? '' : 'none';
    if (blocked && (this.stick || this.looks.size)) this.release();
    const it = g.interactable;
    const raw = it?.label ? it.label.replace(/^[^\p{L}\p{N}]+/u, '') : '';
    const label = raw.length > 22 ? raw.slice(0, 21) + '…' : raw;
    if (label !== this._label) {
      this._label = label;
      this.useBtn.firstChild.textContent = label || 'Use';
      this.useBtn.classList.toggle('ready', !!label);
    }
  }
}
