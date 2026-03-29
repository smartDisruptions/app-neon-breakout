import { W } from './config.js';
import { game } from './state.js';
import { cvs, overlay } from './renderer.js';
import AudioEngine from './audio.js';
import { activateAbility, releaseMagnetBall } from './paddle.js';
import { toggle as toggleCRT } from './crt.js';
import { toggleConstellation } from './achievements.js';

// ─── INPUT ───────────────────────────────────────────
export const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

let startGameCallback = null;

export function setStartGameCallback(fn) {
  startGameCallback = fn;
}

// ─── MOUSE ───────────────────────────────────────────
cvs.addEventListener('mousemove', function(e) {
  const rect = cvs.getBoundingClientRect();
  game.mouseX = (e.clientX - rect.left) * (W / rect.width);
});

// ─── TOUCH ───────────────────────────────────────────
let touchStartTime = 0;
let lastTapTime = 0;

cvs.addEventListener('touchmove', function(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = cvs.getBoundingClientRect();
  game.mouseX = (touch.clientX - rect.left) * (W / rect.width);

}, { passive: false });

cvs.addEventListener('touchstart', function(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = cvs.getBoundingClientRect();
  game.mouseX = (touch.clientX - rect.left) * (W / rect.width);

  const now = Date.now();

  // Double-tap detection (<200ms) for ability activation
  if (game.state === 'playing' && now - lastTapTime < 200) {
    activateAbility();
    lastTapTime = 0;
  } else {
    lastTapTime = now;
  }

  // Release magnet ball on tap
  if (game.state === 'playing' && game.balls.some(b => b.stuck)) {
    releaseMagnetBall();
  }

  touchStartTime = now;
  if (game.state !== 'playing' && startGameCallback) startGameCallback();
}, { passive: false });

cvs.addEventListener('touchend', function(e) {
  touchStartTime = 0;
}, { passive: false });

overlay.addEventListener('touchstart', function(e) {
  e.preventDefault();
  if (game.state !== 'playing' && startGameCallback) startGameCallback();
}, { passive: false });

function handleClick() {
  if (game.state !== 'playing' && startGameCallback) startGameCallback();
  // Release magnet ball on click
  if (game.state === 'playing' && game.balls.some(b => b.stuck)) {
    releaseMagnetBall();
  }
}

// Double-tap detection for mobile ability activation

cvs.addEventListener('click', handleClick);
overlay.addEventListener('click', handleClick);

cvs.addEventListener('contextmenu', function(e) { e.preventDefault(); });

// Prevent pull-to-refresh and bounce scrolling
document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });

// ─── KEYBOARD ────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  // Start game from title/dead screen
  if (game.state !== 'playing' && (e.code === 'Space' || e.code === 'Enter') && startGameCallback) {
    e.preventDefault();
    startGameCallback();
    return;
  }
  // Ability activation: E key
  if (e.code === 'KeyE') {
    if (game.state === 'playing') activateAbility();
  }
  // Achievements: A key
  if (e.code === 'KeyA') {
    toggleConstellation();
  }
  // CRT toggle: C
  if (e.code === 'KeyC') {
    toggleCRT();
  }
  // Mute toggle: M
  if (e.code === 'KeyM') {
    AudioEngine.toggleMute();
    updateMuteIcon();
  }
});


// ─── MUTE ICON ──────────────────────────────────────
function updateMuteIcon() {
  const icon = document.getElementById('muteIcon');
  if (icon) {
    icon.textContent = AudioEngine.isMuted() ? '🔇' : '🔊';
  }
}

// Mute icon click
const muteIcon = document.getElementById('muteIcon');
if (muteIcon) {
  muteIcon.addEventListener('click', function(e) {
    e.stopPropagation();
    AudioEngine.toggleMute();
    updateMuteIcon();
  });
}

// Set prompt text based on device
if (isTouchDevice) {
  document.getElementById('overlayPrompt').textContent = 'TAP TO START';
}
