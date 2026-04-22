import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";

import type { ComputeShotMapInput } from "../src/compute/index.js";

import {
  ShotMap,
  ThemeProvider,
  DARK_THEME,
  mergeChartRecipeProps,
  shotMapRecipes,
} from "../src/index";
import { ShotMapStaticSvg } from "../src/ShotMap.js";

// Default preset is "opta": size=xG, filled goals, hollow non-goals, all circles.

afterEach(cleanup);

const shots: ComputeShotMapInput["shots"] = [
  {
    kind: "shot" as const,
    id: "1",
    matchId: "m1",
    teamId: "t1",
    playerId: "p1",
    playerName: "Eriksen",
    minute: 4,
    addedMinute: null,
    second: 0,
    period: 1,
    x: 90.2,
    y: 39,
    xg: 0.12,
    outcome: "off-target",
    bodyPart: "left-foot",
    isOwnGoal: false,
    isPenalty: false,
    context: "regular-play",
    provider: "opta",
    providerEventId: "75",
  },
  {
    kind: "shot" as const,
    id: "2",
    matchId: "m1",
    teamId: "t1",
    playerId: "p2",
    playerName: "Walker",
    minute: 17,
    addedMinute: null,
    second: 0,
    period: 1,
    x: 93.6,
    y: 64.7,
    xg: 0.31,
    outcome: "goal",
    bodyPart: "right-foot",
    isOwnGoal: false,
    isPenalty: false,
    context: "regular-play",
    provider: "opta",
    providerEventId: "203",
  },
];

const noXgShots: ComputeShotMapInput["shots"] = shots.map((s) => ({
  ...s,
  xg: null,
}));

const headShot: ComputeShotMapInput["shots"] = [
  {
    ...shots[0]!,
    id: "head-1",
    bodyPart: "head",
    outcome: "goal",
  },
];

const otherBodyPartShot: ComputeShotMapInput["shots"] = [
  {
    ...shots[0]!,
    id: "other-1",
    bodyPart: "other",
    outcome: "saved",
  },
];

// ─── Rendering ──────────────────────────────────────────────────────

