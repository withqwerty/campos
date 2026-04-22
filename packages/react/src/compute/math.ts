// ---------------------------------------------------------------------------
// Shared internal math and format utilities for chart modules.
// Not part of the public API — do not export from index.ts.
// ---------------------------------------------------------------------------

import {
  extent as d3Extent,
  max as d3Max,
  mean as d3Mean,
  median as d3Median,
  min as d3Min,
  sum as d3Sum,
} from "d3-array";

type NumericAccessor<T> = (value: T) => number | null | undefined;

/** Clamp `value` to the range [lo, hi]. */
export function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

/** Type guard that narrows `unknown` to a finite `number`. */
export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Median of an array of numbers. Returns 0 for empty arrays. */
export function median(values: readonly number[]): number {
  return d3Median(values) ?? 0;
}

/** Mean of an array of numbers. Returns 0 for empty arrays. */
export function mean(values: readonly number[]): number {
  return d3Mean(values) ?? 0;
}

/** Mean of accessor values. Returns 0 for empty arrays. */
export function meanBy<T>(values: readonly T[], accessor: NumericAccessor<T>): number {
  return d3Mean(values, accessor) ?? 0;
}

/** Minimum of an array of numbers. Returns undefined for empty arrays. */
export function min(values: readonly number[]): number | undefined {
  return d3Min(values) ?? undefined;
}

/** Minimum of accessor values. Returns undefined for empty arrays. */
export function minBy<T>(
  values: readonly T[],
  accessor: NumericAccessor<T>,
): number | undefined {
  return d3Min(values, accessor) ?? undefined;
}

/** Maximum of an array of numbers. Returns undefined for empty arrays. */
export function max(values: readonly number[]): number | undefined {
  return d3Max(values) ?? undefined;
}

/** Maximum of accessor values. Returns undefined for empty arrays. */
export function maxBy<T>(
  values: readonly T[],
  accessor: NumericAccessor<T>,
): number | undefined {
  return d3Max(values, accessor) ?? undefined;
}

/** Sum of an array of numbers. Returns 0 for empty arrays. */
export function sum(values: readonly number[]): number {
  return d3Sum(values);
}

/** Sum of accessor values. Returns 0 for empty arrays. */
export function sumBy<T>(values: readonly T[], accessor: NumericAccessor<T>): number {
  return d3Sum(values, accessor);
}

/** Extent of an array of numbers. Returns null for empty arrays. */
export function extent(values: readonly number[]): [number, number] | null {
  const [lo, hi] = d3Extent(values);
  if (lo == null || hi == null) {
    return null;
  }
  return [lo, hi];
}

/** Extent of accessor values. Returns null for empty arrays. */
export function extentBy<T>(
  values: readonly T[],
  accessor: NumericAccessor<T>,
): [number, number] | null {
  const [lo, hi] = d3Extent(values, accessor);
  if (lo == null || hi == null) {
    return null;
  }
  return [lo, hi];
}

/** Format a match minute as `"45'"`. */
export function formatMinute(minute: number): string {
  return `${minute}'`;
}
