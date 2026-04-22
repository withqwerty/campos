import { cleanup, render, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it } from "vitest";

import type { PizzaChartRow } from "../src/compute/index.js";

import { PizzaChart, ThemeProvider, DARK_THEME } from "../src/index";

afterEach(cleanup);

const STANDARD_ROWS: PizzaChartRow[] = [
  {
    metric: "Goals",
    percentile: 92,
    category: "Attacking",
    rawValue: 0.68,
    displayValue: "92",
  },
  {
    metric: "npxG",
    percentile: 87,
    category: "Attacking",
    rawValue: 0.54,
    displayValue: "87",
  },
  {
    metric: "Shots",
    percentile: 78,
    category: "Attacking",
    rawValue: 3.4,
    displayValue: "78",
  },
  { metric: "Passes", percentile: 45, category: "Possession", displayValue: "45" },
  { metric: "Prog passes", percentile: 38, category: "Possession", displayValue: "38" },
  { metric: "Carries", percentile: 71, category: "Possession", displayValue: "71" },
  { metric: "Tackles", percentile: 24, category: "Defending", displayValue: "24" },
  { metric: "Interceptions", percentile: 18, category: "Defending", displayValue: "18" },
  { metric: "Pressures", percentile: 62, category: "Defending", displayValue: "62" },
];

// ─── Rendering ──────────────────────────────────────────────────────

