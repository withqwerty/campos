import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";

import type { HeatmapEvent } from "../src/compute/index.js";

import { Heatmap, ThemeProvider, DARK_THEME } from "../src/index";

afterEach(cleanup);

const events: HeatmapEvent[] = [
  { x: 12, y: 18 },
  { x: 14, y: 20 },
  { x: 75, y: 62 },
];

const singleEvent: HeatmapEvent[] = [{ x: 50, y: 50 }];

// ─── Rendering ──────────────────────────────────────────────────────

describe("<Heatmap /> — rendering", () => {
  it("renders the zero-config shell with a scale bar", () => {
    const { getByLabelText, getByText } = render(<Heatmap events={events} />);

    expect(getByLabelText("Heatmap: 12x8 grid")).toBeInTheDocument();
    expect(getByText("Events")).toBeInTheDocument();
    expect(getByText(/0\s*–\s*2/)).toBeInTheDocument();
  });

  it("renders the empty state with pill when there are no events", () => {
    const { getByText, queryByTestId } = render(<Heatmap events={[]} />);

    expect(getByText("No event data")).toBeInTheDocument();
    expect(queryByTestId("heatmap-tooltip")).not.toBeInTheDocument();
  });

  it("renders non-empty cells as focusable buttons", () => {
    const { container } = render(<Heatmap events={events} />);

    const buttons = within(container).getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    // Each button should be a heatmap cell
    buttons.forEach((btn) => {
      expect(btn.getAttribute("aria-label")).toMatch(/heatmap cell/i);
    });
  });

  it("renders correct grid size for custom gridX/gridY", () => {
    const { getByLabelText } = render(<Heatmap events={events} gridX={6} gridY={4} />);

    expect(getByLabelText("Heatmap: 6x4 grid")).toBeInTheDocument();
  });

  it("supports named zone presets and renders aligned tactical markings", () => {
    const { container, getByLabelText } = render(
      <Heatmap events={events} zonePreset="20" />,
    );

    expect(getByLabelText("Heatmap: 4x5 grid")).toBeInTheDocument();
    expect(container.querySelector('[data-stadia="tactical-markings"]')).not.toBeNull();
  });

  it('warns and falls back to grid sizing when a tactical zone preset is used with crop="half"', () => {
    const { getByLabelText, getByText, container } = render(
      <Heatmap events={events} zonePreset="20" crop="half" gridX={4} gridY={3} />,
    );

    expect(getByLabelText("Heatmap: 4x3 grid")).toBeInTheDocument();
    expect(getByText(/full-pitch only/i)).toBeInTheDocument();
    expect(container.querySelector('[data-stadia="tactical-markings"]')).toBeNull();
  });

  it("lets explicit edges override a named zone preset", () => {
    const { getByLabelText } = render(
      <Heatmap events={events} zonePreset="20" xEdges={[0, 50, 100]} yEdges={[0, 100]} />,
    );

    expect(getByLabelText("Heatmap: 2x1 grid")).toBeInTheDocument();
  });

  it("renders a custom metricLabel in the scale bar and aria-label", () => {
    const { getByText, getAllByRole } = render(
      <Heatmap events={events} metricLabel="Passes" />,
    );

    expect(getByText("Passes")).toBeInTheDocument();
    const cells = getAllByRole("button");
    expect(cells[0]!.getAttribute("aria-label")).toMatch(/^Passes heatmap cell/);
  });

  it("hides the scale bar when showScaleBar is false", () => {
    const { queryByTestId, queryByText } = render(
      <Heatmap events={events} showScaleBar={false} />,
    );

    expect(queryByTestId("heatmap-scale-bar")).not.toBeInTheDocument();
    expect(queryByText("Events")).not.toBeInTheDocument();
  });

  it("supports cell style injection", () => {
    const { getAllByRole } = render(
      <Heatmap
        events={events}
        cells={{
          fill: {
            by: ({ cell }) => (cell.count > 1 ? "hot" : "cold"),
            values: { hot: "#0f766e", cold: "#93c5fd" },
          },
          stroke: "#0f172a",
          strokeWidth: ({ cell }) => (cell.count > 1 ? 2 : 1),
        }}
      />,
    );

    const cells = getAllByRole("button", { name: /heatmap cell/i });
    expect(cells[0]).toHaveAttribute("fill", "#0f766e");
    expect(cells[0]).toHaveAttribute("stroke", "#0f172a");
    expect(cells[0]).toHaveAttribute("stroke-width", "2");
  });
});

