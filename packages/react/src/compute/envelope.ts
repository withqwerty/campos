/**
 * Envelope compute for LineChart.
 *
 * Three kinds:
 * - `series-pair`       — between two named series (including hidden ones).
 * - `center-offset`     — centre series ± per-point upper/lower offsets.
 * - `series-to-reference` — between a series and a declared reference line
 *                             (horizontal or diagonal; vertical is rejected).
 *
 * Implementation strategy:
 * 1. Resolve both bounds as arrays of `{ x, y }` in data-space.
 * 2. Compute overlap interval.
 * 3. Build merged x-grid (sorted union of all x's in overlap).
 * 4. Linearly interpolate both bounds at every merged x.
 * 5. Walk adjacent merged-grid pairs; for each pair detect sign change
 *    (when `fillPositive` !== `fillNegative`) and split into two trapezoids
 *    at the crossover.
 * 6. Emit one or more polygon paths keyed by colour.
 */

/**
 * Shared envelope knobs. `clip` defaults to `true` — renderers clip the fill
 * to the plot area so a wide confidence band doesn't bleed past axes. Opt out
 * per-envelope when the overflow itself is the point (e.g. a ribbon that
 * visually extends beyond the plotted domain).
 */
type EnvelopeBase = {
  id?: string;
  fillPositive?: string;
  fillNegative?: string;
  fill?: string;
  opacity?: number;
  show?: boolean;
  clip?: boolean;
};

export type LineChartEnvelope =
  | (EnvelopeBase & {
      kind: "series-pair";
      seriesAId: string;
      seriesBId: string;
    })
  | (EnvelopeBase & {
      kind: "center-offset";
      centerSeriesId: string;
      /** Index-aligned to the resolved centre series' points. */
      bounds: readonly { x: number; upper: number; lower: number }[];
    })
  | (EnvelopeBase & {
      kind: "series-to-reference";
      seriesId: string;
      referenceId: string;
    });

export type EnvelopeSourceSeries = {
  id: string;
  points: readonly { x: number; y: number }[];
};

/**
 * Data-space reference geometry (not SVG — we evaluate y(x) in data space
 * and let the LineChart compute project to pixels later). Vertical references
 * are explicitly rejected, so the union only carries horizontal + diagonal.
 */
export type EnvelopeReferenceGeometry =
  | { id: string; kind: "horizontal"; y: number }
  | {
      id: string;
      kind: "diagonal";
      from: readonly [number, number];
      to: readonly [number, number];
    }
  | { id: string; kind: "vertical" };

export type EnvelopeDataPath = {
  /** Resolved fill colour for this sub-path. */
  fill: string;
  /** Signed sign: `+1` when A(x) >= B(x) along this segment, `-1` otherwise. */
  sign: 1 | -1;
  /**
   * Polygon points in data space, in walk order. The LineChart renderer
   * projects to pixels.
   */
  points: readonly { x: number; y: number }[];
};

export type LineChartEnvelopeModel = {
  id: string | null;
  kind: LineChartEnvelope["kind"];
  paths: readonly EnvelopeDataPath[];
  /** Resolved opacity (input or default). */
  opacity: number;
  /** Flattened for test assertions: true when at least one crossover split. */
  hasCrossovers: boolean;
  /**
   * Whether the renderer should clip this envelope's fill to the plot area.
   * Defaults to `true` so wide confidence bands don't spill past the axes;
   * set `clip: false` on the input when overflow is deliberate.
   */
  clip: boolean;
};

type ResolvedBound = readonly { x: number; y: number }[];

type ResolveResult =
  | { ok: true; boundA: ResolvedBound; boundB: ResolvedBound }
  | { ok: false; warning: string };

/** Public compute entry — returns envelope models + warnings. */
export function computeEnvelopes(input: {
  envelopes: readonly LineChartEnvelope[];
  workingSeries: readonly EnvelopeSourceSeries[];
  references: readonly EnvelopeReferenceGeometry[];
  /** Default envelope fill when neither input nor fallback specifies one. */
  defaultFill: string;
}): { models: LineChartEnvelopeModel[]; warnings: string[] } {
  const warnings: string[] = [];
  const models: LineChartEnvelopeModel[] = [];
  const seriesById = new Map(input.workingSeries.map((s) => [s.id, s]));
  const refsById = new Map(input.references.map((r) => [r.id, r]));

  for (const env of input.envelopes) {
    if (env.show === false) continue;
    const idLabel = env.id ?? `#${models.length}`;

    const resolved = resolveBounds(env, seriesById, refsById, idLabel);
    if (!resolved.ok) {
      warnings.push(resolved.warning);
      continue;
    }

    const built = buildEnvelopePaths({
      boundA: resolved.boundA,
      boundB: resolved.boundB,
      fillPositive: env.fillPositive ?? env.fill ?? input.defaultFill,
      fillNegative: env.fillNegative ?? env.fill ?? input.defaultFill,
      idLabel,
    });
    if (!built.ok) {
      warnings.push(built.warning);
      continue;
    }

    // Majority-inversion check for center-offset.
    if (env.kind === "center-offset") {
      const invertedAtPoints = env.bounds.reduce(
        (acc, b) => (b.upper < b.lower ? acc + 1 : acc),
        0,
      );
      if (invertedAtPoints > env.bounds.length / 2) {
        warnings.push(
          `[envelope.inverted-bounds] envelope "${idLabel}": upper < lower at ${invertedAtPoints} of ${env.bounds.length} points (colour-flip may be unintentional)`,
        );
      }
    }

    models.push({
      id: env.id ?? null,
      kind: env.kind,
      paths: built.paths,
      opacity: env.opacity ?? 0.2,
      hasCrossovers: built.hasCrossovers,
      clip: env.clip ?? true,
    });
  }

  return { models, warnings };
}