describe("<PizzaChart /> — rendering", () => {
  it("renders the component shell with correct aria-label", () => {
    const { getByLabelText } = render(<PizzaChart rows={STANDARD_ROWS} />);
    expect(getByLabelText("Pizza chart: 9 metrics")).toBeInTheDocument();
  });

  it("renders slices for each metric", () => {
    const { getByTestId } = render(<PizzaChart rows={STANDARD_ROWS} />);
    const slicesGroup = getByTestId("pizza-slices");
    expect(slicesGroup.querySelectorAll("path")).toHaveLength(9);
  });

  it("renders labels by default", () => {
    const { getByTestId } = render(<PizzaChart rows={STANDARD_ROWS} />);
    const labelsGroup = getByTestId("pizza-labels");
    expect(labelsGroup.querySelectorAll("text")).toHaveLength(9);
  });

  it("renders value badges by default", () => {
    const { getByTestId } = render(<PizzaChart rows={STANDARD_ROWS} />);
    const badgesGroup = getByTestId("pizza-badges");
    expect(badgesGroup.querySelectorAll("text").length).toBeGreaterThan(0);
  });

  it("renders grid rings", () => {
    const { getByTestId } = render(<PizzaChart rows={STANDARD_ROWS} />);
    expect(getByTestId("pizza-grid")).toBeInTheDocument();
  });

  it("renders empty state for no rows", () => {
    const { getByText, getByLabelText } = render(<PizzaChart rows={[]} />);
    expect(getByText("No profile data")).toBeInTheDocument();
    expect(getByLabelText("Pizza chart: no profile data")).toBeInTheDocument();
  });

  it("renders category legend for multi-category rows", () => {
    const { getByTestId } = render(<PizzaChart rows={STANDARD_ROWS} />);
    expect(getByTestId("pizza-legend")).toBeInTheDocument();
  });

  it("suppresses image center content in staticMode", () => {
    const { container } = render(
      <PizzaChart
        rows={STANDARD_ROWS}
        centerContent={{ kind: "image", src: "https://example.com/player.png" }}
        staticMode={true}
      />,
    );

    expect(container.querySelector("image")).toBeNull();
  });

  it("hides legend when showLegend=false", () => {
    const { queryByTestId } = render(
      <PizzaChart rows={STANDARD_ROWS} showLegend={false} />,
    );
    expect(queryByTestId("pizza-legend")).toBeNull();
  });

  it("supports area, guide, text, and badge style injection", () => {
    const { getByTestId } = render(
      <PizzaChart
        rows={STANDARD_ROWS}
        areas={{ fill: "#6366f1", stroke: "#312e81", strokeWidth: 1.5 }}
        guides={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 2" }}
        text={{ fill: "#1f2937" }}
        badges={{ fill: "#0f172a", stroke: "#334155", textFill: "#f8fafc" }}
      />,
    );

    const slice = getByTestId("pizza-slice-0");
    expect(slice).toHaveAttribute("fill", "#6366f1");
    expect(slice).toHaveAttribute("stroke", "#312e81");
    expect(slice).toHaveAttribute("stroke-width", "1.5");

    const gridPath = getByTestId("pizza-grid").querySelector("path");
    expect(gridPath).toHaveAttribute("stroke", "#94a3b8");
    expect(gridPath).toHaveAttribute("stroke-width", "1");
    expect(gridPath).toHaveAttribute("stroke-dasharray", "4 2");

    const label = getByTestId("pizza-labels").querySelector("text");
    expect(label).toHaveAttribute("fill", "#1f2937");

    const badgeRect = getByTestId("pizza-badges").querySelector("rect");
    expect(badgeRect).toHaveAttribute("fill", "#0f172a");
    expect(badgeRect).toHaveAttribute("stroke", "#334155");
    const badgeText = getByTestId("pizza-badges").querySelector("text");
    expect(badgeText).toHaveAttribute("fill", "#f8fafc");
  });
});

// ─── Interaction ────────────────────────────────────────────────────

describe("<PizzaChart /> — interaction", () => {
  it("shows tooltip on slice hover", () => {
    const { getByTestId, queryByTestId } = render(<PizzaChart rows={STANDARD_ROWS} />);

    expect(queryByTestId("pizza-tooltip")).toBeNull();

    const firstSlice = getByTestId("pizza-slice-0");
    fireEvent.mouseEnter(firstSlice);

    expect(getByTestId("pizza-tooltip")).toBeInTheDocument();
    expect(getByTestId("pizza-tooltip").textContent).toContain("Goals");
  });

  it("hides tooltip on mouse leave", () => {
    const { getByTestId, queryByTestId } = render(<PizzaChart rows={STANDARD_ROWS} />);

    const firstSlice = getByTestId("pizza-slice-0");
    fireEvent.mouseEnter(firstSlice);
    expect(queryByTestId("pizza-tooltip")).not.toBeNull();

    // Mouse leave from the container
    const container = getByTestId("pizza-slice-0").closest("div")!;
    fireEvent.mouseLeave(container);

    expect(queryByTestId("pizza-tooltip")).toBeNull();
  });

  it("tooltip shows rawValue when present", () => {
    const { getByTestId } = render(<PizzaChart rows={STANDARD_ROWS} />);

    const firstSlice = getByTestId("pizza-slice-0");
    fireEvent.mouseEnter(firstSlice);

    const tooltip = getByTestId("pizza-tooltip");
    expect(tooltip.textContent).toContain("0.68"); // rawValue
  });

  it("shows tooltip on slice focus", () => {
    const { getByTestId } = render(<PizzaChart rows={STANDARD_ROWS} />);

    fireEvent.focus(getByTestId("pizza-slice-0"));

    expect(getByTestId("pizza-tooltip").textContent).toContain("Goals");
  });
});

// ─── Prop customization ─────────────────────────────────────────────

describe("<PizzaChart /> — props", () => {
  it("hides labels when showAxisLabels is false", () => {
    const { queryByTestId } = render(
      <PizzaChart rows={STANDARD_ROWS} showAxisLabels={false} />,
    );
    expect(queryByTestId("pizza-labels")).toBeNull();
  });

  it("hides value badges when showValueBadges is false", () => {
    const { queryByTestId } = render(
      <PizzaChart rows={STANDARD_ROWS} showValueBadges={false} />,
    );
    expect(queryByTestId("pizza-badges")).toBeNull();
  });

  it("renders center initials", () => {
    const { container } = render(
      <PizzaChart
        rows={STANDARD_ROWS}
        centerContent={{ kind: "initials", label: "BS" }}
      />,
    );
    // Should find the initials text
    const texts = container.querySelectorAll("text");
    const initialsText = Array.from(texts).find((t) => t.textContent === "BS");
    expect(initialsText).toBeTruthy();
  });

  it("uses unique clipPath ids for center images across multiple charts", () => {
    const { container } = render(
      <>
        <PizzaChart
          rows={STANDARD_ROWS}
          centerContent={{ kind: "crest", src: "/crest-a.png" }}
        />
        <PizzaChart
          rows={STANDARD_ROWS}
          centerContent={{ kind: "crest", src: "/crest-b.png" }}
        />
      </>,
    );

    const clipPaths = Array.from(container.querySelectorAll("clipPath"));
    expect(clipPaths).toHaveLength(2);
    const ids = clipPaths.map((node) => node.getAttribute("id"));
    expect(new Set(ids).size).toBe(2);
  });
});

// ─── Grid rings ───────────────────────────────────────────────────────

describe("<PizzaChart /> — grid rings", () => {
  it("renders 4 grid ring paths + inner circle by default", () => {
    const { getByTestId } = render(<PizzaChart rows={STANDARD_ROWS} />);
    const grid = getByTestId("pizza-grid");
    expect(grid.querySelectorAll("path")).toHaveLength(4);
    expect(grid.querySelectorAll("circle")).toHaveLength(1);
  });

  it("renders 5 grid ring paths with gridRingStep=20", () => {
    const { getByTestId } = render(<PizzaChart rows={STANDARD_ROWS} gridRingStep={20} />);
    const grid = getByTestId("pizza-grid");
    expect(grid.querySelectorAll("path")).toHaveLength(5);
  });
});

// ─── Reference arcs ───────────────────────────────────────────────────

describe("<PizzaChart /> — reference arcs", () => {
  it("does not render reference arcs by default", () => {
    const { queryByTestId } = render(<PizzaChart rows={STANDARD_ROWS} />);
    expect(queryByTestId("pizza-reference-arcs")).toBeNull();
  });

  it("renders reference arcs for a single set", () => {
    const { getByTestId } = render(
      <PizzaChart
        rows={STANDARD_ROWS}
        referenceSets={[{ label: "Median", values: { Goals: 50, npxG: 50, Shots: 50 } }]}
      />,
    );
    const set = getByTestId("pizza-reference-set-0");
    expect(set.querySelectorAll("path")).toHaveLength(3);
  });

  it("renders multiple reference sets", () => {
    const { getByTestId } = render(
      <PizzaChart
        rows={STANDARD_ROWS}
        referenceSets={[
          { values: { Goals: 50 } },
          { values: { Goals: 90 }, stroke: "#ff0000" },
        ]}
      />,
    );
    expect(getByTestId("pizza-reference-set-0")).toBeInTheDocument();
    expect(getByTestId("pizza-reference-set-1")).toBeInTheDocument();
  });

  it("reference arcs appear between slices and labels in DOM order", () => {
    const { getByTestId } = render(
      <PizzaChart rows={STANDARD_ROWS} referenceSets={[{ values: { Goals: 50 } }]} />,
    );
    const slices = getByTestId("pizza-slices");
    const refs = getByTestId("pizza-reference-arcs");
    const labels = getByTestId("pizza-labels");

    // compareDocumentPosition bit 4 = DOCUMENT_POSITION_FOLLOWING
    expect(slices.compareDocumentPosition(refs) & 4).toBeTruthy();
    expect(refs.compareDocumentPosition(labels) & 4).toBeTruthy();
  });

  it("applies custom stroke from reference set", () => {
    const { getByTestId } = render(
      <PizzaChart
        rows={STANDARD_ROWS}
        referenceSets={[
          { values: { Goals: 50 }, stroke: "#abcdef", strokeDasharray: "4 2" },
        ]}
      />,
    );
    const path = getByTestId("pizza-reference-set-0").querySelector("path")!;
    expect(path.getAttribute("stroke")).toBe("#abcdef");
    expect(path.getAttribute("stroke-dasharray")).toBe("4 2");
  });

  it("has no axe violations with reference sets", async () => {
    const { container } = render(
      <PizzaChart
        rows={STANDARD_ROWS}
        referenceSets={[{ values: { Goals: 50, npxG: 50 } }]}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ─── Theme context ──────────────────────────────────────────────────

describe("<PizzaChart /> — theme", () => {
  it("uses dark theme when wrapped in ThemeProvider", () => {
    const { getByTestId } = render(
      <ThemeProvider value={DARK_THEME}>
        <PizzaChart rows={STANDARD_ROWS} />
      </ThemeProvider>,
    );
    // Grid should use dark theme grid color
    const grid = getByTestId("pizza-grid");
    const paths = grid.querySelectorAll("path");
    expect(paths[0]!.getAttribute("stroke")).toBe(DARK_THEME.axis.grid);
  });
});

// ─── Accessibility ──────────────────────────────────────────────────

describe("<PizzaChart /> — accessibility", () => {
  it("has no axe violations for standard profile", async () => {
    const { container } = render(<PizzaChart rows={STANDARD_ROWS} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations for empty state", async () => {
    const { container } = render(<PizzaChart rows={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