// ─── Interaction ────────────────────────────────────────────────────

describe("<Heatmap /> — interaction", () => {
  it("shows tooltip content when a cell is focused", () => {
    const { getAllByRole, getAllByText, getByText, getByTestId } = render(
      <Heatmap events={events} />,
    );

    const cells = getAllByRole("button", { name: /heatmap cell/i });
    fireEvent.focus(cells[0] as HTMLElement);

    // The scale bar label and the tooltip metric row both say "Events"
    expect(getAllByText("Events").length).toBeGreaterThan(0);
    expect(getByText("Intensity")).toBeInTheDocument();
    expect(getByTestId("heatmap-tooltip")).toBeInTheDocument();
  });

  it("dismisses tooltip on blur", () => {
    const { getAllByRole, getByTestId, queryByTestId } = render(
      <Heatmap events={events} />,
    );

    const cells = getAllByRole("button", { name: /heatmap cell/i });
    fireEvent.focus(cells[0] as HTMLElement);
    expect(getByTestId("heatmap-tooltip")).toBeInTheDocument();

    fireEvent.blur(cells[0] as HTMLElement);
    expect(queryByTestId("heatmap-tooltip")).not.toBeInTheDocument();
  });

  it("keeps the hover tooltip non-interactive", () => {
    const { getAllByRole, getByTestId } = render(<Heatmap events={events} />);

    const cells = getAllByRole("button", { name: /heatmap cell/i });
    fireEvent.mouseEnter(cells[0] as HTMLElement);

    expect(getByTestId("heatmap-tooltip")).toHaveStyle({
      pointerEvents: "none",
    });
  });

  it("shows tooltip on click", () => {
    const { getAllByRole, getByTestId } = render(<Heatmap events={events} />);

    const cells = getAllByRole("button", { name: /heatmap cell/i });
    fireEvent.click(cells[0] as HTMLElement);

    expect(getByTestId("heatmap-tooltip")).toBeInTheDocument();
  });

  it("does not surface a tooltip for zero-value cells", () => {
    const { container, queryByTestId } = render(
      <Heatmap events={singleEvent} gridX={12} gridY={8} />,
    );

    const zeroCell = Array.from(
      container.querySelectorAll('rect[fill="rgba(0,0,0,0)"]'),
    ).find((node) => !node.hasAttribute("role")) as SVGRectElement | undefined;

    expect(zeroCell).toBeDefined();
    fireEvent.mouseEnter(zeroCell!);
    fireEvent.click(zeroCell!);

    expect(queryByTestId("heatmap-tooltip")).toBeNull();
  });

  it("tooltip in share mode shows metric as percent plus an Intensity row", () => {
    const { getAllByRole, getAllByText, getByText, getByTestId } = render(
      <Heatmap events={events} metricLabel="Touches" valueMode="share" />,
    );

    const cells = getAllByRole("button", { name: /heatmap cell/i });
    fireEvent.focus(cells[0] as HTMLElement);

    // Primary row: "Touches" (scale bar also says this, so >= 1)
    expect(getAllByText("Touches").length).toBeGreaterThan(0);
    // Secondary row: "Intensity"
    expect(getByText("Intensity")).toBeInTheDocument();
    // The tooltip should contain at least one percent-formatted value
    const tooltip = getByTestId("heatmap-tooltip");
    expect(tooltip.textContent).toMatch(/%/);
  });

  it("tooltip in intensity mode omits the redundant Intensity secondary row", () => {
    const { getAllByRole, getAllByText, getByTestId } = render(
      <Heatmap events={events} metricLabel="Touches" valueMode="intensity" />,
    );

    const cells = getAllByRole("button", { name: /heatmap cell/i });
    fireEvent.focus(cells[0] as HTMLElement);

    // Tooltip should still render
    expect(getByTestId("heatmap-tooltip")).toBeInTheDocument();
    // "Intensity" should appear exactly once (the primary row), NOT twice.
    expect(getAllByText("Intensity").length).toBe(1);
  });
});

