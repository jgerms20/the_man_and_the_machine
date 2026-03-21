import type { AIModeName } from '../ai/types';
import type { SynthParams } from './types';

const SUPPORTIVE: SynthParams = {
  type: 'fm',
  attack: 0.3,
  decay: 0.5,
  sustain: 0.8,
  release: 1.0,
  filterFrequency: 2000,
  filterResonance: 1,
  reverbWet: 0.4,
  delayTime: 0.3,
  delayFeedback: 0.2,
};

const CHALLENGER: SynthParams = {
  type: 'am',
  attack: 0.05,
  decay: 0.3,
  sustain: 0.5,
  release: 0.5,
  filterFrequency: 3000,
  filterResonance: 2,
  reverbWet: 0.25,
  delayTime: 0.2,
  delayFeedback: 0.3,
};

const ADVERSARY: SynthParams = {
  type: 'subtractive',
  attack: 0.01,
  decay: 0.15,
  sustain: 0.2,
  release: 0.2,
  filterFrequency: 5000,
  filterResonance: 3,
  reverbWet: 0.1,
  delayTime: 0.1,
  delayFeedback: 0.1,
};

const MIRROR: SynthParams = {
  type: 'fm',
  attack: 0.005,
  decay: 0.8,
  sustain: 0.3,
  release: 1.5,
  filterFrequency: 6000,
  filterResonance: 1,
  reverbWet: 0.6,
  delayTime: 0.4,
  delayFeedback: 0.4,
};

const FREE: SynthParams = {
  type: 'subtractive',
  attack: 0.05,
  decay: 0.4,
  sustain: 0.6,
  release: 0.8,
  filterFrequency: 3500,
  filterResonance: 2,
  reverbWet: 0.35,
  delayTime: 0.25,
  delayFeedback: 0.25,
};

// Drums mode uses the DrumEngine directly, but we still need a preset
// for the effects chain (kept neutral / minimal)
const DRUMS: SynthParams = {
  type: 'membrane',
  attack: 0.001,
  decay: 0.2,
  sustain: 0.0,
  release: 0.1,
  filterFrequency: 8000,
  filterResonance: 0.5,
  reverbWet: 0.15,
  delayTime: 0.0,
  delayFeedback: 0.0,
};

// Assisted mode — warm, gentle bass tone
const ASSISTED: SynthParams = {
  type: 'fm',
  attack: 0.15,
  decay: 0.6,
  sustain: 0.7,
  release: 1.2,
  filterFrequency: 1200,
  filterResonance: 0.8,
  reverbWet: 0.5,
  delayTime: 0.0,
  delayFeedback: 0.0,
};

const PRESET_MAP: Record<AIModeName, SynthParams> = {
  supportive: SUPPORTIVE,
  challenger: CHALLENGER,
  adversary: ADVERSARY,
  mirror: MIRROR,
  free: FREE,
  drums: DRUMS,
  assisted: ASSISTED,
};

export function getPresetForMode(mode: AIModeName): SynthParams {
  return { ...PRESET_MAP[mode] };
}

export function interpolatePresets(
  from: SynthParams,
  to: SynthParams,
  t: number,
): SynthParams {
  const clampedT = Math.min(1, Math.max(0, t));
  const lerp = (a: number, b: number): number => a + (b - a) * clampedT;

  return {
    type: clampedT < 0.5 ? from.type : to.type,
    attack: lerp(from.attack, to.attack),
    decay: lerp(from.decay, to.decay),
    sustain: lerp(from.sustain, to.sustain),
    release: lerp(from.release, to.release),
    filterFrequency: lerp(from.filterFrequency, to.filterFrequency),
    filterResonance: lerp(from.filterResonance, to.filterResonance),
    reverbWet: lerp(from.reverbWet, to.reverbWet),
    delayTime: lerp(from.delayTime, to.delayTime),
    delayFeedback: lerp(from.delayFeedback, to.delayFeedback),
  };
}
