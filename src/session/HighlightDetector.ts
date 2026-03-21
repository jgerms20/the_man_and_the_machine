import type { MusicalState } from '../types';

export interface Highlight {
  timestamp: number;
  type: 'convergence' | 'breakthrough' | 'tension_peak' | 'silence';
  description: string;
}

type HighlightType = Highlight['type'];

const COOLDOWN_MS = 10_000;

/**
 * Detects musically significant moments from a stream of MusicalState updates.
 * All detection is stateful and time-aware; call `update()` once per frame / tick.
 */
export class HighlightDetector {
  // Per-type last-fired timestamp for cooldown enforcement
  private readonly lastFired = new Map<HighlightType, number>();

  // Convergence: track when tension first exceeded 0.7
  private tensionHighStart: number | null = null;

  // Breakthrough: track previous novelty value
  private previousNovelty: number = 0;

  // Silence: track when silence began
  private silenceStart: number | null = null;

  private isCoolingDown(type: HighlightType, now: number): boolean {
    const last = this.lastFired.get(type);
    return last !== undefined && now - last < COOLDOWN_MS;
  }

  private fire(type: HighlightType, description: string, now: number): Highlight {
    this.lastFired.set(type, now);
    return { timestamp: now, type, description };
  }

  update(state: MusicalState, humanRms: number, aiPlaying: boolean): Highlight | null {
    const now = Date.now();
    const { harmonicTension, novelty } = state;

    // ── Convergence ─────────────────────────────────────────────────────────
    // Tension dropped from >0.7 to <0.3 within a 2-second window.
    if (harmonicTension > 0.7) {
      // Mark when tension entered the high zone
      if (this.tensionHighStart === null) {
        this.tensionHighStart = now;
      }
    } else if (harmonicTension < 0.3 && this.tensionHighStart !== null) {
      const elapsed = now - this.tensionHighStart;
      if (elapsed <= 2_000 && !this.isCoolingDown('convergence', now)) {
        this.tensionHighStart = null;
        this.previousNovelty = novelty;
        return this.fire(
          'convergence',
          `Harmonic tension resolved from ${(harmonicTension + 0.7).toFixed(2)} → ${harmonicTension.toFixed(2)} in ${(elapsed / 1000).toFixed(1)}s`,
          now,
        );
      }
      this.tensionHighStart = null;
    } else {
      // Tension is in the middle band — reset high-zone tracker
      this.tensionHighStart = null;
    }

    // ── Breakthrough ────────────────────────────────────────────────────────
    // Novelty spikes above 0.8 after having been below 0.3.
    if (this.previousNovelty < 0.3 && novelty > 0.8) {
      if (!this.isCoolingDown('breakthrough', now)) {
        const result = this.fire(
          'breakthrough',
          `Novelty spike: ${this.previousNovelty.toFixed(2)} → ${novelty.toFixed(2)}`,
          now,
        );
        this.previousNovelty = novelty;
        return result;
      }
    }
    this.previousNovelty = novelty;

    // ── Tension peak ────────────────────────────────────────────────────────
    if (harmonicTension > 0.85 && !this.isCoolingDown('tension_peak', now)) {
      return this.fire(
        'tension_peak',
        `Peak harmonic tension: ${harmonicTension.toFixed(2)}`,
        now,
      );
    }

    // ── Silence ─────────────────────────────────────────────────────────────
    const isSilent = humanRms < 0.01 && !aiPlaying;
    if (isSilent) {
      if (this.silenceStart === null) {
        this.silenceStart = now;
      } else if (now - this.silenceStart > 1_000 && !this.isCoolingDown('silence', now)) {
        const result = this.fire(
          'silence',
          `Shared silence: ${((now - this.silenceStart) / 1000).toFixed(1)}s`,
          now,
        );
        // Advance silenceStart so we don't re-fire every tick while cooling down
        this.silenceStart = now;
        return result;
      }
    } else {
      this.silenceStart = null;
    }

    return null;
  }

  reset(): void {
    this.lastFired.clear();
    this.tensionHighStart = null;
    this.previousNovelty = 0;
    this.silenceStart = null;
  }
}
