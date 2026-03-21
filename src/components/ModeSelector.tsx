import { type FC } from 'react';

type AIModeName = 'supportive' | 'challenger' | 'adversary' | 'mirror' | 'free';

interface ModeSelectorProps {
  currentMode: AIModeName;
  onModeChange: (mode: AIModeName) => void;
}

interface ModeConfig {
  name: AIModeName;
  label: string;
  subtitle: string;
  color: string;
}

const MODES: ModeConfig[] = [
  {
    name: 'supportive',
    label: 'Supportive',
    subtitle: 'follows your lead',
    color: '#4CAF50',
  },
  {
    name: 'challenger',
    label: 'Challenger',
    subtitle: 'pushes boundaries',
    color: '#FF9800',
  },
  {
    name: 'adversary',
    label: 'Adversary',
    subtitle: 'plays against you',
    color: '#F44336',
  },
  {
    name: 'mirror',
    label: 'Mirror',
    subtitle: 'reflects & transforms',
    color: '#9C27B0',
  },
  {
    name: 'free',
    label: 'Free',
    subtitle: 'independent voice',
    color: '#2196F3',
  },
];

export const ModeSelector: FC<ModeSelectorProps> = ({ currentMode, onModeChange }) => {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-widest text-[#555555] font-[family-name:var(--font-body)]">
        AI Mode
      </span>
      <div className="flex flex-row gap-2 flex-wrap">
        {MODES.map((mode) => {
          const isActive = currentMode === mode.name;
          return (
            <button
              key={mode.name}
              onClick={() => onModeChange(mode.name)}
              className="
                flex flex-col items-center justify-center
                flex-1 min-w-[80px]
                px-3 py-2.5 rounded-lg
                transition-all duration-200
                cursor-pointer
                focus:outline-none
              "
              style={{
                backgroundColor: isActive ? `${mode.color}22` : 'transparent',
                border: `1.5px solid ${isActive ? mode.color : `${mode.color}55`}`,
                boxShadow: isActive ? `0 0 12px ${mode.color}44` : 'none',
              }}
            >
              <span
                className="text-sm font-semibold font-[family-name:var(--font-display)] whitespace-nowrap"
                style={{ color: isActive ? mode.color : `${mode.color}99` }}
              >
                {mode.label}
              </span>
              <span
                className="text-[10px] mt-0.5 font-[family-name:var(--font-body)] whitespace-nowrap"
                style={{ color: isActive ? `${mode.color}cc` : '#555555' }}
              >
                {mode.subtitle}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
