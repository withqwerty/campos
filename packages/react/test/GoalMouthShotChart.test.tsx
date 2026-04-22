import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ShotEvent } from "@withqwerty/campos-schema";

import { GoalMouthShotChart } from "../src/GoalMouthShotChart.js";

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
];

describe("<GoalMouthShotChart />", () => {
  it("shows a cursor tooltip when hovering a marker", () => {
    const { container, getByTestId, getByText, queryByTestId } = render(
      <GoalMouthShotChart shots={shots} />,
    );

    const marker = container.querySelector('[data-campos-shot-id="goal-1"]');
    expect(marker).not.toBeNull();

    fireEvent.mouseEnter(marker!);

    expect(getByTestId("cursor-tooltip")).toBeInTheDocument();
    expect(getByText("Striker")).toBeInTheDocument();
    expect(getByText("xGOT: 0.56")).toBeInTheDocument();

    fireEvent.mouseLeave(marker!);

    expect(queryByTestId("cursor-tooltip")).toBeNull();
  });

  it("supports custom tooltip content", () => {
    const { container, getByText } = render(
      <GoalMouthShotChart
        shots={shots}
        tooltip={{ renderContent: (shot) => <span>{shot.playerName} custom</span> }}
      />,
    );

    const marker = container.querySelector('[data-campos-shot-id="goal-1"]');
    expect(marker).not.toBeNull();

    fireEvent.mouseEnter(marker!);

    expect(getByText("Striker custom")).toBeInTheDocument();
  });

  it("omits the native SVG <title> when a custom cursor tooltip is active", () => {
    // Regression: we used to emit both a <title> element (which browsers
    // render as a native hover tooltip after a delay) AND the custom
    // cursor-tooltip pill, producing a double-tooltip on hover.
    const { container } = render(<GoalMouthShotChart shots={shots} />);
    const marker = container.querySelector('[data-campos-shot-id="goal-1"]');
    expect(marker).not.toBeNull();
    expect(marker!.querySelector("title")).toBeNull();
  });

  it("falls back to the native <title> when the cursor tooltip is disabled", () => {
    // When tooltip={false}, the native <title> still renders so screen
    // readers and standard browser hover behaviour keep working.
    const { container } = render(<GoalMouthShotChart shots={shots} tooltip={false} />);
    const marker = container.querySelector('[data-campos-shot-id="goal-1"]');
    expect(marker).not.toBeNull();
    const title = marker!.querySelector("title");
    expect(title).not.toBeNull();
    expect(title!.textContent).toContain("Striker");
  });

  it("exposes the chart anatomy hooks on the root wrapper", () => {
    const { container } = render(<GoalMouthShotChart shots={shots} />);

    const root = container.firstElementChild;
    expect(root).toHaveAttribute("data-slot", "frame");
    expect(root).toHaveAttribute("data-chart-kind", "goal-mouth-shot-chart");
    expect(root).toHaveAttribute("data-empty", "false");
    expect(container.querySelector('[data-slot="plot"]')).not.toBeNull();
  });
});
