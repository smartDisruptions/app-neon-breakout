import { W, H } from './config.js';

// ─── CRT POST-PROCESSING ────────────────────────────
let enabled = localStorage.getItem('neonBreakout_crt') === 'true';

// Create overlay canvas
const crtCanvas = document.createElement('canvas');
crtCanvas.width = W;
crtCanvas.height = H;
const crtCtx = crtCanvas.getContext('2d');

// Pre-render scanline pattern
const scanlineCanvas = document.createElement('canvas');
scanlineCanvas.width = W;
scanlineCanvas.height = H;
const scanCtx = scanlineCanvas.getContext('2d');
scanCtx.fillStyle = 'rgba(0,0,0,0.05)';
for (let y = 0; y < H; y += 2) {
  scanCtx.fillRect(0, y, W, 1);
}

export function isEnabled() { return enabled; }

export function toggle() {
  enabled = !enabled;
  localStorage.setItem('neonBreakout_crt', enabled);
}

export function applyCRT(sourceCanvas, targetCtx) {
  if (!enabled) return;

  // Chromatic aberration: draw source 3x with channel offsets
  crtCtx.clearRect(0, 0, W, H);

  // Red channel — shifted right
  crtCtx.globalCompositeOperation = 'source-over';
  crtCtx.drawImage(sourceCanvas, 2, 0);
  crtCtx.globalCompositeOperation = 'multiply';

  // Create a red mask
  crtCtx.fillStyle = 'rgb(255,0,0)';
  crtCtx.fillRect(0, 0, W, H);

  // Green channel — centered
  crtCtx.globalCompositeOperation = 'lighter';
  const greenCanvas = document.createElement('canvas');
  greenCanvas.width = W; greenCanvas.height = H;
  const greenCtx = greenCanvas.getContext('2d');
  greenCtx.drawImage(sourceCanvas, 0, 0);
  greenCtx.globalCompositeOperation = 'multiply';
  greenCtx.fillStyle = 'rgb(0,255,0)';
  greenCtx.fillRect(0, 0, W, H);
  crtCtx.drawImage(greenCanvas, 0, 0);

  // Blue channel — shifted left
  const blueCanvas = document.createElement('canvas');
  blueCanvas.width = W; blueCanvas.height = H;
  const blueCtx = blueCanvas.getContext('2d');
  blueCtx.drawImage(sourceCanvas, -2, 0);
  blueCtx.globalCompositeOperation = 'multiply';
  blueCtx.fillStyle = 'rgb(0,0,255)';
  blueCtx.fillRect(0, 0, W, H);
  crtCtx.drawImage(blueCanvas, 0, 0);

  // Apply to target
  targetCtx.save();
  targetCtx.globalAlpha = 1;
  targetCtx.globalCompositeOperation = 'source-over';
  targetCtx.drawImage(crtCanvas, 0, 0);

  // Scanlines
  targetCtx.globalAlpha = 1;
  targetCtx.drawImage(scanlineCanvas, 0, 0);

  // Vignette
  const vigGrad = targetCtx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
  vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vigGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
  targetCtx.fillStyle = vigGrad;
  targetCtx.fillRect(0, 0, W, H);

  targetCtx.restore();
}
