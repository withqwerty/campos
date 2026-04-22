import { cleanup, render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it } from "vitest";

import type { TerritoryEvent } from "../src/compute/index.js";

import { Territory, ThemeProvider, DARK_THEME } from "../src/index";

afterEach(cleanup);

const events: TerritoryEvent[] = [
  { x: 12, y: 18, team: "Arsenal" },
  { x: 14, y: 20, team: "Arsenal" },
  { x: 75, y: 62, team: "Arsenal" },
  { x: 50, y: 50, team: "Wolves" },
  { x: 90, y: 80, team: "Wolves" },
];

// ─── Rendering ──────────────────────────────────────────────────────

describe("<Territory /> — rendering", () => {
  it("renders the zero-config 3x3 shell with 9 cells", () => {
    const { getAllByTestId, getByLabelText } = render(<Territory events={events} />);

    expect(getAllByTestId("territory-cell")).toHaveLength(9);
    expect(getByLabelText(/Territory: 9 zones/)).toBeInTheDocument();
  });

  it("renders 15 cells for the 5x3 grid", () => {
    const { getAllByTestId, getByLabelText } = render(
      <Territory events={events} grid="5x3" />,
    );

    expect(getAllByTestId("territory-cell")).toHaveLength(15);
    expect(getByLabelText(/Territory: 15 zones/)).toBeInTheDocument();
  });

  it("renders 20 cells for the positional 20-zone preset", () => {
    const { container, getAllByTestId, getByLabelText } = render(
      <Territory events={events} zonePreset="20" />,
    );

    expect(getAllByTestId("territory-cell")).toHaveLength(20);
    expect(getByLabelText(/Territory: 20 zones/)).toBeInTheDocument();
    expect(container.querySelector('[data-stadia="tactical-markings"]')).not.toBeNull();
  });

  it("renders the empty state pill when there are no events", () => {
    const { getByText, queryAllByTestId } = render(<Territory events={[]} />);

    expect(getByText("No event data")).toBeInTheDocument();
    // Cells still render in the model — empty state is an overlay
    expect(queryAllByTestId("territory-cell")).toHaveLength(9);
  });

  it("renders percentage labels for non-empty cells by default", () => {
    const { getAllByTestId } = render(<Territory events={events} />);
    const labels = getAllByTestId("territory-cell-label");
    // Five events spread across cells — at least one labeled cell exists
    expect(labels.length).toBeGreaterThan(0);
    // Each label should match the integer-percent format
    for (const label of labels) {
      expect(label.textContent).toMatch(/^\d+%$/);
    }
  });

  it("omits labels when showLabels={false}", () => {
    const { queryAllByTestId } = render(<Territory events={events} showLabels={false} />);

    expect(queryAllByTestId("territory-cell-label")).toHaveLength(0);
  });

  it("renders correctly in horizontal orientation", () => {
    const { getAllByTestId, getByLabelText } = render(
      <Territory events={events} attackingDirection="right" />,
    );

    expect(getAllByTestId("territory-cell")).toHaveLength(9);
    expect(getByLabelText(/Territory: 9 zones/)).toBeInTheDocument();
  });

  it("renders correctly with crop='half'", () => {
    const { getAllByTestId } = render(<Territory events={events} crop="half" />);

    // Still 9 cells in the model — they're just positioned over the attacking half
    expect(getAllByTestId("territory-cell")).toHaveLength(9);
  });

  it("supports cell and label style injection", () => {
    const { getAllByTestId } = render(
      <Territory
        events={events}
        labelStyle="badge"
        cells={{
          fill: ({ cell }) => (cell.count > 0 ? "#0f766e" : "#e2e8f0"),
          stroke: "#ffffff",
          strokeWidth: 1.5,
        }}
        labels={{
          fill: "#f8fafc",
          background: "#0f172a",
          opacity: 0.8,
          fontSize: 14,
        }}
      />,
    );

    const firstCell = getAllByTestId("territory-cell")[0]?.querySelector("rect");
    expect(firstCell).toHaveAttribute("fill", "#0f766e");
    expect(firstCell).toHaveAttribute("stroke", "#ffffff");
    expect(firstCell).toHaveAttribute("stroke-width", "1.5");

    const badge = getAllByTestId("territory-cell-badge")[0];
    expect(badge).toHaveAttribute("fill", "#0f172a");

    const label = getAllByTestId("territory-cell-label")[0];
    expect(label).toHaveAttribute("fill", "#f8fafc");
    expect(label).toHaveAttribute("opacity", "0.8");
    expect(label).toHaveAttribute("font-size", "14");
  });
});

// ─── teamFilter ─────────────────────────────────────────────────────

describe("<Territory /> — teamFilter", () => {
  it("filters events to a single team", () => {
    const { getByLabelText } = render(
      <Territory events={events} teamFilter="Arsenal" metricLabel="touches" />,
    );

    // 3 Arsenal events should be reflected in the aria-label
    expect(getByLabelText(/3 touches/)).toBeInTheDocument();
  });

  it("shows the empty state when teamFilter matches nothing", () => {
    const { getByText } = render(<Territory events={events} teamFilter="Liverpool" />);

    expect(getByText("No event data")).toBeInTheDocument();
  });
});

// ─── Concentrated state ────────────────────────────────────────────

describe("<Territory /> — concentrated data", () => {
  it("a single hot zone shows 100%", () => {
    const concentrated: TerritoryEvent[] = Array.from({ length: 20 }, () => ({
      x: 90,
      y: 50,
    }));
    const { getAllByTestId } = render(<Territory events={concentrated} />);
    const labels = getAllByTestId("territory-cell-label");
    expect(labels).toHaveLength(1);
    expect(labels[0]!.textContent).toBe("100%");
  });

  it("uses a dark label on bright concentrated fills", () => {
    const concentrated: TerritoryEvent[] = Array.from({ length: 20 }, () => ({
      x: 90,
      y: 50,
    }));
    const { getByText } = render(<Territory events={concentrated} />);
    // Cross-cutting contrast utility now picks `theme.contrast.onLight` for
    // light backgrounds (was hard-coded `#1f2937`). Same intent — dark
    // label on a bright cell — driven by `pickContrast` (WCAG luminance).
    expect(getByText("100%")).toHaveAttribute("fill", "#0f172a");
  });
});

// ─── Theme context ──────────────────────────────────────────────────

describe("<Territory /> — theme context", () => {
  it("empty-state pill picks up dark theme tokens", () => {
    const { getByText } = render(
      <ThemeProvider value={DARK_THEME}>
        <Territory events={[]} />
      </ThemeProvider>,
    );

    const pill = getByText("No event data");
    expect(pill).toHaveStyle({
      color: DARK_THEME.text.secondary,
    });
  });
});

// ─── Accessibility ──────────────────────────────────────────────────

describe("<Territory /> — accessibility", () => {
  it("has no axe violations with event data", async () => {
    const { container } = render(<Territory events={events} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations in empty state", async () => {
    const { container } = render(<Territory events={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("section has a descriptive aria-label", () => {
    const { container } = render(<Territory events={events} />);
    const section = container.querySelector("[aria-label]");
    expect(section).not.toBeNull();
    expect(section!.getAttribute("aria-label")).toMatch(/Territory: \d+ zones/);
  });

  it("supports an ariaLabel override", () => {
    const { getByLabelText } = render(
      <Territory events={events} ariaLabel="Arsenal possession territory" />,
    );

    expect(getByLabelText("Arsenal possession territory")).toBeInTheDocument();
  });
});
