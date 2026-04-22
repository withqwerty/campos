import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CometChart, ThemeProvider, DARK_THEME } from "../src/index";

afterEach(cleanup);

type TeamSeason = {
  team: string;
  season: string;
  npxg: number;
  npxga: number;
};

const twoTeamTwoSeason: readonly TeamSeason[] = [
  { team: "Arsenal", season: "2021-22", npxg: 1.0, npxga: 1.5 },
  { team: "Chelsea", season: "2021-22", npxg: 1.2, npxga: 1.3 },
  { team: "Arsenal", season: "2022-23", npxg: 1.5, npxga: 1.0 },
  { team: "Chelsea", season: "2022-23", npxg: 1.8, npxga: 0.9 },
];

const singleEntity: readonly TeamSeason[] = [
  { team: "Brighton", season: "2020-21", npxg: 0.8, npxga: 1.2 },
  { team: "Brighton", season: "2021-22", npxg: 1.0, npxga: 1.1 },
  { team: "Brighton", season: "2022-23", npxg: 1.3, npxga: 0.9 },
];

// ─── Rendering ──────────────────────────────────────────────────────

describe("<CometChart /> — rendering", () => {
  it("renders SVG with correct viewBox", () => {
    const { container } = render(
      <CometChart points={twoTeamTwoSeason} entityKey="team" xKey="npxg" yKey="npxga" />,
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg!.getAttribute("viewBox")).toBe("0 0 400 320");
  });

  it("renders trail segments for multi-point entities", () => {
    const { container } = render(
      <CometChart points={twoTeamTwoSeason} entityKey="team" xKey="npxg" yKey="npxga" />,
    );

    // Each entity with 2 points should have 1 trail segment (line element)
    const lines = container.querySelectorAll("line[stroke-linecap='round']");
    expect(lines.length).toBeGreaterThanOrEqual(2); // 2 entities × 1 segment each
  });

  it("renders markers at each point", () => {
    const { container } = render(
      <CometChart points={twoTeamTwoSeason} entityKey="team" xKey="npxg" yKey="npxga" />,
    );

    // Should have circle markers for each point
    const buttons = container.querySelectorAll("[role='button'] circle");
    expect(buttons.length).toBe(4); // 2 entities × 2 points
  });

  it("shows empty state for empty input", () => {
    const { getByText } = render(
      <CometChart
        points={[] as TeamSeason[]}
        entityKey="team"
        xKey="npxg"
        yKey="npxga"
      />,
    );

    expect(getByText("No data")).toBeInTheDocument();
  });

  it("renders entity labels", () => {
    const { container } = render(
      <CometChart points={twoTeamTwoSeason} entityKey="team" xKey="npxg" yKey="npxga" />,
    );

    const labelTexts = container.querySelectorAll(
      "text[font-weight='700'][font-size='9.5']",
    );
    const labels = Array.from(labelTexts).map((el) => el.textContent);
    expect(labels).toContain("Arsenal");
    expect(labels).toContain("Chelsea");
  });

  it("supports line, marker, label, and guide style injection", () => {
    const { container, getByText } = render(
      <CometChart
        points={twoTeamTwoSeason}
        entityKey="team"
        xKey="npxg"
        yKey="npxga"
        timeKey="season"
        guides={[{ axis: "x", value: "median", label: "Median npxG" }]}
        lines={{
          stroke: {
            by: ({ entity }) => entity.id,
            values: { Arsenal: "#dc2626", Chelsea: "#2563eb" },
          },
          strokeWidth: ({ entity }) => (entity.id === "Arsenal" ? 3 : 2),
        }}
        markers={{
          shape: {
            by: ({ entity }) => entity.id,
            values: { Arsenal: "square" },
            fallback: "circle",
          },
          fill: {
            by: ({ entity }) => entity.id,
            values: { Arsenal: "#dc2626", Chelsea: "#2563eb" },
          },
        }}
        labels={{ fill: "#1f2937", connectorStroke: "#94a3b8" }}
        guideStyle={{ stroke: "#94a3b8", strokeWidth: 2, labelColor: "#475569" }}
      />,
    );

    const trailGroup = container.querySelector("[aria-label='Arsenal trail']");
    expect(trailGroup).toBeInTheDocument();
    const visibleTrail = Array.from(trailGroup!.querySelectorAll("line")).find(
      (line) => line.getAttribute("stroke") !== "transparent",
    );
    expect(visibleTrail).toHaveAttribute("stroke", "#dc2626");
    expect(visibleTrail).toHaveAttribute("stroke-width", "3");

    const arsenalMarker = container.querySelector("[aria-label*='Entity: Arsenal']");
    expect(arsenalMarker?.querySelector("rect")).toBeInTheDocument();
    expect(arsenalMarker?.querySelector("rect")).toHaveAttribute("fill", "#dc2626");

    const guideLabel = getByText("Median npxG");
    expect(guideLabel).toHaveAttribute("fill", "#475569");
    const guideLine = Array.from(container.querySelectorAll("svg line")).find(
      (line) => line.getAttribute("stroke") === "#94a3b8",
    );
    expect(guideLine).toHaveAttribute("stroke-width", "2");

    const entityLabel = Array.from(
      container.querySelectorAll("text[font-weight='700'][font-size='9.5']"),
    ).find((node) => node.textContent === "Arsenal");
    expect(entityLabel).toHaveAttribute("fill", "#1f2937");
  });

  it("supports logo markers and shared methodology notes", () => {
    const { container, getByTestId } = render(
      <CometChart
        points={twoTeamTwoSeason}
        entityKey="team"
        xKey="npxg"
        yKey="npxga"
        timeKey="season"
        logoMap={{ Arsenal: "/logos/arsenal.png" }}
        methodologyNotes={{ below: "Sample: two teams across two seasons." }}
      />,
    );

    expect(
      container.querySelector("image[href='/logos/arsenal.png']"),
    ).toBeInTheDocument();
    expect(getByTestId("chart-note-below").textContent).toContain(
      "Sample: two teams across two seasons.",
    );
  });
});

