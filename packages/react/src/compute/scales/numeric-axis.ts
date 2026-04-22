import { scaleLinear, scaleSqrt } from "d3-scale";
import { createContinuousScale } from "./continuous-scale.js";

export type NumericAxisInput = {
  min: number;
  max: number;
  range: [number, number];
  tickCount?: number;
  kind?: "linear" | "sqrt";
  invert?: boolean;
};

export type NumericAxisModel = {
  domain: [number, number];
  ticks: number[];
  scale: (value: number) => number;
};

const DEFAULT_TICK_COUNT = 6;
const ROUNDING_FACTOR = 1e12;

function roundNumeric(value: number): number {
  if (!Number.isFinite(value)) return value;
  const rounded = Math.round(value * ROUNDING_FACTOR) / ROUNDING_FACTOR;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizeExtent(min: number, max: number): [number, number] {
  if (min <= max) return [min, max];
  return [max, min];
}

function expandDegenerateExtent(min: number, max: number): [number, number] {
  if (min !== max) return [min, max];
  const pad = min === 0 ? 1 : Math.abs(min) * 0.1;
  return [min - pad, max + pad];
}

function createD3AxisScale(
  kind: "linear" | "sqrt",
  domain: [number, number],
  range: [number, number],
) {
  if (kind === "sqrt") {
    return scaleSqrt().domain(domain).range(range);
  }
  return scaleLinear().domain(domain).range(range);
}

export function createNumericAxis(input: NumericAxisInput): NumericAxisModel {
  const {
    min,
    max,
    range,
    tickCount = DEFAULT_TICK_COUNT,
    kind = "linear",
    invert = false,
  } = input;

  let [domainMin, domainMax] = normalizeExtent(min, max);
  if (kind === "sqrt") {
    domainMin = Math.max(0, domainMin);
    domainMax = Math.max(domainMin, domainMax);
  }

  [domainMin, domainMax] = expandDegenerateExtent(domainMin, domainMax);
  if (kind === "sqrt") {
    domainMin = Math.max(0, domainMin);
    domainMax = Math.max(domainMin, domainMax);
  }

  const resolvedRange: [number, number] = invert ? [range[1], range[0]] : range;
  const axisScale = createD3AxisScale(kind, [domainMin, domainMax], resolvedRange).nice(
    tickCount,
  );
  const domain = axisScale.domain().map(roundNumeric) as [number, number];
  const ticks = axisScale
    .ticks(tickCount)
    .map(roundNumeric)
    .filter((tick, index, values) => index === 0 || tick !== values[index - 1]);

  return {
    domain,
    ticks,
    scale: createContinuousScale({
      kind,
      domain,
      range: resolvedRange,
      clamp: false,
    }),
  };
}
