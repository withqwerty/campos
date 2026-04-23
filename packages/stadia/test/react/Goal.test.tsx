import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Goal } from "../../src/react/Goal.js";
import { GOAL } from "../../src/geometry/constants.js";

function requirePoint(point: { x: number; y: number } | null) {
  expect(point).not.toBeNull();
  if (!point) {
    throw new Error("Expected projected goal point");
  }
  return point;
}

describe("<Goal>", () => {
  it("renders an SVG with goal-sized viewBox", () => {
    const { container } = render(<Goal facing="striker">{() => null}</Goal>);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const vb = svg?.getAttribute("viewBox");
    expect(vb).toContain("7.32");
    expect(vb).toContain("2.44");
  });

  it("applies standalone SVG accessibility attributes", () => {
    const { container } = render(
      <Goal facing="striker" role="img" ariaLabel="Goal-mouth shot placement">
        {() => null}
      </Goal>,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("Goal-mouth shot placement");
  });

  it("provides a working project function mapping (50, 50) to the playfield centre", () => {
    let point: { x: number; y: number } | null = null;
    render(
      <Goal facing="striker" barThickness={0.18}>
        {({ project }) => {
          point = project(50, 50);
          return null;
        }}
      </Goal>,
    );
    const projected = requirePoint(point);
    // Horizontal centre is unchanged (inset is symmetric). Vertical centre
    // shifts down by half the crossbar inset because the bottom of the goal
    // is open (no ground bar) — the playfield is [barThickness, GOAL.depth].
    expect(projected.x).toBeCloseTo(GOAL.width / 2);
    expect(projected.y).toBeCloseTo(GOAL.depth / 2 + 0.18 / 2);
  });

  it("striker facing: (0, 0) lands on the inside edge of the left post at ground", () => {
    let point: { x: number; y: number } | null = null;
    render(
      <Goal facing="striker" barThickness={0.18}>
        {({ project }) => {
          point = project(0, 0);
          return null;
        }}
      </Goal>,
    );
    const projected = requirePoint(point);
    // With the playfield-aware projection, goal-mouth (0, 0) projects into
    // the inside-bottom-left corner — offset by the full bar thickness so
    // markers don't straddle the post stroke.
    expect(projected.x).toBeCloseTo(0.18);
    expect(projected.y).toBeCloseTo(GOAL.depth);
  });

  it("goalkeeper facing mirrors horizontally", () => {
    let strikerPoint: { x: number; y: number } | null = null;
    let keeperPoint: { x: number; y: number } | null = null;

    render(
      <Goal facing="striker" barThickness={0.18}>
        {({ project }) => {
          strikerPoint = project(0, 50);
          return null;
        }}
      </Goal>,
    );

    render(
      <Goal facing="goalkeeper" barThickness={0.18}>
        {({ project }) => {
          keeperPoint = project(0, 50);
          return null;
        }}
      </Goal>,
    );

    // Striker: left post inside edge. Goalkeeper: mirror → right post inside edge.
    expect(requirePoint(strikerPoint).x).toBeCloseTo(0.18);
    expect(requirePoint(keeperPoint).x).toBeCloseTo(GOAL.width - 0.18);
  });

  it("renders goal frame elements", () => {
    const { container } = render(<Goal facing="striker">{() => null}</Goal>);
    const lines = container.querySelectorAll("line");
    expect(lines.length).toBeGreaterThan(0);
  });

  it("supports an empty goal without net lines", () => {
    const { container } = render(
      <Goal facing="striker" netStyle="none">
        {() => null}
      </Goal>,
    );
    const goalFrame = container.querySelector("[data-stadia='goal-frame']");
    const frameLines = goalFrame?.querySelectorAll("line") ?? [];
    const framePath = goalFrame?.querySelector("path");
    expect(frameLines).toHaveLength(1);
    expect(framePath).not.toBeNull();
  });

  it("supports custom net density", () => {
    const { container } = render(
      <Goal facing="striker" netShape="flat" netColumns={3} netRows={2}>
        {() => null}
      </Goal>,
    );
    const goalFrame = container.querySelector("[data-stadia='goal-frame']");
    const frameLines = goalFrame?.querySelectorAll("line") ?? [];
    expect(frameLines).toHaveLength(6);
  });

  it("spaces flat-net verticals uniformly across the playfield", () => {
    const { container } = render(
      <Goal
        facing="striker"
        netShape="flat"
        netColumns={5}
        netRows={0}
        barThickness={0.3}
      >
        {() => null}
      </Goal>,
    );
    const netGroup = container.querySelector(
      "[data-stadia='goal-frame'] > g[stroke-opacity]",
    );
    const verticals = Array.from(netGroup?.querySelectorAll("line") ?? [])
      // Filter to true vertical lines: x1 === x2
      .filter((line) => line.getAttribute("x1") === line.getAttribute("x2"))
      .map((line) => Number(line.getAttribute("x1")))
      .sort((a, b) => a - b);
    expect(verticals).toHaveLength(5);

    const leftPostX = 0.3 / 2;
    const rightPostX = GOAL.width - 0.3 / 2;
    const expectedStep = (rightPostX - leftPostX) / 6;
    // Check even step between adjacent interior verticals AND between the
    // outermost verticals and the posts — this is the regression that
    // previously failed because the math used GOAL.width instead of the
    // post-to-post range.
    const gaps = [
      verticals[0]! - leftPostX,
      ...verticals.slice(1).map((x, i) => x - verticals[i]!),
      rightPostX - verticals[verticals.length - 1]!,
    ];
    for (const gap of gaps) {
      expect(gap).toBeCloseTo(expectedStep, 6);
    }
  });

  it("closes the back-wall outline so the bottom edge is drawn", () => {
    const { container } = render(
      <Goal facing="striker" netShape="box" netColumns={3} netRows={2}>
        {() => null}
      </Goal>,
    );
    const boxNet = container.querySelector("[data-stadia='goal-net-shape-box']");
    const backOutline = Array.from(boxNet?.querySelectorAll("path") ?? []).find((p) =>
      p.getAttribute("d")?.startsWith("M "),
    );
    // Closed rectangle: four L segments plus a Z (or repeat of the start point)
    const d = backOutline?.getAttribute("d") ?? "";
    expect(d).toMatch(/Z\s*$/);
  });

  it("supports custom bar thickness", () => {
    const { container } = render(
      <Goal facing="striker" barThickness={0.2}>
        {() => null}
      </Goal>,
    );
    const framePath = container.querySelector("[data-stadia='goal-frame'] path[stroke]");
    expect(Number(framePath?.getAttribute("stroke-width"))).toBeCloseTo(0.2, 5);
  });

  it("supports recessed box-net geometry", () => {
    const { container } = render(
      <Goal
        facing="striker"
        netShape="box"
        netColumns={3}
        netRows={2}
        netBackInset={0.8}
        netBackOffsetTop={0.34}
        netBackOffsetBottom={0.42}
      >
        {() => null}
      </Goal>,
    );
    const boxNet = container.querySelector("[data-stadia='goal-net-shape-box']");
    expect(boxNet).not.toBeNull();
    expect(boxNet?.querySelectorAll("path, line").length).toBeGreaterThan(10);
  });

  it("does not couple net and ground thickness to bar thickness", () => {
    const { container } = render(
      <Goal facing="striker" barThickness={0.2}>
        {() => null}
      </Goal>,
    );
    const goalFrame = container.querySelector("[data-stadia='goal-frame']");
    const netGroup = goalFrame?.querySelector("g[stroke-opacity]");

    // Ground line extends `GOAL_PROJECT_GROUND_EXTENSION = GOAL.width * 0.35`
    // beyond each post (see packages/stadia/src/react/Goal.tsx:24). Rather
    // than matching the exact serialized string `-2.562`, find the line
    // whose `x1` is within tolerance of the computed extension. Ties the
    // test to the exported `GOAL` geometry, not the magic-number output.
    const expectedX1 = -GOAL.width * 0.35;
    const groundLine = Array.from(goalFrame?.querySelectorAll("line") ?? []).find(
      (line) => {
        const x1 = Number(line.getAttribute("x1"));
        return Number.isFinite(x1) && Math.abs(x1 - expectedX1) < 1e-3;
      },
    );
    expect(groundLine).toBeDefined();

    // Net thickness is `GOAL_PROJECT_NET_THICKNESS = GOAL.depth * 0.012`
    // and ground thickness is `GOAL_PROJECT_GROUND_THICKNESS = GOAL.depth * 0.016`
    // (both defined in Goal.tsx, both independent of barThickness).
    expect(Number(netGroup?.getAttribute("stroke-width"))).toBeCloseTo(
      GOAL.depth * 0.012,
      5,
    );
    expect(Number(groundLine?.getAttribute("stroke-width"))).toBeCloseTo(
      GOAL.depth * 0.016,
      5,
    );
  });

  it("renders children on top", () => {
    const { container } = render(
      <Goal facing="striker">
        {({ project }) => {
          const p = project(50, 50);
          return <circle data-testid="shot" cx={p.x} cy={p.y} r={0.1} />;
        }}
      </Goal>,
    );
    expect(container.querySelector("[data-testid='shot']")).not.toBeNull();
  });
});
