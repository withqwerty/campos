import { describe, expect, it } from "vitest";

import { fromVisual } from "../../src/index.js";

describe("visual player-surface adapter", () => {
  it("builds a reusable player-surface packet without tactical conclusions", () => {
    const surface = fromVisual.playerSurfaceSnapshot(
      {
        primaryWindow: {
          label: "0:00-60:00",
          startMinute: 0,
          startSecond: 0,
          endMinute: 60,
          endSecond: 0,
          evidence: ["pre-substitution event-touch window"],
          caveat: "Average positions are on-ball event-touch averages.",
        },
        lineups: {
          matchId: "match-1",
          home: {
            teamId: "home",
            teamLabel: "Home",
            formation: "433",
            starters: [],
            bench: [],
          },
          away: {
            teamId: "away",
            teamLabel: "Away",
            formation: "442",
            starters: [],
            bench: [],
          },
        },
        averagePositions: [
          {
            side: "home",
            playerId: 10,
            optaId: 10,
            playerName: "Example Ten",
            shirtNumber: "10",
            position: "AM",
            x: 107,
            y: -5,
            eventCount: 18,
            passCount: 7,
            windowLabel: "0:00-60:00",
            evidence: ["18 event touches"],
            caveat: "Not an off-ball tracking average.",
          },
        ],
        passingNetworkEdges: [
          {
            id: "edge-10-9",
            side: "home",
            fromPlayerId: 10,
            fromOptaId: 10,
            fromShirtNumber: 10,
            fromPlayerName: "Example Ten",
            toPlayerId: 9,
            toOptaId: 9,
            toShirtNumber: 9,
            toPlayerName: "Example Nine",
            x: 52,
            y: 48,
            endX: 66,
            endY: 44,
            count: 3,
            inferred: true,
            evidence: ["3 same-team next-action links"],
            caveat: "Recipient is inferred from event order.",
          },
        ],
        roleTags: [
          {
            side: "home",
            playerId: 10,
            optaId: 10,
            playerName: "Example Ten",
            shirtNumber: 10,
            position: "AM",
            label: "tempo stabiliser candidate",
            score: 81.4,
            evidence: ["high pass involvement"],
            caveat: "Candidate role only.",
          },
        ],
        caveat:
          "This is a visual packet. The consuming app owns tactical interpretation.",
        sourceMeta: { source: "unit-test" },
      },
      { matchId: "match-1", provider: "test-provider" },
    );

    expect(surface).toMatchObject({
      id: "match-1:player-surface:primary",
      matchId: "match-1",
      coordinateFrame: "absolute-pitch",
      provider: "test-provider",
    });
    expect(surface.primaryWindow.evidence).toEqual([
      "pre-substitution event-touch window",
    ]);
    expect(surface.averagePositions[0]).toMatchObject({
      playerId: "10",
      optaId: "10",
      shirtNumber: 10,
      x: 100,
      y: 0,
      evidence: ["18 event touches"],
    });
    expect(surface.passingNetworkEdges[0]).toMatchObject({
      fromPlayerId: "10",
      fromOptaId: "10",
      toPlayerId: "9",
      toOptaId: "9",
      inferred: true,
      count: 3,
    });
    expect(surface.roleTags[0]).toMatchObject({
      playerId: "10",
      label: "tempo stabiliser candidate",
      score: 81.4,
    });
    expect(surface.caveat).toContain("visual packet");
    expect(surface).not.toHaveProperty("repeatability");
    expect(surface).not.toHaveProperty("tacticalValue");
  });
});
