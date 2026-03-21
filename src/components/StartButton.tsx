import { type FC } from 'react';

interface StartButtonProps {
  onStart: () => void;
}

export const StartButton: FC<StartButtonProps> = ({ onStart }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <button
        onClick={onStart}
        className="
          relative px-16 py-6
          font-[family-name:var(--font-display)]
          text-2xl font-bold tracking-[0.2em]
          text-[#E0E0E0]
          bg-[#12121A]
          border-2 border-[#4A9FD4]
          rounded-lg
          cursor-pointer
          transition-all duration-300
          hover:bg-[#1A1A25] hover:text-white hover:scale-105
          animate-pulse-border
          [animation:pulse-border_2s_ease-in-out_infinite]
          outline-none
          focus:ring-2 focus:ring-[#4A9FD4] focus:ring-offset-2 focus:ring-offset-[#0A0A0F]
        "
        style={{
          boxShadow: '0 0 20px rgba(74, 159, 212, 0.3), 0 0 40px rgba(74, 159, 212, 0.1)',
          animation: 'pulseBorder 2s ease-in-out infinite',
        }}
      >
        START SESSION
      </button>

      <p
        className="
          text-[#888888] text-sm tracking-widest uppercase
          font-[family-name:var(--font-body)]
          text-center
        "
      >
        Plug in your instrument.&nbsp; Grant microphone access.&nbsp; Play.
      </p>

      <style>{`
        @keyframes pulseBorder {
          0%, 100% {
            box-shadow: 0 0 20px rgba(74, 159, 212, 0.3), 0 0 40px rgba(74, 159, 212, 0.1);
            border-color: rgba(74, 159, 212, 0.8);
          }
          50% {
            box-shadow: 0 0 30px rgba(74, 159, 212, 0.7), 0 0 60px rgba(74, 159, 212, 0.3);
            border-color: rgba(74, 159, 212, 1);
          }
        }
      `}</style>
    </div>
  );
};
