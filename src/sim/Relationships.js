// Friendships with the city's named residents: interactions, hangouts, gifts,
// dating/partner/roommate, daily decay and the perks friends bring
// (job referrals, shop discounts, tips, party invites).
import { BALANCE } from '../data/balance.js';
import { npcsOf, npcWhere, PERSONALITY } from '../data/npcs/index.js';
import { GIFTS } from '../data/items.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { SKILLS } from '../data/archetypes.js';
import { clamp, pick, fmtMoney } from '../core/utils.js';
import { hourOf } from '../core/Clock.js';
import { mod, skillLevel, addSkill } from './Player.js';
import { addNeed } from './Needs.js';
import { priceOf } from './Activities.js';

const S = BALANCE.social;
export const REL_LEVELS = ['Stranger', 'Acquaintance', 'Friend', 'Best friend'];
export const REL_ICONS = ['👤', '🙂', '😊', '💛'];
export const relLevel = (score) => (score >= S.levels[3] ? 3 : score >= S.levels[2] ? 2 : score >= S.levels[1] ? 1 : 0);

export const TALK_ACTIONS = {
  chat: { label: 'Chat', icon: '💬', base: S.chat, minutes: 15, social: 9 },
  joke: { label: 'Tell a joke', icon: '😄', base: S.joke, minutes: 10, social: 8, fun: 5 },
  compliment: { label: 'Compliment', icon: '🌟', base: S.compliment, minutes: 8, social: 6 },
  askWork: { label: 'Ask about work', icon: '💼', base: S.askWork, minutes: 15, social: 6 },
};

// kind: [label, icon, minutes, price key (×2, you treat), needs, relationship multiplier, hours allowed]
export const HANGOUTS = {
  walk: ['Take a walk', '🚶', 60, null, { social: 24, fun: 10 }, 1.0, [7, 22]],
  coffee: ['Grab a coffee', '☕', 60, 'coffee', { social: 28, fun: 12, energy: 8 }, 1.1, [7, 20]],
  gym: ['Work out together', '🏋️', 75, null, { social: 18, fun: 8, energy: -14, hygiene: -18, health: 6 }, 1.0, [6, 22]],
  dinner: ['Have dinner', '🍝', 100, 'restaurantMeal', { social: 34, fun: 18, hunger: 75 }, 1.35, [11, 22]],
  drinks: ['Go for drinks', '🍸', 90, 'barDrink', { social: 36, fun: 24, energy: -4 }, 1.25, [17, 26]],
};

const LINES = {
  chat: ['You swap stories about the city.', 'Easy conversation. Time flies.', 'You find out you have more in common than you thought.'],
  jokeGood: ['They burst out laughing.', 'That one landed. They are still grinning.', '"Okay, that was actually funny."'],
  jokeBad: ['Silence. A polite cough.', 'They did not get it. Awkward.', '"...right."'],
  compliment: ['They light up.', '"That is really kind of you."', 'A genuine smile.'],
  askWork: ['They tell you what a normal day looks like.', 'You get the inside story on their industry.', 'They clearly love talking shop.'],
  tired: ['They glance at the time. "I should get going — catch you later!"'],
};

export class Relationships {
  constructor(sim) {
    this.sim = sim;
  }
  get all() {
    return npcsOf(this.sim.city.id);
  }
  npc(id) {
    return this.all.find((n) => n.id === id);
  }
  /** Relationship record (created on first contact). */
  rel(id, create = false) {
    const map = this.sim.state.relationships;
    if (!map[id] && create) map[id] = { score: 0, met: this.sim.day, lastDay: -1, today: 0, todayDay: -1, hangDay: -1 };
    return map[id];
  }
  score(id) {
    return this.rel(id)?.score || 0;
  }
  level(id) {
    return relLevel(this.score(id));
  }
  /** Met NPCs at or above a level, best first. */
  known(minLevel = 0) {
    const map = this.sim.state.relationships;
    return this.all.filter((n) => map[n.id] && relLevel(map[n.id].score) >= minLevel).sort((a, b) => map[b.id].score - map[a.id].score);
  }
  friendCount(minLevel = 2) {
    return this.known(minLevel).length;
  }
  where(npc) {
    const st = this.sim.state;
    return npcWhere(npc, hourOf(st.time.total), this.sim.day);
  }

