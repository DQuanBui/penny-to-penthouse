// Wires the optional simulation systems onto a Sim. Both the game and the
// headless balance script call this, so they always run identical rules.
import { Jobs } from './Jobs.js';
import { Relationships } from './Relationships.js';
import { Social } from './Popularity.js';
import { Loans } from './Loans.js';
import { Education } from './Education.js';
import { Hustles } from './Hustles.js';
import { Businesses } from './Business.js';

export function installSystems(sim) {
  sim.jobs = sim.use(new Jobs(sim));
  sim.rel = sim.use(new Relationships(sim));
  sim.social = sim.use(new Social(sim));
  sim.loans = sim.use(new Loans(sim));
  sim.edu = new Education(sim);
  sim.hustles = new Hustles(sim);
  sim.biz = sim.use(new Businesses(sim));
  sim.loans.applyStartingDebt();
  return sim;
}
