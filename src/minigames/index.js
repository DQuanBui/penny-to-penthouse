// Registry of career mini-games (one file per game). Careers refer to these by id.
import { playMiniGame } from './MiniGame.js';
import { BugSquash } from './BugSquash.js';
import { OrderRush } from './OrderRush.js';
import { Wiring } from './Wiring.js';
import { Trading } from './Trading.js';
import { Triage } from './Triage.js';
import { BeatCut } from './BeatCut.js';
import { MatchHome } from './MatchHome.js';

export const MINIGAMES = { bugsquash: BugSquash, orderrush: OrderRush, wiring: Wiring, trading: Trading, triage: Triage, beatcut: BeatCut, matchhome: MatchHome };

/** Play the mini-game with this id. Resolves with 0..1, or null when skipped/unknown. */
export function runMiniGame(game, id, level = 0) {
  const def = MINIGAMES[id];
  if (!def) return Promise.resolve(null);
  return playMiniGame(game, def, level);
}
