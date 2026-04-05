/**
 * ChordDetector — identifies chords from a rolling window of detected pitch classes.
 *
 * Since the audio pipeline detects one pitch at a time (monophonic), we accumulate
 * pitch classes over a short window (~800ms) to reconstruct what chord is being played.
 * This works well for bass playing where notes ring and overlap slightly.
 */

export interface DetectedChord {
  name: string;      // e.g. "Am", "G7", "Dsus2", "F#m7"
  root: string;      // e.g. "A"
  quality: string;   // e.g. "m", "7", "maj7", ""
  confidence: number; // 0-1
  pitchClasses: number[]; // which pitch classes were detected
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Chord templates: [intervals from root], quality label, weight (importance)
interface ChordTemplate {
  intervals: number[];
  quality: string;
  weight: number;
}

const CHORD_TEMPLATES: ChordTemplate[] = [
  // Triads
  { intervals: [0, 4, 7], quality: '', weight: 1.0 },           // major
  { intervals: [0, 3, 7], quality: 'm', weight: 1.0 },          // minor
  { intervals: [0, 4, 8], quality: 'aug', weight: 0.7 },        // augmented
  { intervals: [0, 3, 6], quality: 'dim', weight: 0.7 },        // diminished
  { intervals: [0, 5, 7], quality: 'sus4', weight: 0.8 },       // suspended 4th
  { intervals: [0, 2, 7], quality: 'sus2', weight: 0.8 },       // suspended 2nd

  // 7th chords
  { intervals: [0, 4, 7, 11], quality: 'maj7', weight: 0.9 },   // major 7th
  { intervals: [0, 4, 7, 10], quality: '7', weight: 0.9 },      // dominant 7th
  { intervals: [0, 3, 7, 10], quality: 'm7', weight: 0.9 },     // minor 7th
  { intervals: [0, 3, 6, 10], quality: 'm7b5', weight: 0.7 },   // half-diminished
  { intervals: [0, 3, 6, 9],  quality: 'dim7', weight: 0.7 },   // diminished 7th
  { intervals: [0, 3, 7, 11], quality: 'mMaj7', weight: 0.6 },  // minor major 7th
  { intervals: [0, 4, 8, 10], quality: 'aug7', weight: 0.5 },   // augmented 7th

  // Power chords (bass-specific)
  { intervals: [0, 7], quality: '5', weight: 0.85 },             // power chord
];

export class ChordDetector {
  /** Rolling pitch class accumulator: index = pitch class (0-11), value = age-weighted count */
  private readonly pcWeights = new Float32Array(12);
  /** How quickly old detections decay (per 50ms tick) */
  private readonly decay = 0.82;
  /** Minimum weight to consider a pitch class "active" */
  private readonly threshold = 0.15;
  /** Minimum total weight to attempt chord detection */
  private readonly minTotalWeight = 0.5;

  private _lastChord: DetectedChord | null = null;
  private _stableCount = 0;
  private _lastChordName = '';

  /** Feed a newly detected MIDI note into the accumulator. Call every feature tick. */
  update(midiNote: number | null, rms: number): DetectedChord | null {
    // Decay all pitch classes
    for (let i = 0; i < 12; i++) {
      this.pcWeights[i] *= this.decay;
    }

    // Accumulate the detected pitch class
    if (midiNote !== null && midiNote >= 0 && rms > 0.005) {
      const pc = midiNote % 12;
      const boost = Math.min(1, rms * 8); // louder = bigger boost
      this.pcWeights[pc] = Math.min(1, (this.pcWeights[pc] ?? 0) + boost);
    }

    // Check if we have enough signal
    const totalWeight = this.pcWeights.reduce((s, w) => s + w, 0);
    if (totalWeight < this.minTotalWeight) {
      return this._lastChord;
    }

    // Detect chord
    const chord = this._matchChord();
    if (chord) {
      // Require stability — same chord for 2+ ticks before updating
      if (chord.name === this._lastChordName) {
        this._stableCount++;
        if (this._stableCount >= 2) {
          this._lastChord = chord;
        }
      } else {
        this._lastChordName = chord.name;
        this._stableCount = 0;
      }
    }

    return this._lastChord;
  }

  /** Reset the detector (e.g. on silence or mode change) */
  reset(): void {
    this.pcWeights.fill(0);
    this._lastChord = null;
    this._stableCount = 0;
    this._lastChordName = '';
  }

