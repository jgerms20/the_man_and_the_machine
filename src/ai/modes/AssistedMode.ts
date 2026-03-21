import type { MusicalState } from '../../analysis/types';
import type { AudioFeatures } from '../../audio/types';
import type { AIMode, AIDecision, NoteEvent } from '../types';
import {
  parseKey,
  getScaleNotes,
  getChordTones,
  nearestScaleNote,
} from '../musicTheory';

const SILENCE_THRESHOLD = 0.008;

/**
 * AssistedMode — a beginner-friendly reactive mode that:
 * 1. Plays gentle root notes to anchor the key
 * 2. Fills in bass notes on beats where the musician isn't playing
 * 3. Adds subtle harmonic padding (like a backing track)
 * 4. Responds to what you play by reinforcing it (not challenging)
 * 5. Slows down when you slow down, speeds up when you speed up
 *
 * Think of it like a patient band member who keeps the foundation
 * while you explore. Great for bass practice.
 */
export class AssistedMode implements AIMode {
  public readonly name = 'assisted' as const;

  private lastPlayTime: number = 0;
  private bassNoteIndex: number = 0;
  private silenceTimer: number = 0;
  private lastPitch: number = 40; // E1 — bass range

  public decide(
    state: MusicalState,
    features: AudioFeatures,
    intensity: number,
  ): AIDecision | null {
    const { root, scale } = parseKey(`${state.key} ${state.mode}`);
    const scaleNotes = getScaleNotes(root, scale);
    const chordTones = getChordTones(root, scale);
    const bpm = features.tempo > 40 ? features.tempo : 90;
    const beatMs = 60000 / bpm;
    const now = features.timestamp;

    const musicianSilent = features.rms < SILENCE_THRESHOLD;

    if (musicianSilent) {
      this.silenceTimer += 50; // called every ~50ms

      // After 1.5 seconds of silence, play gentle guide notes to invite playing
      if (this.silenceTimer > 1500 && now - this.lastPlayTime > beatMs) {
        this.lastPlayTime = now;
        return this.playGuideNote(root, scaleNotes, intensity * 0.5);
      }

      // After 4 seconds, play a simple walking bass pattern
      if (this.silenceTimer > 4000 && now - this.lastPlayTime > beatMs * 0.5) {
        this.lastPlayTime = now;
        return this.playWalkingBass(root, scale, chordTones, intensity * 0.4);
      }

      return null;
    }

    // Musician is playing — reset silence timer
    this.silenceTimer = 0;

    // React to onsets: harmonize gently underneath
    if (features.onset && now - this.lastPlayTime > beatMs * 0.4) {
      this.lastPlayTime = now;
      return this.harmonizeBelow(features, root, scale, scaleNotes, intensity);
    }

    // On sustained notes, occasionally add a soft pad tone
    if (features.rms > 0.03 && now - this.lastPlayTime > beatMs * 1.5) {
      this.lastPlayTime = now;
      return this.padTone(features, root, scaleNotes, chordTones, intensity * 0.6);
    }

    return null;
  }

  public reset(): void {
    this.lastPlayTime = 0;
    this.bassNoteIndex = 0;
    this.silenceTimer = 0;
    this.lastPitch = 40;
  }

  /** Play a single gentle root/fifth note as an invitation */
  private playGuideNote(
    root: number,
    _scaleNotes: number[],
    intensity: number,
  ): AIDecision {
    // Alternate between root and fifth in low register
    const guideNotes = [root, (root + 7) % 12];
    const pc = guideNotes[this.bassNoteIndex % guideNotes.length];
    this.bassNoteIndex++;

    const midi = 36 + pc; // Octave 2 range — bass territory
    const note: NoteEvent = {
      pitch: Math.max(28, Math.min(60, midi)),
      duration: 600,
      velocity: Math.max(0.1, intensity * 0.4),
    };
    this.lastPitch = note.pitch;

    return {
      notes: [note],
      timing: 0,
      velocity: note.velocity,
      articulation: 'legato',
    };
  }

  /** Play a simple walking bass line using chord tones */
  private playWalkingBass(
    root: number,
    scale: number[],
    chordTones: number[],
    intensity: number,
  ): AIDecision {
    const pool = chordTones.length > 0 ? chordTones : [root, (root + 7) % 12];
    const pc = pool[this.bassNoteIndex % pool.length];
    this.bassNoteIndex++;

    // Walk in octave 2 (bass range)
    let midi = 36 + pc;
    // Smooth voice leading
    while (midi - this.lastPitch > 7) midi -= 12;
    while (this.lastPitch - midi > 7) midi += 12;
    midi = Math.max(28, Math.min(55, midi));

    // Snap to scale
    midi = nearestScaleNote(midi, root, scale);

    const note: NoteEvent = {
      pitch: midi,
      duration: 400,
      velocity: Math.max(0.1, intensity * 0.35),
    };
    this.lastPitch = midi;

    return {
      notes: [note],
      timing: 0,
      velocity: note.velocity,
      articulation: 'legato',
    };
  }

  /** When musician plays a note, add a supportive bass note below */
  private harmonizeBelow(
    features: AudioFeatures,
    root: number,
    scale: number[],
    _scaleNotes: number[],
    intensity: number,
  ): AIDecision {
    const musicianMidi = features.midiNote;

    // Find a chord tone in the bass range below the musician
    const targetOctave = Math.max(2, Math.floor(musicianMidi / 12) - 1);
    let bassMidi = nearestScaleNote(targetOctave * 12 + root, root, scale);

    // Keep it below the musician but not too far
    while (bassMidi >= musicianMidi) bassMidi -= 12;
    while (musicianMidi - bassMidi > 24) bassMidi += 12;
    bassMidi = Math.max(28, Math.min(55, bassMidi));

    const velocity = Math.max(0.08, Math.min(0.5, features.rms * intensity * 0.7));
    const note: NoteEvent = {
      pitch: bassMidi,
      duration: 500,
      velocity,
    };
    this.lastPitch = bassMidi;

    return {
      notes: [note],
      timing: 20, // slight delay for "following" feel
      velocity,
      articulation: 'legato',
    };
  }

  /** Soft pad tone for sustained playing */
  private padTone(
    features: AudioFeatures,
    _root: number,
    scaleNotes: number[],
    chordTones: number[],
    intensity: number,
  ): AIDecision {
    const pool = chordTones.length > 0 ? chordTones : scaleNotes;
    // Pick a tone that complements what the musician is playing
    const musicianPc = features.midiNote % 12;
    let bestPc = pool[0];
    let bestScore = -1;

    for (const pc of pool) {
      const interval = ((pc - musicianPc) % 12 + 12) % 12;
      // Prefer 5th (7) and octave (0) for stability
      const score = interval === 7 ? 3 : interval === 0 ? 2 : interval === 5 ? 1.5 : 1;
      if (score > bestScore) {
        bestScore = score;
        bestPc = pc;
      }
    }

    const midi = Math.max(28, Math.min(55, 36 + bestPc));
    const velocity = Math.max(0.05, intensity * 0.3);

    return {
      notes: [{ pitch: midi, duration: 800, velocity }],
      timing: 0,
      velocity,
      articulation: 'legato',
    };
  }
}
