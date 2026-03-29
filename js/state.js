import { W, PADDLE_W } from './config.js';

// ─── SHARED GAME STATE ──────────────────────────────
export const game = {
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
