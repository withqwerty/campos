import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  buildSportecMatchContext,
  mapSportecMatchLineups,
  normalizeSportecCoordinates,
  parseSportecEventXml,
  parseSportecMetaXml,
} from "../../src/sportec/helpers.js";

const metaXml = readFileSync(
  "packages/adapters/test/fixtures/sportec/raw-matchinformation-koeln-vs-bayern.xml",
  "utf8",
);
const eventXml = readFileSync(
  "packages/adapters/test/fixtures/sportec/raw-events-koeln-vs-bayern.xml",
  "utf8",
);

describe("sportec helpers", () => {
  it("parses Sportec metadata into a normalized match record", () => {
    const meta = parseSportecMetaXml(metaXml);

    expect(meta.matchId).toBe("DFL-MAT-J03WMX");
    expect(meta.homeTeamId).toBe("DFL-CLU-000008");
    expect(meta.awayTeamId).toBe("DFL-CLU-00000G");
    expect(meta.homeScore).toBe(1);
    expect(meta.awayScore).toBe(2);
    expect(meta.pitchDimensions).toEqual({ length: 105, width: 68 });
    expect(meta.teams).toHaveLength(2);
    expect(meta.officials.some((official) => official.role === "referee")).toBe(true);
  });

  it("parses Sportec events and derives period direction context", () => {
    const meta = parseSportecMetaXml(metaXml);
    const events = parseSportecEventXml(eventXml);
    const context = buildSportecMatchContext(meta, events);

    expect(events[0]).toMatchObject({
      kind: "KickOff",
      teamLeft: "DFL-CLU-00000G",
      teamRight: "DFL-CLU-000008",
      gameSection: "firstHalf",
    });
    expect(context.periods?.firstHalf.homeAttacksToward).toBe("decreasing-x");
    expect(context.periods?.secondHalf.homeAttacksToward).toBe("increasing-x");
  });

  it("maps Sportec lineups and rotates absolute coordinates into Campos space", () => {
    const meta = parseSportecMetaXml(metaXml);
    const events = parseSportecEventXml(eventXml);
    const context = buildSportecMatchContext(meta, events);
    const lineups = mapSportecMatchLineups(meta);

    expect(lineups.home?.formation).toBe("4231");
    expect(lineups.home?.captainPlayerId).toBe("DFL-OBJ-00012X");
    expect(
      lineups.home?.starters.find((player) => player.playerId === "DFL-OBJ-0002HE"),
    ).toMatchObject({
      slot: 1,
      positionCode: "GK",
    });
    expect(lineups.away?.teamLabel).toBe("FC Bayern München");
    expect(
      lineups.away?.starters.find((player) => player.playerId === "DFL-OBJ-0002DR"),
    ).toMatchObject({
      slot: 1,
      positionCode: "GK",
    });

    expect(normalizeSportecCoordinates(context, meta.awayTeamId, 1, 0, 0)).toEqual({
      x: 0,
      y: 0,
    });
    expect(normalizeSportecCoordinates(context, meta.homeTeamId, 1, 0, 0)).toEqual({
      x: 100,
      y: 100,
    });
  });
});
