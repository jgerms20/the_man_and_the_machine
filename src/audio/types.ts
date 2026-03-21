export interface AudioFeatures {
  pitch: number;
  midiNote: number;
  noteName: string;
  rms: number;
  spectralCentroid: number;
  onset: boolean;
  tempo: number;
  timestamp: number;
}
