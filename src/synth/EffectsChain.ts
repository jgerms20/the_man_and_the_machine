import * as Tone from 'tone';
import type { SynthParams } from './types';

/**
 * Master effects chain:
 *   Filter (lowpass) → Reverb → FeedbackDelay → Compressor → Volume → Destination
 *
 * Reverb.generate() is async; audio is routed immediately but the reverb IR
 * will be silent until `ready` resolves. Call `await chain.ready` before
 * triggering notes if you need the reverb fully loaded.
 */
export class EffectsChain {
  private readonly filter: Tone.Filter;
  private readonly reverb: Tone.Reverb;
  private readonly delay: Tone.FeedbackDelay;
  private readonly compressor: Tone.Compressor;
  private readonly volume: Tone.Volume;

  /** Resolves when the reverb IR has been generated. */
  readonly ready: Promise<void>;

  constructor() {
    this.filter = new Tone.Filter({
      type: 'lowpass',
      frequency: 3500,
      rolloff: -24,
      Q: 1,
    });

    this.reverb = new Tone.Reverb({
      decay: 2.5,
      preDelay: 0.02,
      wet: 0.35,
    });

    this.delay = new Tone.FeedbackDelay({
      delayTime: 0.25,
      feedback: 0.25,
      wet: 0.4,
    });

    this.compressor = new Tone.Compressor({
      threshold: -18,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
      knee: 6,
    });

    this.volume = new Tone.Volume(0);

    // Wire the chain
    this.filter.connect(this.reverb);
    this.reverb.connect(this.delay);
    this.delay.connect(this.compressor);
    this.compressor.connect(this.volume);
    this.volume.toDestination();

    // Generate the reverb IR asynchronously; chain is otherwise ready immediately
    this.ready = this.reverb.generate().then(() => {});
  }

  /** Returns the first node in the chain — connect synths here. */
  getInput(): Tone.Filter {
    return this.filter;
  }

  /** Apply all effect parameters from a SynthParams snapshot. */
  updateFromParams(params: SynthParams): void {
    this.filter.frequency.rampTo(params.filterFrequency, 0.05);
    this.filter.Q.rampTo(params.filterResonance, 0.05);
    this.reverb.wet.rampTo(params.reverbWet, 0.05);
    // FeedbackDelay.delayTime is a Param<"time">
    this.delay.delayTime.rampTo(params.delayTime, 0.05);
    this.delay.feedback.rampTo(params.delayFeedback, 0.05);
  }

  /** Set master output volume in dB. */
  setVolume(db: number): void {
    this.volume.volume.rampTo(db, 0.05);
  }

  dispose(): void {
    this.filter.dispose();
    this.reverb.dispose();
    this.delay.dispose();
    this.compressor.dispose();
    this.volume.dispose();
  }
}
