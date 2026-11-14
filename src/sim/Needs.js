// Needs (Energy, Hunger, Hygiene, Fun, Social, Health) and the Mood summary.
import { BALANCE } from '../data/balance.js';
import { clamp, lerp } from '../core/utils.js';
import { mod } from './Player.js';
import { hourOf } from '../core/Clock.js';

export const NEEDS = [
  { id: 'energy', name: 'Energy', icon: '⚡', color: '#ffd24a', tip: 'Sleep in a bed or grab a coffee.' },
  { id: 'hunger', name: 'Hunger', icon: '🍔', color: '#ff8a4a', tip: 'Eat at home, a café or a restaurant.' },
  { id: 'hygiene', name: 'Hygiene', icon: '🚿', color: '#5ac8fa', tip: 'Take a shower at home or the gym.' },
  { id: 'fun', name: 'Fun', icon: '🎮', color: '#c77dff', tip: 'Relax, play, go out.' },
  { id: 'social', name: 'Social', icon: '💬', color: '#ff7ab8', tip: 'Talk to people and hang out with friends.' },
  { id: 'health', name: 'Health', icon: '❤️', color: '#4fd18b', tip: 'Eat, sleep and exercise. See a doctor if it drops.' },
];
export const NEED_BY_ID = Object.fromEntries(NEEDS.map((n) => [n.id, n]));

/** Mood 0..100: weighted needs, squeezed by the worst need, plus home comfort. */
export function computeMood(state) {
  const w = BALANCE.needs.moodWeights;
  let m = 0;
  let worst = 100;
  for (const k in w) {
    m += state.needs[k] * w[k];
    if (state.needs[k] < worst) worst = state.needs[k];
  }
  if (worst < BALANCE.needs.low) m -= (BALANCE.needs.low - worst) * 0.6; // one empty need sours everything
  m += Math.min(8, (state.home?.styleScore || 0) * 0.08);
  m += state.flags.moodBoost || 0;
  return clamp(m, 0, 100);
}

/** Multiplier applied to work performance, tips, studying... */
export const moodFactor = (state) => lerp(BALANCE.needs.moodPerfMin, BALANCE.needs.moodPerfMax, state.mood / 100);

export const moodLabel = (m) => (m >= 85 ? ['Thriving', '😄'] : m >= 68 ? ['Happy', '🙂'] : m >= 48 ? ['Okay', '😐'] : m >= 28 ? ['Stressed', '😟'] : ['Miserable', '😫']);

/** Change one need; positive changes get the trait gain modifier. */
export function addNeed(sim, id, delta) {
  const st = sim.state;
  if (delta > 0) delta *= mod(st, 'gain_' + id);
  st.needs[id] = clamp(st.needs[id] + delta, 0, 100);
}

/**
 * Advance needs by `minutes`.
 * activity: { sleeping, rates: { need: pointsPerHour }, noDecay: bool }
 */
export function tickNeeds(sim, minutes, activity = {}) {
  const st = sim.state;
  const n = st.needs;
  const hrs = minutes / 60;
  const B = BALANCE.needs;
  const hour = hourOf(st.time.total);
  const lateNight = hour >= 22 || hour < 4;
  if (!activity.noDecay) {
    for (const k in B.decay) {
      let d = activity.sleeping ? (B.sleepDecay[k] ?? 0) : B.decay[k];
      if (k === 'energy' && activity.sleeping) d = 0;
      d *= mod(st, 'decay_' + k);
      if (k === 'energy' && lateNight && !activity.sleeping) d *= 1.35 * mod(st, 'nightEnergy');
      n[k] -= d * hrs;
    }
  }
  if (activity.rates) {
    for (const k in activity.rates) {
      let r = activity.rates[k];
      if (r > 0) r *= mod(st, 'gain_' + k);
      n[k] += r * hrs;
    }
  }
  // Health follows how well the body is treated.
  const starving = n.hunger <= B.critical || n.energy <= B.critical;
  if (starving) n.health -= B.healthDrainWhenStarving * mod(st, 'decay_health') * hrs;
  else if (n.hunger > 40 && n.energy > 30 && n.hygiene > 25) n.health += B.healthRegen * hrs;
  else if (n.hygiene < 12) n.health -= 0.5 * hrs;
  for (const k in n) n[k] = clamp(n[k], 0, 100);
  st.mood = computeMood(st);
}

/**
 * Consequences of ignoring needs. Returns a collapse descriptor or null.
 * (The Game layer plays the fade/teleport; the sim applies the costs.)
 */
export function checkCollapse(sim) {
  const st = sim.state;
  const n = st.needs;
  const B = BALANCE.needs;
  if (st.flags.collapsing) return null;
  let kind = null;
  if (n.health <= 3) kind = 'hospital';
  else if (n.energy <= 0.5) kind = 'exhaustion';
  else if (n.hunger <= 0.5) kind = 'hunger';
  if (!kind) return null;
  st.flags.collapsing = true;
  const price = sim.city.priceIndex || 1;
  const bill = Math.round((kind === 'hospital' ? B.hospitalBill : B.faintBill) * price);
  const hours = kind === 'hospital' ? 20 : 7;
  sim.advance(hours * 60, { sleeping: true, noDecay: true, rates: { energy: 9, hunger: 6, health: kind === 'hospital' ? 3.5 : 1.2 } });
  n.energy = Math.max(n.energy, 55);
  n.hunger = Math.max(n.hunger, 50);
  n.health = Math.max(n.health, kind === 'hospital' ? 60 : 35);
  n.hygiene = Math.max(n.hygiene, 40);
  sim.finance.charge(bill, 'health', kind === 'hospital' ? 'Hospital stay' : 'Ambulance & ER visit');
  st.stats.fainted++;
  st.flags.collapsing = false;
  st.mood = computeMood(st);
  const info = { kind, bill, hours };
  sim.bus.emit('collapse', info);
  return info;
}
