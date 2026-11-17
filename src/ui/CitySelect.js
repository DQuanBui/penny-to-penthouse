// City select: compare the five cities (rent, pay, industries, weather, vibe).
// The 3D skyline behind the panel switches to the highlighted city.
import { h, btn } from './dom.js';
import { CITIES } from '../data/cities/index.js';
import { rentFor } from '../data/homes.js';
import { fmtMoney } from '../core/utils.js';

const meter = (v, min, max, color) => h('div.bar', h('div.bar-fill', { style: { width: Math.round(((v - min) / (max - min)) * 80 + 20) + '%', background: color } }));

export class CitySelect {
  /**
   * @param onPick(cityId)
   * @param onBack()
   */
  constructor(game, onPick, onBack) {
    this.game = game;
    this.onPick = onPick;
    this.onBack = onBack;
    this.sel = game.city?.cfg.id || CITIES[0].id;
    this.el = h('div.cityselect');
    game.ui.append(this.el);
    this.render();
  }

  pick(id) {
    if (this.sel === id) return;
    this.sel = id;
    this.game.loadCity(id, 'summer'); // live skyline preview
    this.render();
  }

  render() {
    const c = CITIES.find((x) => x.id === this.sel);
    const cheapest = [...c.districts].sort((a, b) => a.rentMul - b.rentMul)[0];
    this.el.replaceChildren(
      h(
        'div.city-panel',
        h('div.creator-head', h('div.creator-title', 'Choose your city'), h('div.muted', 'Each city has its own economy, weather and neighbourhoods.')),
        h(
          'div.city-list',
          CITIES.map((x) =>
            h(
              'button.city-card' + (x.id === this.sel ? '.active' : ''),
              { onclick: () => this.pick(x.id) },
              h('div.row.between', h('b', `${x.name}, ${x.state}`), h('span.muted.small', x.topIndustries.join(' · '))),
              h('div.city-meters', h('span.muted.small', 'Rent'), meter(x.rentIndex, 0.9, 1.6, '#ff8a5c'), h('span.muted.small', 'Pay'), meter(x.salaryIndex, 0.95, 1.35, '#4fd18b')),
            ),
          ),
        ),
        h(
          'div.city-detail',
          h('div.big', c.name),
          h('div.city-tag', `“${c.tagline}”`),
          h('div.muted.small', c.vibe),
          h(
            'div.city-stats',
            h('div', h('div.muted.small', 'Rent index'), h('b', `${Math.round(c.rentIndex * 100)}`)),
            h('div', h('div.muted.small', 'Salary index'), h('b', `${Math.round(c.salaryIndex * 100)}`)),
            h('div', h('div.muted.small', 'A room from'), h('b', `${fmtMoney(rentFor('room', c, cheapest))}/mo`)),
            h('div', h('div.muted.small', 'Transit'), h('b', `${c.transit.icon} ${fmtMoney(c.transit.fare)}`)),
          ),
          h('div.small', h('span.muted', 'Best-paid here: '), Object.entries(c.industries).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)} +${Math.round((v - 1) * 100)}%`).join(' · ')),
          h('div.small', h('span.muted', 'Weather: '), c.weather.summary),
          h('div.small', h('span.muted', 'Districts: '), c.districts.map((d) => d.name).join(' · ')),
        ),
        h('div.creator-foot', btn('Back', () => this.onBack()), h('div.grow'), btn(`Move to ${c.name} →`, () => this.onPick(this.sel), 'primary')),
      ),
    );
  }

  close() {
    this.el.remove();
  }
}
