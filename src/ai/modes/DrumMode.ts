import type { MusicalState } from '../../analysis/types';
import type { AudioFeatures } from '../../audio/types';
import type { AIMode, AIDecision, NoteEvent } from '../types';

/**
 * DrumMode plays background drum patterns that follow the musician's tempo and energy.
 * Perfect for beginners who need a steady beat to practice along with.
 *
 * Uses MIDI note conventions for drums (GM drum map range):
 *   36 = Kick, 38 = Snare, 42 = Closed Hi-hat, 46 = Open Hi-hat
 *   We send these as regular NoteEvents — the DrumEngine intercepts them.
 */

// Drum pattern types
type PatternName = 'rock' | 'funk' | 'ballad' | 'latin' | 'metronome';

interface DrumHit {
  drum: 'kick' | 'snare' | 'hihat' | 'openhat';
  velocity: number;
}

interface DrumPattern {
  name: PatternName;
  /** 16 steps (16th notes in a bar). Each step is an array of simultaneous hits. */
  steps: DrumHit[][];
  label: string;
}

const PATTERNS: DrumPattern[] = [
  {
    name: 'rock',
    label: 'Rock',
    steps: [
      [{ drum: 'kick', velocity: 0.9 }, { drum: 'hihat', velocity: 0.7 }],  // 1
      [{ drum: 'hihat', velocity: 0.4 }],                                      // e
      [{ drum: 'hihat', velocity: 0.6 }],                                      // &
      [{ drum: 'hihat', velocity: 0.4 }],                                      // a
      [{ drum: 'snare', velocity: 0.8 }, { drum: 'hihat', velocity: 0.7 }],  // 2
      [{ drum: 'hihat', velocity: 0.4 }],                                      // e
      [{ drum: 'hihat', velocity: 0.6 }],                                      // &
      [{ drum: 'hihat', velocity: 0.4 }],                                      // a
      [{ drum: 'kick', velocity: 0.85 }, { drum: 'hihat', velocity: 0.7 }],  // 3
      [{ drum: 'hihat', velocity: 0.4 }],                                      // e
      [{ drum: 'kick', velocity: 0.6 }, { drum: 'hihat', velocity: 0.6 }],   // &
      [{ drum: 'hihat', velocity: 0.4 }],                                      // a
      [{ drum: 'snare', velocity: 0.85 }, { drum: 'hihat', velocity: 0.7 }], // 4
      [{ drum: 'hihat', velocity: 0.4 }],                                      // e
      [{ drum: 'hihat', velocity: 0.6 }],                                      // &
      [{ drum: 'hihat', velocity: 0.4 }],                                      // a
    ],
  },
  {
    name: 'funk',
    label: 'Funk',
    steps: [
      [{ drum: 'kick', velocity: 0.9 }, { drum: 'hihat', velocity: 0.7 }],
      [{ drum: 'hihat', velocity: 0.3 }],
      [{ drum: 'hihat', velocity: 0.5 }],
      [{ drum: 'kick', velocity: 0.5 }, { drum: 'hihat', velocity: 0.3 }],
      [{ drum: 'snare', velocity: 0.85 }, { drum: 'hihat', velocity: 0.7 }],
      [{ drum: 'hihat', velocity: 0.3 }],
      [{ drum: 'kick', velocity: 0.6 }, { drum: 'openhat', velocity: 0.5 }],
      [{ drum: 'hihat', velocity: 0.3 }],
      [{ drum: 'kick', velocity: 0.7 }, { drum: 'hihat', velocity: 0.7 }],
      [{ drum: 'hihat', velocity: 0.3 }],
      [{ drum: 'hihat', velocity: 0.5 }],
      [{ drum: 'kick', velocity: 0.5 }],
      [{ drum: 'snare', velocity: 0.8 }, { drum: 'hihat', velocity: 0.7 }],
      [{ drum: 'kick', velocity: 0.4 }],
      [{ drum: 'hihat', velocity: 0.5 }],
      [{ drum: 'snare', velocity: 0.3 }, { drum: 'hihat', velocity: 0.3 }],
    ],
  },
  {
    name: 'ballad',
    label: 'Ballad',
    steps: [
      [{ drum: 'kick', velocity: 0.7 }],
      [],
      [{ drum: 'hihat', velocity: 0.3 }],
      [],
      [{ drum: 'snare', velocity: 0.5 }, { drum: 'hihat', velocity: 0.4 }],
      [],
      [{ drum: 'hihat', velocity: 0.3 }],
      [],
      [{ drum: 'kick', velocity: 0.6 }],
      [],
      [{ drum: 'hihat', velocity: 0.3 }],
      [{ drum: 'kick', velocity: 0.3 }],
      [{ drum: 'snare', velocity: 0.5 }, { drum: 'hihat', velocity: 0.4 }],
      [],
      [{ drum: 'hihat', velocity: 0.3 }],
      [],
    ],
  },
  {
    name: 'latin',
    label: 'Latin',
    steps: [
      [{ drum: 'kick', velocity: 0.8 }, { drum: 'hihat', velocity: 0.6 }],
      [],
      [{ drum: 'hihat', velocity: 0.4 }],
      [{ drum: 'kick', velocity: 0.5 }],
      [{ drum: 'hihat', velocity: 0.6 }],
      [],
      [{ drum: 'snare', velocity: 0.7 }, { drum: 'hihat', velocity: 0.5 }],
      [],
      [{ drum: 'hihat', velocity: 0.4 }],
      [],
      [{ drum: 'kick', velocity: 0.7 }, { drum: 'hihat', velocity: 0.6 }],
      [],
      [{ drum: 'hihat', velocity: 0.4 }],
      [{ drum: 'snare', velocity: 0.6 }],
      [{ drum: 'hihat', velocity: 0.5 }],
      [{ drum: 'kick', velocity: 0.4 }],
    ],
  },
  {
    name: 'metronome',
    label: 'Click',
    steps: [
      [{ drum: 'hihat', velocity: 0.9 }],  // 1 (accent)
      [],
      [],
      [],
      [{ drum: 'hihat', velocity: 0.5 }],  // 2
      [],
      [],
      [],
      [{ drum: 'hihat', velocity: 0.5 }],  // 3
      [],
      [],
      [],
      [{ drum: 'hihat', velocity: 0.5 }],  // 4
      [],
      [],
      [],
    ],
  },
];

