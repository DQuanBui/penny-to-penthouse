// Player-wide helpers: trait modifiers and skills.
import { TRAIT_BY_ID } from '../data/traits.js';
import { SKILL_BY_ID } from '../data/archetypes.js';
import { BALANCE } from '../data/balance.js';
import { clamp } from '../core/utils.js';

/** Product of all trait multipliers for `key` (1 when no trait cares). */
export function mod(state, key) {
  let m = 1;
  for (const id of state.profile.traits) {
    const v = TRAIT_BY_ID[id]?.mods?.[key];
    if (v != null) m *= v;
  }
  return m;
}
/** Sum of additive trait bonuses for `key` (0 when none). */
export function bonus(state, key) {
  let b = 0;
  for (const id of state.profile.traits) {
    const v = TRAIT_BY_ID[id]?.mods?.[key];
    if (v != null) b += v;
  }
  return b;
}

export const skill = (state, id) => state.skills[id] || 0;
export const skillLevel = (state, id) => Math.floor((state.skills[id] || 0) + 1e-6);

/**
 * Add experience to a skill. Gains shrink as the level rises.
 * @returns the amount actually gained
 */
export function addSkill(sim, id, xp) {
  const st = sim.state;
  const before = st.skills[id] || 0;
  if (before >= BALANCE.skills.max) return 0;
  const gain = (xp * mod(st, 'xpGain') * mod(st, 'xp_' + id)) / (1 + BALANCE.skills.curve * before);
  const after = clamp(before + gain, 0, BALANCE.skills.max);
  st.skills[id] = after;
  if (Math.floor(after + 1e-6) > Math.floor(before + 1e-6)) {
    const s = SKILL_BY_ID[id];
    sim.bus.emit('toast', { icon: s.icon, title: `${s.name} level ${Math.floor(after + 1e-6)}`, text: 'Skill up! New doors are opening.', kind: 'good' });
    sim.bus.emit('skillup', { id, level: Math.floor(after + 1e-6) });
  }
  return after - before;
}
