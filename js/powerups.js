import { PADDLE_W, POWERUP_SPEED, BALL_R, hslRow, BRICK_ROWS } from './config.js';
import { game } from './state.js';
import { emitParticles } from './particles.js';
import { triggerShake } from './shake.js';
import { spawnBall } from './ball.js';

// ─── POWERUPS ────────────────────────────────────────
export const POWER_TYPES = [
  { type: 'wide',  color: '#00e5ff', symbol: 'W', duration: 8000 },
  { type: 'multi', color: '#39ff14', symbol: 'M', duration: 0 },
  { type: 'slow',  color: '#ffe600', symbol: 'S', duration: 5000 },
];

export function maybeDropPowerup(x, y, guaranteed) {
  // Prism: 8% chance, rolled first
  if (!guaranteed && Math.random() < 0.08) {
    game.powerups.push({
      x, y, type: 'prism', color: '#fff', symbol: '◇', duration: 8000,
      vy: POWERUP_SPEED, trail: [], glow: 0, _hue: 0,
    });
    return;
  }

  // Regular power-ups: 18% chance (or guaranteed)
  if (!guaranteed && Math.random() > 0.18) return;
  const p = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
  game.powerups.push({ x, y, ...p, vy: POWERUP_SPEED, trail: [], glow: 0 });
}

export function activatePower(p) {
  switch (p.type) {
    case 'wide':
      game.paddle.w = PADDLE_W * 1.6;
      game.activePowers.wide = Date.now() + p.duration;
      break;
    case 'multi': {
      const existing = game.balls.slice();
      existing.forEach(b => {
        if (b.stuck) return;
        const a = Math.atan2(b.vy, b.vx);
        spawnBall(b.x, b.y, a + 0.4);
        spawnBall(b.x, b.y, a - 0.4);
      });
      break;
    }
    case 'slow':
      game.balls.forEach(b => { if (!b.stuck) { b.vx *= 0.6; b.vy *= 0.6; } });
      game.activePowers.slow = Date.now() + p.duration;
      break;
    case 'prism':
      activatePrism();
      break;
  }
  emitParticles(p.x, p.y, p.color, 30, 1.5, 3);
  triggerShake(4);
}

function activatePrism() {
  // Spawn 7 mini-balls, one per brick row color
  const mainBall = game.balls.find(b => !b.stuck) || game.balls[0];
  if (!mainBall) return;

  const expiry = Date.now() + 8000;

  for (let i = 0; i < BRICK_ROWS; i++) {
    const angle = -Math.PI / 2 + ((i - 3) / 3) * (Math.PI / 4);
    const speed = 7 + game.level * 0.4;
    const color = hslRow(i);
    game.balls.push({
      x: mainBall.x,
      y: mainBall.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 4, // smaller than normal
      trail: [],
      color, // for color-matching
      expiry, // when this mini-ball fades
      isPrism: true,
    });
  }
}
