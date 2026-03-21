import * as Tone from 'tone';
import type { NoteEvent } from '../ai/types';

/**
 * DrumEngine provides percussion synthesis separate from the melodic VoicePool.
 * Uses Tone.js MembraneSynth (kick), NoiseSynth (snare/hihat), and MetalSynth (hat).
 *
 * GM drum MIDI mapping:
 *   36 = Kick
 *   38 = Snare
 *   42 = Closed Hi-hat
 *   46 = Open Hi-hat
 */
export class DrumEngine {
  private kick: Tone.MembraneSynth;
  private snare: Tone.NoiseSynth;
  private hihat: Tone.MetalSynth;
  private volume: Tone.Volume;
  private disposed = false;

  constructor() {
    this.volume = new Tone.Volume(-6);

    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.3,
        sustain: 0,
        release: 0.1,
      },
    });
    this.kick.connect(this.volume);

    this.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: {
        attack: 0.001,
        decay: 0.15,
        sustain: 0,
        release: 0.05,
      },
    });
    this.snare.connect(this.volume);

    this.hihat = new Tone.MetalSynth({
      envelope: {
        attack: 0.001,
        decay: 0.08,
        release: 0.01,
      },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    });
    this.hihat.connect(this.volume);

    this.volume.toDestination();
  }

  async ensureStarted(): Promise<void> {
    await Tone.start();
  }

  /** Play drum notes. Recognizes MIDI 36 (kick), 38 (snare), 42 (hihat), 46 (open hat). */
  playNotes(notes: NoteEvent[]): void {
    if (this.disposed) return;
    const now = Tone.now();

    for (const note of notes) {
      const vel = Math.min(1, Math.max(0, note.velocity));

      switch (note.pitch) {
        case 36: // Kick
          this.kick.triggerAttackRelease('C1', '8n', now, vel);
          break;
        case 38: // Snare
          this.snare.triggerAttackRelease('16n', now, vel);
          break;
        case 42: // Closed Hi-hat
          this.hihat.triggerAttackRelease('32n', now, vel * 0.3);
          break;
        case 46: // Open Hi-hat
          this.hihat.triggerAttackRelease('8n', now, vel * 0.4);
          break;
      }
    }
  }

  setVolume(db: number): void {
    if (!this.disposed) {
      this.volume.volume.rampTo(db, 0.05);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.kick.dispose();
    this.snare.dispose();
    this.hihat.dispose();
    this.volume.dispose();
  }
}
