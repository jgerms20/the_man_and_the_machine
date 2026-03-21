import { AudioCapture } from '../audio/AudioCapture';
import { AudioFeatureExtractor } from '../audio/AudioFeatureExtractor';
import type { AudioFeatures } from '../audio/types';
import { MusicalAnalysisEngine } from '../analysis/MusicalAnalysisEngine';
import type { MusicalState } from '../analysis/types';
import { AIDecisionEngine } from '../ai/AIDecisionEngine';
import type { AIModeName } from '../ai/types';
import { EffectsChain } from '../synth/EffectsChain';
import { VoicePool } from '../synth/VoicePool';
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
  private readonly aiEngine: AIDecisionEngine;
  private readonly effectsChain: EffectsChain;
  private readonly voicePool: VoicePool;
  private readonly recorder: SessionRecorder;
  private readonly highlightDetector: HighlightDetector;

  // Internal mutable state (mirrors store but avoids closure staleness)
  private _intensity: number = 75;
  private _isRecording: boolean = false;
  private _lastMusicalState: MusicalState | null = null;

  constructor() {
    this.audioCapture = new AudioCapture();
    this.featureExtractor = new AudioFeatureExtractor(this.audioCapture);
    this.analysisEngine = new MusicalAnalysisEngine();
    this.aiEngine = new AIDecisionEngine();
    this.effectsChain = new EffectsChain();
    this.voicePool = new VoicePool(this.effectsChain);
    this.recorder = new SessionRecorder('supportive');
    this.highlightDetector = new HighlightDetector();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async start(deviceId?: string): Promise<void> {
    // Enumerate devices and update store
    const devices = await AudioCapture.getInputDevices();
    useAudioStore.getState().setInputDevices(devices);

    // Start audio capture
    await this.audioCapture.start(deviceId);

    // Ensure Tone.js AudioContext is running (requires user gesture)
    await this.voicePool.ensureStarted();

    // Apply initial timbre preset
    const initialMode = useSessionStore.getState().aiMode;
    this.voicePool.setTimbre(getPresetForMode(initialMode));

    // Update stores
    useAudioStore.getState().setIsListening(true);
    useSessionStore.getState().setIsPlaying(true);
    useSessionStore.getState().setSessionStartTime(Date.now());

    // Start extraction loop — main processing callback runs every 50ms
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
  }

  // ── Main processing loop ─────────────────────────────────────────────────────

  private _onFeatures(features: AudioFeatures): void {
    // 1. Update musical analysis
    const musicalState = this.analysisEngine.update(features);
    this._lastMusicalState = musicalState;

    // 2. AI decision
    const intensityNorm = this._intensity / 100;
    const decision = this.aiEngine.decide(musicalState, features, intensityNorm);
    // 3. Play notes if we have a decision
    const aiIsPlaying = decision !== null && decision.notes.length > 0;
    if (aiIsPlaying) {
      this.voicePool.playNotes(decision.notes);
    }

    // 4. Log to recorder if active
    if (this._isRecording) {
      if (decision) {
        this.recorder.logAIEvent(decision);
      }
      // Log musical state at a reduced rate (~every 500ms) to avoid bloat
      if (features.timestamp % 500 < 50) {
        this.recorder.logMusicalState(musicalState);
      }
    }

    // 5. Detect highlights
    const highlight = this.highlightDetector.update(
      musicalState,
      features.rms,
      aiIsPlaying,
    );
    if (highlight && this._isRecording) {
      this.recorder.addHighlight(highlight);
    }

    // 6. Update stores (drives reactive UI)
    useAudioStore.getState().setFeatures(features);
    useSessionStore.getState().setMusicalState(musicalState);
    useSessionStore.getState().setAiDecision(decision);
  }

  // ── Controls ─────────────────────────────────────────────────────────────────

  setMode(mode: AIModeName): void {
    const prev = useSessionStore.getState().aiMode;
    if (prev === mode) return;

    this.aiEngine.setMode(mode);
    this.voicePool.setTimbre(getPresetForMode(mode));

    if (this._isRecording) {
      this.recorder.logModeChange(prev, mode);
    }

    useSessionStore.getState().setAiMode(mode);
  }

  setIntensity(value: number): void {
    this._intensity = Math.max(0, Math.min(100, value));
    useSessionStore.getState().setIntensity(this._intensity);
  }

  /**
   * Set master output volume. `value` is 0–100 (percentage).
   * Mapped to dB: 0% = -60 dB (near silence), 100% = 0 dB (unity gain).
   */
  setVolume(value: number): void {
    const clamped = Math.max(0, Math.min(100, value));
    // Linear percentage → dB: 0% maps to -60, 100% maps to 0
    const db = clamped === 0 ? -60 : (clamped / 100) * 60 - 60;
    this.effectsChain.setVolume(db);
    useSessionStore.getState().setVolume(clamped);
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
    // Build a synthetic SessionData from in-memory state for mid-session export,
    // or from the last completed recording if one exists.
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
    this.voicePool.dispose();
    this.effectsChain.dispose();
  }
}
