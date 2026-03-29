import { game } from './state.js';
import { emitParticles, emitShards } from './particles.js';
import { triggerShake } from './shake.js';
import { maybeDropPowerup } from './powerups.js';

// ─── COLLISION ───────────────────────────────────────
export function ballBrickCollision(ball, brick) {
  if (!brick.alive) return false;
  if (ball.stuck) return false;

  const bx = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
  const by = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
  const dx = ball.x - bx, dy = ball.y - by;
  if (dx * dx + dy * dy > ball.r * ball.r) return false;

  const overlapX = ball.r - Math.abs(dx);
  const overlapY = ball.r - Math.abs(dy);
  if (overlapX < overlapY) ball.vx = -ball.vx;
  else ball.vy = -ball.vy;

  // Prism color-match: instant kill + guaranteed power-up drop
  const colorMatch = ball.color && ball.color === brick.color;
  if (colorMatch) {
    brick.hp = 0;
  } else {
    brick.hp--;
  }

  if (brick.hp <= 0) {
    brick.alive = false;
    game.combo++;
    game.comboTimer = 60;
    game.score += 10 * game.combo;
    emitShards(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.w, brick.h, brick.color);
    emitParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, 6, 1.5, 3);
    triggerShake(3 + Math.min(game.combo, 8));
    maybeDropPowerup(brick.x + brick.w / 2, brick.y + brick.h / 2, colorMatch);
  } else {
    emitParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, 6, 1, 2);
    triggerShake(1.5);
  }
  return true;
}
