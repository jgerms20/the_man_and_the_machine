export interface SynthParams {
  type: 'fm' | 'am' | 'subtractive' | 'pluck' | 'membrane';
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filterFrequency: number;
  filterResonance: number;
  reverbWet: number;
  delayTime: number;
  delayFeedback: number;
}
