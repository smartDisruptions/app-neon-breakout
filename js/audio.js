// ─── PROCEDURAL SYNTHWAVE AUDIO ──────────────────────
// Zero audio files — 100% Web Audio API

const AudioEngine = {
  ctx: null,
  master: null,
  muted: false,
  _beatStarted: false,
  _pulse: 0,
  _nextNoteTime: 0,
  _noteIndex: 0,
  _schedulerTimer: null,

  // Bass note sequence (C2, E2, G2, C3) — frequencies in Hz
  _bassNotes: [65.41, 82.41, 98.00, 130.81],

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master gain
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(this.ctx.destination);

    // Restore mute from localStorage
    const saved = localStorage.getItem('neonBreakout_muted');
    if (saved === 'true') {
      this.muted = true;
      this.master.gain.value = 0;
    }
  },

  startBeat() {
    if (this._beatStarted || !this.ctx) return;
    this._beatStarted = true;
    this._nextNoteTime = this.ctx.currentTime + 0.1;
    this._noteIndex = 0;
    this._scheduleBeat();
  },

  _scheduleBeat() {
    const lookahead = 0.1; // seconds to look ahead
    const scheduleInterval = 50; // ms between scheduler calls

    const schedule = () => {
      while (this._nextNoteTime < this.ctx.currentTime + lookahead) {
        this._playBassNote(this._bassNotes[this._noteIndex % 4], this._nextNoteTime);
        this._noteIndex++;
        this._nextNoteTime += 0.5; // 120 BPM = 0.5s per beat
      }
    };

    this._schedulerTimer = setInterval(schedule, scheduleInterval);
    schedule();
  },

  _playBassNote(freq, time) {
    if (!this.ctx) return;

    // Sawtooth bass
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    // Sub-bass sine
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = freq / 2;

    // Low-pass filter with LFO feel
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = 8;

    // Envelope for the bass
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.15, time);
    env.gain.exponentialRampToValueAtTime(0.08, time + 0.3);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.48);

    // Sub envelope
    const subEnv = this.ctx.createGain();
    subEnv.gain.setValueAtTime(0.12, time);
    subEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.master);

    sub.connect(subEnv);
    subEnv.connect(this.master);

    osc.start(time);
    osc.stop(time + 0.5);
    sub.start(time);
    sub.stop(time + 0.5);

    // Update pulse value for visual sync
    const pulseTime = time - this.ctx.currentTime;
    if (pulseTime >= 0 && pulseTime < 0.1) {
      this._pulse = 1.0;
    }
  },

  getPulse() {
    // Decay pulse smoothly
    this._pulse *= 0.92;
    return this._pulse;
  },

  playBrickHit(row) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Map row to frequency: top (row 0) = high, bottom (row 6) = low
    const freqs = [880, 740, 622, 523, 440, 370, 311];
    const freq = freqs[row % freqs.length];

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq * 3;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.12, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.master);

    osc.start(t);
    osc.stop(t + 0.15);
  },

  playPaddleHit() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 80;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.2, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(env);
    env.connect(this.master);

    osc.start(t);
    osc.stop(t + 0.1);
  },

  playBallLoss() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.5);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.2, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(env);
    env.connect(this.master);

    osc.start(t);
    osc.stop(t + 0.5);
  },

  playPowerUp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523, 659, 784]; // C5, E5, G5

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0, t + i * 0.05);
      env.gain.linearRampToValueAtTime(0.12, t + i * 0.05 + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.15);

      osc.connect(env);
      env.connect(this.master);

      osc.start(t + i * 0.05);
      osc.stop(t + i * 0.05 + 0.15);
    });
  },

  playLevelClear() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0, t + i * 0.08);
      env.gain.linearRampToValueAtTime(0.1, t + i * 0.08 + 0.03);
      env.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.3);

      osc.connect(env);
      env.connect(this.master);

      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.3);
    });
  },

  toggleMute() {
    if (!this.ctx) return;
    this.muted = !this.muted;
    this.master.gain.setValueAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime);
    localStorage.setItem('neonBreakout_muted', this.muted);
  },

  isMuted() {
    return this.muted;
  }
};

export default AudioEngine;
