/**
 * Country code lookup for football data.
 *
 * Uses FIFA three-letter country codes — the standard in football contexts.
 * Unlike ISO 3166-1 alpha-3, FIFA codes treat England, Scotland, Wales, and
 * Northern Ireland as separate entities (ENG, SCO, WAL, NIR) rather than
 * collapsing them under GBR.
 *
 * The mapping covers 211 FIFA member associations plus ~50 territories and
 * non-FIFA entities that appear in provider data or flag assets.
 *
 * Sources:
 * - https://en.wikipedia.org/wiki/List_of_FIFA_country_codes
 * - https://www.rsssf.org/miscellaneous/fifa-codes.html
 * - Wikimedia country-codes dataset
 *
 * @example
 * ```ts
 * import { getCountryCode } from "@withqwerty/campos-schema";
 *
 * getCountryCode("England");       // "ENG"
 * getCountryCode("england");       // "ENG"
 * getCountryCode("Ivory Coast");   // "CIV"
 * getCountryCode("Côte d'Ivoire"); // "CIV"
 * getCountryCode("Neverland");     // undefined
 * ```
 */

import countryMapping from "./countryMapping.json" with { type: "json" };

/** FIFA three-letter country code (e.g. "ENG", "BRA", "USA"). */
export type FifaCode = string;

// Build a case-insensitive lookup map once at module load.
const lookup: Map<string, FifaCode> = new Map();
for (const [name, code] of Object.entries(countryMapping)) {
  lookup.set(name.toLowerCase(), code);
}

// Common aliases that differ from the JSON keys.
// Provider data uses these; keep this list short and documented.
const ALIASES: Record<string, string> = {
  "côte d'ivoire": "CIV",
  "cote d'ivoire": "CIV",
  "korea republic": "KOR",
  "republic of korea": "KOR",
  "korea dpr": "PRK",
  "ir iran": "IRN",
  türkiye: "TUR",
  turkiye: "TUR",
  eswatini: "SWZ",
  "north macedonia": "MKD",
  "chinese taipei": "TWN",
  "dr congo": "COD",
  drc: "COD",
  usa: "USA",
  us: "USA",
  uk: "GBR",
  uae: "ARE",
  ksa: "KSA",
  "great britain": "GBR",
};

for (const [alias, code] of Object.entries(ALIASES)) {
  if (!lookup.has(alias)) {
    lookup.set(alias, code);
  }
}

/**
 * Resolve a country name to its FIFA three-letter code.
 *
 * Matching is case-insensitive. Handles official FIFA names, common English
 * variations, and known provider-specific spellings (e.g. "Korea Republic"
 * from StatsBomb, "Côte d'Ivoire" from Opta).
 *
 * @param name - Country name from any reasonable source.
 * @returns FIFA code, or `undefined` if no match is found.
 */
export function getCountryCode(name: string): FifaCode | undefined {
  return lookup.get(name.toLowerCase());
}

/**
 * Like {@link getCountryCode}, but returns a fallback instead of `undefined`.
 *
 * @param name - Country name from any reasonable source.
 * @param fallback - Value returned when no mapping exists. Defaults to the
 *   input `name` unchanged, which is useful when displaying labels.
 * @returns FIFA code, or `fallback`.
 */
export function getCountryCodeOrFallback(name: string, fallback?: string): string {
  return lookup.get(name.toLowerCase()) ?? fallback ?? name;
}

/**
 * Check whether a FIFA code has a corresponding flag SVG in `assets/flags/`.
 * Flag files are named `{CODE}.svg` (e.g. `ENG.svg`, `BRA.svg`).
 *
 * This is a pure string check against the mapping values — it does not
 * hit the filesystem.
 */
export function hasFlag(code: FifaCode): boolean {
  return ALL_FIFA_CODES.has(code);
}

/** Set of every FIFA code present in the mapping (for fast membership checks). */
const ALL_FIFA_CODES: ReadonlySet<FifaCode> = new Set(Object.values(countryMapping));

/** Re-export the raw mapping for consumers that need the full table. */
export { countryMapping };
