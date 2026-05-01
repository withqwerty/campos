import { describe, expect, it } from "vitest";

import {
  computePassNetwork,
  type PassNetworkEdge,
  type PassNetworkNode,
} from "../../src/compute/index";

// ─── Shared fixtures ────────────────────────────────────────────────

const baseNodes: PassNetworkNode[] = [
  { id: "gk", label: "Raya", x: 10, y: 50, passCount: 30, xT: 0.05 },
  { id: "cb1", label: "Saliba", x: 25, y: 35, passCount: 40, xT: 0.1 },
  { id: "cb2", label: "Gabriel", x: 25, y: 65, passCount: 38, xT: 0.08 },
  { id: "rb", label: "White", x: 35, y: 20, passCount: 28, xT: 0.15 },
  { id: "lb", label: "Calafiori", x: 35, y: 80, passCount: 32, xT: 0.18 },
  { id: "cm", label: "Rice", x: 55, y: 50, passCount: 55, xT: 0.25 },
  { id: "am", label: "Odegaard", x: 70, y: 40, passCount: 45, xT: 0.4 },
  { id: "st", label: "Havertz", x: 85, y: 50, passCount: 15, xT: 0.5 },
];

const baseEdges: PassNetworkEdge[] = [
  { sourceId: "gk", targetId: "cb1", passCount: 10, xT: 0.01 },
  { sourceId: "gk", targetId: "cb2", passCount: 8, xT: 0.02 },
  { sourceId: "cb1", targetId: "cm", passCount: 12, xT: 0.03 },
  { sourceId: "cb2", targetId: "cm", passCount: 11, xT: 0.02 },
  { sourceId: "cm", targetId: "am", passCount: 15, xT: 0.05 },
  { sourceId: "am", targetId: "st", passCount: 7, xT: 0.1 },
  { sourceId: "lb", targetId: "cm", passCount: 5, xT: 0.04 },
  { sourceId: "rb", targetId: "cm", passCount: 3, xT: 0.02 }, // below default threshold
];

// ─── Empty + minimal shapes ─────────────────────────────────────────

describe("computePassNetwork — empty + minimal", () => {
  it("returns the empty-state model when nodes is empty", () => {
    const model = computePassNetwork({ nodes: [], edges: [] });
    expect(model.meta.empty).toBe(true);
    expect(model.meta.accessibleLabel).toBe("Passing network: 0 players, 0 connections");
    expect(model.emptyState?.message).toBe("No passing network data");
    expect(model.plot.nodes).toEqual([]);
    expect(model.plot.edges).toEqual([]);
    expect(model.legend).toBeNull();
    expect(model.headerStats?.items).toEqual([
      { label: "Players", value: "0" },
      { label: "Connections", value: "0" },
    ]);
  });

  it("renders nodes and no edges when edges is empty", () => {
    const model = computePassNetwork({ nodes: baseNodes, edges: [] });
    expect(model.plot.nodes).toHaveLength(baseNodes.length);
    expect(model.plot.edges).toHaveLength(0);
    expect(model.meta.noEdgesAboveThreshold).toBe(true);
    expect(model.emptyState?.message).toBe("No connections above threshold");
  });

  it("renders a single node at the midRadius (degenerate domain)", () => {
    // Full pitch short side = 68m; midRadius = 68 × (0.055 + 0.025) / 2 = 2.72m
    const model = computePassNetwork({
      nodes: [baseNodes[0]!],
      edges: [],
    });
    expect(model.plot.nodes).toHaveLength(1);
    expect(model.plot.nodes[0]!.radius).toBeCloseTo(2.72, 2);
    expect(model.plot.nodes[0]!.sizeWeight).toBe(0.5);
  });
});

// ─── Baseline happy path ────────────────────────────────────────────

describe("computePassNetwork — baseline", () => {
  it("applies the default minEdgePasses=4 threshold", () => {
    const model = computePassNetwork({ nodes: baseNodes, edges: baseEdges });
    // 7 edges ≥ 4; the rb-cm edge (3 passes) is dropped
    expect(model.plot.edges).toHaveLength(7);
    const kept = model.plot.edges.map((e) => `${e.sourceId}::${e.targetId}`);
    expect(kept).not.toContain("cm::rb");
    expect(kept).not.toContain("rb::cm");
  });

  it("honours a custom minEdgePasses", () => {
    const model = computePassNetwork({
      nodes: baseNodes,
      edges: baseEdges,
      minEdgePasses: 10,
    });
    expect(model.plot.edges).toHaveLength(4);
  });

  it("emits header stats reflecting the filtered totals", () => {
    const model = computePassNetwork({ nodes: baseNodes, edges: baseEdges });
    expect(model.headerStats?.items).toEqual([
      { label: "Players", value: "8" },
      { label: "Connections", value: "7" },
      { label: "Threshold", value: "≥4 passes" },
    ]);
  });

  it("produces a legend with size + width + team-color row", () => {
    const model = computePassNetwork({ nodes: baseNodes, edges: baseEdges });
    const kinds = model.legend?.rows.map((r) => r.kind);
    expect(kinds).toContain("size");
    expect(kinds).toContain("width");
  });

  it("stamps a deterministic accessible label", () => {
    const model = computePassNetwork({ nodes: baseNodes, edges: baseEdges });
    expect(model.meta.accessibleLabel).toBe("Passing network: 8 players, 7 connections");
  });
});

