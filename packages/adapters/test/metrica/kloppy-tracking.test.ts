import { describe, expect, it } from "vitest";

import {
  metricaKloppyToCampos,
  metricaTrackingFrameFromKloppy,
} from "../../src/metrica/index.js";

describe("Metrica kloppy tracking shim", () => {
  it("projects Metrica's top-left normalised coordinates into absolute Campos pitch space", () => {
    expect(metricaKloppyToCampos([0, 0])).toEqual({ x: 0, y: 100 });
    expect(metricaKloppyToCampos([0.5, 0.5])).toEqual({ x: 50, y: 50 });
    expect(metricaKloppyToCampos([1, 1])).toEqual({ x: 100, y: 0 });
    expect(metricaKloppyToCampos(null)).toBeNull();
    expect(metricaKloppyToCampos([Number.NaN, 0.5])).toBeNull();
  });

  it("adapts a kloppy-loaded frame without inventing missing tracking positions", () => {
    const frame = metricaTrackingFrameFromKloppy(
      {
        frameId: 2,
        period: 1,
        gameClockSeconds: 0.04,
        live: true,
        players: [
          {
            playerId: "P3578",
            side: "home",
            shirtNumber: 11,
            coordinates: [0.84722, 0.52855],
          },
          {
            playerId: "P3585",
            side: "away",
            shirtNumber: 18,
            coordinates: [0.342, 0.79786],
          },
          {
            playerId: "P3579",
            side: "home",
            shirtNumber: 12,
            coordinates: null,
          },
        ],
        ball: { coordinates: null },
      },
      {
        matchId: "metrica-sample-game-3",
        pitchDimensions: { length: 105, width: 68 },
        homeAttacksTowardFirstHalf: "decreasing-x",
      },
    );

    expect(frame).toMatchObject({
      id: "metrica-sample-game-3:metrica-kloppy:frame:2",
      coordinateFrame: "absolute-pitch",
      homeAttacksToward: "decreasing-x",
      provider: "metrica-kloppy",
      ball: null,
    });
    expect(frame.players).toEqual([
      expect.objectContaining({
        side: "home",
        playerId: "P3578",
        shirtNumber: 11,
        x: 84.722,
        y: 47.145,
      }),
      expect.objectContaining({
        side: "away",
        playerId: "P3585",
        shirtNumber: 18,
        x: 34.2,
        y: 20.214,
      }),
    ]);
  });

  it("flips the home attacking-direction metadata after half-time", () => {
    const frame = metricaTrackingFrameFromKloppy(
      {
        frameId: 72001,
        period: 2,
        gameClockSeconds: 0,
        players: [],
      },
      {
        matchId: "metrica-sample-game-3",
        pitchDimensions: { length: 105, width: 68 },
        homeAttacksTowardFirstHalf: "decreasing-x",
      },
    );

    expect(frame.homeAttacksToward).toBe("increasing-x");
  });

  it("rejects duplicate observed player identities", () => {
    expect(() =>
      metricaTrackingFrameFromKloppy(
        {
          frameId: 2,
          period: 1,
          gameClockSeconds: 0,
          players: [
            { playerId: "P1", side: "home", coordinates: [0, 0] },
            { playerId: "P1", side: "away", coordinates: [1, 1] },
          ],
        },
        { matchId: "match", pitchDimensions: { length: 105, width: 68 } },
      ),
    ).toThrow(/duplicate playerId P1/);
  });
});
