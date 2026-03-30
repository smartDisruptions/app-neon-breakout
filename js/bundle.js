(function() {
'use strict';

// ═══════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════
const W = 800, H = 560;
const BRICK_ROWS = 7, BRICK_COLS = 12;
const BRICK_W = 58, BRICK_H = 18, BRICK_PAD = 6, BRICK_TOP = 40;
const PADDLE_W = 110, PADDLE_H = 14, PADDLE_Y = H - 40;
const BALL_R = 6;
const POWERUP_SIZE = 18, POWERUP_SPEED = 2.8;
const MAX_PARTICLES = 200;

const HUES = [340, 20, 50, 140, 185, 260, 300];
function hslRow(row) {
  return 'hsl(' + HUES[row % HUES.length] + ', 100%, 60%)';
}

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
const game = {
  state: 'title',
  score: 0,
  combo: 0,
  comboTimer: 0,
  lives: 3,
  level: 1,
  shakeX: 0,
  shakeY: 0,
  shakeMag: 0,
  mouseX: W / 2,
  balls: [],
  bricks: [],
  particles: [],
  powerups: [],
  paddle: { x: W / 2, w: PADDLE_W, vx: 0 },
  activePowers: {},
  shards: [],
  curveActive: false,
  mode: 'normal',
  boss: null,
  lastTime: 0,
};

// ═══════════════════════════════════════════════════════
// SHAKE
// ═══════════════════════════════════════════════════════
function triggerShake(mag) {
  game.shakeMag = Math.max(game.shakeMag, mag);
}

function updateShake() {
  if (game.shakeMag > 0.3) {
    game.shakeX = (Math.random() - 0.5) * game.shakeMag * 2;
    game.shakeY = (Math.random() - 0.5) * game.shakeMag * 2;
    game.shakeMag *= 0.85;
  } else {
    game.shakeX = game.shakeY = game.shakeMag = 0;
  }
}

// ═══════════════════════════════════════════════════════
// AUDIO
// ═══════════════════════════════════════════════════════
const AudioEngine = {
  ctx: null,
  master: null,
  muted: false,
  _beatStarted: false,
  _pulse: 0,
  _nextNoteTime: 0,
  _noteIndex: 0,
  _schedulerTimer: null,
  _bassNotes: [65.41, 82.41, 98.00, 130.81],

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(this.ctx.destination);
    const saved = localStorage.getItem('neonBreakout_muted');
    if (saved === 'true') {
      this.muted = true;
      this.master.gain.value = 0;
    }
  },

  startBeat() {
    if (this._beatStarted || !this.ctx) return;
    this._beatStarted = true;
    this._nextNoteTime = this.ctx.currentTime + 0.1;
    this._noteIndex = 0;
    this._scheduleBeat();
  },

  _scheduleBeat() {
    const lookahead = 0.1;
    const scheduleInterval = 50;
    const schedule = () => {
      while (this._nextNoteTime < this.ctx.currentTime + lookahead) {
        this._playBassNote(this._bassNotes[this._noteIndex % 4], this._nextNoteTime);
        this._noteIndex++;
        this._nextNoteTime += 0.5;
      }
    };
    this._schedulerTimer = setInterval(schedule, scheduleInterval);
    schedule();
  },

  _playBassNote(freq, time) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = freq / 2;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = 8;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.15, time);
    env.gain.exponentialRampToValueAtTime(0.08, time + 0.3);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.48);
    const subEnv = this.ctx.createGain();
    subEnv.gain.setValueAtTime(0.12, time);
    subEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.45);
    osc.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    sub.connect(subEnv);
    subEnv.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.5);
    sub.start(time);
    sub.stop(time + 0.5);
    const pulseTime = time - this.ctx.currentTime;
    if (pulseTime >= 0 && pulseTime < 0.1) {
      this._pulse = 1.0;
    }
  },

  getPulse() {
    this._pulse *= 0.92;
    return this._pulse;
  },

  playBrickHit(row) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const freqs = [880, 740, 622, 523, 440, 370, 311];
    const freq = freqs[row % freqs.length];
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq * 3;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.12, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.15);
  },

  playPaddleHit() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 80;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.2, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(env);
    env.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  },

  playBallLoss() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.5);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.2, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(env);
    env.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.5);
  },

  playPowerUp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0, t + i * 0.05);
      env.gain.linearRampToValueAtTime(0.12, t + i * 0.05 + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.15);
      osc.connect(env);
      env.connect(this.master);
      osc.start(t + i * 0.05);
      osc.stop(t + i * 0.05 + 0.15);
    });
  },

  playLevelClear() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0, t + i * 0.08);
      env.gain.linearRampToValueAtTime(0.1, t + i * 0.08 + 0.03);
      env.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.3);
      osc.connect(env);
      env.connect(this.master);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.3);
    });
  },

  toggleMute() {
    if (!this.ctx) return;
    this.muted = !this.muted;
    this.master.gain.setValueAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime);
    localStorage.setItem('neonBreakout_muted', this.muted);
  },

  isMuted() {
    return this.muted;
  }
};

// ═══════════════════════════════════════════════════════
// PARTICLES
// ═══════════════════════════════════════════════════════
function emitParticles(x, y, color, count, spread, speed) {
  const room = MAX_PARTICLES - game.particles.length;
  const n = Math.min(count, room);
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const vel = (0.5 + Math.random() * speed) * (0.5 + Math.random());
    game.particles.push({
      x, y,
      vx: Math.cos(angle) * vel * spread,
      vy: Math.sin(angle) * vel * spread,
      life: 1,
      decay: 0.02 + Math.random() * 0.03,
      size: 1.5 + Math.random() * 2.5,
      color,
    });
  }
}

function updateParticles() {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.04; p.vx *= 0.99;
    p.life -= p.decay;
    if (p.life <= 0) game.particles.splice(i, 1);
  }

  for (let i = game.shards.length - 1; i >= 0; i--) {
    const s = game.shards[i];
    s.x += s.vx;
    s.y += s.vy;
    s.vy += 0.08;
    s.vx *= 0.98;
    s.rotation += s.angularVel;
    s.life -= 0.015;
    if (s.x < 0 || s.x > W) s.vx = -s.vx * 0.6;
    if (s.y > H) s.vy = -s.vy * 0.4;
    if (game.combo > 5 && s.life > 0.3 && Math.random() < 0.3) {
      emitParticles(s.x, s.y, s.color, 1, 0.3, 0.5);
    }
    if (s.life <= 0) game.shards.splice(i, 1);
  }
}

if (!game.shards) game.shards = [];

