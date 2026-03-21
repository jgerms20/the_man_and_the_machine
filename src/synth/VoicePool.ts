import * as Tone from 'tone';
import type { NoteEvent } from '../ai/types';
import type { SynthParams } from './types';
import type { EffectsChain } from './EffectsChain';

const MAX_POLYPHONY = 6;

/**
 * Manages a PolySynth voice pool connected to the provided EffectsChain.
 */
export class VoicePool {
  private readonly polySynth: Tone.PolySynth<Tone.Synth>;
  private readonly effectsChain: EffectsChain;

  constructor(effectsChain: EffectsChain) {
    this.effectsChain = effectsChain;

    this.polySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.05,
        decay: 0.4,
        sustain: 0.6,
        release: 0.8,
      },
    });

    this.polySynth.maxPolyphony = MAX_POLYPHONY;
    this.polySynth.connect(this.effectsChain.getInput());
  }

  /**
   * Ensure the AudioContext is running (required after a user gesture).
   * Safe to call multiple times.
   */
  async ensureStarted(): Promise<void> {
    await Tone.start();
  }

  /**
   * Play a single MIDI note.
   * @param midiNote  MIDI note number (0–127)
   * @param duration  Duration in seconds
   * @param velocity  Velocity in range 0–1
   * @param time      Optional Tone.js time string/number for scheduling; defaults to Tone.now()
   */
  playNote(
    midiNote: number,
    duration: number,
    velocity: number,
    time?: Tone.Unit.Time,
  ): void {
    const freq = Tone.Frequency(midiNote, 'midi').toFrequency();
    const scheduledTime = time ?? Tone.now();
    // Clamp velocity to [0, 1]
    const clampedVelocity = Math.min(1, Math.max(0, velocity));
    this.polySynth.triggerAttackRelease(freq, duration, scheduledTime, clampedVelocity);
  }

  /**
   * Play an array of NoteEvents, scheduling each relative to Tone.now().
   * NoteEvent.duration is in milliseconds; converted to seconds for Tone.js.
   */
  playNotes(notes: NoteEvent[]): void {
    const now = Tone.now();
    for (const note of notes) {
      const freq = Tone.Frequency(note.pitch, 'midi').toFrequency();
      const durationSec = note.duration / 1000;
      const clampedVelocity = Math.min(1, Math.max(0, note.velocity));
      this.polySynth.triggerAttackRelease(freq, durationSec, now, clampedVelocity);
    }
  }

  /**
   * Update synth envelope and effects chain from a SynthParams snapshot.
   * The `type` field influences the oscillator waveform.
   */
  setTimbre(params: SynthParams): void {
    // Map SynthParams.type to a Tone.js oscillator type
    const oscType = resolveOscillatorType(params.type);
    this.polySynth.set({
      oscillator: { type: oscType },
      envelope: {
        attack: params.attack,
        decay: params.decay,
        sustain: params.sustain,
        release: params.release,
      },
    });

    this.effectsChain.updateFromParams(params);
  }

  /** Immediately release all currently-sounding voices. */
  stopAll(): void {
    this.polySynth.releaseAll();
  }

  /** Dispose the PolySynth (does NOT dispose the EffectsChain). */
  dispose(): void {
    this.polySynth.dispose();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type BasicOscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

function resolveOscillatorType(type: SynthParams['type']): BasicOscillatorType {
  switch (type) {
    case 'fm':
      // FM-like brightness via sine with harmonics — use triangle as base oscillator
      return 'triangle';
    case 'am':
      return 'square';
    case 'subtractive':
      return 'sawtooth';
    case 'pluck':
      // Pluck character: bright initial transient → closest is triangle
      return 'triangle';
    case 'membrane':
      return 'sine';
    default: {
      // Exhaustiveness guard
      const _never: never = type;
      console.warn(`VoicePool: unknown synth type "${String(_never)}", defaulting to sine`);
      return 'sine';
    }
  }
}
