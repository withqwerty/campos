import { max as d3Max, variance as d3Variance } from "d3-array";

import { hexToRgb, interpolateStops, type ColorStop } from "./color.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KDEEvent = {
  /** Pitch x-coordinate (0–100). `null` is accepted at runtime — events with
   *  null/undefined/non-finite coords are filtered out before density computation. */
  x: number | null;
  /** Pitch y-coordinate (0–100). Same null acceptance as `x`. */
  y: number | null;
  [key: string]: unknown;
};

export type KDEModel = {
  meta: {
    component: "KDE";
    empty: boolean;
    attackingDirection: "up" | "down" | "left" | "right";
    crop: "full" | "half";
    warnings: string[];
    totalEvents: number;
    validEvents: number;
    bandwidthX: number;
    bandwidthY: number;
  };
  density: {
    /** Flat row-major density grid, length = gridWidth × gridHeight. */
    grid: Float64Array;
    /** Number of columns in the density grid. */
    gridWidth: number;
    /** Number of rows in the density grid. */
    gridHeight: number;
    /** Maximum density value in the grid. */
    maxDensity: number;
    /** Threshold below which density is treated as transparent (0-1 normalized). */
    threshold: number;
  };
  scaleBar: {
    label: string;
    domain: [number, number];
  } | null;
  pitch: {
    crop: "full" | "half";
    attackingDirection: "up" | "down" | "left" | "right";
  };
  emptyState: {
    message: string;
  } | null;
};

export type ComputeKDEInput = {
  events: readonly KDEEvent[];
  /** Smoothing bandwidth in pitch-coordinate units, or "auto" for Silverman's rule. @default "auto" */
  bandwidth?: "auto" | number;
  /** Grid resolution (cells per 100 coordinate units). @default 100 */
  resolution?: number;
  /** Normalize density to 0-1. @default true */
  normalize?: boolean;
  /** Threshold below which density is transparent (0-1 of max). @default 0.05 */
  threshold?: number;
  /** Pitch orientation. @default "horizontal" */
  attackingDirection?: "up" | "down" | "left" | "right";
  /** Pitch crop. @default "full" */
  crop?: "full" | "half";
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

type ValidatedKDEEvent = KDEEvent & { x: number; y: number };

function isValidEvent(event: KDEEvent): event is ValidatedKDEEvent {
  const { x, y } = event;
  return (
    x != null &&
    y != null &&
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 0 &&
    x <= 100 &&
    y >= 0 &&
    y <= 100
  );
}

// ---------------------------------------------------------------------------
// Bandwidth selection (Silverman's rule for 2D)
// ---------------------------------------------------------------------------

function silvermanBandwidth(values: number[]): number {
  const n = values.length;
  if (n < 2) return 5; // fallback
  const sigma = Math.sqrt(d3Variance(values) ?? 0);
  // Silverman's rule: h = σ * n^(-1/6) for 2D
  return Math.max(1, sigma * n ** (-1 / 6));
}

// ---------------------------------------------------------------------------
// Pitch aspect ratio
// ---------------------------------------------------------------------------

const PITCH_ASPECT = 105 / 68; // ≈ 1.544

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

/**
 * Compute a renderer-neutral semantic model for a Campos KDE density map.
 *
 * Performs 2D Gaussian kernel density estimation over the 0-100 Campos
 * coordinate space with spatial cutoff optimization. Returns a flat
 * density grid that the renderer maps to a canvas image.
 */
export function computeKDE(input: ComputeKDEInput): KDEModel {
  const attackingDirection = input.attackingDirection ?? "right";
  const crop = input.crop ?? "full";
  const normalize = input.normalize ?? true;

  // Validate threshold: must be in [0, 1). Out-of-range values silently
  // produce a fully-coloured-or-fully-transparent surface with no diagnostic.
  const requestedThreshold = input.threshold ?? 0.05;
  const validEvents = input.events.filter(isValidEvent);
  const warnings: string[] = [];

  let threshold = requestedThreshold;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold >= 1) {
    warnings.push(
      `threshold must be in [0, 1); got ${String(requestedThreshold)}; using default 0.05`,
    );
    threshold = 0.05;
  }

  // Validate resolution: must be a finite integer >= 4. Zero/negative would
  // produce an empty grid with no warning; non-integer would produce off-by-
  // one cell counts in the raster.
  const requestedResolution = input.resolution ?? 100;
  let resolution = requestedResolution;
  if (!Number.isFinite(resolution) || resolution < 4) {
    warnings.push(
      `resolution must be a finite integer >= 4; got ${String(requestedResolution)}; using default 100`,
    );
    resolution = 100;
  } else {
    resolution = Math.round(resolution);
  }

  if (validEvents.length === 0) {
    return {
      meta: {
        component: "KDE",
        empty: true,
        attackingDirection,
        crop,
        warnings: [],
        totalEvents: input.events.length,
        validEvents: 0,
        bandwidthX: 0,
        bandwidthY: 0,
      },
      density: {
        grid: new Float64Array(0),
        gridWidth: 0,
        gridHeight: 0,
        maxDensity: 0,
        threshold,
      },
      scaleBar: null,
      pitch: { crop, attackingDirection },
      emptyState: { message: "No event data" },
    };
  }

  if (validEvents.length < 3) {
    warnings.push(
      `Only ${validEvents.length} valid event(s) — KDE smoothing may not be meaningful.`,
    );
  }

  const excluded = input.events.length - validEvents.length;
  if (excluded > 0) {
    warnings.push(`${excluded} event(s) excluded due to missing or invalid coordinates.`);
  }

  // Compute bandwidth
  const xs = validEvents.map((e) => e.x);
  const ys = validEvents.map((e) => e.y);

  let bandwidthX: number;
  let bandwidthY: number;
  if (input.bandwidth === "auto" || input.bandwidth == null) {
    bandwidthX = silvermanBandwidth(xs);
    bandwidthY = silvermanBandwidth(ys);
  } else if (!Number.isFinite(input.bandwidth) || input.bandwidth <= 0) {
    // bandwidth=0 produces NaN-poisoned grid (1/0 = Infinity in invHx2);
    // negative produces silent absolute-value behaviour. Both should fall
    // back to Silverman with a warning so the user knows their value was
    // ignored.
    warnings.push(
      `bandwidth must be a positive finite number; got ${String(input.bandwidth)}; using Silverman's rule`,
    );
    bandwidthX = silvermanBandwidth(xs);
    bandwidthY = silvermanBandwidth(ys);
  } else {
    bandwidthX = input.bandwidth;
    bandwidthY = input.bandwidth;
  }

  // Grid dimensions based on resolution and pitch aspect ratio
  const gridWidth = resolution;
  const gridHeight = Math.round(resolution / PITCH_ASPECT);
  const cellW = 100 / gridWidth;
  const cellH = 100 / gridHeight;

  // Spatial cutoff: only evaluate kernels within 3σ
  const cutoffX = 3 * bandwidthX;
  const cutoffY = 3 * bandwidthY;
  const invHx2 = 1 / (2 * bandwidthX * bandwidthX);
  const invHy2 = 1 / (2 * bandwidthY * bandwidthY);

  // Compute density grid
  const grid = new Float64Array(gridWidth * gridHeight);

  for (const event of validEvents) {
    // Grid cell range affected by this event
    const colMin = Math.max(0, Math.floor((event.x - cutoffX) / cellW));
    const colMax = Math.min(gridWidth - 1, Math.ceil((event.x + cutoffX) / cellW));
    const rowMin = Math.max(0, Math.floor((event.y - cutoffY) / cellH));
    const rowMax = Math.min(gridHeight - 1, Math.ceil((event.y + cutoffY) / cellH));

    for (let row = rowMin; row <= rowMax; row++) {
      const gy = (row + 0.5) * cellH; // grid cell center
      const dy2 = (gy - event.y) ** 2 * invHy2;
      for (let col = colMin; col <= colMax; col++) {
        const gx = (col + 0.5) * cellW; // grid cell center
        const dx2 = (gx - event.x) ** 2 * invHx2;
        const idx = row * gridWidth + col;
        grid[idx] = (grid[idx] ?? 0) + Math.exp(-(dx2 + dy2));
      }
    }
  }

  let maxDensity = d3Max(grid) ?? 0;

  // Normalize to 0-1 if requested
  if (normalize && maxDensity > 0) {
    for (let i = 0; i < grid.length; i++) {
      grid[i] = (grid[i] ?? 0) / maxDensity;
    }
    maxDensity = 1;
  }

  // Check for over-smoothing (near-flat result)
  if (maxDensity > 0) {
    let minNonZero = maxDensity;
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i] ?? 0;
      if (v > 0 && v < minNonZero) minNonZero = v;
    }
    const contrast = maxDensity > 0 ? minNonZero / maxDensity : 0;
    if (contrast > 0.5) {
      warnings.push(
        "Density field is nearly uniform — bandwidth may be too large for this dataset.",
      );
    }
  }

  return {
    meta: {
      component: "KDE",
      empty: false,
      attackingDirection,
      crop,
      warnings,
      totalEvents: input.events.length,
      validEvents: validEvents.length,
      bandwidthX: Math.round(bandwidthX * 100) / 100,
      bandwidthY: Math.round(bandwidthY * 100) / 100,
    },
    density: {
      grid,
      gridWidth,
      gridHeight,
      maxDensity,
      threshold,
    },
    scaleBar: {
      // When normalize=false the domain is the summed Gaussian kernel value
      // at the peak grid cell — not an event count. Labelling it "Events"
      // would imply false precision. Use "Kernel sum" to be honest about
      // what the axis actually represents.
      label: normalize ? "Density" : "Kernel sum",
      domain: [0, normalize ? 1 : maxDensity],
    },
    pitch: { crop, attackingDirection },
    emptyState: null,
  };
}

