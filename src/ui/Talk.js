// Conversation panel shown when the player talks to a named NPC.
import { h, btn, tolerant } from './dom.js';
import { TALK_ACTIONS, HANGOUTS, REL_LEVELS, REL_ICONS, relLevel } from '../sim/Relationships.js';
import { PERSONALITY } from '../data/npcs/index.js';
import { GIFTS } from '../data/items.js';
import { BALANCE } from '../data/balance.js';
import { priceOf } from '../sim/Activities.js';
import { fmtMoney } from '../core/utils.js';

const S = BALANCE.social;

/** Friendship bar with the level thresholds marked. */
export function relBar(score) {
  const lvl = relLevel(score);
  return h(
    'div.rel',
    h('div.row.between', h('span', `${REL_ICONS[lvl]} ${REL_LEVELS[lvl]}`), h('span.muted.small', lvl < 3 ? `${Math.round(score)} / ${S.levels[lvl + 1]}` : 'max')),
    h('div.bar', h('div.bar-fill', { style: { width: score + '%', background: lvl >= 3 ? '#ffd24a' : lvl >= 2 ? 'var(--good)' : 'var(--info)' } })),
  );
}

/**
 * @param actor optional world actor { rig, talking } so both characters face each other
 */
export function openTalk(game, npc, actor) {
  const sim = game.sim;
  const rel = sim.rel;
  const st = game.state;
  const first = !st.relationships[npc.id];
  rel.rel(npc.id, true);
  if (first) rel.add(npc.id, 2);
  let line = first ? `"Hey — I do not think we have met. I am ${npc.first}."` : relLevel(rel.score(npc.id)) >= 2 ? `"${st.profile.name.split(' ')[0]}! Good to see you."` : '"Oh, hey again."';
  let note = null;
  let sub = null; // 'hang' | 'gift'
  const body = tolerant(h('div.col'));
  if (actor) {
    actor.talking = true;
    game.player.talking = true;
    const p = actor.rig.group.position;
    game.player.heading = Math.atan2(p.x - game.player.pos.x, p.z - game.player.pos.z);
    game.player.sync();
  }
  const el = h('div.overlay.talk-overlay', { onclick: (e) => e.target === el && game.closeOverlay(el) }, h('div.talk', body));
  game.openOverlay(el, {
    onClose: () => {
      if (actor) actor.talking = false;
      game.player.talking = false;
      game.npcs?.refreshTag?.(actor || {});
    },
  });

  const act = (fn) => {
    const r = fn();
    if (r?.text) line = r.text;
    note = r?.perk || (r?.delta ? `${r.delta > 0 ? '+' : ''}${r.delta.toFixed(1)} friendship` : null);
    game.audio?.play(r?.ok === false ? 'error' : 'click');
    sub = null;
    render();
  };

  const render = () => {
    const score = rel.score(npc.id);
    const lvl = relLevel(score);
    const r = rel.rel(npc.id);
    const left = Math.max(0, S.maxPerDayPerNpc - (r.todayDay === sim.day ? r.today : 0));
    body.replaceChildren();
    body.append(
      h('div.talk-head', h('div.talk-avatar', npc.first[0]), h('div.grow', h('div.talk-name', npc.name), h('div.muted.small', `${npc.job} · ${PERSONALITY[npc.personality].label} · likes ${npc.interests.slice(0, 2).join(', ')}`))),
      relBar(score),
      h('div.talk-line', line),
      note ? h('div.talk-note', note) : null,
    );
    if (sub === 'hang') {
      const ho = rel.hangoutOptions(npc.id);
      body.append(
        ho.reason ? h('div.muted', ho.reason) : null,
        (ho.options || []).map((k) => {
          const [label, icon, minutes, priceKey] = HANGOUTS[k];
          const cost = priceKey ? priceOf(sim, priceKey) * 2 : 0;
          return btn(`${icon}  ${label}  ·  ${minutes} min${cost ? `  ·  ${fmtMoney(cost)} (your treat)` : ''}`, async () => {
            let res;
            await game.fade(() => {
              res = rel.hangout(npc.id, k);
            });
            if (res.ok) {
              line = `You ${label.toLowerCase()} together. Good times.`;
              note = `+${res.delta.toFixed(1)} friendship`;
            }
            sub = null;
            render();
          });
        }),
        btn('← Back', () => ((sub = null), render()), 'small'),
      );
      return;
    }
    if (sub === 'gift') {
      body.append(
        GIFTS.map((g) => btn(`${g.icon}  ${g.name}  ·  ${fmtMoney(g.price)}`, () => act(() => rel.gift(npc.id, g.id)))),
        btn('← Back', () => ((sub = null), render()), 'small'),
      );
      return;
    }
    body.append(
      h(
        'div.talk-actions',
        Object.entries(TALK_ACTIONS).map(([id, a]) => btn(`${a.icon} ${a.label}`, () => act(() => rel.talk(npc.id, id)), left ? '' : 'disabled')),
        btn('🤝 Hang out…', () => ((sub = 'hang'), render())),
        btn('🎁 Give a gift…', () => ((sub = 'gift'), render())),
        lvl >= 2 && !r.dating ? btn('💘 Ask on a date', () => act(() => rel.askDate(npc.id))) : null,
        r.dating && score >= 85 && st.flags.partner !== npc.id ? btn('💞 Become partners', () => (rel.makePartner(npc.id), (line = '"I was hoping you would ask."'), render()), 'primary') : null,
        lvl >= 3 && !st.home.owned && st.home.type !== 'couch' && !st.home.roommate ? btn('🏠 Ask to be roommates', () => (rel.makeRoommate(npc.id), (line = '"Splitting rent? Yes. When do I move in?"'), render())) : null,
      ),
      h('div.row.between', h('span.muted.small', left ? `${left} more conversation${left > 1 ? 's' : ''} today` : `${npc.first} has to get going — talk again tomorrow.`), btn('Goodbye', () => game.closeOverlay(el), 'small')),
    );
  };
  render();
  game.events.emit('talked', { npc });
  return el;
}
