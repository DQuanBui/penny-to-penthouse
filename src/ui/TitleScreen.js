// Title screen overlay. The Game renders the 3D sunset skyline flyover behind it.
import { h, btn } from './dom.js';
import { latestSlot, listSlots } from '../core/SaveSystem.js';
import { openSlots, openSettings, openCredits } from './Menus.js';

export class TitleScreen {
  constructor(game) {
    this.game = game;
    this.el = h('div.title-screen');
    game.ui.append(this.el);
    this.off = game.events.on('slotsChanged', () => this.render());
    this.render();
  }

  render() {
    const game = this.game;
    const latest = latestSlot();
    const any = listSlots().some((s) => s.meta);
    this.el.replaceChildren(
      h(
        'div.title-box',
        h('div.logo', h('div.logo-top', 'PENNY', h('span', ' TO')), h('div.logo-bottom', 'PENTHOUSE')),
        h('div.tagline', 'Start with nothing. Build everything.'),
        h(
          'div.title-menu',
          latest ? btn('Continue', () => game.loadGame(latest), 'primary') : null,
          btn('New Life', () => game.newLife(), latest ? '' : 'primary'),
          any ? btn('Load', () => openSlots(game, 'load')) : null,
          btn('Settings', () => openSettings(game)),
          btn('Credits', () => openCredits(game)),
        ),
      ),
      h('div.title-foot', 'A life simulation by Quan Bui · Built with Claude'),
    );
  }

  close() {
    this.off();
    this.el.remove();
  }
}
