export function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function toNullableInteger(value: unknown): number | null {
  const parsed = toNullableNumber(value);
  return parsed != null ? Math.trunc(parsed) : null;
}

export function toIsoString(
  value: string | number | Date | null | undefined,
): string | null {
  if (value == null) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

export type ParsedScoreline = {
  home: number;
  away: number;
  shootout: { home: number; away: number } | null;
  resolvedIn: "regulation" | "extra-time" | "shootout" | null;
};

const DASHES = "[-–—]";
const NUM = "(\\d+)";
const REGULATION_RE = new RegExp(`${NUM}\\s*${DASHES}\\s*${NUM}`);
const SHOOTOUT_RE = new RegExp(
  `\\(\\s*${NUM}\\s*(?:${DASHES}\\s*${NUM}\\s*(?:p|pens?|penalties|on penalties|pso|psk)?|(?:p|pens?|pso|psk)\\s*${NUM})\\s*\\)`,
  "i",
);
const AET_RE = /\b(a\.?e\.?t\.?|aet|after extra time|extra[- ]time)\b/i;
const PENS_RE =
  /\b(a\.?p\.?|ap|on penalties|pens\b|penalties\b|p\.?s\.?o\.?|shootout)\b/i;

export function parseScoreline(score: string | null | undefined): ParsedScoreline | null {
  const normalized = normalizeText(score);
  if (normalized == null) return null;

  const match = normalized.match(REGULATION_RE);
  if (!match) return null;

  const home = Number.parseInt(match[1] ?? "", 10);
  const away = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(home) || !Number.isFinite(away)) {
    return null;
  }

  const shootoutMatch = normalized.match(SHOOTOUT_RE);
  const shootout = shootoutMatch
    ? (() => {
        const a = Number.parseInt(shootoutMatch[1] ?? "", 10);
        const b = Number.parseInt(shootoutMatch[2] ?? "", 10);
        return Number.isFinite(a) && Number.isFinite(b) ? { home: a, away: b } : null;
      })()
    : null;

  const hasPens = shootout != null || PENS_RE.test(normalized);
  const hasAet = AET_RE.test(normalized);
  const resolvedIn = hasPens ? "shootout" : hasAet ? "extra-time" : "regulation";

  return { home, away, shootout, resolvedIn };
}

export function buildFallbackMatchId(
  ...parts: Array<string | number | Date | null | undefined>
): string {
  const tokens = parts
    .map((part) => {
      if (part == null) return null;
      if (part instanceof Date || typeof part === "number") {
        const iso = toIsoString(part);
        return iso != null && iso.length > 0 ? iso : null;
      }
      const trimmed = part.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .filter((part): part is string => part != null);

  return tokens.length > 0 ? tokens.join("__") : "unknown-match";
}
