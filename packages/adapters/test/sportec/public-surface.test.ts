import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { fromSportec } from "../../src/index.js";

const metaXml = readFileSync(
  "packages/adapters/test/fixtures/sportec/raw-matchinformation-koeln-vs-bayern.xml",
  "utf8",
);
const eventXml = readFileSync(
  "packages/adapters/test/fixtures/sportec/raw-events-koeln-vs-bayern.xml",
  "utf8",
);

describe("fromSportec", () => {
  it("parses raw XML through the public adapter surface", () => {
    const meta = fromSportec.parseMeta(metaXml);
    const events = fromSportec.parseEvents(eventXml);

    expect(meta.matchId).toBe("DFL-MAT-J03WMX");
    expect(meta.pitchDimensions).toEqual({ length: 105, width: 68 });
    expect(events[0]).toMatchObject({
      kind: "KickOff",
      teamLeft: "DFL-CLU-00000G",
      teamRight: "DFL-CLU-000008",
    });
  });

  it("builds direction-aware match context from either raw or parsed inputs", () => {
    const parsedMeta = fromSportec.parseMeta(metaXml);
    const parsedEvents = fromSportec.parseEvents(eventXml);

    const fromRaw = fromSportec.matchContext(metaXml, eventXml);
    const fromParsed = fromSportec.matchContext(parsedMeta, parsedEvents);

    expect(fromRaw).toEqual(fromParsed);
    expect(fromRaw.periods?.firstHalf.homeAttacksToward).toBe("decreasing-x");
    expect(fromRaw.periods?.secondHalf.homeAttacksToward).toBe("increasing-x");
  });

  it("maps lineups and formation snapshots from Sportec match metadata", () => {
    const lineups = fromSportec.matchLineups(metaXml);
    const home = fromSportec.formations(metaXml, "home");
    const away = fromSportec.formations(metaXml, "away");

    expect(lineups.home?.formation).toBe("4231");
    expect(lineups.home?.captainPlayerId).toBe("DFL-OBJ-00012X");
    expect(
      lineups.home?.starters.find((player) => player.playerId === "DFL-OBJ-0002HE"),
    ).toMatchObject({
      slot: 1,
      positionCode: "GK",
    });
    expect(lineups.away?.teamLabel).toBe("FC Bayern München");
    expect(home.formation).toBe("4231");
    expect(home.players).toHaveLength(11);
    expect(away.formation).toBe("4231");
    expect(away.players.find((player) => player.slot === 1)).toMatchObject({
      playerId: "DFL-OBJ-0002DR",
      positionCode: "GK",
    });
  });

  it("maps XML events into a real but narrower canonical subset", () => {
    const events = fromSportec.events(metaXml, eventXml);

    expect(events.some((event) => event.kind === "pass")).toBe(true);
    expect(events.some((event) => event.kind === "shot")).toBe(true);
    expect(events.some((event) => event.kind === "substitution")).toBe(true);
    expect(events.every((event) => event.provider === "sportec")).toBe(true);
  });

  it("preserves Sportec ids and provenance through the Opta bridge", () => {
    const events = fromSportec.events(metaXml, eventXml);
    const pass = events.find((event) => event.kind === "pass");
    const substitution = events.find((event) => event.kind === "substitution");

    expect(pass).toMatchObject({
      id: `DFL-MAT-J03WMX:${pass?.providerEventId}`,
      provider: "sportec",
      sourceMeta: {
        providerModel: "open-dfl",
        viaOpta: { eventId: expect.any(Number) },
      },
    });
    expect(substitution).toMatchObject({
      id: `DFL-MAT-J03WMX:${substitution?.providerEventId}`,
      provider: "sportec",
      playerInId: expect.any(String),
      sourceMeta: {
        providerModel: "open-dfl",
        viaOpta: {
          eventId: expect.any(Number),
          playerInEventId: expect.any(Number),
          playerInProviderEventId: expect.any(Number),
        },
      },
    });
  });

  it("keeps a shootout-labelled raw event out of product projections", () => {
    const meta = fromSportec.parseMeta(metaXml);
    const rawEvents = fromSportec.parseEvents(eventXml);
    const pass = fromSportec.passes(meta, rawEvents)[0];
    const sourcePass = rawEvents.find((event) => event.eventId === pass?.providerEventId);
    const kickoffs = rawEvents.filter(
      (event) =>
        event.kind === "KickOff" &&
        (event.gameSection === "firstHalf" || event.gameSection === "secondHalf"),
    );

    expect(sourcePass).toBeDefined();
    const shootoutPass = {
      ...sourcePass!,
      eventId: "fixture-shootout-pass",
      gameSection: "shootout",
    };

    const eventIds = fromSportec
      .events(meta, [...kickoffs, shootoutPass])
      .map((event) => event.providerEventId);
    const passIds = fromSportec
      .passes(meta, [...kickoffs, shootoutPass])
      .map((event) => event.providerEventId);
    const shotIds = fromSportec
      .shots(meta, [...kickoffs, shootoutPass])
      .map((event) => event.providerEventId);

    expect(eventIds).not.toContain("fixture-shootout-pass");
    expect(passIds).not.toContain("fixture-shootout-pass");
    expect(shotIds).not.toContain("fixture-shootout-pass");
  });

  it("exposes pass and shot helper surfaces from the same XML bundle", () => {
    const passes = fromSportec.passes(metaXml, eventXml);
    const shots = fromSportec.shots(metaXml, eventXml);

    expect(passes.length).toBeGreaterThan(100);
    expect(shots.length).toBeGreaterThan(10);
    expect(passes.every((event) => event.provider === "sportec")).toBe(true);
    expect(shots.every((event) => event.provider === "sportec")).toBe(true);
  });
});
