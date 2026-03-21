import { PitchDetector } from 'pitchy';
import type { AudioFeatures } from './types';
import type { AudioCapture } from './AudioCapture';
import { hzToMidi, midiToNoteName } from './utils';

const EXTRACTION_INTERVAL_MS = 50;
const PITCH_CLARITY_THRESHOLD = 0.9;
const ONSET_RMS_DELTA_THRESHOLD = 0.02;
const ONSET_MIN_VOLUME = 0.01;
const ONSET_COOLDOWN_MS = 100;
const ONSET_BUFFER_SIZE = 30;
const TEMPO_BIN_SIZE_MS = 10;
const TEMPO_MIN_BPM = 40;
const TEMPO_MAX_BPM = 240;

export class AudioFeatureExtractor {
  private audioCapture: AudioCapture;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private sessionStartTime = 0;
  private previousRms = 0;
  private lastOnsetTime = 0;
  private onsetTimestamps: number[] = [];
  private onsetWriteIndex = 0;
  private onsetCount = 0;
  private pitchDetector: PitchDetector<Float32Array> | null = null;

  constructor(audioCapture: AudioCapture) {
    this.audioCapture = audioCapture;
  }

  /**
   * Begin extracting features at 50ms intervals.
   * Each frame invokes the callback with the latest AudioFeatures.
   */
  start(onFeatures: (features: AudioFeatures) => void): void {
    this.sessionStartTime = performance.now();
    this.previousRms = 0;
    this.lastOnsetTime = 0;
    this.onsetTimestamps = new Array<number>(ONSET_BUFFER_SIZE).fill(0);
    this.onsetWriteIndex = 0;
    this.onsetCount = 0;
    this.pitchDetector = null;

    this.intervalId = setInterval(() => {
      const features = this.extract();
      if (features) {
        onFeatures(features);
      }
    }, EXTRACTION_INTERVAL_MS);
  }

  /**
   * Stop the extraction loop.
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.pitchDetector = null;
  }

  private extract(): AudioFeatures | null {
    const ctx = this.audioCapture.getAudioContext();
    if (!ctx) return null;

    const timeDomainData = this.audioCapture.getTimeDomainData();
    if (timeDomainData.length === 0) return null;

    const frequencyData = this.audioCapture.getFrequencyData();
    const sampleRate = ctx.sampleRate;
    const fftSize = timeDomainData.length;
    const now = performance.now();
    const timestamp = now - this.sessionStartTime;

    // Pitch detection
    const { pitch, clarity } = this.detectPitch(timeDomainData, sampleRate);
    const validPitch = clarity > PITCH_CLARITY_THRESHOLD ? pitch : 0;
    const midiNote = hzToMidi(validPitch);
    const noteName = validPitch > 0 ? midiToNoteName(midiNote) : '';

    // RMS
    const rms = this.computeRms(timeDomainData);

    // Onset detection
    const onset = this.detectOnset(rms, now);
    if (onset) {
      this.recordOnset(now);
    }

    // Spectral centroid
    const spectralCentroid = this.computeSpectralCentroid(frequencyData, sampleRate, fftSize);

    // Tempo estimation
    const tempo = this.estimateTempo();

    this.previousRms = rms;

    return {
      pitch: validPitch,
      midiNote,
      noteName,
      rms,
      spectralCentroid,
      onset,
      tempo,
      timestamp,
    };
  }

  private detectPitch(timeDomainData: Float32Array, sampleRate: number): { pitch: number; clarity: number } {
    if (!this.pitchDetector || this.pitchDetector.inputLength !== timeDomainData.length) {
      this.pitchDetector = PitchDetector.forFloat32Array(timeDomainData.length);
    }
    const [pitch, clarity] = this.pitchDetector.findPitch(timeDomainData, sampleRate);
    return { pitch, clarity };
  }

  private computeRms(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  private detectOnset(currentRms: number, now: number): boolean {
    const delta = currentRms - this.previousRms;
    if (
      delta > ONSET_RMS_DELTA_THRESHOLD &&
      currentRms > ONSET_MIN_VOLUME &&
      now - this.lastOnsetTime > ONSET_COOLDOWN_MS
    ) {
      this.lastOnsetTime = now;
      return true;
    }
    return false;
  }

  private recordOnset(time: number): void {
    this.onsetTimestamps[this.onsetWriteIndex] = time;
    this.onsetWriteIndex = (this.onsetWriteIndex + 1) % ONSET_BUFFER_SIZE;
    if (this.onsetCount < ONSET_BUFFER_SIZE) {
      this.onsetCount++;
    }
  }

  private computeSpectralCentroid(frequencyData: Float32Array, sampleRate: number, fftSize: number): number {
    let weightedSum = 0;
    let magnitudeSum = 0;

    for (let i = 0; i < frequencyData.length; i++) {
      // Convert dB to linear magnitude
      const magnitude = Math.pow(10, frequencyData[i] / 20);
      const frequency = (i * sampleRate) / fftSize;
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }

    if (magnitudeSum === 0) return 0;
    return weightedSum / magnitudeSum;
  }

  private estimateTempo(): number {
    if (this.onsetCount < 3) return 0;

    // Collect valid onset timestamps in chronological order
    const sorted = this.getSortedOnsets();

    // Compute inter-onset intervals
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const interval = sorted[i] - sorted[i - 1];
      if (interval > 0) {
        intervals.push(interval);
      }
    }

    if (intervals.length === 0) return 0;

    // Build histogram quantized to 10ms bins
    const histogram = new Map<number, number>();
    let maxCount = 0;
    let dominantBin = 0;

    for (const interval of intervals) {
      const bin = Math.round(interval / TEMPO_BIN_SIZE_MS) * TEMPO_BIN_SIZE_MS;
      if (bin === 0) continue;
      const count = (histogram.get(bin) ?? 0) + 1;
      histogram.set(bin, count);
      if (count > maxCount) {
        maxCount = count;
        dominantBin = bin;
      }
    }

    if (dominantBin === 0) return 0;

    const bpm = 60000 / dominantBin;
    return Math.max(TEMPO_MIN_BPM, Math.min(TEMPO_MAX_BPM, bpm));
  }

  private getSortedOnsets(): number[] {
    const timestamps: number[] = [];
    for (let i = 0; i < this.onsetCount; i++) {
      timestamps.push(this.onsetTimestamps[i]);
    }
    timestamps.sort((a, b) => a - b);
    return timestamps;
  }
}
