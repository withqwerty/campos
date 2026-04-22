import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it } from "vitest";

import type { Shot } from "@withqwerty/campos-schema";

import { XGTimeline } from "../src/index";

afterEach(cleanup);

function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    kind: "shot" as const,
    id: "s1",
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
    xg: 0.15,
    outcome: "saved",
    bodyPart: "right-foot",
    isOwnGoal: false,
    isPenalty: false,
    context: "regular-play",
    provider: "opta",
    providerEventId: "e1",
    ...overrides,
  };
}

const shots: Shot[] = [
  makeShot({ id: "home-1", teamId: "home", xg: 0.42, outcome: "goal" }),
  makeShot({
    id: "away-1",
    teamId: "away",
    minute: 63,
    period: 2,
    xg: 0.31,
    playerName: "Palmer",
  }),
];

describe("<XGTimeline />", () => {
  it("renders with an accessible summary label", () => {
    const { getByLabelText } = render(
      <XGTimeline shots={shots} homeTeam="home" awayTeam="away" />,
    );

    expect(getByLabelText(/xG timeline/i)).toBeInTheDocument();
  });

  it("renders the empty state when there are no shots", () => {
    const { getByText, queryByTestId } = render(
      <XGTimeline shots={[]} homeTeam="home" awayTeam="away" />,
    );

    expect(getByText("No shot data")).toBeInTheDocument();
    expect(queryByTestId("xg-tooltip")).not.toBeInTheDocument();
  });

  it("shows tooltip when a shot marker is focused", () => {
    const { getAllByRole, getByTestId } = render(
      <XGTimeline shots={shots} homeTeam="home" awayTeam="away" />,
    );

    fireEvent.focus(getAllByRole("button")[0] as HTMLElement);

    expect(getByTestId("xg-tooltip").textContent).toContain("Salah");
    expect(getByTestId("xg-tooltip").textContent).toContain("0.42");
  });

  it("folds added time into the displayed minute", () => {
    const extraTimeShots: Shot[] = [
      makeShot({
        id: "stoppage-1",
        minute: 45,
        addedMinute: 2,
        xg: 0.28,
        outcome: "goal",
      }),
    ];

    const { getAllByRole, getByTestId } = render(
      <XGTimeline shots={extraTimeShots} homeTeam="home" awayTeam="away" />,
    );

    fireEvent.focus(getAllByRole("button")[0] as HTMLElement);
    expect(getByTestId("xg-tooltip").textContent).toContain("47'");
  });

  it("shows the crosshair overlay when the plot is hovered", () => {
    const { container, getByTestId } = render(
      <XGTimeline shots={shots} homeTeam="home" awayTeam="away" />,
    );

    const hitRect = container.querySelector('rect[fill="transparent"]');
    expect(hitRect).not.toBeNull();

    fireEvent.mouseMove(hitRect as SVGRectElement, { clientX: 240, clientY: 160 });
    expect(getByTestId("xg-crosshair")).toBeInTheDocument();
  });

  it("suppresses the crosshair overlay when showCrosshair is false", () => {
    const { container, queryByTestId } = render(
      <XGTimeline shots={shots} homeTeam="home" awayTeam="away" showCrosshair={false} />,
    );

    const hitRect = container.querySelector('rect[fill="transparent"]');
    expect(hitRect).toBeNull();
    expect(queryByTestId("xg-crosshair")).not.toBeInTheDocument();
  });

  it("supports line, marker, guide, and area style injection", () => {
    const { getByTestId, getByText } = render(
      <XGTimeline
        shots={shots}
        homeTeam="home"
        awayTeam="away"
        lines={{
          stroke: {
            by: ({ line }) => line.teamId,
            values: { home: "#dc2626", away: "#2563eb" },
          },
          strokeDasharray: ({ line }) => (line.teamId === "away" ? "4 2" : undefined),
        }}
        markers={{
          shape: {
            by: ({ marker }) => marker.teamId,
            values: { home: "square" },
            fallback: "circle",
          },
          fill: ({ marker }) => (marker.xg >= 0.4 ? "#dc2626" : "#2563eb"),
        }}
        guides={{ stroke: "#94a3b8", labelColor: "#475569", opacity: 0.5 }}
        areas={{ fill: "#fca5a5", opacity: 0.22 }}
      />,
    );

    expect(
      getByTestId("xg-step-lines").querySelector("path[stroke='#dc2626']"),
    ).not.toBeNull();
    expect(
      getByTestId("xg-step-lines").querySelector("path[stroke-dasharray='4 2']"),
    ).not.toBeNull();

    const markerRect = getByTestId("xg-markers").querySelector("rect");
    expect(markerRect).toHaveAttribute("fill", "#dc2626");

    const guideLine = getByTestId("xg-guides").querySelector("line");
    expect(guideLine).toHaveAttribute("stroke", "#94a3b8");
    expect(guideLine).toHaveAttribute("opacity", "0.5");
    expect(getByText("HT")).toHaveAttribute("fill", "#475569");

    const areaPath = getByTestId("xg-area-fill").querySelector("path");
    expect(areaPath).toHaveAttribute("fill", "#fca5a5");
    expect(areaPath).toHaveAttribute("opacity", "0.22");
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <XGTimeline shots={shots} homeTeam="home" awayTeam="away" />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders methodology notes outside the chart plot", () => {
    render(
      <XGTimeline
        shots={shots}
        homeTeam="home"
        awayTeam="away"
        methodologyNotes={{
          above: "Compared to league average shot quality",
          below: "Regular time only",
        }}
      />,
    );

    expect(screen.getByTestId("chart-note-above")).toHaveTextContent(
      "Compared to league average shot quality",
    );
    expect(screen.getByTestId("chart-note-below")).toHaveTextContent("Regular time only");
  });
});
