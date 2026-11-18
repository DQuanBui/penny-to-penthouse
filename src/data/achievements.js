// Achievements. Each has a check(sim) that is evaluated daily and after key
// events; once true it unlocks for good (state.achievements[id] = day).
import { relLevel } from '../sim/Relationships.js';
import { CAREER_BY_ID } from '../data/careers.js';

const friends = (st, lvl) => Object.values(st.relationships).filter((r) => relLevel(r.score) >= lvl).length;
const nw = (sim) => sim.finance.netWorth();

export const ACHIEVEMENTS = [
  { id: 'first_paycheck', name: 'First Paycheck', icon: '💸', desc: 'Receive your first paycheck.', check: (sim) => (sim.state.stats.paychecks || 0) >= 1 },
  { id: 'first_friend', name: 'First Friend', icon: '😊', desc: 'Turn an acquaintance into a friend.', check: (sim) => friends(sim.state, 2) >= 1 },
  { id: 'promoted', name: 'Moving Up', icon: '📈', desc: 'Earn your first promotion.', check: (sim) => sim.state.stats.promotions >= 1 },
  { id: 'ten_k', name: 'First $10K', icon: '🪙', desc: 'Reach a net worth of $10,000.', check: (sim) => nw(sim) >= 10000 },
  { id: 'emergency_fund', name: 'Emergency Fund', icon: '🛟', desc: 'Keep three months of bills in savings.', check: (sim) => sim.state.money.savings >= 3 * sim.finance.monthlyBills().reduce((s, b) => s + b.amount, 0) },
  { id: 'debt_free', name: 'Debt-Free', icon: '🕊️', desc: 'Pay off every loan and card after having owed money.', check: (sim) => sim.state.flags.hadDebt && sim.finance.breakdown().debt < 1 },
  { id: 'investor', name: 'Investor', icon: '📊', desc: 'Put $10,000 into the market.', check: (sim) => (sim.state.stats.invested || 0) >= 10000 },
  { id: 'diversified', name: 'Diversified', icon: '🧺', desc: 'Hold five different investments at once.', check: (sim) => Object.keys(sim.state.portfolio.holdings).length >= 5 },
  { id: 'hundred_k', name: 'First $100K', icon: '💰', desc: 'Reach a net worth of $100,000.', check: (sim) => nw(sim) >= 100000 },
  { id: 'credit_800', name: 'Exceptional Credit', icon: '💳', desc: 'Reach a credit score of 800.', check: (sim) => sim.state.credit.score >= 800 },
  { id: 'graduate', name: 'Graduate', icon: '🎓', desc: 'Complete a degree or certification.', check: (sim) => sim.state.education.degrees.length + sim.state.education.certs.length > (sim.state.flags.startQuals || 0) },
  { id: 'homeowner', name: 'Homeowner', icon: '🔑', desc: 'Buy your first property.', check: (sim) => sim.state.properties.length >= 1 },
  { id: 'landlord', name: 'Landlord', icon: '🏘️', desc: 'Collect rent from a tenant.', check: (sim) => sim.state.properties.some((p) => p.rented && !p.vacant) },
  { id: 'entrepreneur', name: 'Entrepreneur', icon: '🏪', desc: 'Start your own business.', check: (sim) => sim.state.businesses.length >= 1 },
  { id: 'tycoon', name: 'Tycoon', icon: '🏭', desc: 'Grow a business to level 5.', check: (sim) => sim.state.businesses.some((b) => b.active && b.level >= 5) },
  { id: 'executive', name: 'Promoted to Executive', icon: '👔', desc: 'Reach an executive role.', check: (sim) => !!(sim.state.job && CAREER_BY_ID[sim.state.job.career].levels[sim.state.job.level].exec) },
  { id: 'best_friends_5', name: 'Best Friends ×5', icon: '💛', desc: 'Have five best friends.', check: (sim) => friends(sim.state, 3) >= 5 },
  { id: 'viral', name: 'Viral', icon: '🔥', desc: 'Have a post go viral.', check: (sim) => sim.state.social.posts.some((p) => p.viral) },
  { id: 'influencer', name: 'Influencer', icon: '📸', desc: 'Reach 10,000 followers.', check: (sim) => sim.state.social.followers >= 10000 },
  { id: 'host', name: 'Host With the Most', icon: '🎉', desc: 'Throw five house parties.', check: (sim) => sim.state.social.parties >= 5 },
  { id: 'style_icon', name: 'Style Icon', icon: '✨', desc: 'Give your home a style score of 60.', check: (sim) => (sim.state.home.styleScore || 0) >= 60 },
  { id: 'best_friend', name: 'Best Friend', icon: '🐕', desc: 'Adopt a dog from a pet rescue.', check: (sim) => (sim.state.stats.petsAdopted || 0) >= 1 },
  { id: 'kind_heart', name: 'Kind Heart', icon: '💛', desc: 'Help people on the street ten times.', check: (sim) => (sim.state.stats.kindness || 0) >= 10 },
  { id: 'patron', name: 'Patron of the Arts', icon: '🎸', desc: 'Tip street musicians five times.', check: (sim) => (sim.state.stats.buskerTips || 0) >= 5 },
  { id: 'workhorse', name: 'Workhorse', icon: '⏱️', desc: 'Work 100 shifts.', check: (sim) => sim.state.stats.shifts >= 100 },
  { id: 'master', name: 'Mastery', icon: '🧠', desc: 'Bring any skill to level 10.', check: (sim) => Object.values(sim.state.skills).some((v) => v >= 9.999) },
  { id: 'top_city', name: 'Top of the City', icon: '🏆', desc: 'Rank #1 in your city by net worth.', check: (sim) => sim.rankings?.rank('netWorth', 'city').rank === 1 },
  { id: 'millionaire', name: 'Millionaire', icon: '🤑', desc: 'Reach a net worth of $1,000,000.', check: (sim) => nw(sim) >= 1000000 },
  { id: 'penthouse', name: 'Penthouse', icon: '🌇', desc: 'Own and live in a luxury penthouse.', check: (sim) => sim.state.home.owned && sim.state.home.type === 'penthouse' },
];
export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