// ─── Scaling ────────────────────────────────────────────────────────

describe("computePassNetwork — scaling", () => {
  // Full pitch short side = 68m ⇒
  //   minRadius = 68 × 0.025 = 1.70m
  //   maxRadius = 68 × 0.055 = 3.74m
  //   midRadius = 2.72m
  //   minWidth  = 68 × 0.004 = 0.272m
  //   maxWidth  = 68 × 0.022 = 1.496m
  //   midWidth  = 0.884m
  // Half pitch short side = 52.5m ⇒ same ratios applied to 52.5.

  it("uses midRadius for degenerate equal-count nodes on a full pitch", () => {
    const nodes: PassNetworkNode[] = [
      { id: "a", label: "A", x: 20, y: 50, passCount: 10 },
      { id: "b", label: "B", x: 40, y: 50, passCount: 10 },
      { id: "c", label: "C", x: 60, y: 50, passCount: 10 },
    ];
    const model = computePassNetwork({ nodes, edges: [] });
    for (const n of model.plot.nodes) {
      expect(n.radius).toBeCloseTo(2.72, 2);
      expect(n.sizeWeight).toBe(0.5);
    }
    expect(model.legend?.rows.find((r) => r.kind === "size")).toBeUndefined();
  });

  it("uses midWidth for degenerate equal-count edges on a full pitch", () => {
    const edges: PassNetworkEdge[] = [
      { sourceId: "gk", targetId: "cb1", passCount: 8 },
      { sourceId: "cb1", targetId: "cm", passCount: 8 },
    ];
    const model = computePassNetwork({ nodes: baseNodes, edges });
    for (const e of model.plot.edges) {
      expect(e.width).toBeCloseTo(0.884, 3);
    }
    expect(model.legend?.rows.find((r) => r.kind === "width")).toBeUndefined();
  });

  it("maps the max passCount to the max radius on a full pitch", () => {
    const model = computePassNetwork({ nodes: baseNodes, edges: baseEdges });
    const cm = model.plot.nodes.find((n) => n.id === "cm");
    expect(cm).toBeDefined();
    expect(cm!.radius).toBeCloseTo(3.74, 2);
    expect(cm!.sizeWeight).toBe(1);
  });

  it("emits a labelFontSize proportional to radius", () => {
    const model = computePassNetwork({ nodes: baseNodes, edges: baseEdges });
    for (const n of model.plot.nodes) {
      // LABEL_FONT_RATIO = 0.72
      expect(n.labelFontSize).toBeCloseTo(n.radius * 0.72, 4);
    }
  });
});

// ─── Coordinates ────────────────────────────────────────────────────

describe("computePassNetwork — coordinates", () => {
  it("clamps out-of-range coordinates and records a warning", () => {
    const model = computePassNetwork({
      nodes: [
        { id: "a", label: "A", x: -10, y: 120, passCount: 5 },
        { id: "b", label: "B", x: 50, y: 50, passCount: 5 },
      ],
      edges: [],
    });
    const a = model.plot.nodes.find((n) => n.id === "a");
    expect(a?.x).toBe(0);
    expect(a?.y).toBe(100);
    expect(model.meta.warnings.some((w) => w.includes("Clamped"))).toBe(true);
  });

  it("drops nodes with missing required fields", () => {
    const nodes = [
      { id: "", label: "broken", x: 50, y: 50, passCount: 5 },
      { id: "ok", label: "ok", x: 50, y: 50, passCount: 5 },
    ] as PassNetworkNode[];
    const model = computePassNetwork({ nodes, edges: [] });
    expect(model.plot.nodes).toHaveLength(1);
    expect(model.plot.nodes[0]!.id).toBe("ok");
  });
});

// ─── Deduplication and merge semantics ─────────────────────────────

