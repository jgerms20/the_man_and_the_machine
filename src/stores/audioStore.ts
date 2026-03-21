import { create } from 'zustand';
import type { AudioFeatures } from '../audio/types';
import type { MidiDevice } from '../audio/MidiInput';

interface AudioState {
  isListening: boolean;
  features: AudioFeatures | null;
  inputDevices: MediaDeviceInfo[];
  selectedDeviceId: string;

  // MIDI controller state
  midiAvailable: boolean;
  midiDevices: MidiDevice[];
  midiNote: number | null;      // currently held MIDI note
  midiVelocity: number;         // 0-127

  setIsListening: (isListening: boolean) => void;
  setFeatures: (features: AudioFeatures | null) => void;
  setInputDevices: (devices: MediaDeviceInfo[]) => void;
  setSelectedDeviceId: (id: string) => void;
  setMidiAvailable: (available: boolean) => void;
  setMidiDevices: (devices: MidiDevice[]) => void;
  setMidiNote: (note: number | null, velocity?: number) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  isListening: false,
  features: null,
  inputDevices: [],
  selectedDeviceId: '',
  midiAvailable: false,
  midiDevices: [],
  midiNote: null,
  midiVelocity: 0,

  setIsListening: (isListening) => set({ isListening }),
  setFeatures: (features) => set({ features }),
  setInputDevices: (inputDevices) => set({ inputDevices }),
  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
  setMidiAvailable: (midiAvailable) => set({ midiAvailable }),
  setMidiDevices: (midiDevices) => set({ midiDevices }),
  setMidiNote: (note, velocity = 0) => set({ midiNote: note, midiVelocity: velocity }),
}));
