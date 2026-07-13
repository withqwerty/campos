import { describe, expect, it } from "vitest";

import type {
  StatsBombMatchInfo,
  StatsBombThreeSixtyFrame,
} from "../../src/statsbomb/parse";
import { fromStatsBomb } from "../../src/index";

const matchInfo: StatsBombMatchInfo = {
  id: 3902240,
  homeTeam: { id: 1, name: "Home" },
  awayTeam: { id: 2, name: "Away" },
};

const rawFrames: StatsBombThreeSixtyFrame[] = [
  {
    event_uuid: "frame-1",
    visible_area: [0, 0, 120, 0, 120, 80, 0, 80],
    freeze_frame: [
      { location: [60, 40], teammate: true, actor: true, keeper: false },
      { location: [120, 80], teammate: false, actor: false, keeper: true },
      { location: [0, 0], teammate: true, actor: false, keeper: false },
      { location: [Number.NaN, 20], teammate: false, actor: false, keeper: false },
    ],
  },
];

describe("fromStatsBomb.freezeFrames", () => {
  it("normalizes anonymous 360 participants in the linked event's attacking frame", () => {
    const [frame] = fromStatsBomb.freezeFrames(rawFrames, matchInfo);

    expect(frame).toMatchObject({
      id: "3902240:statsbomb:freeze-frame:frame-1",
      matchId: "3902240",
      eventId: "frame-1",
      coordinateFrame: "event-attacking",
      provider: "statsbomb",
      providerFrameId: "frame-1",
    });
    expect(frame?.participants).toEqual([
      {
        id: "frame-1:0",
        side: "teammate",
        isActor: true,
        isKeeper: false,
        x: 50,
        y: 50,
      },
      {
        id: "frame-1:1",
        side: "opponent",
        isActor: false,
        isKeeper: true,
        x: 100,
        y: 0,
      },
      {
        id: "frame-1:2",
        side: "teammate",
        isActor: false,
        isKeeper: false,
        x: 0,
        y: 100,
      },
    ]);
  });

  it("projects the camera-visible polygon in the same coordinate frame", () => {
    const [frame] = fromStatsBomb.freezeFrames(rawFrames, matchInfo);

    expect(frame?.visibleArea).toEqual([
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 0 },
    ]);
  });

  it("keeps a valid frame when the provider omits participants or a valid polygon", () => {
    const [frame] = fromStatsBomb.freezeFrames(
      [
        {
          event_uuid: "sparse-frame",
          visible_area: [0, 0, 120],
          freeze_frame: null,
        },
      ],
      matchInfo,
    );

    expect(frame?.participants).toEqual([]);
    expect(frame?.visibleArea).toBeNull();
  });

  it("rejects a frame without an event identity", () => {
    expect(() =>
      fromStatsBomb.freezeFrames([{ event_uuid: "", freeze_frame: [] }], matchInfo),
    ).toThrow("requires a non-empty event_uuid");
  });

  it("returns an empty collection for empty input", () => {
    expect(fromStatsBomb.freezeFrames([], matchInfo)).toEqual([]);
  });
});
