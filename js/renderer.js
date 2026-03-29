import { W, H, BRICK_W, BRICK_H, PADDLE_Y, PADDLE_H, POWERUP_SIZE } from './config.js';
import { game } from './state.js';
import { POWER_TYPES } from './powerups.js';
import { drawBackground, drawCreatures } from './background.js';
import { applyCRT, isEnabled as isCRTEnabled } from './crt.js';
import { drawBoss } from './boss.js';
import { drawConstellation, isShowingConstellation } from './achievements.js';
import { drawFlash } from './screenshot.js';

// ─── CANVAS REFS ─────────────────────────────────────
export const cvs = document.getElementById('gameCanvas');
export const ctx = cvs.getContext('2d');
export const scoreEl = document.getElementById('scoreVal');
export const comboEl = document.getElementById('comboVal');
export const livesEl = document.getElementById('livesVal');
export const overlay = document.getElementById('overlay');
export const overlayTitle = document.getElementById('overlayTitle');
export const overlaySub = document.getElementById('overlaySub');
export const overlayPrompt = document.getElementById('overlayPrompt');

// ─── PRE-RENDERED GLOW TEXTURES ──────────────────────
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

// Pre-render grid to offscreen canvas
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

// Pre-render brick shine gradient
const shineCanvas = document.createElement('canvas');
shineCanvas.width = BRICK_W; shineCanvas.height = BRICK_H;
const shineCtx = shineCanvas.getContext('2d');
const shineGrad = shineCtx.createLinearGradient(0, 0, 0, BRICK_H);
shineGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
shineGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
shineCtx.fillStyle = shineGrad;
shineCtx.beginPath(); shineCtx.roundRect(0, 0, BRICK_W, BRICK_H, 3); shineCtx.fill();

// Pre-build glow textures for known colors
const GLOW_COLORS = ['#0ff', '#ff003c', '#fff', '#00e5ff', '#39ff14', '#ffe600'];
GLOW_COLORS.forEach(c => {
  makeGlowTex(c, 24);
  makeGlowTex(c, 28);
});

export function drawGlow(x, y, radius, color, alpha) {
  const tex = makeGlowTex(color, Math.round(radius));
  ctx.globalAlpha = alpha;
  ctx.drawImage(tex, x - radius, y - radius);
  ctx.globalAlpha = 1;
}

// ─── DRAW ────────────────────────────────────────────
export function draw() {
  ctx.save();
  ctx.translate(game.shakeX, game.shakeY);

  // BG — synthwave horizon
  ctx.fillStyle = '#05050a';
  ctx.fillRect(-10, -10, W + 20, H + 20);
  drawBackground(ctx);

  // Grid (pre-rendered)
  ctx.drawImage(gridCanvas, 0, 0);

  // Living neon creatures (behind game layer)
  drawCreatures(ctx);

  // Bricks — glow layer
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

  // Bricks — solid layer + shine
  for (const b of game.bricks) {
    if (!b.alive) continue;
    ctx.globalAlpha = b.hp < b.maxHp ? 0.55 : 1;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.drawImage(shineCanvas, b.x, b.y);
  }
  ctx.globalAlpha = 1;

  // Boss (when in boss mode)
  if (game.mode === 'boss') {
    drawBoss(ctx, drawGlow);
  }

  // Powerup trails & powerups
  for (const p of game.powerups) {
    for (let i = 0; i < p.trail.length; i += 2) {
      const t = p.trail[i];
      const a = (i / p.trail.length) * 0.3;
      const s = POWERUP_SIZE * 0.35 * (i / p.trail.length);
      ctx.globalAlpha = a;
      // Prism: cycle hue for rainbow effect
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

  // Particles
  for (const p of game.particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    const s = p.size * p.life;
    ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
  }
  ctx.globalAlpha = 1;

  // Shards (brick shatter)
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

  // Ball trails & balls
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

  // Magnet stuck indicator
  for (const b of game.balls) {
    if (b.stuck) {
      drawGlow(b.x, b.y, 20, '#f0f', 0.4 + Math.sin(Date.now() * 0.01) * 0.2);
    }
  }

  // Paddle
  const px = game.paddle.x - game.paddle.w / 2;
  const isWide = game.activePowers.wide && Date.now() < game.activePowers.wide;
  const padColor = isWide ? '#00e5ff' : '#fff';

  drawGlow(game.paddle.x, PADDLE_Y + PADDLE_H / 2, 28, padColor, 0.3);

  ctx.fillStyle = padColor;
  ctx.fillRect(px, PADDLE_Y, game.paddle.w, PADDLE_H);

  // Ability cooldown ring
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

  // Active power bars
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

  // Screenshot flash
  drawFlash(ctx);

  // CRT post-processing (after restore, applied to full canvas)
  if (isCRTEnabled()) {
    applyCRT(cvs, ctx);
  }

  // Achievement constellation overlay
  if (isShowingConstellation()) {
    drawConstellation(ctx, game.mouseX, game.mouseY * (H / cvs.getBoundingClientRect().height || 1));
  }
}

// ─── OVERLAY ─────────────────────────────────────────
export function showOverlay(title, sub, prompt, isFinalScore) {
  overlayTitle.textContent = title;
  overlaySub.textContent = sub;
  overlaySub.className = isFinalScore ? 'final-score' : '';
  overlayPrompt.textContent = prompt;
  overlay.classList.add('visible');
}

export function hideOverlay() {
  overlay.classList.remove('visible');
}