// ─── Tooltip ────────────────────────────────────────────────────────

describe("<CometChart /> — tooltip", () => {
  it("shows tooltip on hover", () => {
    const { container, queryByTestId, getByTestId } = render(
      <CometChart
        points={twoTeamTwoSeason}
        entityKey="team"
        xKey="npxg"
        yKey="npxga"
        timeKey="season"
      />,
    );

    // No tooltip initially
    expect(queryByTestId("cometchart-tooltip")).not.toBeInTheDocument();

    // Hover on a marker
    const marker = container.querySelector("[aria-label*='Period: 2021-22']");
    expect(marker).toBeInTheDocument();
    fireEvent.mouseEnter(marker!);

    expect(queryByTestId("cometchart-tooltip")).toBeInTheDocument();
    expect(getByTestId("cometchart-tooltip").textContent).toContain("2021-22");
  });

  it("shows tooltip when hovering on a trail line", () => {
    const { container, queryByTestId } = render(
      <CometChart points={twoTeamTwoSeason} entityKey="team" xKey="npxg" yKey="npxga" />,
    );

    const trailGroup = container.querySelector("[aria-label='Arsenal trail']");
    expect(trailGroup).toBeInTheDocument();
    fireEvent.mouseEnter(trailGroup!);

    expect(queryByTestId("cometchart-tooltip")).toBeInTheDocument();
  });

  it("hides tooltip on mouse leave", () => {
    const { container, queryByTestId } = render(
      <CometChart points={twoTeamTwoSeason} entityKey="team" xKey="npxg" yKey="npxga" />,
    );

    const marker = container.querySelector("[role='button']");
    fireEvent.mouseEnter(marker!);
    expect(queryByTestId("cometchart-tooltip")).toBeInTheDocument();

    fireEvent.mouseLeave(marker!);
    expect(queryByTestId("cometchart-tooltip")).not.toBeInTheDocument();
  });
});

// ─── Legend ──────────────────────────────────────────────────────────

describe("<CometChart /> — legend", () => {
  it("shows legend for multi-entity charts", () => {
    const { getAllByText } = render(
      <CometChart points={twoTeamTwoSeason} entityKey="team" xKey="npxg" yKey="npxga" />,
    );

    // Legend items should be present (also appears in SVG labels, so use getAll)
    expect(getAllByText("Arsenal").length).toBeGreaterThanOrEqual(2); // SVG label + legend
    expect(getAllByText("Chelsea").length).toBeGreaterThanOrEqual(2);
  });

  it("hides legend for single entity", () => {
    const { container } = render(
      <CometChart points={singleEntity} entityKey="team" xKey="npxg" yKey="npxga" />,
    );

    // Single entity = no legend section rendered below the SVG wrapper
    const svg = container.querySelector("svg");
    const nextSibling = svg?.parentElement?.nextElementSibling;
    expect(nextSibling).toBeNull();
  });
});

// ─── Theme ──────────────────────────────────────────────────────────

describe("<CometChart /> — theme", () => {
  it("renders with dark theme via context", () => {
    const { container } = render(
      <ThemeProvider value={DARK_THEME}>
        <CometChart points={twoTeamTwoSeason} entityKey="team" xKey="npxg" yKey="npxga" />
      </ThemeProvider>,
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    // Dark theme should have dark background — browser normalizes hex to rgb
    expect(svg!.style.background).toBeTruthy();
  });
});

// ─── Accessibility ──────────────────────────────────────────────────

describe("<CometChart /> — accessibility", () => {
  it("has accessible section label", () => {
    const { getByLabelText } = render(
      <CometChart
        points={twoTeamTwoSeason}
        entityKey="team"
        xKey="npxg"
        yKey="npxga"
        xLabel="npxG per 90"
        yLabel="npxGA per 90"
      />,
    );

    expect(getByLabelText(/Comet chart.*npxG per 90.*npxGA per 90/)).toBeInTheDocument();
  });

  it("markers are focusable", () => {
    const { container } = render(
      <CometChart points={twoTeamTwoSeason} entityKey="team" xKey="npxg" yKey="npxga" />,
    );

    const markers = container.querySelectorAll("[aria-label^='Entity: '][tabindex='0']");
    expect(markers.length).toBe(4);
  });

  it("shows the hovered point tooltip rather than always the latest entity point", () => {
    const { getByLabelText, getByTestId } = render(
      <CometChart
        points={twoTeamTwoSeason}
        entityKey="team"
        xKey="npxg"
        yKey="npxga"
        timeKey="season"
      />,
    );

    fireEvent.mouseEnter(
      getByLabelText(/Entity: Arsenal, Period: 2021-22, npxg: 1, npxga: 1.5/i),
    );

    expect(getByTestId("cometchart-tooltip").textContent).toContain("2021-22");
    expect(getByTestId("cometchart-tooltip").textContent).not.toContain("2022-23");
  });
});
