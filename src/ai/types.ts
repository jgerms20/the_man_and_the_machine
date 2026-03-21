import type { MusicalState } from '../analysis/types';
import type { AudioFeatures } from '../audio/types';

export type AIModeName = 'supportive' | 'challenger' | 'adversary' | 'mirror' | 'free' | 'drums' | 'assisted';

export interface NoteEvent {
  pitch: number;      // MIDI note
  duration: number;   // ms
  velocity: number;   // 0-1
}

export interface AIDecision {
  notes: NoteEvent[];
  timing: number;
  velocity: number;
  articulation: 'legato' | 'staccato' | 'accent' | 'ghost';
}

export interface AIMode {
  name: AIModeName;
  decide(state: MusicalState, features: AudioFeatures, intensity: number): AIDecision | null;
  reset(): void;
}