function emitShards(x, y, w, h, color) {
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const vertices = [];
    const numVerts = 3;
    for (let v = 0; v < numVerts; v++) {
      vertices.push({
        x: (Math.random() - 0.5) * w * 0.6,
        y: (Math.random() - 0.5) * h * 1.2,
      });
    }
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    game.shards.push({
      x: x + (Math.random() - 0.5) * w,
      y: y + (Math.random() - 0.5) * h,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      rotation: Math.random() * Math.PI * 2,
      angularVel: (Math.random() - 0.5) * 0.2,
      vertices,
      life: 1,
      color,
    });
  }
}

// ═══════════════════════════════════════════════════════
// CRT
// ═══════════════════════════════════════════════════════
let crtEnabled = localStorage.getItem('neonBreakout_crt') === 'true';

const crtCanvas = document.createElement('canvas');
crtCanvas.width = W;
crtCanvas.height = H;
const crtCtx = crtCanvas.getContext('2d');

const scanlineCanvas = document.createElement('canvas');
scanlineCanvas.width = W;
scanlineCanvas.height = H;
const scanCtx = scanlineCanvas.getContext('2d');
scanCtx.fillStyle = 'rgba(0,0,0,0.05)';
for (let y = 0; y < H; y += 2) {
  scanCtx.fillRect(0, y, W, 1);
}

function isCRTEnabled() { return crtEnabled; }

function toggleCRT() {
  crtEnabled = !crtEnabled;
  localStorage.setItem('neonBreakout_crt', crtEnabled);
}

function applyCRT(sourceCanvas, targetCtx) {
  if (!crtEnabled) return;
  crtCtx.clearRect(0, 0, W, H);
  crtCtx.globalCompositeOperation = 'source-over';
  crtCtx.drawImage(sourceCanvas, 2, 0);
  crtCtx.globalCompositeOperation = 'multiply';
  crtCtx.fillStyle = 'rgb(255,0,0)';
  crtCtx.fillRect(0, 0, W, H);
  crtCtx.globalCompositeOperation = 'lighter';
  const greenCanvas = document.createElement('canvas');
  greenCanvas.width = W; greenCanvas.height = H;
  const greenCtx = greenCanvas.getContext('2d');
  greenCtx.drawImage(sourceCanvas, 0, 0);
  greenCtx.globalCompositeOperation = 'multiply';
  greenCtx.fillStyle = 'rgb(0,255,0)';
  greenCtx.fillRect(0, 0, W, H);
  crtCtx.drawImage(greenCanvas, 0, 0);
  const blueCanvas = document.createElement('canvas');
  blueCanvas.width = W; blueCanvas.height = H;
  const blueCtx = blueCanvas.getContext('2d');
  blueCtx.drawImage(sourceCanvas, -2, 0);
  blueCtx.globalCompositeOperation = 'multiply';
  blueCtx.fillStyle = 'rgb(0,0,255)';
  blueCtx.fillRect(0, 0, W, H);
  crtCtx.drawImage(blueCanvas, 0, 0);
  targetCtx.save();
  targetCtx.globalAlpha = 1;
  targetCtx.globalCompositeOperation = 'source-over';
  targetCtx.drawImage(crtCanvas, 0, 0);
  targetCtx.globalAlpha = 1;
  targetCtx.drawImage(scanlineCanvas, 0, 0);
  const vigGrad = targetCtx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
  vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vigGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
  targetCtx.fillStyle = vigGrad;
  targetCtx.fillRect(0, 0, W, H);
  targetCtx.restore();
}

// ═══════════════════════════════════════════════════════
// BALL
// ═══════════════════════════════════════════════════════
function spawnBall(x, y, angle) {
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

// ═══════════════════════════════════════════════════════
// BRICKS
// ═══════════════════════════════════════════════════════
function buildBricks() {
  game.bricks = [];
  const totalW = BRICK_COLS * (BRICK_W + BRICK_PAD) - BRICK_PAD;
  const offX = (W - totalW) / 2;
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const hp = r < 2 ? 2 : 1;
      game.bricks.push({
        x: offX + c * (BRICK_W + BRICK_PAD),
        y: BRICK_TOP + r * (BRICK_H + BRICK_PAD),
        w: BRICK_W, h: BRICK_H,
        hp, maxHp: hp,
        color: hslRow(r),
        alive: true,
      });
    }
  }
}

// ═══════════════════════════════════════════════════════
// POWERUPS
// ═══════════════════════════════════════════════════════
const POWER_TYPES = [
  { type: 'wide',  color: '#00e5ff', symbol: 'W', duration: 8000 },
  { type: 'multi', color: '#39ff14', symbol: 'M', duration: 0 },
  { type: 'slow',  color: '#ffe600', symbol: 'S', duration: 5000 },
];

function maybeDropPowerup(x, y, guaranteed) {
  if (!guaranteed && Math.random() < 0.08) {
    game.powerups.push({
      x, y, type: 'prism', color: '#fff', symbol: '◇', duration: 8000,
      vy: POWERUP_SPEED, trail: [], glow: 0, _hue: 0,
    });
    return;
  }
  if (!guaranteed && Math.random() > 0.18) return;
  const p = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
  game.powerups.push({ x, y, ...p, vy: POWERUP_SPEED, trail: [], glow: 0 });
}

function activatePower(p) {
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
      r: 4,
      trail: [],
      color,
      expiry,
      isPrism: true,
    });
  }
}

// ═══════════════════════════════════════════════════════
// PHYSICS
// ═══════════════════════════════════════════════════════
function ballBrickCollision(ball, brick) {
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

// ═══════════════════════════════════════════════════════
// PADDLE
// ═══════════════════════════════════════════════════════
function getAbilityForLevel(level) {
  if (level <= 5) return 'pulse';
  if (level <= 10) return 'magnet';
  return 'phaseshift';
}

function initAbility() {
  game.paddle.ability = getAbilityForLevel(game.level);
  game.paddle.cooldown = 0;
  game.paddle.cooldownMax = 10000;
  game.paddle.magnetActive = false;
}

function activateAbility() {
  const paddle = game.paddle;
  if (paddle.cooldown > Date.now()) return;
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
  const coneAngle = Math.PI / 3;
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
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const px = oldX + (game.paddle.x - oldX) * t;
    emitParticles(px, PADDLE_Y + PADDLE_H / 2, '#ff0', 3, 0.5, 2);
  }
  triggerShake(4);
  AudioEngine.playPowerUp();
}

function handleMagnetCatch(ball) {
  if (!game.paddle.magnetActive) return false;
  ball.stuck = true;
  ball.stickOffset = ball.x - game.paddle.x;
  game.paddle.magnetActive = false;
  return true;
}

