import { type FC, useRef, useEffect } from 'react';

interface WaveformProps {
  analyserNode: AnalyserNode | null;
  color?: string;
  height?: number;
}

export const Waveform: FC<WaveformProps> = ({
  analyserNode,
  color = '#D4A574',
  height = 80,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);

      const { width, height: h } = canvas;

      // Clear
      ctx.clearRect(0, 0, width, h);
      ctx.fillStyle = '#12121A';
      ctx.fillRect(0, 0, width, h);

      if (!analyserNode) {
        // Draw a flat idle line
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(width, h / 2);
        ctx.strokeStyle = `${color}33`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        return;
      }

      const bufferLength = analyserNode.fftSize;
      const dataArray = new Float32Array(bufferLength);
      analyserNode.getFloatTimeDomainData(dataArray);

      // Draw smooth waveform
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // Add a glow effect
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;

      const sliceWidth = width / (bufferLength - 1);
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const sample = dataArray[i]; // -1 to 1
        const y = ((sample + 1) / 2) * h;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          // Use quadratic curve for smoother line
          const prevX = x - sliceWidth;
          const prevSample = dataArray[i - 1];
          const prevY = ((prevSample + 1) / 2) * h;
          const midX = (prevX + x) / 2;
          const midY = (prevY + y) / 2;
          ctx.quadraticCurveTo(prevX, prevY, midX, midY);
        }

        x += sliceWidth;
      }

      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [analyserNode, color]);

  // Handle canvas resize with ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        canvas.width = Math.round(width * window.devicePixelRatio);
        canvas.height = Math.round(height * window.devicePixelRatio);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
      }
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [height]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg bg-[#12121A]"
      style={{ height: `${height}px`, display: 'block' }}
    />
  );
};
