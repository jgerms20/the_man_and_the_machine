import { useRef, useEffect, useCallback } from 'react';
import type { AudioFeatures } from '../audio/types';
import type { AIDecision, AIModeName } from '../ai/types';
import { CanvasRenderer } from '../visualization/CanvasRenderer';
import { ParticleSystem } from '../visualization/ParticleSystem';
import { InteractionZone } from '../visualization/InteractionZone';

const HUMAN_COLOR = '#D4A574';
const AI_COLOR = '#4A9FD4';
const MODE_COLORS: Record<AIModeName, string> = {
  supportive: '#4CAF50',
  challenger: '#FF9800',
  adversary: '#F44336',
  mirror: '#9C27B0',
  free: '#2196F3',
  drums: '#FF5722',
  assisted: '#00BCD4',
};

export interface VisualizationProps {
  humanFeatures: AudioFeatures | null;
  aiDecision: AIDecision | null;
  aiMode: AIModeName;
  harmonicTension: number;
  energyLevel: number;
  isActive: boolean;
}

/**
 * Generate a synthetic waveform from AI note decisions.
 * Creates a composite sine wave from the note pitches.
 */
function generateAIWaveform(decision: AIDecision | null, length: number): Float32Array {
  const data = new Float32Array(length);
  if (!decision || decision.notes.length === 0) return data;

  const { notes, velocity } = decision;

  for (let i = 0; i < length; i++) {
    const t = i / length;
    let sample = 0;

    for (const note of notes) {
      // Convert MIDI note to frequency: f = 440 * 2^((note-69)/12)
      const freq = 440 * Math.pow(2, (note.pitch - 69) / 12);
      // Normalize frequency for visual representation (cycles across the waveform)
      const visualFreq = freq / 80;
      const phase = t * Math.PI * 2 * visualFreq;

      // Mix harmonics for a richer visual
      sample += Math.sin(phase) * note.velocity * 0.6;
      sample += Math.sin(phase * 2) * note.velocity * 0.25;
      sample += Math.sin(phase * 3) * note.velocity * 0.15;
    }

    // Normalize and apply overall velocity
    data[i] = (sample / Math.max(notes.length, 1)) * velocity;
  }

  return data;
}

export function Visualization({
  humanFeatures,
  aiDecision,
  aiMode,
  harmonicTension,
  energyLevel,
  isActive,
}: VisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const particlesRef = useRef<ParticleSystem | null>(null);
  const zoneRef = useRef<InteractionZone | null>(null);
  const rafRef = useRef<number>(0);
  const prevOnsetRef = useRef(false);
  const prevAiNotesRef = useRef<number>(0);

  // Store latest props in refs for the animation loop
  const propsRef = useRef({
    humanFeatures,
    aiDecision,
    aiMode,
    harmonicTension,
    energyLevel,
    isActive,
  });
  propsRef.current = {
    humanFeatures,
    aiDecision,
    aiMode,
    harmonicTension,
    energyLevel,
    isActive,
  };

  const animate = useCallback(() => {
    const renderer = rendererRef.current;
    const particles = particlesRef.current;
    const zone = zoneRef.current;
    if (!renderer || !particles || !zone) return;

    const {
      humanFeatures: hf,
      aiDecision: ai,
      aiMode: mode,
      harmonicTension: tension,
      energyLevel: energy,
    } = propsRef.current;

    const w = renderer.getWidth();
    const h = renderer.getHeight();

    // Clear with trail effect
    renderer.clear();

    // Background energy glow
    renderer.drawBackground(energy);

    // Human waveform (left side, amber)
    const humanRms = hf?.rms ?? 0;
    if (hf) {
      // Use pitch and spectral centroid to shape the waveform when no raw data
      const syntheticHuman = new Float32Array(256);
      const freq = hf.pitch > 0 ? hf.pitch / 100 : 2;
      const brightness = Math.min(hf.spectralCentroid / 4000, 1);

      for (let i = 0; i < 256; i++) {
        const t = i / 256;
        const phase = t * Math.PI * 2 * freq;
        syntheticHuman[i] =
          Math.sin(phase) * 0.6 +
          Math.sin(phase * 2) * brightness * 0.3 +
          Math.sin(phase * 3 + 0.5) * brightness * 0.1;
      }

      renderer.drawWaveform(syntheticHuman, 'left', HUMAN_COLOR, humanRms);
    }

    // AI waveform (right side, cyan)
    const aiVelocity = ai?.velocity ?? 0;
    const aiWaveform = generateAIWaveform(ai, 256);
    renderer.drawWaveform(aiWaveform, 'right', AI_COLOR, aiVelocity);

    // Update and draw interaction zone
    zone.update(humanRms, aiVelocity, tension, mode);
    renderer.drawInteractionZone(humanRms, aiVelocity, tension);
    zone.draw(renderer.getContext(), w / 2, 0, h);

    // Emit particles on human onset
    if (hf?.onset && !prevOnsetRef.current) {
      const emitX = w * 0.35;
      const emitY = h * 0.3 + Math.random() * h * 0.4;
      particles.emit(emitX, emitY, HUMAN_COLOR, 8 + Math.floor(humanRms * 20), 2 + humanRms * 3);
    }
    prevOnsetRef.current = hf?.onset ?? false;

    // Emit particles on new AI notes
    const aiNoteCount = ai?.notes.length ?? 0;
    if (aiNoteCount > 0 && aiNoteCount !== prevAiNotesRef.current) {
      const emitX = w * 0.65;
      const emitY = h * 0.3 + Math.random() * h * 0.4;
      const modeColor = MODE_COLORS[mode];
      particles.emit(emitX, emitY, AI_COLOR, 6 + Math.floor(aiVelocity * 15), 2 + aiVelocity * 2);
      // Mode-colored accent particles
      particles.emit(emitX, emitY, modeColor, 3, 1.5);
    }
    prevAiNotesRef.current = aiNoteCount;

    // Update and draw particles
    particles.update();
    renderer.drawParticles(particles.getParticles());

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  // Setup renderer, particle system, interaction zone
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    rendererRef.current = new CanvasRenderer(canvas);
    particlesRef.current = new ParticleSystem();
    zoneRef.current = new InteractionZone();

    // ResizeObserver for responsive sizing
    const observer = new ResizeObserver(() => {
      rendererRef.current?.resize();
    });
    const parent = canvas.parentElement;
    if (parent) {
      observer.observe(parent);
    }

    return () => {
      observer.disconnect();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      particlesRef.current?.clear();
      rendererRef.current = null;
      particlesRef.current = null;
      zoneRef.current = null;
    };
  }, []);

  // Start/stop animation loop based on isActive
  useEffect(() => {
    if (isActive && rendererRef.current) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [isActive, animate]);

  return (
    <div className="relative w-full h-full min-h-[300px] bg-[#0A0A0F] overflow-hidden rounded-lg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-gray-600 text-sm tracking-wide uppercase">
            Waiting for session...
          </p>
        </div>
      )}
    </div>
  );
}
