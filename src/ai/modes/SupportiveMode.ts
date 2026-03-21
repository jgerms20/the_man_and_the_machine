import type { MusicalState } from '../../analysis/types';
import type { AudioFeatures } from '../../audio/types';
import type { AIMode, AIDecision, NoteEvent } from '../types';
import {
  parseKey,
  getScaleNotes,
  getChordTones,
  nearestScaleNote,
} from '../musicTheory';

const SILENCE_THRESHOLD = 0.01;

/**
 * SupportiveMode harmonizes with the musician's detected key.
 * It prefers chord tones, matches dynamics, generates notes on musician onsets,
 * stays in a similar octave range, and uses mostly legato articulation.
 * Does not play when the musician is silent.
 */
export class SupportiveMode implements AIMode {
  public readonly name = 'supportive' as const;

  private lastPitch: number = 60;

  public decide(
    state: MusicalState,
    features: AudioFeatures,
    intensity: number,
  ): AIDecision | null {
    // Don't play if musician is silent
    if (features.rms < SILENCE_THRESHOLD) {
      return null;
    }

    // Only generate on onsets or sustained notes with significant energy
    if (!features.onset && features.rms < 0.05) {
      return null;
    }

    const { root, scale } = parseKey(`${state.key} ${state.mode}`);
    const chordTones = getChordTones(root, scale);
    const scaleNotes = getScaleNotes(root, scale);

    // Determine target octave from musician's pitch
    const musicianOctave = Math.floor(features.midiNote / 12);
    const targetOctave = Math.max(2, Math.min(7, musicianOctave));

    // Choose pitch: prefer chord tones, fall back to scale tones
    const pitch = this.chooseSupportivePitch(
      chordTones,
      scaleNotes,
      targetOctave,
      features.midiNote,
      root,
      scale,
    );

    // Match dynamics within +/- 0.1 of musician RMS scaled by intensity
    const baseVelocity = features.rms * intensity;
    const velocity = Math.max(0.05, Math.min(1.0, baseVelocity + (Math.random() * 0.2 - 0.1)));

    // Duration based on tempo and phrase position
    const beatDurationMs = features.tempo > 0 ? 60000 / features.tempo : 500;
    const duration = this.chooseDuration(state, beatDurationMs);

    // Timing: on the beat or slightly after for a following feel
    const timing = features.onset ? 0 : Math.random() * 50;

    const note: NoteEvent = { pitch, duration, velocity };

    this.lastPitch = pitch;

    return {
      notes: [note],
      timing,
      velocity,
      articulation: 'legato',
    };
  }

  public reset(): void {
    this.lastPitch = 60;
  }

  private chooseSupportivePitch(
    chordTones: number[],
    scaleNotes: number[],
    targetOctave: number,
    musicianMidi: number,
    root: number,
    scale: number[],
  ): number {
    // 70% chance chord tone, 30% scale tone
    const useChordTone = Math.random() < 0.7;
    const pool = useChordTone ? chordTones : scaleNotes;

    if (pool.length === 0) {
      return nearestScaleNote(musicianMidi, root, scale);
    }

    // Pick the pitch class that sounds best against the musician's note
    const musicianPc = musicianMidi % 12;

    // Prefer a harmonically pleasing interval: 3rd, 5th, or 6th above/below
    const pleasingIntervals = [3, 4, 7, 8, 9]; // minor 3rd, major 3rd, 5th, minor 6th, major 6th
    let bestPc = pool[0];
    let bestScore = -1;

    for (const pc of pool) {
      const interval = ((pc - musicianPc) % 12 + 12) % 12;
      const score = pleasingIntervals.includes(interval) ? 2 : 1;
      // Prefer smooth voice leading from last pitch
      const lastPc = this.lastPitch % 12;
      const stepDistance = Math.min(
        ((pc - lastPc) % 12 + 12) % 12,
        ((lastPc - pc) % 12 + 12) % 12,
      );
      const voiceLeadingBonus = stepDistance <= 2 ? 1 : 0;

      if (score + voiceLeadingBonus > bestScore) {
        bestScore = score + voiceLeadingBonus;
        bestPc = pc;
      }
    }

    // Place in target octave, keeping within a reasonable range of musician
    let midi = targetOctave * 12 + bestPc;

    // Ensure we stay within an octave of the musician
    while (midi - musicianMidi > 12) midi -= 12;
    while (musicianMidi - midi > 12) midi += 12;

    return Math.max(21, Math.min(108, midi));
  }

  private chooseDuration(state: MusicalState, beatMs: number): number {
    switch (state.phrasePosition) {
      case 'beginning':
        return beatMs * 0.75;
      case 'middle':
        return beatMs * 0.5;
      case 'end':
        return beatMs * 1.5;
      case 'between':
        return beatMs;
      default:
        return beatMs;
    }
  }
}
