import { describe, expect, it } from "vitest";

import { fromWyscout } from "../../src/index";
import type {
  WyscoutLineupLookups,
  WyscoutMatchData,
  WyscoutMatchTeamData,
} from "../../src/index";

import arsenalVsSouthampton from "../fixtures/wyscout/raw-match-arsenal-v-southampton.json";
import arsenalVsSouthamptonLookups from "../fixtures/wyscout/raw-lookups-arsenal-v-southampton.json";

const matchData = arsenalVsSouthampton as unknown as WyscoutMatchData;
const lookups = arsenalVsSouthamptonLookups as unknown as WyscoutLineupLookups;

describe("fromWyscout.matchLineups", () => {
  it("maps public Wyscout formation data into home and away team sheets", () => {
    const lineups = fromWyscout.matchLineups(matchData, lookups);

    expect(lineups.matchId).toBe("2500040");
    expect(lineups.home?.teamId).toBe("1609");
    expect(lineups.home?.teamLabel).toBe("Arsenal");
    expect(lineups.away?.teamId).toBe("1619");
    expect(lineups.away?.teamLabel).toBe("Southampton");
  });

  it("keeps the starter and bench split from the raw Wyscout formation payload", () => {
    const lineups = fromWyscout.matchLineups(matchData, lookups);

    expect(lineups.home?.starters).toHaveLength(11);
    expect(lineups.home?.bench).toHaveLength(7);
    expect(lineups.away?.starters).toHaveLength(11);
    expect(lineups.away?.bench).toHaveLength(7);

    expect(lineups.home?.starters.every((player) => player.starter === true)).toBe(true);
    expect(lineups.home?.bench.every((player) => player.starter === false)).toBe(true);
  });

  it("enriches players with lookup labels and coarse role-based position codes", () => {
    const lineups = fromWyscout.matchLineups(matchData, lookups);
    const homeStarter = lineups.home?.starters[0];
    const awayBenchPlayer = lineups.away?.bench[0];

    expect(homeStarter).toMatchObject({
      playerId: "397098",
      label: "R. Nelson",
      positionCode: "MD",
      starter: true,
    });
    expect(awayBenchPlayer).toMatchObject({
      playerId: "61941",
      label: "F. Forster",
      positionCode: "GK",
      starter: false,
    });
  });

  it("applies substitution metadata from Wyscout formation.substitutions", () => {
    const lineups = fromWyscout.matchLineups(matchData, lookups);
    const home = lineups.home;
    const away = lineups.away;

    const reissNelson = home?.starters.find((player) => player.playerId === "397098");
    const eddieNketiah = home?.bench.find((player) => player.playerId === "346158");
    const pierreEmerickAubameyang = home?.bench.find(
      (player) => player.playerId === "7873",
    );
    const mayaYoshida = away?.starters.find((player) => player.playerId === "703");
    const sofianeBoufal = away?.bench.find((player) => player.playerId === "8953");

    expect(reissNelson).toMatchObject({
      substitutedOut: true,
      minuteOff: 64,
    });
    expect(eddieNketiah).not.toMatchObject({
      substitutedIn: true,
    });
    expect(pierreEmerickAubameyang).toMatchObject({
      substitutedIn: true,
      minuteOn: 64,
    });
    expect(mayaYoshida).toMatchObject({
      substitutedOut: true,
      minuteOff: 72,
    });
    expect(sofianeBoufal).toMatchObject({
      substitutedIn: true,
      minuteOn: 72,
    });
  });

  it("preserves match-day stats in sourceMeta without pretending richer card semantics", () => {
    const lineups = fromWyscout.matchLineups(matchData, lookups);
    const alexandreLacazette = lineups.home?.starters.find(
      (player) => player.playerId === "7945",
    );
    const reissNelson = lineups.home?.starters.find(
      (player) => player.playerId === "397098",
    );
    const pierreEmerickAubameyang = lineups.home?.bench.find(
      (player) => player.playerId === "7873",
    );

    expect(alexandreLacazette?.sourceMeta).toMatchObject({
      goals: 2,
    });
    expect(reissNelson?.sourceMeta).toBeUndefined();
    expect(pierreEmerickAubameyang?.sourceMeta).toMatchObject({
      yellowCardMinute: 92,
    });
  });

  it("still returns a narrow usable team sheet without lookup enrichment", () => {
    const lineups = fromWyscout.matchLineups(matchData);
    const starter = lineups.home?.starters[0];

    expect(lineups.home?.teamLabel).toBeUndefined();
    expect(starter).toMatchObject({
      playerId: "397098",
      starter: true,
    });
    expect(starter?.label).toBeUndefined();
    expect(starter?.positionCode).toBeUndefined();
  });

  it("throws if the Wyscout formation payload is missing for a side", () => {
    const teamData = matchData.match.teamsData["1609"] as WyscoutMatchTeamData & {
      formation?: WyscoutMatchTeamData["formation"];
    };
    const homeWithoutFormation = Object.fromEntries(
      Object.entries(teamData).filter(([k]) => k !== "formation"),
    ) as Omit<typeof teamData, "formation">;

    const broken: WyscoutMatchData = {
      ...matchData,
      match: {
        ...matchData.match,
        teamsData: {
          ...matchData.match.teamsData,
          "1609": homeWithoutFormation,
        },
      },
    };

    expect(() => fromWyscout.matchLineups(broken, lookups)).toThrow(
      "missing Wyscout formation payload for team 1609",
    );
  });
});
