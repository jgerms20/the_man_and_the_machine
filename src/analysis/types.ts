export interface MusicalState {
  key: string;
  mode: string;
  chordProgression: string[];
  rhythmicPattern: number[];
  dynamicContour: 'building' | 'sustaining' | 'fading' | 'silence';
  phrasePosition: 'beginning' | 'middle' | 'end' | 'between';
  energyLevel: number;
  harmonicTension: number;
  novelty: number;
}
