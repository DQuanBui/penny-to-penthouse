// Random life events. Roughly one fires every 2–3 in-game days.
//   when(sim)        optional condition
//   setup(sim)       optional: roll the numbers for this occurrence -> ctx
//   text(sim, ctx)   what happened
//   choices[]        { label, run(sim, ctx) -> result text }
//   weight, cooldown (days before it can repeat)
import { fmtMoney, lerp } from '../core/utils.js';
import { BALANCE } from './balance.js';
import { skillLevel, addSkill } from '../sim/Player.js';
import { addNeed } from '../sim/Needs.js';
import { adjustScore } from '../sim/Credit.js';
import { relLevel } from '../sim/Relationships.js';
import { FURNITURE_BY_ID } from './furniture.js';
import { BREED_BY_ID, DOG_NAMES } from './pets.js';

const furnitureName = (id) => FURNITURE_BY_ID[id]?.name.toLowerCase() || id;
const furniturePriceOf = (id) => FURNITURE_BY_ID[id]?.price || 200;

const round = (n, to = 10) => Math.round(n / to) * to;
const aFriend = (sim) => {
  const ids = Object.keys(sim.state.relationships).filter((id) => relLevel(sim.state.relationships[id].score) >= 1);
  return ids.length ? sim.rel.npc(ids[Math.floor(sim.rng() * ids.length)]) : null;
};