describe("<ShotMap /> — rendering", () => {
  it("renders the zero-config shell without header stats; legend and xG scale remain", () => {
    const { getByLabelText, getByText, queryByText, getAllByText } = render(
      <ShotMap shots={shots} />,
    );

    const shell = getByLabelText("Shot map: 2 shots, 1 goals");

    expect(shell).toBeInTheDocument();
    expect(shell).toHaveAttribute("data-chart-kind", "shot-map");
    expect(shell).toHaveAttribute("data-slot", "frame");
    expect(queryByText("Shots")).not.toBeInTheDocument();
    expect(queryByText("Goals")).not.toBeInTheDocument();
    expect(getAllByText("xG").length).toBeGreaterThan(0);
    // Legend shows filled (Goal) vs hollow (Shot)
    expect(getByText("Goal")).toBeInTheDocument();
    expect(getByText("Shot")).toBeInTheDocument();
  });

  it("can show header stats for summary-first layouts", () => {
    const { getByText } = render(
      <ShotMap shots={shots} {...shotMapRecipes.summaryFirst.props} />,
    );

    expect(getByText("Shots")).toBeInTheDocument();
    expect(getByText("Goals")).toBeInTheDocument();
  });

  it("can hide size scale and legend for small-multiples usage", () => {
    const { queryByText } = render(
      <ShotMap shots={shots} {...shotMapRecipes.smallMultiples.props} />,
    );

    expect(queryByText("Goal")).not.toBeInTheDocument();
    expect(queryByText("Shot")).not.toBeInTheDocument();
    expect(queryByText("xG")).not.toBeInTheDocument();
  });

  it("can hide the statsbomb color bar for compact recipe-driven tiles", () => {
    const { queryByTestId } = render(
      <ShotMap
        shots={shots}
        {...mergeChartRecipeProps(
          shotMapRecipes.statsbomb,
          shotMapRecipes.smallMultiples,
        )}
      />,
    );

    expect(queryByTestId("shotmap-scale-bar")).not.toBeInTheDocument();
  });

  it("supports full horizontal pitch framing for analyst-style dense grids", () => {
    const { container } = render(
      <ShotMap
        shots={shots}
        crop="full"
        attackingDirection="right"
        showSizeScale={false}
        showLegend={false}
      />,
    );

    expect(container.querySelector('svg[viewBox="0 0 105 68"]')).not.toBeNull();
  });

  it("renders the empty state when there are no shots", () => {
    const { getByText, queryByTestId } = render(<ShotMap shots={[]} />);

    const emptyState = getByText("No shot data");
    const shell = emptyState.closest('[data-slot="frame"]');

    expect(emptyState).toBeInTheDocument();
    expect(shell).toHaveAttribute("data-empty", "true");
    expect(emptyState.closest('[data-slot="empty-state"]')).not.toBeNull();
    expect(queryByTestId("shotmap-tooltip")).not.toBeInTheDocument();
  });

  it("renders one marker per plottable shot", () => {
    const { container } = render(<ShotMap shots={shots} />);

    const markers = within(container).getAllByRole("button");
    expect(markers).toHaveLength(2);
  });

  it("omits the scale bar and xG stat in outcome-fallback mode", () => {
    const { queryByText } = render(<ShotMap shots={noXgShots} />);

    expect(queryByText("Shots")).not.toBeInTheDocument();
    expect(queryByText("Goals")).not.toBeInTheDocument();
    // No size scale when xG is absent — header has no xG stat
    expect(queryByText("xG")).not.toBeInTheDocument();
  });

  it("draws trajectory lines from shot origin to endX/endY when present", () => {
    const withTrajectory: ComputeShotMapInput["shots"] = [
      {
        ...shots[0]!,
        id: "t1",
        x: 70,
        y: 45,
        endX: 92,
        endY: 48,
      },
    ];
    const { container } = render(<ShotMap shots={withTrajectory} />);

    const lines = container.querySelectorAll('[data-testid="shotmap-trajectories"] line');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveAttribute("x1");
    expect(lines[0]).toHaveAttribute("x2");
  });

  it("hides trajectory lines when showShotTrajectory is false", () => {
    const withTrajectory: ComputeShotMapInput["shots"] = [
      {
        ...shots[0]!,
        id: "t2",
        x: 70,
        y: 45,
        endX: 92,
        endY: 48,
      },
    ];
    const { container } = render(
      <ShotMap shots={withTrajectory} showShotTrajectory={false} />,
    );

    expect(
      container.querySelectorAll('[data-testid="shotmap-trajectories"] line'),
    ).toHaveLength(0);
  });

  it("applies constant trajectory styling through trajectories", () => {
    const withTrajectory: ComputeShotMapInput["shots"] = [
      {
        ...shots[0]!,
        id: "t-style",
        x: 70,
        y: 45,
        endX: 92,
        endY: 48,
      },
    ];
    const { container } = render(
      <ShotMap
        shots={withTrajectory}
        trajectories={{
          stroke: "#ff00aa",
          strokeWidth: 0.9,
          opacity: 0.5,
          strokeDasharray: "2 3",
          strokeLinecap: "butt",
        }}
      />,
    );

    const line = container.querySelector('[data-testid="shotmap-trajectories"] line');
    expect(line).not.toBeNull();
    expect(line).toHaveAttribute("stroke", "#ff00aa");
    expect(line).toHaveAttribute("stroke-width", "0.9");
    expect(line).toHaveAttribute("opacity", "0.5");
    expect(line).toHaveAttribute("stroke-dasharray", "2 3");
    expect(line).toHaveAttribute("stroke-linecap", "butt");
  });

  it("supports object-map style shorthands for trajectories and markers", () => {
    const withTrajectory: ComputeShotMapInput["shots"] = [
      {
        ...shots[0]!,
        id: "t-map-1",
        outcome: "goal",
        bodyPart: "head",
        endX: 92,
        endY: 48,
      },
      {
        ...shots[1]!,
        id: "t-map-2",
        outcome: "blocked",
        bodyPart: "other",
        endX: 96,
        endY: 52,
      },
    ];
    const { container } = render(
      <ShotMap
        shots={withTrajectory}
        markers={{
          shape: {
            by: ({ shot }) => shot.bodyPart ?? "other",
            values: {
              head: "triangle",
              other: "square",
            },
            fallback: "circle",
          },
        }}
        trajectories={{
          stroke: {
            by: ({ shot }) => shot.outcome,
            values: {
              goal: "#ff0000",
              blocked: "#0000ff",
            },
          },
          strokeDasharray: {
            by: ({ shot }) => shot.outcome,
            values: {
              blocked: "4 3",
            },
          },
        }}
      />,
    );

    const lines = Array.from(
      container.querySelectorAll('[data-testid="shotmap-trajectories"] line'),
    );
    expect(lines).toHaveLength(2);
    expect(lines.some((line) => line.getAttribute("stroke") === "#ff0000")).toBe(true);
    expect(lines.some((line) => line.getAttribute("stroke") === "#0000ff")).toBe(true);
    expect(lines.some((line) => line.getAttribute("stroke-dasharray") === "4 3")).toBe(
      true,
    );

    expect(container.querySelector('g[role="button"] polygon')).not.toBeNull();
    expect(container.querySelector('g[role="button"] rect')).not.toBeNull();
  });

  it("supports callback-driven trajectory and marker styling", () => {
    const withTrajectory: ComputeShotMapInput["shots"] = [
      {
        ...shots[0]!,
        id: "t-callback-1",
        endX: 92,
        endY: 48,
      },
      {
        ...shots[1]!,
        id: "t-callback-2",
        endX: 96,
        endY: 52,
      },
    ];
    const { container } = render(
      <ShotMap
        shots={withTrajectory}
        markers={{
          fill: ({ shot }) => (shot.outcome === "off-target" ? "#123456" : undefined),
          fillOpacity: ({ shot }) => (shot.outcome === "off-target" ? 1 : undefined),
        }}
        trajectories={{
          stroke: ({ shot }) => (shot.outcome === "goal" ? "#ff0000" : "#0000ff"),
          strokeDasharray: ({ shot }) =>
            shot.outcome === "off-target" ? "4 3" : undefined,
        }}
      />,
    );

    const lines = Array.from(
      container.querySelectorAll('[data-testid="shotmap-trajectories"] line'),
    );
    expect(lines).toHaveLength(2);
    expect(lines.some((line) => line.getAttribute("stroke") === "#ff0000")).toBe(true);
    expect(lines.some((line) => line.getAttribute("stroke") === "#0000ff")).toBe(true);
    expect(lines.some((line) => line.getAttribute("stroke-dasharray") === "4 3")).toBe(
      true,
    );

    const firstMarker = container.querySelector('g[role="button"] circle');
    expect(firstMarker).not.toBeNull();
    expect(firstMarker).toHaveAttribute("fill", "#123456");
    expect(firstMarker).toHaveAttribute("fill-opacity", "1");
  });

  it("exposes sharedScale to callback-driven marker styling", () => {
    const { container } = render(
      <ShotMap
        shots={shots}
        sharedScale={{ sizeDomain: [0, 0.5] }}
        markers={{
          stroke: ({ sharedScale }) =>
            sharedScale?.sizeDomain?.[1] === 0.5 ? "#ff0000" : "#0000ff",
        }}
      />,
    );

    const marker = container.querySelector('g[role="button"] circle');
    expect(marker).not.toBeNull();
    expect(marker).toHaveAttribute("stroke", "#ff0000");
  });

  it("renders all circles in opta preset (default)", () => {
    const { container } = render(<ShotMap shots={[...shots, ...headShot]} />);

    // Opta preset: all markers are circles regardless of bodyPart
    const markerCircles = container.querySelectorAll('g[role="button"] circle');
    expect(markerCircles.length).toBe(3); // 2 foot + 1 head, all circles
  });

  it("renders different shapes in statsbomb preset", () => {
    const { container } = render(
      <ShotMap shots={[...shots, ...headShot]} {...shotMapRecipes.statsbomb.props} />,
    );

    // StatsBomb preset: hexagons for foot, circles for head
    const markerCircles = container.querySelectorAll('g[role="button"] circle');
    const markerPolygons = container.querySelectorAll('g[role="button"] polygon');
    expect(markerCircles.length).toBeGreaterThanOrEqual(1); // head shot
    expect(markerPolygons.length).toBeGreaterThanOrEqual(2); // foot shots → hexagons
  });

  it("keeps hollow non-goal markers visible on dark pitch themes", () => {
    const { container } = render(<ShotMap shots={shots} pitchTheme="secondary" />);

    const markers = within(container).getAllByRole("button");
    const hollowShot = markers[0]!.querySelector("circle");
    expect(hollowShot).not.toBeNull();
    expect(hollowShot).toHaveAttribute("stroke", "rgba(255,255,255,0.7)");
  });

  it("maps bodyPart='other' to a distinct statsbomb marker shape", () => {
    const { container } = render(
      <ShotMap shots={otherBodyPartShot} {...shotMapRecipes.statsbomb.props} />,
    );

    const polygon = container.querySelector('g[role="button"] polygon');
    expect(polygon).not.toBeNull();
    const points = polygon!.getAttribute("points")!.trim().split(/\s+/);
    expect(points).toHaveLength(4);
  });

  it("can compose provider and layout recipes without prop sprawl", () => {
    const { container, getByText } = render(
      <ShotMap
        shots={[...shots, ...headShot]}
        {...mergeChartRecipeProps(shotMapRecipes.statsbomb, shotMapRecipes.summaryFirst)}
      />,
    );

    expect(getByText("Shots")).toBeInTheDocument();
    expect(getByText("Goals")).toBeInTheDocument();
    expect(container.querySelectorAll('g[role="button"] polygon').length).toBeGreaterThan(
      0,
    );
  });
});