function resolveBounds(
  env: LineChartEnvelope,
  seriesById: Map<string, EnvelopeSourceSeries>,
  refsById: Map<string, EnvelopeReferenceGeometry>,
  idLabel: string,
): ResolveResult {
  if (env.kind === "series-pair") {
    const a = seriesById.get(env.seriesAId);
    const b = seriesById.get(env.seriesBId);
    if (!a) {
      return {
        ok: false,
        warning: `[envelope.unknown-series] envelope "${idLabel}": unknown series "${env.seriesAId}"`,
      };
    }
    if (!b) {
      return {
        ok: false,
        warning: `[envelope.unknown-series] envelope "${idLabel}": unknown series "${env.seriesBId}"`,
      };
    }
    if (a.points.length < 2 || b.points.length < 2) {
      return {
        ok: false,
        warning: `[envelope.insufficient-points] envelope "${idLabel}": <2 valid points after gap-validation`,
      };
    }
    return { ok: true, boundA: a.points, boundB: b.points };
  }

  if (env.kind === "center-offset") {
    const centre = seriesById.get(env.centerSeriesId);
    if (!centre) {
      return {
        ok: false,
        warning: `[envelope.unknown-series] envelope "${idLabel}": unknown series "${env.centerSeriesId}"`,
      };
    }
    if (centre.points.length < 2) {
      return {
        ok: false,
        warning: `[envelope.insufficient-points] envelope "${idLabel}": <2 valid points after gap-validation`,
      };
    }
    if (env.bounds.length !== centre.points.length) {
      return {
        ok: false,
        warning: `[envelope.bounds-mismatch] envelope "${idLabel}": bounds.length (${env.bounds.length}) does not match centre series points (${centre.points.length})`,
      };
    }
    const boundA = env.bounds.map((b) => ({ x: b.x, y: b.upper }));
    const boundB = env.bounds.map((b) => ({ x: b.x, y: b.lower }));
    return { ok: true, boundA, boundB };
  }

  // series-to-reference
  const ser = seriesById.get(env.seriesId);
  if (!ser) {
    return {
      ok: false,
      warning: `[envelope.unknown-series] envelope "${idLabel}": unknown series "${env.seriesId}"`,
    };
  }
  if (ser.points.length < 2) {
    return {
      ok: false,
      warning: `[envelope.insufficient-points] envelope "${idLabel}": <2 valid points after gap-validation`,
    };
  }
  const ref = refsById.get(env.referenceId);
  if (!ref) {
    return {
      ok: false,
      warning: `[envelope.unknown-reference] envelope "${idLabel}": unknown reference "${env.referenceId}"`,
    };
  }
  if (ref.kind === "vertical") {
    return {
      ok: false,
      warning: `[envelope.vertical-reference] envelope "${idLabel}": cannot use vertical reference "${env.referenceId}" as bound (no y-function of x)`,
    };
  }
  // Clip series x-support to the reference's declared support.
  // - Horizontal references: full x-axis (no restriction).
  // - Diagonal references: only the `from.x..to.x` range — extrapolation past
  //   the declared segment is a spec non-goal.
  let support: [number, number] | null = null;
  if (ref.kind === "diagonal") {
    const rxMin = Math.min(ref.from[0], ref.to[0]);
    const rxMax = Math.max(ref.from[0], ref.to[0]);
    support = [rxMin, rxMax];
  }
  const sup = support;
  const boundA = sup
    ? ser.points.filter((p) => p.x >= sup[0] && p.x <= sup[1])
    : ser.points;
  if (boundA.length < 2) {
    return {
      ok: false,
      warning: `[envelope.no-overlap] envelope "${idLabel}": overlap interval empty (series x-range outside reference support)`,
    };
  }
  const boundB = boundA.map((p) => ({ x: p.x, y: evalRefAt(ref, p.x) }));
  return { ok: true, boundA, boundB };
}

function evalRefAt(
  ref: Exclude<EnvelopeReferenceGeometry, { kind: "vertical" }>,
  x: number,
): number {
  if (ref.kind === "horizontal") return ref.y;
  // diagonal: linear between from and to
  const [x0, y0] = ref.from;
  const [x1, y1] = ref.to;
  const dx = x1 - x0;
  if (dx === 0) return y0;
  const t = (x - x0) / dx;
  return y0 + t * (y1 - y0);
}