// ─── Auto pitch line contrast ───────────────────────────────────────

describe("<Heatmap /> — autoPitchLines", () => {
  function getPitchLineStrokes(container: HTMLElement): string[] {
    // Stadia PitchLines renders lines under <g data-stadia="pitch-lines">
    const linesGroup = container.querySelector('[data-stadia="pitch-lines"]');
    if (!linesGroup) return [];
    const strokes = new Set<string>();
    linesGroup.querySelectorAll("[stroke]").forEach((el) => {
      const stroke = el.getAttribute("stroke");
      if (stroke && stroke !== "none") strokes.add(stroke);
    });
    return Array.from(strokes);
  }

  it("auto-forces white pitch lines when using a dark colorscale (magma)", () => {
    const { container } = render(
      <Heatmap
        events={events}
        colorScale="magma"
        pitchColors={{ fill: "#ffffff", lines: "#1a1a1a" }}
      />,
    );
    const strokes = getPitchLineStrokes(container);
    // User's dark line color should have been overridden to white
    expect(strokes).not.toContain("#1a1a1a");
    expect(strokes.some((s) => s.toLowerCase().includes("ffffff"))).toBe(true);
  });

  it("respects user pitch line colors when using a light colorscale (blues)", () => {
    const { container } = render(
      <Heatmap
        events={events}
        colorScale="blues"
        pitchColors={{ fill: "#ffffff", lines: "#1a1a1a" }}
      />,
    );
    const strokes = getPitchLineStrokes(container);
    // User's dark lines should pass through unchanged for a light colorscale
    expect(strokes).toContain("#1a1a1a");
  });

  it("can be disabled with autoPitchLines={false}", () => {
    const { container } = render(
      <Heatmap
        events={events}
        colorScale="magma"
        pitchColors={{ fill: "#ffffff", lines: "#1a1a1a" }}
        autoPitchLines={false}
      />,
    );
    const strokes = getPitchLineStrokes(container);
    // With auto disabled, user's dark lines pass through even with dark ramp
    expect(strokes).toContain("#1a1a1a");
  });
});

// ─── Prop updates ───────────────────────────────────────────────────

describe("<Heatmap /> — prop updates", () => {
  it("updates to the empty state when events are cleared", async () => {
    function TestHarness() {
      const [currentEvents, setCurrentEvents] = useState(events);

      return (
        <>
          <button
            type="button"
            onClick={() => {
              setCurrentEvents([]);
            }}
          >
            Clear events
          </button>
          <Heatmap events={currentEvents} />
        </>
      );
    }

    const view = render(<TestHarness />);

    fireEvent.click(view.getByRole("button", { name: "Clear events" }));

    await waitFor(() => {
      expect(view.getAllByText("No event data").length).toBeGreaterThan(0);
    });
  });
});

// ─── Theme context ──────────────────────────────────────────────────

describe("<Heatmap /> — theme context", () => {
  it("uses dark theme colors when wrapped in ThemeProvider", () => {
    const { getAllByRole, getByTestId } = render(
      <ThemeProvider value={DARK_THEME}>
        <Heatmap events={events} />
      </ThemeProvider>,
    );

    const cells = getAllByRole("button", { name: /heatmap cell/i });
    fireEvent.focus(cells[0] as HTMLElement);

    const tooltip = getByTestId("heatmap-tooltip");
    expect(tooltip).toHaveStyle({
      background: DARK_THEME.surface.tooltip,
    });
  });
});

// ─── Accessibility ──────────────────────────────────────────────────

