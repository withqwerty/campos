import { describe, expect, it } from "vitest";

import { computeBumpChart, type BumpChartRow } from "../../src/compute/index";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<BumpChartRow> = {}): BumpChartRow {
  return {
    team: "LIV",
    timepoint: 1,
    rank: 1,
    label: "Liverpool",
    ...overrides,
  };
}

/** Build a simple 3-team, 5-matchweek dataset. */
function threeTeamFixture(): BumpChartRow[] {
  return [
    // Liverpool — holds 1st
    ...Array.from({ length: 5 }, (_, i) =>
      makeRow({ team: "LIV", label: "Liverpool", timepoint: i + 1, rank: 1 }),
    ),
    // Man City — 2nd → 3rd → 2nd
    makeRow({ team: "MCI", label: "Man City", timepoint: 1, rank: 2 }),
    makeRow({ team: "MCI", label: "Man City", timepoint: 2, rank: 3 }),
    makeRow({ team: "MCI", label: "Man City", timepoint: 3, rank: 2 }),
    makeRow({ team: "MCI", label: "Man City", timepoint: 4, rank: 2 }),
    makeRow({ team: "MCI", label: "Man City", timepoint: 5, rank: 2 }),
    // Man Utd — varies
    makeRow({ team: "MUN", label: "Man Utd", timepoint: 1, rank: 5 }),
    makeRow({ team: "MUN", label: "Man Utd", timepoint: 2, rank: 4 }),
    makeRow({ team: "MUN", label: "Man Utd", timepoint: 3, rank: 6 }),
    makeRow({ team: "MUN", label: "Man Utd", timepoint: 4, rank: 5 }),
    makeRow({ team: "MUN", label: "Man Utd", timepoint: 5, rank: 3 }),
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("computeBumpChart", () => {
  // ---- empty / edge states ------------------------------------------------

  it("returns emptyState when rows array is empty", () => {
    const model = computeBumpChart({ rows: [] });

    expect(model.meta.empty).toBe(true);
    expect(model.meta.totalRows).toBe(0);
    expect(model.meta.validRows).toBe(0);
    expect(model.emptyState).toEqual({ message: "No ranking data" });
    expect(model.lines).toHaveLength(0);
    expect(model.endLabels).toHaveLength(0);
    // Empty model provides sensible defaults
    expect(model.axes.x.domain).toEqual([1, 38]);
    expect(model.axes.y.domain).toEqual([1, 20]);
  });

  it("handles a single team producing a valid line", () => {
    const rows = [
      makeRow({ timepoint: 1, rank: 3 }),
      makeRow({ timepoint: 2, rank: 2 }),
      makeRow({ timepoint: 3, rank: 1 }),
    ];

    const model = computeBumpChart({ rows });

    expect(model.meta.empty).toBe(false);
    expect(model.meta.totalTeams).toBe(1);
    expect(model.lines).toHaveLength(1);
    expect(model.lines[0]!.team).toBe("LIV");
    expect(model.lines[0]!.points).toHaveLength(3);
    expect(model.meta.warnings).toContain(
      "Only 1 team in data; bump chart has limited comparison value",
    );
  });

  // ---- validation ---------------------------------------------------------

  it("excludes rows with invalid rank and emits a warning", () => {
    const rows = [
      makeRow({ team: "LIV", timepoint: 1, rank: 1 }),
      makeRow({ team: "BAD", timepoint: 1, rank: -1 }), // invalid: rank < 1
      makeRow({ team: "BAD2", timepoint: 1, rank: 0 }), // invalid: rank < 1
    ];

    const model = computeBumpChart({ rows });

    expect(model.meta.validRows).toBe(1);
    expect(model.meta.totalRows).toBe(3);
    expect(model.meta.warnings.some((w) => w.includes("2 row(s) excluded"))).toBe(true);
  });

  it("excludes rows with missing team", () => {
    const rows = [
      makeRow({ team: "", timepoint: 1, rank: 1 }),
      makeRow({ team: "LIV", timepoint: 1, rank: 2 }),
    ];

    const model = computeBumpChart({ rows });
    expect(model.meta.validRows).toBe(1);
  });

  it("excludes rows with non-finite timepoint", () => {
    const rows = [
      makeRow({ timepoint: NaN, rank: 1 }),
      makeRow({ timepoint: 1, rank: 2 }),
    ];

    const model = computeBumpChart({ rows });
    expect(model.meta.validRows).toBe(1);
  });

  // ---- multiple teams and line construction --------------------------------

  it("creates correct number of lines for multiple teams", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({ rows });

    expect(model.meta.totalTeams).toBe(3);
    expect(model.lines).toHaveLength(3);
    expect(model.lines.map((l) => l.team).sort()).toEqual(["LIV", "MCI", "MUN"]);
  });

  it("builds valid SVG path strings starting with M", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({ rows });

    for (const line of model.lines) {
      expect(line.path).toMatch(/^M /);
      expect(line.path.length).toBeGreaterThan(5);
    }
  });

  it("produces smooth (cubic Bezier) path for smooth interpolation", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({ rows, interpolation: "smooth" });

    // Smooth paths contain 'C' commands for cubic Bezier
    const utd = model.lines.find((l) => l.team === "MUN")!;
    expect(utd.path).toContain("C ");
  });

  it("produces linear path (no Bezier) for linear interpolation", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({ rows, interpolation: "linear" });

    const utd = model.lines.find((l) => l.team === "MUN")!;
    expect(utd.path).not.toContain("C ");
    expect(utd.path).toContain("L ");
  });

  // ---- rank inversion (y-axis) --------------------------------------------

  it("maps rank 1 to the top of the plot area (lower cy)", () => {
    const rows = [
      makeRow({ team: "A", timepoint: 1, rank: 1 }),
      makeRow({ team: "B", timepoint: 1, rank: 10 }),
    ];

    const model = computeBumpChart({ rows, rankDomain: [1, 10] });

    const teamA = model.lines.find((l) => l.team === "A")!;
    const teamB = model.lines.find((l) => l.team === "B")!;

    // Rank 1 should have a LOWER cy than rank 10 (SVG y increases downward)
    expect(teamA.points[0]!.cy).toBeLessThan(teamB.points[0]!.cy);
  });

  // ---- highlighting -------------------------------------------------------

  it("marks highlighted teams correctly when highlightTeams is set", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({
      rows,
      highlightTeams: ["LIV", "MCI"],
    });

    const liv = model.lines.find((l) => l.team === "LIV")!;
    const mci = model.lines.find((l) => l.team === "MCI")!;
    const mun = model.lines.find((l) => l.team === "MUN")!;

    expect(liv.highlighted).toBe(true);
    expect(mci.highlighted).toBe(true);
    expect(mun.highlighted).toBe(false);
  });

  it("treats all teams as highlighted when highlightTeams is omitted", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({ rows });

    for (const line of model.lines) {
      expect(line.highlighted).toBe(true);
    }
  });

  it("truncates highlightTeams beyond MAX_HIGHLIGHT (7) with warning", () => {
    const rows: BumpChartRow[] = [];
    for (let i = 0; i < 10; i++) {
      rows.push(makeRow({ team: `T${i}`, timepoint: 1, rank: i + 1 }));
    }

    const model = computeBumpChart({
      rows,
      highlightTeams: Array.from({ length: 10 }, (_, i) => `T${i}`),
    });

    const highlighted = model.lines.filter((l) => l.highlighted);
    expect(highlighted.length).toBe(7);
    expect(model.meta.warnings.some((w) => w.includes("truncated to 7"))).toBe(true);
  });

  // ---- end labels ----------------------------------------------------------

  it("generates end labels for highlighted teams", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({ rows, highlightTeams: ["LIV"] });

    expect(model.endLabels).toHaveLength(1);
    expect(model.endLabels[0]!.team).toBe("LIV");
  });

  it("emits end labels for every team when endLabelsForAllTeams is true", () => {
    // Regression: full-league bump charts (20 teams, a subset highlighted)
    // need every line to remain identifiable — the label must not drop off
    // non-highlighted lines just because they sit in the background.
    const rows = threeTeamFixture();
    const model = computeBumpChart({
      rows,
      highlightTeams: ["LIV"],
      endLabelsForAllTeams: true,
    });

    const labeledTeams = model.endLabels.map((l) => l.team).sort();
    expect(labeledTeams).toEqual(["LIV", "MCI", "MUN"]);
  });

  it("emits start labels for every team when startLabelsForAllTeams is true", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({
      rows,
      highlightTeams: ["LIV"],
      showStartLabels: true,
      startLabelsForAllTeams: true,
    });

    const labeledTeams = model.startLabels.map((l) => l.team).sort();
    expect(labeledTeams).toEqual(["LIV", "MCI", "MUN"]);
  });

  it("avoids end label overlap (min gap)", () => {
    // Two teams at adjacent ranks — labels should be spaced apart
    const rows = [
      makeRow({ team: "A", timepoint: 1, rank: 1 }),
      makeRow({ team: "B", timepoint: 1, rank: 2 }),
    ];

    const model = computeBumpChart({ rows, rankDomain: [1, 2] });

    expect(model.endLabels).toHaveLength(2);
    const yGap = Math.abs(model.endLabels[0]!.y - model.endLabels[1]!.y);
    expect(yGap).toBeGreaterThanOrEqual(12);
  });

  it("hides end labels when showEndLabels is false", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({ rows, showEndLabels: false });

    expect(model.endLabels).toHaveLength(0);
  });

  it("warns when teams have gaps in timepoints (lines silently bridge)", () => {
    // TeamA covers MW 1-3; TeamB covers MW 1-3; TeamC is missing MW 2.
    const rows = [
      makeRow({ team: "A", timepoint: 1, rank: 1 }),
      makeRow({ team: "A", timepoint: 2, rank: 1 }),
      makeRow({ team: "A", timepoint: 3, rank: 1 }),
      makeRow({ team: "B", timepoint: 1, rank: 2 }),
      makeRow({ team: "B", timepoint: 2, rank: 2 }),
      makeRow({ team: "B", timepoint: 3, rank: 2 }),
      makeRow({ team: "C", timepoint: 1, rank: 3 }),
      makeRow({ team: "C", timepoint: 3, rank: 3 }),
    ];
    const model = computeBumpChart({ rows });
    const warning = model.meta.warnings.find((w) => w.includes("gaps in timepoints"));
    expect(warning).toBeDefined();
    expect(warning).toContain("C");
  });

  it("truncates surrogate-pair labels at grapheme boundaries (does not tear emoji)", () => {
    // The flag emoji '🇩🇪' is two regional-indicator surrogate pairs (4 UTF-16
    // code units). A naive .slice would tear it; Array.from-based truncate
    // must keep it intact when the slice budget allows.
    const rows = [
      makeRow({ team: "DE", label: "🇩🇪 Deutschland", timepoint: 1, rank: 1 }),
      makeRow({ team: "DE", label: "🇩🇪 Deutschland", timepoint: 2, rank: 1 }),
    ];
    const model = computeBumpChart({ rows, showEndLabels: true });
    const label = model.endLabels[0]!.teamLabel;
    // The flag should be intact at the head of the truncated label
    expect(label.startsWith("🇩🇪")).toBe(true);
  });

  // ---- start labels --------------------------------------------------------

  it("generates start labels when showStartLabels is true", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({ rows, showStartLabels: true });

    expect(model.startLabels).toHaveLength(3);
    expect(model.startLabels[0]!.x).toBeLessThan(model.endLabels[0]!.x);
  });

  // ---- rank domain ---------------------------------------------------------

  it("infers rank domain from data when not explicit", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({ rows });

    expect(model.axes.y.domain[0]).toBe(1); // min rank in data
    expect(model.axes.y.domain[1]).toBe(6); // max rank in data
  });

  it("uses explicit rank domain when provided", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({ rows, rankDomain: [1, 20] });

    expect(model.axes.y.domain).toEqual([1, 20]);
    expect(model.axes.y.ticks).toHaveLength(20);
  });

  // ---- x-axis tick density ------------------------------------------------

  it("thins x-axis ticks when there are more than 20 timepoints", () => {
    const rows: BumpChartRow[] = [];
    for (let t = 1; t <= 38; t++) {
      rows.push(makeRow({ timepoint: t, rank: 1 }));
    }

    const model = computeBumpChart({ rows });

    expect(model.axes.x.ticks.length).toBeLessThanOrEqual(20);
    // First and last timepoint should always be included
    expect(model.axes.x.ticks[0]).toBe(1);
    expect(model.axes.x.ticks[model.axes.x.ticks.length - 1]).toBe(38);
  });

  // ---- team colors ---------------------------------------------------------

  it("applies custom team colors from teamColors prop", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({
      rows,
      teamColors: { LIV: "#ff0000", MCI: "#00ff00" },
    });

    const liv = model.lines.find((l) => l.team === "LIV")!;
    const mci = model.lines.find((l) => l.team === "MCI")!;

    expect(liv.color).toBe("#ff0000");
    expect(mci.color).toBe("#00ff00");
  });

  it("assigns background color to non-highlighted teams", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({
      rows,
      highlightTeams: ["LIV"],
      teamColors: { LIV: "#ff0000" },
    });

    const mun = model.lines.find((l) => l.team === "MUN")!;
    expect(mun.color).toBe("#888888"); // BACKGROUND_COLOR
  });

  // ---- axis labels ----------------------------------------------------------

  it("uses custom axis labels when provided", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({
      rows,
      timepointLabel: "Gameweek",
      rankLabel: "League Position",
    });

    expect(model.axes.x.label).toBe("Gameweek");
    expect(model.axes.y.label).toBe("League Position");
  });

  it("uses default axis labels when not provided", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({ rows });

    expect(model.axes.x.label).toBe("Matchweek");
    expect(model.axes.y.label).toBe("Position");
  });

  // ---- accessible label ----------------------------------------------------

  it("generates an accessible label with team and timepoint counts", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({ rows });

    expect(model.meta.accessibleLabel).toContain("3 teams");
    expect(model.meta.accessibleLabel).toContain("5 matchweeks");
  });

  // ---- final/start rank tracking -------------------------------------------

  it("tracks finalRank and startRank correctly", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({ rows });

    const mun = model.lines.find((l) => l.team === "MUN")!;
    expect(mun.startRank).toBe(5);
    expect(mun.finalRank).toBe(3);
  });

  // ---- rendering order (background behind highlighted) --------------------

  it("renders background teams before highlighted teams", () => {
    const rows = threeTeamFixture();
    const model = computeBumpChart({
      rows,
      highlightTeams: ["LIV"],
    });

    // Highlighted teams should come LAST in the lines array (drawn on top)
    const lastLine = model.lines[model.lines.length - 1]!;
    expect(lastLine.highlighted).toBe(true);
    expect(lastLine.team).toBe("LIV");

    const firstLine = model.lines[0]!;
    expect(firstLine.highlighted).toBe(false);
  });
});