// MIDI note mapping for drums (GM standard)
const DRUM_MIDI: Record<string, number> = {
  kick: 36,
  snare: 38,
  hihat: 42,
  openhat: 46,
};

export class DrumMode implements AIMode {
  public readonly name = 'drums' as const;

  private stepIndex: number = 0;
  private lastStepTime: number = 0;
  private currentPattern: number = 0; // index into PATTERNS
  private barCount: number = 0;

  public decide(
    _state: MusicalState,
    features: AudioFeatures,
    intensity: number,
  ): AIDecision | null {
    // Determine tempo: use detected tempo or default to 100 BPM
    const bpm = features.tempo > 40 ? features.tempo : 100;
    // 16th note duration in ms
    const stepDurationMs = (60000 / bpm) / 4;

    const now = features.timestamp;
    const elapsed = now - this.lastStepTime;

    if (elapsed < stepDurationMs * 0.85) {
      return null; // Not time for next step yet
    }

    this.lastStepTime = now;

    const pattern = PATTERNS[this.currentPattern];
    const step = pattern.steps[this.stepIndex];
    this.stepIndex = (this.stepIndex + 1) % 16;

    if (this.stepIndex === 0) {
      this.barCount++;
    }

    if (!step || step.length === 0) {
      return null;
    }

    // Scale velocity by intensity and musician's energy
    const energyScale = 0.5 + features.rms * 2;
    const velocityScale = Math.max(0.2, Math.min(1.0, intensity * energyScale));

    const notes: NoteEvent[] = step.map((hit) => ({
      pitch: DRUM_MIDI[hit.drum],
      duration: 80, // short drum hit
      velocity: Math.min(1.0, hit.velocity * velocityScale),
    }));

    return {
      notes,
      timing: 0,
      velocity: velocityScale,
      articulation: 'staccato',
    };
  }

  /** Cycle to the next drum pattern. */
  public nextPattern(): PatternName {
    this.currentPattern = (this.currentPattern + 1) % PATTERNS.length;
    this.stepIndex = 0;
    return PATTERNS[this.currentPattern].name;
  }

  public setPattern(name: PatternName): void {
    const idx = PATTERNS.findIndex((p) => p.name === name);
    if (idx >= 0) {
      this.currentPattern = idx;
      this.stepIndex = 0;
    }
  }

  public getCurrentPatternName(): PatternName {
    return PATTERNS[this.currentPattern].name;
  }

  public static getPatternNames(): { name: PatternName; label: string }[] {
    return PATTERNS.map((p) => ({ name: p.name, label: p.label }));
  }

  public reset(): void {
    this.stepIndex = 0;
    this.lastStepTime = 0;
    this.currentPattern = 0;
    this.barCount = 0;
  }
}
