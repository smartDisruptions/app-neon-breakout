# Neon Breakout: Ultimate Edition — Design Spec

## Context

Neon Breakout is a brick-breaker arcade game built in vanilla JS with HTML5 Canvas (~730 lines, single `index.html` file). It has a polished neon/synthwave aesthetic with particle effects, screen shake, ball trails, combo scoring, 4 power-ups, and full mobile support. The game currently lacks audio, progression, level variety, and sharing mechanics. This spec designs 10 features to transform it into a standout experience that is instantly fun for casual players, rewards mastery for arcade fans, and visually impresses anyone who sees it.

**Source file:** `/Users/joshadmin/Documents/src/app-neon-breakout/index.html`

---

## Feature 1: Curve Shot Mechanic

**Category:** Gameplay
**Purpose:** Transform breakout from "launch and pray" to "launch and steer." Massively raises the skill ceiling.

### Behavior
- **Input:** Hold spacebar (desktop) or touch-hold (mobile) while the ball is in flight.
- **Effect:** A lateral force is applied to `ball.vx` in the direction the paddle is currently moving. Force is proportional to paddle velocity. Stationary paddle = no curve.
- **Max deflection:** ~15 degrees over the ball's full travel distance.
- **Visual feedback:** A faint curved laser-sight line projects from the ball showing the bent trajectory while input is held. Uses the ball's glow color at ~20% opacity. The line is a simple projection loop (simulate N frames of ball movement with the current force applied, draw dots along the path).
- **Multi-ball:** Curve applies to ALL active balls simultaneously.

### Integration Points
- Modify `update()` ball physics loop (lines ~349-461) to apply lateral force when input is held.
- Track paddle velocity (delta X between frames) — store `paddle.prevX` and compute `paddle.vx` each frame.
- Add trajectory preview rendering in `draw()`.

---

## Feature 2: Paddle Abilities (Cooldown-Based)

**Category:** Gameplay
**Purpose:** Give the player periodic bursts of power that create dramatic moments and decision-making.

### Abilities
Three abilities rotate by level range:

| Ability | Levels | Effect | Visual |
|---------|--------|--------|--------|
| **Pulse** | 1-5 | Shockwave blasts upward from paddle in a cone (~60° spread, ~200px range), dealing 1 damage to all bricks in range | Expanding cyan arc with particle burst |
| **Magnet** | 6-10 | Next ball-paddle contact causes ball to stick. Player aims with paddle position + curve shot, releases on click/tap | Ball glows magenta while stuck, aim guide line shown |
| **Phase Shift** | 11+ | Paddle instantly teleports to the ball's current X position | Neon streak trail from old to new position, brief afterimage |

### Mechanics
- **Activation:** 'E' key (desktop) or double-tap (mobile). Double-tap recognized only if taps are <200ms apart. Curve Shot touch-hold requires >300ms hold — no gesture conflict.
- **Cooldown:** 10 seconds. Neon ring around paddle fills clockwise as it charges. Glows bright + brief pulse animation when ready.
- **Boss fights:** Boss drops a free Magnet power-up at each phase transition, regardless of which ability is currently active.

### Integration Points
- Add `paddle.ability`, `paddle.cooldown`, `paddle.cooldownMax` to state.
- Add ability activation handler in input section (lines ~684-731).
- Pulse: iterate bricks, check cone geometry, apply damage.
- Magnet: add `ball.stuck` state, modify ball update to follow paddle when stuck, release on click.
- Phase Shift: set `paddle.x = ball.x` with trail particle emitter.

---

## Feature 3: Prism Spectrum Split (New Power-Up)

**Category:** Gameplay
**Purpose:** Create the most visually spectacular moments in the game. Synergizes with Auto Screenshot.

### Behavior
- **Drop rate:** ~8% per destroyed brick (compared to 18% for existing power-ups). Rare and exciting.
- **Icon:** Rainbow diamond, cycling hue on the `symbol` character.
- **Effect:** Main ball splits into 7 smaller balls (radius: 4px vs normal 6px), one per brick row color matching the existing `hslRow()` palette (red, orange, yellow, green, cyan, violet, magenta).
- **Color-match bonus:** A colored ball hitting a brick of its matching row color = instant kill regardless of HP. Matched kills guarantee a power-up drop from the existing pool.
- **Duration:** 8 seconds. Mini-balls fade out (shrink + reduce opacity over final 1 second). Main ball continues normally.
- **Trails:** Each mini-ball has a trail in its own color. 7 colored trails = rainbow fireworks.