  /** Apply a relationship change; handles level-ups. */
  add(id, delta) {
    const sim = this.sim;
    const st = sim.state;
    const r = this.rel(id, true);
    const before = relLevel(r.score);
    r.score = clamp(r.score + delta, 0, 100);
    r.lastDay = sim.day;
    const after = relLevel(r.score);
    if (after > before) {
      const n = this.npc(id);
      if (after === 2) st.stats.friendsMade++;
      sim.bus.emit('toast', { icon: REL_ICONS[after], title: `${n.first} is now your ${REL_LEVELS[after].toLowerCase()}`, text: after === 2 ? 'Friends share referrals, discounts and invites.' : after === 3 ? 'Best friends have your back.' : 'A new face in your contacts.', kind: 'good' });
      sim.bus.emit('relLevel', { id, level: after });
    }
    return r.score;
  }

  sharedInterest(npc) {
    const st = this.sim.state;
    const top = SKILLS.map((s) => s.id).sort((a, b) => st.skills[b] - st.skills[a]).slice(0, 2);
    return npc.interests.find((i) => top.includes(i) && st.skills[i] >= 2) || null;
  }

  /**
   * chat / joke / compliment / askWork.
   * @returns { ok, text, delta, perk? }
   */
  talk(id, action) {
    const sim = this.sim;
    const st = sim.state;
    const npc = this.npc(id);
    const a = TALK_ACTIONS[action];
    const r = this.rel(id, true);
    if (r.todayDay !== sim.day) {
      r.todayDay = sim.day;
      r.today = 0;
    }
    if (r.today >= S.maxPerDayPerNpc) return { ok: false, text: pick(sim.rng, LINES.tired) };
    const dim = [1, 0.65, 0.35][r.today] ?? 0.2;
    r.today++;
    const P = PERSONALITY[npc.personality] || PERSONALITY.chill;
    let delta = a.base * (P[action] || 1) * mod(st, 'relGain') * (0.8 + st.mood / 280) * dim;
    let text;
    const shared = this.sharedInterest(npc);
    if (action === 'joke') {
      const chance = 0.5 + skillLevel(st, 'charisma') * 0.045 + ((P.joke || 1) - 1) * 0.3;
      if (sim.rng() < chance) text = pick(sim.rng, LINES.jokeGood);
      else {
        delta = -2;
        text = pick(sim.rng, LINES.jokeBad);
      }
    } else text = pick(sim.rng, LINES[action]);
    if (shared && delta > 0 && action === 'chat') {
      delta *= 1.3;
      text += ` You both care about ${shared}.`;
    }
    this.add(id, delta);
    addNeed(sim, 'social', a.social);
    if (a.fun) addNeed(sim, 'fun', a.fun);
    addSkill(sim, 'charisma', 0.03);
    sim.advance(a.minutes, { noCollapse: true });
    const out = { ok: true, text, delta };
    if (action === 'askWork') Object.assign(out, this.workPerk(npc));
    return out;
  }

