import { type FC } from 'react';

interface AudioFeatures {
  pitch: number;
  midiNote: number;
  noteName: string;
  rms: number;
  spectralCentroid: number;
  onset: boolean;
  tempo: number;
  timestamp: number;
}

interface AudioFeaturesPanelProps {
  features: AudioFeatures | null;
}

export const AudioFeaturesPanel: FC<AudioFeaturesPanelProps> = ({ features }) => {
  const volumePercent = features ? Math.min(100, Math.round(features.rms * 100)) : 0;

  return (
    <div
      className="
        bg-[#12121A] border border-[#1A1A25]
        rounded-lg p-4 flex flex-col gap-4
        font-[family-name:var(--font-mono)]
      "
    >
      {/* Note Name — large */}
      <div className="flex flex-col items-center py-2">
        <span className="text-[#888888] text-xs uppercase tracking-widest mb-1 font-[family-name:var(--font-body)]">
          Note
        </span>
        <span
          className="text-6xl font-bold text-[#D4A574] leading-none"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {features ? features.noteName : '—'}
        </span>
      </div>

      {/* Frequency */}
      <div className="flex items-center justify-between border-t border-[#1A1A25] pt-3">
        <span className="text-[#555555] text-xs uppercase tracking-widest font-[family-name:var(--font-body)]">
          Frequency
        </span>
        <span className="text-[#E0E0E0] text-sm">
          {features ? `${features.pitch.toFixed(1)} Hz` : '— Hz'}
        </span>
      </div>

      {/* Volume meter */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[#555555] text-xs uppercase tracking-widest font-[family-name:var(--font-body)]">
            Volume
          </span>
          <span className="text-[#E0E0E0] text-sm">
            {features ? `${volumePercent}%` : '—%'}
          </span>
        </div>
        <div className="w-full h-2 bg-[#0A0A0F] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width: `${volumePercent}%`,
              background: `linear-gradient(90deg, #f59e0b ${Math.max(0, volumePercent - 30)}%, #fbbf24 100%)`,
            }}
          />
        </div>
      </div>

      {/* Spectral Centroid */}
      <div className="flex items-center justify-between border-t border-[#1A1A25] pt-3">
        <span className="text-[#555555] text-xs uppercase tracking-widest font-[family-name:var(--font-body)]">
          Spectral Centroid
        </span>
        <span className="text-[#E0E0E0] text-sm">
          {features ? `${Math.round(features.spectralCentroid)} Hz` : '— Hz'}
        </span>
      </div>

      {/* Onset indicator */}
      <div className="flex items-center justify-between border-t border-[#1A1A25] pt-3">
        <span className="text-[#555555] text-xs uppercase tracking-widest font-[family-name:var(--font-body)]">
          Onset
        </span>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded ${
            features?.onset
              ? 'bg-[#4A9FD4] text-white'
              : 'bg-[#1A1A25] text-[#555555]'
          }`}
        >
          {features?.onset ? 'DETECTED' : 'IDLE'}
        </span>
      </div>
    </div>
  );
};
