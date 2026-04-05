import { useState, type FC } from 'react';

type AIModeName = 'listen' | 'supportive' | 'challenger' | 'adversary' | 'mirror' | 'free' | 'drums' | 'assisted' | 'interpret' | 'suggest';

interface ModeSelectorProps {
  currentMode: AIModeName;
  onModeChange: (mode: AIModeName) => void;
  aiEnabled: boolean;
  onAiToggle: () => void;
}

interface ModeConfig {
  name: AIModeName;
  label: string;
  subtitle: string;
  color: string;
  shortcut: number;
  /** Whether this mode produces AI audio output */
  isAiMode: boolean;
}

const MODES: ModeConfig[] = [
  {
    name: 'listen',
    label: 'Listen',
    subtitle: 'detect only',
    color: '#78909C',
    shortcut: 1,
    isAiMode: false,
  },
  {
    name: 'interpret',
    label: 'Interpret',
    subtitle: 'text analysis',
    color: '#80CBC4',
    shortcut: 2,
    isAiMode: false,
  },
  {
    name: 'suggest',
    label: 'Suggest',
    subtitle: 'circle of fifths',
    color: '#FFD54F',
    shortcut: 3,
    isAiMode: false,
  },
  {
    name: 'assisted',
    label: 'Assisted',
    subtitle: 'guides your playing',
    color: '#00BCD4',
    shortcut: 4,
    isAiMode: true,
  },
  {
    name: 'drums',
    label: 'Drums',
    subtitle: 'background beat',
    color: '#FF5722',
    shortcut: 5,
    isAiMode: true,
  },
  {
    name: 'supportive',
    label: 'Supportive',
    subtitle: 'follows your lead',
    color: '#4CAF50',
    shortcut: 6,
    isAiMode: true,
  },
  {
    name: 'challenger',
    label: 'Challenger',
    subtitle: 'pushes boundaries',
    color: '#FF9800',
    shortcut: 7,
    isAiMode: true,
  },
  {
    name: 'adversary',
    label: 'Adversary',
    subtitle: 'plays against you',
    color: '#F44336',
    shortcut: 8,
    isAiMode: true,
  },
  {
    name: 'mirror',
    label: 'Mirror',
    subtitle: 'reflects & transforms',
    color: '#9C27B0',
    shortcut: 9,
    isAiMode: true,
  },
  {
    name: 'free',
    label: 'Free',
    subtitle: 'independent voice',
    color: '#2196F3',
    shortcut: 0,
    isAiMode: true,
  },
];

export const ModeSelector: FC<ModeSelectorProps> = ({
  currentMode,
  onModeChange,
  aiEnabled,
  onAiToggle,
}) => {
  const [expanded, setExpanded] = useState(false);

  const current = MODES.find((m) => m.name === currentMode) ?? MODES[0]!;

  const handleSelect = (mode: AIModeName) => {
    onModeChange(mode);
    setExpanded(false);
  };

  // Group modes for display
  const passiveModes = MODES.filter((m) => !m.isAiMode);
  const aiModes = MODES.filter((m) => m.isAiMode);

  return (
    <div className="flex flex-col gap-2">
      {/* Collapsed pill — always visible */}
      <div className="flex items-center gap-2">
        {/* Current mode pill — tap to expand */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg border transition-all duration-200 cursor-pointer focus:outline-none"
          style={{
            backgroundColor: `${current.color}18`,
            borderColor: `${current.color}55`,
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: current.color, fontFamily: 'var(--font-display)' }}
            >
              {current.label}
            </span>
            <span
              className="text-[10px] hidden sm:inline"
              style={{ color: `${current.color}88`, fontFamily: 'var(--font-body)' }}
            >
              {current.subtitle}
            </span>
          </div>
          {/* Chevron */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={`${current.color}88`}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* AI ON/OFF toggle — only shown for AI modes */}
        {current.isAiMode && (
          <button
            onClick={onAiToggle}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border font-semibold text-xs uppercase tracking-widest transition-all duration-200 cursor-pointer focus:outline-none min-w-[64px] justify-center"
            style={{
              fontFamily: 'var(--font-display)',
              backgroundColor: aiEnabled ? '#4A9FD422' : '#1A1A25',
              borderColor: aiEnabled ? '#4A9FD4' : '#2A2A35',
              color: aiEnabled ? '#4A9FD4' : '#444455',
              boxShadow: aiEnabled ? '0 0 10px #4A9FD433' : 'none',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: aiEnabled ? '#4A9FD4' : '#333344' }}
            />
            {aiEnabled ? 'ON' : 'OFF'}
          </button>
        )}
      </div>

      {/* Expanded mode picker */}
      {expanded && (
        <div className="flex flex-col gap-2 p-3 bg-[#0D0D18] rounded-xl border border-[#1A1A2E]">

          {/* Passive modes */}
          <div>
            <span className="text-[9px] uppercase tracking-widest text-[#333344] block mb-1.5"
                  style={{ fontFamily: 'var(--font-body)' }}>
              Listen modes
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {passiveModes.map((mode) => (
                <ModeButton
                  key={mode.name}
                  mode={mode}
                  isActive={currentMode === mode.name}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#1A1A25]" />

          {/* AI modes */}
          <div>
            <span className="text-[9px] uppercase tracking-widest text-[#333344] block mb-1.5"
                  style={{ fontFamily: 'var(--font-body)' }}>
              AI modes
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {aiModes.map((mode) => (
                <ModeButton
                  key={mode.name}
                  mode={mode}
                  isActive={currentMode === mode.name}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ModeButtonProps {
  mode: ModeConfig;
  isActive: boolean;
  onSelect: (name: AIModeName) => void;
}

const ModeButton: FC<ModeButtonProps> = ({ mode, isActive, onSelect }) => (
  <button
    onClick={() => onSelect(mode.name)}
    className="flex flex-col items-center justify-center px-1.5 py-2 rounded-lg transition-all duration-200 cursor-pointer focus:outline-none min-h-[48px]"
    style={{
      backgroundColor: isActive ? `${mode.color}22` : 'transparent',
      border: `1.5px solid ${isActive ? mode.color : `${mode.color}44`}`,
      boxShadow: isActive ? `0 0 10px ${mode.color}44` : 'none',
    }}
  >
    <span
      className="text-xs font-semibold whitespace-nowrap"
      style={{ color: isActive ? mode.color : `${mode.color}88`, fontFamily: 'var(--font-display)' }}
    >
      {mode.label}
    </span>
    <span
      className="text-[8px] mt-0.5 whitespace-nowrap"
      style={{ color: isActive ? `${mode.color}bb` : '#3A3A4A', fontFamily: 'var(--font-body)' }}
    >
      {mode.subtitle}
    </span>
  </button>
);

export { MODES };
