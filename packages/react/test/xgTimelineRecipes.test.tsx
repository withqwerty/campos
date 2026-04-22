import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Shot } from "@withqwerty/campos-schema";

import { XGTimeline, mergeChartRecipeProps, xgTimelineRecipes } from "../src/index";

afterEach(cleanup);

const shots: Shot[] = [
  {
    kind: "shot",
    id: "home-1",
    matchId: "m1",
    teamId: "home",
    playerId: "p1",
    playerName: "Salah",
    minute: 25,
    addedMinute: null,
    second: 0,
    period: 1,
    x: 90,
    y: 40,
    xg: 0.42,
    outcome: "goal",
    bodyPart: "right-foot",
    isOwnGoal: false,
    isPenalty: false,
    context: "regular-play",
    provider: "opta",
    providerEventId: "e1",
  },
  {
    kind: "shot",
    id: "away-1",
    matchId: "m1",
    teamId: "away",
    playerId: "p2",
    playerName: "Palmer",
    minute: 63,
    addedMinute: null,
    second: 0,
    period: 2,
    x: 88,
    y: 58,
    xg: 0.05,
    outcome: "saved",
    bodyPart: "right-foot",
    isOwnGoal: false,
    isPenalty: false,
    context: "regular-play",
    provider: "opta",
    providerEventId: "e2",
  },
];

describe("xgTimelineRecipes", () => {
  it("understat recipe enables the running score strip", () => {
    const { getByTestId } = render(
      <XGTimeline
        shots={shots}
        homeTeam="home"
        awayTeam="away"
        {...mergeChartRecipeProps(xgTimelineRecipes.understat)}
      />,
    );

    expect(getByTestId("xg-score-strip")).toBeInTheDocument();
  });

  it("mirrored-score-strip recipe pins the mirrored match-page defaults", () => {
    expect(xgTimelineRecipes.mirroredScoreStrip.props).toMatchObject({
      layout: "mirrored",
      showScoreStrip: true,
    });
  });

  it("line-only recipe removes area fill and low-signal shot dots", () => {
    const { container, queryByTestId } = render(
      <XGTimeline
        shots={shots}
        homeTeam="home"
        awayTeam="away"
        {...mergeChartRecipeProps(xgTimelineRecipes.lineOnly)}
      />,
    );

    expect(queryByTestId("xg-area-fill")).toBeNull();
    expect(
      container.querySelectorAll('[data-testid="xg-markers"] [role="button"]'),
    ).toHaveLength(1);
  });
});
