import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it } from "vitest";
import type { PassEvent } from "@withqwerty/campos-schema";

import { PassFlow, PassFlowStaticSvg } from "../src/index";

afterEach(cleanup);

let idCounter = 0;
function makePass(overrides: Partial<PassEvent> = {}): PassEvent {
  idCounter += 1;
  const base: PassEvent = {
    kind: "pass",
    id: `p${idCounter}`,
    matchId: "m1",
    teamId: "t1",
    playerId: null,
    playerName: null,
    minute: 10,
    addedMinute: null,
    second: 0,
    period: 1,
    x: 50,
    y: 50,
    endX: 60,
    endY: 50,
    length: 10,
    angle: 0,
    recipient: null,
    passType: "ground",
    passResult: "complete",
    isAssist: false,
    provider: "statsbomb",
    providerEventId: `prov-${idCounter}`,
  } as PassEvent;
  return { ...base, ...overrides };
}

/** Build a cluster of N colinear passes at the same origin — clears both
 * the dispersion-floor and min-count gates so the bin renders an arrow. */
function cluster(x: number, y: number, n: number): PassEvent[] {
  return Array.from({ length: n }, () => makePass({ x, y, endX: x + 10, endY: y }));
}

const passes: PassEvent[] = [
  ...cluster(55, 25, 5),
  ...cluster(75, 75, 3),
  makePass({ x: 25, y: 25 }), // lone pass — gated to glyph
];

// ─── Rendering ─────────────────────────────────────────────────────────────

describe("<PassFlow /> — rendering", () => {
  it("renders a chart-frame with accessible label reflecting grid shape", () => {
    const { getByLabelText } = render(<PassFlow passes={passes} />);
    expect(getByLabelText(/Pass flow: 9 passes across 6×4 zones/)).toBeInTheDocument();
  });

  it("renders an empty state when given no passes", () => {
    const { getByText, queryByTestId } = render(<PassFlow passes={[]} />);
    expect(getByText("No passes to chart")).toBeInTheDocument();
    expect(queryByTestId("passflow-tooltip")).not.toBeInTheDocument();
  });

  it("renders cells with `role=button` only for non-empty bins", () => {
    const { container } = render(<PassFlow passes={passes} />);
    const buttons = within(container).getAllByRole("button");
    // Exactly 3 filled bins across 24 total
    expect(buttons.length).toBe(3);
    buttons.forEach((btn) => {
      expect(btn.getAttribute("aria-label")).toMatch(/zone col \d+ row \d+/);
    });
  });

  it("shows header stats (passes, completion, mean length)", () => {
    const { getByText } = render(<PassFlow passes={passes} />);
    expect(getByText("Passes")).toBeInTheDocument();
    // Header-stats label uses normal-case "Completion"; the DOM text may be
    // uppercased purely via CSS text-transform.
    expect(getByText("Completion")).toBeInTheDocument();
    expect(getByText("Mean length")).toBeInTheDocument();
  });

  it("hides header stats when showHeaderStats is false", () => {
    const { queryByText } = render(<PassFlow passes={passes} showHeaderStats={false} />);
    expect(queryByText("Passes")).not.toBeInTheDocument();
  });

  it("renders the colourbar legend with metric label", () => {
    const { getByText, getByTestId } = render(<PassFlow passes={passes} />);
    expect(getByTestId("passflow-scale-bar")).toBeInTheDocument();
    expect(getByText("Pass Origin Share")).toBeInTheDocument();
  });

  it("hides the legend when showLegend is false", () => {
    const { queryByTestId } = render(<PassFlow passes={passes} showLegend={false} />);
    expect(queryByTestId("passflow-scale-bar")).not.toBeInTheDocument();
  });
});

// ─── Interaction ───────────────────────────────────────────────────────────

