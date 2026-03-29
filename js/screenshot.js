import { W, H } from './config.js';
import { game } from './state.js';

// ─── AUTO SCREENSHOT MOMENTS ─────────────────────────

let captures = []; // last 5 blobs
let lastCaptureTime = 0;
let flashAlpha = 0;
let shareButtonTimer = 0;
let lastShareBlob = null;

const COOLDOWN = 10000; // 10 seconds between captures

export function checkScreenshotTriggers() {
  if (game.state !== 'playing') return;
  if (Date.now() - lastCaptureTime < COOLDOWN) return;

  // 10+ combo
  if (game.combo >= 10 && game.combo === 10) {
    captureHighlight('10X COMBO!');
    return;
  }

  // Boss defeated
  if (game._bossJustDefeated) {
    captureHighlight('BOSS DEFEATED');
    game._bossJustDefeated = false;
    return;
  }

  // 7+ active balls (prism frenzy)
  if (game.balls.length >= 7) {
    captureHighlight('PRISM FRENZY');
    return;
  }
}

export function captureHighlight(triggerLabel) {
  lastCaptureTime = Date.now();

  // Flash effect
  flashAlpha = 0.3;

  // Capture after current frame renders
  requestAnimationFrame(() => {
    const cvs = document.getElementById('gameCanvas');
    const offscreen = document.createElement('canvas');
    offscreen.width = W;
    offscreen.height = H;
    const octx = offscreen.getContext('2d');

    // Draw game frame
    octx.drawImage(cvs, 0, 0);

    // Overlay — semi-transparent darken
    octx.fillStyle = 'rgba(0,0,0,0.2)';
    octx.fillRect(0, 0, W, H);

    // Score + combo (top-left)
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

    // Level (top-right)
    octx.fillStyle = '#fff';
    octx.textAlign = 'right';
    octx.shadowColor = '#fff';
    octx.shadowBlur = 5;
    octx.fillText('LEVEL ' + game.level, W - 15, 30);

    // Trigger label (center, large)
    octx.font = '900 36px Orbitron';
    octx.textAlign = 'center';
    octx.fillStyle = '#ff0';
    octx.shadowColor = '#ff0';
    octx.shadowBlur = 30;
    octx.fillText(triggerLabel, W / 2, H / 2);
    octx.shadowBlur = 0;

    // Watermark (bottom-center)
    octx.font = '300 10px Rajdhani';
    octx.fillStyle = 'rgba(255,255,255,0.3)';
    octx.fillText('NEON BREAKOUT', W / 2, H - 10);

    // Store as blob
    offscreen.toBlob((blob) => {
      if (blob) {
        captures.push(blob);
        if (captures.length > 5) captures.shift();
        lastShareBlob = blob;
        showShareButton();
      }
    }, 'image/png');
  });
}

function showShareButton() {
  shareButtonTimer = Date.now() + 5000;
  const btn = document.getElementById('shareBtn');
  if (btn) {
    btn.style.display = 'block';
    btn.style.opacity = '1';
    setTimeout(() => {
      btn.style.opacity = '0';
      setTimeout(() => { btn.style.display = 'none'; }, 300);
    }, 4700);
  }
}

export function shareScreenshot() {
  if (!lastShareBlob) return;

  const file = new File([lastShareBlob], 'neon-breakout.png', { type: 'image/png' });

  // Mobile: native share
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'Neon Breakout' }).catch(() => {});
    return;
  }

  // Desktop: clipboard
  if (navigator.clipboard && navigator.clipboard.write) {
    navigator.clipboard.write([
      new ClipboardItem({ 'image/png': lastShareBlob })
    ]).then(() => {
      showToast('Screenshot copied!');
    }).catch(() => {
      downloadFallback();
    });
    return;
  }

  // Fallback: download
  downloadFallback();
}

function downloadFallback() {
  if (!lastShareBlob) return;
  const url = URL.createObjectURL(lastShareBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'neon-breakout.png';
  a.click();
  URL.revokeObjectURL(url);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 2000);
  }
}

export function updateFlash() {
  if (flashAlpha > 0) {
    flashAlpha *= 0.85;
    if (flashAlpha < 0.01) flashAlpha = 0;
  }
}

export function drawFlash(ctx) {
  if (flashAlpha > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + flashAlpha + ')';
    ctx.fillRect(0, 0, W, H);
  }
}
