import type { AudioFeatures } from '../audio/types';
import type { MusicalState } from './types';
import { detectKey } from './keyProfiles';
import { detectRhythmicPattern } from './rhythmAnalysis';
import { hzToMidi } from '../audio/utils';

const HISTOGRAM_DECAY = 0.995;
const KEY_UPDATE_INTERVAL = 500;
const KEY_PERSISTENCE_MS = 2000;
const PHRASE_SILENCE_THRESHOLD = 500;
const EMA_ALPHA = 0.05;
const RMS_SILENCE_THRESHOLD = 0.01;

export class MusicalAnalysisEngine {
  private pitchClassHistogram = new Array<number>(12).fill(0);
  private recentPitches: number[] = [];
  private rmsHistory: number[] = [];
  private onsetTimestamps: number[] = [];
  private phraseStartTime = 0;
  private averagePhraseLength = 4000;
  private previousFeatureWindow: number[] = [];
  private currentKey = 'C major';
  private currentMode = 'major';
  private pendingKey = '';
  private pendingKeyTime = 0;
  private lastKeyUpdateTime = 0;
  private smoothedEnergy = 0;
  private smoothedTension = 0;
  private inPhrase = false;
  private lastNonSilentTime = 0;
  private recentIntervals: number[] = [];

  update(features: AudioFeatures): MusicalState {
    const now = features.timestamp;

    // Update pitch class histogram
    if (features.pitch > 0) {
      const midi = hzToMidi(features.pitch);
      const pitchClass = midi % 12;
      this.pitchClassHistogram[pitchClass] += 1;
      this.recentPitches.push(midi);
      if (this.recentPitches.length > 100) this.recentPitches.shift();

      // Track intervals for tension
      if (this.recentPitches.length >= 2) {
        const prev = this.recentPitches[this.recentPitches.length - 2];
        const interval = Math.abs(midi - prev) % 12;
        this.recentIntervals.push(interval);
        if (this.recentIntervals.length > 20) this.recentIntervals.shift();
      }
    }

    // Decay histogram
    for (let i = 0; i < 12; i++) {
      this.pitchClassHistogram[i] *= HISTOGRAM_DECAY;
    }

    // RMS history
    this.rmsHistory.push(features.rms);
    if (this.rmsHistory.length > 100) this.rmsHistory.shift();

    // Onset tracking
    if (features.onset) {
      this.onsetTimestamps.push(now);
      if (this.onsetTimestamps.length > 50) this.onsetTimestamps.shift();
    }

    // Phrase detection
    if (features.rms > RMS_SILENCE_THRESHOLD) {
      this.lastNonSilentTime = now;
      if (!this.inPhrase) {
        this.inPhrase = true;
        this.phraseStartTime = now;
      }
    } else if (this.inPhrase && now - this.lastNonSilentTime > PHRASE_SILENCE_THRESHOLD) {
      this.inPhrase = false;
      const phraseLen = this.lastNonSilentTime - this.phraseStartTime;
      if (phraseLen > 200) {
        this.averagePhraseLength = this.averagePhraseLength * 0.8 + phraseLen * 0.2;
      }
      // phrase ended at this time
    }

    // Key detection (every 500ms)
    if (now - this.lastKeyUpdateTime > KEY_UPDATE_INTERVAL) {
      this.lastKeyUpdateTime = now;
      const result = detectKey(this.pitchClassHistogram);
      if (result.confidence > 0.5) {
        if (result.key !== this.currentKey) {
          if (this.pendingKey === result.key) {
            if (now - this.pendingKeyTime > KEY_PERSISTENCE_MS) {
              this.currentKey = result.key;
              this.currentMode = result.mode;
              this.pendingKey = '';
            }
          } else {
            this.pendingKey = result.key;
            this.pendingKeyTime = now;
          }
        } else {
          this.pendingKey = '';
        }
      }
    }

    // Dynamic contour
    const dynamicContour = this.computeDynamicContour();

    // Phrase position
    const phrasePosition = this.computePhrasePosition(now);

    // Energy level
    const noteDensity = this.computeNoteDensity(now);
    const pitchRange = this.computePitchRange();
    const rawEnergy = features.rms * 0.5 + noteDensity * 0.3 + pitchRange * 0.2;
    this.smoothedEnergy += EMA_ALPHA * (rawEnergy - this.smoothedEnergy);

    // Harmonic tension
    const rawTension = this.computeHarmonicTension();
    this.smoothedTension += EMA_ALPHA * (rawTension - this.smoothedTension);

    // Novelty
    const novelty = this.computeNovelty();

    // Rhythmic pattern
    const rhythmicPattern = detectRhythmicPattern(this.onsetTimestamps, features.tempo);

    // Chord progression (simplified)
    const chordProgression = this.estimateChordProgression();

    return {
      key: this.currentKey,
      mode: this.currentMode,
      chordProgression,
      rhythmicPattern,
      dynamicContour,
      phrasePosition,
      energyLevel: Math.min(1, Math.max(0, this.smoothedEnergy)),
      harmonicTension: Math.min(1, Math.max(0, this.smoothedTension)),
      novelty: Math.min(1, Math.max(0, novelty)),
    };
  }