function releaseMagnetBall() {
  for (const ball of game.balls) {
    if (ball.stuck) {
      ball.stuck = false;
      const hit = ball.stickOffset / (game.paddle.w / 2);
      const angle = -Math.PI / 2 + hit * (Math.PI / 3);
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) || (7 + game.level * 0.4);
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
    }
  }
}

function updateStuckBalls() {
  for (const ball of game.balls) {
    if (ball.stuck) {
      ball.x = game.paddle.x + ball.stickOffset;
      ball.y = PADDLE_Y - ball.r;
    }
  }
}

// ═══════════════════════════════════════════════════════
// BACKGROUND
// ═══════════════════════════════════════════════════════
const horizonCanvas = document.createElement('canvas');
horizonCanvas.width = W;
horizonCanvas.height = H;
const hCtx = horizonCanvas.getContext('2d');

const HORIZON_Y = H * 0.65;
const SUN_RADIUS = 50;
let gridOffset = 0;
let bgFrameCount = 0;

function updateBackground(combo) {
  bgFrameCount++;
  if (bgFrameCount % 2 !== 0) return;
  const pulse = AudioEngine.getPulse ? AudioEngine.getPulse() : 0;
  let speed = 0.5;
  if (combo >= 15) speed = 2.0;
  else if (combo >= 10) speed = 1.5;
  else if (combo >= 5) speed = 1.0;
  gridOffset = (gridOffset + speed) % 40;
  hCtx.clearRect(0, 0, W, H);
  const skyGrad = hCtx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, '#05050a');
  skyGrad.addColorStop(0.5, '#0a0015');
  skyGrad.addColorStop(0.65, '#1a0030');
  skyGrad.addColorStop(1, '#0a0015');
  hCtx.fillStyle = skyGrad;
  hCtx.fillRect(0, 0, W, H);
  const sunBright = combo >= 10 ? 0.7 + pulse * 0.3 : combo >= 5 ? 0.5 : 0.3;
  hCtx.save();
  hCtx.globalAlpha = sunBright;
  const sunGrad = hCtx.createRadialGradient(W / 2, HORIZON_Y, 0, W / 2, HORIZON_Y, SUN_RADIUS);
  sunGrad.addColorStop(0, '#ff0');
  sunGrad.addColorStop(0.4, '#f0f');
  sunGrad.addColorStop(1, 'rgba(255,0,255,0)');
  hCtx.beginPath();
  hCtx.rect(0, 0, W, HORIZON_Y);
  hCtx.clip();
  hCtx.fillStyle = sunGrad;
  hCtx.beginPath();
  hCtx.arc(W / 2, HORIZON_Y, SUN_RADIUS, 0, Math.PI * 2);
  hCtx.fill();
  hCtx.shadowColor = '#f0f';
  hCtx.shadowBlur = 40 + pulse * 20;
  hCtx.fill();
  hCtx.restore();
  hCtx.strokeStyle = '#f0f';
  hCtx.globalAlpha = 0.4;
  hCtx.lineWidth = 1.5;
  hCtx.shadowColor = '#f0f';
  hCtx.shadowBlur = 10;
  hCtx.beginPath();
  hCtx.moveTo(0, HORIZON_Y);
  hCtx.lineTo(W, HORIZON_Y);
  hCtx.stroke();
  hCtx.shadowBlur = 0;
  hCtx.strokeStyle = '#f0f';
  hCtx.lineWidth = 0.5;
  const numHLines = 12;
  for (let i = 0; i < numHLines; i++) {
    const t = (i + gridOffset / 40) / numHLines;
    const y = HORIZON_Y + t * t * (H - HORIZON_Y);
    const alpha = 0.05 + t * 0.15;
    hCtx.globalAlpha = alpha;
    hCtx.beginPath();
    hCtx.moveTo(0, y);
    hCtx.lineTo(W, y);
    hCtx.stroke();
  }
  const numVLines = 14;
  for (let i = 0; i <= numVLines; i++) {
    const xBottom = (i / numVLines) * W;
    const xTop = W / 2 + (xBottom - W / 2) * 0.05;
    hCtx.globalAlpha = 0.08;
    hCtx.beginPath();
    hCtx.moveTo(xTop, HORIZON_Y);
    hCtx.lineTo(xBottom, H);
    hCtx.stroke();
  }
  hCtx.globalAlpha = 1;
  hCtx.shadowBlur = 0;
}

function drawBackground(ctx) {
  ctx.drawImage(horizonCanvas, 0, 0);
}

const CREATURE_TYPES = [
  { shape: 'triangle', color: '#0ff' },
  { shape: 'circle', color: '#f0f' },
  { shape: 'hexagon', color: '#0f0' },
  { shape: 'jellyfish', color: '#ff0' },
];

let creatures = [];

function initCreatures() {
  creatures = [];
  const count = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const type = CREATURE_TYPES[Math.floor(Math.random() * CREATURE_TYPES.length)];
    creatures.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      type: type.shape,
      color: type.color,
      size: 4 + Math.random() * 4,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

function updateCreatures() {
  const pulse = AudioEngine.getPulse ? AudioEngine.getPulse() : 0;
  for (const c of creatures) {
    c.phase += 0.02;
    for (const other of creatures) {
      if (other === c) continue;
      const dx = c.x - other.x, dy = c.y - other.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 40 && dist > 0) {
        c.vx += (dx / dist) * 0.02;
        c.vy += (dy / dist) * 0.02;
      }
    }
    for (const ball of game.balls) {
      const dx = c.x - ball.x, dy = c.y - ball.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 80 && dist > 0) {
        c.vx += (dx / dist) * 0.08;
        c.vy += (dy / dist) * 0.08;
      }
    }
    if (game.combo > 0) {
      const tx = W / 2, ty = 30;
      const dx = tx - c.x, dy = ty - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        c.vx += (dx / dist) * 0.01;
        c.vy += (dy / dist) * 0.01;
      }
    }
    if (game.mode === 'boss') {
      const edgeX = c.x < W / 2 ? 0 : W;
      c.vx += (edgeX - c.x) * 0.001;
    }
    c.vx *= 0.98;
    c.vy *= 0.98;
    c.vx += (Math.random() - 0.5) * 0.01;
    c.vy += (Math.random() - 0.5) * 0.01;
    const speed = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
    if (speed > 1.5) {
      c.vx = (c.vx / speed) * 1.5;
      c.vy = (c.vy / speed) * 1.5;
    }
    c.x += c.vx;
    c.y += c.vy;
    if (c.x < -20) c.x = W + 20;
    if (c.x > W + 20) c.x = -20;
    if (c.y < -20) c.y = H + 20;
    if (c.y > H + 20) c.y = -20;
  }
}