describe("computePassNetwork — dedup + merge", () => {
  it("dedupes duplicate node ids keeping the first occurrence", () => {
    const nodes: PassNetworkNode[] = [
      { id: "dup", label: "First", x: 20, y: 50, passCount: 10 },
      { id: "dup", label: "Second", x: 80, y: 50, passCount: 20 },
      { id: "ok", label: "Ok", x: 50, y: 50, passCount: 5 },
    ];
    const model = computePassNetwork({ nodes, edges: [] });
    expect(model.plot.nodes).toHaveLength(2);
    expect(model.plot.nodes.find((n) => n.id === "dup")?.label).toBe("First");
    expect(model.meta.warnings.some((w) => w.includes("duplicate node id"))).toBe(true);
  });

  it("merges reversed edge pairs into a single undirected edge silently", () => {
    const nodes: PassNetworkNode[] = [
      { id: "a", label: "A", x: 30, y: 50, passCount: 5 },
      { id: "b", label: "B", x: 70, y: 50, passCount: 5 },
    ];
    const edges: PassNetworkEdge[] = [
      { sourceId: "a", targetId: "b", passCount: 5, xT: 0.1 },
      { sourceId: "b", targetId: "a", passCount: 3, xT: 0.2 },
    ];
    const model = computePassNetwork({ nodes, edges });
    expect(model.plot.edges).toHaveLength(1);
    const merged = model.plot.edges[0]!;
    expect(merged.passCount).toBe(8);
    // weighted average: (5*0.1 + 3*0.2) / 8 = 1.1/8 = 0.1375
    expect(merged.xT).toBeCloseTo(0.1375, 4);
    // Reversed pairs are expected in undirected mode — no warning for that.
    expect(model.meta.warnings.some((w) => w.includes("duplicate"))).toBe(false);
  });

  it("warns on literal duplicate edges (same direction twice)", () => {
    const nodes: PassNetworkNode[] = [
      { id: "a", label: "A", x: 30, y: 50, passCount: 5 },
      { id: "b", label: "B", x: 70, y: 50, passCount: 5 },
    ];
    const edges: PassNetworkEdge[] = [
      { sourceId: "a", targetId: "b", passCount: 5, xT: 0.1 },
      { sourceId: "a", targetId: "b", passCount: 3, xT: 0.2 },
    ];
    const model = computePassNetwork({ nodes, edges });
    expect(model.meta.warnings.some((w) => w.includes("Dropped duplicate edge"))).toBe(
      true,
    );
  });

  it("drops edges referencing unknown node ids with a warning", () => {
    const nodes: PassNetworkNode[] = [
      { id: "a", label: "A", x: 30, y: 50, passCount: 5 },
    ];
    const edges: PassNetworkEdge[] = [
      { sourceId: "a", targetId: "ghost", passCount: 10 },
    ];
    const model = computePassNetwork({ nodes, edges });
    expect(model.plot.edges).toHaveLength(0);
    expect(model.meta.warnings.some((w) => w.includes("unknown"))).toBe(true);
  });

  it("drops self-loop edges", () => {
    const nodes: PassNetworkNode[] = [
      { id: "a", label: "A", x: 30, y: 50, passCount: 5 },
    ];
    const edges: PassNetworkEdge[] = [{ sourceId: "a", targetId: "a", passCount: 10 }];
    const model = computePassNetwork({ nodes, edges });
    expect(model.plot.edges).toHaveLength(0);
    expect(model.meta.warnings.some((w) => w.includes("self-loop"))).toBe(true);
  });
});

// ─── Fixed team-color mode ──────────────────────────────────────────

describe("computePassNetwork — fixed team-color mode", () => {
  it("always reports team color mode in core", () => {
    const model = computePassNetwork({ nodes: baseNodes, edges: baseEdges });
    expect(model.meta.colorBy).toBe("team");
    expect(model.meta.colorFallback).toBeNull();
  });

  it("keeps the default team color on edges even when xT values are present", () => {
    const model = computePassNetwork({ nodes: baseNodes, edges: baseEdges });
    expect(model.plot.edges.every((edge) => edge.color === "#f05252")).toBe(true);
  });
});

// ─── Labels ─────────────────────────────────────────────────────────