export const LIFE_EVENTS = [
  {
    id: 'rival_offer', title: 'A rival company calls', icon: '📞', weight: 1.5, cooldown: 50,
    needs: (sim) => !!sim.state.job,
    when: (sim) => sim.state.job && sim.state.job.shifts >= 10 && sim.state.job.raise < BALANCE.jobs.maxRaise - 0.02,
    setup: (sim) => ({ bump: 0.06 + sim.rng() * 0.08 }),
    text: (sim, c) => `A competitor wants to poach you: the same role for ${Math.round(c.bump * 100)}% more pay. Your manager would not be thrilled.`,
    choices: [
      { label: 'Take the offer', run: (sim, c) => { const j = sim.state.job; j.raise = Math.min(BALANCE.jobs.maxRaise, j.raise * (1 + c.bump)); j.perf = 20; j.hiredDay = sim.day; sim.state.flags.careerNews = true; return `New desk, same job, ${fmtMoney(sim.jobs.annualSalary())} a year. You start over proving yourself.`; } },
      { label: 'Use it to negotiate a raise', run: (sim, c) => { const ok = sim.rng() < 0.35 + skillLevel(sim.state, 'charisma') * 0.07; const j = sim.state.job; if (ok) { j.raise = Math.min(BALANCE.jobs.maxRaise, j.raise * (1 + c.bump * 0.6)); return `It worked. Your employer matched most of it: ${fmtMoney(sim.jobs.annualSalary())} a year.`; } j.perf -= 12; return 'Your manager called your bluff. Things are a little frosty now.'; } },
      { label: 'Stay loyal', run: (sim) => { sim.state.job.perf += 10; return 'You turned it down. Word got around — your boss noticed.'; } },
    ],
  },
  {
    // a reaction to a real sell-off (the index 15%+ under its 90-day high), not its cause:
    // the event used to knock 14% off every price and force a recession each time it fired,
    // which made patient index investors poorer than people who kept cash
    id: 'market_crash', title: 'Markets in freefall', icon: '📉', weight: 3, cooldown: 112,
    when: (sim) => sim.market.portfolioValue() > 500 && drawdown(sim) >= 0.15,
    text: (sim) => `Stocks are plunging and the headlines are screaming. Your portfolio (${fmtMoney(sim.market.portfolioValue())}) is taking a beating.`,
    choices: [
      { label: 'Hold. I am in it for the long run.', run: (sim) => { panic(sim); return 'You closed the app and went for a walk. Historically, that is the winning move.'; } },
      { label: 'Sell everything', run: (sim) => { panic(sim); let got = 0; for (const s of Object.keys(sim.state.portfolio.holdings)) got += sim.market.sell(s, 1)?.proceeds || 0; return `You sold near the bottom for ${fmtMoney(got)}. At least the anxiety stopped.`; } },
      { label: 'Buy the dip with $1,000', run: (sim) => { panic(sim); return sim.market.buy('CITY500', Math.min(1000, Math.max(0, sim.state.money.checking))) ? 'You bought the index while everyone else panicked.' : 'You wanted to buy, but there was no spare cash.'; } },
    ],
  },
  {
    id: 'friend_loan', title: 'A friend needs help', icon: '🤝', weight: 2, cooldown: 14,
    needs: (sim) => !!aFriend(sim),
    when: (sim) => !!aFriend(sim),
    setup: (sim) => ({ npc: aFriend(sim).id, amount: round(lerp(150, 1200, sim.rng() * sim.rng()), 50) }),
    text: (sim, c) => `${sim.rel.npc(c.npc).first} is short on rent and asks to borrow ${fmtMoney(c.amount)}.`,
    choices: [
      { label: 'Lend it', run: (sim, c) => { const n = sim.rel.npc(c.npc); if (!sim.finance.spend(c.amount, 'other', `Loan to ${n.first}`, { credit: false, silent: true })) return 'You wanted to help, but you do not have it either.'; sim.rel.add(c.npc, 9); if (sim.rng() < 0.7) (sim.state.flags.owed ||= []).push({ npc: c.npc, amount: c.amount, day: sim.day + 6 + Math.floor(sim.rng() * 10) }); return `${n.first} hugs you. "I will pay you back, I promise."`; } },
      { label: 'Give it as a gift', run: (sim, c) => { const n = sim.rel.npc(c.npc); if (!sim.finance.spend(c.amount, 'fun', `Gift to ${n.first}`, { credit: false, silent: true })) return 'You wanted to help, but you do not have it either.'; sim.rel.add(c.npc, 16); return `${n.first} is speechless. That is a friend for life.`; } },
      { label: 'Say no kindly', run: (sim, c) => { sim.rel.add(c.npc, -6); return 'It was awkward, but you have your own rent to pay.'; } },
    ],
  },
  {
    id: 'car_breakdown', title: 'Car trouble', icon: '🚗', weight: 2, cooldown: 25,
    needs: (sim) => sim.state.vehicles.length > 0,
    when: (sim) => sim.state.vehicles.length > 0,
    setup: (sim) => ({ cost: round(lerp(350, 1400, sim.rng())) }),
    text: (sim, c) => `Your car is making a noise that sounds expensive. The mechanic quotes ${fmtMoney(c.cost)}.`,
    choices: [
      { label: 'Fix it properly', run: (sim, c) => { sim.finance.charge(c.cost, 'transit', 'Car repair'); return 'Good as new. Maintenance is cheaper than a breakdown.'; } },
      { label: 'Ignore it', run: (sim) => { const v = sim.state.vehicles[0]; v.value = Math.round(v.value * 0.85); v.condition = Math.max(0.2, (v.condition ?? 1) - 0.3); return 'It still drives... for now. The car lost value and feels sluggish.'; } },
    ],
  },
  {
    id: 'viral_moment', title: 'You are trending', icon: '🔥', weight: 1.2, cooldown: 30,
    when: (sim) => sim.state.social.posts.length >= 2,
    setup: (sim) => ({ gain: Math.round(400 + sim.state.social.followers * (0.3 + sim.rng() * 0.6)) }),
    text: (sim, c) => `Someone big reposted you. Your phone will not stop buzzing: about ${c.gain.toLocaleString()} new followers are pouring in.`,
    choices: [
      { label: 'Stay authentic and enjoy it', run: (sim, c) => { sim.state.social.followers += Math.round(c.gain * 1.3); sim.social.recompute(); return 'You kept posting like yourself. The new audience is sticking around.'; } },
      { label: 'Cash in with a quick ad', run: (sim, c) => { sim.state.social.followers += Math.round(c.gain * 0.6); const pay = sim.finance.earnTaxed(Math.round(150 + c.gain * 0.25), 'hustle', 'Viral brand deal'); sim.social.recompute(); return `A brand paid ${fmtMoney(pay)}. Some new followers rolled their eyes and left.`; } },
    ],
  },
  {
    id: 'rent_hike', title: 'Rent increase notice', icon: '🏠', weight: 2, cooldown: 40,
    when: (sim) => !sim.state.home.owned && sim.state.home.type !== 'couch' && sim.day > 20,
    setup: (sim) => ({ pct: 0.05 + sim.rng() * 0.06 }),
    text: (sim, c) => `Your landlord is raising the rent by ${Math.round(c.pct * 100)}%: from ${fmtMoney(sim.state.home.rent)} to ${fmtMoney(round(sim.state.home.rent * (1 + c.pct)))}.`,
    choices: [
      { label: 'Accept it', run: (sim, c) => { sim.state.home.rent = round(sim.state.home.rent * (1 + c.pct)); return 'You signed. Lifestyle costs only ever seem to go one way.'; } },
      { label: 'Negotiate', run: (sim, c) => { const ok = sim.rng() < 0.3 + skillLevel(sim.state, 'charisma') * 0.08 + (sim.state.bills.missedRent ? -0.3 : 0.1); sim.state.home.rent = round(sim.state.home.rent * (1 + (ok ? c.pct * 0.3 : c.pct))); return ok ? 'You pointed out you always pay on time. The landlord settled for a small bump.' : 'The landlord would not budge.'; } },
    ],
  },
  {
    id: 'scholarship', title: 'Scholarship offer', icon: '🎓', weight: 1.5, cooldown: 50,
    when: (sim) => !sim.state.education.enrolled && !sim.state.flags.scholarship && sim.day > 3,
    setup: (sim) => ({ pct: 0.3 + Math.round(sim.rng() * 3) * 0.1 }),
    text: (sim, c) => `A local foundation offers you ${Math.round(c.pct * 100)}% off tuition for the next programme you enrol in.`,
    choices: [
      { label: 'Accept gratefully', run: (sim, c) => { sim.state.flags.scholarship = c.pct; return 'It is yours. Open the Learn app when you are ready — the discount applies to your next enrolment.'; } },
      { label: 'Pass — school is not for me', run: () => 'You declined. Someone else will put it to good use.' },
    ],
  },
  {
    id: 'health_scare', title: 'Not feeling right', icon: '🤒', weight: 2, cooldown: 18,
    setup: (sim) => ({ cost: round(lerp(180, 700, sim.rng()) * (sim.state.job && sim.state.job.level >= 2 ? 0.4 : 1)) }),
    text: (sim, c) => `You wake up with a fever and a cough that will not quit. A clinic visit would cost ${fmtMoney(c.cost)}${sim.state.job && sim.state.job.level >= 2 ? ' with your employer plan' : ''}.`,
    choices: [
      { label: 'See a doctor', run: (sim, c) => { sim.finance.charge(c.cost, 'health', 'Clinic visit'); addNeed(sim, 'health', 25); return 'Antibiotics and rest. You caught it early.'; } },
      { label: 'Tough it out', run: (sim) => { addNeed(sim, 'health', -22); addNeed(sim, 'energy', -20); return sim.rng() < 0.5 ? 'It passed after a rough few days.' : 'It got worse before it got better. You feel wrecked.'; } },
    ],
  },
  {
    id: 'inheritance', title: 'An unexpected inheritance', icon: '💌', weight: 0.8, cooldown: 120,
    when: (sim) => sim.day > 10,
    setup: (sim) => ({ amount: round(lerp(2000, 14000, sim.rng() * sim.rng()), 100) }),
    text: (sim, c) => `A great-aunt you met twice left you ${fmtMoney(c.amount)}. What would she want you to do with it?`,
    choices: [
      { label: 'Put it in savings', run: (sim, c) => { sim.finance.earn(c.amount, 'gift', 'Inheritance'); sim.finance.transfer('checking', 'savings', c.amount); return 'Safe and sound, earning interest. An emergency fund buys peace of mind.'; } },
      { label: 'Invest it in the index fund', run: (sim, c) => { sim.finance.earn(c.amount, 'gift', 'Inheritance'); sim.market.buy('CITY500', c.amount); return 'Invested. In ten years this decision will look very smart.'; } },
      { label: 'Treat myself', run: (sim, c) => { sim.finance.earn(c.amount * 0.5, 'gift', 'Inheritance'); addNeed(sim, 'fun', 60); addNeed(sim, 'social', 25); return 'Half of it became an unforgettable month. No regrets — mostly.'; } },
    ],
  },
  {
    id: 'buyout', title: 'Buyout offer', icon: '🏢', weight: 1.5, cooldown: 60,
    needs: (sim) => sim.biz.list.length > 0,
    when: (sim) => sim.biz.list.some((b) => b.avgProfit > 50 && sim.day - b.opened > 28),
    setup: (sim) => { const b = sim.biz.list.filter((x) => x.avgProfit > 50).sort((a, c) => c.avgProfit - a.avgProfit)[0]; return { id: b.id, price: round(sim.biz.valueOf(b) * (1.2 + sim.rng() * 0.3), 100) }; },
    text: (sim, c) => { const b = sim.biz.list.find((x) => x.id === c.id); return `A larger company offers ${fmtMoney(c.price)} to buy ${b?.name || 'your business'} outright.`; },
    choices: [
      { label: 'Sell', run: (sim, c) => { const got = sim.biz.sell(c.id, c.price); return `Deal done. ${fmtMoney(got)} before tax, and your evenings back.`; } },
      { label: 'Keep building', run: (sim, c) => { const b = sim.biz.list.find((x) => x.id === c.id); if (b) b.reputation = Math.min(100, b.reputation + 6); return 'You said no. The offer itself made the local news — good for business.'; } },
    ],
  },
  {
    id: 'tax_refund', title: 'Tax refund', icon: '🧾', weight: 1.5, cooldown: 100,
    when: (sim) => sim.state.stats.taxesPaid > 1500,
    setup: (sim) => ({ amount: round(Math.min(2500, sim.state.stats.taxesPaid * (0.03 + sim.rng() * 0.04))) }),
    text: (sim, c) => `You over-paid tax this year. A refund of ${fmtMoney(c.amount)} is on its way.`,
    choices: [
      { label: 'Pay down debt', run: (sim, c) => { sim.finance.earn(c.amount, 'other_in', 'Tax refund'); const l = [...sim.state.loans].sort((a, b) => b.apr - a.apr)[0]; if (sim.state.credit.card?.balance > 0) return 'Refund received — use it on your card in the Bank app before interest hits.'; if (l) { sim.loans.payExtra(l.id, c.amount); return `Straight onto your ${l.label.toLowerCase()}. Future-you says thanks.`; } return 'You have no debt, so it went into checking.'; } },
      { label: 'Keep it in checking', run: (sim, c) => { sim.finance.earn(c.amount, 'other_in', 'Tax refund'); return 'A little breathing room this month.'; } },
    ],
  },
  {
    id: 'lost_wallet', title: 'A wallet on the pavement', icon: '👛', weight: 1.5, cooldown: 40,
    setup: (sim) => ({ cash: round(40 + sim.rng() * 260) }),
    text: (sim, c) => `You find a wallet with ${fmtMoney(c.cash)} in cash and an ID inside.`,
    choices: [
      { label: 'Return it to the owner', run: (sim, c) => { sim.state.social.followers += 25; addNeed(sim, 'fun', 12); adjustScore(sim, 0); const tip = sim.rng() < 0.5 ? round(c.cash * 0.3, 5) : 0; if (tip) sim.finance.earn(tip, 'gift', 'Reward for returning a wallet'); return tip ? `The owner insisted on a ${fmtMoney(tip)} reward and posted about you.` : 'The owner nearly cried. You walk a little taller today.'; } },
      { label: 'Keep the cash', run: (sim, c) => { sim.finance.earn(c.cash, 'other_in', 'Found money'); addNeed(sim, 'fun', -8); return 'Finders keepers. It does not feel as good as you expected.'; } },
    ],
  },
  {
    id: 'mentor', title: 'Coffee with a mentor', icon: '🧭', weight: 1.5, cooldown: 30,
    needs: (sim) => !!sim.state.job,
    when: (sim) => !!sim.state.job,
    text: () => 'A senior colleague offers to buy you a coffee and share what they wish they had known at your age.',
    choices: [
      { label: 'Ask about the craft', run: (sim) => { const c = sim.jobs.career(); addSkill(sim, c.skill, 0.6); return `An hour of hard-won shortcuts. Your ${c.skill} jumped.`; } },
      { label: 'Ask about money', run: (sim) => { addSkill(sim, 'finance', 0.6); return '"Pay yourself first. Index funds. Never carry a card balance." You took notes.'; } },
      { label: 'Ask how to get promoted', run: (sim) => { sim.state.job.perf += 14; addSkill(sim, 'charisma', 0.25); return 'You learned what your manager actually cares about.'; } },
    ],
  },
  {
    id: 'phone_broke', title: 'Cracked screen', icon: '📱', weight: 1.5, cooldown: 45,
    setup: (sim) => ({ cost: round(90 + sim.rng() * 160) }),
    text: (sim, c) => `Your phone slipped out of your hand. The repair shop wants ${fmtMoney(c.cost)}.`,
    choices: [
      { label: 'Repair it', run: (sim, c) => { sim.finance.charge(c.cost, 'phone', 'Phone repair'); return 'Fixed in an hour. An emergency fund turns disasters into errands.'; } },
      { label: 'Live with the cracks', run: (sim) => { addNeed(sim, 'fun', -10); return 'You can still read most of the screen. Mostly.'; } },
    ],
  },
  {
    id: 'bonus', title: 'Surprise bonus', icon: '🎁', weight: 1.2, cooldown: 35,
    needs: (sim) => !!sim.state.job,
    when: (sim) => sim.state.job && sim.state.job.perf > 50,
    setup: (sim) => ({ amount: round(sim.jobs.annualSalary() * (0.01 + sim.rng() * 0.02)) }),
    text: (sim, c) => `Your team hit its targets and you were a big part of it. A ${fmtMoney(c.amount)} bonus lands in your account.`,
    choices: [
      { label: 'Save it', run: (sim, c) => { sim.finance.earn(c.amount, 'tips', 'Performance bonus'); sim.finance.transfer('checking', 'savings', c.amount); return 'Straight to savings before lifestyle creep could find it.'; } },
      { label: 'Celebrate with the team', run: (sim, c) => { sim.finance.earn(c.amount * 0.6, 'tips', 'Performance bonus'); addNeed(sim, 'social', 30); addNeed(sim, 'fun', 25); return 'Drinks were on you. The team will remember it.'; } },
    ],
  },
  // ---- more everyday life ----------------------------------------------------------
  {
    id: 'jury_duty', title: 'Jury duty', icon: '⚖️', weight: 1, cooldown: 90,
    when: (sim) => sim.day > 14,
    text: () => 'A summons arrives: you have been called for jury duty this week.',
    choices: [
      { label: 'Serve — it is your civic duty', run: (sim) => { sim.advance(6 * 60, { noCollapse: true }); sim.finance.earn(40, 'other_in', 'Juror stipend'); addSkill(sim, 'charisma', 0.25); addNeed(sim, 'social', 12); if (sim.state.job) sim.state.job.perf += 3; return 'Six hours of deliberation and a verdict you can stand behind. Your boss was impressed you went.'; } },
      { label: 'Ask to postpone', run: () => 'The court grants a postponement. Somewhere, a clerk sighs.' },
    ],
  },
  {
    id: 'parking_ticket', title: 'Parking ticket', icon: '🅿️', weight: 1.5, cooldown: 30,
    needs: (sim) => sim.state.vehicles.length > 0,
    when: (sim) => sim.state.vehicles.length > 0,
    setup: (sim) => ({ fine: round(45 + sim.rng() * 50, 5) }),
    text: (sim, c) => `There is a ${fmtMoney(c.fine)} ticket under your windscreen wiper. The sign was... technically there.`,
    choices: [
      { label: 'Just pay it', run: (sim, c) => { sim.finance.charge(c.fine, 'transit', 'Parking ticket'); return 'Paid online in two minutes. Lesson learned.'; } },
      { label: 'Contest it', run: (sim, c) => { if (sim.rng() < 0.35 + skillLevel(sim.state, 'charisma') * 0.04) return 'You won! The sign really was hidden behind a tree. Ticket dismissed.'; sim.finance.charge(round(c.fine * 1.5, 5), 'transit', 'Parking ticket + late fee'); return 'The judge was not convinced. You pay the ticket plus a late fee.'; } },
    ],
  },
  {
    id: 'wedding', title: 'Wedding invitation', icon: '💒', weight: 1.2, cooldown: 60,
    needs: (sim) => Object.keys(sim.state.relationships).length > 0,
    when: (sim) => Object.values(sim.state.relationships).some((r) => relLevel(r.score) >= 2),
    setup: (sim) => {
      const ids = Object.keys(sim.state.relationships).filter((id) => relLevel(sim.state.relationships[id].score) >= 2);
      return { npc: ids[Math.floor(sim.rng() * ids.length)], gift: round(60 + sim.rng() * 90) };
    },
    text: (sim, c) => `${sim.rel.npc(c.npc).first} is getting married and wants you there! A good gift costs about ${fmtMoney(c.gift)}.`,
    choices: [
      { label: 'Go, with a thoughtful gift', run: (sim, c) => { sim.finance.charge(c.gift, 'fun', 'Wedding gift'); sim.rel.add(c.npc, 14); addNeed(sim, 'social', 35); addNeed(sim, 'fun', 25); sim.state.social.followers += 15; return 'You cried at the vows and danced until the band packed up.'; } },
      { label: 'Send a card with regrets', run: (sim, c) => { sim.rel.add(c.npc, -4); return 'They understood. Mostly.'; } },
    ],
  },
  {
    id: 'side_gig', title: 'A side project lands in your lap', icon: '🧩', weight: 1.2, cooldown: 25,
    when: (sim) => Math.max(...Object.values(sim.state.skills)) >= 4,
    setup: (sim) => {
      const top = Object.entries(sim.state.skills).sort((a, b) => b[1] - a[1])[0];
      return { skill: top[0], pay: round(200 + top[1] * 70 + sim.rng() * 250) };
    },
    text: (sim, c) => `Someone saw your ${c.skill} work and offers ${fmtMoney(c.pay)} for a weekend project.`,
    choices: [
      { label: 'Take it — weekends are for hustling', run: (sim, c) => { sim.advance(8 * 60, { noCollapse: true }); addNeed(sim, 'energy', -18); addNeed(sim, 'fun', -10); const net = sim.finance.earnTaxed(c.pay, 'hustle', 'Weekend project'); addSkill(sim, c.skill, 0.3); return `Done and delivered. ${fmtMoney(net)} after tax, and a glowing review.`; } },
      { label: 'Protect your weekend', run: (sim) => { addNeed(sim, 'fun', 8); return 'You said no and slept in. Rest is productive too.'; } },
    ],
  },
  {
    id: 'flash_sale', title: 'Flash sale at the furniture store', icon: '🏷️', weight: 1.2, cooldown: 35,
    setup: (sim) => {
      const ids = ['sofa', 'bed_double', 'desk_wood', 'tv_big', 'plant_tree', 'rug_large', 'lamp_arc', 'bookshelf'];
      const id = ids[Math.floor(sim.rng() * ids.length)];
      return { id };
    },
    text: (sim, c) => `Today only: 50% off a ${furnitureName(c.id)} (${fmtMoney(furniturePriceOf(c.id) / 2)}).`,
    choices: [
      { label: 'Buy it', run: (sim, c) => { if (!sim.finance.spend(furniturePriceOf(c.id) / 2, 'shopping', `Sale: ${furnitureName(c.id)}`, { silent: true })) return 'Your card was declined. Maybe it was a sign.'; const inv = (sim.state.inventory.furniture ||= {}); inv[c.id] = (inv[c.id] || 0) + 1; return 'Delivered to your storage. Place it at home in build mode (B).'; } },
      { label: 'Skip it — I do not need it', run: (sim) => { addSkill(sim, 'finance', 0.1); return 'The best purchase is the one you did not make.'; } },
    ],
  },
  {
    id: 'scam', title: '"Guaranteed" 10× returns', icon: '🪤', weight: 1, cooldown: 70,
    when: (sim) => sim.state.money.checking > 600,
    text: () => 'A smooth stranger at the café pitches a coin that "can only go up". He needs $500 today to get you in.',
    choices: [
      { label: 'Hand over $500', run: (sim) => { sim.finance.charge(500, 'other', 'Investment "opportunity"'); return 'His phone number stops working the next day. It was a scam. Real investing is slow and boring — and works.'; } },
      { label: 'Walk away', run: (sim) => { addSkill(sim, 'finance', 0.25); return 'If it sounds too good to be true, it is. You feel smarter already.'; } },
    ],
  },
  {
    id: 'noisy_neighbors', title: 'Noisy neighbours', icon: '🔊', weight: 1.2, cooldown: 30,
    when: (sim) => !sim.state.home.owned && sim.state.home.type !== 'couch',
    text: () => 'Your neighbours are throwing a party on a work night. The bass is coming through the wall.',
    choices: [
      { label: 'Knock and join the party', run: (sim) => { sim.advance(150, { noCollapse: true }); addNeed(sim, 'fun', 25); addNeed(sim, 'social', 22); addNeed(sim, 'energy', -15); return 'Turns out they are fun. You made it to bed at 2 AM.'; } },
      { label: 'Buy earplugs and sleep', run: (sim) => { sim.finance.charge(8, 'health', 'Earplugs'); return 'Silence. Bliss.'; } },
      { label: 'Complain to the landlord', run: (sim) => { addNeed(sim, 'fun', -4); return 'The landlord promises to "have a word". The party goes on.'; } },
    ],
  },
  {
    id: 'old_friend', title: 'An old friend is in town', icon: '🧳', weight: 1.2, cooldown: 40,
    text: () => 'Your best friend from back home is visiting for the day and wants the full city tour.',
    choices: [
      { label: 'Show them everything', run: (sim) => { const cost = round(60 * (sim.city.priceIndex || 1)); sim.finance.charge(cost, 'fun', 'Showing a friend around'); sim.advance(5 * 60, { noCollapse: true }); addNeed(sim, 'social', 40); addNeed(sim, 'fun', 30); return 'Landmarks, street food, a rooftop at sunset. Seeing your city through their eyes made you love it again.'; } },
      { label: 'Just grab a coffee', run: (sim) => { sim.finance.charge(10, 'food', 'Coffee with an old friend'); addNeed(sim, 'social', 18); return 'An hour of catching up. It felt like no time had passed.'; } },
    ],
  },
  {
    id: 'raise_request', title: 'Review season', icon: '📈', weight: 1.2, cooldown: 45,
    needs: (sim) => !!sim.state.job,
    when: (sim) => sim.state.job && sim.state.job.perf > 55 && sim.state.job.raise < BALANCE.jobs.maxRaise - 0.03,
    text: () => 'Your manager asks how you think the year went. This could be the moment to ask for a raise.',
    choices: [
      { label: 'Ask for 8% more', run: (sim) => { const j = sim.state.job; const ok = sim.rng() < 0.35 + skillLevel(sim.state, 'charisma') * 0.06 + j.perf / 400; if (ok) { j.raise = Math.min(BALANCE.jobs.maxRaise, j.raise * 1.08); return `Approved! New salary: ${fmtMoney(sim.jobs.annualSalary())} a year.`; } j.perf -= 5; return '"Let us revisit next quarter." Not a no — but not a yes.'; } },
      { label: 'Ask for more responsibility instead', run: (sim) => { sim.state.job.perf += 12; return 'You walk out leading a new project. A promotion is closer now.'; } },
    ],
  },
  {
    id: 'snow_day', title: 'Snow day!', icon: '⛄', weight: 2, cooldown: 20,
    when: (sim) => Math.floor((sim.day % 112) / 28) === 3 && (sim.city.weather?.snowInWinter || 0) > 0.2,
    text: () => 'A foot of snow fell overnight. The city is quiet and white, and the kids are already out with sleds.',
    choices: [
      { label: 'Build a snowman in the park', run: (sim) => { addNeed(sim, 'fun', 30); addNeed(sim, 'energy', -8); sim.state.social.followers += 30; return 'He has a carrot nose and your old scarf. He got 200 likes.'; } },
      { label: 'Stay in with hot chocolate', run: (sim) => { addNeed(sim, 'fun', 16); addNeed(sim, 'energy', 10); return 'Blanket, mug, window. Perfect.'; } },
    ],
  },
  {
    id: 'heat_wave', title: 'Heat wave', icon: '🥵', weight: 2, cooldown: 20,
    when: (sim) => Math.floor((sim.day % 112) / 28) === 1 && (sim.city.weather?.haze || 0) > 0.1,
    setup: (sim) => ({ ac: round(260 * (sim.city.priceIndex || 1)) }),
    text: (sim, c) => `It is 102°F and your apartment is an oven. A window AC unit costs ${fmtMoney(c.ac)}.`,
    choices: [
      { label: 'Buy the AC unit', run: (sim, c) => { sim.finance.charge(c.ac, 'housing', 'Window AC unit'); addNeed(sim, 'energy', 15); return 'Sweet, cold relief. You sleep like a baby.'; } },
      { label: 'Spend the afternoon at the mall', run: (sim) => { sim.advance(180, { noCollapse: true }); addNeed(sim, 'fun', 12); return 'Free air conditioning and people-watching. Not bad.'; } },
      { label: 'Tough it out', run: (sim) => { addNeed(sim, 'energy', -20); addNeed(sim, 'health', -8); return 'You did not sleep. At all.'; } },
    ],
  },
  {
    id: 'charity', title: 'Neighbourhood food drive', icon: '🥫', weight: 1.2, cooldown: 40,
    text: () => 'Volunteers are collecting for the local food bank before the holidays.',
    choices: [
      { label: 'Donate $50', run: (sim) => { sim.finance.charge(50, 'gift', 'Food bank donation'); sim.state.flags.moodBoost = Math.min(12, (sim.state.flags.moodBoost || 0) + 1); sim.state.social.followers += 10; return 'They hand you a sticker. You wear it all day.'; } },
      { label: 'Volunteer for a shift', run: (sim) => { sim.advance(180, { noCollapse: true }); addNeed(sim, 'social', 28); addSkill(sim, 'charisma', 0.2); sim.state.social.followers += 20; return 'Three hours of packing boxes with strangers who are now friends.'; } },
      { label: 'Not this time', run: () => 'Maybe next year.' },
    ],
  },
  {
    id: 'promo_party', title: 'Office party', icon: '🥳', weight: 1.2, cooldown: 35,
    needs: (sim) => !!sim.state.job,
    when: (sim) => !!sim.state.job,
    text: () => 'Your team is celebrating a big win with drinks after work on Friday.',
    choices: [
      { label: 'Go and mingle', run: (sim) => { sim.finance.charge(round(25 * (sim.city.priceIndex || 1)), 'fun', 'Office party'); sim.advance(150, { noCollapse: true }); addNeed(sim, 'social', 30); addNeed(sim, 'fun', 20); sim.state.job.perf += 6; return 'You finally talked to the VP. She remembered your name on Monday.'; } },
      { label: 'Head home early', run: (sim) => { addNeed(sim, 'energy', 10); return 'An early night. Your bed thanks you.'; } },
    ],
  },
  {
    id: 'stray_dog', title: 'A shadow with a waggy tail', icon: '🐕', weight: 1, cooldown: 45,
    needs: (sim) => !sim.state.pet,
    when: (sim) => !sim.state.pet && sim.day > 5,
    setup: (sim) => ({ name: DOG_NAMES[Math.floor(sim.rng() * DOG_NAMES.length)] }),
    text: (sim, c) => `A scruffy, friendly mutt has followed you for three blocks. No collar, no chip, just hopeful eyes. The kid at the corner store calls them "${c.name}".`,
    choices: [
      { label: 'Take them home', run: (sim, c) => { sim.finance.charge(round(40 * (sim.city.priceIndex || 1)), 'shopping', 'Dog bed and bowls'); sim.pets.adopt({ breed: BREED_BY_ID.mixed, name: c.name, age: 2 }, c.name, true); return `${c.name} sniffs every corner of your place, then falls asleep on your feet. You have a dog now.`; } },
      { label: 'Walk them to the pet rescue', run: (sim, c) => { addNeed(sim, 'fun', 4); sim.advance(40, { noCollapse: true }); return `The rescue staff know ${c.name} already. "They always find their way to good people." You can visit any time.`; } },
    ],
  },
  {
    id: 'dog_mischief', title: 'Somebody ate a sock', icon: '🧦', weight: 1.4, cooldown: 30,
    needs: (sim) => !!sim.state.pet,
    when: (sim) => !!sim.state.pet,
    setup: (sim) => ({ bill: round(lerp(160, 420, sim.rng()), 10) }),
    text: (sim, c) => `${sim.state.pet.name} ate one of your socks and now looks very sorry for themselves. The emergency vet quotes ${fmtMoney(c.bill * (sim.city.priceIndex || 1))}.`,
    choices: [
      { label: 'Rush to the vet', run: (sim, c) => { sim.finance.charge(round(c.bill * (sim.city.priceIndex || 1)), 'health', 'Emergency vet'); sim.state.pet.happy = Math.min(100, sim.state.pet.happy + 10); return 'Sock retrieved. The vet has seen worse. Much worse.'; } },
      { label: 'Wait and see', run: (sim, c) => { if (sim.rng() < 0.6) return 'By the morning the sock has… passed. Crisis over, laundry ruined.'; sim.finance.charge(round(c.bill * 1.6 * (sim.city.priceIndex || 1)), 'health', 'Emergency vet (overnight)'); sim.state.pet.happy = Math.max(0, sim.state.pet.happy - 25); return 'It got worse overnight. An emergency surgery later, everyone is fine, but your wallet is not.'; } },
    ],
  },
];
export const LIFE_EVENT_BY_ID = Object.fromEntries(LIFE_EVENTS.map((e) => [e.id, e]));

/** How far the index sits under its high of the last 90 days (0..1). */
function drawdown(sim) {
  const h = sim.state.market.hist?.CITY500;
  if (!h?.length) return 0;
  return 1 - h[h.length - 1] / Math.max(...h);
}
function panic(sim) {
  sim.market.news('📉', 'Panic on the trading floor', `The index is ${Math.round(drawdown(sim) * 100)}% off its high as panic selling spreads.`, 'bad');
}
