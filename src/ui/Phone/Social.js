// Social app ("Pulse"): followers, popularity, posts, sponsored posts and parties.
import { h, btn } from '../dom.js';
import { confirmBox } from '../Menus.js';
import { POST_KINDS, SPONSOR_MIN_FOLLOWERS, VIP_POPULARITY } from '../../sim/Popularity.js';
import { fmtMoney, fmtNum } from '../../core/utils.js';
import { fmtDay, hourOf } from '../../core/Clock.js';
import { section, row, empty } from './widgets.js';

export const SocialApp = {
  id: 'social',
  name: 'Pulse',
  icon: '📸',
  color: 'linear-gradient(135deg,#ff5f8f,#ff9a4a)',
  render(root, { game, sim, state, refresh }) {
    const s = state.social;
    const soc = sim.social;
    soc.recompute();
    const ctx = game.postContext();
    const opts = soc.postOptions(ctx);
    const sp = soc.sponsorInfo();
    root.append(
      h(
        'div.card.hero',
        h('div.row.between', h('div', h('div.muted.small', '@' + state.profile.name.toLowerCase().replace(/[^a-z]+/g, '')), h('div.big', fmtNum(s.followers)), h('div.muted.small', 'followers')), h('div', { style: { textAlign: 'right' } }, h('div.muted.small', 'Popularity'), h('div.big', String(Math.round(s.popularity))), h('div.small.' + (s.popularity >= VIP_POPULARITY ? 'good' : 'muted'), s.popularity >= VIP_POPULARITY ? '⭐ VIP' : `VIP at ${VIP_POPULARITY}`))),
        h('div.bar', h('div.bar-fill', { style: { width: s.popularity + '%', background: 'linear-gradient(90deg,#ff5f8f,#ffb347)' } })),
      ),
      section(
        'New post',
        Object.entries(POST_KINDS).map(([k, [label, icon]]) =>
          row({
            icon,
            title: label + (k === 'landmark' && ctx.landmark ? ` — ${ctx.landmark}` : ''),
            sub: opts[k] || 'Ready to post',
            right: btn('Post', () => {
              const r = soc.post(k, ctx);
              game.audio?.play('notify');
              game.events.emit('toast', { icon, title: `${label} posted`, text: `+${fmtNum(r.gain)} followers`, kind: 'good' });
              refresh();
            }, 'small primary' + (opts[k] ? ' disabled' : '')),
          }),
        ),
      ),
      section(
        'Earn',
        row({
          icon: '💼',
          title: 'Sponsored post',
          sub: sp.unlocked ? (sp.wait ? `Next brand deal in ${sp.wait} day${sp.wait > 1 ? 's' : ''}` : 'A brand wants to work with you') : `Unlocks at ${fmtNum(SPONSOR_MIN_FOLLOWERS)} followers`,
          right: btn(sp.unlocked ? fmtMoney(sp.pay) : '🔒', () => {
            const net = soc.sponsored();
            if (net) game.events.emit('toast', { icon: '💼', title: 'Brand deal paid', text: `${fmtMoney(net)} after tax.`, kind: 'good' });
            refresh();
          }, 'small primary' + (sp.unlocked && !sp.wait ? '' : ' disabled')),
        }),
        row({
          icon: '🎉',
          title: 'Throw a house party',
          sub: partyHint(game, sim, state),
          right: btn('Plan', () => planParty(game, refresh), 'small' + (canParty(game, sim, state) ? ' primary' : ' disabled')),
        }),
      ),
      section('Your feed', s.posts.length ? s.posts.slice(0, 10).map((p) => row({ icon: POST_KINDS[p.kind][1], title: `${p.text}${p.viral ? ' 🔥' : ''}`, sub: `${fmtDay(p.day)} · ♥ ${fmtNum(p.likes)}${p.where ? ' · ' + p.where : ''}`, right: h('span.good', '+' + fmtNum(p.gain)) })) : empty('Nothing posted yet. Your first selfie is waiting.')),
    );
  },
};

function canParty(game, sim, state) {
  const hour = hourOf(state.time.total);
  return game.inside?.home && state.home.type !== 'couch' && sim.rel.known(1).filter((n) => !n.away).length >= 2 && hour >= 16 && hour < 23 && state.social.lastPartyDay !== sim.day;
}
function partyHint(game, sim, state) {
  if (state.home.type === 'couch') return 'Not on someone else’s couch.';
  if (sim.rel.known(1).filter((n) => !n.away).length < 2) return 'You need at least 2 acquaintances to invite.';
  if (!game.inside?.home) return 'Plan it from inside your home.';
  const hour = hourOf(state.time.total);
  if (hour < 16 || hour >= 23) return 'Parties start between 4 PM and 11 PM.';
  if (state.social.lastPartyDay === sim.day) return 'One party a day is plenty.';
  return 'Friends, music, 4 hours. Boosts friendships and followers.';
}

async function planParty(game, refresh) {
  const sim = game.sim;
  const guests = sim.rel.known(1).filter((n) => !n.away).slice(0, 8);
  const cost = sim.social.partyCost(guests.length);
  const ok = await confirmBox(game, { title: '🎉 House party', text: `Invite ${guests.map((g) => g.first).join(', ')}? Snacks and drinks for ${guests.length} cost ${fmtMoney(cost)}. A stylish home makes a better party.`, yes: `Party! (${fmtMoney(cost)})` });
  if (!ok) return;
  game.phone.close();
  let res;
  await game.fade(() => {
    res = sim.social.throwParty(guests.map((g) => g.id));
  });
  if (res) game.events.emit('toast', { icon: '🎉', title: 'Party of the week', text: `${guests.length} guests, closer friendships and +${res.gain} followers.`, kind: 'good', long: true });
  refresh();
}