  private computeDynamicContour(): MusicalState['dynamicContour'] {
    if (this.rmsHistory.length < 10) return 'silence';
    const recent = this.rmsHistory.slice(-10);
    const avg = recent.reduce((s, v) => s + v, 0) / recent.length;
    if (avg < RMS_SILENCE_THRESHOLD) return 'silence';

    const firstHalf = recent.slice(0, 5).reduce((s, v) => s + v, 0) / 5;
    const secondHalf = recent.slice(5).reduce((s, v) => s + v, 0) / 5;
    const delta = secondHalf - firstHalf;

    if (delta > 0.01) return 'building';
    if (delta < -0.01) return 'fading';
    return 'sustaining';
  }

  private computePhrasePosition(now: number): MusicalState['phrasePosition'] {
    if (!this.inPhrase) return 'between';
    const elapsed = now - this.phraseStartTime;
    const ratio = elapsed / this.averagePhraseLength;
    if (ratio < 0.2) return 'beginning';
    if (ratio > 0.8) return 'end';
    return 'middle';
  }

  private computeNoteDensity(now: number): number {
    const windowMs = 4000;
    const recentOnsets = this.onsetTimestamps.filter(t => now - t < windowMs);
    return Math.min(1, recentOnsets.length / 16);
  }

  private computePitchRange(): number {
    if (this.recentPitches.length < 2) return 0;
    const recent = this.recentPitches.slice(-20);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    return Math.min(1, (max - min) / 36);
  }

  private computeHarmonicTension(): number {
    if (this.recentIntervals.length === 0) return 0;
    const consonanceMap: Record<number, number> = {
      0: 1.0, 7: 0.85, 5: 0.8, 4: 0.7, 3: 0.7, 8: 0.7, 9: 0.7,
      2: 0.3, 10: 0.3, 1: 0.2, 11: 0.2, 6: 0.1,
    };
    let totalDissonance = 0;
    for (const interval of this.recentIntervals) {
      const consonance = consonanceMap[interval] ?? 0.5;
      totalDissonance += 1 - consonance;
    }
    return totalDissonance / this.recentIntervals.length;
  }

  private computeNovelty(): number {
    const currentWindow = this.pitchClassHistogram.slice();
    if (this.previousFeatureWindow.length === 0) {
      this.previousFeatureWindow = currentWindow;
      return 0;
    }
    const similarity = this.cosineSim(currentWindow, this.previousFeatureWindow);
    // Slowly update previous window
    for (let i = 0; i < 12; i++) {
      this.previousFeatureWindow[i] = this.previousFeatureWindow[i] * 0.95 + currentWindow[i] * 0.05;
    }
    return 1 - Math.max(0, similarity);
  }

  private cosineSim(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  private estimateChordProgression(): string[] {
    // Simplified: return the current key's root as a basic chord
    const parts = this.currentKey.split(' ');
    const root = parts[0] ?? 'C';
    const quality = this.currentMode === 'minor' ? 'm' : '';
    return [`${root}${quality}`];
  }
}