### Integration Points
- Add to the `powerTypes` array (lines ~265-280).
- Extend `spawnBall()` to accept a color parameter.
- Modify `ballBrickCollision()` to check color match and apply instant kill + guaranteed drop.
- Mini-balls use existing multi-ball infrastructure but with a `ball.color` property and `ball.expiry` timestamp.

---

## Feature 4: Procedural Synthwave Audio

**Category:** Visual Spectacle
**Purpose:** Fill the single biggest gap in the current game. Audio transforms the experience.

### Soundtrack
- Built entirely with Web Audio API — zero audio files, zero load time.
- Looping synthwave bassline: 2 OscillatorNodes (sawtooth wave + sub-bass sine) through a BiquadFilter (low-pass) with an LFO modulating the filter cutoff.
- Tempo: ~120 BPM. 4-bar loop with a simple note sequence (e.g., C2-E2-G2-C3 quarter notes).
- **Global pulse:** The bass amplitude drives a `globalPulse` value (0.0-1.0) that modulates glow radius on all neon elements. Everything breathes with the beat.

### Sound Effects
| Event | Sound | Implementation |
|-------|-------|----------------|
| Brick hit | Pitched synth note based on row (top = high, bottom = low) | OscillatorNode, frequency mapped from row index, short ADSR envelope via GainNode |
| Combo build | Reverb depth + distortion increase with combo count | ConvolverNode wet/dry mix and WaveShaperNode curve tied to `combo` |
| Paddle contact | Low-frequency thud | Short sine oscillator at ~80Hz with fast decay |
| Ball loss | Descending pitch sweep | Oscillator with frequency ramp from 400Hz to 80Hz over 0.5s |
| Power-up collect | Rising 3-note arpeggio | 3 oscillators triggered in sequence, 50ms apart, ascending pitch |
| Boss phase transition | Deep reverb boom + ascending shimmer | Noise burst through bandpass filter + high sine sweep |

### Controls
- Audio starts on first user click/tap (respects browser autoplay policy).
- Mute toggle: 'M' key or small speaker icon in HUD top-right corner.
- Mute state saved to localStorage.

### Architecture
- Create an `AudioEngine` object/module managing the AudioContext, master gain, and all nodes.
- `AudioEngine.startBeat()` — begins the bassline loop.
- `AudioEngine.playHit(row)` — triggers brick hit sound.
- `AudioEngine.setPulse()` — returns current beat pulse value for visual sync.
- Initialize AudioContext on first user gesture.

---

## Feature 5: Synthwave Horizon Background

**Category:** Visual Spectacle
**Purpose:** Transform the visual identity from "dark background" to "inside the synthwave."

### Rendering
- **Offscreen canvas:** Pre-rendered to a separate canvas, composited behind the game layer. Updated every 2 frames (30fps effective).
- **Elements:**
  - Perspective grid: Horizontal lines with decreasing Y-spacing toward a horizon point at ~65% canvas height. Vertical lines converging to the center. Magenta/purple color at low opacity.
  - Neon sun: Half-circle at the horizon, gradient from magenta to yellow, with a soft glow (shadowBlur).
  - Grid scrolls toward the camera by shifting the Y offset of horizontal lines each frame.

### Combo Reactivity
| Combo | Grid Speed | Sun | Extra |
|-------|-----------|-----|-------|
| 0 | Slow drift | Dim, steady | — |
| 5+ | 2x speed | Brightens | — |
| 10+ | 3x speed | Pulses with beat | Faint scanline ripple across horizon |
| 15+ | 4x speed | Full glow, color shifts | Horizon line flickers |

### Integration Points
- Create offscreen canvas in init section.
- Add `drawBackground()` function called at the start of `draw()`.
- Combo value is already tracked — just read it to modulate parameters.

---

## Feature 6: CRT Post-Processing Toggle

**Category:** Visual Spectacle
**Purpose:** Optional retro arcade mode that delights retro fans.

