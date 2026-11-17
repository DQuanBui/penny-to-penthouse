// Life goals (chosen at the start of a life). progress(sim) returns
// [current, target]; byAge is an optional deadline.
import { relLevel } from '../sim/Relationships.js';
import { CAREER_BY_ID } from '../data/careers.js';

const friends = (st, lvl) => Object.values(st.relationships).filter((r) => relLevel(r.score) >= lvl).length;
const topRole = (sim, flag) => {
  const j = sim.state.job;
  return j && CAREER_BY_ID[j.career]?.levels[j.level]?.[flag] ? 1 : 0;
};

export const GOALS = [
  { id: 'millionaire', name: 'Millionaire by 30', icon: '💰', byAge: 30, desc: 'Reach a net worth of $1,000,000 before your 30th birthday.', progress: (sim) => [sim.finance.netWorth(), 1000000], money: true },
  { id: 'properties3', name: 'Own 3 properties', icon: '🏘️', desc: 'Build a real-estate portfolio of three homes.', progress: (sim) => [sim.state.properties.length, 3] },
  { id: 'ceo', name: 'Become a CEO', icon: '👔', desc: 'Reach the very top of a career ladder, or grow your own business to level 4.', progress: (sim) => [Math.max(topRole(sim, 'ceo'), sim.state.businesses.some((b) => b.active && b.level >= 4) ? 1 : 0), 1] },
  { id: 'followers1m', name: '1M followers', icon: '📸', desc: 'Become a household name on Pulse.', progress: (sim) => [sim.state.social.followers, 1000000] },
  { id: 'debtfree', name: 'Debt-free with $50K saved', icon: '🕊️', desc: 'Owe nothing and hold $50,000 in cash and investments.', progress: (sim) => { const b = sim.finance.breakdown(); return [b.debt > 0 ? Math.min(49999, b.cash + b.investments) : b.cash + b.investments, 50000]; }, money: true },
  { id: 'penthouse', name: 'Penny to Penthouse', icon: '🌇', desc: 'Live in a luxury penthouse you own.', progress: (sim) => [sim.state.home.owned && sim.state.home.type === 'penthouse' ? 1 : 0, 1] },
  { id: 'bestfriends', name: 'Five best friends', icon: '💛', desc: 'Have five people who would do anything for you.', progress: (sim) => [friends(sim.state, 3), 5] },
  { id: 'master3', name: 'Master of three', icon: '🧠', desc: 'Bring three skills to level 10.', progress: (sim) => [Object.values(sim.state.skills).filter((v) => v >= 9.999).length, 3] },
  { id: 'executive', name: 'Corner office', icon: '🪜', desc: 'Get promoted to an executive role.', progress: (sim) => [topRole(sim, 'exec'), 1] },
  { id: 'mogul', name: 'Business mogul', icon: '🏪', desc: 'Earn $250,000 in lifetime profit from your own businesses.', progress: (sim) => [sim.state.businesses.reduce((s, b) => s + Math.max(0, b.total), 0), 250000], money: true },
];
export const GOAL_BY_ID = Object.fromEntries(GOALS.map((g) => [g.id, g]));
export const MAX_GOALS = 3;