  /** Friends open doors: referrals, discounts, market tips. */
  workPerk(npc) {
    const sim = this.sim;
    const st = sim.state;
    const lvl = this.level(npc.id);
    const flags = st.flags;
    if (lvl >= 2 && npc.career && CAREER_BY_ID[npc.career] && !CAREER_BY_ID[npc.career].selfEmployed && !flags.referrals?.[npc.career] && st.job?.career !== npc.career && sim.rng() < 0.5) {
      (flags.referrals ||= {})[npc.career] = npc.id;
      return { perk: `"We are hiring. Apply and I will put in a good word." — referral for ${CAREER_BY_ID[npc.career].name} added (better interview odds).` };
    }
    if (lvl >= 2 && npc.work && ['clothing', 'furniture', 'electronics', 'grocery', 'cafe', 'gym', 'dealer'].includes(npc.work) && !flags.discounts?.[npc.work]) {
      (flags.discounts ||= {})[npc.work] = 0.85;
      return { perk: `"Use my friends-and-family discount." — 15% off at their shop from now on.` };
    }
    if (lvl >= 1 && npc.interests.includes('finance') && sim.rng() < 0.35) {
      sim.market?.friendTip(npc);
      return { perk: sim.state.flags.lastTip ? `"Keep an eye on ${sim.state.flags.lastTip}." — check the News app.` : null };
    }
    return {};
  }

  /** Which hangouts are possible right now with this person. */
  hangoutOptions(id) {
    const sim = this.sim;
    const npc = this.npc(id);
    const r = this.rel(id);
    const hour = hourOf(sim.state.time.total);
    const where = this.where(npc);
    if (!r || relLevel(r.score) < 1) return { reason: 'Get to know them a little first.' };
    if (r.hangDay === sim.day) return { reason: 'You already hung out today.' };
    if (where.kind === 'work') return { reason: `${npc.first} is working right now.` };
    const h24 = hour < 5 ? hour + 24 : hour;
    return { options: Object.keys(HANGOUTS).filter((k) => h24 >= HANGOUTS[k][6][0] && h24 < HANGOUTS[k][6][1]) };
  }

  hangout(id, kind) {
    const sim = this.sim;
    const st = sim.state;
    const [label, , minutes, priceKey, needs, mul] = HANGOUTS[kind];
    const cost = priceKey ? priceOf(sim, priceKey) * 2 : 0;
    if (cost && !sim.finance.spend(cost, 'fun', `${label} with ${this.npc(id).first}`)) return { ok: false };
    const rates = {};
    for (const k in needs) rates[k] = (needs[k] / minutes) * 60;
    sim.advance(minutes, { rates, noCollapse: true });
    if (kind === 'gym') addSkill(sim, 'fitness', 0.3);
    const r = this.rel(id, true);
    r.hangDay = sim.day;
    r.hangouts = (r.hangouts || 0) + 1;
    const delta = S.hangout * mul * mod(st, 'relGain');
    this.add(id, delta);
    sim.bus.emit('hangout', { id, kind });
    return { ok: true, delta, cost, minutes };
  }

  gift(id, giftId) {
    const sim = this.sim;
    const g = GIFTS.find((x) => x.id === giftId);
    const r = this.rel(id, true);
    if (r.giftDay === sim.day) return { ok: false, text: 'One gift a day is plenty.' };
    if (!sim.finance.spend(Math.round(g.price * mod(sim.state, 'priceMul')), 'fun', `Gift: ${g.name}`)) return { ok: false };
    r.giftDay = sim.day;
    const delta = S.gift * g.power * mod(sim.state, 'giftPower') * mod(sim.state, 'relGain');
    this.add(id, delta);
    return { ok: true, delta, text: `${this.npc(id).first} loves the ${g.name.toLowerCase()}.` };
  }

