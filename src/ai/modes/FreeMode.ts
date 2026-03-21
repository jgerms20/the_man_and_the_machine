import type { MusicalState } from '../../analysis/types';
import type { AudioFeatures } from '../../audio/types';
import type { AIMode, AIDecision, NoteEvent } from '../types';
import {
  parseKey,
  getScaleNotes,
  nearestScaleNote,
  randomFromScale,
  SCALES,
} from '../musicTheory';

/**
 * FreeMode uses algorithmic Markov-like generation with independent musical logic.
 *
 * - Movement probabilities: 70% step, 15% leap, 10% repeat, 5% rest
 * - All notes snapped to the current scale
 * - Listening pauses every 16-32 bars for 2-4 bars
 * - Re-roots to musician's key every 16 bars
 * - Rhythm density varies in 8-bar arcs
 */
export class FreeMode implements AIMode {
  public readonly name = 'free' as const;

  private lastPitch: number = 60;
  private barCount: number = 0;
  private totalDecisions: number = 0;

  /** Current key tracking (re-rooted periodically from musician). */
  private currentRoot: number = 0;
  private currentScale: number[] = SCALES.major;
  private lastReRootBar: number = 0;

  /** Listening pause state. */
  private pauseActive: boolean = false;
  private pauseEndBar: number = 0;
  private nextPauseBar: number = 16 + Math.floor(Math.random() * 17); // 16-32

  /** Rhythm density arc state (8-bar cycle). */
  private arcPosition: number = 0;

  public decide(
    state: MusicalState,
    features: AudioFeatures,
    intensity: number,
  ): AIDecision | null {
    this.totalDecisions++;

    // Approximate bar tracking (every 4 decisions ≈ 1 bar)
    if (this.totalDecisions % 4 === 0) {
      this.barCount++;
      this.arcPosition = this.barCount % 8;
    }

    // --- Re-root to musician's key every 16 bars ---
    if (this.barCount - this.lastReRootBar >= 16) {
      const parsed = parseKey(`${state.key} ${state.mode}`);
      this.currentRoot = parsed.root;
      this.currentScale = parsed.scale;
      this.lastReRootBar = this.barCount;
    }

    // --- Listening pauses ---
    if (this.pauseActive) {
      if (this.barCount >= this.pauseEndBar) {
        this.pauseActive = false;
        this.scheduleNextPause();
      } else {
        return null; // Silent during pause
      }
    }

    if (!this.pauseActive && this.barCount >= this.nextPauseBar) {
      this.pauseActive = true;
      this.pauseEndBar = this.barCount + 2 + Math.floor(Math.random() * 3); // 2-4 bars
      return null;
    }

    const scaleNotes = getScaleNotes(this.currentRoot, this.currentScale);
    const beatDurationMs = features.tempo > 0 ? 60000 / features.tempo : 500;

    // --- Markov-like pitch selection ---
    const roll = Math.random();
    let pitch: number;

    if (roll < 0.70) {
      // Step motion: move 1-2 scale degrees
      pitch = this.stepMove(scaleNotes);
    } else if (roll < 0.85) {
      // Leap: move 3-7 scale degrees
      pitch = this.leapMove(scaleNotes);
    } else if (roll < 0.95) {
      // Repeat last pitch
      pitch = this.lastPitch;
    } else {
      // Rest: return null (5% chance)
      return null;
    }

    // Ensure pitch is in scale and valid MIDI range
    pitch = nearestScaleNote(pitch, this.currentRoot, this.currentScale);
    pitch = Math.max(36, Math.min(96, pitch)); // Keep in a comfortable range

    // --- Rhythm density arc (8-bar cycle) ---
    // Arc shape: sparse → dense → sparse
    // Position 0-1: sparse, 2-3: building, 4-5: dense, 6-7: thinning
    const densityFactor = this.getDensityFactor();

    // Skip some notes when density is low
    if (Math.random() > densityFactor) {
      return null;
    }

    // --- Duration based on density and tempo ---
    const durationMultiplier = densityFactor > 0.7
      ? 0.25 + Math.random() * 0.5  // Short notes when dense
      : 0.5 + Math.random() * 1.5;  // Longer notes when sparse
    const duration = Math.max(50, beatDurationMs * durationMultiplier);

    // --- Velocity: independent but influenced by density arc and intensity ---
    const baseVelocity = 0.3 + densityFactor * 0.4;
    const velocity = Math.max(0.1, Math.min(1.0, baseVelocity * intensity + (Math.random() * 0.2 - 0.1)));

    // --- Timing: slightly randomized, not locked to musician ---
    const timing = Math.random() * beatDurationMs * 0.15;

    // --- Articulation varies with density ---
    let articulation: AIDecision['articulation'];
    if (densityFactor > 0.7) {
      articulation = Math.random() < 0.5 ? 'staccato' : 'legato';
    } else if (densityFactor < 0.3) {
      articulation = 'legato';
    } else {
      const artRoll = Math.random();
      if (artRoll < 0.5) articulation = 'legato';
      else if (artRoll < 0.75) articulation = 'staccato';
      else if (artRoll < 0.9) articulation = 'accent';
      else articulation = 'ghost';
    }

    this.lastPitch = pitch;

    const note: NoteEvent = { pitch, duration, velocity };

    return {
      notes: [note],
      timing,
      velocity,
      articulation,
    };
  }

