import type { MusicalState } from '../../analysis/types';
import type { AudioFeatures } from '../../audio/types';
import type { AIMode, AIDecision, NoteEvent } from '../types';
import {
  parseKey,
  getScaleNotes,
  getChordTones,
  nearestScaleNote,
  getRelativeMinor,
  getTritoneSubstitution,
  SCALES,
} from '../musicTheory';

const SILENCE_THRESHOLD = 0.01;

/**
 * ChallengerMode starts from supportive logic but periodically introduces
 * musical perturbations: key shifts, chromatic alterations, syncopation,
 * and dynamics shifts. Perturbation frequency increases over time.
 * Intensity controls the extremity of perturbations.
 */
export class ChallengerMode implements AIMode {
  public readonly name = 'challenger' as const;

  private barCount: number = 0;
  private nextPerturbationBar: number = 4;
  private perturbationActive: boolean = false;
  private perturbationType: 'keyShift' | 'chromatic' | 'syncopation' | 'dynamics' = 'keyShift';
  private perturbationBarsRemaining: number = 0;
  private shiftedRoot: number = 0;
  private shiftedScale: number[] = SCALES.major;
  private lastPitch: number = 60;
  private totalDecisions: number = 0;
  private dynamicsMultiplier: number = 1.0;

  public decide(
    state: MusicalState,
    features: AudioFeatures,
    intensity: number,
  ): AIDecision | null {
    if (features.rms < SILENCE_THRESHOLD) {
      return null;
    }

    this.totalDecisions++;

    const { root, scale } = parseKey(`${state.key} ${state.mode}`);
    const beatDurationMs = features.tempo > 0 ? 60000 / features.tempo : 500;

    // Track bars roughly (every ~4 beats worth of decisions approximate a bar)
    if (this.totalDecisions % 4 === 0) {
      this.barCount++;
    }

    // Check if it's time for a new perturbation
    if (this.barCount >= this.nextPerturbationBar && !this.perturbationActive) {
      this.activatePerturbation(root, scale, intensity);
    }

    // Tick down perturbation
    if (this.perturbationActive && this.totalDecisions % 4 === 0) {
      this.perturbationBarsRemaining--;
      if (this.perturbationBarsRemaining <= 0) {
        this.perturbationActive = false;
        this.dynamicsMultiplier = 1.0;
        // Schedule next perturbation: gets more frequent over time
        const minGap = Math.max(2, 8 - Math.floor(this.barCount / 16));
        const maxGap = Math.max(4, 12 - Math.floor(this.barCount / 8));
        this.nextPerturbationBar = this.barCount + minGap + Math.floor(Math.random() * (maxGap - minGap));
      }
    }

    // Determine effective root and scale
    let effectiveRoot = root;
    let effectiveScale = scale;

    if (this.perturbationActive) {
      if (this.perturbationType === 'keyShift' || this.perturbationType === 'chromatic') {
        effectiveRoot = this.shiftedRoot;
        effectiveScale = this.shiftedScale;
      }
    }

    const chordTones = getChordTones(effectiveRoot, effectiveScale);
    const scaleNotes = getScaleNotes(effectiveRoot, effectiveScale);

    // Choose pitch
    const musicianOctave = Math.floor(features.midiNote / 12);
    const targetOctave = Math.max(2, Math.min(7, musicianOctave));
    const pitch = this.choosePitch(chordTones, scaleNotes, targetOctave, features.midiNote, effectiveRoot, effectiveScale);

    // Velocity with perturbation influence
    let velocity = features.rms * intensity * this.dynamicsMultiplier;
    velocity = Math.max(0.05, Math.min(1.0, velocity + (Math.random() * 0.2 - 0.1)));

    // Duration
    let duration = beatDurationMs * 0.5;
    if (state.phrasePosition === 'end') duration = beatDurationMs * 1.5;

    // Timing: syncopation perturbation offsets timing
    let timing = features.onset ? 0 : Math.random() * 30;
    if (this.perturbationActive && this.perturbationType === 'syncopation') {
      // Push timing off the beat: half-beat offsets
      timing += beatDurationMs * 0.5 * (0.3 + Math.random() * 0.4);
    }

    // Articulation: occasionally staccato during perturbations
    let articulation: AIDecision['articulation'] = 'legato';
    if (this.perturbationActive) {
      if (this.perturbationType === 'syncopation') {
        articulation = Math.random() < 0.6 ? 'staccato' : 'accent';
      } else if (this.perturbationType === 'dynamics') {
        articulation = Math.random() < 0.4 ? 'accent' : 'legato';
      }
    }

    const note: NoteEvent = { pitch, duration, velocity };
    this.lastPitch = pitch;

    return {
      notes: [note],
      timing,
      velocity,
      articulation,
    };
  }

