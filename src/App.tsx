import { useRef, useState, useEffect, useCallback } from 'react';
import './index.css';
import { SessionEngine } from './core/SessionEngine';
import { useAudioStore } from './stores/audioStore';
import { useSessionStore } from './stores/sessionStore';
import { StartButton } from './components/StartButton';
import { AudioFeaturesPanel } from './components/AudioFeaturesPanel';
import { InputDeviceSelector } from './components/InputDeviceSelector';
import { ModeSelector } from './components/ModeSelector';
import { IntensitySlider } from './components/IntensitySlider';
import { VolumeSlider } from './components/VolumeSlider';
import { SessionInfo } from './components/SessionInfo';
import { TransportControls } from './components/TransportControls';
import { Visualization } from './components/Visualization';
import type { AIModeName } from './ai/types';

// Ordered to match keyboard shortcuts 1–5
const AI_MODES: AIModeName[] = ['supportive', 'challenger', 'adversary', 'mirror', 'free'];

export function App() {
  // ── Engine singleton ─────────────────────────────────────────────────────────
  const engineRef = useRef<SessionEngine | null>(null);

  // ── Local UI state ───────────────────────────────────────────────────────────
  const [sessionStarted, setSessionStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // ── Audio store ──────────────────────────────────────────────────────────────
  const features      = useAudioStore((s) => s.features);
  const inputDevices  = useAudioStore((s) => s.inputDevices);
  const selectedDeviceId = useAudioStore((s) => s.selectedDeviceId);

  // ── Session store ────────────────────────────────────────────────────────────
  const aiMode          = useSessionStore((s) => s.aiMode);
  const intensity       = useSessionStore((s) => s.intensity);
  const volume          = useSessionStore((s) => s.volume);
  const isPlaying       = useSessionStore((s) => s.isPlaying);
  const isRecording     = useSessionStore((s) => s.isRecording);
  const sessionStartTime = useSessionStore((s) => s.sessionStartTime);
  const musicalState    = useSessionStore((s) => s.musicalState);
  const aiDecision      = useSessionStore((s) => s.aiDecision);

  // ── Derived display values ───────────────────────────────────────────────────
  const harmonicTension = musicalState?.harmonicTension ?? 0;
  const energyLevel     = musicalState?.energyLevel ?? 0;
  const tempo           = features?.tempo ?? 0;
  const detectedKey     = musicalState?.key ?? '';
  const detectedMode    = musicalState?.mode ?? '';

  // ── Session start ────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setError(null);
    try {
      const engine = new SessionEngine();
      engineRef.current = engine;
      // Engine will populate inputDevices + selectedDeviceId in the store
      await engine.start(selectedDeviceId || undefined);
      setSessionStarted(true);
    } catch (err) {
      engineRef.current = null;
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Could not start: ${msg}`);
    }
  }, [selectedDeviceId]);

  // ── Transport ────────────────────────────────────────────────────────────────
  const handlePlay = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || isPlaying) return;
    await engine.start(selectedDeviceId || undefined);
  }, [isPlaying, selectedDeviceId]);

  const handlePause = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  const handleStop = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
    setSessionStarted(false);
  }, []);

  const handleRecord = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isRecording) {
      engine.stopRecording();
    } else {
      engine.startRecording();
    }
  }, [isRecording]);

  const handleSave = useCallback(() => {
    // Stopping an active recording triggers auto-save via SessionStorage
    if (isRecording) {
      engineRef.current?.stopRecording();
    }
  }, [isRecording]);

  const handleExport = useCallback(() => {
    void engineRef.current?.exportCurrentSession();
  }, []);

  // ── Controls ─────────────────────────────────────────────────────────────────
  const handleModeChange = useCallback((mode: AIModeName) => {
    engineRef.current?.setMode(mode);
  }, []);

  const handleIntensityChange = useCallback((value: number) => {
    engineRef.current?.setIntensity(value);
  }, []);

  const handleVolumeChange = useCallback((value: number) => {
    engineRef.current?.setVolume(value);
  }, []);

  const handleDeviceChange = useCallback((id: string) => {
    useAudioStore.getState().setSelectedDeviceId(id);
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionStarted) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (isPlaying) handlePause();
          else void handlePlay();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          handleRecord();
          break;
        case '1': handleModeChange(AI_MODES[0]!); break;
        case '2': handleModeChange(AI_MODES[1]!); break;
        case '3': handleModeChange(AI_MODES[2]!); break;
        case '4': handleModeChange(AI_MODES[3]!); break;
        case '5': handleModeChange(AI_MODES[4]!); break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sessionStarted, isPlaying, handlePlay, handlePause, handleRecord, handleModeChange]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
    };
  }, []);

  // ── Pre-start screen ─────────────────────────────────────────────────────────
  if (!sessionStarted) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center px-6">
        {/* Title */}
        <div className="mb-14 text-center select-none">
          <h1
            className="text-4xl md:text-5xl font-bold tracking-[0.15em] text-[#E0E0E0] uppercase mb-3"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Man and the Machine
          </h1>
          <p
            className="text-[#444444] text-xs tracking-[0.35em] uppercase"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            A collaborative AI music system
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 px-5 py-3 bg-[#F4433618] border border-[#F4433666] rounded-lg text-[#F44336] text-sm max-w-sm text-center">
            {error}
          </div>
        )}

        {/* Optional device selector (populated after first mic permission) */}
        {inputDevices.length > 0 && (
          <div className="mb-8 w-72">
            <InputDeviceSelector
              devices={inputDevices}
              selectedId={selectedDeviceId}
              onChange={handleDeviceChange}
            />
          </div>
        )}

        <StartButton onStart={() => void handleStart()} />

        {/* Keyboard hint */}
        <p
          className="mt-12 text-[#2A2A35] text-xs tracking-[0.25em] uppercase select-none"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Space &nbsp;·&nbsp; Play / Pause &nbsp;&nbsp;
          R &nbsp;·&nbsp; Record &nbsp;&nbsp;
          1–5 &nbsp;·&nbsp; AI Modes
        </p>
      </div>
    );
  }

  // ── Session UI ───────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-[#0A0A0F] text-[#E0E0E0] overflow-hidden">

      {/* ── Header ── */}
      <header className="flex-none flex items-center justify-between px-5 py-2.5 border-b border-[#12121A] bg-[#0D0D15]">
        <div className="flex items-center gap-4">
          <h1
            className="text-sm font-bold tracking-[0.22em] text-[#E0E0E0] uppercase select-none"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            MAN AND THE MACHINE
          </h1>

          {/* Live recording badge */}
          {isRecording && (
            <span
              className="flex items-center gap-1.5 text-[#F44336] text-xs font-bold tracking-widest uppercase"
              style={{ fontFamily: 'var(--font-body)', animation: 'recBadge 1.4s ease-in-out infinite' }}
            >
              <span className="w-2 h-2 rounded-full bg-[#F44336]" />
              REC
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Device selector — hidden on very small screens */}
          <div className="hidden sm:block w-48 lg:w-60">
            <InputDeviceSelector
              devices={inputDevices}
              selectedId={selectedDeviceId}
              onChange={handleDeviceChange}
            />
          </div>

          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings((v) => !v)}
            title="Settings"
            aria-label="Toggle settings"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#1A1A25] bg-[#12121A] text-[#555555] hover:text-[#E0E0E0] hover:border-[#4A9FD4] transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[#4A9FD4]"
          >
            {/* Gear icon (Unicode) */}
            <span className="text-sm leading-none">&#9881;</span>
          </button>
        </div>
      </header>

      {/* ── Collapsible settings panel ── */}
      {showSettings && (
        <div className="flex-none px-5 py-3 border-b border-[#12121A] bg-[#0D0D15] flex flex-wrap items-end gap-4">
          {/* Device selector repeat for mobile */}
          <div className="sm:hidden w-full">
            <InputDeviceSelector
              devices={inputDevices}
              selectedId={selectedDeviceId}
              onChange={handleDeviceChange}
            />
          </div>
          <p
            className="text-[#2E2E3E] text-xs tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Keyboard: Space play/pause &nbsp;·&nbsp; R record &nbsp;·&nbsp; 1–5 AI mode
          </p>
        </div>
      )}

      {/* ── Main content (three columns) ── */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-row gap-0 min-h-0 overflow-hidden">

          {/* Left sidebar — human audio info */}
          <aside className="flex-none w-44 xl:w-52 border-r border-[#12121A] flex flex-col p-3 gap-3 overflow-y-auto">
            <span
              className="text-[10px] uppercase tracking-widest text-[#333333] select-none"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Human
            </span>
            <AudioFeaturesPanel features={features} />
          </aside>

          {/* Centre — visualization */}
          <section className="flex-1 min-w-0 flex flex-col">
            <Visualization
              humanFeatures={features}
              aiDecision={aiDecision}
              aiMode={aiMode}
              harmonicTension={harmonicTension}
              energyLevel={energyLevel}
              isActive={isPlaying}
            />
          </section>

          {/* Right sidebar — machine state */}
          <aside className="flex-none w-44 xl:w-52 border-l border-[#12121A] flex flex-col p-3 gap-3 overflow-y-auto">
            <span
              className="text-[10px] uppercase tracking-widest text-[#333333] select-none"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Machine
            </span>

            <div className="bg-[#12121A] border border-[#1A1A25] rounded-lg p-4 flex flex-col gap-4">

              {/* Current mode */}
              <div className="flex flex-col gap-0.5">
                <span
                  className="text-[10px] uppercase tracking-widest text-[#444444]"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Mode
                </span>
                <span
                  className="text-sm font-semibold capitalize text-[#4A9FD4]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {aiMode}
                </span>
              </div>

              {/* Harmonic tension */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] uppercase tracking-widest text-[#444444]"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Tension
                  </span>
                  <span
                    className="text-xs text-[#E0E0E0]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {Math.round(harmonicTension * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[#0A0A0F] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${harmonicTension * 100}%`,
                      background: `linear-gradient(90deg, #4A9FD4, #F44336 ${Math.round(harmonicTension * 100)}%)`,
                    }}
                  />
                </div>
              </div>

              {/* Energy level */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] uppercase tracking-widest text-[#444444]"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Energy
                  </span>
                  <span
                    className="text-xs text-[#E0E0E0]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {Math.round(energyLevel * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[#0A0A0F] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${energyLevel * 100}%`,
                      background: `linear-gradient(90deg, #2196F3, #D4A574 ${Math.round(energyLevel * 100)}%)`,
                    }}
                  />
                </div>
              </div>

              {/* Last AI notes */}
              <div className="border-t border-[#1A1A25] pt-3 flex flex-col gap-1.5">
                <span
                  className="text-[10px] uppercase tracking-widest text-[#444444]"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Last Notes
                </span>
                {aiDecision && aiDecision.notes.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {aiDecision.notes.map((n, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#4A9FD418] border border-[#4A9FD444] text-[#4A9FD4]"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {n.pitch}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span
                    className="text-[#2E2E3E] text-xs"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    —
                  </span>
                )}
              </div>

              {/* Articulation */}
              {aiDecision && (
                <div className="flex items-center justify-between border-t border-[#1A1A25] pt-3">
                  <span
                    className="text-[10px] uppercase tracking-widest text-[#444444]"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Articulation
                  </span>
                  <span
                    className="text-xs text-[#E0E0E0] capitalize"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {aiDecision.articulation}
                  </span>
                </div>
              )}

              {/* Novelty */}
              <div className="flex items-center justify-between border-t border-[#1A1A25] pt-3">
                <span
                  className="text-[10px] uppercase tracking-widest text-[#444444]"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Novelty
                </span>
                <span
                  className="text-xs text-[#E0E0E0]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {musicalState ? (musicalState.novelty * 100).toFixed(0) + '%' : '—'}
                </span>
              </div>
            </div>
          </aside>
        </div>

        {/* ── Controls footer ── */}
        <footer className="flex-none border-t border-[#12121A] bg-[#0D0D15] px-4 pb-4 pt-3 flex flex-col gap-3">

          {/* Mode selector */}
          <ModeSelector currentMode={aiMode} onModeChange={handleModeChange} />

          {/* Sliders */}
          <div className="flex flex-row gap-6">
            <div className="flex-1">
              <IntensitySlider value={intensity} onChange={handleIntensityChange} />
            </div>
            <div className="flex-1">
              <VolumeSlider value={volume} onChange={handleVolumeChange} />
            </div>
          </div>

          {/* Session info + transport */}
          <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <SessionInfo
              startTime={sessionStartTime}
              tempo={tempo}
              detectedKey={detectedKey}
              mode={detectedMode}
            />
            <TransportControls
              isPlaying={isPlaying}
              isRecording={isRecording}
              onPlay={() => void handlePlay()}
              onPause={handlePause}
              onStop={handleStop}
              onRecord={handleRecord}
              onSave={handleSave}
              onExport={handleExport}
            />
          </div>
        </footer>
      </main>

      {/* Global keyframe animations */}
      <style>{`
        @keyframes recBadge {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

export default App;
