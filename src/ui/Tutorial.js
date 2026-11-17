// "First Day": an optional guided start. Wake up in your rented room, check
// your phone, buy a coffee, apply for a job, make a friend. Progress is driven
// by game events, so the player is never locked into a script.
import { h, btn } from './dom.js';
import { dialog } from './Menus.js';
import { fmtMoney } from '../core/utils.js';

const REWARD = 60;

export class Tutorial {
  constructor(game) {
    this.game = game;
    this.moved = 0;
    this._last = null;
    const cafe = () => game.city.places.find((p) => p.type === 'cafe');
    this.steps = [
      { id: 'move', title: 'Good morning! Look around your room', sub: 'W A S D to walk · drag the mouse to look · Shift to run' },
      { id: 'phone', title: 'Check your phone', sub: 'Press Tab. Bank, Jobs, Map — your whole life runs through it.' },
      { id: 'coffee', title: 'Buy a coffee', sub: () => `Leave through the door (E) and follow the GPS line to ${cafe()?.name || 'the café'}. Order at the counter.`, enter: () => game.map.setWaypoint(cafe()) },
      { id: 'job', title: 'Apply for your first job', sub: 'Phone (Tab) → Jobs → Openings → Apply. Entry roles need no experience.', enter: () => game.map.setWaypoint(null) },
      { id: 'friend', title: 'Make a friend', sub: 'People with a name tag sit on benches and hang out by shops. Walk up and press E.' },
    ];
    // doing a later step early still counts: jump ahead instead of making the player repeat it
    const on = (ev, id, test) =>
      game.events.on(ev, (p) => {
        const i = this.steps.findIndex((s) => s.id === id);
        if (!this.active || i < this.flags.step || (test && !test(p))) return;
        this.flags.step = i;
        this.next();
      });
    on('phoneOpened', 'phone');
    on('activityDone', 'coffee', (p) => ['coffee', 'pastry', 'cafe_meal'].includes(p.id));
    on('interview', 'job');
    on('hired', 'job');
    on('talked', 'friend');
  }

  get flags() {
    return this.game.state?.flags.tutorial;
  }
  get active() {
    return !!this.flags?.active;
  }
  get step() {
    return this.steps[this.flags.step] || this.steps[0];
  }

  /** Offer the tutorial at the start of a new life. */
  offer() {
    const game = this.game;
    const f = this.flags;
    f.active = false;
    const el = dialog(game, {
      title: '☀️ Your first day',
      closable: false,
      body: h('div', h('p', `You have ${fmtMoney(game.state.money.checking)}, a rented room and a whole city to figure out.`), h('p.muted', 'Want a two-minute guided start? It covers moving, your phone, buying a coffee, landing a job and meeting someone.')),
      buttons: [
        btn('Skip — I will figure it out', () => {
          f.done = true;
          game.closeOverlay(el);
        }),
        btn('Start "First Day"', () => {
          f.active = true;
          f.step = 0;
          game.closeOverlay(el);
        }, 'primary'),
      ],
    });
  }

  next() {
    const game = this.game;
    const f = this.flags;
    f.step++;
    game.audio?.play('success');
    if (f.step >= this.steps.length) {
      f.active = false;
      f.done = true;
      game.sim.finance.earn(REWARD, 'gift', 'Welcome-to-the-city gift from home');
      game.events.emit('toast', { icon: '🎓', title: 'First Day complete!', text: `Your family sent ${fmtMoney(REWARD)} to celebrate. Now build your life — check Goals on your phone.`, kind: 'good', long: true });
      game.events.emit('tutorialDone', {});
      return;
    }
    this.step.enter?.();
  }

  /** HUD objective while the tutorial is running. */
  objective() {
    if (!this.active) return null;
    const s = this.step;
    return [`${this.flags.step + 1}/${this.steps.length} · ${s.title}`, typeof s.sub === 'function' ? s.sub() : s.sub];
  }

  update() {
    if (!this.active || this.step.id !== 'move') return;
    const p = this.game.player.pos;
    if (this._last) this.moved += Math.hypot(p.x - this._last.x, p.z - this._last.z);
    this._last = { x: p.x, z: p.z };
    if (this.moved > 1.5) {
      this.moved = 0;
      this._last = null;
      this.next();
    }
  }
}