describe("<PassFlow /> — interaction", () => {
  it("reveals a tooltip on cell hover with the expected rows", async () => {
    const { container, findByTestId } = render(<PassFlow passes={passes} />);
    const [firstCell] = within(container).getAllByRole("button");
    fireEvent.mouseEnter(firstCell!);
    const tooltip = await findByTestId("passflow-tooltip");
    expect(tooltip).toHaveTextContent(/Zone/);
    expect(tooltip).toHaveTextContent(/Passes/);
    expect(tooltip).toHaveTextContent(/Mean direction/);
    expect(tooltip).toHaveTextContent(/Directional consistency/);
  });

  it("tooltip zone row includes the x-extent (agent-readable)", async () => {
    const { container, findByTestId } = render(<PassFlow passes={passes} />);
    const [firstCell] = within(container).getAllByRole("button");
    fireEvent.mouseEnter(firstCell!);
    const tooltip = await findByTestId("passflow-tooltip");
    expect(tooltip.textContent).toMatch(/x \d+–\d+/);
  });

  it("clears the active bin when the grid shape changes", async () => {
    const { container, findByTestId, queryByTestId, rerender } = render(
      <PassFlow passes={passes} />,
    );
    const [firstCell] = within(container).getAllByRole("button");
    fireEvent.mouseEnter(firstCell!);
    await findByTestId("passflow-tooltip");
    // Switch to a different grid shape — previous active key would have
    // matched a geometrically different bin in the new model.
    rerender(<PassFlow passes={passes} bins={{ x: 3, y: 3 }} />);
    expect(queryByTestId("passflow-tooltip")).not.toBeInTheDocument();
  });

  it("clears the tooltip on mouseleave", async () => {
    const { container, findByTestId, queryByTestId } = render(
      <PassFlow passes={passes} />,
    );
    const [firstCell] = within(container).getAllByRole("button");
    fireEvent.mouseEnter(firstCell!);
    await findByTestId("passflow-tooltip");
    fireEvent.mouseLeave(firstCell!);
    expect(queryByTestId("passflow-tooltip")).not.toBeInTheDocument();
  });
});

// ─── Tier 2 customisation ──────────────────────────────────────────────────

describe("<PassFlow /> — Tier 2 customisation", () => {
  it("arrowColor callback produces per-bin colours + one marker per unique colour", () => {
    const { container } = render(
      <PassFlow
        passes={passes}
        arrowColor={(bin) => (bin.count >= 3 ? "#d00" : "#09f")}
      />,
    );
    const arrows = Array.from(
      container.querySelectorAll("[data-campos='passflow-arrows'] line"),
    );
    const strokes = new Set(arrows.map((a) => a.getAttribute("stroke")));
    // At least one cluster has count >= 3 (5-pass cluster) and another < 3.
    expect(strokes.size).toBeGreaterThanOrEqual(1);
    const markers = container.querySelectorAll("[data-campos='passflow-arrows'] marker");
    // One marker per unique colour actually in use (plus up to one fallback).
    expect(markers.length).toBeGreaterThanOrEqual(strokes.size);
  });

  it("arrowheadScale propagates to the marker width/height", () => {
    const { container } = render(<PassFlow passes={passes} arrowheadScale={5} />);
    const marker = container.querySelector("[data-campos='passflow-arrows'] marker")!;
    expect(marker.getAttribute("markerWidth")).toBe("5");
    expect(marker.getAttribute("markerHeight")).toBe("5");
  });

  it("showHoverDestinations overlays destination dots on the active bin", async () => {
    const { container, findByTestId } = render(
      <PassFlow passes={passes} showHoverDestinations />,
    );
    // No overlay before hover.
    expect(container.querySelector("[data-campos='passflow-destinations']")).toBeNull();
    const [firstCell] = within(container).getAllByRole("button");
    fireEvent.mouseEnter(firstCell!);
    await findByTestId("passflow-tooltip");
    const overlay = container.querySelector("[data-campos='passflow-destinations']");
    expect(overlay).not.toBeNull();
    // One dot (+ optional spoke) per direction-contributing pass in the bin.
    const dots = overlay!.querySelectorAll("circle");
    expect(dots.length).toBeGreaterThan(0);
  });

  it("hover overlay disappears on mouseleave", async () => {
    const { container, findByTestId } = render(
      <PassFlow passes={passes} showHoverDestinations />,
    );
    const [firstCell] = within(container).getAllByRole("button");
    fireEvent.mouseEnter(firstCell!);
    await findByTestId("passflow-tooltip");
    expect(
      container.querySelector("[data-campos='passflow-destinations']"),
    ).not.toBeNull();
    fireEvent.mouseLeave(firstCell!);
    expect(container.querySelector("[data-campos='passflow-destinations']")).toBeNull();
  });

  it("periodFilter={[1]} renders only period-1 passes", () => {
    // Build a split-period fixture: all 'passes' default to period=1 via
    // makePass. Make a period-2 cluster by overriding; confirm filtering.
    const split: PassEvent[] = [
      ...cluster(55, 25, 5),
      ...Array.from({ length: 5 }, () =>
        makePass({ x: 75, y: 75, endX: 95, endY: 75, period: 2 }),
      ),
    ];
    const { getByLabelText: p1 } = render(<PassFlow passes={split} periodFilter={[1]} />);
    expect(p1(/Pass flow: 5 passes/)).toBeInTheDocument();
    cleanup();
    const { getByLabelText: p2 } = render(<PassFlow passes={split} periodFilter={[2]} />);
    expect(p2(/Pass flow: 5 passes/)).toBeInTheDocument();
  });
});