function drawCreatures(ctx) {
  const pulse = AudioEngine.getPulse ? AudioEngine.getPulse() : 0;
  for (const c of creatures) {
    const alpha = 0.1 + pulse * 0.05;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 1;
    switch (c.type) {
      case 'triangle': {
        const s = c.size;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y - s);
        ctx.lineTo(c.x - s * 0.87, c.y + s * 0.5);
        ctx.lineTo(c.x + s * 0.87, c.y + s * 0.5);
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case 'circle': {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillStyle = c.color;
        ctx.fill();
        break;
      }
      case 'hexagon': {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + c.phase * 0.5;
          const hx = c.x + Math.cos(a) * c.size;
          const hy = c.y + Math.sin(a) * c.size;
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case 'jellyfish': {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size, Math.PI, 0);
        ctx.stroke();
        for (let t = -1; t <= 1; t++) {
          ctx.beginPath();
          ctx.moveTo(c.x + t * c.size * 0.6, c.y);
          const tendrilLen = c.size * 1.5;
          for (let ty = 0; ty < tendrilLen; ty += 2) {
            const tx = c.x + t * c.size * 0.6 + Math.sin(c.phase + ty * 0.3) * 2;
            ctx.lineTo(tx, c.y + ty);
          }
          ctx.stroke();
        }
        break;
      }
    }
  }
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════
// BOSS
// ═══════════════════════════════════════════════════════
const SHAPES = {
  triangle: {
    vertices: (cx, cy, r) => {
      const pts = [];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      return pts;
    },
  },
  hexagon: {
    vertices: (cx, cy, r) => {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      return pts;
    },
  },
  eye: {
    vertices: (cx, cy, r) => {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        pts.push({ x: cx + Math.cos(a) * r * 1.3, y: cy + Math.sin(a) * r * 0.5 });
      }
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI;
        pts.push({ x: cx + Math.cos(a) * r * 1.3, y: cy + Math.sin(a) * r * 0.5 });
      }
      return pts;
    },
  },
};

function getShapeForLevel(level) {
  if (level <= 3) return 'triangle';
  if (level <= 6) return 'hexagon';
  return 'eye';
}

function getBossHP(level) {
  if (level <= 3) return 3;
  if (level <= 6) return 4;
  if (level <= 9) return 5;
  return 7;
}

function createBoss(level) {
  const shapeName = getShapeForLevel(level);
  const shapeDef = SHAPES[shapeName];
  const cx = W / 2, cy = 120;
  let radius = 80;
  const hp = getBossHP(level);
  const moveSpeed = level <= 3 ? 1 : level <= 6 ? 1.3 : level <= 9 ? 1.6 : 2.0;
  if (level >= 12) { radius = 95; }
  const coreR = level >= 12 ? 32 : 28;

  game.boss = {
    x: cx, y: cy, baseX: cx,
    shape: shapeName, shapeDef, radius,
    coreHP: hp, coreMaxHP: hp, coreRadius: coreR,
    time: 0, rotation: 0, level, moveSpeed,
    defeated: false,
  };
  game.mode = 'boss';

  // Drop a wide powerup to help the player
  game.powerups.push({
    x: cx, y: cy + radius,
    type: 'wide', color: '#00e5ff', symbol: 'W', duration: 8000,
    vy: POWERUP_SPEED, trail: [], glow: 0,
  });
}

function updateBoss() {
  const boss = game.boss;
  if (!boss || boss.defeated) return;
  boss.time++;
  boss.rotation += 0.005;

  // Simple side-to-side movement
  boss.x = boss.baseX + Math.sin(boss.time * 0.02 * boss.moveSpeed) * 150;
  boss.x = Math.max(boss.radius + 20, Math.min(W - boss.radius - 20, boss.x));
}

function ballBossCollision(ball, boss) {
  if (!boss || boss.defeated) return;
  if (ball.stuck) return;

  // Simple: hit the core, deal damage, bounce
  const dx = ball.x - boss.x;
  const dy = ball.y - boss.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < ball.r + boss.coreRadius && dist > 0) {
    const nx = dx / dist, ny = dy / dist;
    const dot = ball.vx * nx + ball.vy * ny;
    ball.vx -= 2 * dot * nx;
    ball.vy -= 2 * dot * ny;

    boss.coreHP--;
    emitParticles(boss.x, boss.y, '#fff', 10, 2, 3);
    triggerShake(5);
    AudioEngine.playBrickHit(0);

    if (boss.coreHP <= 0) {
      defeatBoss(boss);
    }
  }
}

function defeatBoss(boss) {
  boss.defeated = true;
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      const ox = boss.x + (Math.random() - 0.5) * boss.radius * 2;
      const oy = boss.y + (Math.random() - 0.5) * boss.radius * 2;
      emitParticles(ox, oy, '#0ff', 15, 3, 5);
      emitParticles(ox, oy, '#f0f', 10, 2, 4);
    }, i * 100);
  }
  triggerShake(15);
  game.score += 500 * game.level;
  game.lives++;
  AudioEngine.playLevelClear();
}

