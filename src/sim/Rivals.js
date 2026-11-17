// AI rival residents: ~20 per city (all five cities, for the national board).
// Their careers, savings, homes and fame grow a little every day, so the
// leaderboard feels alive even though the game is offline.
import { BALANCE } from '../data/balance.js';
import { CITIES } from '../data/cities/index.js';
import { randomName } from '../characters/Customization.js';
import { mulberry32, hashStr, lerp, clamp } from '../core/utils.js';

const R = BALANCE.rivals;
const TITLES = [
  ['Barista', 'Courier', 'Receptionist', 'Line Cook', 'Retail Associate'],
  ['Junior Developer', 'Nurse', 'Electrician', 'Leasing Agent', 'Designer'],
  ['Analyst', 'Software Developer', 'Sous Chef', 'Sales Agent', 'Producer'],
  ['Senior Analyst', 'Senior Developer', 'Head Chef', 'Broker', 'Site Foreman'],
  ['Portfolio Manager', 'Tech Lead', 'Restaurant Manager', 'Creative Director', 'Project Manager'],
  ['Director', 'Engineering Manager', 'Physician', 'Managing Broker', 'Founder'],
  ['Managing Director', 'VP of Engineering', 'Showrunner', 'General Contractor', 'Serial Founder'],
  ['Chief Executive', 'Chief Technology Officer', 'Chief Financial Officer', 'Media Executive', 'Chief of Medicine'],
];
const SALARY = [30000, 46000, 66000, 92000, 135000, 190000, 280000, 420000];

function makeRival(city, i, seed) {
  const rng = mulberry32(hashStr(`${seed}:${city.id}:${i}`));
  // a spread from strugglers to high-flyers
  const talent = Math.pow(rng(), 1.5);
  const level = Math.min(7, Math.floor(talent * 6.2 + rng() * 1.2));
  const age = 22 + Math.floor(rng() * 16 + level * 1.5);
  const salary = SALARY[level] * city.salaryIndex * (0.85 + rng() * 0.35);
  const savingsRate = lerp(R.savingsRate[0], R.savingsRate[1], rng());
  const years = (age - 21) * (0.3 + rng() * 0.5);
  const netWorth = Math.round(salary * savingsRate * years * (0.6 + rng()) - (rng() < 0.4 ? 8000 + rng() * 30000 : 0));
  const owns = netWorth > 60000 && rng() < 0.6;
  return {
    id: `rv_${city.id}_${i}`,
    name: randomName(rng),
    cityId: city.id,
    age,
    level,
    title: TITLES[level][Math.floor(rng() * TITLES[level].length)],
    salary: Math.round(salary),
    savingsRate,
    raise: lerp(R.raisePerYear[0], R.raisePerYear[1], rng() * (0.5 + talent)),
    invest: lerp(R.investReturn[0], R.investReturn[1], rng()),
    netWorth,
    totalEarned: Math.round(salary * years * 0.8),
    popularity: clamp(Math.round(rng() * rng() * 70 + level * 2), 0, 95),
    homeValue: owns ? Math.round((180000 + rng() * 500000 + level * 90000) * (city.homePriceIndex || 1)) : 0,
    friends: 1 + Math.floor(rng() * 9),
  };
}

export class Rivals {
  constructor(sim) {
    this.sim = sim;
  }

  init() {
    const st = this.sim.state;
    if (st.rivals) return;
    st.rivals = [];
    for (const c of CITIES) for (let i = 0; i < R.perCity; i++) st.rivals.push(makeRival(c, i, st.seed));
  }
  get list() {
    return this.sim.state.rivals;
  }

  daily(sim, day) {
    const st = sim.state;
    const regime = { recession: -1.2, bear: -0.3, normal: 1, bull: 1.5, boom: 2.2 }[st.market?.regime || 'normal'];
    // deterministic per-day noise so a reloaded save evolves the same way
    const rng = mulberry32(st.seed + day * 7919);
    for (const r of st.rivals) {
      const daily = r.salary / 112;
      r.totalEarned += daily * 0.8;
      r.netWorth += daily * 0.8 * r.savingsRate + Math.max(0, r.netWorth) * ((r.invest * regime) / 112) + (rng() - 0.5) * 140;
      r.salary *= 1 + r.raise / 112;
      if (r.homeValue) r.homeValue *= 1 + (BALANCE.realEstate.appreciationPerYear * Math.max(-0.5, regime)) / 112;
      const roll = rng();
      // promotions, home purchases, lucky and unlucky breaks
      if (roll < 0.004 && r.level < 7) {
        r.level++;
        r.salary *= 1.22;
        r.title = TITLES[r.level][Math.floor(rng() * TITLES[r.level].length)];
      } else if (roll < 0.006 && !r.homeValue && r.netWorth > 70000) {
        const c = CITIES.find((x) => x.id === r.cityId);
        r.homeValue = Math.round((220000 + rng() * 380000) * (c.homePriceIndex || 1));
      } else if (roll < 0.008) r.netWorth -= Math.max(2000, r.netWorth * 0.06 * rng());
      else if (roll < 0.0095) r.netWorth += 5000 + r.salary * 0.15 * rng();
      if (rng() < 0.05) r.popularity = clamp(r.popularity + (rng() - 0.42) * 2.4, 0, 99);
      if (rng() < 0.01) r.friends = clamp(r.friends + (rng() < 0.6 ? 1 : -1), 0, 25);
      if (day % 112 === 0) r.age++;
    }
  }
}
