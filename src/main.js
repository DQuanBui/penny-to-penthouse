// Entry point.
import './ui/styles.css';
import './ui/creator.css';
import './ui/game.css';
import './ui/extra.css';
import { Game } from './core/Game.js';
import { runMiniGame } from './minigames/index.js';

const game = new Game();
game.start();
// Handy for debugging and the automated smoke test.
window.__game = game;
window.__mg = (id, level = 0) => runMiniGame(game, id, level);
