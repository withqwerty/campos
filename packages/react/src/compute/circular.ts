/**
 * Circular statistics helpers for direction-valued data (e.g. pass vectors).
 *
 * Arithmetic mean of angles is wrong at the ±180° seam. The correct mean
 * is computed by summing the unit-vector components and taking atan2.
 *
 * Reference: Berens, P. (2009). CircStat: A MATLAB Toolbox for Circular
 * Statistics. J. Stat. Software 31(10).
 */

/** Threshold below which we treat the resultant vector as zero (numerical epsilon). */
const ZERO_RESULTANT = 1e-9;

export type CircularInput = { dx: number; dy: number };

export type CircularMeanResult = {
  /**
   * Mean angle in radians, in the range (-π, π]. `null` when the resultant
   * vector length is effectively zero (all-opposing vectors or empty input).
   */
  meanAngle: number | null;
  /**
   * Mean resultant length `R ∈ [0, 1]`. `0` means maximal dispersion (or
   * empty input); `1` means perfect agreement.
   */
  resultantLength: number;
  /** Number of input vectors that contributed (excludes zero-magnitude). */
  count: number;
};

/**
 * Circular mean of direction vectors. Each vector is normalized to a unit
 * vector before averaging, so magnitudes never bias the mean. Zero-magnitude
 * vectors are excluded (they carry no direction).
 */
export function circularMean(vectors: readonly CircularInput[]): CircularMeanResult {
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const v of vectors) {
    const mag = Math.hypot(v.dx, v.dy);
    if (mag === 0 || !Number.isFinite(mag)) continue;
    sumX += v.dx / mag;
    sumY += v.dy / mag;
    count += 1;
  }

  if (count === 0) {
    return { meanAngle: null, resultantLength: 0, count: 0 };
  }

  const resultantLength = Math.hypot(sumX, sumY) / count;

  if (resultantLength < ZERO_RESULTANT) {
    return { meanAngle: null, resultantLength: 0, count };
  }

  return {
    meanAngle: Math.atan2(sumY, sumX),
    resultantLength,
    count,
  };
}
