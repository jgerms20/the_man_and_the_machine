import { AudioCapture } from '../audio/AudioCapture';
import { AudioFeatureExtractor } from '../audio/AudioFeatureExtractor';
import type { AudioFeatures } from '../audio/types';
import { MidiInput } from '../audio/MidiInput';
import { MusicalAnalysisEngine } from '../analysis/MusicalAnalysisEngine';
import { ChordDetector } from '../analysis/ChordDetector';
import type { MusicalState } from '../analysis/types';
import { AIDecisionEngine } from '../ai/AIDecisionEngine';
import type { AIModeName } from '../ai/types';
import { EffectsChain } from '../synth/EffectsChain';
import { VoicePool } from '../synth/VoicePool';
import { DrumEngine } from '../synth/DrumEngine';
import { getPresetForMode } from '../synth/SynthPresets';
import { SessionRecorder } from '../session/SessionRecorder';
import { HighlightDetector } from '../session/HighlightDetector';
import { saveSession } from '../session/SessionStorage';
import { exportWAV, exportMIDI, downloadBlob } from '../session/SessionExporter';
import type { SessionData } from '../session/SessionRecorder';
import { useAudioStore } from '../stores/audioStore';
import { useSessionStore } from '../stores/sessionStore';

export class SessionEngine {
  private readonly audioCapture: AudioCapture;
  private readonly featureExtractor: AudioFeatureExtractor;
  private readonly analysisEngine: MusicalAnalysisEngine;
  private readonly chordDetector: ChordDetector;
  private readonly aiEngine: AIDecisionEngine;
  private readonly effectsChain: EffectsChain;
  private readonly voicePool: VoicePool;
  private readonly drumEngine: DrumEngine;
  private readonly midiInput: MidiInput;
  private readonly recorder: SessionRecorder;
  private readonly highlightDetector: HighlightDetector;

  private _intensity: number = 75;
  private _aiEnabled: boolean = false;
  private _isRecording: boolean = false;
  private _lastMusicalState: MusicalState | null = null;
  private _midiCleanup: (() => void) | null = null;

