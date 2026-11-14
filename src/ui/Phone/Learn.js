// Learn app: skills overview, college programmes, online courses and books.
import { h, btn } from '../dom.js';
import { PROGRAMS, PROGRAM_BY_ID, ONLINE, BOOKS } from '../../data/courses.js';
import { SKILLS, SKILL_BY_ID } from '../../data/archetypes.js';
import { fmtMoney } from '../../core/utils.js';
import { section, row, tabs, empty } from './widgets.js';

const HOW = {
  coding: 'Practise on a computer, online courses, Tech shifts',
  business: 'Courses, running a business, books',
  finance: 'Courses, books, Finance shifts',
  charisma: 'Talking to people, tutoring, public-speaking course',
  fitness: 'Gym, treadmill or weights at home, delivery runs',
  creativity: 'Painting, piano, streaming, Creative shifts',
  cooking: 'Cook at home on a stove, Hospitality shifts',
  handiness: 'Trades shifts, DIY course, books',
};

/** Run a study action behind a fade, then refresh the phone. */
async function study(game, fn, refresh) {
  let res;
  await game.fade(() => {
    res = fn();
  });
  if (res?.blocked) game.events.emit('toast', { icon: '📚', title: 'Enough for today', text: res.blocked, kind: 'info' });
  refresh();
  return res;
}

export const LearnApp = {
  id: 'learn',
  name: 'Learn',
  icon: '🎓',
  color: 'linear-gradient(135deg,#7a7fe0,#4b56c0)',
  tab: 'skills',
  badge: (state) => (state.education.enrolled ? 1 : 0),
  render(root, { game, sim, state, refresh, phone }) {
    const edu = sim.edu;
    root.append(
      tabs(
        [
          ['skills', 'Skills'],
          ['college', 'College'],
          ['online', 'Online'],
          ['books', 'Books'],
        ],
        this.tab,
        (t) => ((this.tab = t), refresh()),
      ),
    );
    if (this.tab === 'skills') {
      root.append(
        h(
          'div.sec',
          SKILLS.map((s) => {
            const v = state.skills[s.id];
            return h('div.card', h('div.row.between', h('b', `${s.icon} ${s.name}`), h('b', `${Math.floor(v + 1e-6)} / 10`)), h('div.bar', h('div.bar-fill', { style: { width: v * 10 + '%', background: 'var(--info)' } })), h('div.muted.small', HOW[s.id]));
          }),
        ),
        state.education.degrees.length + state.education.certs.length
          ? section('Qualifications', [...state.education.degrees, ...state.education.certs].map((id) => row({ icon: PROGRAM_BY_ID[id]?.icon || '🎓', title: PROGRAM_BY_ID[id]?.name || id })))
          : null,
      );
    } else if (this.tab === 'college') {
      const en = state.education.enrolled;
      const college = game.city.places.find((p) => p.type === 'college');
      if (en) {
        const p = PROGRAM_BY_ID[en.id];
        root.append(
          h(
            'div.card.hero',
            h('div.muted.small', 'Enrolled'),
            h('div.big', `${p.icon} ${p.name}`),
            h('div.bar', h('div.bar-fill', { style: { width: (en.done / p.sessions) * 100 + '%', background: 'var(--accent)' } })),
            h('div.muted.small', `${en.done} of ${p.sessions} classes · one per day, 8 AM–8 PM, at ${college?.name || 'the college'}`),
            h('div.row', college ? btn('📍 GPS to campus', () => (game.map.setWaypoint(college), phone.close()), 'small') : null),
          ),
        );
      } else root.append(h('div.tip', '💡 Degrees and licences unlock the upper half of every career ladder. You can pay up front or take a student loan.'));
      for (const p of PROGRAMS) {
        const can = edu.canEnroll(p.id);
        const cost = edu.tuition(p.id);
        const done = edu.has(p.id);
        root.append(
          h(
            'div.card.job',
            h('div.row.between', h('b', `${p.icon} ${p.name}`), done ? h('span.pill.trait', 'Completed') : h('b', fmtMoney(cost))),
            h('div.muted.small', `${p.kind === 'degree' ? 'Degree' : 'Certification'} · ${p.sessions} classes × ${p.hours} h · ${Object.entries(p.skills).map(([s, v]) => `${SKILL_BY_ID[s].name} +${v}`).join(', ')}`),
            h('div.muted.small', p.desc),
            done
              ? null
              : can.ok
                ? h('div.row', btn(`Pay ${fmtMoney(cost)}`, () => (edu.enroll(p.id, 'cash'), refresh()), 'small' + (state.money.checking >= cost ? ' primary' : ' disabled')), btn('Student loan', () => (edu.enroll(p.id, 'loan'), refresh()), 'small'))
                : h('div.small.' + (can.reason === 'Enrolled' ? 'good' : 'bad'), can.reason),
          ),
        );
      }
    } else if (this.tab === 'online') {
      const mine = ONLINE.filter((o) => edu.onlineState(o.id));
      if (mine.length)
        root.append(
          section(
            'My courses',
            mine.map((o) => {
              const s = edu.onlineState(o.id);
              const fin = s.done >= o.lessons;
              return row({ icon: o.icon, title: o.name, sub: fin ? 'Completed' : `Lesson ${s.done + 1} of ${o.lessons} · ${SKILL_BY_ID[o.skill].name}`, right: fin ? '✅' : btn('Study 1 h', () => study(game, () => edu.lesson(o.id), refresh), 'small primary') });
            }),
          ),
        );
      root.append(
        section(
          'Catalogue',
          ONLINE.filter((o) => !edu.onlineState(o.id)).map((o) => {
            const locked = Math.floor(state.skills[o.skill] + 1e-6) < o.min;
            return row({ icon: o.icon, title: o.name, sub: `${o.lessons} lessons · ${SKILL_BY_ID[o.skill].name}${o.min ? ` · needs level ${o.min}` : ''}`, right: btn(fmtMoney(o.price), () => (edu.buyOnline(o.id), refresh()), 'small' + (locked ? ' disabled' : ' primary')) });
          }),
        ),
        h('div.tip', '💡 Study anywhere from your phone — up to two lessons per course a day.'),
      );
    } else {
      const inv = state.inventory.books;
      const mine = BOOKS.filter((b) => inv[b.id] != null);
      if (mine.length)
        root.append(
          section(
            'My shelf',
            mine.map((b) => {
              const fin = inv[b.id] >= b.sittings;
              return row({ icon: '📖', title: b.name, sub: fin ? 'Finished' : `${inv[b.id]} of ${b.sittings} sittings · ${SKILL_BY_ID[b.skill].name}`, right: fin ? '✅' : btn('Read 1 h', () => study(game, () => edu.readBook(b.id), refresh), 'small primary') });
            }),
          ),
        );
      else root.append(empty('No books yet. A good book is the cheapest education there is.'));
      root.append(
        section(
          'Bookshop',
          BOOKS.filter((b) => inv[b.id] == null).map((b) => row({ icon: '📚', title: b.name, sub: `${SKILL_BY_ID[b.skill].name} · ${b.sittings} sittings`, right: btn(fmtMoney(b.price), () => (edu.buyBook(b.id), refresh()), 'small primary') })),
        ),
      );
    }
  },
};
