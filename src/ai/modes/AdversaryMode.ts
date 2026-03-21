import type { MusicalState } from '../../analysis/types';
import type { AudioFeatures } from '../../audio/types';
import type { AIMode, AIDecision, NoteEvent } from '../types';
import {
  parseKey,
  getScaleNotes,
  getChordTones,
  nearestScaleNote,
  SCALES,
  consonanceScore,
} from '../musicTheory';

const SILENCE_THRESHOLD = 0.01;

/**
 * AdversaryMode ("Fletcher mode") deliberately opposes the musician's parameters.
 *
 * - Major → plays from minor, loud → quiet, fast → slow
 * - Introduces polyrhythmic tension (groupings of 3 or 5 against 4)
 * - Tracks opposition axes and shifts strategy when musician adapts (low novelty)
 * - Briefly aligns on high novelty spikes before pushing again
 * - Always uses scale tones so the opposition sounds intentional, not random
 */
export class AdversaryMode implements AIMode {
  public readonly name = 'adversary' as const;

  private lastPitch: number = 60;
  private oppositionAxis: 'harmony' | 'dynamics' | 'rhythm' | 'register' = 'harmony';
  private axisHoldBars: number = 0;
  private barCount: number = 0;
  private totalDecisions: number = 0;
  private noveltyAlignCooldown: number = 0;
  private polyGrouping: 3 | 5 = 3;
  private polyBeatIndex: number = 0;

  public decide(
    state: MusicalState,
    features: AudioFeatures,
    intensity: number,
  ): AIDecision | null {
    // Adversary plays even when musician is quieter, but not in true silence
    if (features.rms < SILENCE_THRESHOLD * 0.5) {
      return null;
    }

    this.totalDecisions++;

    // Approximate bar tracking
    if (this.totalDecisions % 4 === 0) {
      this.barCount++;
      this.axisHoldBars++;
    }

    const { root, scale } = parseKey(`${state.key} ${state.mode}`);
    const beatDurationMs = features.tempo > 0 ? 60000 / features.tempo : 500;

    // Briefly align on high novelty spikes — the musician did something surprising
    if (state.novelty > 0.8 && this.noveltyAlignCooldown <= 0) {
      this.noveltyAlignCooldown = 8; // align for ~8 decisions then resume opposition
      return this.buildAlignedResponse(state, features, root, scale, beatDurationMs, intensity);
    }

    if (this.noveltyAlignCooldown > 0) {
      this.noveltyAlignCooldown--;
      if (this.noveltyAlignCooldown > 0) {
        return this.buildAlignedResponse(state, features, root, scale, beatDurationMs, intensity);
      }
    }

    // Shift opposition axis when musician adapts (low novelty = they're comfortable)
    if (state.novelty < 0.2 && this.axisHoldBars > 4) {
      this.rotateAxis();
    }

    // Determine the opposite harmonic world
    const { oppositeRoot, oppositeScale } = this.getOppositeHarmony(root, scale, state.mode);
    const effectiveRoot = this.oppositionAxis === 'harmony' ? oppositeRoot : root;
    const effectiveScale = this.oppositionAxis === 'harmony' ? oppositeScale : scale;

    const chordTones = getChordTones(effectiveRoot, effectiveScale);
    const scaleNotes = getScaleNotes(effectiveRoot, effectiveScale);

    // Choose pitch — opposition in register means play in a different octave range
    const musicianOctave = Math.floor(features.midiNote / 12);
    let targetOctave: number;
    if (this.oppositionAxis === 'register') {
      // Play in opposite register: low if they're high, high if they're low
      targetOctave = musicianOctave >= 5 ? Math.max(2, musicianOctave - 3) : Math.min(7, musicianOctave + 3);
    } else {
      targetOctave = Math.max(2, Math.min(7, musicianOctave));
    }

    const pitch = this.chooseAdversarialPitch(
      chordTones,
      scaleNotes,
      targetOctave,
      features.midiNote,
      effectiveRoot,
      effectiveScale,
      intensity,
    );

    // Dynamics opposition: loud → quiet, quiet → loud
    let velocity: number;
    if (this.oppositionAxis === 'dynamics') {
      const inverted = 1.0 - features.rms;
      velocity = Math.max(0.1, Math.min(1.0, inverted * intensity));
    } else {
      // Still partially inverted even when not the primary axis
      const partial = 1.0 - features.rms * 0.5;
      velocity = Math.max(0.1, Math.min(1.0, partial * intensity));
    }

    // Rhythm opposition: polyrhythmic groupings of 3 or 5 against 4
    this.polyBeatIndex++;
    let timing = 0;
    if (this.oppositionAxis === 'rhythm') {
      // Create polyrhythmic offsets
      const groupDuration = beatDurationMs * 4; // one bar
      const subdivisionMs = groupDuration / this.polyGrouping;
      const offset = (this.polyBeatIndex % this.polyGrouping) * subdivisionMs;
      timing = offset % beatDurationMs;
      // Occasionally flip grouping
      if (this.barCount % 8 === 0 && this.totalDecisions % 4 === 0) {
        this.polyGrouping = this.polyGrouping === 3 ? 5 : 3;
      }
    } else {
      timing = features.onset ? beatDurationMs * 0.25 : Math.random() * 40;
    }

    // Duration: fast musician → slow notes, slow musician → fast notes
    let duration: number;
    if (this.oppositionAxis === 'rhythm') {
      const tempoFactor = features.tempo > 100 ? 2.0 : 0.5;
      duration = beatDurationMs * tempoFactor;
    } else {
      duration = beatDurationMs * 0.5;
    }

    // Articulation: adversary uses accents and staccato for aggressive presence
    let articulation: AIDecision['articulation'];
    if (intensity > 0.7) {
      articulation = Math.random() < 0.5 ? 'accent' : 'staccato';
    } else {
      articulation = Math.random() < 0.3 ? 'staccato' : 'legato';
    }

    const note: NoteEvent = {
      pitch,
      duration: Math.max(50, duration),
      velocity,
    };
    this.lastPitch = pitch;

    return {
      notes: [note],
      timing: Math.max(0, timing),
      velocity,
      articulation,
    };
  }

