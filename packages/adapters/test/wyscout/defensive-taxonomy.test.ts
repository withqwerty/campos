import { describe, expect, it } from "vitest";

import { fromWyscout } from "../../src/index";
import type { WyscoutMatchData } from "../../src/wyscout/parse.js";

import arsenalVsSouthampton from "../fixtures/wyscout/raw-match-arsenal-v-southampton.json";

const matchData = arsenalVsSouthampton as unknown as WyscoutMatchData;

describe("fromWyscout defensive and goalkeeper taxonomy", () => {
  const events = fromWyscout.events(matchData);

  it("emits both pass and interception for interception-tagged passes", () => {
    const taggedPassEvents = events.filter(
      (event) => event.providerEventId === "241083846",
    );

    expect(taggedPassEvents.map((event) => event.kind).sort()).toEqual([
      "interception",
      "pass",
    ]);
  });

  it("turns interception-tagged touches into standalone interceptions", () => {
    const taggedTouchEvents = events.filter(
      (event) => event.providerEventId === "241083902",
    );

    expect(taggedTouchEvents).toHaveLength(1);
    expect(taggedTouchEvents[0]).toMatchObject({
      kind: "interception",
      providerEventId: "241083902",
    });
  });

  it("prefers interception over duel or take-on for interception-tagged duels", () => {
    const taggedDuelEvents = events.filter(
      (event) => event.providerEventId === "241083914",
    );

    expect(taggedDuelEvents).toHaveLength(1);
    expect(taggedDuelEvents[0]).toMatchObject({
      kind: "interception",
      providerEventId: "241083914",
    });
  });

  it("maps acceleration to recovery", () => {
    const recovery = events.find((event) => event.providerEventId === "241083850");

    expect(recovery).toMatchObject({
      kind: "recovery",
      providerEventId: "241083850",
    });
  });

  it("keeps goalkeeper output limited to the save-event seam", () => {
    const save = events.find((event) => event.providerEventId === "241084017");
    const leavingLine = events.find((event) => event.providerEventId === "241084774");

    expect(save).toMatchObject({
      kind: "goalkeeper",
      actionType: "save",
      providerEventId: "241084017",
    });
    expect(leavingLine).toBeUndefined();
  });
});
