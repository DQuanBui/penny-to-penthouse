// Dev-only debug panel (F1). Loaded with a dynamic import behind
// import.meta.env.DEV, so it is not part of production builds.
import { h, btn } from './dom.js';
import { SKILLS } from '../data/archetypes.js';
import { LIFE_EVENTS } from '../data/events.js';

export function installDebug(game) {
  let el = null;
  const need = () => !!game.state;
  const close = () => {
    el?.remove();
    el = null;
  };
  const open = () => {
    const events = h('select.text', LIFE_EVENTS.map((e) => h('option', { value: e.id }, e.title)));
    const row = (...kids) => h('div.dbg-row', kids);
    el = h(
      'div.dbg',
      h('div.dbg-title', '🛠 Debug (F1)', btn('✕', close, 'small')),
      row(btn('+$1,000', () => need() && game.sim.finance.earn(1000, 'other_in', 'Debug'), 'small'), btn('+$50,000', () => need() && game.sim.finance.earn(50000, 'other_in', 'Debug'), 'small'), btn('+$1M', () => need() && game.sim.finance.earn(1e6, 'other_in', 'Debug'), 'small')),
      row([6, 9, 12, 18, 22].map((hr) => btn(`${hr}:00`, () => need() && (game.state.time.total = Math.floor(game.state.time.total / 1440) * 1440 + hr * 60), 'small'))),
      row(btn('+1 hour', () => need() && game.sim.advance(60, { noCollapse: true }), 'small'), btn('+1 day', () => need() && game.sim.advance(1440, { noDecay: true, noCollapse: true }), 'small'), btn('+28 days', () => need() && game.sim.advance(1440 * 28, { noDecay: true, noCollapse: true }), 'small')),
      row(
        btn('Max skills', () => need() && SKILLS.forEach((s) => (game.state.skills[s.id] = 10)), 'small'),
        btn('Fill needs', () => need() && Object.keys(game.state.needs).forEach((k) => (game.state.needs[k] = 100)), 'small'),
        btn('Followers +10k', () => need() && (game.state.social.followers += 10000), 'small'),
      ),
      row((game.city?.districts || []).map((d) => btn(d.name, () => {
        if (!need()) return;
        if (game.inside) game.leaveInterior(true);
        game.vehicles.exit(true);
        const st = game.city.places.find((p) => p.station && p.district === d);
        game.placePlayerAt(st);
      }, 'small'))),
      row(events, btn('Trigger event', () => need() && game.sim.events.trigger(events.value), 'small')),
      row(btn('All friends +30', () => need() && game.sim.rel.all.forEach((n) => game.sim.rel.add(n.id, 30)), 'small'), btn('Finish class', () => {
        const en = game.state?.education.enrolled;
        if (en) en.done = 999;
      }, 'small')),
    );
    game.ui.append(el);
  };
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F1') return;
    e.preventDefault();
    el ? close() : open();
  });
}
