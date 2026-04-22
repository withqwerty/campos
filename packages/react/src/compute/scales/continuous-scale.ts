import { scaleLinear, scaleSqrt } from "d3-scale";

export type ContinuousScaleKind = "linear" | "sqrt";

export type CreateContinuousScaleInput = {
  kind: ContinuousScaleKind;
  domain: [number, number];
  range: [number, number];
  clamp?: boolean;
};

function midRange(range: [number, number]): number {
  return (range[0] + range[1]) / 2;
}

function isDegenerateDomain(domain: [number, number]): boolean {
  return domain[0] === domain[1];
}

export function createContinuousScale(
  input: CreateContinuousScaleInput,
): (value: number) => number {
  const { kind, domain, range, clamp = false } = input;
  const [d0, d1] = domain;

  if (!Number.isFinite(d0) || !Number.isFinite(d1) || isDegenerateDomain(domain)) {
    const mid = midRange(range);
    return () => mid;
  }

  if (kind === "sqrt") {
    const safeMin = Math.max(0, d0);
    const safeMax = Math.max(safeMin, d1);

    if (safeMin === safeMax) {
      const mid = midRange(range);
      return () => mid;
    }

    const scale = scaleSqrt().domain([safeMin, safeMax]).range(range).clamp(clamp);
    return (value: number) => scale(value);
  }

  const scale = scaleLinear().domain(domain).range(range).clamp(clamp);
  return (value: number) => scale(value);
}
