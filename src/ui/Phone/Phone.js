// The in-game smartphone: the main UI hub. Apps register themselves with
// { id, name, icon, color, render(root, ctx), badge?(state) } — adding an app
// never requires touching this shell.
import { h, clear, tolerant } from '../dom.js';
import { fmtClock } from '../../core/Clock.js';

export class Phone {
  constructor(game) {
    this.game = game;
    this.apps = [];
    this.badges = {};
    this.current = null;
    this.el = null;
    game.events.on('badge', ({ app, n = 1 }) => {
      this.badges[app] = (this.badges[app] || 0) + n;
      this.game.hud?.el.classList.add('has-badge');
    });
  }

  register(app) {
    this.apps.push(app);
    return this;
  }
  app(id) {
    return this.apps.find((a) => a.id === id);
  }
  isOpen() {
    return !!this.el;
  }
  toggle() {
    if (this.el) this.close();
    else this.open();
  }
  close() {
    if (this.el) this.game.closeOverlay(this.el);
  }

  open(appId) {
    if (!this.game.state) return;
    if (!this.el) {
      this.screen = h('div.phone-screen');
      this.statusTime = h('span');
      this.el = h(
        'div.overlay.phone-overlay',
        { onclick: (e) => e.target === this.el && this.close() },
        h(
          'div.phone',
          h('div.phone-notch'),
          h('div.phone-status', this.statusTime, h('span.grow'), h('span', '📶 5G  🔋')),
          this.screen,
          h('button.phone-home', { onclick: () => (this.current ? this.home() : this.close()), title: 'Home' }),
        ),
      );
      this.game.openOverlay(this.el, {
        onClose: () => {
          this.el = null;
          this.current = null;
        },
      });
      this.game.audio?.play('swoosh');
    }
    this.statusTime.textContent = fmtClock(this.game.state.time.total);
    if (appId && this.app(appId)) this.go(appId);
    else this.home();
  }

  home() {
    this.current = null;
    const st = this.game.state;
    const s = clear(this.screen);
    s.className = 'phone-screen home';
    s.append(
      h('div.phone-hello', h('div.phone-date', new Date().getHours() < 12 ? 'Good morning' : 'Hey', `, ${st.profile.name.split(' ')[0]}`), h('div.muted.small', 'What is the plan today?')),
      h(
        'div.app-grid',
        this.apps.map((a) => {
          const n = (this.badges[a.id] || 0) + (a.badge ? a.badge(st, this.game) || 0 : 0);
          return h(
            'button.app-icon',
            { onclick: () => this.go(a.id) },
            h('div.app-tile', { style: { background: a.color } }, a.icon, n ? h('span.app-badge', n > 9 ? '9+' : String(n)) : null),
            h('div.app-name', a.name),
          );
        }),
      ),
    );
  }

  go(appId) {
    const app = this.app(appId);
    if (!app) return;
    this.current = app;
    this.badges[appId] = 0;
    this.game.audio?.play('click');
    this.render(true);
  }

  /** Re-render the open app (keeps scroll position unless `fresh`). */
  refresh() {
    if (this.el && this.current) this.render(false);
    else if (this.el) this.home();
  }

  render(fresh) {
    const app = this.current;
    const s = this.screen;
    const keep = fresh ? 0 : s.querySelector('.app-body')?.scrollTop || 0;
    clear(s);
    s.className = 'phone-screen app' + (fresh ? ' enter' : '');
    const body = tolerant(h('div.app-body'));
    s.append(h('div.app-head', { style: { background: app.color } }, h('button.app-back', { onclick: () => this.home() }, '‹'), h('div.app-title', `${app.icon} ${app.name}`)), body);
    const game = this.game;
    app.render(body, { game, sim: game.sim, state: game.state, phone: this, refresh: () => this.refresh() });
    body.scrollTop = keep;
  }
}
