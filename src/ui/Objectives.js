// The single "what should I do now?" line on the HUD. Derived from state, so
// it is always right after loading a save. Later systems (tutorial, goals)
// can take over through game.objectiveOverride().
import { fmtHour } from '../core/Clock.js';
import { employerName } from './Interact.js';
import { BALANCE } from '../data/balance.js';

export function computeObjective(game) {
  const st = game.state;
  const n = st.needs;
  const override = game.objectiveOverride?.();
  if (override) return override;
  if (n.energy < 14) return ['You are exhausted', 'Go home and sleep in your bed before you collapse.'];
  if (n.hunger < 14) return ['You are starving', st.inventory.meals > 0 ? 'Eat at home (fridge) or grab something at a café.' : 'Buy food: café ☕, restaurant 🍽️ or groceries 🛒.'];
  if (n.health < 25) return ['Your health is low', 'Rest, eat well, or see a doctor at the hospital 🏥.'];
  const j = st.job;
  if (!j) return ['Find a job', 'Open your phone (Tab) → Jobs. Entry-level roles need no experience.'];
  const info = game.sim.jobs.shiftInfo();
  const where = employerName(game, j.career);
  if (info.status === 'ready' || info.status === 'late') return [info.status === 'late' ? 'You are late for work!' : 'Your shift is starting', `Go to ${where} and use a work station (E).`];
  if (info.status === 'early') return [`Work at ${fmtHour(info.start)}`, `${where}. Set a GPS waypoint from the Jobs app.`];
  if (n.hygiene < BALANCE.needs.low) return ['Freshen up', 'Take a shower at home.'];
  if (n.fun < BALANCE.needs.low) return ['Have some fun', 'Watch TV, play games or go out — your mood is suffering.'];
  if (n.social < BALANCE.needs.low) return ['Talk to someone', 'Chat with people around town to lift your Social need.'];
  const goal = game.goalObjective?.();
  if (goal) return goal;
  return ['Build your life', 'Work, learn, save and climb. Check Goals and Rankings on your phone.'];
}
