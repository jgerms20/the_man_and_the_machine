export function quantizeToGrid(timestamp: number, tempo: number, gridDivision: number): number {
  if (tempo <= 0) return timestamp;
  const beatDuration = 60000 / tempo;
  const gridSize = beatDuration / gridDivision;
  return Math.round(timestamp / gridSize) * gridSize;
}

export function calculateSwing(onsetTimings: number[], tempo: number): number {
  if (onsetTimings.length < 4 || tempo <= 0) return 0;
  const eighthNote = 30000 / tempo;
  let straightCount = 0;
  let swungCount = 0;

  for (let i = 1; i < onsetTimings.length; i++) {
    const interval = onsetTimings[i] - onsetTimings[i - 1];
    const ratio = interval / eighthNote;
    if (ratio > 0.8 && ratio < 1.2) straightCount++;
    if (ratio > 1.3 && ratio < 1.8) swungCount++;
  }

  const total = straightCount + swungCount;
  if (total === 0) return 0;
  return swungCount / total;
}

export function detectRhythmicPattern(onsetTimings: number[], tempo: number): number[] {
  if (onsetTimings.length < 2 || tempo <= 0) return [];
  const barDuration = (60000 / tempo) * 4;
  const gridSize = barDuration / 16;

  const pattern: number[] = [];
  const firstOnset = onsetTimings[0];

  for (const t of onsetTimings) {
    const relativeTime = (t - firstOnset) % barDuration;
    const gridPos = Math.round(relativeTime / gridSize) % 16;
    if (!pattern.includes(gridPos)) {
      pattern.push(gridPos);
    }
  }

  return pattern.sort((a, b) => a - b);
}