describe("computePassNetwork — labels", () => {
  it("respects showLabels=false", () => {
    const model = computePassNetwork({
      nodes: baseNodes,
      edges: baseEdges,
      showLabels: false,
    });
    for (const n of model.plot.nodes) {
      expect(n.showLabel).toBe(false);
    }
  });

  it("always shows labels when showLabels is true, even on the smallest nodes", () => {
    // Heavy asymmetry: one node at the very max, one at the very min of the
    // pass-count domain. The min node receives minRadius (1.70m on a full
    // pitch) — even at minimum size, every node should still get a label.
    const nodes: PassNetworkNode[] = [
      { id: "big", label: "BG", x: 50, y: 50, passCount: 100 },
      { id: "tiny", label: "TN", x: 30, y: 50, passCount: 1 },
    ];
    const model = computePassNetwork({ nodes, edges: [] });
    const tiny = model.plot.nodes.find((n) => n.id === "tiny")!;
    expect(tiny.showLabel).toBe(true);
    // Confirm the test is actually exercising the tiny-radius case.
    expect(tiny.radius).toBeLessThan(2);
  });

  it("exposes a readable label color for the resolved node color", () => {
    const nodes: PassNetworkNode[] = [
      { id: "light", label: "L", x: 40, y: 50, passCount: 5, color: "#ffffff" },
      { id: "dark", label: "D", x: 60, y: 50, passCount: 5, color: "#111827" },
    ];
    const model = computePassNetwork({ nodes, edges: [] });
    expect(model.plot.nodes.find((node) => node.id === "light")?.labelColor).toBe(
      "#1a202c",
    );
    expect(model.plot.nodes.find((node) => node.id === "dark")?.labelColor).toBe(
      "#ffffff",
    );
  });

  it("prefers labelFull over label in the tooltip Player row", () => {
    const nodes: PassNetworkNode[] = [
      {
        id: "mo",
        label: "MØ",
        labelFull: "Martin Ødegaard",
        x: 50,
        y: 50,
        passCount: 10,
      },
    ];
    const model = computePassNetwork({ nodes, edges: [] });
    const tooltip = model.plot.nodes[0]!.tooltip;
    const playerRow = tooltip.rows.find((r) => r.key === "player");
    expect(playerRow?.value).toBe("Martin Ødegaard");
  });

  it("falls back to label in the tooltip when labelFull is absent", () => {
    const nodes: PassNetworkNode[] = [
      { id: "r", label: "Raya", x: 50, y: 50, passCount: 10 },
    ];
    const model = computePassNetwork({ nodes, edges: [] });
    const playerRow = model.plot.nodes[0]!.tooltip.rows.find((r) => r.key === "player");
    expect(playerRow?.value).toBe("Raya");
  });
});

// ─── Collision relaxation ──────────────────────────────────────────

describe("computePassNetwork — collision relaxation", () => {
  it("pushes overlapping nodes apart while preserving the cluster centroid", () => {
    const nodes: PassNetworkNode[] = [
      { id: "a", label: "A", x: 50, y: 50, passCount: 20 },
      { id: "b", label: "B", x: 50.05, y: 50.05, passCount: 20 },
    ];
    const model = computePassNetwork({ nodes, edges: [] });
    const a = model.plot.nodes.find((n) => n.id === "a")!;
    const b = model.plot.nodes.find((n) => n.id === "b")!;
    // The two nodes should now be separated in Campos space.
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    expect(distance).toBeGreaterThan(0.5);
    // Cluster centroid roughly preserved (was 50.025, 50.025)
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    expect(cx).toBeCloseTo(50.025, 1);
    expect(cy).toBeCloseTo(50.025, 1);
    // At least one node should be marked displaced
    expect(a.displaced || b.displaced).toBe(true);
  });

  it("does not displace nodes that are already well-separated", () => {
    const nodes: PassNetworkNode[] = [
      { id: "a", label: "A", x: 20, y: 20, passCount: 5 },
      { id: "b", label: "B", x: 80, y: 80, passCount: 5 },
    ];
    const model = computePassNetwork({ nodes, edges: [] });
    for (const n of model.plot.nodes) {
      expect(n.displaced).toBe(false);
    }
    expect(model.plot.nodes.find((n) => n.id === "a")?.x).toBe(20);
    expect(model.plot.nodes.find((n) => n.id === "b")?.x).toBe(80);
  });

  it("disables relaxation when collisionPadding=0", () => {
    const nodes: PassNetworkNode[] = [
      { id: "a", label: "A", x: 50, y: 50, passCount: 20 },
      { id: "b", label: "B", x: 50.05, y: 50.05, passCount: 20 },
    ];
    const model = computePassNetwork({
      nodes,
      edges: [],
      collisionPadding: 0,
    });
    const a = model.plot.nodes.find((n) => n.id === "a")!;
    const b = model.plot.nodes.find((n) => n.id === "b")!;
    expect(a.x).toBe(50);
    expect(b.x).toBe(50.05);
    expect(a.displaced).toBe(false);
    expect(b.displaced).toBe(false);
  });

  it("clamps displaced nodes to the pitch", () => {
    const nodes: PassNetworkNode[] = [
      { id: "a", label: "A", x: 1, y: 50, passCount: 20 },
      { id: "b", label: "B", x: 1.1, y: 50, passCount: 20 },
    ];
    const model = computePassNetwork({ nodes, edges: [] });
    for (const n of model.plot.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(100);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(100);
    }
  });
});

