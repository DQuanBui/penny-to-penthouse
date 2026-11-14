// Jobs app: your current job (schedule, performance, next promotion) and
// openings with a three-question interview.
import { h, btn } from '../dom.js';
import { dialog, confirmBox } from '../Menus.js';
import { fmtMoney, clamp } from '../../core/utils.js';
import { fmtHour, fmtDay, dayOf } from '../../core/Clock.js';
import { BALANCE } from '../../data/balance.js';
import { CAREER_BY_ID } from '../../data/careers.js';
import { PROGRAM_BY_ID } from '../../data/courses.js';
import { isPayday, nextDayMatching } from '../../sim/Finance.js';
import { section, row, tabs, kv, empty } from './widgets.js';
import { employerName } from '../Interact.js';

const J = BALANCE.jobs;

export const JobsApp = {
  id: 'jobs',
  name: 'Jobs',
  icon: '💼',
  color: 'linear-gradient(135deg,#3b82f6,#6d4fd8)',
  tab: null,
  badge: (state) => (state.job ? 0 : 1),
  render(root, { game, sim, state, refresh, phone }) {
    const tab = this.tab || (state.job ? 'mine' : 'open');
    root.append(
      tabs(
        [
          ['mine', 'My job'],
          ['open', 'Openings'],
        ],
        tab,
        (t) => ((this.tab = t), refresh()),
      ),
    );
    if (tab === 'mine') this.mine(root, game, sim, state, refresh, phone);
    else this.openings(root, game, sim, state, refresh, phone);
  },

  mine(root, game, sim, state, refresh, phone) {
    const j = state.job;
    if (!j) {
      root.append(empty('You are unemployed. Check the Openings tab — entry-level jobs need no experience.'));
      if (state.jobLog.history.length) root.append(section('History', state.jobLog.history.slice(-5).reverse().map((x) => row({ icon: CAREER_BY_ID[x.career].icon, title: CAREER_BY_ID[x.career].levels[x.level].title, sub: `${fmtDay(x.from)} → ${fmtDay(x.to)} · ${x.reason}` }))));
      return;
    }
    const c = CAREER_BY_ID[j.career];
    const def = c.levels[j.level];
    const next = c.levels[j.level + 1];
    const perf = clamp(j.perf, 0, J.promoPerf);
    const place = game.city.places.find((p) => p.type === c.place);
    const day = dayOf(state.time.total);
    root.append(
      h(
        'div.card.hero',
        h('div.muted.small', `${c.icon} ${employerName(game, c.id)}`),
        h('div.big', def.title),
        h('div', h('b.good', `${fmtMoney(sim.jobs.annualSalary())}`), h('span.muted', ` / year · weekdays ${fmtHour(def.hours[0])}–${fmtHour(def.hours[1])}`)),
        def.tips ? h('div.muted.small', '+ tips paid in cash after every shift') : null,
      ),
      row({ icon: '🕘', title: sim.jobs.nextShiftText(), sub: 'Arrive within 20 minutes of the start. Go to a work station inside and press E.', right: place ? h('button.btn.small', { onclick: () => (game.map.setWaypoint(place), phone.close()) }, '📍 GPS') : null }),
      section(
        'Performance',
        h('div.card', h('div.row.between', h('span', 'Next review'), h('b', `${Math.round(perf)} / ${J.promoPerf}`)), h('div.bar', h('div.bar-fill', { style: { width: (perf / J.promoPerf) * 100 + '%', background: j.perf < 0 ? 'var(--bad)' : 'var(--accent)' } })), h('div.muted.small', j.perf < J.warnBelow ? 'Your job is at risk. Show up on time and play your shifts well.' : 'Each good shift adds performance. At 100 you get a promotion — or a raise if you lack the requirements.')),
      ),
      next
        ? section(
            `Next: ${next.title} · ${fmtMoney(sim.jobs.salaryFor(c.id, j.level + 1, j.raise))}`,
            this.reqRows(sim, next.req),
          )
        : section('Top of the ladder', h('div.card.good', 'You have reached the highest role in this career.')),
      section('Pay', kv('Earned this pay period', fmtMoney(j.accrued)), kv('Next paycheck (after tax)', fmtMoney(sim.jobs.netPreview())), kv('Payday', fmtDay(nextDayMatching(day - 1, isPayday))), kv('Shifts worked', String(j.shifts))),
      btn('Quit job', async () => {
        if (await confirmBox(game, { title: 'Quit your job?', text: 'You get your final paycheck now. Rent will still be due.', yes: 'Quit', danger: true })) {
          sim.jobs.leave('quit');
          refresh();
        }
      }, 'danger small'),
    );
  },

  reqRows(sim, req = {}) {
    const state = sim.state;
    const rows = [];
    for (const s in req.skills || {}) {
      const have = Math.floor(state.skills[s] + 1e-6);
      rows.push(kv(`${have >= req.skills[s] ? '✅' : '⬜'} ${s[0].toUpperCase() + s.slice(1)} ${req.skills[s]}`, `you: ${have}`, have >= req.skills[s] ? 'good' : 'bad'));
    }
    const names = (ids) => ids.map((d) => PROGRAM_BY_ID[d]?.name || d).join(' / ');
    const hasD = req.degree?.some((d) => state.education.degrees.includes(d) || state.education.certs.includes(d));
    const hasC = req.cert?.some((d) => state.education.certs.includes(d));
    if (req.either && req.degree && req.cert) {
      const ok = hasD || hasC;
      rows.push(kv(`${ok ? '✅' : '⬜'} ${names(req.degree.concat(req.cert))}`, ok ? 'yes' : 'any one', ok ? 'good' : 'bad'));
    } else {
      if (req.degree) rows.push(kv(`${hasD ? '✅' : '⬜'} ${names(req.degree)}`, hasD ? 'yes' : 'Learn app', hasD ? 'good' : 'bad'));
      if (req.cert) rows.push(kv(`${hasC ? '✅' : '⬜'} ${names(req.cert)}`, hasC ? 'yes' : 'Learn app', hasC ? 'good' : 'bad'));
    }
    if (req.popularity) rows.push(kv(`${state.social.popularity >= req.popularity ? '✅' : '⬜'} Popularity ${req.popularity}`, `you: ${Math.round(state.social.popularity)}`));
    if (!rows.length) rows.push(h('div.muted.small', 'No special requirements.'));
    return h('div.card', rows);
  },

  openings(root, game, sim, state, refresh, phone) {
    root.append(h('div.tip', `💡 ${game.city.cfg.name} pays extra in: ${game.city.cfg.topIndustries.join(', ')}.`));
    for (const o of sim.jobs.openings()) {
      const c = o.career;
      const boost = game.city.cfg.industries?.[c.id];
      const canApply = o.qualified && !o.wait && !(o.current && state.job.level >= o.level);
      root.append(
        h(
          'div.card.job',
          h('div.row.between', h('b', `${c.icon} ${o.def.title}`), h('b.good', fmtMoney(o.salary))),
          h('div.muted.small', `${employerName(game, c.id)} · ${c.name}${boost > 1 ? ` · 🔥 +${Math.round((boost - 1) * 100)}% in this city` : ''}`),
          h('div.muted.small', `Weekdays ${fmtHour(o.def.hours[0])}–${fmtHour(o.def.hours[1])}${o.def.tips ? ' · tips' : ''} · ${c.blurb}`),
          o.missing.length ? h('div.bad.small', `Needs: ${o.missing.join(', ')}`) : null,
          o.referral ? h('div.good.small', '⭐ A friend referred you — better odds.') : null,
          h(
            'div.row.between',
            h('span.muted.small', o.current ? 'Your current employer' : o.wait ? `Re-apply in ${o.wait} day${o.wait > 1 ? 's' : ''}` : o.qualified ? `Interview odds ≈ ${Math.round(clamp(sim.jobs.baseChance(c.id, o.level) + 0.2, 0.05, 0.97) * 100)}% with good answers` : ''),
            btn(o.current ? 'Employed' : 'Apply', () => openInterview(game, c.id, o.level, () => refresh()), 'small primary' + (canApply && !o.current ? '' : ' disabled')),
          ),
        ),
      );
    }
    void phone;
  },
};

