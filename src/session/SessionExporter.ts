import type { SessionData } from './SessionRecorder';

// ── WAV export ────────────────────────────────────────────────────────────────

/**
 * Returns the recorded audio blob directly.
 * If no audio was captured during the session the promise rejects.
 */
export async function exportWAV(data: SessionData): Promise<Blob> {
  if (!data.audioBlob) {
    throw new Error('SessionExporter: session has no recorded audio');
  }
  return data.audioBlob;
}

// ── MIDI export ───────────────────────────────────────────────────────────────

/**
 * Writes a variable-length quantity (VLQ) as used throughout MIDI files.
 * Returns an array of bytes (1–4 bytes).
 */
function writeVLQ(value: number): number[] {
  if (value < 0) throw new RangeError('VLQ value must be non-negative');
  const bytes: number[] = [];
  bytes.push(value & 0x7f);
  value >>>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  return bytes;
}

/** Encodes a 32-bit unsigned integer as 4 big-endian bytes. */
function uint32BE(value: number): number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

/** Encodes a 16-bit unsigned integer as 2 big-endian bytes. */
function uint16BE(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

interface MidiEvent {
  tick: number;
  bytes: number[];
}

/**
 * Builds a minimal but spec-compliant MIDI file (format 0, single track) from
 * the session's AI events. Each AIDecision produces one note-on / note-off pair
 * per NoteEvent in its `notes` array.
 *
 * Timing model:
 *   - Resolution: 480 ticks per quarter note (standard).
 *   - Tempo: 500 000 µs/beat (120 BPM) encoded as a Set Tempo meta event.
 *   - NoteEvent.duration is treated as milliseconds; converted to ticks.
 *   - Session-relative time (ms) → ticks: ticks = ms * (resolution / msPerBeat).
 */
export function exportMIDI(data: SessionData): Blob {
  const TICKS_PER_BEAT = 480;
  const TEMPO_US = 500_000; // 120 BPM
  const MS_PER_BEAT = TEMPO_US / 1_000; // 500 ms
  const TICKS_PER_MS = TICKS_PER_BEAT / MS_PER_BEAT; // 0.96 ticks/ms
  const MIDI_CHANNEL = 0x00; // channel 1

  function msToTicks(ms: number): number {
    return Math.round(ms * TICKS_PER_MS);
  }

  // Clamp MIDI values to 0–127
  function clamp7(v: number): number {
    return Math.max(0, Math.min(127, Math.round(v)));
  }

  // ── Collect absolute-tick events ──────────────────────────────────────────
  const events: MidiEvent[] = [];

  for (const { time, decision } of data.aiEvents) {
    const baseTick = msToTicks(time);

    for (const note of decision.notes) {
      const pitch = clamp7(note.pitch);
      const velocity = clamp7(note.velocity > 0 ? note.velocity : decision.velocity * 127);
      const durationTicks = Math.max(1, msToTicks(note.duration));

      // Note On
      events.push({
        tick: baseTick,
        bytes: [0x90 | MIDI_CHANNEL, pitch, velocity],
      });

      // Note Off (using note-on with velocity 0 — universally supported)
      events.push({
        tick: baseTick + durationTicks,
        bytes: [0x90 | MIDI_CHANNEL, pitch, 0x00],
      });
    }
  }

  // Sort by tick, then note-off before note-on at the same tick to avoid
  // stuck notes when two notes share an endpoint.
  events.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    // note-off (velocity byte 0) sorts before note-on
    const aOff = a.bytes[2] === 0 ? 0 : 1;
    const bOff = b.bytes[2] === 0 ? 0 : 1;
    return aOff - bOff;
  });

  // ── Convert to delta-tick stream ──────────────────────────────────────────
  const trackBytes: number[] = [];
  let currentTick = 0;

  // Set Tempo meta event (delta=0)
  // FF 51 03 tt tt tt
  trackBytes.push(...writeVLQ(0)); // delta time
  trackBytes.push(0xff, 0x51, 0x03, ...uint32BE(TEMPO_US).slice(1)); // 3-byte tempo

  for (const event of events) {
    const delta = event.tick - currentTick;
    currentTick = event.tick;
    trackBytes.push(...writeVLQ(delta), ...event.bytes);
  }

  // End of Track meta event
  trackBytes.push(...writeVLQ(0)); // delta time
  trackBytes.push(0xff, 0x2f, 0x00);

  // ── Assemble MIDI file ────────────────────────────────────────────────────

  // MThd chunk — Header
  const header: number[] = [
    // Chunk type "MThd"
    0x4d, 0x54, 0x68, 0x64,
    // Chunk length = 6
    ...uint32BE(6),
    // Format 0 (single track)
    ...uint16BE(0),
    // Number of tracks = 1
    ...uint16BE(1),
    // Ticks per quarter note
    ...uint16BE(TICKS_PER_BEAT),
  ];

  // MTrk chunk — Track
  const trackChunk: number[] = [
    // Chunk type "MTrk"
    0x4d, 0x54, 0x72, 0x6b,
    // Chunk length
    ...uint32BE(trackBytes.length),
    ...trackBytes,
  ];

  const allBytes = new Uint8Array([...header, ...trackChunk]);
  return new Blob([allBytes], { type: 'audio/midi' });
}

// ── Download helper ───────────────────────────────────────────────────────────

/**
 * Triggers a browser download of `blob` with the given filename.
 * The anchor element is created, clicked, and immediately removed.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Release the object URL after a short delay to ensure the download starts
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
