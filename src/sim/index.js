// Wires the optional simulation systems onto a Sim. Both the game and the
// headless balance script call this, so they always run identical rules.

export function installSystems(sim) {
  // Systems are added here as each phase lands (jobs, market, relationships...).
  return sim;
}
