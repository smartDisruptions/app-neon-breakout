import { W, H, PADDLE_W, PADDLE_Y, PADDLE_H, BALL_R, POWERUP_SIZE, BRICK_ROWS, BRICK_COLS } from './config.js';
import { game } from './state.js';
import { buildBricks } from './bricks.js';
import { spawnBall } from './ball.js';
import { updateParticles } from './particles.js';
import { emitParticles } from './particles.js';
import { activatePower } from './powerups.js';
import { ballBrickCollision } from './physics.js';
import { triggerShake, updateShake } from './shake.js';
import { draw, showOverlay, hideOverlay, scoreEl, comboEl, livesEl } from './renderer.js';
import { isTouchDevice, setStartGameCallback } from './input.js';
import AudioEngine from './audio.js';
import { updateBackground, initCreatures, updateCreatures } from './background.js';
import { initAbility, updateStuckBalls, handleMagnetCatch, releaseMagnetBall, getAbilityForLevel } from './paddle.js';
import { emitShards } from './particles.js';
import { createBoss, updateBoss, ballBossCollision } from './boss.js';
import { initAchievements, checkAchievements, resetSessionStats } from './achievements.js';
import { checkScreenshotTriggers, updateFlash } from './screenshot.js';

// ─── UPDATE ──────────────────────────────────────────
function update() {
  if (game.state !== 'playing') return;

  // Track paddle velocity for curve shot
  const prevPaddleX = game.paddle.x;

  // Paddle
  game.paddle.x += (game.mouseX - game.paddle.x) * 0.35;
  game.paddle.x = Math.max(game.paddle.w / 2, Math.min(W - game.paddle.w / 2, game.paddle.x));
  game.paddle.vx = game.paddle.x - prevPaddleX;

  // Power expiry
  if (game.activePowers.wide && Date.now() > game.activePowers.wide) {
    game.paddle.w = PADDLE_W; delete game.activePowers.wide;
  }
  if (game.activePowers.slow && Date.now() > game.activePowers.slow) delete game.activePowers.slow;

  // Combo decay
  if (game.comboTimer > 0) game.comboTimer--;
  else game.combo = 0;

  // Update stuck balls (magnet)
  updateStuckBalls();

  // Update paddle ability for current level
  game.paddle.ability = getAbilityForLevel(game.level);

  // Balls
  for (let i = game.balls.length - 1; i >= 0; i--) {
    const b = game.balls[i];

    // Prism mini-ball expiry
    if (b.expiry) {
      const remaining = b.expiry - Date.now();
      if (remaining <= 0) {
        game.balls.splice(i, 1);
        continue;
      }
      // Fade in final 1 second
      if (remaining < 1000) {
        b.fadeAlpha = remaining / 1000;
      }
    }

    if (b.stuck) continue; // magnet-stuck balls don't move

    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 12) b.trail.shift();

    b.x += b.vx;
    b.y += b.vy;

    // Walls
    if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
    if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }

    // Paddle
    if (b.vy > 0 && b.y + b.r >= PADDLE_Y && b.y + b.r <= PADDLE_Y + PADDLE_H + 4) {
      const px1 = game.paddle.x - game.paddle.w / 2, px2 = game.paddle.x + game.paddle.w / 2;
      if (b.x >= px1 - b.r && b.x <= px2 + b.r) {
        const hit = (b.x - game.paddle.x) / (game.paddle.w / 2);
        const angle = -Math.PI / 2 + hit * (Math.PI / 3);
        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        b.y = PADDLE_Y - b.r;

        // Check magnet catch
        if (handleMagnetCatch(b)) {
          continue; // ball is now stuck
        }

        emitParticles(b.x, PADDLE_Y, '#fff', 5, 1, 1.5);
        triggerShake(1);
        AudioEngine.playPaddleHit();
      }
    }

    // Bottom — ball lost
    if (b.y - b.r > H) {
      game.balls.splice(i, 1);
      emitParticles(b.x, H, '#f44', 20, 2, 3);
      triggerShake(6);
      AudioEngine.playBallLoss();
      checkAchievements('ball_lost');
    }

    // Bricks or Boss collision
    if (game.mode === 'boss') {
      ballBossCollision(b, game.boss);
    } else {
      for (let bi = 0; bi < game.bricks.length; bi++) {
        const brick = game.bricks[bi];
        if (ballBrickCollision(b, brick)) {
          const row = Math.floor(bi / BRICK_COLS);
          AudioEngine.playBrickHit(row);
          if (!brick.alive) {
            checkAchievements('brick_destroy');
            checkAchievements('combo');
            checkAchievements('score');
          }
        }
      }
    }
  }

  // Lost all balls
  if (game.balls.length === 0) {
    game.lives--;
    livesEl.textContent = game.lives;
    if (game.lives <= 0) {
      game.state = 'dead';
      showOverlay('GAME OVER', 'Final Score: ' + game.score, isTouchDevice ? 'TAP TO RESTART' : 'CLICK TO RESTART', true);
    } else {
      spawnBall();
    }
  }

  // Boss update
  if (game.mode === 'boss') {
    updateBoss();
    // Check boss defeated
    if (game.boss && game.boss.defeated) {
      checkAchievements('boss_defeated');
      game._bossJustDefeated = true;

      // Win condition: beat the level 12 boss
      if (game.level >= 12) {
        game.state = 'won';
        game.mode = 'normal';
        game.boss = null;
        showOverlay('YOU WIN!', 'Final Score: ' + game.score, isTouchDevice ? 'TAP TO RESTART' : 'CLICK TO RESTART', true);
        return;
      }

      game.mode = 'normal';
      game.boss = null;
      game.level++;
      buildBricks();
      game.balls = [];
      spawnBall();
      livesEl.textContent = game.lives;
    }
  }

  // Win check (normal mode only)
  if (game.mode !== 'boss' && game.bricks.every(b => !b.alive)) {
    game.level++;
    // Check if next level is a boss level
    if (game.level % 3 === 0) {
      // Boss fight!
      game.bricks = [];
      game.balls = [];
      spawnBall();
      game.paddle._savedW = game.paddle.w;
      createBoss(game.level);
      emitParticles(W / 2, H / 2, '#f0f', 40, 4, 6);
      triggerShake(10);
    } else {
      buildBricks();
      game.balls = [];
      spawnBall();
      emitParticles(W / 2, H / 2, '#0ff', 40, 4, 6);
      triggerShake(12);
      AudioEngine.playLevelClear();
    }
    checkAchievements('level_clear');
  }

  // Powerups
  for (let i = game.powerups.length - 1; i >= 0; i--) {
    const p = game.powerups[i];
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 20) p.trail.shift();
    p.y += p.vy;
    p.glow = (Math.sin(Date.now() * 0.008) + 1) / 2;

    if (p.y + POWERUP_SIZE / 2 >= PADDLE_Y && p.y - POWERUP_SIZE / 2 <= PADDLE_Y + PADDLE_H) {
      if (p.x >= game.paddle.x - game.paddle.w / 2 && p.x <= game.paddle.x + game.paddle.w / 2) {
        activatePower(p);
        AudioEngine.playPowerUp();
        game.powerups.splice(i, 1);
        continue;
      }
    }
    if (p.y > H + 20) game.powerups.splice(i, 1);
  }

  // Particles
  updateParticles();

  // Background + creatures
  updateBackground(game.combo);
  updateCreatures();

  // Screenshots + flash
  checkScreenshotTriggers();
  updateFlash();
  checkAchievements('power_count');

  updateShake();
  scoreEl.textContent = game.score;
  comboEl.textContent = game.combo > 1 ? 'x' + game.combo : 'x1';
  comboEl.style.textShadow = game.combo > 3 ? '0 0 ' + (game.combo * 4) + 'px #f0f' : '0 0 15px #f0f';
}

// ─── GAME LOOP ───────────────────────────────────────
function loop(time) {
  game.lastTime = time;
  update();
  draw();
  requestAnimationFrame(loop);
}

// ─── INIT ────────────────────────────────────────────
function startGame() {
  game.score = 0; game.lives = 3; game.combo = 0; game.level = 1;
  game.paddle.w = PADDLE_W;
  game.paddle.vx = 0;
  game.activePowers = {};
  game.balls = []; game.particles = []; game.powerups = [];
  game.shards = [];
  game.curveActive = false;
  game.mode = 'normal';
  game.boss = null;
  buildBricks();
  spawnBall();
  initAbility();
  initCreatures();
  initAchievements();
  resetSessionStats();
  scoreEl.textContent = '0';
  livesEl.textContent = '3';
  comboEl.textContent = 'x1';
  hideOverlay();
  game.state = 'playing';

  // Init audio on first user gesture
  AudioEngine.init();
  AudioEngine.startBeat();
}

setStartGameCallback(startGame);
requestAnimationFrame(loop);