  constructor() {
    this.audioCapture = new AudioCapture();
    this.featureExtractor = new AudioFeatureExtractor(this.audioCapture);
    this.analysisEngine = new MusicalAnalysisEngine();
    this.chordDetector = new ChordDetector();
    this.aiEngine = new AIDecisionEngine('listen');
    this.effectsChain = new EffectsChain();
    this.voicePool = new VoicePool(this.effectsChain);
    this.drumEngine = new DrumEngine();
    this.midiInput = new MidiInput();
    this.recorder = new SessionRecorder('listen');
    this.highlightDetector = new HighlightDetector();

    // Wire callbacks for interpret and suggest modes
    this.aiEngine.interpretMode.setCallback((text) => {
      useSessionStore.getState().setInterpretText(text);
    });
    this.aiEngine.suggestMode.setCallback((data) => {
      useSessionStore.getState().setSuggestData(data);
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async start(deviceId?: string): Promise<void> {
    const devices = await AudioCapture.getInputDevices();
    useAudioStore.getState().setInputDevices(devices);

    await this.audioCapture.start(deviceId);
    await this.voicePool.ensureStarted();
    await this.drumEngine.ensureStarted();

    const initialMode = useSessionStore.getState().aiMode;
    this.voicePool.setTimbre(getPresetForMode(initialMode));

    // Sync AI enabled state
    this._aiEnabled = useSessionStore.getState().aiEnabled;

    // Start MIDI input (non-blocking — not all browsers support it)
    this._startMidi();

    useAudioStore.getState().setIsListening(true);
    useSessionStore.getState().setIsPlaying(true);
    useSessionStore.getState().setSessionStartTime(Date.now());

    this.featureExtractor.start((features: AudioFeatures) => {
      this._onFeatures(features);
    });
  }

  stop(): void {
    this.featureExtractor.stop();
    this.audioCapture.stop();
    this.voicePool.stopAll();

    if (this._isRecording) {
      void this._finaliseRecording();
    }

    useAudioStore.getState().setIsListening(false);
    useAudioStore.getState().setFeatures(null);
    useSessionStore.getState().setIsPlaying(false);
    useSessionStore.getState().setMusicalState(null);
    useSessionStore.getState().setAiDecision(null);
    useSessionStore.getState().setSessionStartTime(null);
    useSessionStore.getState().setDetectedChord(null);
    useSessionStore.getState().setInterpretText('');
    useSessionStore.getState().setSuggestData(null);
  }

  // ── MIDI ───────────────────────────────────────────────────────────────────

  private _startMidi(): void {
    if (!this.midiInput.isSupported) return;

    void this.midiInput.start().then((ok) => {
      useAudioStore.getState().setMidiAvailable(ok);
      if (ok) {
        useAudioStore.getState().setMidiDevices(this.midiInput.devices);
      }
    });

    // Note callbacks
    const unsubNote = this.midiInput.onNote((event) => {
      if (event.velocity > 0) {
        // Note On — play through synth and update store
        useAudioStore.getState().setMidiNote(event.note, event.velocity);
        this.voicePool.playNote(event.note, 0.3, event.velocity / 127);
      } else {
        // Note Off
        useAudioStore.getState().setMidiNote(null, 0);
      }
    });

    // CC callbacks — map knobs to intensity/volume
    const unsubCC = this.midiInput.onCC((event) => {
      // MPK Mini knobs are typically CC 1-8
      if (event.controller === 1) {
        // Knob 1 → AI intensity
        const val = Math.round((event.value / 127) * 100);
        this.setIntensity(val);
      } else if (event.controller === 2) {
        // Knob 2 → volume
        const val = Math.round((event.value / 127) * 100);
        this.setVolume(val);
      }
    });

    const unsubDevice = this.midiInput.onDeviceChange((devices) => {
      useAudioStore.getState().setMidiDevices(devices);
    });

    this._midiCleanup = () => {
      unsubNote();
      unsubCC();
      unsubDevice();
      this.midiInput.stop();
    };
  }

  // ── Main processing loop ─────────────────────────────────────────────────────

  private _onFeatures(features: AudioFeatures): void {
    const musicalState = this.analysisEngine.update(features);
    this._lastMusicalState = musicalState;

    // Always run chord detection regardless of mode
    const chord = this.chordDetector.update(features.midiNote, features.rms);
    useSessionStore.getState().setDetectedChord(chord);

    const intensityNorm = this._intensity / 100;

    // For passive modes (listen/interpret/suggest), always run decide() so callbacks fire.
    // For AI modes, only run if aiEnabled.
    const shouldDecide = this.aiEngine.isPassiveMode || this._aiEnabled;
    const decision = shouldDecide
      ? this.aiEngine.decide(musicalState, features, intensityNorm)
      : null;

    const aiIsPlaying = decision !== null && decision.notes.length > 0;
    if (aiIsPlaying) {
      // Route drum mode notes to the DrumEngine, everything else to VoicePool
      if (this.aiEngine.isDrumMode) {
        this.drumEngine.playNotes(decision.notes);
      } else {
        this.voicePool.playNotes(decision.notes);
      }
    }

    if (this._isRecording) {
      if (decision) {
        this.recorder.logAIEvent(decision);
      }
      if (features.timestamp % 500 < 50) {
        this.recorder.logMusicalState(musicalState);
      }
    }

    const highlight = this.highlightDetector.update(
      musicalState,
      features.rms,
      aiIsPlaying,
    );
    if (highlight && this._isRecording) {
      this.recorder.addHighlight(highlight);
    }

    useAudioStore.getState().setFeatures(features);
    useSessionStore.getState().setMusicalState(musicalState);
    useSessionStore.getState().setAiDecision(decision);
  }

  // ── Controls ─────────────────────────────────────────────────────────────────

  setMode(mode: AIModeName): void {
    const prev = useSessionStore.getState().aiMode;
    if (prev === mode) return;

    this.aiEngine.setMode(mode);

    // Only set voice timbre for AI modes that produce sound
    if (!this.aiEngine.isPassiveMode) {
      this.voicePool.setTimbre(getPresetForMode(mode));
    }

    // Clear chord detector when switching modes
    this.chordDetector.reset();

    if (this._isRecording) {
      this.recorder.logModeChange(prev, mode);
    }

    useSessionStore.getState().setAiMode(mode);

    // Auto-enable AI when switching to an AI mode
    const isPassive = mode === 'listen' || mode === 'interpret' || mode === 'suggest';
    if (!isPassive && !this._aiEnabled) {
      // Don't auto-enable — let the user toggle intentionally
    }

    // Clear interpret/suggest state when leaving those modes
    if (mode !== 'interpret') {
      useSessionStore.getState().setInterpretText('');
    }
    if (mode !== 'suggest') {
      useSessionStore.getState().setSuggestData(null);
    }
  }

  setIntensity(value: number): void {
    this._intensity = Math.max(0, Math.min(100, value));
    useSessionStore.getState().setIntensity(this._intensity);
  }

  setVolume(value: number): void {
    const clamped = Math.max(0, Math.min(100, value));
    const db = clamped === 0 ? -60 : (clamped / 100) * 60 - 60;
    this.effectsChain.setVolume(db);
    this.drumEngine.setVolume(db);
    useSessionStore.getState().setVolume(clamped);
  }

  setAiEnabled(enabled: boolean): void {
    this._aiEnabled = enabled;
    if (!enabled) {
      this.voicePool.stopAll();
    }
    useSessionStore.getState().setAiEnabled(enabled);
  }

  toggleAiEnabled(): void {
    this.setAiEnabled(!this._aiEnabled);
  }

  /** Cycle drum pattern (only relevant in drums mode) */
  nextDrumPattern(): string {
    const name = this.aiEngine.drumMode.nextPattern();
    useSessionStore.getState().setDrumPattern(name);
    return name;
  }

  // ── Recording ────────────────────────────────────────────────────────────────

  startRecording(): void {
    if (this._isRecording) return;

    const stream = (this.audioCapture as unknown as {
      destinationNode: { stream: MediaStream } | null;
    }).destinationNode?.stream;

    if (!stream) {
      console.warn('SessionEngine: no audio stream available for recording');
      return;
    }

    this._isRecording = true;
    this.recorder.start(stream);
    useSessionStore.getState().setIsRecording(true);
  }

  stopRecording(): void {
    if (!this._isRecording) return;
    this._isRecording = false;
    useSessionStore.getState().setIsRecording(false);
    void this._finaliseRecording();
  }

  private async _finaliseRecording(): Promise<void> {
    try {
      const data: SessionData = await this.recorder.stop();
      await saveSession(data);
      console.info(`SessionEngine: session "${data.id}" saved (${data.duration}ms)`);
    } catch (err) {
      console.error('SessionEngine: failed to finalise recording', err);
    }
  }

  // ── Export ───────────────────────────────────────────────────────────────────

  async exportCurrentSession(): Promise<void> {
    const state = useSessionStore.getState();
    const now = Date.now();
    const startTime = state.sessionStartTime ?? now;

    const syntheticData: SessionData = {
      id: `export-${now}`,
      startTime,
      duration: now - startTime,
      aiMode: state.aiMode,
      modeChanges: [],
      aiEvents: state.aiDecision ? [{ time: 0, decision: state.aiDecision }] : [],
      musicalStates: this._lastMusicalState
        ? [{ time: 0, state: this._lastMusicalState }]
        : [],
      highlights: [],
      audioBlob: null,
    };

    try {
      const midiBlob = exportMIDI(syntheticData);
      downloadBlob(midiBlob, `session-${now}.mid`);
    } catch (err) {
      console.warn('SessionEngine: MIDI export failed', err);
    }

    try {
      const wavBlob = await exportWAV(syntheticData);
      downloadBlob(wavBlob, `session-${now}.wav`);
    } catch {
      // No audio blob available during a live session — expected
    }
  }

  // ── Accessors ────────────────────────────────────────────────────────────────

  getAudioCapture(): AudioCapture {
    return this.audioCapture;
  }

  dispose(): void {
    this.stop();
    this._midiCleanup?.();
    this.voicePool.dispose();
    this.effectsChain.dispose();
    this.drumEngine.dispose();
  }
}
