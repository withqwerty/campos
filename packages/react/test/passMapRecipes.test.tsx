import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PassEvent } from "@withqwerty/campos-schema";

import type { PassMapMarkerModel } from "../src/compute/index.js";

import { DARK_THEME, PassMap, mergeChartRecipeProps, passMapRecipes } from "../src/index";

const passes: PassEvent[] = [
  {
    kind: "pass",
    id: "1",
    matchId: "m1",
    teamId: "t1",
    playerId: "p1",
    playerName: "Ødegaard",
    minute: 4,
    addedMinute: null,
    second: 12,
    period: 1,
    x: 55.3,
    y: 38.2,
    endX: 72.1,
    endY: 45.6,
    length: 18.3,
    angle: 0.42,
    recipient: "Saka",
    passResult: "complete",
    passType: "ground",
    isAssist: false,
    provider: "whoscored",
    providerEventId: "100",
    sourceMeta: {},
  },
  {
    kind: "pass",
    id: "2",
    matchId: "m1",
    teamId: "t1",
    playerId: "p2",
    playerName: "Rice",
    minute: 12,
    addedMinute: null,
    second: 44,
    period: 1,
    x: 40,
    y: 52,
    endX: 28,
    endY: 60,
    length: 14.6,
    angle: -2.51,
    recipient: null,
    passResult: "incomplete",
    passType: "high",
    isAssist: false,
    provider: "whoscored",
    providerEventId: "200",
    sourceMeta: {},
  },
  {
    kind: "pass",
    id: "3",
    matchId: "m1",
    teamId: "t1",
    playerId: "p3",
    playerName: "Saka",
    minute: 25,
    addedMinute: null,
    second: 10,
    period: 1,
    x: 82,
    y: 88,
    endX: 92,
    endY: 50,
    length: 39.3,
    angle: -1.32,
    recipient: "Havertz",
    passResult: "complete",
    passType: "cross",
    isAssist: true,
    provider: "whoscored",
    providerEventId: "300",
    sourceMeta: {},
  },
];

const marker: PassMapMarkerModel = {
  passId: "1",
  x: 55.3,
  y: 38.2,
  endX: 72.1,
  endY: 45.6,
  isDot: false,
  color: "#000000",
  tooltip: { rows: [] },
};

describe("passMapRecipes", () => {
  it("completed recipe resolves theme-aware accents instead of fixed light-mode hexes", () => {
    const stroke = passMapRecipes.completed.props.lines?.stroke;
    const firstPass = passes[0];

    expect(typeof stroke).toBe("function");
    if (typeof stroke !== "function") {
      throw new Error("completed pass-map recipe stroke must resolve from theme");
    }
    if (firstPass == null) {
      throw new Error("pass fixture missing");
    }
    expect(stroke({ pass: firstPass, marker, active: false, theme: DARK_THEME })).toBe(
      DARK_THEME.accent.blue,
    );
  });

  it("completed recipe removes incomplete markers and hides summary chrome", () => {
    const { container, queryByText } = render(
      <PassMap passes={passes} {...mergeChartRecipeProps(passMapRecipes.completed)} />,
    );

    expect(within(container).getAllByRole("button")).toHaveLength(2);
    expect(queryByText("Passes")).not.toBeInTheDocument();
    expect(queryByText("Complete")).not.toBeInTheDocument();
  });

  it("crosses recipe isolates cross passes", () => {
    const { container } = render(
      <PassMap passes={passes} {...mergeChartRecipeProps(passMapRecipes.crosses)} />,
    );

    expect(within(container).getAllByRole("button")).toHaveLength(1);
  });

  it("shot-assists recipe isolates assist passes", () => {
    const { container } = render(
      <PassMap passes={passes} {...mergeChartRecipeProps(passMapRecipes.shotAssists)} />,
    );

    expect(within(container).getAllByRole("button")).toHaveLength(1);
  });
});
