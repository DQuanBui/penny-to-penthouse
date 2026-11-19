// What happens when the player presses E on furniture: sleep, eat, shower,
// relax, computer, wardrobe, work stations... plus the shift flow.
import { h, btn } from './dom.js';
import { dialog } from './Menus.js';
import { ACTIVITIES, doActivity, sleep, hoursUntil, homeComfort } from '../sim/Activities.js';
import { BALANCE } from '../data/balance.js';
import { OUTFITS, OUTFIT_BY_ID, hasComputer, wearOutfit } from '../data/items.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { fmtClock, fmtHour } from '../core/Clock.js';
import { fmtMoney, clamp } from '../core/utils.js';
import { runMiniGame } from '../minigames/index.js';
import { openService } from './Shops.js';
import { HUSTLES } from '../sim/Hustles.js';

const NEED_ICON = { energy: '⚡', hunger: '🍔', hygiene: '🚿', fun: '🎮', social: '💬', health: '❤️' };

/** Run a timed activity behind a quick fade and report what changed. */
export async function runActivity(game, id, opts = {}) {
  const st = game.state;
  const a = ACTIVITIES[id];
  const before = { ...st.needs };
  let res;
  await game.fade(() => {
    res = doActivity(game.sim, id, opts);
  });
  if (!res.ok) {
    game.events.emit('toast', { icon: '🚫', title: a.label, text: res.reason, kind: 'bad' });
    return res;
  }
  const parts = [];
  for (const k in a.needs) {
    const d = Math.round(st.needs[k] - before[k]);
    if (Math.abs(d) >= 3) parts.push(`${NEED_ICON[k]} ${d > 0 ? '+' : ''}${d}`);
  }
  game.events.emit('toast', { icon: a.icon, title: a.label, text: `${parts.join('  ')}${res.cost ? `  ·  ${fmtMoney(-res.cost)}` : ''}  ·  ${a.minutes} min`, kind: 'info' });
  game.audio?.play(res.cost ? 'cash' : 'click');
  game.events.emit('activityDone', { id });
  opts.then?.();
  return res;
}

/** Entry point: player used a furniture interaction point inside an interior. */
export function useFurniture(game, point) {
  const { use, def, item } = point;
  const q = item.q ?? def.q ?? 1;
  const atHome = game.inside?.home;
  const simple = { shower: 'shower', bath: 'bath', cook: 'cook', tv: 'tv', game: 'game', relax: 'relax', music: 'music', piano: 'piano', paint: 'paint', read: 'read' };
  if (use === 'sleep') return openSleep(game, q);
  if (use === 'eat') return openFridge(game, q);
  if (use === 'computer') return openComputer(game, q);
  if (use === 'wardrobe') return openWardrobe(game);
  if (use === 'service') return openService(game, game.inside.place, item.svc);
  if (use === 'work') return openShift(game, game.inside.place);
  if (use === 'board') return game.subway.board();
  if (use === 'workout') return useGym(game, q);
  if (simple[use]) {
    if (use === 'cook' && game.state.inventory.meals < 1) return game.events.emit('toast', { icon: '🧊', title: 'Nothing to cook', text: 'Buy groceries first — look for the 🛒 on your map.', kind: 'bad' });
    return runActivity(game, simple[use], { q, atHome });
  }
}

function useGym(game, q) {
  const st = game.state;
  const day = game.sim.day;
  if (!game.inside?.home && st.flags.gymPassUntil < day) {
    const price = Math.round(BALANCE.prices.gymDay * (game.sim.city.priceIndex || 1));
    if (!game.sim.finance.spend(price, 'health', 'Gym day pass')) return;
    st.flags.gymPassUntil = day;
    game.events.emit('toast', { icon: '🎟️', title: 'Day pass bought', text: `${fmtMoney(price)} — train as much as you like today. A membership is cheaper if you come often.`, kind: 'info' });
  }
  return runActivity(game, 'workout', { q });
}

