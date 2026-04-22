# PassNetwork: Compress Transforms + Initial Labels Implementation Plan

**Status:** archived
**Superseded by:** `docs/specs/passnetwork-spec.md`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken filter-based `crop="half"` semantics with a compose-friendly **compress** transform that enables head-to-head (H2H) pass-network views, and make node labels use short initials (with full names kept in tooltips) so text reliably fits inside node circles.

**Architecture:** Two new transform helpers (`compressPassNetwork`, `deriveInitials`) in a new sibling module in `@withqwerty/campos-core`. The chart gains two small additive fields (`labelFull?` on nodes for tooltip text, `color?` on nodes and edges for per-mark overrides) and the `crop` prop is removed entirely. H2H demos combine two compressed networks into a single `{nodes, edges}` passed to a single `<PassNetwork>`. The aggregation helper starts emitting initials by default. No new chart components; the existing chart simply honours the richer data shape.

**Tech Stack:** TypeScript workspace (`@withqwerty/campos-core`, `@withqwerty/campos-react`, `@withqwerty/campos-stadia`), React 19 SVG rendering, Vitest + vitest-axe, Astro demo site, pnpm workspaces.

---

## File Structure

### Created files

- `packages/core/src/pass-network-transforms.ts` — new module holding `deriveInitials`, `compressPassNetwork`, and `combinePassNetworks`. Separate from `pass-network.ts` because the transforms are pre-processing utilities, not part of the chart compute; they can be tested and evolved independently.
- `packages/core/test/pass-network-transforms.test.ts` — dedicated test file for the new transforms.

### Modified files

- `packages/core/src/pass-network.ts` — add `labelFull?: string` + `color?: string` to `PassNetworkNode`; add `color?: string` to `PassNetworkEdge`; honour the per-node/per-edge color override in `colorBy="team"` mode; prefer `labelFull` over `label` in the tooltip "Player" row; remove `crop` from `ComputePassNetworkInput` and the corresponding filter path; remove `crop` from `PassNetworkModel.meta` and `plot.pitch`; always use the full-pitch viewport shortside for scaling.
- `packages/core/src/aggregate-pass-network.ts` — use `deriveInitials` as the default node `label`; store the raw name in `labelFull`; add an optional `labelFor?: (name: string) => { label: string; labelFull: string }` callback for consumers who want to override.
- `packages/core/src/index.ts` — export `deriveInitials`, `compressPassNetwork`, `combinePassNetworks`, and the transform types.
- `packages/core/test/compute-pass-network.test.ts` — delete the 3 half-crop tests, add tests for per-node/per-edge color override and `labelFull` tooltip fallback. Update the `half pitch` scaling test to pin the removal.
- `packages/core/test/aggregate-pass-network.test.ts` — update existing tests to expect initial-based labels + `labelFull` full names.
- `packages/react/src/PassNetwork.tsx` — remove `crop` from `PassNetworkProps`; drop its pass-through to the compute call + memo deps; rename `model.plot.pitch.crop` references because the field no longer exists.
- `packages/react/test/PassNetwork.test.tsx` — remove `crop`-related assertions.
- `apps/site/src/data/passnetwork-demo.ts` — convert every pre-aggregated fixture node to use initial-based `label` + `labelFull` full name.
- `apps/site/src/pages/passnetwork.astro` — remove the broken "Half-pitch crop" demo card; add a new "Head-to-head (compressed)" card showing Arsenal + Liverpool on a single shared pitch; add a "Single team compressed (left)" card to demonstrate the primitive; remove the `crop` row from the props table.
- `docs/specs/passnetwork-spec.md` — remove `crop` from the public API section; document `compressPassNetwork`, `combinePassNetworks`, and the initials convention; add a post-shipping changelog entry for this packet.

### Sequencing

Each part commits independently, smallest first:

1. **Part A** — Add `deriveInitials` + transforms in a new module (pure functions, no integration yet). 1 commit.
2. **Part B** — Per-node / per-edge `color` override in core compute + tests. 1 commit.
3. **Part C** — `labelFull` field + tooltip fallback + tests. 1 commit.
4. **Part D** — Remove `crop` from the core + React + tests. 1 commit.
5. **Part E** — Update `aggregatePassNetwork` to emit initials by default + tests. 1 commit.
6. **Part F** — Update committed fixtures to use initials + `labelFull`. 1 commit.
7. **Part G** — Replace broken demo card with H2H + single-team compressed cards. 1 commit.
8. **Part H** — Spec + status updates + final gate. 1 commit.

---

## Part A: New transform module

### Task A1: Scaffold the module with failing tests

**Files:**

- Create: `packages/core/src/pass-network-transforms.ts`
- Create: `packages/core/test/pass-network-transforms.test.ts`

- [ ] **Step 1: Create the stub module**

Write to `packages/core/src/pass-network-transforms.ts`:

```typescript
import type { PassNetworkEdge, PassNetworkNode } from "./pass-network.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CompressSide = "left" | "right";

export type CompressPassNetworkOptions = {
  /** Which half of the pitch the network should be compressed into. */
  side: CompressSide;
  /**
   * Optional solid color applied as a per-node and per-edge override so a
   * combined H2H network can be rendered through a single chart instance
   * with two distinct team colors.
   */
  color?: string;
};

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Derive a short label from a player name. Designed so the result reliably
 * fits inside a node circle at typical network sizes:
 *
 * - single token → keep the token as-is ("Raya" → "Raya")
 * - two tokens   → first letter of first + first letter of last ("Martin Ødegaard" → "MØ")
 * - three+ tokens → first letter of first token + last token's first letter
 *   when the last token is short enough, else first letters of first and last
 *   ("Luis Alberto Suárez" → "LS")
 * - empty / whitespace → "?"
 */
export function deriveInitials(name: string): string {
  throw new Error("not implemented");
}

/**
 * Remap a pass network so every node sits inside the chosen half of the
 * pitch while preserving each player's relative x-position within that
 * half. The y-axis is untouched. Optionally tag every node and edge with
 * a team-wide color override so a single chart instance can render an H2H
 * view by combining two compressed networks.
 */
export function compressPassNetwork(
  network: { nodes: readonly PassNetworkNode[]; edges: readonly PassNetworkEdge[] },
  options: CompressPassNetworkOptions,
): { nodes: PassNetworkNode[]; edges: PassNetworkEdge[] } {
  throw new Error("not implemented");
}

/**
 * Shallow-merge several pass networks into one. Node ids must be globally
 * unique across all inputs — callers should tag ids per team (e.g.
 * "home:MØ") before calling. The returned arrays keep input order.
 */
export function combinePassNetworks(
  ...networks: ReadonlyArray<{
    nodes: readonly PassNetworkNode[];
    edges: readonly PassNetworkEdge[];
  }>
): { nodes: PassNetworkNode[]; edges: PassNetworkEdge[] } {
  throw new Error("not implemented");
}
```