### Effects
1. **Scanlines:** Repeating pattern — every other 2px row drawn as a semi-transparent black rectangle at 5% opacity.
2. **Chromatic aberration:** Game canvas drawn 3 times with `globalCompositeOperation` per RGB channel, offset by 2-3px at screen edges (offset scales with distance from center).
3. **Vignette:** Radial gradient from transparent center to semi-transparent black edges, drawn on top.
4. **Barrel distortion:** Very subtle — achieved by drawing the game canvas to a slightly larger area and clipping, creating a mild curve illusion. Optional; skip if performance cost is too high.

### Implementation
- Second canvas overlaid on the game canvas, same dimensions.
- Post-process runs in `draw()` after all game rendering, only when CRT mode is active.
- Toggle: 'C' key or button on title/pause screen.
- State saved to localStorage.

---

## Feature 7: Living Neon Ecosystem

**Category:** Visual Spectacle
**Purpose:** Make the game world feel alive. Subtle but memorable — the kind of detail people notice on second play.

### Creatures
4 types, purely cosmetic, drawn with simple canvas primitives:

| Type | Shape | Color | Draw Calls |
|------|-------|-------|------------|
| Drifter | Small triangle (3 lines) | Cyan | 3 |
| Orb | Circle with inner glow | Magenta | 2 |
| Hex | Hexagon outline | Green | 1 (6-point path) |
| Jellyfish | Arc + 3 trailing sine-wave tendrils | Yellow | 4 |

### Behavior
- **Count:** 8-12 creatures, randomly spawned at game start from all 4 types.
- **Movement:** Boids-lite algorithm — separation from nearby creatures (avoid clumping), gentle constant drift velocity, wraparound at screen edges.
- **Ball avoidance:** Within 80px of any ball, apply flee force (vector away from ball, magnitude inversely proportional to distance).
- **Combo attraction:** During active combos, creatures drift toward the combo text area.
- **Boss fight scatter:** When a boss is active, all creatures flee to screen edges.
- **Power-up swirl:** Creatures within 100px of a falling power-up orbit it gently.

### Rendering
- Drawn at 10-15% opacity, BEFORE the game layer (behind bricks/ball/paddle).
- When procedural audio is active, creature opacity pulses slightly with the bass beat (`globalPulse`).
- Performance: 12 creatures × ~4 draw calls = ~48 extra draw calls per frame. Negligible.

---

## Feature 8: Sentinel Boss Fights

**Category:** Gameplay Depth
**Purpose:** Create milestone moments that punctuate the level grind. Bosses give the game a narrative arc.

### When
- Boss appears at levels 5, 10, 15, 20, etc. (every 5 levels).
- Instead of a brick grid, the screen shows the boss entity. Normal level resumes after boss defeat.

### Boss Structure
- **Geometry:** Wireframe shape rendered with `ctx.stroke()` — triangle (level 5), hexagon (level 10), eye-shape (level 15+). The wireframe slowly rotates.
- **Core nodes:** 3-5 glowing circles positioned at vertices or center of the geometry, connected by neon lines. Nodes have HP (2-4 hits depending on boss level).
- **Shield segments:** Arc-shaped shields rotate around inner nodes, blocking the ball. Ball bounces off shields normally.

### Phases

**Phase 1 — Open (outer nodes exposed):**
- Boss drifts laterally (simple sine-wave X movement).
- 2-3 outer nodes are fully exposed. Ball bounces off wireframe shell but damages nodes on direct hit.
- No hazard bricks.

**Phase 2 — Aggro (inner nodes, boss attacks):**
- Outer nodes destroyed. Boss movement speeds up.
- Drops hazard bricks every 3-4 seconds — single bricks that fall at a steady speed. If a hazard brick reaches the paddle line, paddle shrinks to 60% width for 3 seconds (punishing but not lethal).
- Inner nodes are intermittently exposed as shield segments rotate. Curve Shot is key to threading past shields.

**Phase 3 — Core (final node, intense):**
- Single core node remains. Boss moves erratically (faster sine + random jitter).
- Hazard bricks drop every 2 seconds.
- Core is always exposed (no shields) but hard to hit due to movement.
- On destruction: massive particle cascade (100+ particles), screen shake (magnitude 15, highest in the game), all creatures scatter, bonus points (500 × level), bonus life awarded.

**Phase transitions:**
- Boss freezes for 1.5 seconds. Geometry visually unfolds/reconfigures with a neon flash.
- A free Magnet power-up drops — ball sticks to paddle, player gets a moment to breathe and aim.