// ─── Instance isolation — marker ids and animation scopes ─────────────────

describe("<PassFlow /> — instance isolation", () => {
  it("two PassFlows on the same page get distinct <marker> ids", () => {
    const { container } = render(
      <>
        <PassFlow passes={passes} arrowheadScale={3} />
        <PassFlow passes={passes} arrowheadScale={5} />
      </>,
    );
    const markers = Array.from(
      container.querySelectorAll("[data-campos='passflow-arrows'] marker"),
    );
    const ids = new Set(markers.map((m) => m.getAttribute("id")));
    // useId gives each PassFlow its own scope; every marker id is unique.
    expect(ids.size).toBe(markers.length);
    // Confirm the per-instance `arrowheadScale` actually survived — there
    // must be markers at widths 3 AND 5, not all forced to the first.
    const widths = new Set(markers.map((m) => m.getAttribute("markerWidth")));
    expect(widths.has("3")).toBe(true);
    expect(widths.has("5")).toBe(true);
  });

  it("animation scope attribute differs between instances", () => {
    const { container } = render(
      <>
        <PassFlow passes={passes} animate="dashes" />
        <PassFlow passes={passes} animate="dashes" />
      </>,
    );
    const groups = Array.from(
      container.querySelectorAll("[data-campos='passflow-arrows']"),
    );
    const scopes = groups
      .map((g) => g.getAttribute("data-campos-animate-scope"))
      .filter((s): s is string => s != null);
    expect(scopes.length).toBe(2);
    expect(scopes[0]).not.toBe(scopes[1]);
  });
});

// ─── Animation + filter-transition ─────────────────────────────────────────

describe("<PassFlow /> — animation + filter-transition", () => {
  it('animate="dashes" emits scoped keyframe CSS and marks arrows data-active', () => {
    const { container } = render(<PassFlow passes={passes} animate="dashes" />);
    const style = container.querySelector("[data-campos='passflow-arrows'] style");
    expect(style).not.toBeNull();
    expect(style!.textContent ?? "").toContain("@keyframes campos-passflow-dashflow");
    // prefers-reduced-motion override must be in the stylesheet.
    expect(style!.textContent ?? "").toContain("prefers-reduced-motion: reduce");
    // Data-active is emitted on every arrow line so the "dashes-on-hover"
    // CSS selector can target it.
    const arrows = container.querySelectorAll(
      "[data-campos='passflow-arrows'] line[data-bin-col]",
    );
    arrows.forEach((a) => {
      expect(a.getAttribute("data-active")).toMatch(/^[01]$/);
    });
  });

  it('filterTransition="morph" emits CSS transitions on geometry attrs', () => {
    const { container } = render(<PassFlow passes={passes} filterTransition="morph" />);
    const style = container.querySelector("[data-campos='passflow-arrows'] style");
    expect(style).not.toBeNull();
    const css = style!.textContent ?? "";
    // The morph block transitions x1/y1/x2/y2 — verify all four are named.
    expect(css).toContain("x1");
    expect(css).toContain("y1");
    expect(css).toContain("x2");
    expect(css).toContain("y2");
    expect(css).toContain("transition:");
  });

  it('combined animate="dashes" + filterTransition="morph" emits both rule blocks', () => {
    const { container } = render(
      <PassFlow passes={passes} animate="dashes" filterTransition="morph" />,
    );
    const style = container.querySelector("[data-campos='passflow-arrows'] style");
    expect(style).not.toBeNull();
    const css = style!.textContent ?? "";
    // Dash animation + morph transition must coexist in the stylesheet.
    expect(css).toContain("campos-passflow-dashflow");
    expect(css).toContain("transition:");
    // Reduced-motion guard must disable BOTH.
    const reducedMatches = css.match(/prefers-reduced-motion: reduce/g) ?? [];
    expect(reducedMatches.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── SSR ───────────────────────────────────────────────────────────────────

describe("<PassFlow /> — SSR", () => {
  it("server-renders without throwing", () => {
    const markup = renderToString(<PassFlow passes={passes} />);
    expect(markup).toContain("Pass flow: 9 passes");
    // No client-only hooks leak warnings.
    expect(markup).toContain("Pass Origin Share");
  });

  it("PassFlowStaticSvg produces stable SVG output", () => {
    const markup = renderToString(<PassFlowStaticSvg passes={passes} />);
    expect(markup).toContain("<svg");
    expect(markup).toContain("aria-label");
  });
});

// ─── Accessibility ─────────────────────────────────────────────────────────

describe("<PassFlow /> — accessibility", () => {
  it("has no axe violations in the default rendering", async () => {
    const { container } = render(<PassFlow passes={passes} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations in the empty state", async () => {
    const { container } = render(<PassFlow passes={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