  public reset(): void {
    this.lastPitch = 60;
    this.barCount = 0;
    this.totalDecisions = 0;
    this.currentRoot = 0;
    this.currentScale = SCALES.major;
    this.lastReRootBar = 0;
    this.pauseActive = false;
    this.pauseEndBar = 0;
    this.nextPauseBar = 16 + Math.floor(Math.random() * 17);
    this.arcPosition = 0;
  }

  /**
   * Step motion: move 1-2 semitones in scale, preserving direction tendency.
   */
  private stepMove(scaleNotes: number[]): number {
    if (scaleNotes.length === 0) return this.lastPitch;

    const lastOctave = Math.floor(this.lastPitch / 12);

    // Build a list of all scale notes within 1-2 scale degrees
    const candidates: number[] = [];
    for (const pc of scaleNotes) {
      for (let oct = lastOctave - 1; oct <= lastOctave + 1; oct++) {
        const midi = oct * 12 + pc;
        const dist = Math.abs(midi - this.lastPitch);
        if (dist >= 1 && dist <= 4) {
          candidates.push(midi);
        }
      }
    }

    if (candidates.length === 0) {
      // Fallback: move up or down by one semitone and snap
      const direction = Math.random() < 0.5 ? 1 : -1;
      return this.lastPitch + direction;
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Leap motion: move 5-12 semitones, preferring musically meaningful intervals.
   */
  private leapMove(scaleNotes: number[]): number {
    if (scaleNotes.length === 0) return this.lastPitch;

    const lastOctave = Math.floor(this.lastPitch / 12);
    const candidates: number[] = [];

    for (const pc of scaleNotes) {
      for (let oct = lastOctave - 1; oct <= lastOctave + 1; oct++) {
        const midi = oct * 12 + pc;
        const dist = Math.abs(midi - this.lastPitch);
        if (dist >= 5 && dist <= 12) {
          candidates.push(midi);
        }
      }
    }

    if (candidates.length === 0) {
      // Fallback: random from scale in nearby octave
      return randomFromScale(this.currentRoot, this.currentScale, lastOctave);
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Get the density factor (0-1) based on the 8-bar arc position.
   * Shape: sparse → building → dense → thinning.
   */
  private getDensityFactor(): number {
    // Map arc position (0-7) to a density curve
    const densityCurve: Record<number, number> = {
      0: 0.3,
      1: 0.4,
      2: 0.55,
      3: 0.7,
      4: 0.85,
      5: 0.9,
      6: 0.7,
      7: 0.45,
    };
    return densityCurve[this.arcPosition] ?? 0.5;
  }

  private scheduleNextPause(): void {
    this.nextPauseBar = this.barCount + 16 + Math.floor(Math.random() * 17);
  }
}
