// Wires the optional simulation systems onto a Sim. Both the game and the
// headless balance script call this, so they always run identical rules.
import { Jobs } from './Jobs.js';

export function installSystems(sim) {
  sim.jobs = sim.use(new Jobs(sim));
  return sim;
}