  public reset(): void {
    this.lastPitch = 60;
    this.oppositionAxis = 'harmony';
    this.axisHoldBars = 0;
    this.barCount = 0;
    this.totalDecisions = 0;
    this.noveltyAlignCooldown = 0;
    this.polyGrouping = 3;
    this.polyBeatIndex = 0;
  }

  /**
   * Build a brief aligned response (used when musician's novelty spikes).
   * This momentary agreement makes the subsequent opposition feel more dramatic.
   */
  private buildAlignedResponse(
    _state: MusicalState,
    features: AudioFeatures,
    root: number,
    scale: number[],
    beatDurationMs: number,
    intensity: number,
  ): AIDecision {
    const chordTones = getChordTones(root, scale);
    const musicianOctave = Math.floor(features.midiNote / 12);
    const targetOctave = Math.max(2, Math.min(7, musicianOctave));

    let bestPc = chordTones[0] ?? root;
    let bestConsonance = -1;
    const musicianPc = features.midiNote % 12;

    for (const pc of chordTones) {
      const interval = ((pc - musicianPc) % 12 + 12) % 12;
      const score = consonanceScore(interval);
      if (score > bestConsonance) {
        bestConsonance = score;
        bestPc = pc;
      }
    }

    let midi = targetOctave * 12 + bestPc;
    while (Math.abs(midi - features.midiNote) > 12) {
      midi += midi > features.midiNote ? -12 : 12;
    }
    midi = Math.max(21, Math.min(108, midi));

    const velocity = Math.max(0.1, Math.min(1.0, features.rms * intensity));
    this.lastPitch = midi;

    return {
      notes: [{ pitch: midi, duration: beatDurationMs, velocity }],
      timing: 0,
      velocity,
      articulation: 'legato',
    };
  }

  /**
   * Determine the opposite harmonic world. Major → minor, minor → major.
   * Uses the parallel (same root) mode swap for maximum tonal contrast.
   */
  private getOppositeHarmony(
    root: number,
    scale: number[],
    modeName: string,
  ): { oppositeRoot: number; oppositeScale: number[] } {
    const lowerMode = modeName.toLowerCase();

    if (lowerMode === 'major' || lowerMode === 'lydian' || lowerMode === 'mixolydian') {
      return { oppositeRoot: root, oppositeScale: SCALES.minor };
    }
    if (lowerMode === 'minor' || lowerMode === 'dorian' || lowerMode === 'phrygian') {
      return { oppositeRoot: root, oppositeScale: SCALES.major };
    }
    // Default: flip to the other quality
    const isMajorLike = scale.includes(4); // contains major 3rd interval
    return {
      oppositeRoot: root,
      oppositeScale: isMajorLike ? SCALES.minor : SCALES.major,
    };
  }

  /**
   * Pick a pitch that is in-scale but maximally tense against the musician.
   * Prefers dissonant intervals (2nds, 7ths, tritones) while staying in the effective scale.
   */
  private chooseAdversarialPitch(
    chordTones: number[],
    scaleNotes: number[],
    targetOctave: number,
    musicianMidi: number,
    root: number,
    scale: number[],
    intensity: number,
  ): number {
    const pool = scaleNotes.length > 0 ? scaleNotes : chordTones;
    if (pool.length === 0) {
      return nearestScaleNote(musicianMidi, root, scale);
    }

    const musicianPc = musicianMidi % 12;

    // Score each pitch class: prefer dissonance at high intensity, moderate tension at low
    let bestPc = pool[0];
    let bestScore = -1;

    for (const pc of pool) {
      const interval = ((pc - musicianPc) % 12 + 12) % 12;
      // Invert consonance so dissonant intervals score highest
      const dissonance = 1.0 - consonanceScore(interval);
      // At lower intensity, prefer moderate tension; at high intensity, maximum dissonance
      const targetDissonance = 0.3 + intensity * 0.7;
      const score = 1.0 - Math.abs(dissonance - targetDissonance);

      // Voice leading from last pitch — still want some smoothness so it sounds intentional
      const lastPc = this.lastPitch % 12;
      const stepDist = Math.min(
        ((pc - lastPc) % 12 + 12) % 12,
        ((lastPc - pc) % 12 + 12) % 12,
      );
      const voiceLeadingBonus = stepDist <= 3 ? 0.3 : 0;

      if (score + voiceLeadingBonus > bestScore) {
        bestScore = score + voiceLeadingBonus;
        bestPc = pc;
      }
    }

    let midi = targetOctave * 12 + bestPc;
    while (midi - musicianMidi > 14) midi -= 12;
    while (musicianMidi - midi > 14) midi += 12;

    return Math.max(21, Math.min(108, midi));
  }

  private rotateAxis(): void {
    const axes: Array<typeof this.oppositionAxis> = ['harmony', 'dynamics', 'rhythm', 'register'];
    const currentIndex = axes.indexOf(this.oppositionAxis);
    // Move to next axis, cycling through
    this.oppositionAxis = axes[(currentIndex + 1) % axes.length];
    this.axisHoldBars = 0;
  }
}
