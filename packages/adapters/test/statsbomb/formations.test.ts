import { describe, expect, it } from "vitest";

import type {
  StatsBombEvent,
  StatsBombLineupTeam,
  StatsBombMatchInfo,
} from "../../src/statsbomb/parse";
import { fromStatsBomb } from "../../src/index";

import fixture from "../fixtures/statsbomb/raw-match-lineups-barcelona-vs-alaves.json";

const lineups = fixture.lineups as unknown as StatsBombLineupTeam[];
const events = fixture.events as unknown as StatsBombEvent[];
const matchInfo: StatsBombMatchInfo = fixture.matchInfo;

describe("fromStatsBomb.formations", () => {
  it("projects the home kickoff team sheet into FormationTeamData", () => {
    const result = fromStatsBomb.formations(lineups, events, matchInfo, "home");

    expect(result.formation).toBe("442");
    expect(result.teamLabel).toBe("Barcelona");
    expect(result.players).toHaveLength(11);
    expect(result.players.find((player) => player.slot === 1)?.playerId).toBe("20055");
    expect(result.players.find((player) => player.playerId === "6374")?.substituted).toBe(
      true,
    );
    expect(result.players.find((player) => player.playerId === "6374")?.subMinute).toBe(
      45,
    );
  });

  it("projects the away side when requested explicitly", () => {
    const result = fromStatsBomb.formations(lineups, events, matchInfo, "away");

    expect(result.formation).toBe("451");
    expect(result.teamLabel).toBe("Deportivo Alavés");
    expect(result.players).toHaveLength(11);
    expect(result.players.find((player) => player.slot === 1)?.playerId).toBe("6629");
  });
});
