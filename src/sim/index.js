// Wires the optional simulation systems onto a Sim. Both the game and the
// headless balance script call this, so they always run identical rules.
import { Jobs } from './Jobs.js';
import { Relationships } from './Relationships.js';
import { Social } from './Popularity.js';
import { Loans } from './Loans.js';
import { Education } from './Education.js';
import { Hustles } from './Hustles.js';
import { Businesses } from './Business.js';
import { Market } from './Market.js';
import { RealEstate } from './RealEstate.js';
import { Rivals } from './Rivals.js';
import { Rankings } from './Rankings.js';
import { Goals, Achievements } from './Goals.js';
import { LifeEvents } from './LifeEvents.js';
import { Garage } from './Garage.js';

export function installSystems(sim) {
  sim.jobs = sim.use(new Jobs(sim));
  sim.rel = sim.use(new Relationships(sim));
  sim.social = sim.use(new Social(sim));
  sim.loans = sim.use(new Loans(sim));
  sim.edu = new Education(sim);
  sim.hustles = new Hustles(sim);
  sim.biz = sim.use(new Businesses(sim));
  sim.market = sim.use(new Market(sim));
  sim.market.init();
  sim.re = sim.use(new RealEstate(sim));
  sim.re.refreshListings();
  sim.loans.applyStartingDebt();
  sim.garage = sim.use(new Garage(sim));
  sim.rivals = sim.use(new Rivals(sim));
  sim.rivals.init();
  sim.rankings = new Rankings(sim);
  sim.events = sim.use(new LifeEvents(sim));
  sim.goals = sim.use(new Goals(sim));
  sim.achievements = sim.use(new Achievements(sim));
  // qualifications the character started with do not count as "graduating"
  sim.state.flags.startQuals ??= sim.state.education.degrees.length + sim.state.education.certs.length;
  return sim;
}