/**
 * Render a KDE density grid to RGBA pixel data for canvas rendering.
 *
 * Returns a Uint8ClampedArray of length gridWidth × gridHeight × 4 (RGBA).
 * Values below the threshold are fully transparent.
 */
export function kdeGridToRGBA(
  model: KDEModel,
  colorStops: readonly ColorStop[],
  opacityScale = 1,
): Uint8ClampedArray {
  const { grid, gridWidth, gridHeight, maxDensity, threshold } = model.density;
  const pixels = new Uint8ClampedArray(gridWidth * gridHeight * 4);

  if (maxDensity === 0) return pixels;

  for (let i = 0; i < grid.length; i++) {
    const normalizedVal = maxDensity > 0 ? (grid[i] ?? 0) / maxDensity : 0;

    if (normalizedVal < threshold) {
      // Transparent
      continue;
    }

    // Map threshold..1 to 0..1 for color lookup
    const colorT = (normalizedVal - threshold) / (1 - threshold);
    const hex = interpolateStops(colorStops, Math.min(1, Math.max(0, colorT)));

    const [r, g, b] = hexToRgb(hex);

    // Opacity ramp: low density is semi-transparent, high density is opaque
    const alpha = Math.round((0.3 + 0.7 * colorT) * 255);

    const offset = i * 4;
    pixels[offset] = r;
    pixels[offset + 1] = g;
    pixels[offset + 2] = b;
    pixels[offset + 3] = Math.round(alpha * Math.min(1, Math.max(0, opacityScale)));
  }

  return pixels;
}