describe("<Heatmap /> — accessibility", () => {
  it("has no axe violations with event data", async () => {
    const { container } = render(<Heatmap events={events} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations in empty state", async () => {
    const { container } = render(<Heatmap events={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("cells have accessible labels", () => {
    const { getAllByRole } = render(<Heatmap events={singleEvent} />);

    const buttons = getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute("aria-label");
      expect(btn.getAttribute("aria-label")).toMatch(/heatmap cell/i);
    });
  });

  it("container has an accessible label describing the grid", () => {
    const { container } = render(<Heatmap events={events} />);

    const section = container.querySelector("[aria-label]");
    expect(section).not.toBeNull();
    expect(section!.getAttribute("aria-label")).toMatch(/Heatmap: \d+x\d+ grid/);
  });
});

// ─── Overlay + tooltip gating ───────────────────────────────────────

describe("<Heatmap /> — overlay", () => {
  it("renders overlay children with a project function anchored to the pitch frame", () => {
    const { container } = render(
      <Heatmap
        events={events}
        overlay={({ project }) => {
          const p = project(50, 50);
          return (
            <circle data-testid="overlay-dot" cx={p.x} cy={p.y} r={1} fill="#0057ff" />
          );
        }}
      />,
    );

    const dot = container.querySelector('[data-testid="overlay-dot"]');
    expect(dot).not.toBeNull();
    const cx = Number(dot!.getAttribute("cx"));
    const cy = Number(dot!.getAttribute("cy"));
    expect(Number.isFinite(cx)).toBe(true);
    expect(Number.isFinite(cy)).toBe(true);
  });

  it("suppresses the cell tooltip and makes cells non-interactive when showCellTooltip={false}", () => {
    const { container, queryAllByRole, queryByTestId } = render(
      <Heatmap events={events} showCellTooltip={false} />,
    );

    expect(queryAllByRole("button")).toHaveLength(0);
    const cells = container.querySelectorAll('[data-campos="heatmap-cells"] > rect');
    expect(cells.length).toBeGreaterThan(0);
    cells.forEach((cell) => {
      expect(cell.getAttribute("role")).toBeNull();
      expect(cell.getAttribute("tabindex")).toBeNull();
      expect((cell as SVGRectElement).style.pointerEvents).toBe("none");
      fireEvent.mouseEnter(cell);
    });
    expect(queryByTestId("heatmap-tooltip")).not.toBeInTheDocument();
  });

  it("suppresses the empty-state pill when overlay is provided (overlay stands in as content)", () => {
    const { queryByText, container } = render(
      <Heatmap
        events={[]}
        overlay={({ project }) => {
          const p = project(50, 50);
          return <circle data-testid="overlay-dot" cx={p.x} cy={p.y} r={1} />;
        }}
      />,
    );
    expect(queryByText("No event data")).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="overlay-dot"]')).not.toBeNull();
  });

  it("keeps the default cell tooltip active when showCellTooltip is unset", async () => {
    const { getAllByRole, getByTestId } = render(<Heatmap events={events} />);
    const firstInteractive = getAllByRole("button")[0];
    if (firstInteractive == null)
      throw new Error("expected at least one interactive cell");
    fireEvent.mouseEnter(firstInteractive);
    await waitFor(() => {
      expect(getByTestId("heatmap-tooltip")).toBeInTheDocument();
    });
  });

  it("renders overlay above cells (later in SVG paint order)", () => {
    const { container } = render(
      <Heatmap
        events={events}
        overlay={({ project }) => {
          const p = project(50, 50);
          return <circle data-testid="overlay-dot" cx={p.x} cy={p.y} r={1} />;
        }}
      />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const overlay = svg!.querySelector('[data-testid="overlay-dot"]');
    const firstCell = svg!.querySelector('[data-campos="heatmap-cells"] > rect');
    expect(overlay).not.toBeNull();
    expect(firstCell).not.toBeNull();
    const nodes = Array.from(svg!.querySelectorAll("*"));
    expect(nodes.indexOf(overlay!)).toBeGreaterThan(nodes.indexOf(firstCell!));
  });

  it("does not crash when events are empty and overlay is omitted (shows empty-state pill)", () => {
    const { getByText } = render(<Heatmap events={[]} />);
    expect(getByText("No event data")).toBeInTheDocument();
  });
});
