import { MAX_PARTICLES, W, H } from './config.js';
import { game } from './state.js';

// ─── PARTICLES ───────────────────────────────────────
export function emitParticles(x, y, color, count, spread, speed) {
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

export function updateParticles() {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.04; p.vx *= 0.99;
    p.life -= p.decay;
    if (p.life <= 0) game.particles.splice(i, 1);
  }

  // Update shards
  for (let i = game.shards.length - 1; i >= 0; i--) {
    const s = game.shards[i];
    s.x += s.vx;
    s.y += s.vy;
    s.vy += 0.08; // gravity
    s.vx *= 0.98; // air resistance
    s.rotation += s.angularVel;
    s.life -= 0.015;

    // Wall bounce
    if (s.x < 0 || s.x > W) s.vx = -s.vx * 0.6;
    if (s.y > H) s.vy = -s.vy * 0.4;

    // High combo ember trail
    if (game.combo > 5 && s.life > 0.3 && Math.random() < 0.3) {
      emitParticles(s.x, s.y, s.color, 1, 0.3, 0.5);
    }

    if (s.life <= 0) game.shards.splice(i, 1);
  }
}

// ─── BRICK SHATTER ───────────────────────────────────
// Initialize shards array on game state
if (!game.shards) game.shards = [];

export function emitShards(x, y, w, h, color) {
  const count = 3 + Math.floor(Math.random() * 3); // 3-5 shards
  for (let i = 0; i < count; i++) {
    // Generate random triangle vertices relative to center
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
      vy: Math.sin(angle) * speed - 2, // upward bias
      rotation: Math.random() * Math.PI * 2,
      angularVel: (Math.random() - 0.5) * 0.2,
      vertices,
      life: 1,
      color,
    });
  }
}