function drawBoss(ctx, drawGlowFn) {
  const boss = game.boss;
  if (!boss) return;

  ctx.save();

  // Decorative wireframe shape (no collision)
  ctx.strokeStyle = '#0ff';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.3;
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.rotate(boss.rotation);
  const verts = boss.shapeDef.vertices(0, 0, boss.radius);
  ctx.beginPath();
  for (let i = 0; i < verts.length; i++) {
    if (i === 0) ctx.moveTo(verts[i].x, verts[i].y);
    else ctx.lineTo(verts[i].x, verts[i].y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;

  // Core — pulsing glow
  const pulseAlpha = 0.5 + Math.sin(boss.time * 0.08) * 0.3;
  drawGlowFn(boss.x, boss.y, boss.coreRadius + 12, '#f44', pulseAlpha);
  drawGlowFn(boss.x, boss.y, boss.coreRadius + 24, '#f44', pulseAlpha * 0.3);

  // Core solid
  ctx.fillStyle = '#f44';
  ctx.beginPath();
  ctx.arc(boss.x, boss.y, boss.coreRadius, 0, Math.PI * 2);
  ctx.fill();

  // HP bar below core
  const barW = 50;
  const barH = 4;
  const barX = boss.x - barW / 2;
  const barY = boss.y + boss.coreRadius + 8;
  ctx.fillStyle = '#111';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = '#f44';
  ctx.fillRect(barX, barY, barW * (boss.coreHP / boss.coreMaxHP), barH);

  ctx.restore();
}

// ═══════════════════════════════════════════════════════
// ACHIEVEMENTS
// ═══════════════════════════════════════════════════════
const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'FIRST BLOOD', req: 'Destroy your first brick', color: '#0ff', starX: 200, starY: 150 },
  { id: 'combo_hunter', name: 'COMBO HUNTER', req: 'Reach 15x combo', color: '#f0f', starX: 300, starY: 120 },
  { id: 'combo_legend', name: 'COMBO LEGEND', req: 'Reach 30x combo', color: '#f0f', starX: 400, starY: 100 },
  { id: 'untouchable', name: 'UNTOUCHABLE', req: 'Clear a level without losing a life', color: '#ff0', starX: 500, starY: 130 },
  { id: 'sentinel_slayer', name: 'SENTINEL SLAYER', req: 'Defeat your first boss', color: '#0f0', starX: 600, starY: 160 },
  { id: 'sentinel_master', name: 'SENTINEL MASTER', req: 'Defeat 3 bosses', color: '#0f0', starX: 650, starY: 220 },
  { id: 'prism_master', name: 'PRISM MASTER', req: 'Destroy 20+ bricks with one Prism', color: '#fff', starX: 550, starY: 250 },
  { id: 'curve_ace', name: 'CURVE ACE', req: 'Hit 3+ bricks with curve active', color: '#0ff', starX: 450, starY: 280 },
  { id: 'pulse_destroyer', name: 'PULSE DESTROYER', req: 'Destroy 5+ bricks with one Pulse', color: '#0ff', starX: 350, starY: 300 },
  { id: 'marathon', name: 'MARATHON', req: 'Reach level 20', color: '#f80', starX: 250, starY: 280 },
  { id: 'speed_demon', name: 'SPEED DEMON', req: 'Clear a level in under 15 seconds', color: '#f44', starX: 150, starY: 250 },
  { id: 'power_surge', name: 'POWER SURGE', req: 'Have 3+ power-ups active at once', color: '#0f0', starX: 200, starY: 350 },
  { id: 'boss_rush', name: 'BOSS RUSH', req: 'Defeat a boss without losing a life', color: '#f44', starX: 350, starY: 380 },
  { id: 'centurion', name: 'CENTURION', req: 'Destroy 100 bricks in one game', color: '#0ff', starX: 500, starY: 370 },
  { id: 'survivor', name: 'SURVIVOR', req: 'Reach level 10', color: '#ff0', starX: 600, starY: 330 },
  { id: 'perfectionist', name: 'PERFECTIONIST', req: 'Score 5000+ points', color: '#f0f', starX: 400, starY: 200 },
];

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
  [5, 6], [6, 7], [7, 8], [8, 9], [9, 10],
  [10, 0], [1, 15], [15, 7], [3, 15],
  [11, 8], [11, 12], [12, 13], [13, 14], [14, 5],
];

let achEarned = {};
let showingConstellation = false;
let hoveredStar = -1;

let sessionStats = {
  bricksDestroyed: 0,
  bossesDefeated: 0,
  livesLostThisLevel: 0,
  levelStartTime: 0,
  prismBricksThisActivation: 0,
  curveBricksThisShot: 0,
  pulseBricksThisUse: 0,
};

function initAchievements() {
  const saved = localStorage.getItem('neonBreakout_achievements');
  if (saved) {
    try { achEarned = JSON.parse(saved); } catch (e) { achEarned = {}; }
  }
}

function resetSessionStats() {
  sessionStats.bricksDestroyed = 0;
  sessionStats.livesLostThisLevel = 0;
  sessionStats.levelStartTime = Date.now();
  sessionStats.prismBricksThisActivation = 0;
  sessionStats.curveBricksThisShot = 0;
  sessionStats.pulseBricksThisUse = 0;
}

function saveAchievements() {
  localStorage.setItem('neonBreakout_achievements', JSON.stringify(achEarned));
}

function earnAchievement(id) {
  if (achEarned[id]) return;
  achEarned[id] = { earned: true, date: Date.now() };
  saveAchievements();
}

function checkAchievements(event, data) {
  switch (event) {
    case 'brick_destroy':
      sessionStats.bricksDestroyed++;
      if (!achEarned.first_blood) earnAchievement('first_blood');
      if (sessionStats.bricksDestroyed >= 100) earnAchievement('centurion');
      break;
    case 'combo':
      if (game.combo >= 15) earnAchievement('combo_hunter');
      if (game.combo >= 30) earnAchievement('combo_legend');
      break;
    case 'level_clear':
      if (sessionStats.livesLostThisLevel === 0) earnAchievement('untouchable');
      const elapsed = (Date.now() - sessionStats.levelStartTime) / 1000;
      if (elapsed < 15) earnAchievement('speed_demon');
      sessionStats.livesLostThisLevel = 0;
      sessionStats.levelStartTime = Date.now();
      if (game.level >= 10) earnAchievement('survivor');
      if (game.level >= 20) earnAchievement('marathon');
      break;
    case 'ball_lost':
      sessionStats.livesLostThisLevel++;
      break;
    case 'boss_defeated':
      sessionStats.bossesDefeated++;
      earnAchievement('sentinel_slayer');
      if (sessionStats.bossesDefeated >= 3) earnAchievement('sentinel_master');
      if (sessionStats.livesLostThisLevel === 0) earnAchievement('boss_rush');
      break;
    case 'score':
      if (game.score >= 5000) earnAchievement('perfectionist');
      break;
    case 'power_count':
      if (Object.keys(game.activePowers).length >= 3) earnAchievement('power_surge');
      break;
    case 'pulse_bricks':
      if (data >= 5) earnAchievement('pulse_destroyer');
      break;
  }
}

function isShowingConstellation() {
  return showingConstellation;
}

function toggleConstellation() {
  showingConstellation = !showingConstellation;
}

