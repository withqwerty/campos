import { format } from "d3-format";

const TRIMMED_FIXED = format(".12~f");
const ASCII_MINUS = /−/g;

function normalizeZero(value: number): number {
  if (Object.is(value, -0)) return 0;
  if (Math.abs(value) < 1e-12) return 0;
  return value;
}

function toAscii(label: string): string {
  return label.replace(ASCII_MINUS, "-");
}

export function formatNumericTick(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  const normalized = normalizeZero(value);
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }

  const rounded = Number(normalized.toPrecision(6));
  const formatted = toAscii(TRIMMED_FIXED(rounded));
  return formatted === "-0" ? "0" : formatted;
}
