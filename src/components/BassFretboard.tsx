import { useState, type FC, useMemo } from 'react';

interface BassFretboardProps {
  /** Current detected MIDI note (0-127), or null/0 if nothing detected */
  currentMidiNote: number | null;
  /** Current note name like "E2", "A#3" */
  currentNoteName: string;
  /** Whether audio input is active */
  isActive: boolean;
  /** MIDI note from MIDI controller, if any */
  midiControllerNote?: number | null;
  /** Suggested MIDI notes to highlight (from suggest mode, etc.) */
  suggestedNotes?: number[];
}

interface StringConfig {
  name: string;
  openMidi: number;
  color: string;
}

const STRINGS_6: StringConfig[] = [
  { name: 'C', openMidi: 60, color: '#E0B0FF' },
  { name: 'G', openMidi: 55, color: '#4A9FD4' },
  { name: 'D', openMidi: 50, color: '#6CB4DE' },
  { name: 'A', openMidi: 45, color: '#D4A574' },
  { name: 'E', openMidi: 40, color: '#C4956A' },
  { name: 'B', openMidi: 35, color: '#B48560' },
];

const STRINGS_5: StringConfig[] = [
  { name: 'G', openMidi: 55, color: '#4A9FD4' },
  { name: 'D', openMidi: 50, color: '#6CB4DE' },
  { name: 'A', openMidi: 45, color: '#D4A574' },
  { name: 'E', openMidi: 40, color: '#C4956A' },
  { name: 'B', openMidi: 35, color: '#B48560' },
];

const STRINGS_4: StringConfig[] = [
  { name: 'G', openMidi: 55, color: '#4A9FD4' },
  { name: 'D', openMidi: 50, color: '#6CB4DE' },
  { name: 'A', openMidi: 45, color: '#D4A574' },
  { name: 'E', openMidi: 40, color: '#C4956A' },
];

const STRING_CONFIGS: Record<number, StringConfig[]> = {
  4: STRINGS_4,
  5: STRINGS_5,
  6: STRINGS_6,
};

