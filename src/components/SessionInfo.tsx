import { type FC, useState, useEffect } from 'react';

interface SessionInfoProps {
  startTime: number | null;
  tempo: number;
  detectedKey: string;
  mode: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const SessionInfo: FC<SessionInfoProps> = ({ startTime, tempo, detectedKey, mode }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (startTime === null) {
      setElapsed(0);
      return;
    }

    const tick = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  const items = [
    { label: 'Time', value: formatTime(elapsed) },
    { label: 'BPM', value: tempo > 0 ? String(Math.round(tempo)) : '—' },
    { label: 'Key', value: detectedKey || '—' },
    { label: 'Mode', value: mode || '—' },
  ];

  return (
    <div
      className="
        flex flex-row items-center justify-center flex-wrap gap-0
        bg-[#12121A] border border-[#1A1A25] rounded-lg px-4 py-3
      "
    >
      {items.map((item, index) => (
        <div key={item.label} className="flex items-center">
          <div className="flex flex-col items-center px-4">
            <span className="text-[10px] uppercase tracking-widest text-[#555555] font-[family-name:var(--font-body)]">
              {item.label}
            </span>
            <span
              className="text-[#E0E0E0] text-sm mt-0.5"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {item.value}
            </span>
          </div>
          {index < items.length - 1 && (
            <span className="text-[#1A1A25] text-lg select-none font-[family-name:var(--font-mono)]">
              │
            </span>
          )}
        </div>
      ))}
    </div>
  );
};
