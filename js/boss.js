import { W, H, PADDLE_Y, PADDLE_H, POWERUP_SPEED } from './config.js';
import { game } from './state.js';
import { emitParticles } from './particles.js';
import { triggerShake } from './shake.js';
import AudioEngine from './audio.js';

// ─── SIMPLIFIED BOSS FIGHTS ─────────────────────────

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

export function createBoss(level) {
  const shapeName = getShapeForLevel(level);
  const shapeDef = SHAPES[shapeName];
  const cx = W / 2, cy = 120;
  let radius = 80;
  const hp = getBossHP(level);
  const moveSpeed = level <= 3 ? 1 : level <= 6 ? 1.3 : level <= 9 ? 1.6 : 2.0;
  // Final boss (level 12) is bigger
  if (level >= 12) { radius = 95; }
  const coreR = level >= 12 ? 22 : 18;

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

export function updateBoss() {
  const boss = game.boss;
  if (!boss || boss.defeated) return;
  boss.time++;
  boss.rotation += 0.005;

  // Simple side-to-side movement
  boss.x = boss.baseX + Math.sin(boss.time * 0.02 * boss.moveSpeed) * 150;
  boss.x = Math.max(boss.radius + 20, Math.min(W - boss.radius - 20, boss.x));
}

export function ballBossCollision(ball, boss) {
  if (!boss || boss.defeated) return;
  if (ball.stuck) return;

  // Check collision with core
  const dx = ball.x - boss.x;
  const dy = ball.y - boss.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < ball.r + boss.coreRadius) {
    // Bounce
    const nx = dx / dist, ny = dy / dist;
    const dot = ball.vx * nx + ball.vy * ny;
    ball.vx -= 2 * dot * nx;
    ball.vy -= 2 * dot * ny;

    // Damage
    boss.coreHP--;
    emitParticles(boss.x, boss.y, '#fff', 10, 2, 3);
    triggerShake(5);
    AudioEngine.playBrickHit(0);

    if (boss.coreHP <= 0) {
      defeatBoss(boss);
    }
    return;
  }

  // Bounce off wireframe shell
  if (Math.abs(dist - boss.radius) < ball.r + 3 && dist > 0) {
    const nx = dx / dist, ny = dy / dist;
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) {
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
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

// ─── BOSS RENDERING ──────────────────────────────────
export function drawBoss(ctx, drawGlow) {
  const boss = game.boss;
  if (!boss) return;

  ctx.save();

  // Wireframe shape
  ctx.strokeStyle = '#0ff';
  ctx.lineWidth = 1.5;
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

  // Core — pulsing glow
  const pulseAlpha = 0.5 + Math.sin(boss.time * 0.08) * 0.3;
  drawGlow(boss.x, boss.y, boss.coreRadius + 12, '#f44', pulseAlpha);
  drawGlow(boss.x, boss.y, boss.coreRadius + 24, '#f44', pulseAlpha * 0.3);

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
