import { W, H } from './config.js';
import AudioEngine from './audio.js';
import { game } from './state.js';

// ─── SYNTHWAVE HORIZON BACKGROUND ────────────────────
const horizonCanvas = document.createElement('canvas');
horizonCanvas.width = W;
horizonCanvas.height = H;
const hCtx = horizonCanvas.getContext('2d');

const HORIZON_Y = H * 0.65;
const SUN_RADIUS = 50;
let gridOffset = 0;
let frameCount = 0;

export function updateBackground(combo) {
  frameCount++;
  // Update every 2 frames for performance
  if (frameCount % 2 !== 0) return;

  const pulse = AudioEngine.getPulse ? AudioEngine.getPulse() : 0;

  // Grid speed based on combo
  let speed = 0.5;
  if (combo >= 15) speed = 2.0;
  else if (combo >= 10) speed = 1.5;
  else if (combo >= 5) speed = 1.0;

  gridOffset = (gridOffset + speed) % 40;

  hCtx.clearRect(0, 0, W, H);

  // Sky gradient
  const skyGrad = hCtx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, '#05050a');
  skyGrad.addColorStop(0.5, '#0a0015');
  skyGrad.addColorStop(0.65, '#1a0030');
  skyGrad.addColorStop(1, '#0a0015');
  hCtx.fillStyle = skyGrad;
  hCtx.fillRect(0, 0, W, H);

  // Sun
  const sunBright = combo >= 10 ? 0.7 + pulse * 0.3 : combo >= 5 ? 0.5 : 0.3;
  hCtx.save();
  hCtx.globalAlpha = sunBright;

  const sunGrad = hCtx.createRadialGradient(W / 2, HORIZON_Y, 0, W / 2, HORIZON_Y, SUN_RADIUS);
  sunGrad.addColorStop(0, '#ff0');
  sunGrad.addColorStop(0.4, '#f0f');
  sunGrad.addColorStop(1, 'rgba(255,0,255,0)');

  // Clip to top half of sun (above horizon)
  hCtx.beginPath();
  hCtx.rect(0, 0, W, HORIZON_Y);
  hCtx.clip();

  hCtx.fillStyle = sunGrad;
  hCtx.beginPath();
  hCtx.arc(W / 2, HORIZON_Y, SUN_RADIUS, 0, Math.PI * 2);
  hCtx.fill();

  // Sun glow
  hCtx.shadowColor = '#f0f';
  hCtx.shadowBlur = 40 + pulse * 20;
  hCtx.fill();

  hCtx.restore();

  // Horizon line
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

  // Perspective grid — horizontal lines
  hCtx.strokeStyle = '#f0f';
  hCtx.lineWidth = 0.5;
  const numHLines = 12;
  for (let i = 0; i < numHLines; i++) {
    const t = (i + gridOffset / 40) / numHLines;
    const y = HORIZON_Y + t * t * (H - HORIZON_Y); // quadratic spacing for perspective
    const alpha = 0.05 + t * 0.15;
    hCtx.globalAlpha = alpha;
    hCtx.beginPath();
    hCtx.moveTo(0, y);
    hCtx.lineTo(W, y);
    hCtx.stroke();
  }

  // Perspective grid — vertical lines converging to center
  const numVLines = 14;
  for (let i = 0; i <= numVLines; i++) {
    const xBottom = (i / numVLines) * W;
    const xTop = W / 2 + (xBottom - W / 2) * 0.05; // converge toward center
    hCtx.globalAlpha = 0.08;
    hCtx.beginPath();
    hCtx.moveTo(xTop, HORIZON_Y);
    hCtx.lineTo(xBottom, H);
    hCtx.stroke();
  }

  hCtx.globalAlpha = 1;
  hCtx.shadowBlur = 0;
}

export function drawBackground(ctx) {
  ctx.drawImage(horizonCanvas, 0, 0);
}

// ─── LIVING NEON ECOSYSTEM ──────────────────────────
const CREATURE_TYPES = [
  { shape: 'triangle', color: '#0ff' },
  { shape: 'circle', color: '#f0f' },
  { shape: 'hexagon', color: '#0f0' },
  { shape: 'jellyfish', color: '#ff0' },
];

let creatures = [];

export function initCreatures() {
  creatures = [];
  const count = 8 + Math.floor(Math.random() * 5); // 8-12
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
      phase: Math.random() * Math.PI * 2, // for animation
    });
  }
}

export function updateCreatures() {
  const pulse = AudioEngine.getPulse ? AudioEngine.getPulse() : 0;

  for (const c of creatures) {
    c.phase += 0.02;

    // Boids separation
    for (const other of creatures) {
      if (other === c) continue;
      const dx = c.x - other.x, dy = c.y - other.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 40 && dist > 0) {
        c.vx += (dx / dist) * 0.02;
        c.vy += (dy / dist) * 0.02;
      }
    }

    // Flee from balls
    for (const ball of game.balls) {
      const dx = c.x - ball.x, dy = c.y - ball.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 80 && dist > 0) {
        c.vx += (dx / dist) * 0.08;
        c.vy += (dy / dist) * 0.08;
      }
    }

    // Combo attraction
    if (game.combo > 0) {
      const tx = W / 2, ty = 30; // combo text area
      const dx = tx - c.x, dy = ty - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        c.vx += (dx / dist) * 0.01;
        c.vy += (dy / dist) * 0.01;
      }
    }

    // Boss scatter
    if (game.mode === 'boss') {
      const edgeX = c.x < W / 2 ? 0 : W;
      c.vx += (edgeX - c.x) * 0.001;
    }

    // Damping
    c.vx *= 0.98;
    c.vy *= 0.98;

    // Gentle drift
    c.vx += (Math.random() - 0.5) * 0.01;
    c.vy += (Math.random() - 0.5) * 0.01;

    // Speed limit
    const speed = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
    if (speed > 1.5) {
      c.vx = (c.vx / speed) * 1.5;
      c.vy = (c.vy / speed) * 1.5;
    }

    c.x += c.vx;
    c.y += c.vy;

    // Wraparound
    if (c.x < -20) c.x = W + 20;
    if (c.x > W + 20) c.x = -20;
    if (c.y < -20) c.y = H + 20;
    if (c.y > H + 20) c.y = -20;
  }
}

export function drawCreatures(ctx) {
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
        // Inner glow
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
        // Bell
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size, Math.PI, 0);
        ctx.stroke();
        // Tendrils
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
