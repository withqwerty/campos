import type { RawOptaQualifier } from "./map-formation.js";

type WithQualifiers = { qualifier: RawOptaQualifier[] };

/**
 * Look up a required qualifier and return its trimmed value. Throws a
 * clear error if the qualifier is missing or has an empty/undefined value.
 */
export function requireQualifierValue(
  event: WithQualifiers,
  qualifierId: number,
  description: string,
): string {
  const qualifier = event.qualifier.find((q) => q.qualifierId === qualifierId);
  if (!qualifier) {
    throw new Error(
      `missing qualifier ${qualifierId} (${description}) on Opta lineup event`,
    );
  }
  const value = (qualifier.value ?? "").trim();
  if (value.length === 0) {
    throw new Error(
      `empty qualifier ${qualifierId} (${description}) on Opta lineup event`,
    );
  }
  return value;
}

/**
 * Look up an optional qualifier value. Returns the trimmed value, or
 * `undefined` if the qualifier is absent or empty.
 */
export function findOptionalQualifierValue(
  event: WithQualifiers,
  qualifierId: number,
): string | undefined {
  const qualifier = event.qualifier.find((q) => q.qualifierId === qualifierId);
  if (!qualifier) return undefined;
  const value = (qualifier.value ?? "").trim();
  return value.length === 0 ? undefined : value;
}

/** Split a comma-separated qualifier value into trimmed, non-empty strings. */
export function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
