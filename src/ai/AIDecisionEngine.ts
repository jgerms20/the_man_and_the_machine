import type { MusicalState } from '../analysis/types';
import type { AudioFeatures } from '../audio/types';
import type { AIMode, AIModeName, AIDecision } from './types';
import { SupportiveMode } from './modes/SupportiveMode';
import { ChallengerMode } from './modes/ChallengerMode';
import { AdversaryMode } from './modes/AdversaryMode';
import { MirrorMode } from './modes/MirrorMode';
import { FreeMode } from './modes/FreeMode';

/**
 * AIDecisionEngine manages the five personality modes and delegates
 * musical decision-making to the currently active mode.
 */
export class AIDecisionEngine {
  private modes: Record<AIModeName, AIMode>;
  private currentModeName: AIModeName;

  constructor(initialMode: AIModeName = 'supportive') {
    this.modes = {
      supportive: new SupportiveMode(),
      challenger: new ChallengerMode(),
      adversary: new AdversaryMode(),
      mirror: new MirrorMode(),
      free: new FreeMode(),
    };
    this.currentModeName = initialMode;
  }

  /**
   * Returns the currently active mode name.
   */
  public get activeMode(): AIModeName {
    return this.currentModeName;
  }

  /**
   * Switch to a different personality mode. Resets the new mode's state.
   */
  public setMode(mode: AIModeName): void {
    if (mode !== this.currentModeName) {
      this.currentModeName = mode;
      this.modes[mode].reset();
    }
  }

  /**
   * Make a musical decision based on the current analysis state and audio features.
   * Returns null if the AI chooses not to play (e.g., silence, capturing in mirror mode).
   */
  public decide(
    state: MusicalState,
    features: AudioFeatures,
    intensity: number,
  ): AIDecision | null {
    const clampedIntensity = Math.max(0, Math.min(1, intensity));
    return this.modes[this.currentModeName].decide(state, features, clampedIntensity);
  }

  /**
   * Reset all modes to their initial state.
   */
  public reset(): void {
    for (const mode of Object.values(this.modes)) {
      mode.reset();
    }
  }

  /**
   * Reset only the currently active mode.
   */
  public resetCurrentMode(): void {
    this.modes[this.currentModeName].reset();
  }
}
