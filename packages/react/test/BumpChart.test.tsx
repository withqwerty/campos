import { cleanup, fireEvent, render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it } from "vitest";

import type { BumpChartRow } from "../src/compute/index.js";

import { BumpChart } from "../src/index";
import { BumpChartStaticSvg } from "../src/BumpChart";

afterEach(cleanup);

function makeRow(overrides: Partial<BumpChartRow> = {}): BumpChartRow {
  return {
    team: "LIV",
    timepoint: 1,
    rank: 1,
    label: "Liverpool",
    ...overrides,
  };
}

const rows: BumpChartRow[] = [
  makeRow({ team: "LIV", label: "Liverpool", timepoint: 1, rank: 1 }),
  makeRow({ team: "LIV", label: "Liverpool", timepoint: 2, rank: 1 }),
  makeRow({ team: "MCI", label: "Man City", timepoint: 1, rank: 2 }),
  makeRow({ team: "MCI", label: "Man City", timepoint: 2, rank: 3 }),
];

describe("<BumpChart />", () => {
  it("renders with an accessible summary label", () => {
    const { getByLabelText } = render(<BumpChart rows={rows} />);

    expect(getByLabelText(/bump chart/i)).toBeInTheDocument();
  });

  it("renders empty state when no rows are provided", () => {
    const { getByText } = render(<BumpChart rows={[]} />);

    expect(getByText("No ranking data")).toBeInTheDocument();
  });

  it("renders end labels for teams", () => {
    const { getByTestId } = render(<BumpChart rows={rows} />);

    const endLabels = getByTestId("bump-end-labels");
    expect(endLabels.textContent).toContain("Liverpool");
    expect(endLabels.textContent).toContain("Man City");
  });

  it("uses SVG end labels in staticMode instead of the HTML overlay", () => {
    const { getByTestId, queryByTestId } = render(
      <BumpChart rows={rows} staticMode={true} />,
    );

    expect(queryByTestId("bump-end-labels")).toBeNull();
    expect(getByTestId("bump-end-labels-static").textContent).toContain("Liverpool");
    expect(getByTestId("bump-end-labels-static").textContent).toContain("Man City");
  });

  it("exposes the same accessible label contract in the static SVG renderer", () => {
    const { container } = render(<BumpChartStaticSvg rows={rows} />);

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).toHaveAttribute("aria-label");
    expect(svg?.getAttribute("aria-label")).toMatch(/bump chart/i);
  });

  it("supports point, label, and guide style injection", () => {
    const { container, getByTestId } = render(
      <BumpChartStaticSvg
        rows={rows}
        showStartLabels={true}
        points={{
          shape: {
            by: ({ line }) => line.team,
            values: { LIV: "square" },
            fallback: "circle",
          },
          fill: {
            by: ({ line }) => line.team,
            values: { LIV: "#dc2626", MCI: "#2563eb" },
          },
        }}
        labels={{
          fill: ({ placement }) => (placement === "start" ? "#475569" : "#111827"),
          opacity: ({ placement }) => (placement === "end" ? 0.9 : 0.7),
        }}
        guides={{ stroke: "#e11d48", strokeDasharray: "2 2", opacity: 0.6 }}
      />,
    );

    const staticMarkers = getByTestId("bump-markers-static");
    expect(staticMarkers.querySelector("rect")).toHaveAttribute("fill", "#dc2626");

    const startLabel = Array.from(
      getByTestId("bump-start-labels").querySelectorAll("text"),
    ).find((node) => node.textContent === "Liverpool");
    expect(startLabel).toHaveAttribute("fill", "#475569");
    expect(startLabel).toHaveAttribute("opacity", "0.7");

    const endLabel = Array.from(
      getByTestId("bump-end-labels-static").querySelectorAll("text"),
    ).find((node) => node.textContent === "Liverpool");
    expect(endLabel).toHaveAttribute("fill", "#111827");
    expect(endLabel).toHaveAttribute("opacity", "0.9");

    const gridLine = getByTestId("bump-y-grid").querySelector("line");
    expect(gridLine).toHaveAttribute("stroke", "#e11d48");
    expect(gridLine).toHaveAttribute("stroke-dasharray", "2 2");
    expect(gridLine).toHaveAttribute("opacity", "0.6");
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("shows tooltip when a marker is focused", () => {
    const { getByLabelText, getByTestId } = render(
      <BumpChart rows={rows} showMarkers={true} />,
    );

    fireEvent.focus(getByLabelText("Liverpool (LIV) matchweek 1: position 1"));

    const tooltip = getByTestId("bump-tooltip");
    expect(tooltip.textContent).toContain("Liverpool");
    expect(tooltip.textContent).toContain("1");
  });

  it("has no axe violations", async () => {
    const { container } = render(<BumpChart rows={rows} />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("falls back to a legend when end labels are hidden", () => {
    const { getByTestId, queryByTestId } = render(
      <BumpChart rows={rows} showEndLabels={false} />,
    );

    expect(queryByTestId("bump-end-labels")).toBeNull();
    expect(getByTestId("bump-legend").textContent).toContain("Liverpool");
    expect(getByTestId("bump-legend").textContent).toContain("Man City");
  });

  it("keeps the line layer keyboard-focusable when markers are hidden", () => {
    const { getByLabelText } = render(<BumpChart rows={rows} showMarkers={false} />);

    expect(getByLabelText("Liverpool trend")).toBeInTheDocument();
    expect(getByLabelText("Man City trend")).toBeInTheDocument();
  });

  it("supports custom end-label rendering with team logo context", () => {
    const { getByTestId, getByAltText, queryByText } = render(
      <BumpChart
        rows={rows}
        teamLogos={{ LIV: "/logos/liverpool.png" }}
        renderEndLabel={({ logoUrl, teamLabel }) =>
          logoUrl ? (
            <img src={logoUrl} alt={`${teamLabel} crest`} />
          ) : (
            <span>{teamLabel}</span>
          )
        }
      />,
    );

    expect(getByTestId("bump-end-labels")).toBeInTheDocument();
    expect(getByAltText("Liverpool crest")).toBeInTheDocument();
    expect(queryByText("Liverpool")).toBeNull();
    expect(queryByText("Man City")).toBeInTheDocument();
  });
});
