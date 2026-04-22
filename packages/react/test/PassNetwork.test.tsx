import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it } from "vitest";

import type { PassNetworkEdge, PassNetworkNode } from "../src/compute/index.js";

import { PassNetwork } from "../src/index";

afterEach(cleanup);

const nodes: PassNetworkNode[] = [
  { id: "gk", label: "Raya", x: 10, y: 50, passCount: 30, xT: 0.05 },
  { id: "cb1", label: "Saliba", x: 25, y: 35, passCount: 40, xT: 0.1 },
  { id: "cb2", label: "Gabriel", x: 25, y: 65, passCount: 38, xT: 0.08 },
  { id: "cm", label: "Rice", x: 55, y: 50, passCount: 55, xT: 0.25 },
  { id: "am", label: "Ødegaard", x: 70, y: 40, passCount: 45, xT: 0.4 },
];

const edges: PassNetworkEdge[] = [
  { sourceId: "gk", targetId: "cb1", passCount: 10, xT: 0.01 },
  { sourceId: "gk", targetId: "cb2", passCount: 9, xT: 0.02 },
  { sourceId: "cb1", targetId: "cm", passCount: 12, xT: 0.03 },
  { sourceId: "cm", targetId: "am", passCount: 15, xT: 0.05 },
];

// ─── Rendering ──────────────────────────────────────────────────────

describe("<PassNetwork /> — rendering", () => {
  it("renders the zero-config shell with header stats and legend", () => {
    const { getByLabelText, getByText } = render(
      <PassNetwork nodes={nodes} edges={edges} />,
    );

    expect(
      getByLabelText(/Passing network: 5 players, 4 connections/),
    ).toBeInTheDocument();
    expect(getByText("Players")).toBeInTheDocument();
    expect(getByText("Connections")).toBeInTheDocument();
    expect(getByText("Threshold")).toBeInTheDocument();
    expect(getByText(/≥4 passes/)).toBeInTheDocument();
  });

  it("renders the empty state when nodes is empty", () => {
    const { getByText, queryByTestId } = render(<PassNetwork nodes={[]} edges={[]} />);
    expect(getByText("No passing network data")).toBeInTheDocument();
    expect(queryByTestId("passnetwork-tooltip")).not.toBeInTheDocument();
  });

  it("renders one interactive group per node and per edge", () => {
    const { container } = render(<PassNetwork nodes={nodes} edges={edges} />);
    const interactives = within(container).getAllByRole("button");
    // 5 nodes + 4 edges = 9
    expect(interactives).toHaveLength(9);
  });

  it("renders labels inside nodes whose radius clears the legibility floor", () => {
    const { getByText } = render(<PassNetwork nodes={nodes} edges={edges} />);
    // Rice has the max passCount (max radius) and Ødegaard is second-largest —
    // both clear MIN_LABEL_RADIUS. Raya has the min passCount and is below the
    // floor, so her label is correctly suppressed.
    expect(getByText("Rice")).toBeInTheDocument();
    expect(getByText("Ødegaard")).toBeInTheDocument();
  });

  it("hides all labels when showLabels is false", () => {
    const { queryByText } = render(
      <PassNetwork nodes={nodes} edges={edges} showLabels={false} />,
    );
    expect(queryByText("Rice")).not.toBeInTheDocument();
    expect(queryByText("Ødegaard")).not.toBeInTheDocument();
  });

  it("renders no edges below the threshold", () => {
    const below: PassNetworkEdge[] = [{ sourceId: "gk", targetId: "cb1", passCount: 2 }];
    const { container } = render(<PassNetwork nodes={nodes} edges={below} />);
    const interactives = within(container).getAllByRole("button");
    // 5 nodes + 0 edges
    expect(interactives).toHaveLength(5);
  });

  it("shows the no-edges-above-threshold fallback pill when appropriate", () => {
    const below: PassNetworkEdge[] = [{ sourceId: "gk", targetId: "cb1", passCount: 2 }];
    const { getByText } = render(<PassNetwork nodes={nodes} edges={below} />);
    expect(getByText("No connections above threshold")).toBeInTheDocument();
  });
});

// ─── Interaction ────────────────────────────────────────────────────

