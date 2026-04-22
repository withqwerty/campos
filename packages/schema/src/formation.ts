import formationPositions from "./formation-positions.json" with { type: "json" };

/**
 * A formation key is any of the 68 mplsoccer formation strings in
 * normalized form (hyphens stripped, lowercased, zeros preserved).
 *
 * The full set is loaded from formation-positions.json at runtime.
 * This type is intentionally a branded `string` rather than a literal
 * union — the union would be 68 entries long and needs updating every
 * time the table is regenerated. Use `isValidFormationKey` and
 * `parseFormationKey` to validate at boundaries.
 */
export type FormationKey = string;

export type FormationPlayer = {
  slot?: number;
  positionCode?: string;
  label?: string;
  number?: number;
  captain?: boolean;
  yellowCard?: boolean;
  redCard?: boolean;
  substituted?: boolean;
  subMinute?: number;
  photo?: string;
  photoAlt?: string;
  rating?: number;
  nationality?: string;
  age?: number;
  transferValue?: string;
  goals?: number;
  assists?: number;
  motm?: boolean;
  playerId?: string;
  color?: string;
  x?: number;
  y?: number;
};

export type FormationTeamData = {
  formation: FormationKey;
  teamLabel?: string;
  teamColor?: string;
  players: FormationPlayer[];
};

export type FormationPositionEntry = {
  readonly slot: number;
  readonly code: string;
  readonly x: number;
  readonly y: number;
  readonly opta?: number;
  readonly statsbomb?: readonly number[];
  readonly wyscout?: string;
};

export function parseFormationKey(input: string): FormationKey {
  if (typeof input !== "string") {
    throw new TypeError(`formation must be a string, got ${typeof input}`);
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("empty formation string");
  }

  const normalized = trimmed.replace(/-/g, "").toLowerCase();
  if (!isValidFormationKey(normalized)) {
    const examples = ["433", "442", "4231", "352", "343", "532"];
    throw new Error(
      `unknown formation: ${normalized}. ` +
        `Expected one of 68 mplsoccer formations (e.g. ${examples.join(", ")}). ` +
        `See packages/schema/src/formation-positions.json for the full list.`,
    );
  }

  return normalized;
}

export function isValidFormationKey(candidate: string): candidate is FormationKey {
  return Object.prototype.hasOwnProperty.call(formationPositions, candidate);
}

export function allFormationKeys(): readonly FormationKey[] {
  return Object.freeze(Object.keys(formationPositions));
}

export function getFormationPositions(
  key: FormationKey,
): readonly FormationPositionEntry[] {
  if (!isValidFormationKey(key)) {
    throw new Error(`unknown formation: ${key}`);
  }

  const raw = (formationPositions as Record<string, FormationPositionEntry[]>)[key];
  if (!raw) {
    throw new Error(`unknown formation: ${key}`);
  }

  return Object.freeze(
    raw.map((position) => Object.freeze({ ...position })),
  ) as readonly FormationPositionEntry[];
}

export function getFormationSlot(
  key: FormationKey,
  slotNumber: number,
): FormationPositionEntry {
  const positions = getFormationPositions(key);
  const maxSlot = positions.length;

  if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > maxSlot) {
    throw new Error(
      `slot must be between 1 and ${maxSlot} in formation ${key} (got ${slotNumber})`,
    );
  }

  const found = positions.find((position) => position.slot === slotNumber);
  if (!found) {
    throw new Error(`no position at slot ${slotNumber} in formation ${key}`);
  }

  return found;
}

export function getMplSlotForOptaSlot(
  key: FormationKey,
  optaSlot: number,
): number | null {
  if (!isValidFormationKey(key)) {
    return null;
  }

  const positions = getFormationPositions(key);
  const found = positions.find((position) => position.opta === optaSlot);
  return found?.slot ?? null;
}
