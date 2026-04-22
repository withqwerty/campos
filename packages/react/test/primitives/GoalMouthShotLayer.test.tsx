import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ShotEvent } from "@withqwerty/campos-schema";
import { Goal } from "@withqwerty/campos-stadia";

import { GoalMouthShotLayer } from "../../src/primitives/GoalMouthShotLayer.js";

const shots: readonly ShotEvent[] = [
  {
    kind: "shot",
    id: "goal-1",
    matchId: "m1",
    teamId: "t1",
    playerId: "p1",
    playerName: "Striker",
    minute: 12,
    addedMinute: null,
    second: 4,
    period: 1,
    x: 93,
    y: 51,
    xg: 0.22,
    xgot: 0.56,
    outcome: "goal",
    bodyPart: "right-foot",
    isOwnGoal: false,
    isPenalty: false,
    context: "regular-play",
    provider: "opta",
    providerEventId: "1",
    goalMouthY: 24,
    goalMouthZ: 42,
  },
  {
    kind: "shot",
    id: "saved-1",
    matchId: "m1",
    teamId: "t1",
    playerId: "p2",
    playerName: "Forward",
    minute: 28,
    addedMinute: null,
    second: 19,
    period: 1,
    x: 89,
    y: 48,
    xg: 0.08,
    xgot: 0.11,
    outcome: "saved",
    bodyPart: "left-foot",
    isOwnGoal: false,
    isPenalty: false,
    context: "regular-play",
    provider: "opta",
    providerEventId: "2",
    goalMouthY: 58,
    goalMouthZ: 10,
  },
  {
    kind: "shot",
    id: "off-1",
    matchId: "m1",
    teamId: "t1",
    playerId: "p3",
    playerName: "Winger",
    minute: 41,
    addedMinute: null,
    second: 10,
    period: 1,
    x: 86,
    y: 36,
    xg: 0.03,
    outcome: "off-target",
    bodyPart: "right-foot",
    isOwnGoal: false,
    isPenalty: false,
    context: "regular-play",
    provider: "opta",
    providerEventId: "3",
    goalMouthY: null,
    goalMouthZ: null,
  },
];

describe("<GoalMouthShotLayer />", () => {
  it("renders one marker per shot with canonical goal-mouth coordinates", () => {
    const { container } = render(
      <Goal facing="striker">
        {({ project }) => <GoalMouthShotLayer shots={shots} project={project} />}
      </Goal>,
    );

    const layer = container.querySelector('[data-campos="goalmouth-shot-layer"]');
    expect(layer).not.toBeNull();
    expect(layer?.querySelectorAll("polygon, circle")).toHaveLength(2);
  });

  it("uses default outcome glyphs with goal rendered as a diamond", () => {
    const { container } = render(
      <Goal facing="striker">
        {({ project }) => <GoalMouthShotLayer shots={shots} project={project} />}
      </Goal>,
    );

    const layer = container.querySelector('[data-campos="goalmouth-shot-layer"]');
    expect(layer?.querySelectorAll("polygon")).toHaveLength(1);
    expect(layer?.querySelectorAll("circle")).toHaveLength(1);
  });

  it("supports marker style overrides", () => {
    const { container } = render(
      <Goal facing="striker">
        {({ project }) => (
          <GoalMouthShotLayer
            shots={shots}
            project={project}
            markers={{
              shape: ({ shot }) => (shot.outcome === "saved" ? "square" : "diamond"),
              fill: () => "#920b0b",
              stroke: () => "#f3c515",
              strokeWidth: () => 0.08,
              size: ({ shot }) => (shot.outcome === "goal" ? 0.24 : 0.18),
            }}
          />
        )}
      </Goal>,
    );

    const layer = container.querySelector('[data-campos="goalmouth-shot-layer"]');
    expect(layer?.querySelectorAll("polygon")).toHaveLength(1);
    expect(layer?.querySelectorAll("rect")).toHaveLength(1);
  });
});
