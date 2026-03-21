import { type FC, useMemo } from 'react';

interface BassFretboardProps {
  /** Current detected MIDI note (0-127), or null/0 if nothing detected */
  currentMidiNote: number | null;
  /** Current note name like "E2", "A#3" */
  currentNoteName: string;
  /** Whether audio input is active */
  isActive: boolean;
  /** MIDI note from MIDI controller, if any */
  midiControllerNote?: number | null;
}

// 5-string bass: B0, E1, A1, D2, G2
// MIDI: B0=35, E1=40, A1=45, D2=50, G2=55
const STRINGS = [
  { name: 'G', openMidi: 55, color: '#4A9FD4' },
  { name: 'D', openMidi: 50, color: '#6CB4DE' },
  { name: 'A', openMidi: 45, color: '#D4A574' },
  { name: 'E', openMidi: 40, color: '#C4956A' },
  { name: 'B', openMidi: 35, color: '#B48560' },
];

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

function findNoteOnFretboard(midiNote: number): FretPosition[] {
  const positions: FretPosition[] = [];
  for (let si = 0; si < STRINGS.length; si++) {
    const fret = midiNote - STRINGS[si].openMidi;
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
}) => {
  // Find positions for both detected and MIDI controller notes
  const detectedPositions = useMemo(() => {
    if (!currentMidiNote || currentMidiNote < 28 || currentMidiNote > 72) return [];
    return findNoteOnFretboard(currentMidiNote);
  }, [currentMidiNote]);

  const midiPositions = useMemo(() => {
    if (!midiControllerNote || midiControllerNote < 28 || midiControllerNote > 72) return [];
    return findNoteOnFretboard(midiControllerNote);
  }, [midiControllerNote]);

  const displayNote = currentNoteName || (currentMidiNote ? midiToNoteName(currentMidiNote) : '');

  return (
    <div className="flex flex-col gap-2">
      {/* Current note display */}
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-[#555555] font-[family-name:var(--font-body)]">
          Fretboard
        </span>
        {displayNote && isActive && (
          <span
            className="text-lg font-bold text-[#D4A574] font-[family-name:var(--font-mono)] transition-all duration-100"
            style={{
              textShadow: '0 0 12px rgba(212,165,116,0.6)',
            }}
          >
            {displayNote}
          </span>
        )}
      </div>

      {/* Fretboard SVG */}
      <div className="relative bg-[#1A1208] rounded-lg border border-[#2A2418] overflow-hidden">
        <svg
          viewBox={`0 0 ${(FRET_COUNT + 1) * 60 + 40} ${STRINGS.length * 28 + 20}`}
          className="w-full h-auto"
          style={{ minHeight: '80px' }}
        >
          {/* Nut */}
          <rect x="38" y="8" width="4" height={STRINGS.length * 28 + 4} fill="#E8D5B7" rx="1" />

          {/* Fret wires */}
          {Array.from({ length: FRET_COUNT }, (_, i) => {
            const x = 42 + (i + 1) * 60;
            return (
              <line
                key={`fret-${i}`}
                x1={x}
                y1="8"
                x2={x}
                y2={STRINGS.length * 28 + 12}
                stroke="#555544"
                strokeWidth="2"
              />
            );
          })}

          {/* Fret markers (dots) */}
          {FRET_MARKERS.map((fret) => {
            const x = 42 + (fret - 0.5) * 60;
            const isDouble = DOUBLE_MARKERS.includes(fret);
            const centerY = STRINGS.length * 28 / 2 + 10;
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
          {STRINGS.map((string, si) => {
            const y = 20 + si * 28;
            const thickness = 1.5 + si * 0.5; // thicker for lower strings
            return (
              <g key={`string-${si}`}>
                <line
                  x1="20"
                  y1={y}
                  x2={(FRET_COUNT + 1) * 60 + 20}
                  y2={y}
                  stroke={string.color}
                  strokeWidth={thickness}
                  opacity={0.6}
                />
                {/* String label */}
                <text
                  x="12"
                  y={y + 4}
                  fill={string.color}
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                  opacity={0.8}
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
                key={`fnum-${i}`}
                x={x}
                y={STRINGS.length * 28 + 24}
                fill="#444433"
                fontSize="9"
                fontFamily="var(--font-mono)"
                textAnchor="middle"
              >
                {i + 1}
              </text>
            );
          })}

          {/* Detected note positions (from mic/pitch detection) */}
          {isActive && detectedPositions.map((pos, idx) => {
            const x = pos.fret === 0
              ? 30  // open string position
              : 42 + (pos.fret - 0.5) * 60;
            const y = 20 + pos.stringIndex * 28;
            return (
              <g key={`det-${idx}`}>
                {/* Glow */}
                <circle
                  cx={x}
                  cy={y}
                  r="14"
                  fill="none"
                  stroke="#D4A574"
                  strokeWidth="1"
                  opacity={0.4}
                >
                  <animate
                    attributeName="r"
                    values="12;18;12"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.4;0.1;0.4"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </circle>
                {/* Dot */}
                <circle cx={x} cy={y} r="10" fill="#D4A574" opacity={0.9} />
                {/* Note name */}
                <text
                  x={x}
                  y={y + 3.5}
                  fill="#0A0A0F"
                  fontSize="8"
                  fontWeight="bold"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
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
            // Skip if same position as detected
            const isDuplicate = detectedPositions.some(
              (dp) => dp.stringIndex === pos.stringIndex && dp.fret === pos.fret,
            );
            if (isDuplicate) return null;
            return (
              <g key={`midi-${idx}`}>
                <circle cx={x} cy={y} r="10" fill="#4A9FD4" opacity={0.85} />
                <text
                  x={x}
                  y={y + 3.5}
                  fill="#0A0A0F"
                  fontSize="8"
                  fontWeight="bold"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
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
          <span className="w-2 h-2 rounded-full bg-[#D4A574]" /> Detected
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#4A9FD4]" /> MIDI
        </span>
      </div>
    </div>
  );
};