function drawConstellation(ctx, mouseX, mouseY) {
  if (!showingConstellation) return;
  ctx.fillStyle = 'rgba(5,5,10,0.92)';
  ctx.fillRect(0, 0, W, H);
  ctx.font = '900 28px Orbitron';
  ctx.fillStyle = '#0ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#0ff';
  ctx.shadowBlur = 20;
  ctx.fillText('ACHIEVEMENTS', W / 2, 40);
  ctx.shadowBlur = 0;
  const earnedCount = Object.keys(achEarned).length;
  ctx.font = '300 14px Rajdhani';
  ctx.fillStyle = '#888';
  ctx.fillText(earnedCount + ' / ' + ACHIEVEMENTS.length, W / 2, 65);
  ctx.lineWidth = 1;
  for (const [a, b] of CONNECTIONS) {
    const sa = ACHIEVEMENTS[a], sb = ACHIEVEMENTS[b];
    const aEarned = !!achEarned[sa.id], bEarned = !!achEarned[sb.id];
    if (aEarned && bEarned) {
      ctx.strokeStyle = sa.color;
      ctx.globalAlpha = 0.3;
    } else {
      ctx.strokeStyle = '#333';
      ctx.globalAlpha = 0.1;
    }
    ctx.beginPath();
    ctx.moveTo(sa.starX, sa.starY);
    ctx.lineTo(sb.starX, sb.starY);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  hoveredStar = -1;
  for (let i = 0; i < ACHIEVEMENTS.length; i++) {
    const a = ACHIEVEMENTS[i];
    const isEarned = !!achEarned[a.id];
    const dx = mouseX - a.starX, dy = mouseY - a.starY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 20) hoveredStar = i;
    if (isEarned) {
      ctx.fillStyle = a.color;
      ctx.shadowColor = a.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(a.starX, a.starY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(a.starX, a.starY, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (hoveredStar >= 0) {
    const a = ACHIEVEMENTS[hoveredStar];
    const isEarned = !!achEarned[a.id];
    const tooltipX = Math.min(a.starX + 15, W - 180);
    const tooltipY = a.starY - 30;
    ctx.fillStyle = '#111';
    ctx.strokeStyle = isEarned ? a.color : '#555';
    ctx.lineWidth = 1;
    const tw = 170, th = isEarned ? 50 : 40;
    ctx.fillRect(tooltipX, tooltipY, tw, th);
    ctx.strokeRect(tooltipX, tooltipY, tw, th);
    ctx.font = '700 12px Orbitron';
    ctx.fillStyle = isEarned ? a.color : '#888';
    ctx.textAlign = 'left';
    ctx.fillText(a.name, tooltipX + 8, tooltipY + 16);
    ctx.font = '300 11px Rajdhani';
    ctx.fillStyle = '#aaa';
    ctx.fillText(a.req, tooltipX + 8, tooltipY + 32);
    if (isEarned && achEarned[a.id].date) {
      ctx.font = '300 9px Rajdhani';
      ctx.fillStyle = '#666';
      const d = new Date(achEarned[a.id].date);
      ctx.fillText('Earned ' + d.toLocaleDateString(), tooltipX + 8, tooltipY + 45);
    }
  }
  ctx.font = '300 12px Rajdhani';
  ctx.fillStyle = '#555';
  ctx.textAlign = 'center';
  ctx.fillText('Press A to close', W / 2, H - 20);
}

// ═══════════════════════════════════════════════════════
// SCREENSHOT
// ═══════════════════════════════════════════════════════
let captures = [];
let lastCaptureTime = 0;
let flashAlpha = 0;
let shareButtonTimer = 0;
let lastShareBlob = null;
const SCREENSHOT_COOLDOWN = 10000;

function checkScreenshotTriggers() {
  if (game.state !== 'playing') return;
  if (Date.now() - lastCaptureTime < SCREENSHOT_COOLDOWN) return;
  if (game.combo >= 10 && game.combo === 10) {
    captureHighlight('10X COMBO!');
    return;
  }
  if (game._bossJustDefeated) {
    captureHighlight('BOSS DEFEATED');
    game._bossJustDefeated = false;
    return;
  }
  if (game.balls.length >= 7) {
    captureHighlight('PRISM FRENZY');
    return;
  }
}

function captureHighlight(triggerLabel) {
  lastCaptureTime = Date.now();
  flashAlpha = 0.3;
  requestAnimationFrame(() => {
    const cvs = document.getElementById('gameCanvas');
    const offscreen = document.createElement('canvas');
    offscreen.width = W;
    offscreen.height = H;
    const octx = offscreen.getContext('2d');
    octx.drawImage(cvs, 0, 0);
    octx.fillStyle = 'rgba(0,0,0,0.2)';
    octx.fillRect(0, 0, W, H);
    octx.font = '700 16px Orbitron';
    octx.fillStyle = '#0ff';
    octx.textAlign = 'left';
    octx.shadowColor = '#0ff';
    octx.shadowBlur = 10;
    octx.fillText('SCORE: ' + game.score, 15, 30);
    if (game.combo > 1) {
      octx.fillStyle = '#f0f';
      octx.shadowColor = '#f0f';
      octx.fillText('x' + game.combo, 15, 52);
    }
    octx.fillStyle = '#fff';
    octx.textAlign = 'right';
    octx.shadowColor = '#fff';
    octx.shadowBlur = 5;
    octx.fillText('LEVEL ' + game.level, W - 15, 30);
    octx.font = '900 36px Orbitron';
    octx.textAlign = 'center';
    octx.fillStyle = '#ff0';
    octx.shadowColor = '#ff0';
    octx.shadowBlur = 30;
    octx.fillText(triggerLabel, W / 2, H / 2);
    octx.shadowBlur = 0;
    octx.font = '300 10px Rajdhani';
    octx.fillStyle = 'rgba(255,255,255,0.3)';
    octx.fillText('NEON BREAKOUT', W / 2, H - 10);
    offscreen.toBlob((blob) => {
      if (blob) {
        captures.push(blob);
        if (captures.length > 5) captures.shift();
      }
    }, 'image/png');
  });
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 2000);
  }
}

function updateFlash() {
  if (flashAlpha > 0) {
    flashAlpha *= 0.85;
    if (flashAlpha < 0.01) flashAlpha = 0;
  }
}

function drawFlash(ctx) {
  if (flashAlpha > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + flashAlpha + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

// ═══════════════════════════════════════════════════════
// RENDERER
// ═══════════════════════════════════════════════════════
const cvs = document.getElementById('gameCanvas');
const ctx = cvs.getContext('2d');
const scoreEl = document.getElementById('scoreVal');
const comboEl = document.getElementById('comboVal');
const livesEl = document.getElementById('livesVal');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlaySub = document.getElementById('overlaySub');
const overlayPrompt = document.getElementById('overlayPrompt');

const _glowCache = {};

function makeGlowTex(color, radius) {
  const key = color + '|' + radius;
  if (_glowCache[key]) return _glowCache[key];
  const size = radius * 2;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const gc = c.getContext('2d');
  const g = gc.createRadialGradient(radius, radius, 0, radius, radius, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  gc.fillStyle = g;
  gc.fillRect(0, 0, size, size);
  _glowCache[key] = c;
  return c;
}

const gridCanvas = document.createElement('canvas');
gridCanvas.width = W; gridCanvas.height = H;
const gridCtx = gridCanvas.getContext('2d');
gridCtx.strokeStyle = 'rgba(0,255,255,0.015)';
gridCtx.lineWidth = 1;
for (let x = 0; x < W; x += 40) {
  gridCtx.beginPath(); gridCtx.moveTo(x, 0); gridCtx.lineTo(x, H); gridCtx.stroke();
}
for (let y = 0; y < H; y += 40) {
  gridCtx.beginPath(); gridCtx.moveTo(0, y); gridCtx.lineTo(W, y); gridCtx.stroke();
}

const shineCanvas = document.createElement('canvas');
shineCanvas.width = BRICK_W; shineCanvas.height = BRICK_H;
const shineCtx = shineCanvas.getContext('2d');
const shineGrad = shineCtx.createLinearGradient(0, 0, 0, BRICK_H);
shineGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
shineGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
shineCtx.fillStyle = shineGrad;
shineCtx.beginPath(); shineCtx.roundRect(0, 0, BRICK_W, BRICK_H, 3); shineCtx.fill();

const GLOW_COLORS = ['#0ff', '#ff003c', '#fff', '#00e5ff', '#39ff14', '#ffe600'];
GLOW_COLORS.forEach(c => {
  makeGlowTex(c, 24);
  makeGlowTex(c, 28);
});

function drawGlow(x, y, radius, color, alpha) {
  const tex = makeGlowTex(color, Math.round(radius));
  ctx.globalAlpha = alpha;
  ctx.drawImage(tex, x - radius, y - radius);
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.save();
  ctx.translate(game.shakeX, game.shakeY);
  ctx.fillStyle = '#05050a';
  ctx.fillRect(-10, -10, W + 20, H + 20);
  drawBackground(ctx);
  ctx.drawImage(gridCanvas, 0, 0);
  drawCreatures(ctx);
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  for (const b of game.bricks) {
    if (!b.alive) continue;
    ctx.fillStyle = b.color;
    ctx.roundRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6, 5);
  }
  ctx.globalAlpha = 0.15;
  for (const b of game.bricks) {
    if (!b.alive) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
  }
  for (const b of game.bricks) {
    if (!b.alive) continue;
    ctx.globalAlpha = b.hp < b.maxHp ? 0.55 : 1;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.drawImage(shineCanvas, b.x, b.y);
  }
  ctx.globalAlpha = 1;
  if (game.mode === 'boss') {
    drawBoss(ctx, drawGlow);
  }
  for (const p of game.powerups) {
    for (let i = 0; i < p.trail.length; i += 2) {
      const t = p.trail[i];
      const a = (i / p.trail.length) * 0.3;
      const s = POWERUP_SIZE * 0.35 * (i / p.trail.length);
      ctx.globalAlpha = a;
      if (p.type === 'prism') {
        p._hue = (p._hue || 0) + 2;
        ctx.fillStyle = 'hsl(' + (p._hue % 360) + ', 100%, 60%)';
      } else {
        ctx.fillStyle = p.color;
      }
      ctx.beginPath(); ctx.arc(t.x, t.y, s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (p.type === 'prism') {
      p._hue = (p._hue || 0) + 3;
      ctx.fillStyle = 'hsl(' + (p._hue % 360) + ', 100%, 60%)';
    } else {
      ctx.fillStyle = p.color;
    }
    ctx.beginPath(); ctx.arc(p.x, p.y, POWERUP_SIZE / 2 + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 11px Orbitron';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.symbol, p.x, p.y + 1);
  }
  for (const p of game.particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    const s = p.size * p.life;
    ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
  }
  ctx.globalAlpha = 1;
  if (game.shards) {
    for (const s of game.shards) {
      ctx.save();
      ctx.globalAlpha = s.life;
      ctx.fillStyle = s.color;
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.beginPath();
      for (let vi = 0; vi < s.vertices.length; vi++) {
        const v = s.vertices[vi];
        if (vi === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  const defaultBallColor = '#fff';
  const defaultBallGlow = '#0ff';
  for (const b of game.balls) {
    const bColor = b.color || defaultBallColor;
    const bGlow = b.color || defaultBallGlow;
    const fadeAlpha = b.fadeAlpha != null ? b.fadeAlpha : 1;
    for (let i = 0; i < b.trail.length; i += 2) {
      const t = b.trail[i];
      const a = (i / b.trail.length) * 0.3 * fadeAlpha;
      ctx.globalAlpha = a;
      ctx.fillStyle = bGlow;
      const s = b.r * 0.7 * (i / b.trail.length);
      ctx.fillRect(t.x - s, t.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = fadeAlpha;
    drawGlow(b.x, b.y, b.isPrism ? 16 : 24, bGlow, 0.5 * fadeAlpha);
    ctx.fillStyle = bColor;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const b of game.balls) {
    if (b.stuck) {
      drawGlow(b.x, b.y, 20, '#f0f', 0.4 + Math.sin(Date.now() * 0.01) * 0.2);
    }
  }
  const px = game.paddle.x - game.paddle.w / 2;
  const isWide = game.activePowers.wide && Date.now() < game.activePowers.wide;
  const padColor = isWide ? '#00e5ff' : '#fff';
  drawGlow(game.paddle.x, PADDLE_Y + PADDLE_H / 2, 28, padColor, 0.3);
  ctx.fillStyle = padColor;
  ctx.fillRect(px, PADDLE_Y, game.paddle.w, PADDLE_H);
  if (game.paddle.cooldownMax) {
    const remaining = Math.max(0, (game.paddle.cooldown || 0) - Date.now());
    const pct = 1 - remaining / game.paddle.cooldownMax;
    const ringColor = game.paddle.ability === 'pulse' ? '#0ff' : game.paddle.ability === 'magnet' ? '#f0f' : '#ff0';
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = remaining <= 0 ? 0.8 + Math.sin(Date.now() * 0.008) * 0.2 : 0.4;
    ctx.beginPath();
    ctx.arc(game.paddle.x, PADDLE_Y + PADDLE_H / 2, game.paddle.w / 2 + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }
  let ix = 10;
  for (const key of Object.keys(game.activePowers)) {
    const expiry = game.activePowers[key];
    const remaining = Math.max(0, expiry - Date.now());
    const pt = POWER_TYPES.find(p => p.type === key);
    const maxDur = pt ? pt.duration : 6000;
    const pct = remaining / maxDur;
    const pc = pt ? pt.color : '#fff';
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#111';
    ctx.fillRect(ix, H - 10, 80, 4);
    ctx.fillStyle = pc;
    ctx.fillRect(ix, H - 10, 80 * pct, 4);
    ctx.globalAlpha = 1;
    ix += 90;
  }
  ctx.restore();
  drawFlash(ctx);
  if (isCRTEnabled()) {
    applyCRT(cvs, ctx);
  }
  if (isShowingConstellation()) {
    drawConstellation(ctx, game.mouseX, game.mouseY * (H / cvs.getBoundingClientRect().height || 1));
  }
}

function showOverlay(title, sub, prompt, isFinalScore) {
  overlayTitle.textContent = title;
  overlaySub.textContent = sub;
  overlaySub.className = isFinalScore ? 'final-score' : '';
  overlayPrompt.textContent = prompt;
  overlay.classList.add('visible');
}

function hideOverlay() {
  overlay.classList.remove('visible');
}

// ═══════════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════════
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

let startGameCallback = null;

function setStartGameCallback(fn) {
  startGameCallback = fn;
}

cvs.addEventListener('mousemove', function(e) {
  const rect = cvs.getBoundingClientRect();
  game.mouseX = (e.clientX - rect.left) * (W / rect.width);
});

let touchStartTime = 0;
let lastTapTime = 0;

cvs.addEventListener('touchmove', function(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = cvs.getBoundingClientRect();
  game.mouseX = (touch.clientX - rect.left) * (W / rect.width);
}, { passive: false });

cvs.addEventListener('touchstart', function(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = cvs.getBoundingClientRect();
  game.mouseX = (touch.clientX - rect.left) * (W / rect.width);
  const now = Date.now();
  if (game.state === 'playing' && now - lastTapTime < 200) {
    activateAbility();
    lastTapTime = 0;
  } else {
    lastTapTime = now;
  }
  if (game.state === 'playing' && game.balls.some(b => b.stuck)) {
    releaseMagnetBall();
  }
  touchStartTime = now;
  if (game.state !== 'playing' && startGameCallback) startGameCallback();
}, { passive: false });

cvs.addEventListener('touchend', function(e) {
  touchStartTime = 0;
}, { passive: false });

overlay.addEventListener('touchstart', function(e) {
  e.preventDefault();
  if (game.state !== 'playing' && startGameCallback) startGameCallback();
}, { passive: false });

function handleClick() {
  if (game.state !== 'playing' && startGameCallback) startGameCallback();
  if (game.state === 'playing' && game.balls.some(b => b.stuck)) {
    releaseMagnetBall();
  }
}

cvs.addEventListener('click', handleClick);
overlay.addEventListener('click', handleClick);

cvs.addEventListener('contextmenu', function(e) { e.preventDefault(); });

document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });

document.addEventListener('keydown', function(e) {
  if (game.state !== 'playing' && (e.code === 'Space' || e.code === 'Enter') && startGameCallback) {
    e.preventDefault();
    startGameCallback();
    return;
  }
  if (e.code === 'KeyE') {
    if (game.state === 'playing') activateAbility();
  }
  if (e.code === 'KeyA') {
    toggleConstellation();
  }
  if (e.code === 'KeyC') {
    toggleCRT();
  }
  if (e.code === 'KeyM') {
    AudioEngine.toggleMute();
    updateMuteIcon();
  }
});


function updateMuteIcon() {
  const icon = document.getElementById('muteIcon');
  if (icon) {
    icon.textContent = AudioEngine.isMuted() ? '\uD83D\uDD07' : '\uD83D\uDD0A';
  }
}

const muteIcon = document.getElementById('muteIcon');
if (muteIcon) {
  muteIcon.addEventListener('click', function(e) {
    e.stopPropagation();
    AudioEngine.toggleMute();
    updateMuteIcon();
  });
}

if (isTouchDevice) {
  document.getElementById('overlayPrompt').textContent = 'TAP TO START';
}

// ═══════════════════════════════════════════════════════
// MAIN / GAME LOOP
// ═══════════════════════════════════════════════════════
function update() {
  if (game.state !== 'playing') return;
  const prevPaddleX = game.paddle.x;
  game.paddle.x += (game.mouseX - game.paddle.x) * 0.35;
  game.paddle.x = Math.max(game.paddle.w / 2, Math.min(W - game.paddle.w / 2, game.paddle.x));
  game.paddle.vx = game.paddle.x - prevPaddleX;
  if (game.activePowers.wide && Date.now() > game.activePowers.wide) {
    game.paddle.w = PADDLE_W; delete game.activePowers.wide;
  }
  if (game.activePowers.slow && Date.now() > game.activePowers.slow) delete game.activePowers.slow;
  if (game.comboTimer > 0) game.comboTimer--;
  else game.combo = 0;
  updateStuckBalls();
  game.paddle.ability = getAbilityForLevel(game.level);
  for (let i = game.balls.length - 1; i >= 0; i--) {
    const b = game.balls[i];
    if (b.expiry) {
      const remaining = b.expiry - Date.now();
      if (remaining <= 0) {
        game.balls.splice(i, 1);
        continue;
      }
      if (remaining < 1000) {
        b.fadeAlpha = remaining / 1000;
      }
    }
    if (b.stuck) continue;
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 12) b.trail.shift();
    b.x += b.vx;
    b.y += b.vy;
    if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
    if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }
    if (b.vy > 0 && b.y + b.r >= PADDLE_Y && b.y + b.r <= PADDLE_Y + PADDLE_H + 4) {
      const px1 = game.paddle.x - game.paddle.w / 2, px2 = game.paddle.x + game.paddle.w / 2;
      if (b.x >= px1 - b.r && b.x <= px2 + b.r) {
        const hit = (b.x - game.paddle.x) / (game.paddle.w / 2);
        const angle = -Math.PI / 2 + hit * (Math.PI / 3);
        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        b.y = PADDLE_Y - b.r;
        if (handleMagnetCatch(b)) {
          continue;
        }
        emitParticles(b.x, PADDLE_Y, '#fff', 5, 1, 1.5);
        triggerShake(1);
        AudioEngine.playPaddleHit();
      }
    }
    if (b.y - b.r > H) {
      game.balls.splice(i, 1);
      emitParticles(b.x, H, '#f44', 20, 2, 3);
      triggerShake(6);
      AudioEngine.playBallLoss();
      checkAchievements('ball_lost');
    }
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
  if (game.mode === 'boss') {
    updateBoss();
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
  if (game.mode !== 'boss' && game.bricks.every(b => !b.alive)) {
    game.level++;
    if (game.level % 3 === 0) {
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
  updateParticles();
  updateBackground(game.combo);
  updateCreatures();
  checkScreenshotTriggers();
  updateFlash();
  checkAchievements('power_count');
  updateShake();
  scoreEl.textContent = game.score;
  comboEl.textContent = game.combo > 1 ? 'x' + game.combo : 'x1';
  comboEl.style.textShadow = game.combo > 3 ? '0 0 ' + (game.combo * 4) + 'px #f0f' : '0 0 15px #f0f';
}

function loop(time) {
  game.lastTime = time;
  update();
  draw();
  requestAnimationFrame(loop);
}

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
  AudioEngine.init();
  AudioEngine.startBeat();
}

setStartGameCallback(startGame);
requestAnimationFrame(loop);

})();
