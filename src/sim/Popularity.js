// Popularity + followers: posts, sponsored posts (influencer income) and
// parties. Popularity (0..100) opens VIP places and feeds the rankings.
import { BALANCE } from '../data/balance.js';
import { clamp, lerp, fmtNum } from '../core/utils.js';
import { mod, skillLevel } from './Player.js';
import { relLevel } from './Relationships.js';

const S = BALANCE.social;

// kind: [label, icon, multiplier, caption]
export const POST_KINDS = {
  selfie: ['Selfie', '🤳', 0.6, 'Just me, living.'],
  food: ['Food pic', '🍜', 0.8, 'Eating well today.'],
  landmark: ['Landmark photo', '📸', 1.7, 'Tourist in my own city.'],
  outfit: ['New outfit', '👗', 1.5, 'New fit, who is this?'],
  home: ['Home tour', '🏠', 1.6, 'Welcome to my place.'],
  work: ['Career update', '🚀', 1.6, 'Hard work pays off.'],
};
export const SPONSOR_MIN_FOLLOWERS = 5000;
export const VIP_POPULARITY = 35;

export class Social {
  constructor(sim) {
    this.sim = sim;
  }
  get s() {
    return this.sim.state.social;
  }

  /** Popularity score from followers, friends, style and parties. */
  recompute() {
    const st = this.sim.state;
    let friends = 0;
    let best = 0;
    for (const id in st.relationships) {
      const l = relLevel(st.relationships[id].score);
      if (l >= 2) friends++;
      if (l >= 3) best++;
    }
    const p = 11 * Math.log10(1 + st.social.followers) + friends * 2.2 + best * 2 + (st.profile.outfitStyle ?? 2) * 0.8 + (st.home.styleScore || 0) * 0.1 + Math.min(10, st.social.parties * 0.7);
    st.social.popularity = clamp(p, 0, 100);
    return st.social.popularity;
  }

  postsToday() {
    const day = this.sim.day;
    return this.s.posts.filter((p) => p.day === day);
  }

  /**
   * Which posts are available. ctx: { landmark: name|null, inHome, inFoodPlace }
   * @returns { kind: reason|null }  null = allowed
   */
  postOptions(ctx = {}) {
    const st = this.sim.state;
    const today = this.postsToday();
    const out = {};
    for (const k in POST_KINDS) {
      let why = null;
      if (today.length >= 3) why = 'You have posted enough today.';
      else if (today.some((p) => p.kind === k)) why = 'Already posted today.';
      else if (k === 'landmark') {
        if (!ctx.landmark) why = 'Stand near a landmark (⭐ on the map).';
        else if ((st.flags.landmarkPosts?.[ctx.landmark] ?? -99) > this.sim.day - 7) why = 'You posted this one recently.';
      } else if (k === 'outfit' && !st.flags.newOutfit) why = 'Buy a new outfit first.';
      else if (k === 'home' && !ctx.inHome) why = 'Post this from inside your home.';
      else if (k === 'home' && !st.flags.newHome && (st.home.styleScore || 0) < (st.flags.homePostStyle || 0) + 5) why = 'Improve your home first.';
      else if (k === 'work' && !st.flags.careerNews) why = 'Wait for a promotion or new job.';
      else if (k === 'food' && !ctx.inFoodPlace) why = 'Post this from a café or restaurant.';
      out[k] = why;
    }
    return out;
  }

  post(kind, ctx = {}) {
    const sim = this.sim;
    const st = sim.state;
    const s = st.social;
    const [, , mult, caption] = POST_KINDS[kind];
    const device = 1 + (st.inventory.items.phone_pro ? 0.2 : 0) + (st.inventory.items.camera ? 0.3 : 0);
    let gain = lerp(S.followersPerPost[0], S.followersPerPost[1], sim.rng()) * mult;
    gain *= (1 + Math.sqrt(s.followers) / 18) * (1 + s.popularity / 50) * mod(st, 'followerGain') * device * (0.8 + (st.profile.outfitStyle ?? 2) * 0.05);
    const viral = sim.rng() < S.viralChance + skillLevel(st, 'creativity') * 0.004;
    if (viral) gain = gain * S.viralMul + 2000;
    gain = Math.round(gain);
    s.followers += gain;
    s.posts.unshift({ kind, day: sim.day, gain, likes: Math.round(gain * (3 + sim.rng() * 5) + s.followers * 0.02), text: caption, viral, where: ctx.landmark || null });
    if (s.posts.length > 24) s.posts.length = 24;
    if (kind === 'landmark') (st.flags.landmarkPosts ||= {})[ctx.landmark] = sim.day;
    if (kind === 'outfit') st.flags.newOutfit = false;
    if (kind === 'work') st.flags.careerNews = false;
    if (kind === 'home') {
      st.flags.newHome = false;
      st.flags.homePostStyle = st.home.styleScore || 0;
    }
    sim.advance(5, { noCollapse: true });
    this.recompute();
    if (viral) {
      sim.bus.emit('toast', { icon: '🔥', title: 'Your post went viral!', text: `+${fmtNum(gain)} followers overnight.`, kind: 'good', long: true });
      sim.bus.emit('viral', { gain });
    }
    sim.bus.emit('posted', { kind, gain, viral });
    return { gain, viral };
  }

  /** Sponsored post: paid per 1k followers, 3-day cooldown. */
  sponsorInfo() {
    const s = this.s;
    const wait = Math.max(0, 3 - (this.sim.day - (s.lastSponsorDay ?? -9)));
    return { unlocked: s.followers >= SPONSOR_MIN_FOLLOWERS, wait, pay: Math.round((s.followers / 1000) * S.influencerIncomePer1k * (1 + s.popularity / 100)) };
  }
  sponsored() {
    const info = this.sponsorInfo();
    if (!info.unlocked || info.wait > 0) return 0;
    const s = this.s;
    s.lastSponsorDay = this.sim.day;
    const net = this.sim.finance.earnTaxed(info.pay, 'hustle', 'Sponsored post');
    s.followers = Math.round(s.followers * 0.995); // a few unfollow ads
    this.sim.advance(20, { noCollapse: true });
    return net;
  }

  partyCost(n) {
    return Math.round(n * S.partyCostPerGuest * (this.sim.city.priceIndex || 1) * mod(this.sim.state, 'priceMul'));
  }

  /** Throw a party at home for the given NPC ids. */
  throwParty(ids) {
    const sim = this.sim;
    const st = sim.state;
    const cost = this.partyCost(ids.length);
    if (!sim.finance.spend(cost, 'fun', `House party (${ids.length} guests)`)) return null;
    sim.advance(240, { rates: { social: 14, fun: 10.5, energy: -3, hygiene: -3 }, noCollapse: true });
    const style = st.home.styleScore || 0;
    for (const id of ids) sim.rel.add(id, 8 * mod(st, 'relGain') * (1 + style / 150));
    const gain = Math.round(ids.length * (5 + style * 0.35) * (1 + st.social.popularity / 60));
    st.social.followers += gain;
    st.social.parties++;
    st.social.lastPartyDay = sim.day;
    this.recompute();
    sim.bus.emit('party', { guests: ids.length, gain });
    return { cost, gain };
  }

  daily(sim) {
    const s = this.s;
    // followers drift: slow decay, organic growth once you are somebody
    s.followers = Math.max(0, Math.round(s.followers * (1 - S.followerDecay) + s.popularity * 0.25));
    this.recompute();
  }
}
