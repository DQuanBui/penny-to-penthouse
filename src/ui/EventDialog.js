// Shows a pending random life event and lets the player choose.
import { h, btn } from './dom.js';
import { dialog } from './Menus.js';

export function openLifeEvent(game) {
  const ev = game.sim.events.pending();
  if (!ev) return;
  const body = h('div.col');
  const el = dialog(game, { title: `${ev.def.icon} ${ev.def.title}`, body, closable: false, wide: true });
  body.append(
    h('div.event-text', ev.text),
    ...ev.def.choices.map((c, i) =>
      h(
        'button.btn.answer',
        {
          onclick: () => {
            const result = game.sim.events.resolve(i);
            game.audio?.play('click');
            body.replaceChildren(h('div.event-text', result), btn('Continue', () => game.closeOverlay(el), 'primary'));
          },
        },
        c.label,
      ),
    ),
  );
  game.audio?.play('notify');
}
