export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const MAX_PARTICLES = 500;

export class ParticleSystem {
  private particles: Particle[] = [];

  emit(
    x: number,
    y: number,
    color: string,
    count: number,
    spread: number,
  ): void {
    const slotsAvailable = MAX_PARTICLES - this.particles.length;
    const toEmit = Math.min(count, slotsAvailable);

    for (let i = 0; i < toEmit; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * spread;
      const maxLife = 40 + Math.random() * 60;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: maxLife,
        maxLife,
        color,
        size: 1 + Math.random() * 3,
      });
    }
  }

  update(): void {
    let writeIndex = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02; // gravity
      p.vx *= 0.99; // drag
      p.life -= 1;

      if (p.life > 0) {
        this.particles[writeIndex] = p;
        writeIndex++;
      }
    }

    this.particles.length = writeIndex;
  }

  getParticles(): Particle[] {
    return this.particles;
  }

  clear(): void {
    this.particles.length = 0;
  }
}
