// Rankings (city + national boards, Hall of Fame), Goals (life goals +
// achievements) and Calendar apps.
import { h, btn } from '../dom.js';
import { RANK_CATEGORIES, hallOfFame } from '../../sim/Rankings.js';
import { ACHIEVEMENTS } from '../../data/achievements.js';
import { ARCHETYPE_BY_ID } from '../../data/archetypes.js';
import { CITY_BY_ID } from '../../data/cities/index.js';
import { PROGRAM_BY_ID } from '../../data/courses.js';
import { isPayday, isBillDay, isMidBillDay } from '../../sim/Finance.js';
import { fmtMoney, fmtNum } from '../../core/utils.js';
import { fmtDay, fmtDate, fmtHour, dayOf, DAYS_PER_SEASON } from '../../core/Clock.js';
import { section, row, tabs, empty } from './widgets.js';

const fmtValue = (cat, v) => (cat.money ? fmtMoney(v, { compact: Math.abs(v) >= 1e5 }) : cat.pct ? `${Math.round(v * 100)}%` : fmtNum(v));

export const RankingsApp = {
  id: 'rankings',
  name: 'Rankings',
  icon: '🏆',
  color: 'linear-gradient(135deg,#eab308,#ca8a04)',
  scope: 'city',
  cat: 'netWorth',
  render(root, { sim, state, refresh }) {
    const rk = sim.rankings;
    root.append(
      tabs(
        [
          ['city', sim.city.name],
          ['national', 'National'],
          ['hof', 'Hall of Fame'],
        ],
        this.scope,
        (t) => ((this.scope = t), refresh()),
      ),
    );
    if (this.scope === 'hof') {
      const list = hallOfFame();
      if (!list.length) return root.append(empty('Every life you play is remembered here by its best net worth.'));
      root.append(
        h('div.muted.small', 'The best lives played on this device, across all save slots.'),
        h('div.sec', list.map((r, i) => row({ icon: i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}`, title: `${ARCHETYPE_BY_ID[r.archetype]?.icon || ''} ${r.name}${r.id === state.id ? ' (this life)' : ''}`, sub: `${CITY_BY_ID[r.cityId]?.name || ''} · ${r.title} · age ${r.age} · day ${r.day}`, right: fmtMoney(r.netWorth, { compact: true }), cls: r.id === state.id ? 'me' : '' }))),
      );
      return;
    }
    const cat = RANK_CATEGORIES.find((c) => c.id === this.cat);
    const board = rk.board(cat.id, this.scope);
    const mine = board.findIndex((r) => r.me);
    root.append(
      h('div.chips', RANK_CATEGORIES.map((c) => h('button.chip' + (c.id === this.cat ? '.active' : ''), { onclick: () => ((this.cat = c.id), refresh()) }, `${c.icon} ${c.name}`))),
      h('div.card.hero', h('div.muted.small', `${cat.name} · ${this.scope === 'city' ? sim.city.name : 'all five cities'}`), h('div.big', `#${mine + 1} of ${board.length}`), h('div.muted.small', mine === 0 ? 'You are number one. Stay there.' : `${fmtValue(cat, board[mine - 1].value - board[mine].value)} behind ${board[mine - 1].name}`)),
    );
    // top ten, plus the player's neighbourhood when they are further down
    const show = new Set();
    for (let i = 0; i < Math.min(10, board.length); i++) show.add(i);
    for (let i = Math.max(0, mine - 2); i <= Math.min(board.length - 1, mine + 2); i++) show.add(i);
    let last = -1;
    const list = h('div.sec');
    for (const i of [...show].sort((a, b) => a - b)) {
      if (i !== last + 1) list.append(h('div.muted.small', { style: { textAlign: 'center' } }, '· · ·'));
      last = i;
      const r = board[i];
      list.append(row({ icon: i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}`, title: r.me ? `${r.name} (you)` : r.name, sub: this.scope === 'national' ? `${r.title} · ${rk.cityName(r.cityId)}` : r.title, right: fmtValue(cat, r.value), cls: r.me ? 'me' : '' }));
    }
    root.append(list);
  },
};

export const GoalsApp = {
  id: 'goals',
  name: 'Goals',
  icon: '🎯',
  color: 'linear-gradient(135deg,#f43f5e,#be123c)',
  tab: 'goals',
  render(root, { sim, state, refresh }) {
    const done = Object.keys(state.achievements).length;
    root.append(
      tabs(
        [
          ['goals', 'Life goals'],
          ['ach', `Achievements ${done}/${ACHIEVEMENTS.length}`],
        ],
        this.tab,
        (t) => ((this.tab = t), refresh()),
      ),
    );
    if (this.tab === 'goals') {
      const list = sim.goals.list();
      if (!list.length) root.append(empty('No life goals chosen for this life.'));
      for (const g of list) {
        root.append(
          h(
            'div.card.job',
            h('div.row.between', h('b', `${g.def.icon} ${g.def.name}`), g.done ? h('span.pill.trait', '✓ Achieved') : g.failed ? h('span.pill.warn', 'Missed') : h('b', `${Math.round(g.pct * 100)}%`)),
            h('div.muted.small', g.def.desc),
            h('div.bar', h('div.bar-fill', { style: { width: (g.done ? 1 : g.pct) * 100 + '%', background: g.done ? 'var(--good)' : g.failed ? 'var(--bad)' : 'var(--accent)' } })),
            h('div.muted.small', `${g.def.money ? fmtMoney(g.cur, { compact: true }) : fmtNum(Math.floor(g.cur))} / ${g.def.money ? fmtMoney(g.target, { compact: true }) : fmtNum(g.target)}${g.def.byAge ? ` · before age ${g.def.byAge} (you are ${state.profile.age})` : ''}`),
          ),
        );
      }
      root.append(
        section(
          'Your life so far',
          h('div.card', [
            ['Age', state.profile.age],
            ['Days in the city', dayOf(state.time.total) + 1],
            ['Net worth', fmtMoney(sim.finance.netWorth())],
            ['Total earned', fmtMoney(state.stats.totalEarned)],
            ['Taxes paid', fmtMoney(state.stats.taxesPaid)],
            ['Shifts worked', state.stats.shifts],
            ['Promotions', state.stats.promotions],
            ['Friends made', state.stats.friendsMade],
          ].map(([k, v]) => h('div.kv', h('span.muted', k), h('span', String(v))))),
        ),
      );
    } else {
      root.append(
        h(
          'div.sec',
          [...ACHIEVEMENTS]
            .sort((a, b) => (state.achievements[b.id] != null) - (state.achievements[a.id] != null))
            .map((a) => {
              const got = state.achievements[a.id];
              return row({ icon: got != null ? a.icon : '🔒', title: a.name, sub: got != null ? `${a.desc} · ${fmtDay(got)}` : a.desc, cls: got != null ? '' : 'locked' });
            }),
        ),
      );
    }
  },
};

export const CalendarApp = {
  id: 'calendar',
  name: 'Calendar',
  icon: '📅',
  color: 'linear-gradient(135deg,#f8fafc,#cbd5e1)',
  render(root, { game, sim, state }) {
    const today = dayOf(state.time.total);
    const job = state.job ? sim.jobs.levelDef() : null;
    const en = state.education.enrolled;
    root.append(h('div.card.hero', h('div.muted.small', 'Today'), h('div.big', fmtDate(state.time.total, true)), h('div.muted.small', `${game.weather.info.icon} ${game.weather.info.label} · you are ${state.profile.age}`)));
    const days = h('div.sec');
    for (let d = today; d < today + 14; d++) {
      const items = [];
      const weekday = d % 7 < 5;
      if (job && weekday) items.push(`💼 ${fmtHour(job.hours[0])}–${fmtHour(job.hours[1])}`);
      if (en) items.push(`🎓 ${PROGRAM_BY_ID[en.id].name.split(' ').slice(0, 2).join(' ')}`);
      if (isPayday(d) && job) items.push('💸 Payday');
      if (isBillDay(d)) items.push('🏠 Rent & utilities due');
      if (isMidBillDay(d)) items.push('📱 Monthly bills');
      if (d % DAYS_PER_SEASON === 0 && d > 0) items.push('🗓️ New season · property tax, dividends');
      if (d % 112 === 0 && d > 0) items.push('🎂 Your birthday');
      for (const m of state.messages) if (m.kind === 'party' && m.day === d && !m.used) items.push('🎉 Party invite (Messages)');
      for (const e of game.cityEvents.onDay(d)) items.push(`${e.def.icon} ${e.def.name} ${fmtHour(e.def.hours[0])}–${fmtHour(e.def.hours[1])}`);
      days.append(row({ icon: d === today ? '👉' : weekday ? '▫️' : '🌴', title: fmtDay(d), sub: items.join(' · ') || (weekday ? 'Nothing scheduled' : 'Weekend') }));
    }
    root.append(section('Next two weeks', days), h('div.tip', '💡 Paychecks arrive every other Friday. Rent is due on the 1st, other bills on the 15th.'));
    void btn;
  },
};
