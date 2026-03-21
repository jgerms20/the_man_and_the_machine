import { create } from 'zustand';
import type { AudioFeatures } from '../audio/types';

interface AudioState {
  isListening: boolean;
  features: AudioFeatures | null;
  inputDevices: MediaDeviceInfo[];
  selectedDeviceId: string;

  setIsListening: (isListening: boolean) => void;
  setFeatures: (features: AudioFeatures | null) => void;
  setInputDevices: (devices: MediaDeviceInfo[]) => void;
  setSelectedDeviceId: (id: string) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  isListening: false,
  features: null,
  inputDevices: [],
  selectedDeviceId: '',

  setIsListening: (isListening) => set({ isListening }),
  setFeatures: (features) => set({ features }),
  setInputDevices: (inputDevices) => set({ inputDevices }),
  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
}));