- [ ] **Step 2: Write the failing tests**

Write to `packages/core/test/pass-network-transforms.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import {
  combinePassNetworks,
  compressPassNetwork,
  deriveInitials,
  type PassNetworkEdge,
  type PassNetworkNode,
} from "../src/index";

describe("deriveInitials", () => {
  it("keeps single-token names intact", () => {
    expect(deriveInitials("Raya")).toBe("Raya");
    expect(deriveInitials("Ødegaard")).toBe("Ødegaard");
  });

  it("takes first letters of a two-token name", () => {
    expect(deriveInitials("Martin Ødegaard")).toBe("MØ");
    expect(deriveInitials("Declan Rice")).toBe("DR");
    expect(deriveInitials("Bukayo Saka")).toBe("BS");
  });

  it("takes first + last initials for three-token names", () => {
    expect(deriveInitials("Luis Alberto Suárez")).toBe("LS");
    expect(deriveInitials("Jean-Clair Todibo")).toBe("JT");
  });

  it("collapses extra whitespace and hyphens", () => {
    expect(deriveInitials("  Martin   Ødegaard  ")).toBe("MØ");
  });

  it("returns a placeholder for empty input", () => {
    expect(deriveInitials("")).toBe("?");
    expect(deriveInitials("   ")).toBe("?");
  });
});

describe("compressPassNetwork", () => {
  const baseNodes: PassNetworkNode[] = [
    { id: "a", label: "A", x: 0, y: 50, passCount: 5 },
    { id: "b", label: "B", x: 50, y: 30, passCount: 5 },
    { id: "c", label: "C", x: 100, y: 70, passCount: 5 },
  ];
  const baseEdges: PassNetworkEdge[] = [
    { sourceId: "a", targetId: "b", passCount: 4 },
    { sourceId: "b", targetId: "c", passCount: 4 },
  ];

  it("compresses every x-coordinate into the left half", () => {
    const out = compressPassNetwork(
      { nodes: baseNodes, edges: baseEdges },
      { side: "left" },
    );
    const a = out.nodes.find((n) => n.id === "a")!;
    const b = out.nodes.find((n) => n.id === "b")!;
    const c = out.nodes.find((n) => n.id === "c")!;
    expect(a.x).toBe(0);
    expect(b.x).toBe(25);
    expect(c.x).toBe(50);
    // y is untouched
    expect(a.y).toBe(50);
    expect(b.y).toBe(30);
    expect(c.y).toBe(70);
  });

  it("compresses AND mirrors into the right half", () => {
    const out = compressPassNetwork(
      { nodes: baseNodes, edges: baseEdges },
      { side: "right" },
    );
    const a = out.nodes.find((n) => n.id === "a")!;
    const b = out.nodes.find((n) => n.id === "b")!;
    const c = out.nodes.find((n) => n.id === "c")!;
    // x=0 (own goal) → 100 (own goal on the right side), x=100 (attacking)
    // → 50 (midfield), so the team still attacks toward the centre.
    expect(a.x).toBe(100);
    expect(b.x).toBe(75);
    expect(c.x).toBe(50);
  });

  it("tags every node and edge with the optional color override", () => {
    const out = compressPassNetwork(
      { nodes: baseNodes, edges: baseEdges },
      { side: "left", color: "#EF0107" },
    );
    expect(out.nodes.every((n) => n.color === "#EF0107")).toBe(true);
    expect(out.edges.every((e) => e.color === "#EF0107")).toBe(true);
  });

  it("leaves color untouched when the override is omitted", () => {
    const out = compressPassNetwork(
      { nodes: baseNodes, edges: baseEdges },
      { side: "left" },
    );
    expect(out.nodes.every((n) => n.color === undefined)).toBe(true);
    expect(out.edges.every((e) => e.color === undefined)).toBe(true);
  });

  it("preserves passCount and other node fields", () => {
    const input: PassNetworkNode[] = [
      {
        id: "a",
        label: "A",
        labelFull: "Player A",
        x: 20,
        y: 40,
        passCount: 42,
        xT: 0.12,
        completionRate: 0.85,
      },
    ];
    const out = compressPassNetwork({ nodes: input, edges: [] }, { side: "left" });
    const a = out.nodes[0]!;
    expect(a.label).toBe("A");
    expect(a.labelFull).toBe("Player A");
    expect(a.passCount).toBe(42);
    expect(a.xT).toBe(0.12);
    expect(a.completionRate).toBe(0.85);
  });
});

describe("combinePassNetworks", () => {
  it("concatenates nodes and edges from every input in order", () => {
    const home = {
      nodes: [{ id: "h1", label: "H1", x: 10, y: 50, passCount: 5 }] as PassNetworkNode[],
      edges: [] as PassNetworkEdge[],
    };
    const away = {
      nodes: [
        { id: "a1", label: "A1", x: 90, y: 50, passCount: 5 },
        { id: "a2", label: "A2", x: 80, y: 50, passCount: 5 },
      ] as PassNetworkNode[],
      edges: [{ sourceId: "a1", targetId: "a2", passCount: 4 }] as PassNetworkEdge[],
    };
    const combined = combinePassNetworks(home, away);
    expect(combined.nodes.map((n) => n.id)).toEqual(["h1", "a1", "a2"]);
    expect(combined.edges).toHaveLength(1);
    expect(combined.edges[0]!.sourceId).toBe("a1");
  });

  it("returns empty arrays when called with no inputs", () => {
    const combined = combinePassNetworks();
    expect(combined.nodes).toEqual([]);
    expect(combined.edges).toEqual([]);
  });
});
```

- [ ] **Step 3: Wire the stub module into the core barrel**

Edit `packages/core/src/index.ts` and add after the `aggregatePassNetwork` export block:

```typescript
export {
  combinePassNetworks,
  compressPassNetwork,
  deriveInitials,
} from "./pass-network-transforms.js";
export type {
  CompressPassNetworkOptions,
  CompressSide,
} from "./pass-network-transforms.js";
```

- [ ] **Step 4: Run the failing tests**

Run: `pnpm exec vitest run packages/core/test/pass-network-transforms.test.ts`

Expected: FAIL — every test calls `not implemented` throwing stubs.

### Task A2: Implement the transforms

**Files:**

- Modify: `packages/core/src/pass-network-transforms.ts`

- [ ] **Step 1: Implement `deriveInitials`**

Replace the stub with:

```typescript
export function deriveInitials(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";
  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0]!;
  const first = tokens[0]!;
  const last = tokens[tokens.length - 1]!;
  return `${first[0] ?? ""}${last[0] ?? ""}`;
}
```

- [ ] **Step 2: Implement `compressPassNetwork`**

Replace the stub with:

```typescript
export function compressPassNetwork(
  network: { nodes: readonly PassNetworkNode[]; edges: readonly PassNetworkEdge[] },
  options: CompressPassNetworkOptions,
): { nodes: PassNetworkNode[]; edges: PassNetworkEdge[] } {
  const { side, color } = options;
  const transformX = (x: number): number => (side === "left" ? x * 0.5 : 100 - x * 0.5);

  const nodes = network.nodes.map((n) => {
    const next: PassNetworkNode = { ...n, x: transformX(n.x) };
    if (color != null) next.color = color;
    return next;
  });
  const edges = network.edges.map((e) => {
    const next: PassNetworkEdge = { ...e };
    if (color != null) next.color = color;
    return next;
  });
  return { nodes, edges };
}
```

- [ ] **Step 3: Implement `combinePassNetworks`**

Replace the stub with:

```typescript
export function combinePassNetworks(
  ...networks: ReadonlyArray<{
    nodes: readonly PassNetworkNode[];
    edges: readonly PassNetworkEdge[];
  }>
): { nodes: PassNetworkNode[]; edges: PassNetworkEdge[] } {
  const nodes: PassNetworkNode[] = [];
  const edges: PassNetworkEdge[] = [];
  for (const network of networks) {
    nodes.push(...network.nodes);
    edges.push(...network.edges);
  }
  return { nodes, edges };
}
```

- [ ] **Step 4: Run the tests — should now pass**

Run: `pnpm exec vitest run packages/core/test/pass-network-transforms.test.ts`

Expected: PASS — 13 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/pass-network-transforms.ts packages/core/src/index.ts packages/core/test/pass-network-transforms.test.ts
git commit -m "feat(core): add deriveInitials, compressPassNetwork, combinePassNetworks

New pure-function helpers for preparing pass-network data:

- deriveInitials(name) produces short labels that reliably fit inside
  node circles. Single tokens stay intact ('Raya'), multi-token names
  collapse to first + last initial ('Martin Ødegaard' -> 'MØ').
- compressPassNetwork(network, { side, color? }) remaps x-coordinates
  into one half of the pitch and optionally tags every node and edge
  with a team-wide color override.
- combinePassNetworks(...) concatenates nodes and edges so a single
  chart instance can render an H2H view."
```

---

## Part B: Per-node / per-edge color override

### Task B1: Add optional color fields to public types

**Files:**

- Modify: `packages/core/src/pass-network.ts`

- [ ] **Step 1: Extend `PassNetworkNode`**

Find the `PassNetworkNode` type and add two optional fields:

```typescript
export type PassNetworkNode = {
  /** Stable identifier. Must match sourceId/targetId referenced by edges. */
  id: string;
  /** Display label rendered inside the circle (keep short — prefer initials). */
  label: string;
  /** Full name used in the tooltip. Falls back to `label` when absent. */
  labelFull?: string;
  /** Campos pitch x-coordinate (0-100). */
  x: number;
  /** Campos pitch y-coordinate (0-100). */
  y: number;
  /** Pass count in the window. Drives node size by default. */
  passCount: number;
  /** Optional expected-threat value. */
  xT?: number | null;
  /** Optional pass completion percentage (0-1). */
  completionRate?: number | null;
  /**
   * Optional solid color override. When set, overrides the team/xT color
   * for just this node — used by H2H compose flows that combine two
   * team-tagged networks through a single chart instance.
   */
  color?: string;
  /** Opaque bag of extra rows rendered in the tooltip. */
  meta?: Readonly<Record<string, string | number>>;
};
```

- [ ] **Step 2: Extend `PassNetworkEdge`**

```typescript
export type PassNetworkEdge = {
  sourceId: string;
  targetId: string;
  /** Undirected pass count between the pair. */
  passCount: number;
  /** Optional expected-threat value between the pair. */
  xT?: number | null;
  /**
   * Optional solid color override. When set, overrides the team/xT color
   * for just this edge — used by H2H compose flows that combine two
   * team-tagged networks through a single chart instance.
   */
  color?: string;
};
```

### Task B2: Write failing tests for the override behaviour

**Files:**

- Modify: `packages/core/test/compute-pass-network.test.ts`

- [ ] **Step 1: Add a new describe block**

Append to the file:

```typescript
// ─── Per-node / per-edge color override ────────────────────────────