### Scaling
| Boss Level | Nodes | Shield Speed | Hazard Rate | Node HP |
|-----------|-------|-------------|-------------|---------|
| 5 | 3 | Slow | Every 4s | 2 |
| 10 | 4 | Medium | Every 3s | 3 |
| 15 | 5 | Fast | Every 2.5s | 3 |
| 20+ | 5 | Very fast | Every 2s | 4 |

### Integration Points
- Add `gameMode` state: `'normal'` or `'boss'`.
- Boss entity: `{ x, y, vx, shape, nodes[], shields[], phase }`.
- New collision function: `ballBossCollision()` — check against nodes and shields.
- Boss update logic in `update()` — movement, shield rotation, hazard brick spawning.
- Boss rendering in `draw()` — wireframe geometry, node glows, shield arcs, HP indicators.

---

## Feature 9: Achievement Constellation

**Category:** Meta-Game
**Purpose:** Give players goals and a visually compelling trophy room that fits the game's aesthetic.

### Display
- Accessed via "ACHIEVEMENTS" button on title screen or 'A' key during gameplay (pauses game).
- Full-screen overlay (like current title/game-over overlay) with a dark background.
- Achievements are positioned as stars at fixed coordinates, forming a paddle shape when all are earned.
- Earned stars: bright glow in their assigned color + connecting neon lines to adjacent earned stars.
- Unearned stars: dim outline circles.
- Hover/tap a star: tooltip shows achievement name, description, and completion date if earned.

### Achievements (16 total)

| Name | Requirement | Color |
|------|-------------|-------|
| First Blood | Destroy your first brick | Cyan |
| Combo Hunter | Reach 15x combo | Magenta |
| Combo Legend | Reach 30x combo | Magenta |
| Untouchable | Clear a level without losing a life | Yellow |
| Sentinel Slayer | Defeat your first boss | Green |
| Sentinel Master | Defeat 3 bosses | Green |
| Prism Master | Destroy 20+ bricks with one Prism activation | Rainbow |
| Curve Ace | Hit 3+ bricks with one curved shot | Cyan |
| Pulse Destroyer | Destroy 5+ bricks with one Pulse | Cyan |
| Phase Savior | Save a ball with Phase Shift (ball was below paddle Y) | Yellow |
| Marathon | Reach level 20 | Orange |
| Speed Demon | Clear a level in under 15 seconds | Red |
| Pacifist | Survive 10 seconds without destroying a brick | White |
| Power Surge | Have 3+ power-ups active simultaneously | Green |
| Screenshot Star | Trigger 5 auto-screenshot moments in one game | Yellow |
| Boss Rush | Defeat a boss without losing a life | Red |

### Storage
- localStorage: `neonBreakout_achievements` — JSON object mapping achievement IDs to `{ earned: true, date: timestamp }`.
- Checked via simple conditionals at relevant moments (brick destroy, level clear, boss kill, etc.).

---

## Feature 10: Auto Screenshot Moments

**Category:** Social
**Purpose:** Make the game shareable. Organic virality through highlight captures.

### Trigger Events
| Event | Capture Timing |
|-------|---------------|
| 10+ combo reached | At the frame combo hits 10 (peak visual) |
| Boss killed | During the particle cascade (0.5s after final node destroyed) |
| Flawless level clear | On level transition |
| Prism frenzy | When 7 rainbow balls are all active |

### Capture Pipeline
1. **Detection:** Check triggers in `update()`. Set a `captureRequested` flag.
2. **Flash:** White overlay rectangle at 30% opacity, fading to 0 over 200ms.
3. **Capture:** After the current frame renders, call `canvas.toDataURL('image/png')` or `canvas.toBlob()`.
4. **Overlay composition:** Draw onto a temporary offscreen canvas:
   - Game frame as base
   - Score + combo (top-left, Orbitron font, cyan glow)
   - Level (top-right)
   - Trigger label centered: "10X COMBO!" / "BOSS DEFEATED" / "FLAWLESS" / "PRISM FRENZY" — large Orbitron text with matching glow color
   - "NEON BREAKOUT" watermark (bottom-center, small, 30% opacity)
5. **Store:** Keep last 5 captures in an array (Blob references, session only).