  private _matchChord(): DetectedChord | null {
    // Collect active pitch classes above threshold
    const active: number[] = [];
    for (let pc = 0; pc < 12; pc++) {
      if ((this.pcWeights[pc] ?? 0) > this.threshold) {
        active.push(pc);
      }
    }

    if (active.length === 0) return null;

    let bestScore = -1;
    let bestRoot = 0;
    let bestTemplate: ChordTemplate | null = null;

    // Try each note as the potential root
    for (const root of active) {
      for (const template of CHORD_TEMPLATES) {
        const score = this._scoreTemplate(root, template, active);
        if (score > bestScore) {
          bestScore = score;
          bestRoot = root;
          bestTemplate = template;
        }
      }
    }

    if (!bestTemplate || bestScore < 0.3) return null;

    const rootName = NOTE_NAMES[bestRoot] ?? 'C';
    const chordName = rootName + bestTemplate.quality;

    return {
      name: chordName,
      root: rootName,
      quality: bestTemplate.quality,
      confidence: bestScore,
      pitchClasses: active,
    };
  }

  private _scoreTemplate(root: number, template: ChordTemplate, active: number[]): number {
    let matched = 0;
    let missed = 0;

    for (const interval of template.intervals) {
      const targetPc = (root + interval) % 12;
      const w = this.pcWeights[targetPc] ?? 0;
      if (w > this.threshold) {
        matched += w * template.weight;
      } else {
        missed += template.weight * 0.5;
      }
    }

    // Extra notes not in the template penalize score
    for (const pc of active) {
      const intervalFromRoot = ((pc - root) + 12) % 12;
      if (!template.intervals.includes(intervalFromRoot)) {
        missed += 0.2;
      }
    }

    const total = matched + missed;
    if (total === 0) return 0;
    return (matched / total) * template.weight;
  }
}

// ── Circle of Fifths Utilities ─────────────────────────────────────────────────

/** Returns the note name for a pitch class */
export function pcToName(pc: number): string {
  return NOTE_NAMES[((pc % 12) + 12) % 12] ?? 'C';
}

/** Circle of fifths order (major keys) */
const CIRCLE_MAJOR = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];

/** Get harmonically related chords/notes from the circle of fifths */
export function getCircleOfFifthsSuggestions(rootPc: number, quality: string): {
  adjacent: string[];       // neighboring keys on circle (most compatible)
  relative: string;         // relative major/minor
  subdominant: string;      // IV chord
  dominant: string;         // V chord
  parallelMinor?: string;   // only if major
  parallelMajor?: string;   // only if minor
  colorNotes: string[];     // chromatic color tones
} {
  const isMinor = quality.startsWith('m') || quality === 'dim' || quality === 'm7' || quality === 'm7b5';

  // Normalize root to major equivalent for circle lookup
  const majorPc = isMinor ? (rootPc + 3) % 12 : rootPc;
  const rootName = CIRCLE_MAJOR.find((_, i) => (i * 7) % 12 === majorPc) ??
    CIRCLE_MAJOR.find((_, i) => ((i * 7) % 12) === majorPc) ??
    pcToName(majorPc);

  const circleIdx = CIRCLE_MAJOR.indexOf(rootName);
  const ci = circleIdx === -1 ? 0 : circleIdx;

  // Adjacent keys (±1 on circle)
  const prevKey = CIRCLE_MAJOR[(ci + 11) % 12] ?? 'F';
  const nextKey = CIRCLE_MAJOR[(ci + 1) % 12] ?? 'G';

  // Functional chords from the detected key
  const subdominantPc = (rootPc + 5) % 12;
  const dominantPc = (rootPc + 7) % 12;

  if (isMinor) {
    const relMajorPc = (rootPc + 3) % 12;
    return {
      adjacent: [prevKey + 'm', nextKey + 'm'],
      relative: pcToName(relMajorPc),
      subdominant: pcToName(subdominantPc) + 'm',
      dominant: pcToName(dominantPc),
      parallelMajor: pcToName(rootPc),
      colorNotes: [
        pcToName((rootPc + 1) % 12),
        pcToName((rootPc + 6) % 12),
        pcToName((rootPc + 11) % 12),
      ],
    };
  } else {
    const relMinorPc = (rootPc + 9) % 12;
    return {
      adjacent: [prevKey, nextKey],
      relative: pcToName(relMinorPc) + 'm',
      subdominant: pcToName(subdominantPc),
      dominant: pcToName(dominantPc) + '7',
      parallelMinor: pcToName(rootPc) + 'm',
      colorNotes: [
        pcToName((rootPc + 2) % 12),
        pcToName((rootPc + 9) % 12),
        pcToName((rootPc + 11) % 12),
      ],
    };
  }
}
