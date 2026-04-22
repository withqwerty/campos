/**
 * Opta numeric formation ID → mplsoccer formation key.
 *
 * Ported from kloppy's `formation_id_mapping` at
 * `kloppy/infra/serializers/event/statsperform/formation_mapping.py`.
 *
 * There are 24 Opta formation IDs (2-25). Every entry points at a key
 * that exists in `formation-positions.json`. When Opta changes (new IDs
 * added, existing IDs renamed), re-check against the kloppy reference
 * and update this table.
 *
 * Value derivation:
 *   1. Read kloppy's Opta ID → FormationType enum mapping.
 *   2. FormationType values are hyphen-separated (e.g. "4-3-3", "3-1-4-2").
 *   3. Strip hyphens to match mplsoccer's formation keys ("433", "3142").
 *
 * Notable normalizations relative to raw kloppy values:
 *   - Opta ID 19 (`THREE_ONE_FOUR_TWO` = "3-1-4-2") → "3142"
 *   - Opta ID 22 (`FOUR_TWO_FOUR_ZERO` = "4-2-4-0") → "424", because
 *     mplsoccer represents this shape without the trailing zero.
 *
 * Lint: the regression tests in compute-formation.test.ts assert the
 * size is exactly 24 and every value maps to a known formation key.
 */
export const OPTA_FORMATION_ID_MAP: Readonly<Record<number, string>> = Object.freeze({
  2: "442",
  3: "41212",
  4: "433",
  5: "451",
  6: "4411",
  7: "4141",
  8: "4231",
  9: "4321",
  10: "532",
  11: "541",
  12: "352",
  13: "343",
  14: "31312",
  15: "4222",
  16: "3511",
  17: "3421",
  18: "3412",
  19: "3142",
  20: "31213",
  21: "4132",
  22: "424",
  23: "4312",
  24: "3241",
  25: "3331",
});

/**
 * Convert an Opta formation ID (from qualifier 130 of typeId 34 lineup
 * events) to a mplsoccer formation key. Accepts either a number or a
 * numeric string, since Opta XML/JSON feeds deliver qualifier values as
 * strings.
 *
 * Throws with an explicit message on unknown or invalid IDs so callers
 * fail loudly rather than silently dropping formations.
 *
 * @example
 *   optaFormationIdToKey(8)      // → "4231"
 *   optaFormationIdToKey("4")    // → "433"
 *   optaFormationIdToKey(999)    // throws: unknown Opta formation ID
 *   optaFormationIdToKey("abc")  // throws: invalid Opta formation ID
 */
export function optaFormationIdToKey(optaId: number | string): string {
  const id = typeof optaId === "string" ? Number.parseInt(optaId, 10) : optaId;
  if (!Number.isFinite(id)) {
    throw new Error(`invalid Opta formation ID: ${JSON.stringify(optaId)}`);
  }
  const key = OPTA_FORMATION_ID_MAP[id];
  if (key == null) {
    throw new Error(
      `unknown Opta formation ID: ${id}. ` +
        `Expected one of ${Object.keys(OPTA_FORMATION_ID_MAP).join(", ")}. ` +
        `If this is a genuine new Opta formation, update formation-opta-ids.ts ` +
        `against kloppy's current formation_id_mapping.`,
    );
  }
  return key;
}