// ─── Interaction ────────────────────────────────────────────────────

describe("<ShotMap /> — interaction", () => {
  it("shows tooltip content when a marker is focused", () => {
    const { getAllByRole, getByText, getByTestId } = render(<ShotMap shots={shots} />);

    const marker = getAllByRole("button", {
      name: /Player: Eriksen/,
    })[0] as HTMLElement;
    fireEvent.focus(marker);

    expect(getByText("Eriksen")).toBeInTheDocument();
    expect(getByText("4'")).toBeInTheDocument();
    // "Off target" appears in both legend and tooltip — verify tooltip is present
    expect(getByTestId("shotmap-tooltip")).toBeInTheDocument();
  });

  it("dismisses tooltip on blur", () => {
    const { getAllByRole, getByTestId, queryByTestId } = render(
      <ShotMap shots={shots} />,
    );

    const marker = getAllByRole("button", {
      name: /Player: Eriksen/,
    })[0] as HTMLElement;
    fireEvent.focus(marker);
    expect(getByTestId("shotmap-tooltip")).toBeInTheDocument();

    fireEvent.blur(marker);
    expect(queryByTestId("shotmap-tooltip")).not.toBeInTheDocument();
  });

  it("keeps the hover tooltip non-interactive so marker hover does not flicker", () => {
    const { getAllByRole, getByText, getByTestId } = render(<ShotMap shots={shots} />);

    const marker = getAllByRole("button", {
      name: /Player: Eriksen/,
    })[0] as HTMLElement;
    fireEvent.mouseEnter(marker);

    expect(getByText("Eriksen")).toBeInTheDocument();
    expect(getByTestId("shotmap-tooltip")).toHaveStyle({
      pointerEvents: "none",
    });
  });

  it("toggles tooltip on click (tap-friendly)", () => {
    const { getAllByRole, getByTestId, queryByTestId } = render(
      <ShotMap shots={shots} />,
    );

    const marker = getAllByRole("button", {
      name: /Player: Eriksen/,
    })[0] as HTMLElement;

    // First click shows tooltip
    fireEvent.click(marker);
    expect(getByTestId("shotmap-tooltip")).toBeInTheDocument();

    // Second click dismisses
    fireEvent.click(marker);
    expect(queryByTestId("shotmap-tooltip")).not.toBeInTheDocument();
  });

  it("switches tooltip when hovering from one marker to another", () => {
    const { getAllByRole, getByText, queryByText } = render(<ShotMap shots={shots} />);

    const markers = getAllByRole("button");
    fireEvent.mouseEnter(markers[0] as HTMLElement);
    expect(getByText("Eriksen")).toBeInTheDocument();

    fireEvent.mouseLeave(markers[0] as HTMLElement);
    fireEvent.mouseEnter(markers[1] as HTMLElement);
    expect(getByText("Walker")).toBeInTheDocument();
    expect(queryByText("Eriksen")).not.toBeInTheDocument();
  });
});