### Sharing
- **Share button:** Appears bottom-right corner for 5 seconds after capture. Small neon-bordered button with share icon.
- **Mobile:** `navigator.share({ files: [new File([blob], 'neon-breakout.png')] })` — native share sheet.
- **Desktop:** `navigator.clipboard.write([new ClipboardItem({'image/png': blob})])` — copies image. Toast: "Screenshot copied!"
- **Fallback:** If neither API is available, download the PNG file directly.
- **Gallery:** Accessible from pause menu. Shows thumbnails of last 5 captures. Tap to re-share.

### Guards
- 10-second minimum cooldown between captures.
- No capture during title or game-over screens.
- Flash is non-intrusive — gameplay never pauses.

---

## Architecture Decision

The game should be split into modules as it grows from ~730 lines to an estimated ~2500-3000 lines. Recommended structure:

```
index.html          — HTML shell + CSS (unchanged)
js/
  main.js           — Game loop, state machine, init
  config.js         — Constants, tuning values
  input.js          — Mouse/touch/keyboard handlers
  physics.js        — Ball movement, collision detection
  paddle.js         — Paddle logic, abilities, curve shot
  bricks.js         — Brick grid, brick behaviors
  boss.js           — Boss entity, phases, hazard bricks
  powerups.js       — All power-up logic including Prism
  particles.js      — Particle system, brick shatter
  audio.js          — Web Audio engine, SFX, beat sync
  background.js     — Synthwave horizon, creature ecosystem
  crt.js            — CRT post-processing
  achievements.js   — Achievement definitions, checking, constellation rendering
  screenshot.js     — Auto-capture, sharing, gallery
  renderer.js       — Main draw function, HUD, overlays
```

All modules loaded via `<script type="module">` — no build step needed. Shared state passed via a single `game` object reference.

**Timing:** The module refactor happens as Phase 0 before any features are built. Extract the existing code into modules first, verify the game still works identically, then build features into the modular structure.

---

## Build Order

Features ordered to maximize value at each step:

| Phase | Features | Rationale |
|-------|----------|-----------|
| 0 — Refactor | Extract `index.html` into modular JS files | Clean foundation before adding features. |
| 1 — Core Feel | Audio (4), Synthwave BG (5), Curve Shot (1) | Biggest immediate impact. Game goes from silent/flat to immersive. |
| 2 — Depth | Paddle Abilities (2), Prism (3) | More player agency and spectacular moments. |
| 3 — Spectacle | CRT (6), Creatures (7), Brick Shatter | Visual polish layer. |
| 4 — Bosses | Boss Fights (8) | Milestone moments. Hardest feature — built on stable foundation. |
| 5 — Meta | Achievements (9), Screenshots (10) | Retention and sharing. Best after all features exist to reference. |

**Brick Shatter** (Phase 3 bonus): When a brick is destroyed, instead of square particles, it fractures into 3-5 angular shards (small triangles/trapezoids in the brick's color) that tumble with rotation, bounce off walls, and fade over 1.5 seconds. Each shard has position, velocity, rotation, and angular velocity. Rendered via `ctx.save()`/`ctx.transform()`/`ctx.restore()`. During high combos, shards trail ember particles. Replaces the existing `emitParticles()` call in `ballBrickCollision()`.

---

## Verification

### Manual Testing
- Play through levels 1-5 to verify curve shot, pulse ability, and normal gameplay feel.
- Reach level 5 to verify boss fight triggers, phases, and victory reward.
- Collect Prism power-up and verify 7 colored balls with color-match instant kills.
- Toggle CRT mode on/off, verify visual effects and performance.
- Check audio starts on first click, mute toggle works, brick hits produce row-pitched notes.
- Verify achievements unlock and persist across page reloads (localStorage).
- Trigger a 10+ combo and verify auto-screenshot capture + share button appears.
- Test on mobile: touch controls, double-tap ability, touch-hold curve shot.

### Performance
- Maintain 60fps with all features active. Profile with Chrome DevTools.
- Offscreen canvases (background, CRT) should not cause frame drops.
- Creature count capped at 12, particles capped at 200 (existing).
- Audio nodes cleaned up properly (disconnect + nullify references after use).

### Browser Support
- Web Audio API: All modern browsers.
- `navigator.share()`: Mobile Safari, Chrome Android. Desktop fallback to clipboard.
- `canvas.toBlob()`: All modern browsers.
- localStorage: All modern browsers.
