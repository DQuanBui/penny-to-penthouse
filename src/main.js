// Entry point.
import './ui/styles.css';
import './ui/creator.css';
import { Game } from './core/Game.js';

const game = new Game();
game.start();
// Handy for debugging and the automated smoke test.
window.__game = game;
