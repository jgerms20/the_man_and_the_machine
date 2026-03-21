import type { AIModeName } from '../ai/types';

const HUMAN_COLOR = '#D4A574';
const AI_COLOR = '#4A9FD4';
const TENSION_COLOR = '#FF4444';
const HARMONY_COLOR = '#E8D5B7';

const MODE_COLORS: Record<AIModeName, string> = {
  supportive: '#4CAF50',
  challenger: '#FF9800',
  adversary: '#F44336',
  mirror: '#9C27B0',
  free: '#2196F3',
  drums: '#FF5722',
  assisted: '#00BCD4',
};

export class InteractionZone {
  private smoothHumanRms = 0;
  private smoothAiRms = 0;
  private smoothTension = 0;
  private currentMode: AIModeName = 'supportive';
  private phase = 0;

  update(
    humanRms: number,
    aiRms: number,
    harmonicTension: number,
    aiMode: AIModeName,
  ): void {
    const alpha = 0.1;
    this.smoothHumanRms += (humanRms - this.smoothHumanRms) * alpha;
    this.smoothAiRms += (aiRms - this.smoothAiRms) * alpha;
    this.smoothTension += (harmonicTension - this.smoothTension) * alpha;
    this.currentMode = aiMode;
    this.phase += 0.02 + this.smoothTension * 0.06;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    y: number,
    height: number,
  ): void {
    const tension = this.smoothTension;
    const humanRms = this.smoothHumanRms;
    const aiRms = this.smoothAiRms;
    const mode = this.currentMode;
    const modeColor = MODE_COLORS[mode];

    ctx.save();

    if (tension < 0.3) {
      this.drawLowTension(ctx, centerX, y, height, humanRms, aiRms, modeColor);
    } else if (tension < 0.7) {
      this.drawMediumTension(ctx, centerX, y, height, humanRms, aiRms, modeColor);
    } else {
      this.drawHighTension(ctx, centerX, y, height, humanRms, aiRms, modeColor);
    }

    ctx.restore();
  }

  getHarmonyLevel(): number {
    return 1 - this.smoothTension;
  }

  private drawLowTension(
    ctx: CanvasRenderingContext2D,
    cx: number,
    _y: number,
    h: number,
    humanRms: number,
    aiRms: number,
    modeColor: string,
  ): void {
    const amplitude = (humanRms + aiRms) * h * 0.2;
    const isMirror = this.currentMode === 'mirror';

    // Gentle sine waves — harmony glow
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = HARMONY_COLOR;
    ctx.lineWidth = 2;

    for (let wave = 0; wave < 3; wave++) {
      ctx.beginPath();
      const freq = isMirror ? 3 : 2 + wave * 0.5;
      const waveAmp = amplitude * (1 - wave * 0.25);
      const phaseOffset = isMirror ? 0 : wave * 0.4;

      for (let i = 0; i <= h; i += 2) {
        const t = i / h;
        const x = cx + Math.sin(t * Math.PI * freq + this.phase + phaseOffset) * waveAmp;

        // Mirror mode: draw symmetrical version too
        if (i === 0) ctx.moveTo(x, i);
        else ctx.lineTo(x, i);
      }
      ctx.stroke();

      if (isMirror) {
        ctx.beginPath();
        for (let i = 0; i <= h; i += 2) {
          const t = i / h;
          const x = cx - Math.sin(t * Math.PI * freq + this.phase + phaseOffset) * waveAmp;
          if (i === 0) ctx.moveTo(x, i);
          else ctx.lineTo(x, i);
        }
        ctx.stroke();
      }
    }

    // Mode color accent
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = modeColor;
    ctx.fillRect(cx - amplitude * 2, 0, amplitude * 4, h);

    // Gradient blend human → AI
    const gradient = ctx.createLinearGradient(cx - 60, 0, cx + 60, 0);
    gradient.addColorStop(0, hexToRgba(HUMAN_COLOR, 0.06));
    gradient.addColorStop(0.5, hexToRgba(HARMONY_COLOR, 0.04));
    gradient.addColorStop(1, hexToRgba(AI_COLOR, 0.06));
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 1;
    ctx.fillRect(cx - 60, 0, 120, h);
  }