// ─── Prop updates ───────────────────────────────────────────────────

describe("<ShotMap /> — prop updates", () => {
  it("updates to the empty state when parent props swap to a different shot set", async () => {
    function TestHarness() {
      const [currentShots, setCurrentShots] = useState(shots);

      return (
        <>
          <button
            type="button"
            onClick={() => {
              setCurrentShots([]);
            }}
          >
            Clear shots
          </button>
          <ShotMap shots={currentShots} />
        </>
      );
    }

    const view = render(<TestHarness />);

    fireEvent.click(view.getByRole("button", { name: "Clear shots" }));

    await waitFor(() => {
      expect(view.getAllByText("No shot data").length).toBeGreaterThan(0);
    });
  });

  it("clears active tooltip when shots change", async () => {
    function TestHarness() {
      const [currentShots, setCurrentShots] = useState(shots);

      return (
        <>
          <button
            type="button"
            onClick={() => {
              setCurrentShots(noXgShots);
            }}
          >
            Swap shots
          </button>
          <ShotMap shots={currentShots} />
        </>
      );
    }

    const view = render(<TestHarness />);

    // Activate tooltip
    const marker = view.getAllByRole("button", {
      name: /Player: Eriksen/,
    })[0] as HTMLElement;
    fireEvent.focus(marker);
    expect(view.getByTestId("shotmap-tooltip")).toBeInTheDocument();

    // Swap shots — tooltip should reset
    fireEvent.click(view.getByRole("button", { name: "Swap shots" }));

    await waitFor(() => {
      expect(view.queryByTestId("shotmap-tooltip")).not.toBeInTheDocument();
    });
  });
});

