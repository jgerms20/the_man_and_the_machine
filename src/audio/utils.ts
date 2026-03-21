const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/**
 * Convert a frequency in Hz to a MIDI note number.
 * Returns 0 if the frequency is <= 0.
 */
export function hzToMidi(hz: number): number {
  if (hz <= 0) return 0;
  return Math.round(12 * Math.log2(hz / 440) + 69);
}

/**
 * Convert a MIDI note number to a note name like "C#4".
 * Returns "" if the MIDI note is outside the valid 0-127 range.
 */
export function midiToNoteName(midi: number): string {
  if (midi < 0 || midi > 127) return '';
  const noteIndex = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * Convert a frequency in Hz directly to a note name like "C#4".
 * Returns "" if the frequency is <= 0.
 */
export function hzToNoteName(hz: number): string {
  if (hz <= 0) return '';
  return midiToNoteName(hzToMidi(hz));
}
