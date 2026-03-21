export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
export const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export const MODE_PROFILES: Record<string, number[]> = {
  major: MAJOR_PROFILE,
  minor: MINOR_PROFILE,
  dorian: rotateProfile(MINOR_PROFILE, 2),
  mixolydian: rotateProfile(MAJOR_PROFILE, 7),
  phrygian: rotateProfile(MINOR_PROFILE, 4),
  lydian: rotateProfile(MAJOR_PROFILE, 5),
  locrian: rotateProfile(MAJOR_PROFILE, 11),
};

export function rotateProfile(profile: number[], semitones: number): number[] {
  const n = profile.length;
  const s = ((semitones % n) + n) % n;
  return [...profile.slice(s), ...profile.slice(0, s)];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dotProduct / denom;
}

export function detectKey(pitchClassHistogram: number[]): { key: string; mode: string; confidence: number } {
  let bestKey = 'C';
  let bestMode = 'major';
  let bestScore = -1;

  for (const [modeName, profile] of Object.entries(MODE_PROFILES)) {
    for (let root = 0; root < 12; root++) {
      const rotated = rotateProfile(profile, root);
      const score = cosineSimilarity(pitchClassHistogram, rotated);
      if (score > bestScore) {
        bestScore = score;
        bestKey = NOTE_NAMES[root];
        bestMode = modeName;
      }
    }
  }

  return { key: `${bestKey} ${bestMode}`, mode: bestMode, confidence: bestScore };
}
