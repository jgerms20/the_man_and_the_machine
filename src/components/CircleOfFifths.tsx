import { type FC, useMemo } from 'react';

interface CircleOfFifthsProps {
  /** Current detected key root note name, e.g. "C", "A" */
  activeKey: string;
  /** "major" or "minor" */
  activeMode: string;
  /** Additional highlighted keys (compatible chords from suggest mode) */
  highlightedKeys?: string[];
  /** Size in pixels */
  size?: number;
}

// Circle of fifths — major keys clockwise
const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
// Relative minor for each position
const MINOR_KEYS = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];

// Parse "Am" → { root: "A", isMinor: true }
function parseKey(key: string): { root: string; isMinor: boolean } {
  const isMinor = key.endsWith('m') && key !== 'Am' ? true : key.endsWith('m');
  const root = isMinor ? key.slice(0, -1) : key;
  return { root, isMinor };
}

export const CircleOfFifths: FC<CircleOfFifthsProps> = ({
  activeKey,
  activeMode,
  highlightedKeys = [],
  size = 220,
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 12;
  const innerR = outerR * 0.62;

  // Find active index
  const activeIdx = useMemo(() => {
    if (!activeKey) return -1;
    if (activeMode === 'minor') {
      // Find position in minor ring
      const minorIdx = MINOR_KEYS.findIndex((k) => k.startsWith(activeKey));
      return minorIdx;
    }
    return MAJOR_KEYS.indexOf(activeKey);
  }, [activeKey, activeMode]);

  // Build set of highlighted keys for quick lookup
  const highlightSet = useMemo(() => {
    const set = new Set<string>();
    for (const k of highlightedKeys) {
      set.add(k);
      // Also mark the parsed root
      const { root } = parseKey(k);
      set.add(root);
    }
    return set;
  }, [highlightedKeys]);

  const segments = MAJOR_KEYS.map((major, i) => {
    const minor = MINOR_KEYS[i]!;
    const angle = (i * 30 - 90) * (Math.PI / 180); // start at top

    // Positions
    const majorX = cx + Math.cos(angle) * (outerR * 0.82);
    const majorY = cy + Math.sin(angle) * (outerR * 0.82);
    const minorX = cx + Math.cos(angle) * (innerR * 0.82);
    const minorY = cy + Math.sin(angle) * (innerR * 0.82);

    // Active states
    const isMajorActive = activeIdx === i && activeMode !== 'minor';
    const isMinorActive = activeIdx === i && activeMode === 'minor';
    const isMajorHighlighted = highlightSet.has(major);
    const isMinorHighlighted = highlightSet.has(minor);

    // Wedge path (outer ring)
    const a1 = ((i - 0.5) * 30 - 90) * (Math.PI / 180);
    const a2 = ((i + 0.5) * 30 - 90) * (Math.PI / 180);
    const ox1 = cx + Math.cos(a1) * outerR;
    const oy1 = cy + Math.sin(a1) * outerR;
    const ox2 = cx + Math.cos(a2) * outerR;
    const oy2 = cy + Math.sin(a2) * outerR;
    const ix1 = cx + Math.cos(a1) * innerR;
    const iy1 = cy + Math.sin(a1) * innerR;
    const ix2 = cx + Math.cos(a2) * innerR;
    const iy2 = cy + Math.sin(a2) * innerR;

    const outerPath = `M ${ox1} ${oy1} A ${outerR} ${outerR} 0 0 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 0 0 ${ix1} ${iy1} Z`;

    // Inner wedge
    const iR2 = innerR * 0.15;
    const cx1 = cx + Math.cos(a1) * iR2;
    const cy1 = cy + Math.sin(a1) * iR2;
    const cx2 = cx + Math.cos(a2) * iR2;
    const cy2 = cy + Math.sin(a2) * iR2;
    const innerPath = `M ${ix1} ${iy1} A ${innerR} ${innerR} 0 0 1 ${ix2} ${iy2} L ${cx2} ${cy2} A ${iR2} ${iR2} 0 0 0 ${cx1} ${cy1} Z`;

    // Colors
    let outerFill = '#1A1A25';
    let outerStroke = '#2A2A35';
    if (isMajorActive) {
      outerFill = '#D4A57444';
      outerStroke = '#D4A574';
    } else if (isMajorHighlighted) {
      outerFill = '#4A9FD422';
      outerStroke = '#4A9FD466';
    }

    let innerFill = '#12121A';
    let innerStroke = '#1A1A25';
    if (isMinorActive) {
      innerFill = '#D4A57444';
      innerStroke = '#D4A574';
    } else if (isMinorHighlighted) {
      innerFill = '#4A9FD422';
      innerStroke = '#4A9FD466';
    }

    return (
      <g key={i}>
        {/* Outer wedge (major) */}
        <path d={outerPath} fill={outerFill} stroke={outerStroke} strokeWidth="1" />
        {/* Inner wedge (minor) */}
        <path d={innerPath} fill={innerFill} stroke={innerStroke} strokeWidth="0.5" />
        {/* Major key label */}
        <text
          x={majorX} y={majorY + 4}
          textAnchor="middle"
          fontSize={isMajorActive ? "12" : "10"}
          fontWeight={isMajorActive ? "bold" : "normal"}
          fontFamily="var(--font-mono)"
          fill={isMajorActive ? '#D4A574' : isMajorHighlighted ? '#4A9FD4' : '#666666'}
        >
          {major}
        </text>
        {/* Minor key label */}
        <text
          x={minorX} y={minorY + 3}
          textAnchor="middle"
          fontSize={isMinorActive ? "10" : "8"}
          fontWeight={isMinorActive ? "bold" : "normal"}
          fontFamily="var(--font-mono)"
          fill={isMinorActive ? '#D4A574' : isMinorHighlighted ? '#4A9FD4' : '#444444'}
        >
          {minor}
        </text>
      </g>
    );
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full h-auto"
      style={{ maxWidth: `${size}px` }}
    >
      {/* Background circles */}
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#1A1A25" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="#1A1A25" strokeWidth="0.5" />

      {segments}

      {/* Center label */}
      {activeKey && (
        <text
          x={cx} y={cy + 4}
          textAnchor="middle"
          fontSize="11"
          fontWeight="bold"
          fontFamily="var(--font-display)"
          fill="#D4A574"
        >
          {activeKey} {activeMode === 'minor' ? 'm' : ''}
        </text>
      )}
    </svg>
  );
};
