import type { AIDecision, MusicalState } from '../types';
import type { Highlight } from './HighlightDetector';
import type { SessionData } from './SessionRecorder';

type OnStateCallback = (state: MusicalState, time: number) => void;
type OnAIEventCallback = (decision: AIDecision, time: number) => void;
type OnHighlightCallback = (highlight: Highlight) => void;

interface ScheduledTimeout {
  id: ReturnType<typeof setTimeout>;
}

export class SessionPlayer {
  private readonly sessionData: SessionData;

  private playing: boolean = false;
  private seekOffset: number = 0;   // ms into session at last play/seek
  private playStartWall: number = 0; // wall-clock ms when play last began
  private timeouts: ScheduledTimeout[] = [];

  // Callbacks set at play() time
  private onState: OnStateCallback | null = null;
  private onAIEvent: OnAIEventCallback | null = null;
  private onHighlight: OnHighlightCallback | null = null;

  constructor(sessionData: SessionData) {
    this.sessionData = sessionData;
  }

  // ── Playback control ───────────────────────────────────────────────────────

  play(
    onState: OnStateCallback,
    onAIEvent: OnAIEventCallback,
    onHighlight: OnHighlightCallback,
  ): void {
    if (this.playing) return;

    this.onState = onState;
    this.onAIEvent = onAIEvent;
    this.onHighlight = onHighlight;

    this.playing = true;
    this.playStartWall = Date.now();

    this.scheduleFrom(this.seekOffset);
  }

  pause(): void {
    if (!this.playing) return;
    this.seekOffset = this.getCurrentTime();
    this.playing = false;
    this.clearTimeouts();
  }

  resume(): void {
    if (this.playing) return;
    if (!this.onState || !this.onAIEvent || !this.onHighlight) {
      throw new Error('SessionPlayer: call play() before resume()');
    }
    this.playing = true;
    this.playStartWall = Date.now();
    this.scheduleFrom(this.seekOffset);
  }

  stop(): void {
    this.playing = false;
    this.seekOffset = 0;
    this.clearTimeouts();
  }

  seekTo(ms: number): void {
    const wasPlaying = this.playing;

    if (wasPlaying) {
      this.playing = false;
      this.clearTimeouts();
    }

    this.seekOffset = Math.max(0, Math.min(ms, this.sessionData.duration));

    if (wasPlaying) {
      this.playing = true;
      this.playStartWall = Date.now();
      this.scheduleFrom(this.seekOffset);
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  getDuration(): number {
    return this.sessionData.duration;
  }

  getCurrentTime(): number {
    if (!this.playing) return this.seekOffset;
    return this.seekOffset + (Date.now() - this.playStartWall);
  }

  isPlaying(): boolean {
    return this.playing;
  }

  // ── Internal scheduling ────────────────────────────────────────────────────

  private scheduleFrom(fromMs: number): void {
    const { musicalStates, aiEvents, highlights } = this.sessionData;

    // Schedule musicalState callbacks
    for (const entry of musicalStates) {
      const delay = entry.time - fromMs;
      if (delay < 0) continue;
      const t = setTimeout(() => {
        if (this.playing && this.onState) {
          this.onState(entry.state, entry.time);
        }
      }, delay);
      this.timeouts.push({ id: t });
    }

    // Schedule AI event callbacks
    for (const entry of aiEvents) {
      const delay = entry.time - fromMs;
      if (delay < 0) continue;
      const t = setTimeout(() => {
        if (this.playing && this.onAIEvent) {
          this.onAIEvent(entry.decision, entry.time);
        }
      }, delay);
      this.timeouts.push({ id: t });
    }

    // Schedule highlight callbacks
    for (const highlight of highlights) {
      // Highlights store an absolute wall-clock timestamp; convert to session-relative
      const relTime = highlight.timestamp - this.sessionData.startTime;
      const delay = relTime - fromMs;
      if (delay < 0) continue;
      const t = setTimeout(() => {
        if (this.playing && this.onHighlight) {
          this.onHighlight(highlight);
        }
      }, delay);
      this.timeouts.push({ id: t });
    }

    // Auto-stop at end of session
    const endDelay = this.sessionData.duration - fromMs;
    if (endDelay > 0) {
      const t = setTimeout(() => {
        this.playing = false;
        this.seekOffset = this.sessionData.duration;
        this.clearTimeouts();
      }, endDelay);
      this.timeouts.push({ id: t });
    }
  }

  private clearTimeouts(): void {
    for (const { id } of this.timeouts) {
      clearTimeout(id);
    }
    this.timeouts = [];
  }
}