describe("<PassNetwork /> — interaction", () => {
  it("shows a tooltip with node detail on focus", () => {
    const { getAllByRole, getByTestId } = render(
      <PassNetwork nodes={nodes} edges={edges} />,
    );
    const interactives = getAllByRole("button");
    // First 4 are edges (rendered first), next 5 are nodes.
    const nodeGroup = interactives.find((el) =>
      (el.getAttribute("aria-label") ?? "").includes("Player: Raya"),
    );
    expect(nodeGroup).toBeDefined();
    fireEvent.focus(nodeGroup!);
    const tooltip = getByTestId("passnetwork-tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.textContent).toContain("Raya");
    expect(tooltip.textContent).toContain("30");
  });

  it("shows a tooltip with edge detail on focus", () => {
    const { getAllByRole, getByTestId } = render(
      <PassNetwork nodes={nodes} edges={edges} />,
    );
    const interactives = getAllByRole("button");
    const edgeGroup = interactives.find((el) =>
      (el.getAttribute("aria-label") ?? "").includes("Connection"),
    );
    expect(edgeGroup).toBeDefined();
    fireEvent.focus(edgeGroup!);
    const tooltip = getByTestId("passnetwork-tooltip");
    expect(tooltip.textContent).toContain("Connection");
  });

  it("toggles a tooltip on click and clears when clicked again", () => {
    const { getAllByRole, queryByTestId } = render(
      <PassNetwork nodes={nodes} edges={edges} />,
    );
    const nodeGroup = getAllByRole("button").find((el) =>
      (el.getAttribute("aria-label") ?? "").includes("Player: Rice"),
    )!;
    fireEvent.click(nodeGroup);
    expect(queryByTestId("passnetwork-tooltip")).toBeInTheDocument();
    fireEvent.click(nodeGroup);
    expect(queryByTestId("passnetwork-tooltip")).not.toBeInTheDocument();
  });

  it("dims non-related nodes when a node is focused (ego highlight)", () => {
    // Fixture: 5 nodes, edges gk↔cb1, gk↔cb2, cb1↔cm, cm↔am.
    // Focusing gk (Raya) → related set = {gk, cb1, cb2}, non-related = {cm, am}.
    const { getAllByRole, container } = render(
      <PassNetwork nodes={nodes} edges={edges} />,
    );
    const gkNode = getAllByRole("button").find((el) =>
      (el.getAttribute("aria-label") ?? "").includes("Player: Raya"),
    );
    expect(gkNode).toBeDefined();
    fireEvent.focus(gkNode!);
    const dimmedCount = Array.from(container.querySelectorAll('g[role="button"]')).filter(
      (g) => g.getAttribute("opacity") === "0.25",
    ).length;
    expect(dimmedCount).toBe(2);
  });

  it("disables ego highlight when egoHighlight=false", () => {
    const { getAllByRole, container } = render(
      <PassNetwork nodes={nodes} edges={edges} egoHighlight={false} />,
    );
    const gkNode = getAllByRole("button").find((el) =>
      (el.getAttribute("aria-label") ?? "").includes("Player: Raya"),
    )!;
    fireEvent.focus(gkNode);
    const dimmedCount = Array.from(container.querySelectorAll('g[role="button"]')).filter(
      (g) => g.getAttribute("opacity") === "0.25",
    ).length;
    expect(dimmedCount).toBe(0);
  });
});

// ─── Directed mode ──────────────────────────────────────────────────

describe("<PassNetwork /> — directed mode", () => {
  const dirNodes: PassNetworkNode[] = [
    { id: "a", label: "Aardvark", x: 20, y: 50, passCount: 20 },
    { id: "b", label: "Bear", x: 80, y: 50, passCount: 20 },
  ];
  const dirEdges: PassNetworkEdge[] = [
    { sourceId: "a", targetId: "b", passCount: 10 },
    { sourceId: "b", targetId: "a", passCount: 6 },
  ];

  it("renders lines with arrowhead markers when directed", () => {
    const { container } = render(
      <PassNetwork nodes={dirNodes} edges={dirEdges} directed={true} />,
    );
    const edgeGroups = Array.from(container.querySelectorAll('g[role="button"]')).filter(
      (g) => (g.getAttribute("aria-label") ?? "").includes("Connection"),
    );
    // A→B and B→A stay distinct
    expect(edgeGroups).toHaveLength(2);
    // Each directed edge is a line with markerEnd pointing at a shared defs arrow
    for (const g of edgeGroups) {
      const visible = Array.from(g.querySelectorAll("line")).find((line) =>
        line.getAttribute("marker-end")?.startsWith("url(#pn-arrow-"),
      );
      expect(visible).toBeDefined();
    }
    // Shared defs marker(s) exist — at least one for the current team color
    const markers = Array.from(container.querySelectorAll('marker[id^="pn-arrow-"]'));
    expect(markers.length).toBeGreaterThan(0);
  });

  it("lays reversed-pair directed edges on opposite sides of the pair axis", () => {
    // A at (20, 50), B at (80, 50) — canonical pair axis is horizontal.
    // A perpendicular offset separates the two directions vertically:
    // the A→B arrow should sit on one side (e.g. y < axis) and the B→A
    // arrow on the other (y > axis). Asserting the y1 coordinates of the
    // visible <line>s are DIFFERENT is enough to prove the reversed-pair
    // bug (both arrows overlapping on the same side) can't come back.
    const { container } = render(
      <PassNetwork nodes={dirNodes} edges={dirEdges} directed={true} />,
    );
    const visibleLines = Array.from(container.querySelectorAll('g[role="button"]'))
      .filter((g) => (g.getAttribute("aria-label") ?? "").includes("Connection"))
      .map((g) =>
        Array.from(g.querySelectorAll("line")).find(
          (l) => l.getAttribute("stroke") !== "transparent",
        ),
      )
      .filter((l): l is SVGLineElement => l != null);
    expect(visibleLines).toHaveLength(2);
    const y1a = Number(visibleLines[0]!.getAttribute("y1"));
    const y1b = Number(visibleLines[1]!.getAttribute("y1"));
    expect(y1a).not.toBe(y1b);
    // And specifically the two y offsets should be symmetric around the
    // axis y=mid (approximately — both nodes are at y=50 in Campos).
    // They should differ by ~2 × PAIR_OFFSET_METERS (~1.6m in SVG user units).
    expect(Math.abs(y1a - y1b)).toBeGreaterThan(1);
  });

  it("renders straight lines without markerEnd when directed is false (default)", () => {
    const { container } = render(<PassNetwork nodes={dirNodes} edges={dirEdges} />);
    const edgeGroups = Array.from(container.querySelectorAll('g[role="button"]')).filter(
      (g) => (g.getAttribute("aria-label") ?? "").includes("Connection"),
    );
    // Merged into a single undirected edge
    expect(edgeGroups).toHaveLength(1);
    expect(edgeGroups[0]!.querySelectorAll("line").length).toBeGreaterThan(0);
    // No arrowhead marker on the undirected line
    const visible = Array.from(edgeGroups[0]!.querySelectorAll("line")).find(
      (l) => (l.getAttribute("marker-end") ?? "").length > 0,
    );
    expect(visible).toBeUndefined();
  });
});

// ─── Accessibility ──────────────────────────────────────────────────

describe("<PassNetwork /> — accessibility", () => {
  it("has no axe violations on the baseline render", async () => {
    const { container } = render(<PassNetwork nodes={nodes} edges={edges} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations in empty state", async () => {
    const { container } = render(<PassNetwork nodes={[]} edges={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("<PassNetwork /> — style injection", () => {
  it("applies constant, map, and callback node/edge styles", () => {
    render(
      <PassNetwork
        nodes={nodes}
        edges={edges}
        nodeStyle={{
          fill: {
            by: ({ rawNode }) => rawNode?.id,
            values: {
              gk: "#2563eb",
              cm: "#dc2626",
            },
            fallback: "#94a3b8",
          },
          shape: ({ rawNode }) => (rawNode?.id === "gk" ? "square" : "circle"),
          stroke: "#0f172a",
        }}
        edgeStyle={{
          stroke: ({ rawEdge }) =>
            rawEdge?.passCount != null && rawEdge.passCount >= 12 ? "#f59e0b" : "#16a34a",
          strokeDasharray: {
            by: ({ rawEdge }) =>
              rawEdge == null
                ? undefined
                : [rawEdge.sourceId, rawEdge.targetId].sort().join("::"),
            values: { "cb1::gk": "5 3" },
          },
          opacity: 0.65,
        }}
      />,
    );

    const rayaNode = screen.getByRole("button", { name: /Player: Raya/ });
    const rayaVisibleRect = Array.from(rayaNode.querySelectorAll("rect")).find(
      (rect) => rect.getAttribute("fill") === "#2563eb",
    );
    expect(rayaVisibleRect).toBeTruthy();
    expect(rayaVisibleRect?.getAttribute("stroke")).toBe("#0f172a");

    const highlightedEdge = screen.getByRole("button", {
      name: /Connection: Saliba ↔ Rice/,
    });
    const highlightedLine = Array.from(highlightedEdge.querySelectorAll("line")).find(
      (line) => line.getAttribute("stroke") === "#f59e0b",
    );
    expect(highlightedLine).toBeTruthy();

    const keeperEdge = screen.getByRole("button", {
      name: /Connection: Saliba ↔ Raya/,
    });
    const dashedLine = Array.from(keeperEdge.querySelectorAll("line")).find(
      (line) => line.getAttribute("stroke-dasharray") === "5 3",
    );
    expect(dashedLine).toBeTruthy();
  });

  it("can hide nodes and edges through the style surface", () => {
    const { queryByRole } = render(
      <PassNetwork
        nodes={nodes}
        edges={edges}
        nodeStyle={{
          show: ({ rawNode }) => rawNode?.id !== "am",
        }}
        edgeStyle={{
          show: ({ rawEdge }) => rawEdge?.sourceId !== "cm",
        }}
      />,
    );

    expect(queryByRole("button", { name: /Player: Ødegaard/ })).not.toBeInTheDocument();
    expect(
      queryByRole("button", { name: /Connection: Rice → Ødegaard/ }),
    ).not.toBeInTheDocument();
  });
});