export function openSleep(game, q) {
  const st = game.state;
  const rate = BALANCE.sleep.energyPerHour * q * homeComfort(st);
  const opt = (label, hours) => {
    hours = clamp(hours, BALANCE.sleep.minHours, BALANCE.sleep.maxHours);
    const gain = Math.min(100 - st.needs.energy, rate * hours);
    return btn(`${label}  ·  ${hours.toFixed(1)} h  ·  ⚡ +${Math.round(gain)}`, async () => {
      game.closeOverlay(el);
      await game.fade(() => sleep(game.sim, hours, q));
      game.saveNow(true);
      game.events.emit('toast', { icon: '🌅', title: `It is ${fmtClock(st.time.total)}`, text: `You slept ${hours.toFixed(1)} hours. Game saved.`, kind: 'good' });
      game.events.emit('slept', { hours });
    });
  };
  const wake = [6, 7, 8, 9].map((hr) => [hr, hoursUntil(st, hr)]).filter(([, hrs]) => hrs >= 2 && hrs <= 12);
  const el = dialog(game, {
    title: '🛏️ Sleep',
    body: h(
      'div.menu-col',
      h('div.muted', `Energy ${Math.round(st.needs.energy)}/100. This bed restores about ${rate.toFixed(0)} energy per hour${q > 1.1 ? ' — a good bed makes a real difference' : ''}.`),
      wake.map(([hr, hrs]) => opt(`Sleep until ${fmtHour(hr)}`, hrs)),
      opt('Power nap', 1),
      opt('Long nap', 3),
    ),
  });
}

function openFridge(game, q) {
  const st = game.state;
  const el = dialog(game, {
    title: '🧊 Fridge',
    body: h(
      'div.menu-col',
      h('div.muted', st.inventory.meals > 0 ? `You have ${st.inventory.meals} portion${st.inventory.meals > 1 ? 's' : ''} of food.` : 'Empty. Buy groceries (🛒 on the map) — cooking at home is far cheaper than eating out.'),
      btn('🥪  Quick meal  ·  15 min', () => (game.closeOverlay(el), runActivity(game, 'eat_home', { q, atHome: game.inside?.home })), st.inventory.meals > 0 ? '' : 'disabled'),
      h('div.muted.small', 'Use a stove to cook a proper meal: more filling and it trains Cooking.'),
    ),
  });
}

function openComputer(game, q) {
  const st = game.state;
  if (game.inside?.home && !hasComputer(st)) {
    dialog(game, { title: '🖥️ Desk', body: h('div', h('p', 'A desk, but no computer.'), h('p.muted', 'Buy a laptop at the electronics store (💻 on your map) to practise coding, study online and freelance from home.')), buttons: [btn('OK', () => game.closeTop(), 'primary')] });
    return;
  }
  const act = (id) => btn(`${ACTIVITIES[id].icon}  ${ACTIVITIES[id].label}  ·  ${ACTIVITIES[id].minutes} min`, () => (game.closeOverlay(el), runActivity(game, id, { q, atHome: true })));
  // side hustles that need a computer
  const gig = (id) => {
    const why = game.sim.hustles.blocked(id);
    const [lo, hi] = game.sim.hustles.payRange(id);
    return btn(`${HUSTLES[id].icon}  ${HUSTLES[id].name}  ·  ${HUSTLES[id].minutes / 60} h  ·  ${fmtMoney(lo)}–${fmtMoney(hi)}`, async () => {
      game.closeOverlay(el);
      let res;
      await game.fade(() => {
        res = game.sim.hustles.run(id);
      });
      if (res) game.events.emit('toast', { icon: HUSTLES[id].icon, title: `${HUSTLES[id].name} done`, text: `+${fmtMoney(res.net)} after tax${res.followers ? ` · +${res.followers} followers` : ''}`, kind: 'good' });
    }, why ? 'disabled' : '');
  };
  const el = dialog(game, {
    title: '🖥️ Computer',
    body: h('div.menu-col', act('code_practice'), gig('freelance'), gig('stream'), act('browse'), btn('🎓  Online courses (Learn app)', () => (game.closeAllOverlays(), game.phone.open('learn')))),
  });
}

export function openWardrobe(game) {
  const st = game.state;
  const body = h('div.menu-col');
  const el = dialog(game, { title: '👚 Wardrobe', body, wide: true });
  const render = () => {
    const owned = ['starter', ...st.inventory.outfits];
    body.replaceChildren(
      h('div.muted', 'What you wear affects interviews and how popular your posts are.'),
      ...owned.map((id) => {
        const o = OUTFIT_BY_ID[id];
        const on = (st.profile.outfit || 'starter') === id;
        return h(
          'div.slot',
          h('div.lrow-icon', o.icon),
          h('div.grow', h('div.slot-name', o.name), h('div.muted.small', `Style ${o.style} · ${o.desc}`)),
          on
            ? h('span.pill.trait', 'Wearing')
            : btn('Wear', () => {
                wearOutfit(st, id);
                game.setPlayerLook(st.profile.appearance);
                render();
              }, 'small primary'),
        );
      }),
      owned.length < 2 ? h('div.muted.small', `Buy more outfits at the clothing store (👕 on the map). ${OUTFITS.length - 1} to collect.`) : null,
    );
  };
  render();
  void el;
}

