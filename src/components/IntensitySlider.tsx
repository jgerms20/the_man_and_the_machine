import { type FC } from 'react';

interface IntensitySliderProps {
  value: number;
  onChange: (v: number) => void;
}

export const IntensitySlider: FC<IntensitySliderProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="intensity-slider"
          className="text-xs uppercase tracking-widest text-[#555555] font-[family-name:var(--font-body)]"
        >
          AI Intensity
        </label>
        <span className="text-sm font-[family-name:var(--font-mono)] text-[#4A9FD4]">
          {value}%
        </span>
      </div>

      <div className="relative flex items-center">
        <input
          id="intensity-slider"
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
            [&::-webkit-slider-thumb]:bg-[#4A9FD4]
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-[#0A0A0F]
            [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(74,159,212,0.6)]
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-[#4A9FD4]
            [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-[#0A0A0F]
            [&::-moz-range-thumb]:shadow-[0_0_8px_rgba(74,159,212,0.6)]
          "
          style={{
            background: `linear-gradient(to right, #4A9FD4 ${value}%, #1A1A25 ${value}%)`,
          }}
        />
      </div>
    </div>
  );
};
