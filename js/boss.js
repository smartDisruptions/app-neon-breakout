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

// Shield gap definitions — angular positions (in radians) and widths
function getShieldGaps(shapeName) {
  switch (shapeName) {
    case 'triangle':
      // 2 gaps, ~50 degrees each
      return [
        { angle: Math.PI * 0.5, width: 0.9 },
        { angle: Math.PI * 1.5, width: 0.9 },
      ];
    case 'hexagon':
      // 2 gaps, ~40 degrees each
      return [
        { angle: Math.PI * 0.25, width: 0.7 },
        { angle: Math.PI * 1.25, width: 0.7 },
      ];
    case 'eye':
      // 1 gap, ~50 degrees — harder
      return [
        { angle: Math.PI * 1.5, width: 0.9 },
      ];
    default:
      return [];
  }
}

function isInShieldGap(angle, boss) {
  const gaps = getShieldGaps(boss.shape);
  for (const gap of gaps) {
    const gapCenter = gap.angle + boss.rotation;
    // Normalize the difference to [-PI, PI]
    let diff = angle - gapCenter;
    diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    if (Math.abs(diff) < gap.width / 2) return true;
  }
  return false;
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

  // Bounce off wireframe shell (skip if ball is in a gap)
  if (Math.abs(dist - boss.radius) < ball.r + 3 && dist > 0) {
    const ballAngle = Math.atan2(dy, dx);
    if (!isInShieldGap(ballAngle, boss)) {
      const nx = dx / dist, ny = dy / dist;
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx -= 2 * dot * nx;
        ball.vy -= 2 * dot * ny;
      }
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

  // Wireframe shape with gaps
  ctx.strokeStyle = '#0ff';
  ctx.lineWidth = 1.5;
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.rotate(boss.rotation);
  const verts = boss.shapeDef.vertices(0, 0, boss.radius);
  const gaps = getShieldGaps(boss.shape);

  // Draw segments, skipping points that fall within gap angles
  // We sample each edge and break where gaps are
  ctx.beginPath();
  let penDown = false;
  const totalVerts = verts.length;
  for (let i = 0; i <= totalVerts; i++) {
    const v = verts[i % totalVerts];
    const angle = Math.atan2(v.y, v.x);
    let inGap = false;
    for (const gap of gaps) {
      let diff = angle - gap.angle;
      diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      if (Math.abs(diff) < gap.width / 2) { inGap = true; break; }
    }
    if (inGap) {
      penDown = false;
    } else {
      if (!penDown) { ctx.moveTo(v.x, v.y); penDown = true; }
      else ctx.lineTo(v.x, v.y);
    }
  }
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
