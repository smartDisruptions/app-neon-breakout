// ─── CONFIG ──────────────────────────────────────────
export const W = 800, H = 560;
export const BRICK_ROWS = 7, BRICK_COLS = 12;
export const BRICK_W = 58, BRICK_H = 18, BRICK_PAD = 6, BRICK_TOP = 40;
export const PADDLE_W = 110, PADDLE_H = 14, PADDLE_Y = H - 40;
export const BALL_R = 6;
export const POWERUP_SIZE = 18, POWERUP_SPEED = 2.8;
export const MAX_PARTICLES = 200;

// ─── NEON PALETTE ────────────────────────────────────
const HUES = [340, 20, 50, 140, 185, 260, 300];
export function hslRow(row) {
  return 'hsl(' + HUES[row % HUES.length] + ', 100%, 60%)';
}