describe("computePassNetwork — per-node color override", () => {
  it("honours node.color when provided, ignoring the global nodeColor", () => {
    const nodes: PassNetworkNode[] = [
      { id: "a", label: "A", x: 30, y: 50, passCount: 10, color: "#ff0000" },
      { id: "b", label: "B", x: 70, y: 50, passCount: 10, color: "#00ff00" },
    ];
    const model = computePassNetwork({
      nodes,
      edges: [],
      nodeColor: "#0000ff",
    });
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

  it("still derives label color from the override fill", () => {
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
```

- [ ] **Step 2: Run the failing tests**

Run: `pnpm exec vitest run packages/core/test/compute-pass-network.test.ts -t "per-node color"`

Expected: FAIL — core does not yet read `node.color` / `edge.color`.

### Task B3: Implement color override in `computePassNetwork`

**Files:**

- Modify: `packages/core/src/pass-network.ts`

- [ ] **Step 1: Honour `node.color` in `nodeColorFor`**

Find the `nodeColorFor` helper inside `computePassNetwork` and update it so a per-node override wins before the team / xT logic runs:

```typescript
const nodeColorFor = (node: PassNetworkNode): string => {
  if (node.color != null) return node.color;
  if (effectiveColorBy === "xT") {
    if (node.xT == null || !Number.isFinite(node.xT)) return "#b8c0cc";
    if (nodeXTDegenerate) return interpolateStops(xtStops, 0.5);
    const t = (node.xT - nodeXTMin) / (nodeXTMax - nodeXTMin);
    return interpolateStops(xtStops, t);
  }
  return nodeColor;
};
```

- [ ] **Step 2: Honour `edge.color` in the rendered-edge loop**

Find the `renderedEdges` map inside `computePassNetwork`. The existing code resolves colour via `edgeColorFor(edge.xT)`. Update the loop so a per-edge override wins first:

```typescript
const renderedEdges: PassNetworkRenderedEdge[] = mergedEdges.map((edge) => {
  const source = nodeById.get(edge.sourceId);
  const target = nodeById.get(edge.targetId);
  if (!source || !target) {
    throw new Error(
      `Internal error: edge references missing node ${edge.sourceId}↔${edge.targetId}`,
    );
  }
  const { width, weight } = edgeWidthFor(edge.passCount);
  const opacity = edgeOpacityFor(weight);
  const color = edge.colorOverride ?? edgeColorFor(edge.xT);
  return {
    id: `${edge.sourceId}::${edge.targetId}`,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y,
    passCount: edge.passCount,
    xT: edge.xT,
    isDirected: directed,
    width,
    color,
    opacity,
    sourceLabel: source.label,
    targetLabel: target.label,
    tooltip: buildEdgeTooltip(source.label, target.label, edge.passCount, edge.xT),
  };
});
```

Note the new `edge.colorOverride` — the `mergedEdges` intermediate array doesn't carry the override yet. You need to thread it through both merge branches:

In the `if (directed)` branch of the merge step, add `colorOverride: edge.color ?? null` to the mapped object:

```typescript
mergedEdges = validEdges
  .slice()
  .sort((a, b) => {
    if (a.sourceId !== b.sourceId) return a.sourceId < b.sourceId ? -1 : 1;
    return a.targetId < b.targetId ? -1 : 1;
  })
  .map((edge) => ({
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    passCount: edge.passCount,
    xT: edge.xT != null && Number.isFinite(edge.xT) ? edge.xT : null,
    colorOverride: edge.color ?? null,
  }))
  .filter((e) => e.passCount >= minEdgePasses);
```

In the `else` (undirected merge) branch, add the override resolution to the `MergeBucket` type and carry it through:

```typescript
type MergeBucket = {
  key: string;
  sourceId: string;
  targetId: string;
  passCount: number;
  xTWeighted: number;
  xTWeightSum: number;
  xTObserved: boolean;
  colorOverride: string | null;
};
```

When first creating a bucket:

```typescript
if (!bucket) {
  bucket = {
    key,
    sourceId: a,
    targetId: b,
    passCount: 0,
    xTWeighted: 0,
    xTWeightSum: 0,
    xTObserved: false,
    colorOverride: edge.color ?? null,
  };
  buckets.set(key, bucket);
} else {
  // When merging reversed pairs, prefer the first-seen override. Emit the
  // usual warning.
  warnings.push(`Merged duplicate/reversed edge pair: ${edge.sourceId}↔${edge.targetId}`);
}
```

And when building `mergedEdges` from the buckets:

```typescript
mergedEdges = Array.from(buckets.values())
  .filter((b) => b.passCount >= minEdgePasses)
  .map((b) => ({
    sourceId: b.sourceId,
    targetId: b.targetId,
    passCount: b.passCount,
    xT: b.xTObserved && b.xTWeightSum > 0 ? b.xTWeighted / b.xTWeightSum : null,
    colorOverride: b.colorOverride,
  }));
```

Also update the `MergedEdge` local type at the top of the merge block:

```typescript
type MergedEdge = {
  sourceId: string;
  targetId: string;
  passCount: number;
  xT: number | null;
  colorOverride: string | null;
};
let mergedEdges: MergedEdge[];
```

- [ ] **Step 3: Run the color override tests**

Run: `pnpm exec vitest run packages/core/test/compute-pass-network.test.ts -t "per-node color"`

Expected: PASS — all 3 override tests green.

- [ ] **Step 4: Run the full core suite to catch regressions**

Run: `pnpm exec vitest run packages/core/test/compute-pass-network.test.ts`

Expected: all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/pass-network.ts packages/core/test/compute-pass-network.test.ts
git commit -m "feat(passnetwork): per-node and per-edge color overrides

PassNetworkNode and PassNetworkEdge now accept an optional color field
that wins over the team/xT palette resolution. This enables head-to-
head flows where two team-tagged networks are combined through a
single chart instance and each node/edge carries its own team color.

Label color contrast is still derived from the resolved fill, so an
override of '#ffffff' picks a dark label and a saturated team color
picks a white label."
```

---

## Part C: `labelFull` tooltip fallback

### Task C1: Write the failing test

**Files:**

- Modify: `packages/core/test/compute-pass-network.test.ts`

- [ ] **Step 1: Add a test inside the existing labels describe block**

Append inside the `describe("computePassNetwork — labels", ...)` block:

```typescript
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
```

- [ ] **Step 2: Run the failing tests**

Run: `pnpm exec vitest run packages/core/test/compute-pass-network.test.ts -t "labelFull"`

Expected: FAIL — the tooltip currently uses `label` unconditionally.

### Task C2: Update `buildNodeTooltip` to prefer `labelFull`

**Files:**

- Modify: `packages/core/src/pass-network.ts`

- [ ] **Step 1: Change the "Player" row source**

Find `buildNodeTooltip` near the top of the file and update the first row:

```typescript
function buildNodeTooltip(
  node: PassNetworkNode,
  resolvedXT: number | null,
): PassNetworkTooltipModel {
  const rows: PassNetworkTooltipRow[] = [
    { key: "player", label: "Player", value: node.labelFull ?? node.label },
    { key: "passes", label: "Passes", value: String(node.passCount) },
  ];
  const completion = formatRate(node.completionRate);
  if (completion != null) {
    rows.push({ key: "completion", label: "Completion", value: completion });
  }
  const xTText = formatXT(resolvedXT);
  if (xTText != null) {
    rows.push({ key: "xt", label: "xT", value: xTText });
  }
  if (node.meta) {
    for (const [key, value] of Object.entries(node.meta)) {
      rows.push({ key: `meta-${key}`, label: key, value: String(value) });
    }
  }
  return { rows };
}
```

- [ ] **Step 2: Run the tests — should pass**

Run: `pnpm exec vitest run packages/core/test/compute-pass-network.test.ts -t "labelFull"`

Expected: PASS — both tests green.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/pass-network.ts packages/core/test/compute-pass-network.test.ts
git commit -m "feat(passnetwork): tooltip prefers labelFull when present

PassNetworkNode now accepts an optional labelFull field. The chart
renders the short label inside the circle and the full name in the
tooltip, so charts can use reliable initials without losing the
readable full name on hover/focus."
```

---

## Part D: Remove `crop`

### Task D1: Drop `crop` from input and model types

**Files:**

- Modify: `packages/core/src/pass-network.ts`

- [ ] **Step 1: Remove `crop` from `ComputePassNetworkInput`**

```typescript
export type ComputePassNetworkInput = {
  nodes: readonly PassNetworkNode[];
  edges: readonly PassNetworkEdge[];
  minEdgePasses?: number;
  colorBy?: PassNetworkColorBy;
  sizeBy?: PassNetworkSizeBy;
  showLabels?: boolean;
  nodeColor?: string;
  xTColorScale?: readonly string[];
  orientation?: "horizontal" | "vertical";
  /**
   * Minimum gap (SVG user units / meters) between two node edges after
   * collision relaxation. Set to 0 to disable relaxation entirely. Default: 0.5.
   */
  collisionPadding?: number;
  /**
   * When true, reversed edges (A→B and B→A) are kept as distinct marks and
   * the renderer draws them as tapered polygons with a slight perpendicular
   * offset to avoid overlap. Default: false (undirected merge).
   */
  directed?: boolean;
};
```

- [ ] **Step 2: Remove `crop` from the meta block of `PassNetworkModel`**

```typescript
export type PassNetworkModel = {
  meta: {
    component: "PassNetwork";
    empty: boolean;
    noEdgesAboveThreshold: boolean;
    accessibleLabel: string;
    colorBy: PassNetworkColorBy;
    colorFallback: "team" | null;
    orientation: "horizontal" | "vertical";
    minEdgePasses: number;
    warnings: readonly string[];
  };
  layout: PassNetworkLayoutModel;
  headerStats: { items: HeaderStatsItem[] } | null;
  plot: {
    pitch: { orientation: "horizontal" | "vertical" };
    nodes: PassNetworkRenderedNode[];
    edges: PassNetworkRenderedEdge[];
  };
  legend: PassNetworkLegendModel | null;
  emptyState: { message: string; secondary?: string } | null;
};
```

- [ ] **Step 3: Remove the crop-based viewport / filter / aspect code**

Inside `computePassNetwork`:

Delete the `const crop = input.crop ?? "full";` assignment near the top of the function.

Change `viewportShortSide(crop)` to `viewportShortSide()` and update the helper to always return the full-pitch shorter side:

```typescript
function viewportShortSide(): number {
  return Math.min(PITCH_LENGTH, PITCH_WIDTH);
}
```

Delete the crop filter block that drops nodes with `x < 50`:

Before:

```typescript
// 5: crop
let croppedNodes = dedupedNodes;
if (crop === "half") {
  croppedNodes = dedupedNodes.filter((node) => node.x >= 50);
}
const survivingIds = new Set(croppedNodes.map((n) => n.id));
```

After:

```typescript
const croppedNodes = dedupedNodes;
const survivingIds = new Set(croppedNodes.map((n) => n.id));
```

(The local variable name `croppedNodes` stays for now to minimise diff churn — a follow-up refactor can rename it.)

Update the pitch-meters calculation for collision relaxation:

Before:

```typescript
const pitchMetersWide =
  orientation === "horizontal" ? (crop === "half" ? 52.5 : 105) : PITCH_WIDTH;
const pitchMetersTall =
  orientation === "horizontal" ? PITCH_WIDTH : crop === "half" ? 52.5 : 105;
```

After:

```typescript
const pitchMetersWide = orientation === "horizontal" ? PITCH_LENGTH : PITCH_WIDTH;
const pitchMetersTall = orientation === "horizontal" ? PITCH_WIDTH : PITCH_LENGTH;
```

Update `aspectRatioFor`:

Before:

```typescript
function aspectRatioFor(
  crop: "full" | "half",
  orientation: "horizontal" | "vertical",
): string {
  if (crop === "full") {
    return orientation === "horizontal" ? "105:68" : "68:105";
  }
  return orientation === "horizontal" ? "52.5:68" : "68:52.5";
}
```

After:

```typescript
function aspectRatioFor(orientation: "horizontal" | "vertical"): string {
  return orientation === "horizontal" ? "105:68" : "68:105";
}
```

Update the call site: `aspectRatio: aspectRatioFor(crop, orientation)` → `aspectRatio: aspectRatioFor(orientation)`.

Update every `meta: { ..., crop, ... }` literal: delete the `crop` key. Update `plot: { pitch: { crop, orientation }, ... }` → `plot: { pitch: { orientation }, ... }`.

- [ ] **Step 4: Remove the crop-based tests**

In `packages/core/test/compute-pass-network.test.ts`, find and delete the entire `describe("computePassNetwork — half crop", ...)` block. Also delete the `it("shrinks node sizing proportionally on a half pitch", ...)` test inside the scaling describe — node sizing on half pitches is no longer meaningful because there is no half crop.

- [ ] **Step 5: Run the core suite**

Run: `pnpm exec vitest run packages/core/test/compute-pass-network.test.ts`

Expected: all tests pass. Any remaining references to `crop` inside the test file should have been removed.

### Task D2: Drop `crop` from React

**Files:**

- Modify: `packages/react/src/PassNetwork.tsx`
- Modify: `packages/react/test/PassNetwork.test.tsx`

- [ ] **Step 1: Remove `crop` from `PassNetworkProps`**

Delete the `crop?: ComputePassNetworkInput["crop"];` line from the props type.

- [ ] **Step 2: Remove `crop` from the destructured parameters**

Inside the `PassNetwork` function signature, remove the `crop,` entry.

- [ ] **Step 3: Remove `crop` from the `computePassNetwork` call inside the memo**

Delete `...(crop != null ? { crop } : {}),` and drop `crop` from the dependency array.

- [ ] **Step 4: Replace `model.plot.pitch.crop` references**

The `<Pitch>` render in the plot region previously passed `crop={model.plot.pitch.crop}`. Stadia still requires a `crop` prop; hardcode `"full"`:

```tsx
<Pitch
  crop="full"
  orientation={model.plot.pitch.orientation}
  {...(pitchTheme != null ? { theme: pitchTheme } : {})}
  {...(pitchColors != null ? { colors: pitchColors } : {})}
>
```

- [ ] **Step 5: Update the section `maxWidth` logic**

The outer section previously varied `maxWidth` based on `crop`. Simplify:

```tsx
const sectionMaxWidth = model.meta.orientation === "horizontal" ? 640 : 400;
```

- [ ] **Step 6: Remove any `crop`-referring assertions from the React test file**

Search `packages/react/test/PassNetwork.test.tsx` for `crop` — there should be no hits now. If any test passes `crop={...}` or inspects the old half-crop viewBox, delete it.

- [ ] **Step 7: Run the React suite**

Run: `pnpm exec vitest run packages/react/test/PassNetwork.test.tsx`

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/pass-network.ts packages/core/test/compute-pass-network.test.ts packages/react/src/PassNetwork.tsx packages/react/test/PassNetwork.test.tsx
git commit -m "feat(passnetwork)!: remove the broken crop=half filter

The filter-based crop='half' mode dropped 3-5 players from every
starting XI and produced a visually broken network. It also hit a
stadia nested-viewBox bug that left horizontal half-crop cards empty.

Replaced by the compress transforms added in the previous commit —
consumers who want a half-pitch presentation now compress the network
coordinates and pass them through the chart as normal. Single-team
half views and H2H compositions are built on the same primitive.

BREAKING: the crop prop is removed from both ComputePassNetworkInput
and PassNetworkProps. The chart always renders on the full pitch."
```

---

## Part E: aggregatePassNetwork uses initials by default

### Task E1: Thread `deriveInitials` into the helper

**Files:**

- Modify: `packages/core/src/aggregate-pass-network.ts`
- Modify: `packages/core/test/aggregate-pass-network.test.ts`

- [ ] **Step 1: Write the failing test first**

Inside `packages/core/test/aggregate-pass-network.test.ts`, find the "returns nodes keyed by player name with average positions" test and update its assertions so the node uses initials for `label` and the full name for `labelFull`:

```typescript
it("returns nodes keyed by player name with initial labels", () => {
  const passes: PassEvent[] = [
    makePass({
      id: "1",
      playerName: "Martin Ødegaard",
      recipient: "Bukayo Saka",
      x: 60,
      y: 40,
      endX: 75,
      endY: 30,
    }),
    makePass({
      id: "2",
      playerName: "Bukayo Saka",
      recipient: "Martin Ødegaard",
      x: 75,
      y: 30,
      endX: 60,
      endY: 40,
    }),
  ];
  const result = aggregatePassNetwork(passes, {
    teamId: "home",
    minPassesForNode: 1,
  });
  const ode = result.nodes.find((n) => n.labelFull === "Martin Ødegaard");
  const saka = result.nodes.find((n) => n.labelFull === "Bukayo Saka");
  expect(ode?.id).toBe("Martin Ødegaard");
  expect(ode?.label).toBe("MØ");
  expect(saka?.label).toBe("BS");
});
```

Also add a `labelFor` override test:

```typescript
it("accepts a labelFor override callback", () => {
  const passes: PassEvent[] = [
    makePass({
      id: "1",
      playerName: "Martin Ødegaard",
      recipient: "Declan Rice",
      x: 60,
      y: 40,
      endX: 55,
      endY: 55,
    }),
    makePass({
      id: "2",
      playerName: "Declan Rice",
      recipient: "Martin Ødegaard",
      x: 55,
      y: 55,
      endX: 60,
      endY: 40,
    }),
  ];
  const result = aggregatePassNetwork(passes, {
    teamId: "home",
    minPassesForNode: 1,
    labelFor: (name) => ({ label: name.slice(0, 1), labelFull: name }),
  });
  const ode = result.nodes.find((n) => n.labelFull === "Martin Ødegaard");
  expect(ode?.label).toBe("M");
});
```

- [ ] **Step 2: Run the failing tests**

Run: `pnpm exec vitest run packages/core/test/aggregate-pass-network.test.ts -t "initial|labelFor"`

Expected: FAIL — the helper still sets `label: id` and ignores `labelFor`.

- [ ] **Step 3: Add `labelFor` to `AggregatePassNetworkOptions`**

```typescript
export type AggregatePassNetworkOptions = {
  // ...existing fields...
  /**
   * Optional override for how a player name becomes a label + tooltip full
   * name. Default: `deriveInitials(name)` as the short label with the raw
   * name as the tooltip value.
   */
  labelFor?: (playerName: string) => { label: string; labelFull: string };
};
```

- [ ] **Step 4: Use `deriveInitials` + `labelFor` in the helper**

At the top of `aggregate-pass-network.ts`, add the import:

```typescript
import { deriveInitials } from "./pass-network-transforms.js";
```

Inside `aggregatePassNetwork`, when building the nodes array, derive the label + labelFull:

```typescript
const labelFor =
  options.labelFor ??
  ((name: string) => ({ label: deriveInitials(name), labelFull: name }));

// ...

for (const id of nodeIds) {
  const samples = positionSamples.get(id) ?? [];
  if (samples.length === 0) continue;
  const meanX = samples.reduce((sum, s) => sum + s.x, 0) / samples.length;
  const meanY = samples.reduce((sum, s) => sum + s.y, 0) / samples.length;
  const passCount = outgoingCount.get(id) ?? 0;
  const xT = xTForPlayer(id);
  const { label, labelFull } = labelFor(id);
  const node: PassNetworkNode = {
    id,
    label,
    labelFull,
    x: meanX,
    y: meanY,
    passCount,
  };
  if (xT != null) node.xT = xT;
  nodes.push(node);
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm exec vitest run packages/core/test/aggregate-pass-network.test.ts`

Expected: all tests pass, including the updated initial-label test.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/aggregate-pass-network.ts packages/core/test/aggregate-pass-network.test.ts
git commit -m "feat(core): aggregatePassNetwork emits initials by default

Nodes built from raw pass events now carry short initial-based labels
('MØ' for Martin Ødegaard) in the label field and the raw player name
in labelFull. Consumers can override the derivation via a new
labelFor?(name) callback.

This keeps the rendered circles legible while the tooltip still shows
the full name."
```

---

## Part F: Update committed fixtures

### Task F1: Regenerate fixture labels to use initials + full names

**Files:**

- Modify: `apps/site/src/data/passnetwork-demo.ts`

- [ ] **Step 1: Update every hand-curated fixture node**

The file has three pre-aggregated fixtures (`arsenalHeroNodes`, `liverpoolHeroNodes`, `arsenalLateNodes`) each with 11 nodes. Each node currently has a surname `label`. Add `labelFull` using the original surname and replace `label` with initials.

Because the fixture was auto-generated from the withqwerty JSON with `deriveSurname`, the surname is what lives in `label` today. To preserve the real full name we'd need the pipeline again, but for a demo surname→initials is enough: single-token surnames like "Raya" stay as "Raya", multi-token surnames like "van Dijk" collapse to "vD", and we store the surname as `labelFull`.

Update each node inline. Here is a reference for the first four nodes of each fixture:

**arsenalHeroNodes (first four):**

```typescript
export const arsenalHeroNodes: PassNetworkNode[] = [
  {
    id: "b1lcxeihx8z6pfv1jef4j5jh1",
    label: "MØ",
    labelFull: "Ødegaard",
    x: 58.8,
    y: 40.1,
    passCount: 41,
    xT: 0.18,
    completionRate: 0.68,
  },
  {
    id: "4iijb6llnz28unsz4rirr3umt",
    label: "DR",
    labelFull: "Raya",
    x: 10.6,
    y: 54.2,
    passCount: 33,
    xT: 0.02,
    completionRate: 0.55,
  },
  {
    id: "dhs8pujk55ewcis7y5alchu22",
    label: "RC",
    labelFull: "Calafiori",
    x: 51.5,
    y: 78.4,
    passCount: 27,
    xT: 0.042,
    completionRate: 0.85,
  },
  {
    id: "cnmlhoum9aahwqruxgmz2gcfd",
    label: "BW",
    labelFull: "White",
    x: 53.2,
    y: 15.9,
    passCount: 27,
    xT: 0.061,
    completionRate: 0.78,
  },
  // ...continue for the remaining 7 nodes...
];
```

For the remaining nodes pick a reasonable two-letter initial pair from known Arsenal/Liverpool starting XI first-name + surname combinations. When in doubt, use the first letter of the surname twice ("SS" for Saka → bad, so use "BS" with a mental "Bukayo Saka"). The committed initials do not need to be canonically correct — they just need to be short, unique within the team, and distinct enough for the demo.

Complete initial mapping (keep this table beside the edit):

- Ødegaard → MØ (Martin)
- Raya → DR (David)
- Calafiori → RC (Riccardo)
- White → BW (Ben)
- Saliba → WS (William)
- Magalhães → GM (Gabriel)
- Zubimendi → MZ (Martín)
- Rice → DR — **clashes with Raya** → use "Ri" instead
- Gyökeres → VG (Viktor)
- Saka → BS (Bukayo)
- Martinelli → GM — **clashes with Magalhães** → use "Mr"
- Eze → EE (Eberechi)
- Timber → JT (Jurriën)
- Mosquera → CM (Cristhian)
- Trossard → LT (Leandro)

**Rule for breaking clashes:** when two players on the same team would share a two-letter initial, fall back to a two-character surname abbreviation (first + second character of the surname) for the later player alphabetically: "Rice" → "Ri", "Martinelli" → "Mr". This keeps every label at two characters without collisions.

Use the same strategy for `liverpoolHeroNodes` and `arsenalLateNodes`. Full mapping:

**liverpoolHeroNodes:**

- Szoboszlai → DS (Dominik)
- Dijk → VD (Virgil van)
- Frimpong → JF (Jeremie)
- Konaté → IK (Ibrahima)
- Salah → MS (Mohamed)
- Becker → AB (Alisson)
- Kerkez → MK (Milos)
- Wirtz → FW (Florian)
- Allister → AM (Alexis Mac) — clashes nothing, keep
- Gakpo → CG (Cody)
- Ekitiké → HE (Hugo)

**arsenalLateNodes (Arsenal v Newcastle):**

- Eze → EE
- Raya → DR
- Calafiori → RC
- Magalhães → GM
- Mosquera → CM
- Timber → JT
- Rice → Ri (clash with Raya)
- Gyökeres → VG
- Trossard → LT
- Zubimendi → MZ
- Saka → BS

- [ ] **Step 2: Verify no clashes and the file typechecks**

Run: `pnpm typecheck`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/site/src/data/passnetwork-demo.ts
git commit -m "feat(site): passnetwork fixtures use initial labels

Every committed fixture node now uses a two-character initial pair
(e.g. 'MØ' for Ødegaard) in the rendered label and keeps the surname
as labelFull so the tooltip still reads naturally. Clashes within a
team fall back to a two-character surname abbreviation (e.g. 'Ri' for
Rice when Raya already owns 'DR')."
```

---

## Part G: Demo page — H2H + single-team compressed cards

### Task G1: Replace the broken half-crop card

**Files:**

- Modify: `apps/site/src/pages/passnetwork.astro`

- [ ] **Step 1: Import the new transforms**

Update the `@withqwerty/campos-core` import:

```typescript
import {
  aggregatePassNetwork,
  combinePassNetworks,
  compressPassNetwork,
} from "@withqwerty/campos-core";
```

- [ ] **Step 2: Build H2H + single-team compressed data at build time**

Add these declarations directly below the existing `helperResult` build-time line:

```typescript
// Build a single-team compressed-left view using the hero Arsenal fixture.
// The chart is unchanged — the transform just remaps x-coordinates so the
// whole network lives in [0, 50].
const arsenalCompressedLeft = compressPassNetwork(
  { nodes: arsenalHeroNodes, edges: arsenalHeroEdges },
  { side: "left" },
);

// Build an H2H view by compressing Arsenal into the left half (attacking
// rightward toward the centre) and Liverpool into the right half (attacking
// leftward toward the centre). Each team's nodes and edges get a team-color
// override so the chart can draw both on one shared pitch through a single
// instance.
// Node ids are prefixed per team so the combined node set stays unique.
const arsenalH2H = compressPassNetwork(
  {
    nodes: arsenalHeroNodes.map((n) => ({ ...n, id: `arsenal:${n.id}` })),
    edges: arsenalHeroEdges.map((e) => ({
      ...e,
      sourceId: `arsenal:${e.sourceId}`,
      targetId: `arsenal:${e.targetId}`,
    })),
  },
  { side: "left", color: arsenalHeroPrimaryColour },
);
const liverpoolH2H = compressPassNetwork(
  {
    nodes: liverpoolHeroNodes.map((n) => ({ ...n, id: `liverpool:${n.id}` })),
    edges: liverpoolHeroEdges.map((e) => ({
      ...e,
      sourceId: `liverpool:${e.sourceId}`,
      targetId: `liverpool:${e.targetId}`,
    })),
  },
  { side: "right", color: liverpoolHeroPrimaryColour },
);
const h2hCombined = combinePassNetworks(arsenalH2H, liverpoolH2H);
```

- [ ] **Step 3: Delete the broken "Half-pitch crop" demo card**

Find this block in the Astro `states` slot and delete it entirely:

```astro
<DemoCard
  title="Half-pitch crop"
  note="Only nodes with x ≥ 50; edges referencing dropped nodes are cleaned up automatically."
>
  <PassNetworkDemoPanel
    client:load
    nodes={arsenalLateNodes}
    edges={arsenalLateEdges}
    nodeColor={arsenalLatePrimaryColour}
    crop="half"
  />
</DemoCard>
```

- [ ] **Step 4: Add two new demo cards before the "Sparse fallback" card**

```astro
<DemoCard
  title={`Head-to-head — ${arsenalHeroMeta.club} vs ${liverpoolHeroMeta.club}`}
  note="Two teams on one shared pitch. Each network is compressed into its own half and tagged with a team color. Rendered through a single PassNetwork instance via combinePassNetworks."
>
  <PassNetworkDemoPanel client:load nodes={h2hCombined.nodes} edges={h2hCombined.edges} />
</DemoCard>

<DemoCard
  title="Single team compressed (left half)"
  note="compressPassNetwork(network, { side: 'left' }) remaps every node's x-coordinate into [0, 50]. The chart itself is unchanged — it always draws on a full pitch."
>
  <PassNetworkDemoPanel
    client:load
    nodes={arsenalCompressedLeft.nodes}
    edges={arsenalCompressedLeft.edges}
    nodeColor={arsenalHeroPrimaryColour}
  />
</DemoCard>
```

- [ ] **Step 5: Remove the `crop` row from the props table**

Find and delete the `crop` entry in the `props` array (if it still exists from the earlier packet).

- [ ] **Step 6: Remove `collisionPadding={0}` demo card's stale `crop` reference**

The "Collision relaxation off" card is fine, but double-check none of the other cards still pass `crop=`. Grep:

```bash
grep -n 'crop=' apps/site/src/pages/passnetwork.astro
```

Expected: no hits. If any remain, delete them.

- [ ] **Step 7: Run the site build**

Run: `pnpm --filter @withqwerty/campos-site build`

Expected: `/passnetwork/index.html` builds successfully.

- [ ] **Step 8: Commit**

```bash
git add apps/site/src/pages/passnetwork.astro
git commit -m "feat(site): replace half-crop card with H2H and compressed demos

The old 'Half-pitch crop' card is gone — its filter-based semantics
produced a broken 3-8 player view and its underlying crop prop was
removed from the chart. Two new cards take its place:

- 'Head-to-head' combines Arsenal's compressed-left network and
  Liverpool's compressed-right network through combinePassNetworks
  and renders both on a single shared pitch with per-team color
  overrides.
- 'Single team compressed (left half)' shows the primitive on its own
  so consumers can see what compressPassNetwork does before using it
  in a composition."
```

---

## Part H: Spec + status + final verification gate

### Task H1: Update the spec

**Files:**

- Modify: `docs/specs/passnetwork-spec.md`

- [ ] **Step 1: Remove `crop` from the public API + visual contract + edge matrix**

Search the file for every `crop` reference outside the "Post-shipping updates" section and delete them. Specifically:

- In the "Proposed public export" TypeScript sketch, delete the `crop?: "full" | "half";` line.
- In the "Advanced customization points" bullet list, delete the `crop="half"` bullet.
- In the "Default visual contract → Layout" block, delete the half-pitch aspect ratios.
- In the "Edge-case matrix", delete the half-crop entry if present.
- In the "States" list, delete the `half-crop` item.

- [ ] **Step 2: Add a new post-shipping entry at the bottom of the file**

Append:

```markdown
## Post-shipping updates (2026-04-10, part 3)

Two cleanups landed in a follow-up packet addressing real-world feedback:

- **`crop="half"` was removed entirely.** The filter-based half-pitch crop
  dropped 3-8 players from every starting XI, produced a visually broken
  network, and masked a stadia nested-viewBox asymmetry that made the card
  render empty. Replaced by explicit compose helpers (`compressPassNetwork`,
  `combinePassNetworks`) that remap x-coordinates into one half of the
  pitch and let consumers build head-to-head views by combining two
  compressed networks through a single chart instance.
- **Labels default to initials + `labelFull`.** Long surnames (Zubimendi,
  Magalhães) overflowed their node circles and raw adapter names ("Eberechi
  Eze") were worse. Node type now accepts an optional `labelFull?: string`
  for the tooltip text while `label` stays short. `aggregatePassNetwork`
  derives initials via a new `deriveInitials(name)` helper by default and
  accepts a `labelFor` override callback.
- **Per-node / per-edge color overrides** on `PassNetworkNode` and
  `PassNetworkEdge` let H2H compositions tag both teams before feeding
  them through a single chart instance.

New exports from `@withqwerty/campos-core`:

- `deriveInitials(name: string): string`
- `compressPassNetwork(network, { side: "left" | "right", color? })`
- `combinePassNetworks(...networks)`

The demo page lost the broken "Half-pitch crop" card and gained two
replacements: a head-to-head card (Arsenal vs Liverpool on a shared
pitch) and a single-team compressed-left card showing the primitive.
```

### Task H2: Final verification gate

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`

Expected: clean.

- [ ] **Step 2: Full test suite**

Run: `pnpm test`

Expected: all tests pass. Count should be baseline + net new:

- New: 5 deriveInitials + 5 compressPassNetwork + 2 combinePassNetworks = 12 (Part A)
- New: 3 per-node color override (Part B)
- New: 2 labelFull tooltip (Part C)
- Deleted: 1 half-crop empty state test + 3 half-crop describe tests + 1 scaling half-pitch test = 5
- Updated: 1 initial-label aggregate test + 1 labelFor aggregate test (Part E)

Net: 691 (baseline from previous packet) − 5 + 12 + 3 + 2 + 2 = **705 tests**.

- [ ] **Step 3: Lint**

Run: `pnpm lint`

Expected: 0 errors. The pre-existing warnings may tick up by 1-2 for new non-null assertions; that is acceptable.

- [ ] **Step 4: Prettier check**

Run: `pnpm format:check`

Expected: exits 0. Run `pnpm format` and re-commit if it fails.

- [ ] **Step 5: Site build**

Run: `pnpm --filter @withqwerty/campos-site build`

Expected: 19 pages built including `/passnetwork/index.html`.

- [ ] **Step 6: Commit docs**

```bash
git add docs/specs/passnetwork-spec.md
git commit -m "docs(passnetwork): log compress + initials packet

Records the crop removal, compress/combine transforms, initials
default, labelFull tooltip fallback, and per-node/per-edge color
overrides as shipped in the follow-up packet."
```

---

## Self-review checklist

**1. Spec coverage** — every user requirement from the conversation has a task:

- "half-pitch crop doesn't work" → Part D (remove) + Part G (replace card)
- "compress into half a pitch" → Part A (`compressPassNetwork`)
- "H2H pass networks" → Part A (`combinePassNetworks`) + Part B (per-node/edge color) + Part G (H2H demo card)
- "player initials instead of names" → Part A (`deriveInitials`) + Part C (`labelFull`) + Part E (helper default) + Part F (fixtures)

**2. Placeholder scan** — every implementation step contains literal code or runnable commands. No TODOs.

**3. Type consistency check:**

- `PassNetworkNode.labelFull` — added in B1, read in C2, populated in E1 + F1, exercised in C1/E1 tests.
- `PassNetworkNode.color` — added in B1, read in B3 (`nodeColorFor`), populated in A2/F1, exercised in B2 tests.
- `PassNetworkEdge.color` — added in B1, read in B3 (via `colorOverride` thread), populated in A2, exercised in B2 tests.
- `ComputePassNetworkInput.crop` / `PassNetworkModel.meta.crop` / `plot.pitch.crop` — removed together in D1 and their consumers cleaned up in D2.
- `CompressSide`, `CompressPassNetworkOptions` — exported in A1 barrel, consumed in G1.
- `AggregatePassNetworkOptions.labelFor` — added in E1, exercised by the new labelFor test.
- `deriveInitials`, `compressPassNetwork`, `combinePassNetworks` — all exported in A1 and consumed by the demo page in G1.

**4. DRY / YAGNI:**

- Only one fallback chain in `nodeColorFor`: `node.color` > xT > `nodeColor`. No parallel systems.
- `combinePassNetworks` is a one-liner but worth exporting because the H2H demo uses it and future consumers will reach for the same pattern.
- `labelFor` accepts a single callback returning both label + labelFull; no parallel fields.

**5. TDD:** every implementation task is preceded by a failing-test task.

**6. Commits:** 8 total, one per Part, each independently reviewable. Breaking change (Part D) is explicit in the commit message with a `!` marker.

**7. Bite-sized steps:** every step is 2-5 minutes of work.

---

**Plan complete and saved to `docs/archived/specs/passnetwork-compress-and-initials-plan.md`.**
