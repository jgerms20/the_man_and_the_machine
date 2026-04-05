import type { MusicalState } from '../../analysis/types';
import type { AudioFeatures } from '../../audio/types';
import type { AIMode, AIDecision } from '../types';

/**
 * ListenMode — passive observation only.
 * No AI output. Just listens and lets the chord detector + visualization
 * show what the musician is playing. This is the default starting mode.
 */
export class ListenMode implements AIMode {
  public readonly name = 'listen' as const;

  public decide(
    _state: MusicalState,
    _features: AudioFeatures,
    _intensity: number,
  ): AIDecision | null {
    return null;
  }

  public reset(): void {
    // nothing to reset
  }
}