// ─── Theme context ──────────────────────────────────────────────────

describe("<ShotMap /> — theme context", () => {
  it("uses dark theme colors when wrapped in ThemeProvider", () => {
    const { getByLabelText, getAllByRole, getByTestId } = render(
      <ThemeProvider value={DARK_THEME}>
        <ShotMap shots={shots} />
      </ThemeProvider>,
    );

    expect(getByLabelText("Shot map: 2 shots, 1 goals")).toBeInTheDocument();

    const marker = getAllByRole("button", {
      name: /Player: Eriksen/,
    })[0] as HTMLElement;
    fireEvent.focus(marker);

    const tooltip = getByTestId("shotmap-tooltip");
    expect(tooltip).toHaveStyle({
      background: DARK_THEME.surface.tooltip,
    });
  });
});

// ─── Accessibility ──────────────────────────────────────────────────

describe("<ShotMap /> — accessibility", () => {
  it("has no axe violations with shot data", async () => {
    const { container } = render(<ShotMap shots={shots} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations in empty state", async () => {
    const { container } = render(<ShotMap shots={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("markers have accessible labels with shot details", () => {
    const { getAllByRole } = render(<ShotMap shots={shots} />);

    const markers = getAllByRole("button");
    markers.forEach((marker) => {
      expect(marker).toHaveAttribute("aria-label");
      expect(marker.getAttribute("aria-label")).toMatch(/Player:/);
    });
  });

  it("container has an accessible label describing the chart", () => {
    const { container } = render(<ShotMap shots={shots} />);

    const section = container.querySelector("[aria-label]");
    expect(section).not.toBeNull();
    expect(section!.getAttribute("aria-label")).toMatch(/Shot map: \d+ shots, \d+ goals/);
  });
});

describe("<ShotMapStaticSvg /> — empty state regression", () => {
  it("renders the 'No shot data' label inside the static SVG with positive font-size", () => {
    const { container } = render(<ShotMapStaticSvg shots={[]} />);

    const text = container.querySelector("text");
    expect(text).not.toBeNull();
    expect(text!.textContent).toBe("No shot data");
    const fontSize = Number.parseFloat(text!.getAttribute("font-size") ?? "0");
    expect(Number.isFinite(fontSize)).toBe(true);
    expect(fontSize).toBeGreaterThan(0);
  });
});
