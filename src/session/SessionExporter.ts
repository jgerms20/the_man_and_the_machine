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

/** Encode a string as ASCII bytes */
function asciiBytes(str: string): number[] {
  return Array.from(str, (ch) => ch.charCodeAt(0));
}

interface MidiEvent {
  tick: number;
  bytes: number[];
}

/**
 * Builds a Standard MIDI File (format 0, single track) compatible with
 * GarageBand, Logic Pro, and other major DAWs.
 *
 * Includes:
 * - Track name meta event
 * - Tempo meta event (120 BPM default, or detected)
 * - Program change (electric bass = GM program 33)
 * - Proper Note On / Note Off events (0x90/0x80)
 * - End of track marker
 *
 * Timing: 480 ticks/beat, 120 BPM default.
 * NoteEvent.duration in ms → ticks.
 */
export function exportMIDI(data: SessionData, detectedBPM?: number): Blob {
  const TICKS_PER_BEAT = 480;
  const bpm = detectedBPM && detectedBPM > 30 && detectedBPM < 300 ? detectedBPM : 120;
  const TEMPO_US = Math.round(60_000_000 / bpm);
  const MS_PER_BEAT = TEMPO_US / 1_000;
  const TICKS_PER_MS = TICKS_PER_BEAT / MS_PER_BEAT;
  const MIDI_CHANNEL = 0x00; // channel 1

  function msToTicks(ms: number): number {
    return Math.round(ms * TICKS_PER_MS);
  }

  function clamp7(v: number): number {
    return Math.max(0, Math.min(127, Math.round(v)));
  }

  // ── Collect absolute-tick events ──────────────────────────────────────────
  const events: MidiEvent[] = [];

  for (const { time, decision } of data.aiEvents) {
    const baseTick = msToTicks(time);

    for (const note of decision.notes) {
      const pitch = clamp7(note.pitch);
      const velocity = clamp7(
        note.velocity > 1 ? note.velocity : (note.velocity > 0 ? note.velocity * 127 : decision.velocity * 127),
      );
      const durationTicks = Math.max(1, msToTicks(note.duration));

      // Note On (0x90)
      events.push({
        tick: baseTick,
        bytes: [0x90 | MIDI_CHANNEL, pitch, Math.max(1, velocity)],
      });

      // Note Off (0x80) — explicit note-off is better for DAW compatibility
      events.push({
        tick: baseTick + durationTicks,
        bytes: [0x80 | MIDI_CHANNEL, pitch, 0x40], // release velocity 64
      });
    }
  }

  // Sort: by tick, then note-off before note-on at same tick
  events.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    // 0x80 (note off) before 0x90 (note on)
    const aIsOff = ((a.bytes[0] ?? 0) & 0xf0) === 0x80 ? 0 : 1;
    const bIsOff = ((b.bytes[0] ?? 0) & 0xf0) === 0x80 ? 0 : 1;
    return aIsOff - bIsOff;
  });

  // ── Build track data ─────────────────────────────────────────────────────
  const trackBytes: number[] = [];

  // 1. Track name meta event: FF 03 len "Man & Machine"
  const trackName = asciiBytes('Man & Machine');
  trackBytes.push(...writeVLQ(0)); // delta = 0
  trackBytes.push(0xff, 0x03, trackName.length, ...trackName);

  // 2. Set Tempo meta event: FF 51 03 tt tt tt
  trackBytes.push(...writeVLQ(0));
  trackBytes.push(0xff, 0x51, 0x03, ...uint32BE(TEMPO_US).slice(1));

  // 3. Time signature: FF 58 04 04 02 18 08 (4/4 time)
  trackBytes.push(...writeVLQ(0));
  trackBytes.push(0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);

  // 4. Program change: Electric Bass (Finger) = GM program 33 (0-indexed = 33)
  trackBytes.push(...writeVLQ(0));
  trackBytes.push(0xc0 | MIDI_CHANNEL, 33);

  // 5. Control Change: bank select (for maximum DAW compatibility)
  trackBytes.push(...writeVLQ(0));
  trackBytes.push(0xb0 | MIDI_CHANNEL, 0x00, 0x00); // Bank MSB = 0
  trackBytes.push(...writeVLQ(0));
  trackBytes.push(0xb0 | MIDI_CHANNEL, 0x20, 0x00); // Bank LSB = 0

  // 6. Set volume to reasonable level
  trackBytes.push(...writeVLQ(0));
  trackBytes.push(0xb0 | MIDI_CHANNEL, 0x07, 100); // CC7 volume = 100

  // 7. Note events
  let currentTick = 0;
  for (const event of events) {
    const delta = Math.max(0, event.tick - currentTick);
    currentTick = event.tick;
    trackBytes.push(...writeVLQ(delta), ...event.bytes);
  }

  // 8. End of Track: FF 2F 00
  trackBytes.push(...writeVLQ(0));
  trackBytes.push(0xff, 0x2f, 0x00);

  // ── Assemble MIDI file ────────────────────────────────────────────────────

  // MThd chunk
  const header: number[] = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    ...uint32BE(6),           // chunk length = 6
    ...uint16BE(0),           // format 0
    ...uint16BE(1),           // 1 track
    ...uint16BE(TICKS_PER_BEAT),
  ];

  // MTrk chunk
  const trackChunk: number[] = [
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    ...uint32BE(trackBytes.length),
    ...trackBytes,
  ];

  const allBytes = new Uint8Array([...header, ...trackChunk]);
  return new Blob([allBytes], { type: 'audio/midi' });
}

// ── Download helper ───────────────────────────────────────────────────────────

/**
 * Triggers a browser download of `blob` with the given filename.
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

  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
