import type { MusicalState } from '../../analysis/types';
import type { AudioFeatures } from '../../audio/types';
import type { AIMode, AIDecision } from '../types';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * InterpretMode — no AI sound output, but generates real-time text interpretations
 * of what the musician is playing. Descriptions are stored externally via callback.
 */
export class InterpretMode implements AIMode {
  public readonly name = 'interpret' as const;

  private _onInterpret: ((text: string) => void) | null = null;
  private _lastText = '';
  private _lastUpdateTime = 0;
  private _updateInterval = 600; // ms between updates

  private _directionBuffer: number[] = [];
  private _intervalBuffer: number[] = [];
  private _rhythmTimestamps: number[] = [];
  private _noteHistory: number[] = [];

  /** Register a callback to receive interpretation text */
  setCallback(cb: (text: string) => void): void {
    this._onInterpret = cb;
  }

  public decide(
    state: MusicalState,
    features: AudioFeatures,
    _intensity: number,
  ): AIDecision | null {
    const now = features.timestamp;

    // Track note onset timing for rhythm analysis
    if (features.onset) {
      this._rhythmTimestamps.push(now);
      if (this._rhythmTimestamps.length > 12) this._rhythmTimestamps.shift();
    }

    // Track interval movement
    if (features.midiNote > 0 && features.rms > 0.01) {
      if (this._noteHistory.length > 0) {
        const lastNote = this._noteHistory[this._noteHistory.length - 1] ?? 0;
        if (lastNote > 0 && lastNote !== features.midiNote) {
          this._intervalBuffer.push(features.midiNote - lastNote);
          if (this._intervalBuffer.length > 8) this._intervalBuffer.shift();
        }
      }
      this._noteHistory.push(features.midiNote);
      if (this._noteHistory.length > 16) this._noteHistory.shift();
    }

    if (now - this._lastUpdateTime < this._updateInterval) return null;
    this._lastUpdateTime = now;

    const text = this._interpret(state, features);
    if (text && text !== this._lastText) {
      this._lastText = text;
      this._onInterpret?.(text);
    }

    return null;
  }

  public reset(): void {
    this._lastText = '';
    this._lastUpdateTime = 0;
    this._directionBuffer = [];
    this._intervalBuffer = [];
    this._rhythmTimestamps = [];
    this._noteHistory = [];
  }

  private _interpret(state: MusicalState, features: AudioFeatures): string {
    const parts: string[] = [];

    // ── Silence ──────────────────────────────────────────────────────────────
    if (state.dynamicContour === 'silence') {
      return 'Silence — listening...';
    }

    // ── Note identification ──────────────────────────────────────────────────
    if (features.midiNote > 0 && features.rms > 0.01) {
      const noteName = NOTE_NAMES[features.midiNote % 12] ?? '';
      const octave = Math.floor(features.midiNote / 12) - 1;
      const register = octave <= 1 ? 'low' : octave <= 3 ? 'mid' : 'high';
      parts.push(`${noteName}${octave} (${register} register)`);
    }

    // ── Melodic movement ─────────────────────────────────────────────────────
    this._directionBuffer.push(features.midiNote);
    if (this._directionBuffer.length > 8) this._directionBuffer.shift();

    if (this._directionBuffer.length >= 4) {
      const first = this._directionBuffer[0] ?? 0;
      const last = this._directionBuffer[this._directionBuffer.length - 1] ?? 0;
      const diff = last - first;
      const absDiff = Math.abs(diff);

      if (absDiff > 12) {
        parts.push(diff > 0 ? '— large ascending leap' : '— large descending leap');
      } else if (absDiff > 5) {
        parts.push(diff > 0 ? '— ascending' : '— descending');
      } else if (absDiff > 2) {
        parts.push(diff > 0 ? '— stepping up' : '— stepping down');
      } else if (absDiff <= 1 && this._directionBuffer.length >= 4) {
        parts.push('— pedal tone / repeated note');
      }
    }

    // ── Interval analysis ────────────────────────────────────────────────────
    if (this._intervalBuffer.length >= 3) {
      const desc = this._describeIntervals();
      if (desc) parts.push(desc);
    }

    // ── Rhythm analysis ──────────────────────────────────────────────────────
    const rhythmDesc = this._describeRhythm();
    if (rhythmDesc) parts.push(rhythmDesc);

    // ── Key / mode ───────────────────────────────────────────────────────────
    if (state.key) {
      const keyDesc = state.mode === 'minor' ? `${state.key} minor` : `${state.key} major`;
      parts.push(`| ${keyDesc}`);
    }

    // ── Dynamic ──────────────────────────────────────────────────────────────
    if (state.dynamicContour === 'building') {
      parts.push('| crescendo');
    } else if (state.dynamicContour === 'fading') {
      parts.push('| decrescendo');
    }

    if (state.energyLevel > 0.8) {
      parts.push('| forte');
    } else if (state.energyLevel < 0.2) {
      parts.push('| piano');
    }

    // ── Harmonic character ───────────────────────────────────────────────────
    if (state.harmonicTension > 0.7) {
      parts.push('| high tension — dissonant intervals');
    } else if (state.harmonicTension > 0.4) {
      parts.push('| moderate tension');
    } else if (state.harmonicTension < 0.12) {
      parts.push('| very consonant');
    }

    // ── Phrase position ──────────────────────────────────────────────────────
    if (state.phrasePosition === 'beginning') {
      parts.push('— starting new phrase');
    } else if (state.phrasePosition === 'end') {
      parts.push('— resolving phrase');
    }

    return parts.join(' ');
  }

