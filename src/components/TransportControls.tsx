import { type FC } from 'react';

interface TransportControlsProps {
  isPlaying: boolean;
  isRecording: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRecord: () => void;
  onSave: () => void;
  onExport: () => void;
}

interface TransportButtonProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  variant?: 'default' | 'record' | 'active';
  isAnimating?: boolean;
}

const TransportButton: FC<TransportButtonProps> = ({
  onClick,
  title,
  children,
  variant = 'default',
  isAnimating = false,
}) => {
  const baseClasses = `
    flex items-center justify-center
    w-10 h-10 rounded-lg
    text-lg
    cursor-pointer
    transition-all duration-150
    focus:outline-none focus:ring-1 focus:ring-[#4A9FD4]
    active:scale-95
  `;

  const variantClasses = {
    default: 'bg-[#1A1A25] text-[#E0E0E0] hover:bg-[#252530] hover:text-white border border-[#252530] hover:border-[#4A9FD4]',
    record: `border text-white ${
      isAnimating
        ? 'bg-[#F44336] border-[#F44336] shadow-[0_0_12px_rgba(244,67,54,0.7)]'
        : 'bg-[#F4433622] border-[#F4433688] hover:bg-[#F4433633]'
    }`,
    active: 'bg-[#4A9FD422] border border-[#4A9FD4] text-[#4A9FD4]',
  };

  return (
    <button
      onClick={onClick}
      title={title}
      className={`${baseClasses} ${variantClasses[variant]}`}
      style={
        isAnimating && variant === 'record'
          ? { animation: 'recordPulse 1s ease-in-out infinite' }
          : undefined
      }
    >
      {children}
    </button>
  );
};

export const TransportControls: FC<TransportControlsProps> = ({
  isPlaying,
  isRecording,
  onPlay,
  onPause,
  onStop,
  onRecord,
  onSave,
  onExport,
}) => {
  return (
    <div className="flex flex-row items-center gap-2">
      <style>{`
        @keyframes recordPulse {
          0%, 100% { box-shadow: 0 0 8px rgba(244, 67, 54, 0.5); }
          50% { box-shadow: 0 0 18px rgba(244, 67, 54, 0.9); }
        }
      `}</style>

      {/* Play / Pause toggle */}
      <TransportButton
        onClick={isPlaying ? onPause : onPlay}
        title={isPlaying ? 'Pause' : 'Play'}
        variant={isPlaying ? 'active' : 'default'}
      >
        {isPlaying ? '⏸' : '▶'}
      </TransportButton>

      {/* Stop */}
      <TransportButton onClick={onStop} title="Stop">
        ⏹
      </TransportButton>

      {/* Divider */}
      <div className="w-px h-6 bg-[#1A1A25] mx-1" />

      {/* Record */}
      <TransportButton
        onClick={onRecord}
        title={isRecording ? 'Stop Recording' : 'Record'}
        variant="record"
        isAnimating={isRecording}
      >
        ⏺
      </TransportButton>

      {/* Divider */}
      <div className="w-px h-6 bg-[#1A1A25] mx-1" />

      {/* Save */}
      <TransportButton onClick={onSave} title="Save">
        💾
      </TransportButton>

      {/* Export */}
      <TransportButton onClick={onExport} title="Export">
        📤
      </TransportButton>
    </div>
  );
};
