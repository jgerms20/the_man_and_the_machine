import { type FC } from 'react';

interface InputDeviceSelectorProps {
  devices: MediaDeviceInfo[];
  selectedId: string;
  onChange: (id: string) => void;
}

export const InputDeviceSelector: FC<InputDeviceSelectorProps> = ({
  devices,
  selectedId,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="input-device-select"
        className="
          text-xs uppercase tracking-widest text-[#555555]
          font-[family-name:var(--font-body)]
        "
      >
        Input Device
      </label>
      <div className="relative">
        <select
          id="input-device-select"
          value={selectedId}
          onChange={(e) => onChange(e.target.value)}
          className="
            w-full appearance-none
            bg-[#12121A] border border-[#1A1A25]
            text-[#E0E0E0] text-sm
            font-[family-name:var(--font-body)]
            rounded-md px-3 py-2 pr-8
            cursor-pointer
            transition-colors duration-150
            hover:border-[#4A9FD4]
            focus:outline-none focus:border-[#4A9FD4]
            focus:ring-1 focus:ring-[#4A9FD4]
            disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          {devices.length === 0 ? (
            <option value="" disabled>
              No devices found
            </option>
          ) : (
            devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
              </option>
            ))
          )}
        </select>

        {/* Custom chevron */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
          <svg
            className="w-4 h-4 text-[#555555]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
};