function buildEnvelopePaths({
  boundA,
  boundB,
  fillPositive,
  fillNegative,
  idLabel,
}: {
  boundA: ResolvedBound;
  boundB: ResolvedBound;
  fillPositive: string;
  fillNegative: string;
  idLabel: string;
}):
  | { ok: true; paths: EnvelopeDataPath[]; hasCrossovers: boolean }
  | { ok: false; warning: string } {
  // Require both bounds sorted ascending; the compute pipeline sorts series,
  // but center-offset bounds arrive in input order. Defensive re-sort.
  const a = [...boundA].sort((p, q) => p.x - q.x);
  const b = [...boundB].sort((p, q) => p.x - q.x);

  const aMin = a[0]!.x;
  const aMax = a[a.length - 1]!.x;
  const bMin = b[0]!.x;
  const bMax = b[b.length - 1]!.x;
  const lo = Math.max(aMin, bMin);
  const hi = Math.min(aMax, bMax);

  if (hi <= lo) {
    return {
      ok: false,
      warning: `[envelope.no-overlap] envelope "${idLabel}": overlap interval empty (A [${aMin},${aMax}], B [${bMin},${bMax}])`,
    };
  }

  const xs = new Set<number>();
  for (const p of a) if (p.x >= lo && p.x <= hi) xs.add(p.x);
  for (const p of b) if (p.x >= lo && p.x <= hi) xs.add(p.x);
  xs.add(lo);
  xs.add(hi);
  const grid = [...xs].sort((p, q) => p - q);

  if (grid.length < 2) {
    return {
      ok: false,
      warning: `[envelope.insufficient-points] envelope "${idLabel}": <2 valid points after gap-validation`,
    };
  }

  // Interpolate each bound at every grid x.
  const aAtGrid = grid.map((x) => ({ x, y: interpolateAt(a, x) }));
  const bAtGrid = grid.map((x) => ({ x, y: interpolateAt(b, x) }));

  // Walk pairs; if fillPositive === fillNegative, we can emit a single closed
  // polygon A→B in one go. Otherwise split at crossovers.
  const sameColour = fillPositive === fillNegative;
  if (sameColour) {
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < grid.length; i++) points.push(aAtGrid[i]!);
    for (let i = grid.length - 1; i >= 0; i--) points.push(bAtGrid[i]!);
    return {
      ok: true,
      paths: [{ fill: fillPositive, sign: 1, points }],
      hasCrossovers: false,
    };
  }

  // Two-colour path: emit one trapezoid per adjacent grid pair, split at crossover.
  const paths: EnvelopeDataPath[] = [];
  let hasCrossovers = false;
  for (let i = 0; i < grid.length - 1; i++) {
    const ax0 = aAtGrid[i]!;
    const ax1 = aAtGrid[i + 1]!;
    const bx0 = bAtGrid[i]!;
    const bx1 = bAtGrid[i + 1]!;
    const d0 = ax0.y - bx0.y;
    const d1 = ax1.y - bx1.y;

    if ((d0 >= 0 && d1 >= 0) || (d0 <= 0 && d1 <= 0)) {
      // Same sign (or touches zero) — single trapezoid
      const sign: 1 | -1 = d0 + d1 >= 0 ? 1 : -1;
      const fill = sign === 1 ? fillPositive : fillNegative;
      paths.push({
        fill,
        sign,
        points: [ax0, ax1, bx1, bx0],
      });
      continue;
    }

    // Different signs — crossover
    hasCrossovers = true;
    const tCross = d0 / (d0 - d1); // d0 + t*(d1-d0) = 0 → t = d0 / (d0 - d1)
    const xCross = ax0.x + tCross * (ax1.x - ax0.x);
    const yCross = ax0.y + tCross * (ax1.y - ax0.y);
    // First triangle: sign of d0
    const sign0: 1 | -1 = d0 > 0 ? 1 : -1;
    const fill0 = sign0 === 1 ? fillPositive : fillNegative;
    paths.push({
      fill: fill0,
      sign: sign0,
      points: [ax0, { x: xCross, y: yCross }, bx0],
    });
    // Second triangle: sign of d1
    const sign1: 1 | -1 = d1 > 0 ? 1 : -1;
    const fill1 = sign1 === 1 ? fillPositive : fillNegative;
    paths.push({
      fill: fill1,
      sign: sign1,
      points: [{ x: xCross, y: yCross }, ax1, bx1],
    });
  }
  return { ok: true, paths, hasCrossovers };
}

function interpolateAt(sorted: ResolvedBound, x: number): number {
  if (sorted.length === 0) return Number.NaN;
  if (x <= sorted[0]!.x) return sorted[0]!.y;
  if (x >= sorted[sorted.length - 1]!.x) return sorted[sorted.length - 1]!.y;
  // Binary search for adjacent pair.
  let lo = 0;
  let hi = sorted.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]!.x <= x) lo = mid;
    else hi = mid;
  }
  const a = sorted[lo]!;
  const b = sorted[hi]!;
  const dx = b.x - a.x;
  if (dx === 0) return a.y;
  return a.y + ((x - a.x) / dx) * (b.y - a.y);
}
