import { W, PADDLE_Y, BALL_R } from './config.js';
import { game } from './state.js';

// ─── BALL ────────────────────────────────────────────
export function spawnBall(x, y, angle) {
  const speed = 7 + game.level * 0.4;
  const a = angle != null ? angle : -Math.PI / 2 + (Math.random() - 0.5) * 0.4;
  game.balls.push({
    x: x || W / 2,
    y: y || PADDLE_Y - BALL_R - 2,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    r: BALL_R,
    trail: [],
  });
}
