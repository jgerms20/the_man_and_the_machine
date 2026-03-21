import { type FC } from 'react';

interface VolumeSliderProps {
  value: number;
  onChange: (v: number) => void;
}

export const VolumeSlider: FC<VolumeSliderProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="volume-slider"
          className="text-xs uppercase tracking-widest text-[#555555] font-[family-name:var(--font-body)]"
        >
          AI Volume
        </label>
        <span className="text-sm font-[family-name:var(--font-mono)] text-[#D4A574]">
          {value}%
        </span>
      </div>

      <div className="relative flex items-center">
        <input
          id="volume-slider"
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="
            w-full h-1.5 rounded-full appearance-none cursor-pointer
            bg-[#1A1A25]
            focus:outline-none
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-[#D4A574]
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-[#0A0A0F]
            [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(212,165,116,0.6)]
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-[#D4A574]
            [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-[#0A0A0F]
            [&::-moz-range-thumb]:shadow-[0_0_8px_rgba(212,165,116,0.6)]
          "
          style={{
            background: `linear-gradient(to right, #D4A574 ${value}%, #1A1A25 ${value}%)`,
          }}
        />
      </div>
    </div>
  );
};
