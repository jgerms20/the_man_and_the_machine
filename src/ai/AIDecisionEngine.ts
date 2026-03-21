import type { MusicalState } from '../analysis/types';
import type { AudioFeatures } from '../audio/types';
import type { AIMode, AIModeName, AIDecision } from './types';
import { SupportiveMode } from './modes/SupportiveMode';
import { ChallengerMode } from './modes/ChallengerMode';
import { AdversaryMode } from './modes/AdversaryMode';
import { MirrorMode } from './modes/MirrorMode';
import { FreeMode } from './modes/FreeMode';
import { DrumMode } from './modes/DrumMode';
import { AssistedMode } from './modes/AssistedMode';

/**
 * AIDecisionEngine manages the personality modes and delegates
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
      drums: new DrumMode(),
      assisted: new AssistedMode(),
    };
    this.currentModeName = initialMode;
  }

  public get activeMode(): AIModeName {
    return this.currentModeName;
  }

  /** Returns true if the current mode is the drum mode. */
  public get isDrumMode(): boolean {
    return this.currentModeName === 'drums';
  }

  /** Access the drum mode for pattern control. */
  public get drumMode(): DrumMode {
    return this.modes.drums as DrumMode;
  }

  public setMode(mode: AIModeName): void {
    if (mode !== this.currentModeName) {
      this.currentModeName = mode;
      this.modes[mode].reset();
    }
  }

  public decide(
    state: MusicalState,
    features: AudioFeatures,
    intensity: number,
  ): AIDecision | null {
    const clampedIntensity = Math.max(0, Math.min(1, intensity));
    return this.modes[this.currentModeName].decide(state, features, clampedIntensity);
  }

  public reset(): void {
    for (const mode of Object.values(this.modes)) {
      mode.reset();
    }
  }

  public resetCurrentMode(): void {
    this.modes[this.currentModeName].reset();
  }
}
