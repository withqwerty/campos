export type OptaSquadEntry = {
  playerId: string;
  label: string;
  number: number | undefined;
  teamId: string;
  teamName: string;
};

export type OptaSquadIndex = Map<string, OptaSquadEntry>;

type RawOptaSquadPerson = {
  id: string;
  firstName?: string;
  lastName?: string;
  matchName?: string;
  type?: string;
  shirtNumber?: number;
};

type RawOptaSquadTeam = {
  contestantId: string;
  contestantName: string;
  contestantCode?: string;
  person: RawOptaSquadPerson[];
};

export type RawOptaSquadsFile = {
  squad: RawOptaSquadTeam[];
};

/**
 * Parse a pre-loaded Opta `squads.json` file into a player-ID indexed
 * lookup table. Non-player entries (coaches, staff) are skipped.
 *
 * The label is derived in priority order: `matchName` (trimmed) →
 * `firstName + lastName` (trimmed) → `id` as a final fallback.
 *
 * This should be called once per season and the result cached — it is
 * an O(n) scan over the full squad file.
 *
 * @throws if `raw` is missing or `raw.squad` is not an array
 */
export function parseOptaSquads(raw: RawOptaSquadsFile): OptaSquadIndex {
  if (!Array.isArray(raw.squad)) {
    throw new Error("Invalid Opta squads file: missing `squad` array");
  }

  const index: OptaSquadIndex = new Map();

  for (const team of raw.squad) {
    if (!Array.isArray(team.person)) continue;
    for (const person of team.person) {
      if (person.type !== "player") continue;
      const label =
        person.matchName?.trim() ||
        [person.firstName, person.lastName].filter(Boolean).join(" ").trim() ||
        person.id;
      index.set(person.id, {
        playerId: person.id,
        label,
        number: person.shirtNumber,
        teamId: team.contestantId,
        teamName: team.contestantName,
      });
    }
  }

  return index;
}
