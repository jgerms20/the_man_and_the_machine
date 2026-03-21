import type { AIModeName, AIDecision, MusicalState } from '../types';
import type { Highlight } from './HighlightDetector';

export interface SessionData {
  id: string;
  startTime: number;
  duration: number;
  aiMode: AIModeName;
  modeChanges: { time: number; from: AIModeName; to: AIModeName }[];
  aiEvents: { time: number; decision: AIDecision }[];
  musicalStates: { time: number; state: MusicalState }[];
  highlights: Highlight[];
  audioBlob: Blob | null;
}

function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

export class SessionRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private mimeType: string = '';

  private startTime: number = 0;
  private currentMode: AIModeName;

  private modeChanges: SessionData['modeChanges'] = [];
  private aiEvents: SessionData['aiEvents'] = [];
  private musicalStates: SessionData['musicalStates'] = [];
  private highlights: Highlight[] = [];

  constructor(initialMode: AIModeName = 'free') {
    this.currentMode = initialMode;
  }

  // ── Recording control ──────────────────────────────────────────────────────

  start(stream: MediaStream): void {
    if (this.mediaRecorder) {
      throw new Error('SessionRecorder: already recording');
    }

    this.startTime = Date.now();
    this.audioChunks = [];
    this.modeChanges = [];
    this.aiEvents = [];
    this.musicalStates = [];
    this.highlights = [];

    this.mimeType = pickMimeType();
    const options: MediaRecorderOptions = this.mimeType ? { mimeType: this.mimeType } : {};

    this.mediaRecorder = new MediaRecorder(stream, options);

    this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) {
        this.audioChunks.push(e.data);
      }
    };

    // Collect data every second so we don't lose chunks on abrupt stop
    this.mediaRecorder.start(1_000);
  }

  async stop(): Promise<SessionData> {
    return new Promise<SessionData>((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('SessionRecorder: not recording'));
        return;
      }

      const recorder = this.mediaRecorder;

      recorder.onstop = () => {
        const duration = Date.now() - this.startTime;
        const audioBlob =
          this.audioChunks.length > 0
            ? new Blob(this.audioChunks, { type: this.mimeType || 'audio/webm' })
            : null;

        const data: SessionData = {
          id: generateId(),
          startTime: this.startTime,
          duration,
          aiMode: this.currentMode,
          modeChanges: [...this.modeChanges],
          aiEvents: [...this.aiEvents],
          musicalStates: [...this.musicalStates],
          highlights: [...this.highlights],
          audioBlob,
        };

        this.mediaRecorder = null;
        resolve(data);
      };

      recorder.onerror = (e) => {
        this.mediaRecorder = null;
        reject(new Error(`MediaRecorder error: ${String(e)}`));
      };

      recorder.stop();
    });
  }

  // ── Event logging ──────────────────────────────────────────────────────────

  logAIEvent(decision: AIDecision): void {
    this.aiEvents.push({ time: this.getElapsedTime(), decision });
  }

  logMusicalState(state: MusicalState): void {
    this.musicalStates.push({ time: this.getElapsedTime(), state });
  }

  logModeChange(from: AIModeName, to: AIModeName): void {
    this.modeChanges.push({ time: this.getElapsedTime(), from, to });
    this.currentMode = to;
  }

  addHighlight(h: Highlight): void {
    this.highlights.push(h);
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  getElapsedTime(): number {
    if (this.startTime === 0) return 0;
    return Date.now() - this.startTime;
  }

  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }
}
