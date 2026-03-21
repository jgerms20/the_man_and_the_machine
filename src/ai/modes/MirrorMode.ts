import type { MusicalState } from '../../analysis/types';
import type { AudioFeatures } from '../../audio/types';
import type { AIMode, AIDecision, NoteEvent } from '../types';
import {
  parseKey,
  nearestScaleNote,
  invertMelody,
  retrograde,
  augment,
  diminish,
  transpose,
} from '../musicTheory';

/** Minimum silence duration (ms) to consider a phrase boundary. */
const PHRASE_BOUNDARY_SILENCE_MS = 500;

/** Maximum number of stacked transform layers before clearing. */
const MAX_LAYERS = 3;

interface CapturedPhrase {
  pitches: number[];
  durations: number[];
  velocities: number[];
  startTime: number;
}

type TransformType = 'inversion' | 'retrograde' | 'augmentation' | 'diminution' | 'transposition';

interface TransformLayer {
  transform: TransformType;
  pitches: number[];
  durations: number[];
  velocities: number[];
  playIndex: number;
}

/**
 * MirrorMode captures the musician's phrases and plays them back with
 * compositional transforms: inversion, retrograde, augmentation, diminution,
 * and transposition. Up to 3 layers can stack before clearing and recapturing.
 * The mode is silent while capturing a phrase.
 */
export class MirrorMode implements AIMode {
  public readonly name = 'mirror' as const;

  /** Currently-being-captured phrase. */
  private capturing: boolean = false;
  private currentPhrase: CapturedPhrase = this.emptyPhrase();
  private lastOnsetTime: number = 0;
  private lastSilenceStart: number = 0;
  private wasSilent: boolean = true;

  /** Completed transform layers being played back. */
  private layers: TransformLayer[] = [];

  /** Queue of captured phrases waiting to be transformed. */
  private phraseQueue: CapturedPhrase[] = [];

  /** Transform cycling index for variety. */
  private transformIndex: number = 0;

  private static readonly TRANSFORM_SEQUENCE: TransformType[] = [
    'inversion',
    'retrograde',
    'transposition',
    'augmentation',
    'diminution',
  ];

  public decide(
    state: MusicalState,
    features: AudioFeatures,
    intensity: number,
  ): AIDecision | null {
    const now = features.timestamp;
    const isSilent = features.rms < 0.01;
    const { root, scale } = parseKey(`${state.key} ${state.mode}`);

    // --- Phrase boundary detection ---
    if (isSilent && !this.wasSilent) {
      this.lastSilenceStart = now;
    }

    if (isSilent && this.capturing && (now - this.lastSilenceStart) >= PHRASE_BOUNDARY_SILENCE_MS) {
      this.finishCapture();
    }

    if (!isSilent && features.onset) {
      if (!this.capturing) {
        this.startCapture(now);
      }
      this.addNoteToPhrase(features, now);
    }

    this.wasSilent = isSilent;

    // --- Process queued phrases into layers ---
    while (this.phraseQueue.length > 0 && this.layers.length < MAX_LAYERS) {
      const phrase = this.phraseQueue.shift()!;
      const layer = this.buildLayer(phrase, root, scale, intensity);
      if (layer) {
        this.layers.push(layer);
      }
    }

    // --- If we have max layers and another phrase is done, clear and restart ---
    if (this.layers.length >= MAX_LAYERS && this.phraseQueue.length > 0) {
      this.layers = [];
      // Process the next queued phrase as the first new layer
      const phrase = this.phraseQueue.shift()!;
      const layer = this.buildLayer(phrase, root, scale, intensity);
      if (layer) {
        this.layers.push(layer);
      }
    }

    // --- Play back active layers ---
    if (this.layers.length === 0) {
      return null; // Silent while only capturing
    }

    const notes: NoteEvent[] = [];
    let totalTiming = 0;
    let totalVelocity = 0;
    let activeLayerCount = 0;

    for (const layer of this.layers) {
      if (layer.playIndex >= layer.pitches.length) {
        continue; // This layer has finished its current pass
      }

      const idx = layer.playIndex;
      const pitch = nearestScaleNote(layer.pitches[idx], root, scale);
      const duration = Math.max(50, layer.durations[idx] ?? 200);
      const velocity = Math.max(0.05, Math.min(1.0, (layer.velocities[idx] ?? 0.5) * intensity));

      notes.push({ pitch, duration, velocity });
      totalTiming += duration;
      totalVelocity += velocity;
      activeLayerCount++;

      layer.playIndex++;

      // Loop layer playback
      if (layer.playIndex >= layer.pitches.length) {
        layer.playIndex = 0;
      }
    }

    if (notes.length === 0) {
      return null;
    }

    const avgVelocity = totalVelocity / activeLayerCount;

    return {
      notes,
      timing: 0,
      velocity: Math.max(0.05, Math.min(1.0, avgVelocity)),
      articulation: 'legato',
    };
  }