  public reset(): void {
    this.barCount = 0;
    this.nextPerturbationBar = 4;
    this.perturbationActive = false;
    this.perturbationBarsRemaining = 0;
    this.lastPitch = 60;
    this.totalDecisions = 0;
    this.dynamicsMultiplier = 1.0;
  }

  private activatePerturbation(root: number, scale: number[], intensity: number): void {
    this.perturbationActive = true;
    this.perturbationBarsRemaining = 2 + Math.floor(Math.random() * 3);

    const types: Array<typeof this.perturbationType> = ['keyShift', 'chromatic', 'syncopation', 'dynamics'];
    this.perturbationType = types[Math.floor(Math.random() * types.length)];

    switch (this.perturbationType) {
      case 'keyShift': {
        // Choose a key shift: up a 4th, relative minor, or tritone sub
        const shifts = [
          { root: (root + 5) % 12, scale },                                  // up a 4th
          { root: getRelativeMinor(root), scale: SCALES.minor },              // relative minor
          { root: getTritoneSubstitution(root), scale },                      // tritone sub
        ];
        // More extreme shifts at higher intensity
        const idx = intensity > 0.7
          ? 2  // tritone sub
          : intensity > 0.4
            ? Math.floor(Math.random() * 2) + 1
            : 0;
        const chosen = shifts[Math.min(idx, shifts.length - 1)];
        this.shiftedRoot = chosen.root;
        this.shiftedScale = chosen.scale;
        break;
      }
      case 'chromatic': {
        // Use chromatic or blues scale for color
        const chromaticScales = intensity > 0.5 ? SCALES.chromatic : SCALES.blues;
        this.shiftedRoot = root;
        this.shiftedScale = chromaticScales;
        break;
      }
      case 'dynamics': {
        // Shift dynamics: either much louder or much softer
        this.dynamicsMultiplier = Math.random() < 0.5
          ? 0.3 + (1 - intensity) * 0.3  // quiet
          : 1.3 + intensity * 0.7;       // loud
        break;
      }
      case 'syncopation':
        // Syncopation is handled in timing logic
        break;
    }
  }

  private choosePitch(
    chordTones: number[],
    scaleNotes: number[],
    targetOctave: number,
    musicianMidi: number,
    root: number,
    scale: number[],
  ): number {
    const useChordTone = Math.random() < 0.6;
    const pool = useChordTone && chordTones.length > 0 ? chordTones : scaleNotes;

    if (pool.length === 0) {
      return nearestScaleNote(musicianMidi, root, scale);
    }

    // Smooth voice leading from last pitch
    const lastPc = this.lastPitch % 12;
    let bestPc = pool[0];
    let bestDist = Infinity;

    for (const pc of pool) {
      const dist = Math.min(
        ((pc - lastPc) % 12 + 12) % 12,
        ((lastPc - pc) % 12 + 12) % 12,
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestPc = pc;
      }
    }

    let midi = targetOctave * 12 + bestPc;
    while (midi - musicianMidi > 14) midi -= 12;
    while (musicianMidi - midi > 14) midi += 12;

    return Math.max(21, Math.min(108, midi));
  }
}
