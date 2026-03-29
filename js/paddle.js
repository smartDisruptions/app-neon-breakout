import { PADDLE_W, PADDLE_Y, PADDLE_H, W } from './config.js';
import { game } from './state.js';
import { emitParticles } from './particles.js';
import { triggerShake } from './shake.js';
import AudioEngine from './audio.js';

// ─── PADDLE ABILITIES ────────────────────────────────
// Pulse (levels 1-5), Magnet (6-10), Phase Shift (11+)

export function getAbilityForLevel(level) {
  if (level <= 5) return 'pulse';
  if (level <= 10) return 'magnet';
  return 'phaseshift';
}

export function initAbility() {
  game.paddle.ability = getAbilityForLevel(game.level);
  game.paddle.cooldown = 0;
  game.paddle.cooldownMax = 10000;
  game.paddle.magnetActive = false;
}

export function activateAbility() {
  const paddle = game.paddle;
  if (paddle.cooldown > Date.now()) return; // still on cooldown

  switch (paddle.ability) {
    case 'pulse':
      activatePulse();
      break;
    case 'magnet':
      activateMagnet();
      break;
    case 'phaseshift':
      activatePhaseShift();
      break;
  }

  paddle.cooldown = Date.now() + paddle.cooldownMax;
}

function activatePulse() {
  // Shockwave in a 60° cone upward from paddle center, 200px range
  const coneAngle = Math.PI / 3; // 60 degrees
  const range = 200;
  const centerX = game.paddle.x;
  const centerY = PADDLE_Y;

  for (const brick of game.bricks) {
    if (!brick.alive) continue;
    const brickCX = brick.x + brick.w / 2;
    const brickCY = brick.y + brick.h / 2;
    const dx = brickCX - centerX;
    const dy = brickCY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > range) continue;

    // Check if brick is within cone (upward direction = -PI/2)
    const angle = Math.atan2(dy, dx);
    const upAngle = -Math.PI / 2;
    let diff = Math.abs(angle - upAngle);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;

    if (diff <= coneAngle / 2) {
      brick.hp--;
      if (brick.hp <= 0) {
        brick.alive = false;
        game.combo++;
        game.comboTimer = 60;
        game.score += 10 * game.combo;
      }
      emitParticles(brickCX, brickCY, brick.color, 8, 1.5, 3);
    }
  }

  // Visual: expanding cyan arc
  for (let i = 0; i < 20; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * coneAngle;
    const dist = 30 + Math.random() * 170;
    emitParticles(
      centerX + Math.cos(angle) * dist,
      centerY + Math.sin(angle) * dist,
      '#0ff', 2, 1, 2
    );
  }
  triggerShake(6);
  AudioEngine.playPowerUp();
}

function activateMagnet() {
  game.paddle.magnetActive = true;
}

function activatePhaseShift() {
  if (game.balls.length === 0) return;

  const oldX = game.paddle.x;
  const targetX = game.balls[0].x;
  game.paddle.x = Math.max(game.paddle.w / 2, Math.min(W - game.paddle.w / 2, targetX));

  // Trail particles from old to new position
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const px = oldX + (game.paddle.x - oldX) * t;
    emitParticles(px, PADDLE_Y + PADDLE_H / 2, '#ff0', 3, 0.5, 2);
  }
  triggerShake(4);
  AudioEngine.playPowerUp();
}

export function handleMagnetCatch(ball) {
  if (!game.paddle.magnetActive) return false;

  ball.stuck = true;
  ball.stickOffset = ball.x - game.paddle.x;
  game.paddle.magnetActive = false;
  return true;
}

export function releaseMagnetBall() {
  for (const ball of game.balls) {
    if (ball.stuck) {
      ball.stuck = false;
      // Launch in direction based on stick position
      const hit = ball.stickOffset / (game.paddle.w / 2);
      const angle = -Math.PI / 2 + hit * (Math.PI / 3);
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) || (7 + game.level * 0.4);
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
    }
  }
}

export function updateStuckBalls() {
  for (const ball of game.balls) {
    if (ball.stuck) {
      ball.x = game.paddle.x + ball.stickOffset;
      ball.y = PADDLE_Y - ball.r;
    }
  }
}
