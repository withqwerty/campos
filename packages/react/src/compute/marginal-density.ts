import { variance as d3Variance } from "d3-array";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComputeMarginalDensityInput = {
  /** 1-D values in the domain (typically 0–100 Campos pitch coordinate). */
  values: readonly number[];
  /** Inclusive domain end-points. @default [0, 100] */
  domain?: [number, number];
  /** Gaussian smoothing bandwidth in domain units, or `"auto"` (Silverman). @default "auto" */
  bandwidth?: number | "auto";
  /** Number of sample points across the domain. @default 128 */
  resolution?: number;
  /** Normalize peak density to 1. @default true */
  normalize?: boolean;
};

export type MarginalDensityModel = {
  /** Sample positions along the domain, ascending, length = resolution. */
  samples: Float64Array;
  /** Density at each sample position, same length as `samples`. */
  density: Float64Array;
  /** Maximum density value in `density` (1 if normalize=true and there were values). */
  maxDensity: number;
  /** Effective Silverman bandwidth used (or the caller-provided value). */
  bandwidth: number;
  /** Number of finite values accepted (out-of-domain values are clamped, not dropped). */
  validCount: number;
  /** `true` when `values` had no finite entries. */
  empty: boolean;
};

// ---------------------------------------------------------------------------
// Silverman bandwidth (1-D)
// ---------------------------------------------------------------------------

function silvermanBandwidth1D(values: number[]): number {
  const n = values.length;
  if (n < 2) return 5;
  const sigma = Math.sqrt(d3Variance(values) ?? 0);
  if (sigma === 0) return 5;
  // 1-D Silverman: h = 1.06 · σ · n^(-1/5)
  return Math.max(0.5, 1.06 * sigma * n ** (-1 / 5));
}

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

/**
 * 1-D Gaussian kernel density estimation used for pitch-edge marginal
 * ridges (defensive-action summary, passing-range heatmaps, shot-x
 * distributions, etc.).
 *
 * Values outside `domain` are ignored. Bandwidth defaults to Silverman's
 * rule, which is forgiving for modest sample sizes (n ≥ ~20) and degrades
 * gracefully for small n.
 */
export function computeMarginalDensity(
  input: ComputeMarginalDensityInput,
): MarginalDensityModel {
  const domain = input.domain ?? [0, 100];
  const [d0, d1] = domain;
  const resolution = Math.max(4, Math.round(input.resolution ?? 128));
  const normalize = input.normalize ?? true;

  const finite = input.values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v >= d0 && v <= d1,
  );

  if (finite.length === 0) {
    return {
      samples: new Float64Array(resolution),
      density: new Float64Array(resolution),
      maxDensity: 0,
      bandwidth: 0,
      validCount: 0,
      empty: true,
    };
  }

  let bandwidth: number;
  if (input.bandwidth === "auto" || input.bandwidth == null) {
    bandwidth = silvermanBandwidth1D(finite);
  } else if (!Number.isFinite(input.bandwidth) || input.bandwidth <= 0) {
    bandwidth = silvermanBandwidth1D(finite);
  } else {
    bandwidth = input.bandwidth;
  }

  const samples = new Float64Array(resolution);
  const density = new Float64Array(resolution);
  const step = (d1 - d0) / (resolution - 1);
  const invH2 = 1 / (2 * bandwidth * bandwidth);
  const cutoff = 3 * bandwidth;

  for (let i = 0; i < resolution; i += 1) {
    samples[i] = d0 + i * step;
  }

  for (const v of finite) {
    const iMin = Math.max(0, Math.floor((v - cutoff - d0) / step));
    const iMax = Math.min(resolution - 1, Math.ceil((v + cutoff - d0) / step));
    for (let i = iMin; i <= iMax; i += 1) {
      const sample = samples[i]!;
      const dv = sample - v;
      density[i] = (density[i] ?? 0) + Math.exp(-dv * dv * invH2);
    }
  }

  let maxDensity = 0;
  for (let i = 0; i < resolution; i += 1) {
    const d = density[i] ?? 0;
    if (d > maxDensity) maxDensity = d;
  }

  if (normalize && maxDensity > 0) {
    for (let i = 0; i < resolution; i += 1) {
      density[i] = (density[i] ?? 0) / maxDensity;
    }
    maxDensity = 1;
  }

  return {
    samples,
    density,
    maxDensity,
    bandwidth: Math.round(bandwidth * 100) / 100,
    validCount: finite.length,
    empty: false,
  };
}
