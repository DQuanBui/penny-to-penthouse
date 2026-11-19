// X: actions and emotes. Wave, cheer, dance (passers-by may tip you), jumping
// jacks, sit on the ground, take a phone call, snap a selfie.
import { h, btn } from './dom.js';
import { dialog } from './Menus.js';

export const EMOTES = [
  { id: 'wave', icon: '👋', name: 'Wave', time: 2.2 },
  { id: 'cheer', icon: '🙌', name: 'Cheer', time: 2.4 },
  { id: 'dance', icon: '💃', name: 'Dance', hint: 'Dance until you move. Dance near people and someone might tip you.' },
  { id: 'jacks', icon: '🤸', name: 'Jumping jacks', hint: 'Good for Health, costs Energy. Move to stop.' },
  { id: 'sit', icon: '🧘', name: 'Sit on the ground', hint: 'Rest for a bit. Move to get up.' },
  { id: 'phone', icon: '📞', name: 'Take a phone call', hint: 'Chat away. Move to hang up.' },
  { id: 'selfie', icon: '🤳', name: 'Take a selfie', time: 2 },
];

/** Activity rates while an emote is held (sim.advance). */
export const EMOTE_RATES = {
  dance: { rates: { fun: 8, energy: -5 } },
  jacks: { rates: { health: 4, energy: -9, fun: 2 } },
  sit: { rates: { energy: 3, fun: 3 } },
  phone: { rates: { social: 6 } },
  volley: { rates: { fun: 10, health: 3, social: 4, energy: -5 } },
};

export function openEmotes(game) {
  const el = dialog(game, {
    title: '🎭 Actions',
    body: h(
      'div.emote-grid',
      EMOTES.map((e) =>
        btn(`${e.icon}  ${e.name}`, () => {
          game.closeOverlay(el);
          startEmote(game, e);
        }),
      ),
    ),
  });
}

export function startEmote(game, e) {
  const p = game.player;
  if (game.vehicles.driving || p.riding) return game.events.emit('toast', { icon: '🎭', title: 'Not now', text: 'Get out of the car (or off the bike) first.', kind: 'info' });
  if (p.sitting) game.standUp();
  p.emote = { id: e.id, t: e.time || 0, held: !e.time, tipT: 6 };
  if (e.hint) game.hud.hint('emote_' + e.id, e.hint, 6);
  if (e.id === 'selfie') {
    const sim = game.sim;
    const why = sim.social.postOptions(game.postContext()).selfie;
    game.audio?.play('shutter');
    if (why) game.events.emit('toast', { icon: '🤳', title: 'Nice selfie', text: 'Saved to your camera roll. (' + why + ')', kind: 'info' });
    else {
      const r = sim.social.post('selfie', game.postContext());
      game.events.emit('toast', { icon: '🤳', title: 'Selfie posted', text: `+${r.gain} followers`, kind: 'good' });
    }
  }
}

/** Per frame while an emote plays: timers and street tips for dancing. */
export function updateEmote(game, dt) {
  const em = game.player.emote;
  if (!em) return;
  if (em.hit > 0) em.hit -= dt;
  if (!em.held) {
    em.t -= dt;
    if (em.t <= 0) game.player.emote = null;
    return;
  }
  if (em.id === 'dance' && !game.inside) {
    em.tipT -= dt;
    if (em.tipT <= 0) {
      em.tipT = 8 + Math.random() * 10;
      const c = game.crowd;
      const p = game.player.pos;
      let watchers = 0;
      for (let i = 0; i < c.n; i++) if (c.alive[i] && (c.x[i] - p.x) ** 2 + (c.z[i] - p.z) ** 2 < 12 * 12) watchers++;
      if (watchers >= 2 && Math.random() < 0.55) {
        const tip = [1, 2, 5][Math.floor(Math.random() * 3)];
        game.sim.finance.earn(tip, 'tips', 'Street dancing tip');
        game.audio?.play('cash');
        game.events.emit('toast', { icon: '💵', title: `A passer-by tips you $${tip}`, text: 'Nice moves!', kind: 'good' });
      }
    }
  }
}
