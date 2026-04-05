import { type FC } from 'react';
import type { DetectedChord } from '../analysis/ChordDetector';

interface ChordDisplayProps {
  chord: DetectedChord | null;
  noteName: string;
  musicalKey: string;
  musicalMode: string;
  interpretText?: string;
}

export const ChordDisplay: FC<ChordDisplayProps> = ({
  chord,
  noteName,
  musicalKey,
  musicalMode,
  interpretText,
}) => {
  const hasChord = chord && chord.confidence > 0.35;
  const keyDisplay = musicalKey ? `${musicalKey} ${musicalMode}` : '';

  return (
    <div className="flex flex-col items-center justify-center py-3 px-4 bg-[#0D0D18] rounded-xl border border-[#1A1A2E] min-h-[90px]">

      {hasChord ? (
        <>
          {/* Big chord name */}
          <div className="flex items-baseline gap-1">
            <span
              className="text-4xl sm:text-5xl font-bold tracking-tight text-[#D4A574]"
              style={{ fontFamily: 'var(--font-display)', lineHeight: 1.1 }}
            >
              {chord.root}
            </span>
            {chord.quality && (
              <span
                className="text-xl sm:text-2xl font-semibold text-[#D4A574CC]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {chord.quality}
              </span>
            )}
          </div>

          {/* Confidence bar */}
          <div className="mt-1.5 w-24 h-0.5 bg-[#1A1A2E] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#D4A574] rounded-full transition-all duration-300"
              style={{ width: `${Math.round(chord.confidence * 100)}%` }}
            />
          </div>

          {/* Key context */}
          {keyDisplay && (
            <span
              className="mt-2 text-[10px] uppercase tracking-widest text-[#444444]"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {keyDisplay}
            </span>
          )}
        </>
      ) : noteName ? (
        <>
          {/* Single note detected */}
          <span
            className="text-3xl sm:text-4xl font-bold text-[#D4A57488]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {noteName}
          </span>
          <span
            className="mt-1 text-[10px] uppercase tracking-widest text-[#333333]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            detecting chord...
          </span>
        </>
      ) : (
        <span
          className="text-[11px] uppercase tracking-widest text-[#2A2A35]"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          play something
        </span>
      )}

      {/* Interpret mode text */}
      {interpretText && (
        <p
          className="mt-2 text-[10px] sm:text-xs text-[#555566] text-center italic max-w-[200px] leading-relaxed"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {interpretText}
        </p>
      )}
    </div>
  );
};
