import { create } from 'zustand';
import type { AIModeName, AIDecision } from '../ai/types';
import type { MusicalState } from '../analysis/types';

interface SessionState {
  aiMode: AIModeName;
  intensity: number;
  volume: number;
  isPlaying: boolean;
  isRecording: boolean;
  sessionStartTime: number | null;
  musicalState: MusicalState | null;
  aiDecision: AIDecision | null;
  drumPattern: string;         // current drum pattern name

  setAiMode: (mode: AIModeName) => void;
  setIntensity: (intensity: number) => void;
  setVolume: (volume: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setIsRecording: (isRecording: boolean) => void;
  setSessionStartTime: (time: number | null) => void;
  setMusicalState: (state: MusicalState | null) => void;
  setAiDecision: (decision: AIDecision | null) => void;
  setDrumPattern: (pattern: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  aiMode: 'assisted',
  intensity: 75,
  volume: 50,
  isPlaying: false,
  isRecording: false,
  sessionStartTime: null,
  musicalState: null,
  aiDecision: null,
  drumPattern: 'rock',

  setAiMode: (aiMode) => set({ aiMode }),
  setIntensity: (intensity) => set({ intensity }),
  setVolume: (volume) => set({ volume }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setSessionStartTime: (sessionStartTime) => set({ sessionStartTime }),
  setMusicalState: (musicalState) => set({ musicalState }),
  setAiDecision: (aiDecision) => set({ aiDecision }),
  setDrumPattern: (drumPattern) => set({ drumPattern }),
}));
