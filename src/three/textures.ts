import * as THREE from 'three';

/** Physical size one texture tile covers, in metres: across the grain × along the grain. */
export const WOOD_TILE = { across: 0.6, along: 1.2 };

interface GrainStyle {
  seed: number;
  /** Growth rings per tile. */
  rings: number;
  /** Strength of the dark latewood lines (0–1). */
  contrast: number;
  /** Fine fibre noise strength. */
  fibre: number;
}

const STYLES: Record<string, GrainStyle> = {
  oak: { seed: 11, rings: 22, contrast: 0.22, fibre: 0.08 },
  walnut: { seed: 23, rings: 16, contrast: 0.32, fibre: 0.07 },
  pine: { seed: 37, rings: 12, contrast: 0.3, fibre: 0.05 },
  ash: { seed: 41, rings: 26, contrast: 0.2, fibre: 0.09 },
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const cache = new Map<string, { map: THREE.CanvasTexture; bump: THREE.CanvasTexture }>();

/**
 * Procedural, seamlessly tileable wood grain. The colour map is near-white greyscale so the
 * material colour acts as the stain/tint. Grain runs along the texture's V axis.
 */
export function woodTextures(materialId: string, anisotropy: number) {
  const hit = cache.get(materialId);
  if (hit) return hit;
  const style = STYLES[materialId] ?? STYLES.oak;
  const size = 512;
  const rand = rng(style.seed);
  const TAU = Math.PI * 2;

  // Per-column fibre noise (periodic in x by construction) and smooth phase offsets.
  const fibre = new Float32Array(size).map(() => rand() * 2 - 1);
  const phases = Array.from({ length: 4 }, () => rand() * TAU);

  const colour = document.createElement('canvas');
  colour.width = colour.height = size;
  const bump = document.createElement('canvas');
  bump.width = bump.height = size;
  const cImg = colour.getContext('2d')!.createImageData(size, size);
  const bImg = bump.getContext('2d')!.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const fy = y / size;
    for (let x = 0; x < size; x++) {
      const fx = x / size;
      // Wavy distortion of the rings, periodic in both axes so the tile repeats seamlessly.
      // Kept well below the ring spacing (1 / rings) so lines meander instead of zig-zagging.
      const warp =
        0.009 * Math.sin(TAU * (fy + fx) + phases[0]) +
        0.004 * Math.sin(TAU * (fy * 3 - fx * 2) + phases[1]) +
        0.003 * Math.sin(TAU * (fx * 5) + phases[2]);
      // Integer-frequency terms vary the ring spacing irregularly while staying tileable.
      const ring =
        (fx + warp) * style.rings + 0.9 * Math.sin(TAU * fx * 3 + phases[1]) + 0.45 * Math.sin(TAU * fx * 7 + phases[2]);
      const t = ring - Math.floor(ring);
      // Dark latewood band near the end of each ring.
      const late = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 5);
      const broad = 0.5 + 0.5 * Math.sin(TAU * fx * 3 + phases[3]);
      let v = 0.96 - style.contrast * late - 0.06 * broad + style.fibre * fibre[x] * 0.6;
      v += (rand() - 0.5) * 0.025;
      v = Math.min(1, Math.max(0, v));
      const i = (y * size + x) * 4;
      const c = Math.round(v * 255);
      cImg.data[i] = cImg.data[i + 1] = cImg.data[i + 2] = c;
      cImg.data[i + 3] = 255;
      const b = Math.round((1 - late * 0.8 + fibre[x] * 0.1) * 200);
      bImg.data[i] = bImg.data[i + 1] = bImg.data[i + 2] = b;
      bImg.data[i + 3] = 255;
    }
  }
  colour.getContext('2d')!.putImageData(cImg, 0, 0);
  bump.getContext('2d')!.putImageData(bImg, 0, 0);

  const make = (canvas: HTMLCanvasElement, srgb: boolean) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = anisotropy;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const result = { map: make(colour, true), bump: make(bump, false) };
  cache.set(materialId, result);
  return result;
}
