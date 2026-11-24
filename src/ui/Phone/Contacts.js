// Contacts & Messages: everyone you have met, where they are right now, and
// your inbox (party invites, referrals, check-ins).
import { h, btn } from '../dom.js';
import { REL_ICONS, REL_LEVELS, relLevel, HANGOUTS } from '../../sim/Relationships.js';
import { PERSONALITY } from '../../data/npcs/index.js';
import { priceOf } from '../../sim/Activities.js';
import { addNeed } from '../../sim/Needs.js';
import { hourOf, fmtDay } from '../../core/Clock.js';
import { fmtMoney } from '../../core/utils.js';
import { section, row, tabs, empty } from './widgets.js';
import { relBar } from '../Talk.js';

export const ContactsApp = {
  id: 'contacts',
  name: 'Contacts',
  icon: '💬',
  color: 'linear-gradient(135deg,#34c759,#1f9d6b)',
  tab: 'people',
  open: null,
  badge: (state) => state.messages.filter((m) => !m.read).length,
  render(root, { game, sim, state, refresh }) {
    const rel = sim.rel;
    root.append(
      tabs(
        [
          ['people', 'People'],
          ['inbox', `Messages${state.messages.some((m) => !m.read) ? ' •' : ''}`],
        ],
        this.tab,
        (t) => ((this.tab = t), (this.open = null), refresh()),
      ),
    );
    if (this.tab === 'inbox') return this.inbox(root, game, sim, state, refresh);
    if (this.open) return this.person(root, game, sim, state, refresh);

    const known = rel.known(0);
    if (!known.length) {
      root.append(empty('No contacts yet. Walk up to people with a name tag around town and press E to say hello.'));
      return;
    }
    root.append(h('div.muted.small', `${rel.friendCount(2)} friends · ${rel.friendCount(3)} best friends · ${known.length} people met`));
    root.append(
      h(
        'div.sec',
        known.map((n) => {
          const s = rel.score(n.id);
          return row({ icon: REL_ICONS[relLevel(s)], title: n.name, sub: `${n.job} · ${n.away ? `📍 ${n.awayName} · long distance` : game.npcs.whereText(n)}`, right: Math.round(s), onclick: () => ((this.open = n.id), refresh()) });
        }),
      ),
    );
  },

  person(root, game, sim, state, refresh) {
    const rel = sim.rel;
    const n = rel.npc(this.open);
    const r = rel.rel(n.id);
    const lvl = relLevel(r.score);
    const texted = r.textDay === sim.day;
    const ho = rel.hangoutOptions(n.id);
    root.append(
      btn('‹ All contacts', () => ((this.open = null), refresh()), 'small'),
      h('div.card.hero', h('div.big', n.name), h('div.muted.small', `${n.job} · ${PERSONALITY[n.personality].label} · age ${n.age}`), h('div.muted.small', `Likes: ${n.interests.join(', ')}`), relBar(r.score)),
      n.away ? row({ icon: '📍', title: `Lives in ${n.awayName}`, sub: 'Long distance now: texts and calls keep the friendship alive.' }) : row({ icon: '📍', title: game.npcs.whereText(n), sub: 'Find them in person for a real conversation.' }),
      section(
        'Stay in touch',
        n.away
          ? btn(r.callDay === sim.day ? '✓ Called today' : `📞  Call ${n.first} · 20 min`, () => {
              if (!rel.call(n.id)) return;
              game.events.emit('toast', { icon: '📞', title: `A long call with ${n.first}`, text: `You catch up on everything going on in ${n.awayName}. It feels like no time has passed.`, kind: 'good' });
              refresh();
            }, r.callDay === sim.day ? 'disabled' : '')
          : null,
        btn(texted ? '✓ Texted today' : '✉️  Send a friendly text', () => {
          r.textDay = sim.day;
          rel.add(n.id, 1.5);
          addNeed(sim, 'social', 4);
          refresh();
        }, texted ? 'disabled' : ''),
        ho.reason ? h('div.muted.small', ho.reason) : null,
        (ho.options || []).map((k) => {
          const [label, icon, minutes, priceKey] = HANGOUTS[k];
          const cost = priceKey ? priceOf(sim, priceKey) * 2 : 0;
          return btn(`${icon}  ${label}  ·  ${minutes} min${cost ? `  ·  ${fmtMoney(cost)}` : ''}`, async () => {
            game.phone.close();
            let res;
            await game.fade(() => {
              res = rel.hangout(n.id, k);
            });
            if (res.ok) game.events.emit('toast', { icon, title: `${label} with ${n.first}`, text: `+${res.delta.toFixed(1)} friendship`, kind: 'good' });
          });
        }),
      ),
      lvl >= 2 ? h('div.tip', `💡 Ask ${n.first} about work in person — friends hand out referrals, discounts and tips.`) : h('div.tip', `💡 Reach ${REL_LEVELS[2]} (50) to unlock perks from ${n.first}.`),
    );
  },

  inbox(root, game, sim, state, refresh) {
    const rel = sim.rel;
    if (!state.messages.length) return root.append(empty('No messages yet. Friends will text you.'));
    const hour = hourOf(state.time.total);
    for (const m of state.messages) {
      m.read = true;
      const n = rel.npc(m.from);
      const canParty = m.kind === 'party' && !m.used && m.day === sim.day;
      root.append(
        h(
          'div.card.msg',
          h('div.row.between', h('b', n ? n.name : 'Unknown'), h('span.muted.small', fmtDay(m.day))),
          h('div', m.text),
          m.kind === 'party'
            ? m.used
              ? h('div.good.small', 'You went. It was a good night.')
              : canParty
                ? hour >= 17
                  ? btn('🎉 Go to the party (3 h)', async () => {
                      game.phone.close();
                      let res;
                      await game.fade(() => {
                        res = rel.attendParty(m);
                      });
                      if (res.ok) game.events.emit('toast', { icon: '🎉', title: 'What a party', text: `${res.met.length ? `You met ${res.met.join(' and ')}. ` : ''}+${res.followers} followers.`, kind: 'good', long: true });
                    }, 'small primary')
                  : h('div.muted.small', 'Starts this evening — come back after 5 PM.')
                : h('div.muted.small', 'This invite has expired.')
            : null,
        ),
      );
    }
    void refresh;
  },
};
