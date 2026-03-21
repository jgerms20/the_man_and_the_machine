export interface Particle {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  private width = 0;
  private height = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to get 2d rendering context');
    }
    this.ctx = ctx;
    this.dpr = window.devicePixelRatio || 1;
    this.resize();
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = Math.floor(rect.width * this.dpr);
    this.canvas.height = Math.floor(rect.height * this.dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  clear(): void {
    this.ctx.fillStyle = 'rgba(10, 10, 15, 0.15)';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawBackground(energyLevel: number): void {
    const brightness = Math.floor(10 + energyLevel * 12);
    const r = brightness;
    const g = brightness;
    const b = Math.floor(brightness * 1.2);

    this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.08)`;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Subtle radial vignette
    if (energyLevel > 0.3) {
      const gradient = this.ctx.createRadialGradient(
        this.width / 2, this.height / 2, this.height * 0.1,
        this.width / 2, this.height / 2, this.width * 0.7,
      );
      const alpha = energyLevel * 0.03;
      gradient.addColorStop(0, `rgba(30, 25, 40, ${alpha})`);
      gradient.addColorStop(1, 'rgba(10, 10, 15, 0)');
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  drawWaveform(
    data: Float32Array,
    side: 'left' | 'right',
    color: string,
    amplitude: number,
  ): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const centerY = h / 2;

    const zoneWidth = w * 0.4;
    const startX = side === 'left' ? 0 : w * 0.6;

    const step = Math.max(1, Math.floor(data.length / (zoneWidth * 0.8)));
    const points: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < data.length; i += step) {
      const t = i / data.length;
      const x = startX + t * zoneWidth;
      const y = centerY + data[i] * amplitude * h * 0.35;
      points.push({ x, y });
    }

    if (points.length < 2) return;

    // Draw glow layer
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.filter = 'blur(4px)';
    this.drawSmoothCurve(points);
    ctx.restore();

    // Draw main line
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.9;
    this.drawSmoothCurve(points);
    ctx.restore();

    // Draw thin bright core
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = amplitude * 0.4;
    this.drawSmoothCurve(points);
    ctx.restore();
  }

  private drawSmoothCurve(points: Array<{ x: number; y: number }>): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      const cpx1 = prev.x + (curr.x - prev.x) * 0.5;
      const cpy1 = prev.y + (curr.y - prev.y) * 0.5;
      const cpx2 = curr.x - (next.x - prev.x) * 0.15;
      const cpy2 = curr.y - (next.y - prev.y) * 0.15;

      ctx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, curr.x, curr.y);
    }

    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  drawInteractionZone(
    humanRms: number,
    aiRms: number,
    tension: number,
  ): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const zoneLeft = w * 0.4;
    const zoneRight = w * 0.6;
    const zoneWidth = zoneRight - zoneLeft;
    const centerX = w / 2;
    const centerY = h / 2;

    ctx.save();

    if (tension < 0.3) {
      // Low tension — smooth blending gradient
      const gradient = ctx.createLinearGradient(zoneLeft, 0, zoneRight, 0);
      const humanAlpha = 0.1 + humanRms * 0.3;
      const aiAlpha = 0.1 + aiRms * 0.3;
      gradient.addColorStop(0, `rgba(212, 165, 116, ${humanAlpha})`);
      gradient.addColorStop(0.5, `rgba(232, 213, 183, ${(humanAlpha + aiAlpha) / 2})`);
      gradient.addColorStop(1, `rgba(74, 159, 212, ${aiAlpha})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(zoneLeft, 0, zoneWidth, h);
    } else if (tension < 0.7) {
      // Medium tension — more saturated, animated feel
      const gradient = ctx.createLinearGradient(zoneLeft, 0, zoneRight, 0);
      const intensity = 0.15 + tension * 0.4;
      gradient.addColorStop(0, `rgba(212, 165, 116, ${intensity})`);
      gradient.addColorStop(0.35, `rgba(255, 152, 0, ${intensity * 0.6})`);
      gradient.addColorStop(0.65, `rgba(255, 152, 0, ${intensity * 0.6})`);
      gradient.addColorStop(1, `rgba(74, 159, 212, ${intensity})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(zoneLeft, 0, zoneWidth, h);
    } else {
      // High tension — sharp reds
      const gradient = ctx.createLinearGradient(zoneLeft, 0, zoneRight, 0);
      const intensity = 0.2 + tension * 0.5;
      gradient.addColorStop(0, `rgba(212, 165, 116, ${intensity})`);
      gradient.addColorStop(0.3, `rgba(255, 68, 68, ${intensity * 0.8})`);
      gradient.addColorStop(0.7, `rgba(255, 68, 68, ${intensity * 0.8})`);
      gradient.addColorStop(1, `rgba(74, 159, 212, ${intensity})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(zoneLeft, 0, zoneWidth, h);

      // Draw angular shapes for high tension
      const time = performance.now() * 0.003;
      ctx.strokeStyle = `rgba(255, 68, 68, ${tension * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + time;
        const radius = (humanRms + aiRms) * h * 0.15 + Math.sin(time * 2 + i) * 10;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  drawParticles(particles: Particle[]): void {
    const ctx = this.ctx;
    ctx.save();

    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }
}
