import { W, BRICK_ROWS, BRICK_COLS, BRICK_W, BRICK_H, BRICK_PAD, BRICK_TOP, hslRow } from './config.js';
import { game } from './state.js';

// ─── BRICK SETUP ─────────────────────────────────────
export function buildBricks() {
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
