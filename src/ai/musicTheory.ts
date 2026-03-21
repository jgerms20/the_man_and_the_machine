export const SCALES: Record<string, number[]> = {
  major:           [0, 2, 4, 5, 7, 9, 11],
  minor:           [0, 2, 3, 5, 7, 8, 10],
  dorian:          [0, 2, 3, 5, 7, 9, 10],
  mixolydian:      [0, 2, 4, 5, 7, 9, 10],
  phrygian:        [0, 1, 3, 5, 7, 8, 10],
  lydian:          [0, 2, 4, 6, 7, 9, 11],
  locrian:         [0, 1, 3, 5, 6, 8, 10],
  harmonicMinor:   [0, 2, 3, 5, 7, 8, 11],
  melodicMinor:    [0, 2, 3, 5, 7, 9, 11],
  pentatonicMajor: [0, 2, 4, 7, 9],
  pentatonicMinor: [0, 3, 5, 7, 10],
  blues:           [0, 3, 5, 6, 7, 10],
  chromatic:       [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const FLAT_MAP: Record<string, string> = {
  'Cb': 'B', 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
};

const MODE_ALIASES: Record<string, string> = {
  major: 'major',
  minor: 'minor',
  dorian: 'dorian',
  mixolydian: 'mixolydian',
  phrygian: 'phrygian',
  lydian: 'lydian',
  locrian: 'locrian',
  'harmonic minor': 'harmonicMinor',
  'melodic minor': 'melodicMinor',
  'pentatonic major': 'pentatonicMajor',
  'pentatonic minor': 'pentatonicMinor',
  blues: 'blues',
  chromatic: 'chromatic',
};

/**
 * Resolve a note name (with sharps or flats) to a pitch class 0-11.
 */
function noteNameToPitchClass(name: string): number {
  const normalized = FLAT_MAP[name] ?? name;
  const idx = NOTE_NAMES.indexOf(normalized as typeof NOTE_NAMES[number]);
  return idx >= 0 ? idx : 0;
}

/**
 * Parse a key string like "Bb minor" or "C# dorian" into root pitch class and scale intervals.
 */
export function parseKey(keyString: string): { root: number; scale: number[] } {
  const trimmed = keyString.trim();
  // Match note name (letter + optional # or b) and optional mode
  const match = trimmed.match(/^([A-Ga-g][#b]?)\s*(.*)$/);
  if (!match) {
    return { root: 0, scale: SCALES.major };
  }

  const notePart = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const modePart = match[2].trim().toLowerCase();

  const root = noteNameToPitchClass(notePart);
  const scaleKey = MODE_ALIASES[modePart] ?? modePart;
  const scale = SCALES[scaleKey] ?? SCALES.major;

  return { root, scale };
}

/**
 * Returns the pitch classes (0-11) present in a scale rooted at `root`.
 */
export function getScaleNotes(root: number, scale: number[]): number[] {
  return scale.map((interval) => (root + interval) % 12);
}

/**
 * Returns chord tones [root, 3rd, 5th, 7th] as pitch classes from a scale.
 */
export function getChordTones(root: number, scale: number[]): number[] {
  // Pick degrees 1, 3, 5, 7 (indices 0, 2, 4, 6) when available
  const indices = [0, 2, 4, 6];
  const tones: number[] = [];
  for (const i of indices) {
    if (i < scale.length) {
      tones.push((root + scale[i]) % 12);
    }
  }
  return tones;
}

/**
 * Check if a pitch class belongs to the given scale.
 */
export function isInScale(pitchClass: number, root: number, scale: number[]): boolean {
  const pc = ((pitchClass % 12) + 12) % 12;
  const scaleNotes = getScaleNotes(root, scale);
  return scaleNotes.includes(pc);
}

/**
 * Find the nearest scale note to a given MIDI note, preserving the octave as closely as possible.
 */
export function nearestScaleNote(midiNote: number, root: number, scale: number[]): number {
  const scaleNotes = getScaleNotes(root, scale);
  let best = midiNote;
  let bestDist = Infinity;

  for (let offset = -12; offset <= 12; offset++) {
    const candidate = midiNote + offset;
    if (candidate < 0 || candidate > 127) continue;
    if (scaleNotes.includes(candidate % 12)) {
      const dist = Math.abs(offset);
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
  }
  return best;
}

/**
 * Semitone interval between two MIDI notes, normalized to 0-11.
 */
export function getInterval(note1: number, note2: number): number {
  return ((note2 - note1) % 12 + 12) % 12;
}

/**
 * Transpose a MIDI note by a number of semitones, clamped to 0-127.
 */
export function transpose(midiNote: number, semitones: number): number {
  return Math.max(0, Math.min(127, midiNote + semitones));
}

/**
 * Invert a melody around an axis pitch (MIDI note number).
 */
export function invertMelody(notes: number[], axis: number): number[] {
  return notes.map((n) => Math.max(0, Math.min(127, 2 * axis - n)));
}

/**
 * Reverse a melody.
 */
export function retrograde(notes: number[]): number[] {
  return [...notes].reverse();
}

/**
 * Multiply durations by a factor (augmentation).
 */
export function augment(durations: number[], factor: number): number[] {
  return durations.map((d) => d * factor);
}

/**
 * Divide durations by a factor (diminution).
 */
export function diminish(durations: number[], factor: number): number[] {
  return durations.map((d) => d / factor);
}

/**
 * Get the relative minor root (down a minor 3rd / 3 semitones).
 */
export function getRelativeMinor(root: number): number {
  return ((root - 3) % 12 + 12) % 12;
}

/**
 * Get the relative major root (up a minor 3rd / 3 semitones).
 */
export function getRelativeMajor(root: number): number {
  return (root + 3) % 12;
}

/**
 * Get the tritone substitution root (up 6 semitones).
 */
export function getTritoneSubstitution(root: number): number {
  return (root + 6) % 12;
}

/**
 * Pick a random note from a scale in a given octave. Returns MIDI note number.
 */
export function randomFromScale(root: number, scale: number[], octave: number): number {
  const scaleNotes = getScaleNotes(root, scale);
  const idx = Math.floor(Math.random() * scaleNotes.length);
  const pitchClass = scaleNotes[idx];
  return octave * 12 + pitchClass;
}

/**
 * Consonance score for an interval (0-11). Higher = more consonant.
 * Based on common psychoacoustic rankings.
 */
export function consonanceScore(interval: number): number {
  const normalized = ((interval % 12) + 12) % 12;
  const scores: Record<number, number> = {
    0:  1.0,   // unison
    1:  0.1,   // minor 2nd
    2:  0.3,   // major 2nd
    3:  0.65,  // minor 3rd
    4:  0.7,   // major 3rd
    5:  0.85,  // perfect 4th
    6:  0.15,  // tritone
    7:  0.9,   // perfect 5th
    8:  0.6,   // minor 6th
    9:  0.65,  // major 6th
    10: 0.25,  // minor 7th
    11: 0.2,   // major 7th
  };
  return scores[normalized] ?? 0;
}