// ------------------------------------------------------------------ shifts
/** Company name for a career in the current city. */
export function employerName(game, careerId) {
  const type = CAREER_BY_ID[careerId].place;
  return game.city.places.find((p) => p.type === type)?.name || CAREER_BY_ID[careerId].name;
}

export function openShift(game, place) {
  const sim = game.sim;
  const j = game.state.job;
  const career = j ? CAREER_BY_ID[j.career] : null;
  if (!j || career.place !== place.type) {
    dialog(game, {
      title: `${place.icon} ${place.name}`,
      body: h('div', h('p', j ? 'You do not work here.' : 'You are not on the payroll here — yet.'), h('p.muted', 'Open the Jobs app on your phone to see who is hiring.')),
      buttons: [btn('Close', () => game.closeTop()), btn('Open Jobs app', () => (game.closeAllOverlays(), game.phone.open('jobs')), 'primary')],
    });
    return;
  }
  const info = sim.jobs.shiftInfo();
  const range = `${fmtHour(info.start)}–${fmtHour(info.end)}`;
  const can = info.status === 'ready' || info.status === 'late';
  const text = {
    off: 'It is the weekend. Enjoy it.',
    done: 'You already worked today. See you tomorrow.',
    early: `Your shift is ${range}. Come back within an hour of the start.`,
    missed: `Your shift was ${range}. It is too late to start now.`,
    ready: `Your shift is ${range}. Ready?`,
    late: `You are ${Math.round(info.lateBy * 60)} minutes late (shift ${range}). You will be paid less and your manager noticed.`,
  }[info.status];
  const go = async (play) => {
    game.closeOverlay(el);
    const score = play ? await runMiniGame(game, career.minigame, j.level) : null;
    let res;
    await game.fade(() => {
      res = sim.jobs.workShift(score);
    });
    if (res) shiftSummary(game, res);
  };
  const el = dialog(game, {
    title: `💼 ${sim.jobs.title()}`,
    body: h('div', h('p' + (info.status === 'late' ? '.bad' : ''), text), can ? h('p.muted', 'Play the mini-game for a better review (and bigger tips), or skip straight to the end of the shift.') : null),
    buttons: can ? [btn('Skip to end', () => go(false)), btn('▶ Play shift', () => go(true), 'primary')] : [btn('OK', () => game.closeTop(), 'primary')],
  });
}

function shiftSummary(game, r) {
  const j = game.state.job;
  const perf = j ? clamp(j.perf, 0, 100) : 0;
  dialog(game, {
    title: r.fired ? '📦 Shift over' : r.promoted ? '🚀 Promoted!' : '✅ Shift complete',
    body: h(
      'div.col',
      h('div.kv', h('span.muted', 'Hours worked'), h('span', r.hours.toFixed(1))),
      h('div.kv', h('span.muted', 'Earned toward next paycheck'), h('span.good', '+' + fmtMoney(r.gross))),
      r.tips ? h('div.kv', h('span.muted', 'Tips (cash today)'), h('span.good', '+' + fmtMoney(r.tips))) : null,
      h('div.kv', h('span.muted', 'Performance'), h('span.' + (r.perf >= 0 ? 'good' : 'bad'), (r.perf >= 0 ? '+' : '') + r.perf.toFixed(0))),
      j ? h('div', h('div.muted.small', `Progress to next review — ${Math.round(perf)}/100`), h('div.bar', h('div.bar-fill', { style: { width: perf + '%', background: 'var(--accent)' } }))) : null,
      r.late ? h('div.bad.small', 'You were late. Arrive within 20 minutes of the start to avoid the penalty.') : null,
      r.promoted ? h('div.good', `You are now ${r.promoted}.`) : null,
      r.raise ? h('div.good.small', r.blocked ? `Raise granted. For a promotion you still need: ${r.blocked.join(', ')}.` : 'Raise granted.') : null,
      r.fired ? h('div.bad', 'Your performance was too low. You have been let go.') : null,
    ),
    buttons: [btn('Continue', () => game.closeTop(), 'primary')],
  });
}