// ─── Directed edges ─────────────────────────────────────────────────

describe("computePassNetwork — directed mode", () => {
  const dirNodes: PassNetworkNode[] = [
    { id: "a", label: "A", x: 20, y: 50, passCount: 20 },
    { id: "b", label: "B", x: 80, y: 50, passCount: 20 },
  ];
  const dirEdges: PassNetworkEdge[] = [
    { sourceId: "a", targetId: "b", passCount: 10, xT: 0.1 },
    { sourceId: "b", targetId: "a", passCount: 6, xT: 0.05 },
  ];

  it("keeps reversed pairs as distinct edges when directed=true", () => {
    const model = computePassNetwork({
      nodes: dirNodes,
      edges: dirEdges,
      directed: true,
    });
    expect(model.plot.edges).toHaveLength(2);
    const abEdge = model.plot.edges.find((e) => e.sourceId === "a" && e.targetId === "b");
    const baEdge = model.plot.edges.find((e) => e.sourceId === "b" && e.targetId === "a");
    expect(abEdge?.passCount).toBe(10);
    expect(baEdge?.passCount).toBe(6);
    expect(abEdge?.isDirected).toBe(true);
    expect(baEdge?.isDirected).toBe(true);
    expect(model.meta.warnings.some((w) => w.includes("Merged"))).toBe(false);
  });

  it("merges reversed pairs when directed is false (default)", () => {
    const model = computePassNetwork({ nodes: dirNodes, edges: dirEdges });
    expect(model.plot.edges).toHaveLength(1);
    expect(model.plot.edges[0]!.passCount).toBe(16);
    expect(model.plot.edges[0]!.isDirected).toBe(false);
  });

  it("emits directed edges sorted stably for deterministic rendering", () => {
    const model = computePassNetwork({
      nodes: dirNodes,
      edges: [
        { sourceId: "b", targetId: "a", passCount: 6 },
        { sourceId: "a", targetId: "b", passCount: 10 },
      ],
      directed: true,
    });
    expect(model.plot.edges.map((e) => `${e.sourceId}->${e.targetId}`)).toEqual([
      "a->b",
      "b->a",
    ]);
  });
});

// ─── Per-node / per-edge color override ────────────────────────────

describe("computePassNetwork — per-node color override", () => {
  it("honours node.color when provided", () => {
    const nodes: PassNetworkNode[] = [
      { id: "a", label: "A", x: 30, y: 50, passCount: 10, color: "#ff0000" },
      { id: "b", label: "B", x: 70, y: 50, passCount: 10, color: "#00ff00" },
    ];
    const model = computePassNetwork({ nodes, edges: [] });
    const a = model.plot.nodes.find((n) => n.id === "a");
    const b = model.plot.nodes.find((n) => n.id === "b");
    expect(a?.color).toBe("#ff0000");
    expect(b?.color).toBe("#00ff00");
  });

  it("honours edge.color when provided", () => {
    const nodes: PassNetworkNode[] = [
      { id: "a", label: "A", x: 30, y: 50, passCount: 10 },
      { id: "b", label: "B", x: 70, y: 50, passCount: 10 },
    ];
    const edges: PassNetworkEdge[] = [
      { sourceId: "a", targetId: "b", passCount: 8, color: "#ff00ff" },
    ];
    const model = computePassNetwork({ nodes, edges });
    expect(model.plot.edges[0]?.color).toBe("#ff00ff");
  });

  it("derives the label color contrast from the override fill", () => {
    const nodes: PassNetworkNode[] = [
      // White fill → label should pick the dark color
      { id: "a", label: "A", x: 30, y: 50, passCount: 10, color: "#ffffff" },
      // Saturated red → label should pick the white color
      { id: "b", label: "B", x: 70, y: 50, passCount: 10, color: "#c8102e" },
    ];
    const model = computePassNetwork({ nodes, edges: [] });
    const a = model.plot.nodes.find((n) => n.id === "a")!;
    const b = model.plot.nodes.find((n) => n.id === "b")!;
    expect(a.labelColor).toBe("#1a202c");
    expect(b.labelColor).toBe("#ffffff");
  });
});
