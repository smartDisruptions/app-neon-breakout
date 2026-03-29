import { W, H } from './config.js';
import { game } from './state.js';

// ─── ACHIEVEMENT CONSTELLATION ───────────────────────

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

// Adjacency for constellation lines
const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
  [5, 6], [6, 7], [7, 8], [8, 9], [9, 10],
  [10, 0], [1, 15], [15, 7], [3, 15],
  [11, 8], [11, 12], [12, 13], [13, 14], [14, 5],
];

let earned = {};
let showingConstellation = false;
let hoveredStar = -1;

// Stats tracked during game
let sessionStats = {
  bricksDestroyed: 0,
  bossesDefeated: 0,
  livesLostThisLevel: 0,
  levelStartTime: 0,
  prismBricksThisActivation: 0,
  curveBricksThisShot: 0,
  pulseBricksThisUse: 0,
};

export function initAchievements() {
  const saved = localStorage.getItem('neonBreakout_achievements');
  if (saved) {
    try { earned = JSON.parse(saved); } catch (e) { earned = {}; }
  }
}

export function resetSessionStats() {
  sessionStats.bricksDestroyed = 0;
  sessionStats.livesLostThisLevel = 0;
  sessionStats.levelStartTime = Date.now();
  sessionStats.prismBricksThisActivation = 0;
  sessionStats.curveBricksThisShot = 0;
  sessionStats.pulseBricksThisUse = 0;
}

function save() {
  localStorage.setItem('neonBreakout_achievements', JSON.stringify(earned));
}

function earn(id) {
  if (earned[id]) return;
  earned[id] = { earned: true, date: Date.now() };
  save();
  // Flash notification could go here
}

export function checkAchievements(event, data) {
  switch (event) {
    case 'brick_destroy':
      sessionStats.bricksDestroyed++;
      if (!earned.first_blood) earn('first_blood');
      if (sessionStats.bricksDestroyed >= 100) earn('centurion');
      break;

    case 'combo':
      if (game.combo >= 15) earn('combo_hunter');
      if (game.combo >= 30) earn('combo_legend');
      break;

    case 'level_clear':
      if (sessionStats.livesLostThisLevel === 0) earn('untouchable');
      const elapsed = (Date.now() - sessionStats.levelStartTime) / 1000;
      if (elapsed < 15) earn('speed_demon');
      sessionStats.livesLostThisLevel = 0;
      sessionStats.levelStartTime = Date.now();
      if (game.level >= 10) earn('survivor');
      if (game.level >= 20) earn('marathon');
      break;

    case 'ball_lost':
      sessionStats.livesLostThisLevel++;
      break;

    case 'boss_defeated':
      sessionStats.bossesDefeated++;
      earn('sentinel_slayer');
      if (sessionStats.bossesDefeated >= 3) earn('sentinel_master');
      if (sessionStats.livesLostThisLevel === 0) earn('boss_rush');
      break;

    case 'score':
      if (game.score >= 5000) earn('perfectionist');
      break;

    case 'power_count':
      if (Object.keys(game.activePowers).length >= 3) earn('power_surge');
      break;

    case 'pulse_bricks':
      if (data >= 5) earn('pulse_destroyer');
      break;
  }
}

export function isShowingConstellation() {
  return showingConstellation;
}

export function toggleConstellation() {
  showingConstellation = !showingConstellation;
}

export function drawConstellation(ctx, mouseX, mouseY) {
  if (!showingConstellation) return;

  // Dark overlay
  ctx.fillStyle = 'rgba(5,5,10,0.92)';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.font = '900 28px Orbitron';
  ctx.fillStyle = '#0ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#0ff';
  ctx.shadowBlur = 20;
  ctx.fillText('ACHIEVEMENTS', W / 2, 40);
  ctx.shadowBlur = 0;

  // Count
  const earnedCount = Object.keys(earned).length;
  ctx.font = '300 14px Rajdhani';
  ctx.fillStyle = '#888';
  ctx.fillText(earnedCount + ' / ' + ACHIEVEMENTS.length, W / 2, 65);

  // Connection lines
  ctx.lineWidth = 1;
  for (const [a, b] of CONNECTIONS) {
    const sa = ACHIEVEMENTS[a], sb = ACHIEVEMENTS[b];
    const aEarned = !!earned[sa.id], bEarned = !!earned[sb.id];
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

  // Stars
  hoveredStar = -1;
  for (let i = 0; i < ACHIEVEMENTS.length; i++) {
    const a = ACHIEVEMENTS[i];
    const isEarned = !!earned[a.id];

    // Check hover
    const dx = mouseX - a.starX, dy = mouseY - a.starY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 20) hoveredStar = i;

    if (isEarned) {
      // Bright star
      ctx.fillStyle = a.color;
      ctx.shadowColor = a.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(a.starX, a.starY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      // Dim outline
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(a.starX, a.starY, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Tooltip
  if (hoveredStar >= 0) {
    const a = ACHIEVEMENTS[hoveredStar];
    const isEarned = !!earned[a.id];

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

    if (isEarned && earned[a.id].date) {
      ctx.font = '300 9px Rajdhani';
      ctx.fillStyle = '#666';
      const d = new Date(earned[a.id].date);
      ctx.fillText('Earned ' + d.toLocaleDateString(), tooltipX + 8, tooltipY + 45);
    }
  }

  // Instructions
  ctx.font = '300 12px Rajdhani';
  ctx.fillStyle = '#555';
  ctx.textAlign = 'center';
  ctx.fillText('Press A to close', W / 2, H - 20);
}