const FRET_COUNT = 12;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNoteName(midi: number): string {
  const note = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

interface FretPosition {
  stringIndex: number;
  fret: number;
  midi: number;
  noteName: string;
}

function findNoteOnFretboard(midiNote: number, strings: StringConfig[]): FretPosition[] {
  const positions: FretPosition[] = [];
  for (let si = 0; si < strings.length; si++) {
    const s = strings[si]!;
    const fret = midiNote - s.openMidi;
    if (fret >= 0 && fret <= FRET_COUNT) {
      positions.push({
        stringIndex: si,
        fret,
        midi: midiNote,
        noteName: midiToNoteName(midiNote),
      });
    }
  }
  return positions;
}

// Fret marker positions (standard bass dots)
const FRET_MARKERS = [3, 5, 7, 9, 12];
const DOUBLE_MARKERS = [12];

export const BassFretboard: FC<BassFretboardProps> = ({
  currentMidiNote,
  currentNoteName,
  isActive,
  midiControllerNote,
  suggestedNotes = [],
}) => {
  const [stringCount, setStringCount] = useState<number>(5);
  const [collapsed, setCollapsed] = useState(false);

  const strings = STRING_CONFIGS[stringCount] ?? STRINGS_5;

  // Find positions for detected notes
  const detectedPositions = useMemo(() => {
    if (!currentMidiNote || currentMidiNote < 24 || currentMidiNote > 84) return [];
    return findNoteOnFretboard(currentMidiNote, strings);
  }, [currentMidiNote, strings]);

  // Find positions for MIDI controller notes
  const midiPositions = useMemo(() => {
    if (!midiControllerNote || midiControllerNote < 24 || midiControllerNote > 84) return [];
    return findNoteOnFretboard(midiControllerNote, strings);
  }, [midiControllerNote, strings]);

  // Find positions for suggested notes — all instances of same note name on fretboard
  const suggestedPositions = useMemo(() => {
    if (suggestedNotes.length === 0) return [];
    const positions: (FretPosition & { isSameAsPlayed: boolean })[] = [];
    // Get the pitch classes of suggested notes
    const suggestedPCs = new Set(suggestedNotes.map((n) => n % 12));
    for (let si = 0; si < strings.length; si++) {
      const s = strings[si]!;
      for (let fret = 0; fret <= FRET_COUNT; fret++) {
        const midi = s.openMidi + fret;
        const pc = midi % 12;
        if (suggestedPCs.has(pc)) {
          const isSameAsPlayed = currentMidiNote !== null && (currentMidiNote % 12) === pc;
          positions.push({
            stringIndex: si,
            fret,
            midi,
            noteName: midiToNoteName(midi),
            isSameAsPlayed,
          });
        }
      }
    }
    return positions;
  }, [suggestedNotes, strings, currentMidiNote]);

  const displayNote = currentNoteName || (currentMidiNote ? midiToNoteName(currentMidiNote) : '');

  const svgWidth = (FRET_COUNT + 1) * 60 + 40;
  const svgHeight = strings.length * 28 + 20;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1.5 cursor-pointer focus:outline-none"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
            fill="none" stroke="#555555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span className="text-xs uppercase tracking-widest text-[#555555] font-[family-name:var(--font-body)]">
            Fretboard
          </span>
        </button>

        <div className="flex items-center gap-2">
          {/* String count selector */}
          <div className="flex gap-0.5">
            {[4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => setStringCount(n)}
                className="px-1.5 py-0.5 text-[10px] rounded border transition-colors cursor-pointer focus:outline-none"
                style={{
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: stringCount === n ? '#D4A57422' : 'transparent',
                  borderColor: stringCount === n ? '#D4A574' : '#2A2A35',
                  color: stringCount === n ? '#D4A574' : '#555555',
                }}
              >
                {n}str
              </button>
            ))}
          </div>

          {/* Current note */}
          {displayNote && isActive && (
            <span
              className="text-lg font-bold text-[#D4A574] font-[family-name:var(--font-mono)] transition-all duration-100"
              style={{ textShadow: '0 0 12px rgba(212,165,116,0.6)' }}
            >
              {displayNote}
            </span>
          )}
        </div>
      </div>

      {/* Fretboard SVG */}
      {!collapsed && (
        <>
          <div className="relative bg-[#1A1208] rounded-lg border border-[#2A2418] overflow-hidden">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto"
              style={{ minHeight: `${Math.max(60, strings.length * 18)}px` }}
            >
              {/* Nut */}
              <rect x="38" y="8" width="4" height={strings.length * 28 + 4} fill="#E8D5B7" rx="1" />

              {/* Fret wires */}
              {Array.from({ length: FRET_COUNT }, (_, i) => {
                const x = 42 + (i + 1) * 60;
                return (
                  <line
                    key={`fret-${i}`}
                    x1={x} y1="8" x2={x} y2={strings.length * 28 + 12}
                    stroke="#555544" strokeWidth="2"
                  />
                );
              })}

              {/* Fret markers (dots) */}
              {FRET_MARKERS.map((fret) => {
                const x = 42 + (fret - 0.5) * 60;
                const isDouble = DOUBLE_MARKERS.includes(fret);
                const centerY = strings.length * 28 / 2 + 10;
                return isDouble ? (
                  <g key={`marker-${fret}`}>
                    <circle cx={x} cy={centerY - 18} r="4" fill="#333322" />
                    <circle cx={x} cy={centerY + 18} r="4" fill="#333322" />
                  </g>
                ) : (
                  <circle key={`marker-${fret}`} cx={x} cy={centerY} r="4" fill="#333322" />
                );
              })}

              {/* Strings */}
              {strings.map((string, si) => {
                const y = 20 + si * 28;
                const thickness = 1.5 + si * 0.4;
                return (
                  <g key={`string-${si}`}>
                    <line
                      x1="20" y1={y} x2={(FRET_COUNT + 1) * 60 + 20} y2={y}
                      stroke={string.color} strokeWidth={thickness} opacity={0.6}
                    />
                    <text
                      x="12" y={y + 4} fill={string.color} fontSize="10"
                      fontFamily="var(--font-mono)" textAnchor="middle" opacity={0.8}
                    >
                      {string.name}
                    </text>
                  </g>
                );
              })}

              {/* Fret numbers */}
              {Array.from({ length: FRET_COUNT }, (_, i) => {
                const x = 42 + (i + 0.5) * 60;
                return (
                  <text
                    key={`fnum-${i}`} x={x} y={strings.length * 28 + 24}
                    fill="#444433" fontSize="9" fontFamily="var(--font-mono)" textAnchor="middle"
                  >
                    {i + 1}
                  </text>
                );
              })}

              {/* Suggested note positions (green outlines — behind played notes) */}
              {isActive && suggestedPositions.map((pos, idx) => {
                const x = pos.fret === 0 ? 30 : 42 + (pos.fret - 0.5) * 60;
                const y = 20 + pos.stringIndex * 28;
                // Don't render on top of detected/MIDI positions
                const isDetected = detectedPositions.some(
                  (dp) => dp.stringIndex === pos.stringIndex && dp.fret === pos.fret,
                );
                const isMidi = midiPositions.some(
                  (mp) => mp.stringIndex === pos.stringIndex && mp.fret === pos.fret,
                );
                if (isDetected || isMidi) return null;

                // Same note name as playing = brighter green
                const color = pos.isSameAsPlayed ? '#66BB6A' : '#4CAF5066';
                const opacity = pos.isSameAsPlayed ? 0.8 : 0.3;

                return (
                  <g key={`sug-${idx}`}>
                    <circle
                      cx={x} cy={y} r="9"
                      fill={pos.isSameAsPlayed ? `${color}33` : 'transparent'}
                      stroke={color} strokeWidth="1.5" opacity={opacity}
                    />
                    <text
                      x={x} y={y + 3.5} fill={color} fontSize="7"
                      fontFamily="var(--font-mono)" textAnchor="middle" opacity={opacity}
                    >
                      {NOTE_NAMES[pos.midi % 12]}
                    </text>
                  </g>
                );
              })}

              {/* Detected note positions (orange — currently playing) */}
              {isActive && detectedPositions.map((pos, idx) => {
                const x = pos.fret === 0 ? 30 : 42 + (pos.fret - 0.5) * 60;
                const y = 20 + pos.stringIndex * 28;
                return (
                  <g key={`det-${idx}`}>
                    {/* Animated glow */}
                    <circle cx={x} cy={y} r="14" fill="none" stroke="#D4A574" strokeWidth="1" opacity={0.4}>
                      <animate attributeName="r" values="12;18;12" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    {/* Dot */}
                    <circle cx={x} cy={y} r="10" fill="#D4A574" opacity={0.9} />
                    {/* Note name */}
                    <text
                      x={x} y={y + 3.5} fill="#0A0A0F" fontSize="8" fontWeight="bold"
                      fontFamily="var(--font-mono)" textAnchor="middle"
                    >
                      {NOTE_NAMES[pos.midi % 12]}
                    </text>
                  </g>
                );
              })}

              {/* MIDI controller note positions (blue) */}
              {midiPositions.map((pos, idx) => {
                const x = pos.fret === 0 ? 30 : 42 + (pos.fret - 0.5) * 60;
                const y = 20 + pos.stringIndex * 28;
                const isDuplicate = detectedPositions.some(
                  (dp) => dp.stringIndex === pos.stringIndex && dp.fret === pos.fret,
                );
                if (isDuplicate) return null;
                return (
                  <g key={`midi-${idx}`}>
                    <circle cx={x} cy={y} r="10" fill="#4A9FD4" opacity={0.85} />
                    <text
                      x={x} y={y + 3.5} fill="#0A0A0F" fontSize="8" fontWeight="bold"
                      fontFamily="var(--font-mono)" textAnchor="middle"
                    >
                      {NOTE_NAMES[pos.midi % 12]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px] text-[#555555] font-[family-name:var(--font-body)]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#D4A574]" /> Playing
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#4A9FD4]" /> MIDI
            </span>
            {suggestedNotes.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full border border-[#4CAF50] bg-transparent" /> Suggested
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};