  public reset(): void {
    this.capturing = false;
    this.currentPhrase = this.emptyPhrase();
    this.lastOnsetTime = 0;
    this.lastSilenceStart = 0;
    this.wasSilent = true;
    this.layers = [];
    this.phraseQueue = [];
    this.transformIndex = 0;
  }

  private emptyPhrase(): CapturedPhrase {
    return { pitches: [], durations: [], velocities: [], startTime: 0 };
  }

  private startCapture(now: number): void {
    this.capturing = true;
    this.currentPhrase = this.emptyPhrase();
    this.currentPhrase.startTime = now;
  }

  private addNoteToPhrase(features: AudioFeatures, now: number): void {
    const duration = this.lastOnsetTime > 0 ? now - this.lastOnsetTime : 200;
    this.currentPhrase.pitches.push(features.midiNote);
    this.currentPhrase.durations.push(Math.max(50, Math.min(2000, duration)));
    this.currentPhrase.velocities.push(features.rms);
    this.lastOnsetTime = now;
  }

  private finishCapture(): void {
    if (this.currentPhrase.pitches.length >= 2) {
      this.phraseQueue.push({ ...this.currentPhrase });
    }
    this.capturing = false;
    this.currentPhrase = this.emptyPhrase();
  }

  /**
   * Build a transform layer from a captured phrase.
   */
  private buildLayer(
    phrase: CapturedPhrase,
    root: number,
    scale: number[],
    intensity: number,
  ): TransformLayer | null {
    if (phrase.pitches.length < 2) {
      return null;
    }

    const transformType = MirrorMode.TRANSFORM_SEQUENCE[
      this.transformIndex % MirrorMode.TRANSFORM_SEQUENCE.length
    ];
    this.transformIndex++;

    let pitches: number[];
    let durations: number[];
    const velocities = [...phrase.velocities];

    switch (transformType) {
      case 'inversion': {
        // Invert around the average pitch of the phrase
        const avg = Math.round(
          phrase.pitches.reduce((a, b) => a + b, 0) / phrase.pitches.length,
        );
        pitches = invertMelody(phrase.pitches, avg);
        durations = [...phrase.durations];
        break;
      }
      case 'retrograde': {
        pitches = retrograde(phrase.pitches);
        durations = retrograde(phrase.durations);
        break;
      }
      case 'augmentation': {
        pitches = [...phrase.pitches];
        durations = augment(phrase.durations, 1.5 + intensity * 0.5);
        break;
      }
      case 'diminution': {
        pitches = [...phrase.pitches];
        durations = diminish(phrase.durations, 1.5 + intensity * 0.5);
        break;
      }
      case 'transposition': {
        // Transpose up or down by a musically meaningful interval
        const intervals = [3, 4, 5, 7, -3, -4, -5, -7];
        const semitones = intervals[Math.floor(Math.random() * intervals.length)];
        pitches = phrase.pitches.map((p) => transpose(p, semitones));
        durations = [...phrase.durations];
        break;
      }
      default:
        pitches = [...phrase.pitches];
        durations = [...phrase.durations];
    }

    // Snap all pitches to the current scale
    pitches = pitches.map((p) => nearestScaleNote(p, root, scale));

    return {
      transform: transformType,
      pitches,
      durations,
      velocities,
      playIndex: 0,
    };
  }
}