  private _describeIntervals(): string | null {
    const intervals = this._intervalBuffer.slice(-4);
    if (intervals.length < 3) return null;

    // Check for stepwise motion (all intervals ≤ 2 semitones)
    const allStepwise = intervals.every((i) => Math.abs(i) <= 2);
    if (allStepwise) {
      const ascending = intervals.every((i) => i >= 0);
      const descending = intervals.every((i) => i <= 0);
      if (ascending) return '(chromatic/scale run up)';
      if (descending) return '(chromatic/scale run down)';
      return '(stepwise motion)';
    }

    // Check for arpeggiated movement (3, 4, or 7 semitones)
    const arpeggioIntervals = new Set([3, 4, 5, 7, -3, -4, -5, -7]);
    const arpCount = intervals.filter((i) => arpeggioIntervals.has(i)).length;
    if (arpCount >= 2) {
      return '(arpeggiated)';
    }

    // Check for octave jumps
    if (intervals.some((i) => Math.abs(i) === 12)) {
      return '(octave displacement)';
    }

    return null;
  }

  private _describeRhythm(): string | null {
    if (this._rhythmTimestamps.length < 4) return null;

    // Calculate inter-onset intervals
    const iois: number[] = [];
    for (let i = 1; i < this._rhythmTimestamps.length; i++) {
      iois.push((this._rhythmTimestamps[i] ?? 0) - (this._rhythmTimestamps[i - 1] ?? 0));
    }

    const avg = iois.reduce((s, v) => s + v, 0) / iois.length;
    const variance = iois.reduce((s, v) => s + (v - avg) ** 2, 0) / iois.length;
    const cv = Math.sqrt(variance) / avg; // coefficient of variation

    if (cv < 0.15) {
      // Very regular
      if (avg < 200) return '| fast steady pulse';
      if (avg < 400) return '| even eighth notes';
      if (avg < 700) return '| steady quarter notes';
      return '| slow, even rhythm';
    } else if (cv < 0.35) {
      return '| somewhat regular rhythm';
    } else if (cv > 0.6) {
      return '| free / rubato timing';
    }

    // Check for swing feel (alternating long-short)
    if (iois.length >= 4) {
      let swingPattern = true;
      for (let i = 0; i < iois.length - 1; i += 2) {
        const ratio = (iois[i] ?? 1) / (iois[i + 1] ?? 1);
        if (ratio < 1.3 || ratio > 2.5) {
          swingPattern = false;
          break;
        }
      }
      if (swingPattern) return '| swing feel';
    }

    return null;
  }
}
