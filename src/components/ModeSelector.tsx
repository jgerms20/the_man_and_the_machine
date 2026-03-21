import { type FC } from 'react';

type AIModeName = 'supportive' | 'challenger' | 'adversary' | 'mirror' | 'free' | 'drums' | 'assisted';

interface ModeSelectorProps {
  currentMode: AIModeName;
  onModeChange: (mode: AIModeName) => void;
}

interface ModeConfig {
  name: AIModeName;
  label: string;
  subtitle: string;
  color: string;
  /** Keyboard shortcut number */
  shortcut: number;
}

const MODES: ModeConfig[] = [
  {
    name: 'assisted',
    label: 'Assisted',
    subtitle: 'guides your playing',
    color: '#00BCD4',
    shortcut: 1,
  },
  {
    name: 'drums',
    label: 'Drums',
    subtitle: 'background beat',
    color: '#FF5722',
    shortcut: 2,
  },
  {
    name: 'supportive',
    label: 'Supportive',
    subtitle: 'follows your lead',
    color: '#4CAF50',
    shortcut: 3,
  },
  {
    name: 'challenger',
    label: 'Challenger',
    subtitle: 'pushes boundaries',
    color: '#FF9800',
    shortcut: 4,
  },
  {
    name: 'adversary',
    label: 'Adversary',
    subtitle: 'plays against you',
    color: '#F44336',
    shortcut: 5,
  },
  {
    name: 'mirror',
    label: 'Mirror',
    subtitle: 'reflects & transforms',
    color: '#9C27B0',
    shortcut: 6,
  },
  {
    name: 'free',
    label: 'Free',
    subtitle: 'independent voice',
    color: '#2196F3',
    shortcut: 7,
  },
];

export const ModeSelector: FC<ModeSelectorProps> = ({ currentMode, onModeChange }) => {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-widest text-[#555555] font-[family-name:var(--font-body)]">
        AI Mode
      </span>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 sm:gap-2">
        {MODES.map((mode) => {
          const isActive = currentMode === mode.name;
          return (
            <button
              key={mode.name}
              onClick={() => onModeChange(mode.name)}
              className="
                flex flex-col items-center justify-center
                px-1.5 py-2 sm:px-3 sm:py-2.5 rounded-lg
                transition-all duration-200
                cursor-pointer
                focus:outline-none
                min-h-[52px]
              "
              style={{
                backgroundColor: isActive ? `${mode.color}22` : 'transparent',
                border: `1.5px solid ${isActive ? mode.color : `${mode.color}55`}`,
                boxShadow: isActive ? `0 0 12px ${mode.color}44` : 'none',
              }}
            >
              <span
                className="text-xs sm:text-sm font-semibold font-[family-name:var(--font-display)] whitespace-nowrap"
                style={{ color: isActive ? mode.color : `${mode.color}99` }}
              >
                {mode.label}
              </span>
              <span
                className="text-[8px] sm:text-[10px] mt-0.5 font-[family-name:var(--font-body)] whitespace-nowrap hidden sm:block"
                style={{ color: isActive ? `${mode.color}cc` : '#555555' }}
              >
                {mode.subtitle}
              </span>
              <span
                className="text-[8px] mt-0.5 font-[family-name:var(--font-mono)] opacity-40"
              >
                {mode.shortcut}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export { MODES };