/** Three questions, then a verdict. */
export function openInterview(game, careerId, level, onDone) {
  const sim = game.sim;
  const c = CAREER_BY_ID[careerId];
  const def = c.levels[level];
  const qs = sim.jobs.interviewQuestions();
  const scores = [];
  const body = h('div.col');
  const el = dialog(game, { title: `🎤 Interview — ${def.title}`, body, closable: false, wide: true });
  const ask = (i) => {
    if (i >= qs.length) return verdict();
    const q = qs[i];
    body.replaceChildren(
      h('div.muted.small', `${employerName(game, careerId)} · question ${i + 1} of ${qs.length}`),
      h('div.interview-q', `“${q.q}”`),
      ...q.a.map((a) =>
        h(
          'button.btn.answer',
          {
            onclick: () => {
              scores.push(a.s);
              game.audio?.play('click');
              ask(i + 1);
            },
          },
          a.t,
        ),
      ),
    );
  };
  const verdict = () => {
    const res = sim.jobs.resolveInterview(careerId, level, scores);
    const great = scores.filter((s) => s === 2).length;
    body.replaceChildren(
      h('div.interview-result', res.hired ? '🎉' : '😕'),
      h('div.big', res.hired ? 'You got the job!' : 'Not this time.'),
      h('div.muted', res.hired ? `Welcome aboard as ${def.title}. Your first shift is the next weekday at ${fmtHour(def.hours[0])}.` : `They went with someone else. ${great < 2 ? 'Stronger answers would help — ' : ''}skills, Charisma and a sharper outfit all raise your odds. You can re-apply in ${J.reapplyDays} days.`),
      h('div.muted.small', `Great answers: ${great}/3 · offer chance was ${Math.round(res.chance * 100)}%`),
      btn('Continue', () => {
        game.closeOverlay(el);
        onDone?.(res);
      }, 'primary'),
    );
    game.audio?.play(res.hired ? 'success' : 'error');
  };
  ask(0);
}
