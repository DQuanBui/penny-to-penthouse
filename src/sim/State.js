// The whole game is one plain, serializable object. Saving = JSON.stringify.
// Every system (present and future) has its slice here so save files stay
// forward-compatible; migrate() fills in anything an older save is missing.
import { BALANCE } from '../data/balance.js';
import { ARCHETYPE_BY_ID, SKILLS } from '../data/archetypes.js';
import { rentFor } from '../data/homes.js';
import { uid, hashStr } from '../core/utils.js';

export const SAVE_VERSION = 1;

export function newState(profile, city) {
  const arch = ARCHETYPE_BY_ID[profile.archetype] || ARCHETYPE_BY_ID.dreamer;
  const skills = {};
  for (const s of SKILLS) skills[s.id] = arch.skills?.[s.id] || 0;
  // start in the cheapest district
  const district = [...city.districts].sort((a, b) => a.rentMul - b.rentMul)[0];
  const state = {
    v: SAVE_VERSION,
    id: uid(),
    seed: hashStr(profile.name + Date.now()),
    playtime: 0,
    profile: { name: profile.name, archetype: arch.id, traits: [...profile.traits], appearance: { ...profile.appearance }, age: arch.age || BALANCE.time.startAge, goals: profile.goals || [] },
    cityId: city.id,
    time: { total: BALANCE.time.startHour * 60 },
    pos: { x: null, z: null, heading: 0, place: null },
    needs: { ...BALANCE.needs.start },
    mood: 70,
    skills,
    money: { checking: arch.cash, savings: 0, txs: [], budget: {}, history: [], nextTx: 1 },
    credit: { score: BALANCE.credit.startScore, card: null, onTime: 0, missed: 0, months: 0, inquiries: 0 },
    loans: [],
    bills: { missedRent: 0, extras: arch.monthlyExtra ? [{ ...arch.monthlyExtra }] : [], subscriptions: [] },
    job: null,
    jobLog: { applied: {}, history: [], lastQuitDay: -99 },
    education: { degrees: [...(arch.degrees || [])], certs: [], enrolled: null, done: {} },
    home: { type: 'room', districtId: district.id, rent: rentFor('room', city, district), owned: false, propertyId: null, layout: null, furniture: null, styleScore: 0 },
    properties: [],
    inventory: { items: {}, outfits: [], meals: 2, gifts: 0, books: {} },
    vehicles: [],
    activeVehicle: null,
    pet: null, // your dog (sim/Pets.js)
    trip: null, // { cityId, since } while visiting another city (sim/Trips.js)
    relationships: {},
    social: { followers: arch.followers || 0, popularity: 0, posts: [], lastPostDay: -9, parties: 0 },
    portfolio: { holdings: {}, realized: 0, dividends: 0 },
    market: null, // created lazily by Market.js
    listings: null, // created lazily by RealEstate.js
    businesses: [],
    hustles: { lastDay: {}, total: 0 },
    goals: [],
    achievements: {},
    stats: { totalEarned: 0, totalSpent: 0, taxesPaid: 0, shifts: 0, promotions: 0, daysPlayed: 0, friendsMade: 0, fainted: 0, eventsSeen: 0, maxNetWorth: arch.cash, incomeByMonth: {}, spendByMonth: {} },
    events: { nextDay: 2, log: [], pending: null, cooldown: {} },
    news: [],
    messages: [],
    rivals: null, // created lazily by Rivals.js
    flags: { hints: {}, tutorial: { active: true, step: 0, done: false }, startedDebt: false, gymPassUntil: -1 },
  };
  for (const it of arch.items || []) state.inventory.items[it] = 1;
  // starting debt
  if (arch.debt) state.flags.pendingDebt = { ...arch.debt };
  return state;
}

/** Bring an older save up to date (shallow-merge any missing slices). */
export function migrate(state, city) {
  const fresh = newState({ name: state.profile?.name || 'Player', archetype: state.profile?.archetype || 'dreamer', traits: state.profile?.traits || [], appearance: state.profile?.appearance || {} }, city);
  for (const k in fresh) {
    if (state[k] === undefined) state[k] = fresh[k];
    else if (fresh[k] && typeof fresh[k] === 'object' && !Array.isArray(fresh[k]) && state[k] && typeof state[k] === 'object') {
      for (const k2 in fresh[k]) if (state[k][k2] === undefined) state[k][k2] = fresh[k][k2];
    }
  }
  state.v = SAVE_VERSION;
  return state;
}
