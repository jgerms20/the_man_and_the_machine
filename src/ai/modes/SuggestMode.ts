import type { MusicalState } from '../../analysis/types';
import type { AudioFeatures } from '../../audio/types';
import type { AIMode, AIDecision } from '../types';
import { getCircleOfFifthsSuggestions, pcToName } from '../../analysis/ChordDetector';

export interface SuggestData {
  compatible: string[];       // most compatible chords/notes to play next
  scaleNotes: string[];       // notes in the current scale
  nextChords: string[];       // suggested chord progressions
  circleLabel: string;        // descriptive label for current position
}

/**
 * SuggestMode — no AI sound output. Instead, computes and emits suggestions
 * for what chords or notes would sound good based on the circle of fifths
 * and the detected key.
 */
export class SuggestMode implements AIMode {
  public readonly name = 'suggest' as const;

  private _onSuggest: ((data: SuggestData) => void) | null = null;
  private _lastUpdateTime = 0;
  private readonly _updateInterval = 600;

  /** Register a callback to receive suggestion data */
  setCallback(cb: (data: SuggestData) => void): void {
    this._onSuggest = cb;
  }

  public decide(
    state: MusicalState,
    features: AudioFeatures,
    _intensity: number,
  ): AIDecision | null {
    const now = features.timestamp;
    if (now - this._lastUpdateTime < this._updateInterval) return null;
    this._lastUpdateTime = now;

    if (!state.key || state.dynamicContour === 'silence') return null;

    const data = this._computeSuggestions(state);
    this._onSuggest?.(data);

    return null;
  }

  public reset(): void {
    this._lastUpdateTime = 0;
  }

  private _computeSuggestions(state: MusicalState): SuggestData {
    // Convert key string to pitch class
    const rootPc = this._keyToPc(state.key);
    const quality = state.mode === 'minor' ? 'm' : '';

    // Get circle of fifths relationships
    const cof = getCircleOfFifthsSuggestions(rootPc, quality);

    // Build scale notes from key
    const scaleIntervals = state.mode === 'minor'
      ? [0, 2, 3, 5, 7, 8, 10]   // natural minor
      : [0, 2, 4, 5, 7, 9, 11];  // major
    const scaleNotes = scaleIntervals.map((i) => pcToName((rootPc + i) % 12));

    // Suggest chord progressions
    const keyName = state.key;
    const isMinor = state.mode === 'minor';
    const nextChords = isMinor
      ? [
          `${keyName}m → ${cof.subdominant} → ${cof.dominant}`,
          `${keyName}m → ${cof.relative} → ${cof.dominant}`,
          `i → iv → v (${keyName}m → ${cof.subdominant} → ${pcToName((rootPc + 7) % 12)}m)`,
        ]
      : [
          `${keyName} → ${cof.subdominant} → ${cof.dominant}`,
          `I → V → vi → IV (${keyName} → ${cof.dominant} → ${cof.relative} → ${cof.subdominant})`,
          `${keyName} → ${cof.adjacent[0] ?? ''} → ${cof.adjacent[1] ?? ''}`,
        ];

    const compatible = [
      ...cof.adjacent,
      cof.subdominant,
      cof.dominant,
      cof.relative,
      ...(cof.parallelMinor ? [cof.parallelMinor] : []),
      ...(cof.parallelMajor ? [cof.parallelMajor] : []),
    ].filter(Boolean);

    const circleLabel = isMinor
      ? `${keyName} natural minor — relative to ${cof.relative}`
      : `${keyName} major — relative minor: ${cof.relative}`;

    return {
      compatible,
      scaleNotes,
      nextChords,
      circleLabel,
    };
  }

  private _keyToPc(key: string): number {
    const map: Record<string, number> = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
      'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
    };
    return map[key] ?? 0;
  }
}
