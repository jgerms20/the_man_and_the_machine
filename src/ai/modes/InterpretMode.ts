import type { MusicalState } from '../../analysis/types';
import type { AudioFeatures } from '../../audio/types';
import type { AIMode, AIDecision } from '../types';

/**
 * InterpretMode — no AI sound output, but generates real-time text interpretations
 * of what the musician is playing. Descriptions are stored externally via callback.
 */
export class InterpretMode implements AIMode {
  public readonly name = 'interpret' as const;

  private _onInterpret: ((text: string) => void) | null = null;
  private _lastText = '';
  private _lastUpdateTime = 0;
  private _updateInterval = 800; // ms between interpretation updates

  private _directionBuffer: number[] = [];

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
  }

  private _interpret(state: MusicalState, features: AudioFeatures): string {
    const parts: string[] = [];

    // ── Dynamic contour ──────────────────────────────────────────────────────
    if (state.dynamicContour === 'silence') {
      return 'Silence — listening...';
    }

    // ── Energy description ───────────────────────────────────────────────────
    if (state.energyLevel > 0.75) {
      parts.push('high energy');
    } else if (state.energyLevel > 0.4) {
      parts.push('moderate energy');
    } else {
      parts.push('soft');
    }

    // ── Dynamic direction ────────────────────────────────────────────────────
    if (state.dynamicContour === 'building') {
      parts.push('building');
    } else if (state.dynamicContour === 'fading') {
      parts.push('fading');
    }

    // ── Melodic direction ────────────────────────────────────────────────────
    this._directionBuffer.push(features.midiNote);
    if (this._directionBuffer.length > 6) this._directionBuffer.shift();

    if (this._directionBuffer.length >= 4) {
      const first = this._directionBuffer[0] ?? 0;
      const last = this._directionBuffer[this._directionBuffer.length - 1] ?? 0;
      const diff = last - first;
      if (diff > 3) parts.push('ascending line');
      else if (diff < -3) parts.push('descending line');
    }

    // ── Key / mode ────────────────────────────────────────────────────────────
    if (state.key) {
      const keyDesc = state.mode === 'minor' ? `${state.key} minor` : `${state.key} major`;
      parts.push(`in ${keyDesc}`);
    }

    // ── Harmonic tension ─────────────────────────────────────────────────────
    if (state.harmonicTension > 0.7) {
      parts.push('— dissonant / tense');
    } else if (state.harmonicTension > 0.4) {
      parts.push('— some tension');
    } else if (state.harmonicTension < 0.15) {
      parts.push('— consonant');
    }

    // ── Phrase position ───────────────────────────────────────────────────────
    if (state.phrasePosition === 'beginning') {
      parts.push('| new phrase');
    } else if (state.phrasePosition === 'end') {
      parts.push('| closing phrase');
    }

    return parts.join(' ');
  }
}
