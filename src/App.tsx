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
import { BassFretboard } from './components/BassFretboard';
import type { AIModeName } from './ai/types';

const AI_MODES: AIModeName[] = ['assisted', 'drums', 'supportive', 'challenger', 'adversary', 'mirror', 'free'];

export function App() {
  const engineRef = useRef<SessionEngine | null>(null);

  const [sessionStarted, setSessionStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio store
  const features        = useAudioStore((s) => s.features);
  const inputDevices    = useAudioStore((s) => s.inputDevices);
  const selectedDeviceId = useAudioStore((s) => s.selectedDeviceId);
  const midiAvailable   = useAudioStore((s) => s.midiAvailable);
  const midiDevices     = useAudioStore((s) => s.midiDevices);
  const midiNote        = useAudioStore((s) => s.midiNote);

  // Session store
  const aiMode            = useSessionStore((s) => s.aiMode);
  const intensity         = useSessionStore((s) => s.intensity);
  const volume            = useSessionStore((s) => s.volume);
  const isPlaying         = useSessionStore((s) => s.isPlaying);
  const isRecording       = useSessionStore((s) => s.isRecording);
  const sessionStartTime  = useSessionStore((s) => s.sessionStartTime);
  const musicalState      = useSessionStore((s) => s.musicalState);
  const aiDecision        = useSessionStore((s) => s.aiDecision);
  const drumPattern       = useSessionStore((s) => s.drumPattern);

  // Derived
  const harmonicTension = musicalState?.harmonicTension ?? 0;
  const energyLevel     = musicalState?.energyLevel ?? 0;
  const tempo           = features?.tempo ?? 0;
  const detectedKey     = musicalState?.key ?? '';
  const detectedMode    = musicalState?.mode ?? '';

  // ── Session start ──────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setError(null);
    try {
      const engine = new SessionEngine();
      engineRef.current = engine;
      await engine.start(selectedDeviceId || undefined);
      setSessionStarted(true);
    } catch (err) {
      engineRef.current = null;
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Could not start: ${msg}`);
    }
  }, [selectedDeviceId]);

  // ── Transport ──────────────────────────────────────────────────────────────
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
    if (isRecording) {
      engineRef.current?.stopRecording();
    }
  }, [isRecording]);

  const handleExport = useCallback(() => {
    void engineRef.current?.exportCurrentSession();
  }, []);

  // ── Controls ───────────────────────────────────────────────────────────────
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

  const handleNextDrumPattern = useCallback(() => {
    engineRef.current?.nextDrumPattern();
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
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
        case '6': handleModeChange(AI_MODES[5]!); break;
        case '7': handleModeChange(AI_MODES[6]!); break;
        case 'd':
        case 'D':
          // Cycle drum pattern
          if (aiMode === 'drums') {
            handleNextDrumPattern();
          }
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sessionStarted, isPlaying, aiMode, handlePlay, handlePause, handleRecord, handleModeChange, handleNextDrumPattern]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
    };
  }, []);

  // ── Pre-start screen ───────────────────────────────────────────────────────
  if (!sessionStarted) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center px-6">
        <div className="mb-14 text-center select-none">
          <h1
            className="text-3xl md:text-5xl font-bold tracking-[0.15em] text-[#E0E0E0] uppercase mb-3"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Man and the Machine
          </h1>
          <p
            className="text-[#444444] text-xs tracking-[0.35em] uppercase"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            AI music collaboration for bass players
          </p>
        </div>

        {error && (
          <div className="mb-6 px-5 py-3 bg-[#F4433618] border border-[#F4433666] rounded-lg text-[#F44336] text-sm max-w-sm text-center">
            {error}
          </div>
        )}

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

        <p
          className="mt-12 text-[#2A2A35] text-xs tracking-[0.25em] uppercase select-none text-center leading-relaxed"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Space · Play/Pause &nbsp;&nbsp; R · Record &nbsp;&nbsp; 1–7 · AI Modes
          <br />
          Supports mic input, MIDI controllers (Akai MPK Mini), &amp; 5-string bass
        </p>
      </div>
    );
  }

  // ── Session UI (mobile-friendly, scrollable) ──────────────────────────────
  return (
    <div className="h-[100dvh] flex flex-col bg-[#0A0A0F] text-[#E0E0E0]">

      {/* ── Header (compact) ── */}
      <header className="flex-none flex items-center justify-between px-3 sm:px-5 py-2 border-b border-[#12121A] bg-[#0D0D15]">
        <div className="flex items-center gap-3">
          <h1
            className="text-xs sm:text-sm font-bold tracking-[0.22em] text-[#E0E0E0] uppercase select-none"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            MAN &amp; MACHINE
          </h1>

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

        <div className="flex items-center gap-2">
          <div className="hidden sm:block w-48">
            <InputDeviceSelector
              devices={inputDevices}
              selectedId={selectedDeviceId}
              onChange={handleDeviceChange}
            />
          </div>

          {/* MIDI indicator */}
          {midiAvailable && midiDevices.length > 0 && (
            <span
              className="text-[10px] px-2 py-1 rounded bg-[#4A9FD418] border border-[#4A9FD444] text-[#4A9FD4]"
              title={midiDevices.map((d) => d.name).join(', ')}
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              MIDI
            </span>
          )}
        </div>
      </header>

      {/* ── Scrollable main content ── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col min-h-0">

          {/* Visualization — takes priority */}
          <section className="w-full" style={{ minHeight: '180px', maxHeight: '35vh' }}>
            <Visualization
              humanFeatures={features}
              aiDecision={aiDecision}
              aiMode={aiMode}
              harmonicTension={harmonicTension}
              energyLevel={energyLevel}
              isActive={isPlaying}
            />
          </section>

          {/* Bass Fretboard */}
          <section className="px-3 sm:px-5 pt-3">
            <BassFretboard
              currentMidiNote={features?.midiNote ?? null}
              currentNoteName={features?.noteName ?? ''}
              isActive={isPlaying}
              midiControllerNote={midiNote}
            />
          </section>

          {/* Info panels — side by side on desktop, stacked on mobile */}
          <section className="px-3 sm:px-5 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* Human side */}
            <div>
              <span
                className="text-[10px] uppercase tracking-widest text-[#333333] select-none mb-2 block"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Human
              </span>
              <AudioFeaturesPanel features={features} />
            </div>

            {/* Machine side */}
            <div>
              <span
                className="text-[10px] uppercase tracking-widest text-[#333333] select-none mb-2 block"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Machine
              </span>
              <div className="bg-[#12121A] border border-[#1A1A25] rounded-lg p-4 flex flex-col gap-3">

                {/* Current mode */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-[#444444]" style={{ fontFamily: 'var(--font-body)' }}>
                    Mode
                  </span>
                  <span className="text-sm font-semibold capitalize text-[#4A9FD4]" style={{ fontFamily: 'var(--font-display)' }}>
                    {aiMode}
                  </span>
                </div>

                {/* Drum pattern indicator */}
                {aiMode === 'drums' && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest text-[#444444]" style={{ fontFamily: 'var(--font-body)' }}>
                      Pattern
                    </span>
                    <button
                      onClick={handleNextDrumPattern}
                      className="text-xs text-[#FF5722] capitalize px-2 py-0.5 rounded bg-[#FF572218] border border-[#FF572244] cursor-pointer hover:bg-[#FF572233] transition-colors"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {drumPattern} →
                    </button>
                  </div>
                )}

                {/* Tension */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest text-[#444444]" style={{ fontFamily: 'var(--font-body)' }}>Tension</span>
                    <span className="text-xs text-[#E0E0E0]" style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(harmonicTension * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#0A0A0F] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-200" style={{ width: `${harmonicTension * 100}%`, background: `linear-gradient(90deg, #4A9FD4, #F44336 ${Math.round(harmonicTension * 100)}%)` }} />
                  </div>
                </div>

                {/* Energy */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest text-[#444444]" style={{ fontFamily: 'var(--font-body)' }}>Energy</span>
                    <span className="text-xs text-[#E0E0E0]" style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(energyLevel * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#0A0A0F] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-200" style={{ width: `${energyLevel * 100}%`, background: `linear-gradient(90deg, #2196F3, #D4A574 ${Math.round(energyLevel * 100)}%)` }} />
                  </div>
                </div>

                {/* Last AI notes */}
                <div className="border-t border-[#1A1A25] pt-2 flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-[#444444]" style={{ fontFamily: 'var(--font-body)' }}>Last Notes</span>
                  {aiDecision && aiDecision.notes.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {aiDecision.notes.map((n, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[#4A9FD418] border border-[#4A9FD444] text-[#4A9FD4]" style={{ fontFamily: 'var(--font-mono)' }}>
                          {n.pitch}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[#2E2E3E] text-xs" style={{ fontFamily: 'var(--font-mono)' }}>—</span>
                  )}
                </div>

                {/* MIDI controller note */}
                {midiNote !== null && (
                  <div className="flex items-center justify-between border-t border-[#1A1A25] pt-2">
                    <span className="text-[10px] uppercase tracking-widest text-[#444444]" style={{ fontFamily: 'var(--font-body)' }}>MIDI In</span>
                    <span className="text-sm font-bold text-[#4A9FD4]" style={{ fontFamily: 'var(--font-mono)' }}>
                      {midiNote}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Bottom spacer for footer */}
          <div className="h-4" />
        </div>
      </main>

      {/* ── Controls footer (sticky bottom) ── */}
      <footer className="flex-none border-t border-[#12121A] bg-[#0D0D15] px-3 sm:px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 flex flex-col gap-2.5">

        {/* Mode selector */}
        <ModeSelector currentMode={aiMode} onModeChange={handleModeChange} />

        {/* Sliders — larger touch targets */}
        <div className="grid grid-cols-2 gap-4">
          <IntensitySlider value={intensity} onChange={handleIntensityChange} />
          <VolumeSlider value={volume} onChange={handleVolumeChange} />
        </div>

        {/* Session info + transport */}
        <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
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
