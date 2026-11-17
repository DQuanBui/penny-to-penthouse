// Leaderboards. The UI only talks to a LeaderboardProvider, so an online
// backend can replace the local (AI rivals) one without touching the game:
//
//   class SupabaseProvider {
//     async getBoard(category, scope, me) { /* select ... order by value desc */ }
//     async submit(me) { /* upsert the player's row */ }
//   }
//   sim.rankings.provider = new SupabaseProvider(client);
import { CITY_BY_ID } from '../data/cities/index.js';
import { relLevel } from './Relationships.js';

export const RANK_CATEGORIES = [
  { id: 'netWorth', name: 'Net Worth', icon: '💰', money: true },
  { id: 'totalEarned', name: 'Total Earned', icon: '💵', money: true },
  { id: 'savingsRate', name: 'Savings Rate', icon: '🐖', pct: true },
  { id: 'popularity', name: 'Popularity', icon: '⭐' },
  { id: 'level', name: 'Career Level', icon: '🪜' },
  { id: 'homeValue', name: 'Home Value', icon: '🏠', money: true },
  { id: 'friends', name: 'Friends', icon: '🤝' },
];

/** Local provider: the player against the simulated rival residents. */
export class LocalProvider {
  constructor(sim) {
    this.sim = sim;
  }
  /** @returns Promise<[{ name, cityId, title, value, me }]> sorted best first */
  async getBoard(category, scope, me) {
    return this.boardSync(category, scope, me);
  }
  boardSync(category, scope, me) {
    const rows = this.sim.state.rivals
      .filter((r) => scope === 'national' || r.cityId === me.cityId)
      .map((r) => ({ name: r.name, cityId: r.cityId, title: r.title, value: category === 'level' ? r.level + 1 : r[category], me: false }));
    rows.push({ name: me.name, cityId: me.cityId, title: me.title, value: me[category], me: true });
    return rows.sort((a, b) => b.value - a.value);
  }
  async submit() {
    /* nothing to upload offline */
  }
}

export class Rankings {
  constructor(sim) {
    this.sim = sim;
    this.provider = new LocalProvider(sim);
  }

  /** The player's row for every category. */
  me() {
    const sim = this.sim;
    const st = sim.state;
    // savings rate over the last three months of budget
    let inc = 0;
    let exp = 0;
    const months = Object.keys(st.money.budget).map(Number).sort((a, b) => b - a).slice(0, 3);
    for (const m of months) {
      for (const k in st.money.budget[m].inc) inc += st.money.budget[m].inc[k];
      for (const k in st.money.budget[m].exp) exp += st.money.budget[m].exp[k];
    }
    let friends = 0;
    for (const id in st.relationships) if (relLevel(st.relationships[id].score) >= 2) friends++;
    const bizLevel = st.businesses.reduce((m, b) => (b.active ? Math.max(m, b.level + 2) : m), 0);
    return {
      name: st.profile.name,
      cityId: st.cityId,
      title: sim.jobs?.title() || (bizLevel ? 'Business owner' : 'Between jobs'),
      netWorth: Math.round(sim.finance.netWorth()),
      totalEarned: Math.round(st.stats.totalEarned),
      savingsRate: inc > 0 ? Math.max(-1, (inc - exp) / inc) : 0,
      popularity: Math.round(st.social.popularity),
      level: Math.max(st.job ? st.job.level + 1 : 0, bizLevel),
      homeValue: Math.round(sim.re ? sim.re.homeValue() : 0),
      friends,
    };
  }

  /** Synchronous board (the local provider never needs the network). */
  board(category, scope = 'city') {
    return this.provider.boardSync ? this.provider.boardSync(category, scope, this.me()) : [];
  }
  rank(category, scope = 'city') {
    const b = this.board(category, scope);
    return { rank: b.findIndex((r) => r.me) + 1, of: b.length };
  }
  cityName(id) {
    return CITY_BY_ID[id]?.name || id;
  }
}

// ---- Hall of Fame: best result of every life ever played on this device -------
const HOF_KEY = 'p2p.hof.v1';
export function hallOfFame() {
  try {
    return JSON.parse(localStorage.getItem(HOF_KEY) || '[]');
  } catch {
    return [];
  }
}
/** Record (or update) this life's best net worth. Called when the game saves. */
export function recordHallOfFame(state, me) {
  try {
    const list = hallOfFame();
    const row = { id: state.id, name: state.profile.name, archetype: state.profile.archetype, cityId: state.cityId, netWorth: Math.round(Math.max(me.netWorth, state.stats.maxNetWorth || 0)), title: me.title, age: state.profile.age, day: Math.floor(state.time.total / 1440) + 1, popularity: me.popularity };
    const i = list.findIndex((x) => x.id === state.id);
    if (i >= 0) list[i] = row;
    else list.push(row);
    list.sort((a, b) => b.netWorth - a.netWorth);
    localStorage.setItem(HOF_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* storage unavailable */
  }
}
