import { game } from './state.js';

// ─── SCREEN SHAKE ────────────────────────────────────
export function triggerShake(mag) {
  game.shakeMag = Math.max(game.shakeMag, mag);
}

export function updateShake() {
  if (game.shakeMag > 0.3) {
    game.shakeX = (Math.random() - 0.5) * game.shakeMag * 2;
    game.shakeY = (Math.random() - 0.5) * game.shakeMag * 2;
    game.shakeMag *= 0.85;
  } else {
    game.shakeX = game.shakeY = game.shakeMag = 0;
  }
}