  // ---- romance & roommates (optional) --------------------------------------
  askDate(id) {
    const sim = this.sim;
    const r = this.rel(id, true);
    if (r.dateDay === sim.day) return { ok: false, text: 'Give it some time.' };
    r.dateDay = sim.day;
    const chance = 0.25 + (r.score - 50) * 0.012 + skillLevel(sim.state, 'charisma') * 0.04;
    if (sim.rng() < chance) {
      r.dating = true;
      this.add(id, 8);
      return { ok: true, text: `${this.npc(id).first} smiles. "I would like that."` };
    }
    this.add(id, -3);
    return { ok: false, text: '"I think we are better as friends."' };
  }
  makePartner(id) {
    const st = this.sim.state;
    const r = this.rel(id);
    if (!r?.dating || r.score < 85) return false;
    st.flags.partner = id;
    st.flags.moodBoost = 6;
    this.sim.bus.emit('toast', { icon: '💞', title: `You and ${this.npc(id).first} are partners`, text: 'Life is better shared: a lasting mood boost.', kind: 'good', long: true });
    return true;
  }
  makeRoommate(id) {
    const st = this.sim.state;
    if (st.home.owned || st.home.type === 'couch' || this.level(id) < 3) return false;
    st.home.roommate = id;
    this.sim.bus.emit('toast', { icon: '🏠', title: `${this.npc(id).first} moved in`, text: 'Your roommate now covers 45% of the rent.', kind: 'good', long: true });
    return true;
  }

  // ---- messages ----------------------------------------------------------------
  message(from, text, extra = {}) {
    const st = this.sim.state;
    st.messages.unshift({ id: (st.flags.msgId = (st.flags.msgId || 0) + 1), from, text, day: this.sim.day, read: false, ...extra });
    if (st.messages.length > 30) st.messages.length = 30;
    this.sim.bus.emit('badge', { app: 'contacts' });
    const n = this.npc(from);
    this.sim.bus.emit('toast', { icon: '💬', title: n ? `Message from ${n.first}` : 'New message', text, kind: 'info' });
  }

  /** Go to a party you were invited to. */
  attendParty(msg) {
    const sim = this.sim;
    if (msg.used) return { ok: false };
    msg.used = true;
    sim.advance(180, { rates: { social: 15, fun: 12, energy: -3 }, noCollapse: true });
    this.add(msg.from, 8 * mod(sim.state, 'relGain'));
    const strangers = this.all.filter((n) => n.id !== msg.from && this.level(n.id) < 2);
    const met = [];
    for (let i = 0; i < 2 && strangers.length; i++) {
      const n = strangers.splice(Math.floor(sim.rng() * strangers.length), 1)[0];
      this.add(n.id, 10 * mod(sim.state, 'relGain'));
      met.push(n.first);
    }
    const gain = Math.round(6 + sim.rng() * 20);
    sim.state.social.followers += gain;
    return { ok: true, met, followers: gain };
  }

  // ---- sim hooks -----------------------------------------------------------------
  daily(sim, day) {
    const st = sim.state;
    const decay = S.decayPerDay * mod(st, 'relDecay');
    for (const n of this.all) {
      const r = st.relationships[n.id];
      if (!r) continue;
      if (r.score > S.levels[1] && r.lastDay < day - 2 && st.flags.partner !== n.id) r.score = Math.max(S.levels[1], r.score - decay);
      const lvl = relLevel(r.score);
      if (lvl < 2) continue;
      const roll = sim.rng();
      if (roll < 0.07) this.message(n.id, pick(sim.rng, ['Party tonight — you in? 🎉', 'A few of us are getting together tonight. Come!', 'Rooftop thing tonight. Bring yourself.']), { kind: 'party', day });
      else if (roll < 0.11) this.message(n.id, pick(sim.rng, ['How is the grind going?', 'Saw something that made me think of you 😄', 'We should catch up soon.']));
      else if (roll < 0.14 && n.career && CAREER_BY_ID[n.career] && !CAREER_BY_ID[n.career].selfEmployed && !st.flags.referrals?.[n.career] && st.job?.career !== n.career) {
        (st.flags.referrals ||= {})[n.career] = n.id;
        this.message(n.id, `We have an opening in ${CAREER_BY_ID[n.career].name}. Apply through the Jobs app — I referred you.`);
      } else if (roll < 0.17 && lvl >= 3) {
        const cash = Math.round(20 + sim.rng() * 60);
        sim.finance.earn(cash, 'gift', `${n.first} paid you back`);
        this.message(n.id, `Sent you ${fmtMoney(cash)} for last time. Thanks for always showing up.`);
      }
    }
  }
}
