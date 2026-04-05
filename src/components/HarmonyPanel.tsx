import { type FC } from 'react';
import type { SuggestData } from '../ai/modes/SuggestMode';
import type { DetectedChord } from '../analysis/ChordDetector';
import { getCircleOfFifthsSuggestions } from '../analysis/ChordDetector';

interface HarmonyPanelProps {
  suggestData: SuggestData | null;
  chord: DetectedChord | null;
  musicalKey: string;
  musicalMode: string;
  isVisible: boolean;
}

export const HarmonyPanel: FC<HarmonyPanelProps> = ({
  suggestData,
  chord,
  musicalKey,
  musicalMode,
  isVisible,
}) => {
  if (!isVisible) return null;

  // If we have a detected chord use its data, otherwise fall back to key
  const hasSuggest = suggestData !== null;
  const hasChord = chord && chord.confidence > 0.35;

  // Derive suggestions from chord if no suggestData
  const cofData = hasChord
    ? getCircleOfFifthsSuggestions(
        ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(chord.root),
        chord.quality,
      )
    : null;

  const compatible = suggestData?.compatible ?? cofData?.adjacent ?? [];
  const scaleNotes = suggestData?.scaleNotes ?? [];
  const circleLabel = suggestData?.circleLabel ??
    (musicalKey ? `${musicalKey} ${musicalMode}` : '');
  const nextChords = suggestData?.nextChords ?? [];
  const colorNotes = cofData?.colorNotes ?? [];

  if (!hasSuggest && !hasChord && !musicalKey) {
    return (
      <div className="px-4 py-3 bg-[#0D0D18] rounded-xl border border-[#1A1A2E]">
        <p className="text-[10px] uppercase tracking-widest text-[#2A2A35] text-center"
           style={{ fontFamily: 'var(--font-body)' }}>
          Play notes to see harmony suggestions
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-[#0D0D18] rounded-xl border border-[#1A1A2E]">

      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-[#555555]"
              style={{ fontFamily: 'var(--font-body)' }}>
          Harmony Guide
        </span>
        {circleLabel && (
          <span className="text-[10px] text-[#4A9FD4]"
                style={{ fontFamily: 'var(--font-mono)' }}>
            {circleLabel}
          </span>
        )}
      </div>

      {/* Scale notes */}
      {scaleNotes.length > 0 && (
        <div>
          <span className="text-[9px] uppercase tracking-widest text-[#333344] block mb-1"
                style={{ fontFamily: 'var(--font-body)' }}>
            Scale
          </span>
          <div className="flex flex-wrap gap-1">
            {scaleNotes.map((note) => (
              <span
                key={note}
                className="text-[11px] px-2 py-0.5 rounded bg-[#D4A57414] border border-[#D4A57440] text-[#D4A574]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {note}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Compatible chords */}
      {compatible.length > 0 && (
        <div>
          <span className="text-[9px] uppercase tracking-widest text-[#333344] block mb-1"
                style={{ fontFamily: 'var(--font-body)' }}>
            Works with
          </span>
          <div className="flex flex-wrap gap-1">
            {compatible.slice(0, 6).map((ch) => (
              <span
                key={ch}
                className="text-[11px] px-2 py-0.5 rounded bg-[#4A9FD414] border border-[#4A9FD440] text-[#4A9FD4]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {ch}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Color tones */}
      {colorNotes.length > 0 && (
        <div>
          <span className="text-[9px] uppercase tracking-widest text-[#333344] block mb-1"
                style={{ fontFamily: 'var(--font-body)' }}>
            Color tones
          </span>
          <div className="flex flex-wrap gap-1">
            {colorNotes.map((note) => (
              <span
                key={note}
                className="text-[11px] px-2 py-0.5 rounded bg-[#9C27B014] border border-[#9C27B040] text-[#CE93D8]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {note}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Chord progressions */}
      {nextChords.length > 0 && (
        <div className="border-t border-[#1A1A2E] pt-2">
          <span className="text-[9px] uppercase tracking-widest text-[#333344] block mb-1"
                style={{ fontFamily: 'var(--font-body)' }}>
            Try these progressions
          </span>
          <div className="flex flex-col gap-1">
            {nextChords.slice(0, 2).map((prog) => (
              <span
                key={prog}
                className="text-[10px] text-[#555566]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {prog}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