  private drawMediumTension(
    ctx: CanvasRenderingContext2D,
    cx: number,
    _y: number,
    h: number,
    humanRms: number,
    aiRms: number,
    modeColor: string,
  ): void {
    const amplitude = (humanRms + aiRms) * h * 0.3;
    const isChallenger = this.currentMode === 'challenger';
    const flickerAlpha = 0.2 + Math.sin(this.phase * 3) * 0.1;

    // Angular wave forms
    ctx.globalAlpha = flickerAlpha;
    ctx.strokeStyle = modeColor;
    ctx.lineWidth = isChallenger ? 2.5 : 1.5;

    ctx.beginPath();
    const segments = isChallenger ? 12 : 20;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const yPos = t * h;
      const angle = t * Math.PI * 4 + this.phase;
      const sharpness = isChallenger ? 1.0 : 0.6;
      const wave = Math.sign(Math.sin(angle)) * Math.pow(Math.abs(Math.sin(angle)), sharpness);
      const x = cx + wave * amplitude;

      if (i === 0) ctx.moveTo(x, yPos);
      else ctx.lineTo(x, yPos);
    }
    ctx.stroke();

    // Saturated color bars
    ctx.globalAlpha = 0.05 + this.smoothTension * 0.1;
    const barGradient = ctx.createLinearGradient(cx - 80, 0, cx + 80, 0);
    barGradient.addColorStop(0, HUMAN_COLOR);
    barGradient.addColorStop(0.5, modeColor);
    barGradient.addColorStop(1, AI_COLOR);
    ctx.fillStyle = barGradient;
    ctx.fillRect(cx - 80, 0, 160, h);
  }

  private drawHighTension(
    ctx: CanvasRenderingContext2D,
    cx: number,
    _y: number,
    h: number,
    humanRms: number,
    aiRms: number,
    modeColor: string,
  ): void {
    const amplitude = (humanRms + aiRms) * h * 0.4;
    const isAdversary = this.currentMode === 'adversary';

    // Sharp zigzag patterns
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = TENSION_COLOR;
    ctx.lineWidth = isAdversary ? 3 : 2;

    const zigzagCount = isAdversary ? 24 : 16;
    ctx.beginPath();
    for (let i = 0; i <= zigzagCount; i++) {
      const t = i / zigzagCount;
      const yPos = t * h;
      const dir = i % 2 === 0 ? 1 : -1;
      const jitter = isAdversary ? (Math.random() - 0.5) * 10 : 0;
      const x = cx + dir * amplitude * (0.5 + Math.sin(this.phase + t * 5) * 0.5) + jitter;

      if (i === 0) ctx.moveTo(x, yPos);
      else ctx.lineTo(x, yPos);
    }
    ctx.stroke();

    // Red flash effect
    const flashIntensity = Math.pow(Math.sin(this.phase * 2), 8) * 0.15;
    ctx.globalAlpha = flashIntensity;
    ctx.fillStyle = TENSION_COLOR;
    ctx.fillRect(cx - 100, 0, 200, h);

    // Mode accent — adversary gets extra aggressive glow
    if (isAdversary) {
      ctx.globalAlpha = 0.08 + Math.sin(this.phase * 5) * 0.04;
      ctx.fillStyle = modeColor;
      ctx.fillRect(cx - 120, 0, 240, h);
    } else {
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = modeColor;
      ctx.fillRect(cx - 80, 0, 160, h);
    }

    // Rapid moving particles-like dots
    ctx.fillStyle = TENSION_COLOR;
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 6; i++) {
      const dotY = (this.phase * 40 + i * (h / 6)) % h;
      const dotX = cx + Math.sin(this.phase * 3 + i * 1.2) * amplitude * 0.6;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
