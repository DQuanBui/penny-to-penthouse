// Wires the optional simulation systems onto a Sim. Both the game and the
// headless balance script call this, so they always run identical rules.
import { Jobs } from './Jobs.js';
import { Relationships } from './Relationships.js';
import { Social } from './Popularity.js';

export function installSystems(sim) {
  sim.jobs = sim.use(new Jobs(sim));
  sim.rel = sim.use(new Relationships(sim));
  sim.social = sim.use(new Social(sim));
  return sim;
}
