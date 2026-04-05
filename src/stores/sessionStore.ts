import { create } from 'zustand';
import type { AIModeName, AIDecision } from '../ai/types';
import type { MusicalState } from '../analysis/types';
import type { DetectedChord } from '../analysis/ChordDetector';
import type { SuggestData } from '../ai/modes/SuggestMode';

interface SessionState {
  aiMode: AIModeName;
  intensity: number;
  volume: number;
  isPlaying: boolean;
  isRecording: boolean;
  sessionStartTime: number | null;
  musicalState: MusicalState | null;
  aiDecision: AIDecision | null;
  drumPattern: string;

  /** Whether the AI is actively producing sound (can be toggled separately from play/pause) */
  aiEnabled: boolean;

  /** The most recently detected chord */
  detectedChord: DetectedChord | null;

  /** Interpretation text from InterpretMode */
  interpretText: string;

  /** Harmonic suggestions from SuggestMode */
  suggestData: SuggestData | null;

  setAiMode: (mode: AIModeName) => void;
  setIntensity: (intensity: number) => void;
  setVolume: (volume: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setIsRecording: (isRecording: boolean) => void;
  setSessionStartTime: (time: number | null) => void;
  setMusicalState: (state: MusicalState | null) => void;
  setAiDecision: (decision: AIDecision | null) => void;
  setDrumPattern: (pattern: string) => void;
  setAiEnabled: (enabled: boolean) => void;
  setDetectedChord: (chord: DetectedChord | null) => void;
  setInterpretText: (text: string) => void;
  setSuggestData: (data: SuggestData | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  aiMode: 'listen',
  intensity: 75,
  volume: 50,
  isPlaying: false,
  isRecording: false,
  sessionStartTime: null,
  musicalState: null,
  aiDecision: null,
  drumPattern: 'rock',
  aiEnabled: false,
  detectedChord: null,
  interpretText: '',
  suggestData: null,

  setAiMode: (aiMode) => set({ aiMode }),
  setIntensity: (intensity) => set({ intensity }),
  setVolume: (volume) => set({ volume }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setSessionStartTime: (sessionStartTime) => set({ sessionStartTime }),
  setMusicalState: (musicalState) => set({ musicalState }),
  setAiDecision: (aiDecision) => set({ aiDecision }),
  setDrumPattern: (drumPattern) => set({ drumPattern }),
  setAiEnabled: (aiEnabled) => set({ aiEnabled }),
  setDetectedChord: (detectedChord) => set({ detectedChord }),
  setInterpretText: (interpretText) => set({ interpretText }),
  setSuggestData: (suggestData) => set({ suggestData }),
}));
