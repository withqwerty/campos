# PassNetwork Follow-ups Implementation Plan

**Status:** archived
**Superseded by:** `docs/specs/passnetwork-spec.md`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four additive enhancements to the v0.3 `PassNetwork` component — an ego-network hover highlight, node collision relaxation, directed-edge rendering with tapered shafts, and an `aggregatePassNetwork` helper that turns raw `PassEvent[]` into `{ nodes, edges }`.

**Architecture:** All four features are independent, additive, and default-safe. Ego highlight is a renderer-only change. Collision relaxation adds a post-scaling pass in core. Directed mode opts out of the merge step and adds a polygon-shaped edge in the renderer. The aggregate helper lives in a new sibling module in `@withqwerty/campos-core` and uses `playerName` as the node id so it works across adapters without schema changes. Each part commits independently and adds demo coverage.

**Tech Stack:** TypeScript workspace (`@withqwerty/campos-core`, `@withqwerty/campos-react`, `@withqwerty/campos-stadia`), React 19 SVG rendering, Vitest + vitest-axe, Astro demo site, pnpm workspaces.

---

## File Structure

### Created files

- `packages/core/src/aggregate-pass-network.ts` — new helper module. Separated from `pass-network.ts` because the aggregation concerns (time windows, substitution handling, name-based pair matching) are distinct from the pure scale/layout concerns of the chart core and should be independently testable.
- `packages/core/test/aggregate-pass-network.test.ts` — dedicated test file for the helper.

### Modified files

- `packages/core/src/pass-network.ts` — add `directed` input, `collisionPadding` input, collision relaxation pass, `isDirected` field on rendered edges.
- `packages/core/src/index.ts` — export `aggregatePassNetwork` + its types.
- `packages/core/test/compute-pass-network.test.ts` — tests for directed mode + collision relaxation.
- `packages/react/src/PassNetwork.tsx` — add `egoHighlight` prop, compute related set on focus, dim non-related marks, render tapered polygons for directed edges.
- `packages/react/test/PassNetwork.test.tsx` — interaction test for ego highlight, render test for directed polygons.
- `apps/site/src/data/passnetwork-demo.ts` — add a typed re-export of raw passes from the existing WhoScored fixture for the aggregate-helper demo card.
- `apps/site/src/pages/passnetwork.astro` — add 4 new demo cards.
- `docs/specs/passnetwork-spec.md` — flip the 4 "Open questions" / "Extension seams" entries from deferred to shipped, add a post-shipping changelog row.
- `docs/status/matrix.md` — update PassNetwork row (review loops 2/3 — still partial until loops run, but quality axis coverage improves).

### Sequencing

Smallest wins first so each merge is reviewable in isolation:

1. **Part A** — Ego highlight (React-only, ~1 commit)
2. **Part B** — Collision relaxation (core + tests, ~2 commits)
3. **Part C** — Directed edges (core + React + tests, ~3 commits)
4. **Part D** — `aggregatePassNetwork` helper (new module + tests + demo, ~4 commits)
5. **Part E** — Demo page additions (wraps all 4 parts into visible cards, ~1 commit)
6. **Part F** — Spec/status updates + final verification gate

---

## Part A: Interactive ego-network highlight

**Rationale:** The pass-network research memo calls this "the single most valuable interactive feature for pass networks". It's also a renderer-only concern — the core already emits `edges` with `sourceId`/`targetId`, and the React layer already tracks a `focus` state. Computing "related set = focused node + every edge touching it + every counterpart node" is a 5-line derivation.

**Default:** `egoHighlight = true`. Consumers who want plain hover tooltip pass `egoHighlight={false}`.

### Task A1: Compute related set on focus change

**Files:**

- Modify: `packages/react/src/PassNetwork.tsx` (add derivation next to `activeNode`/`activeEdge`)

- [ ] **Step 1: Read current `activeNode` / `activeEdge` derivation**

Find the existing lines in `PassNetwork.tsx` that look like:

```tsx
const activeNode =
  focus && focus.kind === "node"
    ? (model.plot.nodes.find((n) => n.id === focus.id) ?? null)
    : null;
const activeEdge =
  focus && focus.kind === "edge"
    ? (model.plot.edges.find((e) => e.id === focus.id) ?? null)
    : null;
```

- [ ] **Step 2: Add related-set derivation after the active lookups**

Insert immediately after the `activeEdge` line:

```tsx
// When ego highlight is on and a node is focused, compute the set of
// related edges and the counterpart nodes. Non-related marks dim.
const egoRelated = useMemo(() => {
  if (!egoHighlight || !activeNode) return null;
  const relatedEdgeIds = new Set<string>();
  const relatedNodeIds = new Set<string>([activeNode.id]);
  for (const edge of model.plot.edges) {
    if (edge.sourceId === activeNode.id || edge.targetId === activeNode.id) {
      relatedEdgeIds.add(edge.id);
      relatedNodeIds.add(edge.sourceId);
      relatedNodeIds.add(edge.targetId);
    }
  }
  return { relatedEdgeIds, relatedNodeIds };
}, [egoHighlight, activeNode, model.plot.edges]);
```

- [ ] **Step 3: Add `egoHighlight` prop with a default**

Update the `PassNetworkProps` type:

```tsx
export type PassNetworkProps = {
  nodes: ComputePassNetworkInput["nodes"];
  edges: ComputePassNetworkInput["edges"];
  minEdgePasses?: ComputePassNetworkInput["minEdgePasses"];
  colorBy?: ComputePassNetworkInput["colorBy"];
  sizeBy?: ComputePassNetworkInput["sizeBy"];
  showLabels?: ComputePassNetworkInput["showLabels"];
  nodeColor?: ComputePassNetworkInput["nodeColor"];
  xTColorScale?: ComputePassNetworkInput["xTColorScale"];
  crop?: ComputePassNetworkInput["crop"];
  orientation?: ComputePassNetworkInput["orientation"];
  pitchTheme?: PitchTheme;
  pitchColors?: PitchColors;
  /**
   * Whether hovering/focusing a node should dim everything except that
   * node's edges and their counterparts. Default: true.
   */
  egoHighlight?: boolean;
};
```

Then destructure `egoHighlight = true` in the `PassNetwork` function signature:

```tsx
export function PassNetwork({
  nodes,
  edges,
  minEdgePasses,
  colorBy,
  sizeBy,
  showLabels,
  nodeColor,
  xTColorScale,
  crop,
  orientation,
  pitchTheme,
  pitchColors,
  egoHighlight = true,
}: PassNetworkProps) {
```

### Task A2: Thread `dimmed` into `renderNode` / `renderEdge`

**Files:**

- Modify: `packages/react/src/PassNetwork.tsx` (renderNode + renderEdge signatures + call sites)

- [ ] **Step 1: Add a `dimmed` parameter to both render helpers**

Change the function signatures to:

```tsx
function renderEdge(
  edge: PassNetworkRenderedEdge,
  project: ProjectFn,
  active: boolean,
  dimmed: boolean,
  onEnter: () => void,
  onLeave: () => void,
  onFocus: () => void,
  onBlur: () => void,
  onClick: () => void,
): ReactNode {
```

```tsx
function renderNode(
  node: PassNetworkRenderedNode,
  project: ProjectFn,
  active: boolean,
  dimmed: boolean,
  onEnter: () => void,
  onLeave: () => void,
  onFocus: () => void,
  onBlur: () => void,
  onClick: () => void,
): ReactNode {
```

- [ ] **Step 2: Apply the dimmed opacity in `renderEdge`**

In the visible `<line>` element of `renderEdge`, change the opacity calculation:

```tsx
<line
  x1={x1}
  y1={y1}
  x2={x2}
  y2={y2}
  stroke={edge.color}
  strokeWidth={edge.width}
  strokeLinecap="round"
  opacity={
    dimmed ? edge.opacity * 0.15 : active ? Math.min(edge.opacity + 0.2, 1) : edge.opacity
  }
/>
```

- [ ] **Step 3: Apply the dimmed opacity in `renderNode`**

In the node circles and label of `renderNode`, wrap the outer group opacity:

```tsx
<g
  key={node.id}
  role="button"
  tabIndex={0}
  aria-label={nodeAriaLabel(node)}
  onMouseEnter={onEnter}
  onMouseLeave={onLeave}
  onFocus={onFocus}
  onBlur={onBlur}
  onClick={onClick}
  opacity={dimmed ? 0.25 : 1}
  style={{ cursor: "pointer", outline: "none" }}
>
```

- [ ] **Step 4: Pass `dimmed` values at the call sites**

Update the `renderEdge` call in the JSX loop to compute `dimmed`:

```tsx
{
  model.plot.edges.map((edge) => {
    const h = makeFocusHandlers({ kind: "edge", id: edge.id });
    const dimmed = egoRelated != null && !egoRelated.relatedEdgeIds.has(edge.id);
    return renderEdge(
      edge,
      project,
      activeEdge?.id === edge.id,
      dimmed,
      h.set,
      h.clear,
      h.set,
      h.clear,
      h.toggle,
    );
  });
}
```

And the `renderNode` call:

```tsx
{
  model.plot.nodes.map((node) => {
    const h = makeFocusHandlers({ kind: "node", id: node.id });
    const dimmed = egoRelated != null && !egoRelated.relatedNodeIds.has(node.id);
    return renderNode(
      node,
      project,
      activeNode?.id === node.id,
      dimmed,
      h.set,
      h.clear,
      h.set,
      h.clear,
      h.toggle,
    );
  });
}
```

### Task A3: Add interaction test for ego highlight

**Files:**

- Modify: `packages/react/test/PassNetwork.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to the `<PassNetwork /> — interaction` describe block:

```tsx
it("dims non-related nodes and edges when a node is focused (ego highlight)", () => {
  const { getAllByRole, container } = render(<PassNetwork nodes={nodes} edges={edges} />);
  const interactives = getAllByRole("button");
  const gkNode = interactives.find((el) =>
    (el.getAttribute("aria-label") ?? "").includes("Player: Raya"),
  );
  expect(gkNode).toBeDefined();
  fireEvent.focus(gkNode!);

  // After focus, counting dimmed groups:
  //   - nodes NOT connected to Raya are dimmed → 5 total nodes − {Raya, cb1, cb2} = 2 dimmed
  //   - edges NOT involving Raya are dimmed → 4 total − {gk↔cb1, gk↔cb2} = 2 dimmed
  const groups = Array.from(container.querySelectorAll('g[role="button"]'));
  const dimmedCount = groups.filter((g) => g.getAttribute("opacity") === "0.25").length;
  expect(dimmedCount).toBe(2); // 2 non-connected nodes dimmed (edges dim via stroke opacity, not group)
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
```

- [ ] **Step 2: Run the failing test**

Run: `pnpm exec vitest run packages/react/test/PassNetwork.test.tsx -t "ego"`

Expected: the `dims non-related` test runs against the implementation from tasks A1+A2 and should pass; the `disables ego highlight` test should also pass because the `egoHighlight={false}` path bypasses the derivation entirely. If either fails, go fix the impl.

- [ ] **Step 3: Run the full React suite to catch regressions**

Run: `pnpm exec vitest run packages/react/test/PassNetwork.test.tsx`

Expected: all tests pass (12 existing + 2 new = 14).

- [ ] **Step 4: Commit**

```bash
git add packages/react/src/PassNetwork.tsx packages/react/test/PassNetwork.test.tsx
git commit -m "feat(passnetwork): add ego-network hover highlight

Hovering or focusing a node now dims nodes and edges that are not
directly connected to it, leaving the focused node's ego network fully
visible. Opt-out via egoHighlight={false}.

Implements the research-memo recommendation that 'ego network
highlighting is the single most valuable interactive feature for pass
networks'."
```

---

## Part B: Node collision relaxation

**Rationale:** Central-midfield clusters (Zubimendi + Ødegaard + Rice in the Arsenal hero) frequently overlap in real data because their average positions sit on top of each other. A few iterations of pairwise repulsion pushes overlapping nodes apart while keeping their approximate positions, per the research memo's "gentle jiggle" recommendation. **Never use force-directed layout** — this is a localised, bounded relaxation.

**Default:** `collisionPadding = 0.5` meters (just enough to eliminate touches). Set to `0` to disable.

### Task B1: Write the failing test for collision relaxation

**Files:**

- Modify: `packages/core/test/compute-pass-network.test.ts`

- [ ] **Step 1: Add a new describe block at the end of the file**

```typescript
// ─── Collision relaxation ──────────────────────────────────────────

describe("computePassNetwork — collision relaxation", () => {
  it("pushes overlapping nodes apart while preserving the cluster centroid", () => {
    // Two nodes placed at essentially the same spot
    const nodes: PassNetworkNode[] = [
      { id: "a", label: "A", x: 50, y: 50, passCount: 20 },
      { id: "b", label: "B", x: 50.05, y: 50.05, passCount: 20 },
    ];
    const model = computePassNetwork({ nodes, edges: [] });
    const a = model.plot.nodes.find((n) => n.id === "a")!;
    const b = model.plot.nodes.find((n) => n.id === "b")!;
    // Both should have non-negligible separation now
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const required = a.radius + b.radius + 0.5; // radii + default padding
    expect(distance).toBeGreaterThanOrEqual(required - 0.01);
    // Cluster centroid roughly preserved (was 50.025, 50.025)
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    expect(cx).toBeCloseTo(50.025, 1);
    expect(cy).toBeCloseTo(50.025, 1);
    // displaced flag set on at least one of them
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
      // Original coordinates preserved
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
    // Coordinates unchanged from input
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
```

- [ ] **Step 2: Run the failing tests**

Run: `pnpm exec vitest run packages/core/test/compute-pass-network.test.ts -t "collision"`

Expected: FAIL — `collisionPadding` is not a known input, `displaced` is not a field on `PassNetworkRenderedNode`, and overlapping nodes are not moved.

### Task B2: Add `collisionPadding` input and `displaced` output field

**Files:**

- Modify: `packages/core/src/pass-network.ts`

- [ ] **Step 1: Add `collisionPadding` to `ComputePassNetworkInput`**

Find the `ComputePassNetworkInput` type and add the new optional field:

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
  crop?: "full" | "half";
  orientation?: "horizontal" | "vertical";
  /**
   * Minimum gap (SVG user units / meters) between two node edges after
   * collision relaxation. Set to 0 to disable relaxation entirely. Default: 0.5.
   */
  collisionPadding?: number;
};
```

- [ ] **Step 2: Add `displaced` to `PassNetworkRenderedNode`**

Update the rendered-node type:

```typescript
export type PassNetworkRenderedNode = {
  id: string;
  label: string;
  /** Possibly-displaced Campos coordinates (0-100). */
  x: number;
  y: number;
  /** Rendered radius in SVG user units (meters). */
  radius: number;
  /** Label font size in SVG user units (meters). Scaled from radius. */
  labelFontSize: number;
  /** Resolved fill color (hex). */
  color: string;
  /** Resolved label color for readable contrast against the fill. */
  labelColor: string;
  /** Whether the label should be rendered at all (large enough + showLabels). */
  showLabel: boolean;
  /** Normalized size weight used for the scale (0-1). */
  sizeWeight: number;
  /** True when collision relaxation moved this node from its input position. */
  displaced: boolean;
  tooltip: PassNetworkTooltipModel;
};
```

### Task B3: Implement collision relaxation

**Files:**

- Modify: `packages/core/src/pass-network.ts`

- [ ] **Step 1: Add the relaxation helper near the other helpers**

Insert the following helper after the `formatXT` function (near line ~260, before `buildNodeTooltip`):

```typescript
/**
 * Pairwise collision relaxation — nudges overlapping nodes apart while
 * preserving each pair's midpoint. Campos coordinates are in [0, 100];
 * the padding is in SVG user units (meters) via the supplied projection
 * from pitch-meters to Campos-units.
 *
 * Algorithm: up to `iterations` passes of O(n²) pair checks. Each pass,
 * for every pair closer than the required separation, split the overlap
 * evenly and push each node half the delta along the axis between them.
 * Converges quickly for the ≤11 nodes a starting XI produces.
 */
function relaxCollisions(
  nodes: ReadonlyArray<{
    id: string;
    x: number;
    y: number;
    radius: number;
  }>,
  paddingMeters: number,
  metersToCamposX: number,
  metersToCamposY: number,
  iterations = 8,
): Map<string, { x: number; y: number; displaced: boolean }> {
  const result = new Map<string, { x: number; y: number; displaced: boolean }>();
  for (const n of nodes) {
    result.set(n.id, { x: n.x, y: n.y, displaced: false });
  }
  if (paddingMeters <= 0 || nodes.length < 2) return result;

  for (let iter = 0; iter < iterations; iter++) {
    let anyMoved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = result.get(nodes[i]!.id)!;
        const b = result.get(nodes[j]!.id)!;
        // Convert Campos deltas to meters for the separation check.
        const dxCampos = b.x - a.x;
        const dyCampos = b.y - a.y;
        const dxMeters = dxCampos / metersToCamposX;
        const dyMeters = dyCampos / metersToCamposY;
        const distMeters = Math.sqrt(dxMeters * dxMeters + dyMeters * dyMeters);
        const required = nodes[i]!.radius + nodes[j]!.radius + paddingMeters;
        if (distMeters >= required) continue;
        if (distMeters < 1e-6) {
          // Exactly coincident — pick a deterministic unit vector along x.
          const overlap = required;
          const halfCampos = (overlap / 2) * metersToCamposX;
          a.x -= halfCampos;
          b.x += halfCampos;
          a.displaced = true;
          b.displaced = true;
          anyMoved = true;
          continue;
        }
        const overlapMeters = required - distMeters;
        const halfMeters = overlapMeters / 2;
        // Unit vector in meters space
        const uxMeters = dxMeters / distMeters;
        const uyMeters = dyMeters / distMeters;
        const shiftAxMeters = -uxMeters * halfMeters;
        const shiftAyMeters = -uyMeters * halfMeters;
        const shiftBxMeters = uxMeters * halfMeters;
        const shiftByMeters = uyMeters * halfMeters;
        a.x += shiftAxMeters * metersToCamposX;
        a.y += shiftAyMeters * metersToCamposY;
        b.x += shiftBxMeters * metersToCamposX;
        b.y += shiftByMeters * metersToCamposY;
        a.displaced = true;
        b.displaced = true;
        anyMoved = true;
      }
    }
    if (!anyMoved) break;
  }

  // Clamp to pitch after relaxation.
  for (const v of result.values()) {
    v.x = Math.max(0, Math.min(100, v.x));
    v.y = Math.max(0, Math.min(100, v.y));
  }
  return result;
}
```

- [ ] **Step 2: Call the helper inside `computePassNetwork` after scaling and before rendered-node construction**

Find the section where scales are computed (the "Build rendered nodes" comment). Just before that loop, insert:

```typescript
// Relax overlapping nodes. Convert Campos-unit deltas to meters using the
// pitch projection: the horizontal pitch is 105 m wide, 68 m tall; the
// vertical pitch swaps them. Half crop only shrinks the length dimension.
const pitchMetersWide =
  orientation === "horizontal" ? (crop === "half" ? 52.5 : 105) : 68;
const pitchMetersTall = orientation === "horizontal" ? 68 : crop === "half" ? 52.5 : 105;
// Campos is always 0-100 on both axes, so 1 Campos unit = pitchMetersWide/100 m.
// Helpers expect the OPPOSITE ratio: "how many Campos units per meter".
const metersToCamposX = 100 / pitchMetersWide;
const metersToCamposY = 100 / pitchMetersTall;

const paddingMeters = input.collisionPadding ?? 0.5;

// Pre-compute each surviving node's radius so relaxation can check separation.
const nodeRadiusCache = croppedNodes.map((n) => ({
  id: n.id,
  x: n.x,
  y: n.y,
  radius: nodeRadiusFor(n.passCount).radius,
}));
const relaxed = relaxCollisions(
  nodeRadiusCache,
  paddingMeters,
  metersToCamposX,
  metersToCamposY,
);
```

- [ ] **Step 3: Use the relaxed positions when building rendered nodes**

Find the existing "Build rendered nodes" loop and update it to read from `relaxed`:

```typescript
// Build rendered nodes
const renderedNodes: PassNetworkRenderedNode[] = croppedNodes.map((node) => {
  const { radius, weight } = nodeRadiusFor(node.passCount);
  const color = nodeColorFor(node);
  const labelColor = preferDarkLabel(color) ? "#1a202c" : "#ffffff";
  const resolvedXT = node.xT ?? null;
  const position = relaxed.get(node.id)!;
  return {
    id: node.id,
    label: node.label,
    x: position.x,
    y: position.y,
    radius,
    labelFontSize: radius * LABEL_FONT_RATIO,
    color,
    labelColor,
    showLabel: showLabels && radius >= minLabelRadius,
    sizeWeight: weight,
    displaced: position.displaced,
    tooltip: buildNodeTooltip(node, resolvedXT),
  };
});
```

- [ ] **Step 4: Make rendered edges read from the relaxed node positions too**

The existing `renderedEdges` loop does:

```typescript
sourceX: source.x,
sourceY: source.y,
targetX: target.x,
targetY: target.y,
```

where `source` and `target` come from the `nodeById` map. Since that map is built from `renderedNodes` (now with relaxed positions), edges automatically pick up the relaxed positions. **No change needed** — verify this by re-reading the `nodeById` construction:

```typescript
const nodeById = new Map(renderedNodes.map((n) => [n.id, n]));
```

Good — edges will inherit.

- [ ] **Step 5: Run the failing collision tests — they should now pass**

Run: `pnpm exec vitest run packages/core/test/compute-pass-network.test.ts -t "collision"`

Expected: all 4 collision tests pass.

- [ ] **Step 6: Run the full core suite to catch regressions**

Run: `pnpm exec vitest run packages/core/test/compute-pass-network.test.ts`

Expected: 27+ tests pass (24 existing + 4 new collision tests). **Note**: the existing `stamps a deterministic accessible label` test uses hand-placed `baseNodes` that are well-separated (cb1 at (25,35), cb2 at (25,65), etc.) so none should trigger relaxation. If any existing test fails because its nodes were close together, that's genuinely useful signal — fix the fixture by moving nodes apart.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/pass-network.ts packages/core/test/compute-pass-network.test.ts
git commit -m "feat(passnetwork): add pairwise collision relaxation

Overlapping nodes (common for central-midfield clusters where 3+
players average into the same spot) are now pushed apart with a gentle
pairwise relaxation that preserves each pair's centroid. Default
padding is 0.5m; set collisionPadding=0 to disable.

Bounded iterative algorithm — not force layout — so spatial meaning is
preserved."
```

---

## Part C: Directed edges with tapered shafts

**Rationale:** Undirected edges lose information about passing asymmetry. Directed mode keeps both A→B and B→A as separate marks, rendered as tapered quadrilaterals (wide at source, narrow at target) per the graph-visualization research showing tapered edges outperform arrows for direction perception.

**Default:** `directed = false`. When `directed = true`:

- Core skips the undirected merge step
- Core returns `isDirected: boolean` on each edge so the renderer can switch shapes
- React renders polygons instead of lines
- Overlapping reverse pairs (A→B + B→A) are drawn with a perpendicular offset so they don't overlap

### Task C1: Write the failing core tests for directed mode

**Files:**

- Modify: `packages/core/test/compute-pass-network.test.ts`

- [ ] **Step 1: Add a new describe block**

Append to the file:

```typescript
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
    // No merge warning should fire
    expect(model.meta.warnings.some((w) => w.includes("Merged"))).toBe(false);
  });

  it("merges reversed pairs when directed is false (default)", () => {
    const model = computePassNetwork({
      nodes: dirNodes,
      edges: dirEdges,
    });
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
    // Order must be deterministic — sort by sourceId then targetId
    expect(model.plot.edges.map((e) => `${e.sourceId}→${e.targetId}`)).toEqual([
      "a→b",
      "b→a",
    ]);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `pnpm exec vitest run packages/core/test/compute-pass-network.test.ts -t "directed"`

Expected: FAIL — `directed` is not a known input, `isDirected` is not on the rendered edge type.

### Task C2: Add `directed` input and `isDirected` output field

**Files:**

- Modify: `packages/core/src/pass-network.ts`

- [ ] **Step 1: Add `directed` to `ComputePassNetworkInput`**

```typescript
export type ComputePassNetworkInput = {
  // ...existing fields...
  /**
   * When true, reversed edges (A→B and B→A) are kept as distinct marks and
   * the renderer draws them as tapered polygons with a slight perpendicular
   * offset to avoid overlap. Default: false (undirected merge).
   */
  directed?: boolean;
};
```

- [ ] **Step 2: Add `isDirected` to `PassNetworkRenderedEdge`**

```typescript
export type PassNetworkRenderedEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  /** Undirected pass count (post-merge) or directed count when isDirected. */
  passCount: number;
  /** Merged xT value (passCount-weighted mean) or directed xT. */
  xT: number | null;
  /** True when this edge represents a single direction (not merged). */
  isDirected: boolean;
  /** Stroke width in Campos pitch units. */
  width: number;
  /** Resolved stroke color (hex). */
  color: string;
  /** Stroke opacity (0-1). */
  opacity: number;
  /** Endpoint labels for the tooltip. */
  sourceLabel: string;
  targetLabel: string;
  tooltip: PassNetworkTooltipModel;
};
```

### Task C3: Implement the directed code path in `computePassNetwork`

**Files:**

- Modify: `packages/core/src/pass-network.ts`

- [ ] **Step 1: Read the current merge step**

Find the section labeled `// 6: merge undirected duplicates` in `computePassNetwork`. It builds a `Map<string, MergeBucket>` and reduces into `mergedEdges`.

- [ ] **Step 2: Make the merge conditional on `!directed`**

Replace the merge block so directed mode skips it and emits edges directly:

```typescript
// 6: merge (undirected) or keep distinct (directed)
const directed = input.directed ?? false;
type MergedEdge = {
  sourceId: string;
  targetId: string;
  passCount: number;
  xT: number | null;
};
let mergedEdges: MergedEdge[];

if (directed) {
  // Keep every valid edge as-is. Sort for deterministic order.
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
    }))
    .filter((e) => e.passCount >= minEdgePasses);
} else {
  type MergeBucket = {
    key: string;
    sourceId: string;
    targetId: string;
    passCount: number;
    xTWeighted: number;
    xTWeightSum: number;
    xTObserved: boolean;
  };
  const buckets = new Map<string, MergeBucket>();
  for (const edge of validEdges) {
    const [a, b] =
      edge.sourceId <= edge.targetId
        ? [edge.sourceId, edge.targetId]
        : [edge.targetId, edge.sourceId];
    const key = `${a}::${b}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        sourceId: a,
        targetId: b,
        passCount: 0,
        xTWeighted: 0,
        xTWeightSum: 0,
        xTObserved: false,
      };
      buckets.set(key, bucket);
    } else {
      warnings.push(
        `Merged duplicate/reversed edge pair: ${edge.sourceId}↔${edge.targetId}`,
      );
    }
    bucket.passCount += edge.passCount;
    if (edge.xT != null && Number.isFinite(edge.xT)) {
      bucket.xTWeighted += edge.passCount * edge.xT;
      bucket.xTWeightSum += edge.passCount;
      bucket.xTObserved = true;
    }
  }

  // 7: threshold
  mergedEdges = Array.from(buckets.values())
    .filter((b) => b.passCount >= minEdgePasses)
    .map((b) => ({
      sourceId: b.sourceId,
      targetId: b.targetId,
      passCount: b.passCount,
      xT: b.xTObserved && b.xTWeightSum > 0 ? b.xTWeighted / b.xTWeightSum : null,
    }));
}
```

- [ ] **Step 3: Set `isDirected` on each rendered edge**

In the `renderedEdges` map, add `isDirected`:

```typescript
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
```

- [ ] **Step 4: Run the directed core tests**

Run: `pnpm exec vitest run packages/core/test/compute-pass-network.test.ts -t "directed"`

Expected: all 3 directed tests pass.

- [ ] **Step 5: Run the full core suite**

Run: `pnpm exec vitest run packages/core/test/compute-pass-network.test.ts`

Expected: all tests pass. The existing "merges reversed edge pairs" test stays green (it doesn't pass `directed`, so it defaults to `false` → merge path).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/pass-network.ts packages/core/test/compute-pass-network.test.ts
git commit -m "feat(passnetwork): add directed mode to core compute

When directed=true, reversed edge pairs stay distinct and the rendered
edges carry isDirected=true so the renderer can switch geometry. Sorts
directed edges deterministically by (sourceId, targetId)."
```

### Task C4: Render directed edges as tapered polygons in React

**Files:**

- Modify: `packages/react/src/PassNetwork.tsx`

- [ ] **Step 1: Add a geometry helper for the tapered polygon**

Near the top of `PassNetwork.tsx`, after the `makeFocusHandlers` helper (or near the top-level helpers), add:

```tsx
/**
 * Build an SVG path for a tapered directed edge:
 *  - Wide at the source (width = maxW)
 *  - Narrow at the target (width = maxW * 0.2)
 *  - Short stubs cut off both ends so the taper doesn't overlap the
 *    source/target node radii.
 *  - Applies a perpendicular offset so that when two reversed edges exist,
 *    they don't overlap on the same line. `sidePx` is the offset in SVG
 *    user units; positive values shift the shaft to the "left" of the
 *    source→target direction.
 */
function taperedEdgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  sourceRadius: number,
  targetRadius: number,
  maxWidth: number,
  sidePx: number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 1e-6) return "";
  const ux = dx / length;
  const uy = dy / length;
  // Perpendicular (left of direction)
  const px = -uy;
  const py = ux;

  // Cut off the ends so the taper doesn't disappear inside the node circles.
  // Leave a small extra gap so the tip visibly points at the target.
  const startCut = sourceRadius + 0.2;
  const endCut = targetRadius + 0.4;
  const startX = x1 + ux * startCut + px * sidePx;
  const startY = y1 + uy * startCut + py * sidePx;
  const endX = x2 - ux * endCut + px * sidePx;
  const endY = y2 - uy * endCut + py * sidePx;

  const wSource = maxWidth;
  const wTarget = maxWidth * 0.2;

  // Four polygon corners
  const s1x = startX + px * (wSource / 2);
  const s1y = startY + py * (wSource / 2);
  const s2x = startX - px * (wSource / 2);
  const s2y = startY - py * (wSource / 2);
  const t1x = endX + px * (wTarget / 2);
  const t1y = endY + py * (wTarget / 2);
  const t2x = endX - px * (wTarget / 2);
  const t2y = endY - py * (wTarget / 2);

  return `M ${s1x} ${s1y} L ${t1x} ${t1y} L ${t2x} ${t2y} L ${s2x} ${s2y} Z`;
}
```

- [ ] **Step 2: Branch `renderEdge` on `isDirected`**

Replace the body of `renderEdge` so directed edges use the polygon path. Keep the existing line rendering for the undirected path.

```tsx
function renderEdge(
  edge: PassNetworkRenderedEdge,
  project: ProjectFn,
  active: boolean,
  dimmed: boolean,
  sourceRadius: number,
  targetRadius: number,
  sideOffset: number,
  onEnter: () => void,
  onLeave: () => void,
  onFocus: () => void,
  onBlur: () => void,
  onClick: () => void,
): ReactNode {
  const { x: x1, y: y1 } = project(edge.sourceX, edge.sourceY);
  const { x: x2, y: y2 } = project(edge.targetX, edge.targetY);
  const fillColor = edge.color;
  const opacity = dimmed
    ? edge.opacity * 0.15
    : active
      ? Math.min(edge.opacity + 0.2, 1)
      : edge.opacity;

  if (edge.isDirected) {
    const d = taperedEdgePath(
      x1,
      y1,
      x2,
      y2,
      sourceRadius,
      targetRadius,
      Math.max(edge.width * 2, 0.6),
      sideOffset,
    );
    return (
      <g
        key={edge.id}
        role="button"
        tabIndex={0}
        aria-label={edgeAriaLabel(edge)}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onFocus}
        onBlur={onBlur}
        onClick={onClick}
        style={{ cursor: "pointer", outline: "none" }}
      >
        <path d={d} fill={fillColor} opacity={opacity} />
      </g>
    );
  }

  return (
    <g
      key={edge.id}
      role="button"
      tabIndex={0}
      aria-label={edgeAriaLabel(edge)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick}
      style={{ cursor: "pointer", outline: "none" }}
    >
      {/* Invisible wider hit stroke */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="transparent"
        strokeWidth={Math.max(edge.width * 3, 2.2)}
        strokeLinecap="round"
      />
      {/* Visible edge */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={edge.color}
        strokeWidth={edge.width}
        strokeLinecap="round"
        opacity={opacity}
      />
    </g>
  );
}
```

- [ ] **Step 3: Compute the per-edge `sideOffset` and lookup source/target radii at the call site**

The JSX loop that calls `renderEdge` currently doesn't know about reversed pairs. Add this derivation just before the edges loop inside the `Pitch` children:

```tsx
{
  ({ project }) => {
    // Lookup radii by id so tapered edges can trim into the node circles
    // without overlapping them.
    const radiusById = new Map(model.plot.nodes.map((n) => [n.id, n.radius]));
    // Detect which edge pairs are reversed (A→B and B→A both present) so
    // we can offset them to opposite sides.
    const directedPairKey = (s: string, t: string) =>
      s <= t ? `${s}::${t}` : `${t}::${s}`;
    const reversedPairs = new Set<string>();
    const seen = new Set<string>();
    for (const edge of model.plot.edges) {
      if (!edge.isDirected) continue;
      const key = directedPairKey(edge.sourceId, edge.targetId);
      if (seen.has(key)) reversedPairs.add(key);
      seen.add(key);
    }
    return (
      <>
        {/* Edges render first so nodes paint above them */}
        {model.plot.edges.map((edge) => {
          const h = makeFocusHandlers({ kind: "edge", id: edge.id });
          const dimmed = egoRelated != null && !egoRelated.relatedEdgeIds.has(edge.id);
          const sourceRadius = radiusById.get(edge.sourceId) ?? 0;
          const targetRadius = radiusById.get(edge.targetId) ?? 0;
          let sideOffset = 0;
          if (edge.isDirected) {
            const key = directedPairKey(edge.sourceId, edge.targetId);
            if (reversedPairs.has(key)) {
              // One edge of the pair gets +offset, the other -offset.
              // Deterministic: whichever has sourceId < targetId gets +.
              sideOffset = edge.sourceId < edge.targetId ? 0.6 : -0.6;
            }
          }
          return renderEdge(
            edge,
            project,
            activeEdge?.id === edge.id,
            dimmed,
            sourceRadius,
            targetRadius,
            sideOffset,
            h.set,
            h.clear,
            h.set,
            h.clear,
            h.toggle,
          );
        })}
        {model.plot.nodes.map((node) => {
          const h = makeFocusHandlers({ kind: "node", id: node.id });
          const dimmed = egoRelated != null && !egoRelated.relatedNodeIds.has(node.id);
          return renderNode(
            node,
            project,
            activeNode?.id === node.id,
            dimmed,
            h.set,
            h.clear,
            h.set,
            h.clear,
            h.toggle,
          );
        })}
      </>
    );
  };
}
```

Note the enclosing brace change: the render prop body now uses `({ project }) => { ... return (...); }` (block body) instead of the previous single-expression arrow.

- [ ] **Step 4: Add a React test for directed rendering**

Append to `packages/react/test/PassNetwork.test.tsx`:

```tsx
describe("<PassNetwork /> — directed mode", () => {
  const dirNodes: PassNetworkNode[] = [
    { id: "a", label: "A", x: 20, y: 50, passCount: 20 },
    { id: "b", label: "B", x: 80, y: 50, passCount: 20 },
  ];
  const dirEdges: PassNetworkEdge[] = [
    { sourceId: "a", targetId: "b", passCount: 10 },
    { sourceId: "b", targetId: "a", passCount: 6 },
  ];

  it("renders tapered polygons instead of lines when directed", () => {
    const { container } = render(
      <PassNetwork nodes={dirNodes} edges={dirEdges} directed={true} />,
    );
    // Two directed edges — should be two <path d="..."> elements inside
    // groups whose aria-label contains "Connection".
    const edgeGroups = Array.from(container.querySelectorAll('g[role="button"]')).filter(
      (g) => (g.getAttribute("aria-label") ?? "").includes("Connection"),
    );
    expect(edgeGroups).toHaveLength(2);
    for (const g of edgeGroups) {
      expect(g.querySelector("path")).not.toBeNull();
      expect(g.querySelector("line")).toBeNull();
    }
  });

  it("renders straight lines when directed is false", () => {
    const { container } = render(<PassNetwork nodes={dirNodes} edges={dirEdges} />);
    const edgeGroups = Array.from(container.querySelectorAll('g[role="button"]')).filter(
      (g) => (g.getAttribute("aria-label") ?? "").includes("Connection"),
    );
    // Merged to 1 undirected edge
    expect(edgeGroups).toHaveLength(1);
    expect(edgeGroups[0]!.querySelector("path")).toBeNull();
    expect(edgeGroups[0]!.querySelectorAll("line").length).toBeGreaterThan(0);
  });
});
```

And add the import for the `directed` prop to the existing `PassNetworkProps` in React. Since React types come from `ComputePassNetworkInput`, update `PassNetworkProps`:

```tsx
export type PassNetworkProps = {
  // ...existing...
  directed?: ComputePassNetworkInput["directed"];
  egoHighlight?: boolean;
};
```

And wire it into the `computePassNetwork` call inside the `useMemo`:

```tsx
const model = useMemo(
  () =>
    computePassNetwork({
      nodes,
      edges,
      ...(minEdgePasses != null ? { minEdgePasses } : {}),
      ...(colorBy != null ? { colorBy } : {}),
      ...(sizeBy != null ? { sizeBy } : {}),
      ...(showLabels != null ? { showLabels } : {}),
      ...(nodeColor != null ? { nodeColor } : {}),
      ...(xTColorScale != null ? { xTColorScale } : {}),
      ...(crop != null ? { crop } : {}),
      ...(orientation != null ? { orientation } : {}),
      ...(directed != null ? { directed } : {}),
      ...(collisionPadding != null ? { collisionPadding } : {}),
    }),
  [
    nodes,
    edges,
    minEdgePasses,
    colorBy,
    sizeBy,
    showLabels,
    nodeColor,
    xTColorScale,
    crop,
    orientation,
    directed,
    collisionPadding,
  ],
);
```

Don't forget to also expose `collisionPadding` on `PassNetworkProps`:

```tsx
collisionPadding?: ComputePassNetworkInput["collisionPadding"];
```

And destructure both in the function signature:

```tsx
export function PassNetwork({
  // ...
  directed,
  collisionPadding,
  egoHighlight = true,
}: PassNetworkProps) {
```

- [ ] **Step 5: Run the directed React tests**

Run: `pnpm exec vitest run packages/react/test/PassNetwork.test.tsx -t "directed"`

Expected: both tests pass.

- [ ] **Step 6: Run the full React test file**

Run: `pnpm exec vitest run packages/react/test/PassNetwork.test.tsx`

Expected: all tests pass (14 ego + 2 directed + existing 12 = some mix, the existing count keeps rising).

- [ ] **Step 7: Commit**

```bash
git add packages/react/src/PassNetwork.tsx packages/react/test/PassNetwork.test.tsx
git commit -m "feat(passnetwork): render directed edges as tapered polygons

Directed mode (opt-in via directed={true}) draws each edge as a tapered
quadrilateral pointing from source to target, with wide-to-narrow
encoding carrying the direction. Reversed pairs (A→B + B→A) are offset
perpendicular to avoid overlap."
```

---

## Part D: `aggregatePassNetwork` helper

**Rationale:** Consumers who start from raw `PassEvent[]` need a way to get to `{ nodes, edges }`. The spec defers this helper, but the v0.3 chart is shipped and blocking on the helper is unnecessary — it's an additive sibling module in `@withqwerty/campos-core`. The helper uses `playerName` as the node id so it works across providers without schema changes.

**Design:**

- Input: `readonly PassEvent[]` + options
- Output: `{ nodes: PassNetworkNode[]; edges: PassNetworkEdge[] }`
- Node id = `playerName` (stringly stable for a single match)
- Pair matching: `passEvent.playerName` (passer) + `passEvent.recipient` (receiver name)
- Drops passes missing `playerName`, `recipient`, or coordinates
- Time window: `"fullMatch"` (default), `"untilFirstSub"` (detected from substitution events passed separately), or explicit `[start, end]`
- Substitution handling: because `PassEvent` doesn't carry substitution info, accept an optional `substitutions` array; if absent, `"untilFirstSub"` falls back to full match with a warning

### Task D1: Create the new helper module skeleton

**Files:**

- Create: `packages/core/src/aggregate-pass-network.ts`

- [ ] **Step 1: Create the file with types + empty implementation**

```typescript
import type { PassEvent } from "@withqwerty/campos-schema";
import type { PassNetworkEdge, PassNetworkNode } from "./pass-network.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PassNetworkTimeWindow =
  | "untilFirstSub"
  | "fullMatch"
  | readonly [number, number];

export type PassNetworkSubstitution = {
  /** Minute of the substitution. */
  minute: number;
  /** Optional team id — if provided, only subs for this team apply to time-window detection. */
  teamId?: string;
};

export type AggregatePassNetworkOptions = {
  /** Team id to build the network for. Required — only passes where event.teamId matches are included. */
  teamId: string;
  /**
   * Time window:
   * - "fullMatch" (default): include every pass in the input
   * - "untilFirstSub": include passes up to the minute of the first substitution; requires `substitutions`
   * - [start, end]: include passes whose minute is in [start, end]
   */
  timeWindow?: PassNetworkTimeWindow;
  /** Optional substitution events used by "untilFirstSub". */
  substitutions?: readonly PassNetworkSubstitution[];
  /** Minimum number of pass events for a player to appear as a node. Default: 5. */
  minPassesForNode?: number;
  /** Minimum number of passes between a pair for an edge to be returned. Default: 0 — filter in the chart. */
  minPassesForEdge?: number;
  /** Per-player xT lookup. Default: () => null. */
  xTForPlayer?: (playerName: string) => number | null;
  /** Per-pair xT lookup. Default: () => null. */
  xTForPair?: (sourceName: string, targetName: string) => number | null;
};

export type AggregatePassNetworkResult = {
  nodes: PassNetworkNode[];
  edges: PassNetworkEdge[];
  warnings: readonly string[];
  /** Resolved time window as [startMinute, endMinuteInclusive]. */
  window: readonly [number, number];
};

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

/**
 * Reduce raw pass events into a single team's passing network (nodes + edges).
 *
 * Node id convention: `playerName` is used as the stable identifier. This
 * works across adapters that populate player names (Opta, StatsBomb,
 * WhoScored). Wyscout, which does not populate `playerName`, is not
 * supported by this helper today.
 *
 * Node position: mean of the (x, y) coordinates of every pass the player
 * made in the window PLUS the (endX, endY) of every pass where they were
 * the recipient. This is the canonical "average on-ball position" used in
 * the mplsoccer reference implementation.
 */
export function aggregatePassNetwork(
  passes: readonly PassEvent[],
  options: AggregatePassNetworkOptions,
): AggregatePassNetworkResult {
  throw new Error("not implemented");
}
```

### Task D2: Write the failing tests for the helper

**Files:**

- Create: `packages/core/test/aggregate-pass-network.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, expect, it } from "vitest";

import type { PassEvent } from "@withqwerty/campos-schema";

import { aggregatePassNetwork } from "../src/index";

function makePass(
  partial: Partial<PassEvent> & {
    id: string;
    playerName: string;
    recipient?: string | null;
    x: number;
    y: number;
    endX: number;
    endY: number;
  },
): PassEvent {
  return {
    kind: "pass",
    id: partial.id,
    matchId: "m1",
    teamId: partial.teamId ?? "home",
    playerId: partial.playerId ?? null,
    playerName: partial.playerName,
    minute: partial.minute ?? 10,
    addedMinute: null,
    second: 0,
    period: 1,
    x: partial.x,
    y: partial.y,
    endX: partial.endX,
    endY: partial.endY,
    length: null,
    angle: null,
    recipient: partial.recipient ?? null,
    passType: "ground",
    passResult: partial.passResult ?? "complete",
    isAssist: false,
    provider: "opta",
    providerEventId: partial.id,
  };
}

describe("aggregatePassNetwork — basic aggregation", () => {
  it("returns nodes keyed by player name with average positions", () => {
    const passes: PassEvent[] = [
      makePass({
        id: "1",
        playerName: "Ødegaard",
        recipient: "Saka",
        x: 60,
        y: 40,
        endX: 75,
        endY: 30,
      }),
      makePass({
        id: "2",
        playerName: "Ødegaard",
        recipient: "Rice",
        x: 50,
        y: 40,
        endX: 55,
        endY: 55,
      }),
      makePass({
        id: "3",
        playerName: "Saka",
        recipient: "Ødegaard",
        x: 78,
        y: 28,
        endX: 58,
        endY: 40,
      }),
      makePass({
        id: "4",
        playerName: "Saka",
        recipient: "Ødegaard",
        x: 80,
        y: 25,
        endX: 60,
        endY: 42,
      }),
      makePass({
        id: "5",
        playerName: "Saka",
        recipient: "Ødegaard",
        x: 82,
        y: 22,
        endX: 60,
        endY: 40,
      }),
      makePass({
        id: "6",
        playerName: "Rice",
        recipient: "Ødegaard",
        x: 55,
        y: 55,
        endX: 60,
        endY: 40,
      }),
      makePass({
        id: "7",
        playerName: "Rice",
        recipient: "Ødegaard",
        x: 55,
        y: 55,
        endX: 60,
        endY: 40,
      }),
      makePass({
        id: "8",
        playerName: "Rice",
        recipient: "Ødegaard",
        x: 55,
        y: 55,
        endX: 60,
        endY: 40,
      }),
      makePass({
        id: "9",
        playerName: "Rice",
        recipient: "Ødegaard",
        x: 55,
        y: 55,
        endX: 60,
        endY: 40,
      }),
      makePass({
        id: "10",
        playerName: "Rice",
        recipient: "Ødegaard",
        x: 55,
        y: 55,
        endX: 60,
        endY: 40,
      }),
    ];
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 2,
    });
    expect(result.nodes).toHaveLength(3);
    const ode = result.nodes.find((n) => n.id === "Ødegaard");
    expect(ode).toBeDefined();
    expect(ode!.passCount).toBe(2);
    // Ødegaard's average position mixes own passes (x=60, x=50) and
    // being-recipient events (3 from Saka + 5 from Rice, all targeting
    // ~60 / 40). Mean roughly stays around (59, 40).
    expect(ode!.x).toBeGreaterThan(55);
    expect(ode!.x).toBeLessThan(62);
    expect(ode!.y).toBeGreaterThan(38);
    expect(ode!.y).toBeLessThan(42);
  });

  it("builds undirected edges keyed by passer→recipient name pairs", () => {
    const passes: PassEvent[] = [
      makePass({
        id: "1",
        playerName: "Ødegaard",
        recipient: "Saka",
        x: 60,
        y: 40,
        endX: 75,
        endY: 30,
      }),
      makePass({
        id: "2",
        playerName: "Ødegaard",
        recipient: "Saka",
        x: 60,
        y: 40,
        endX: 75,
        endY: 30,
      }),
      makePass({
        id: "3",
        playerName: "Saka",
        recipient: "Ødegaard",
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
    expect(result.edges).toHaveLength(2);
    // Two directional edges: Ødegaard→Saka with count 2, Saka→Ødegaard with count 1
    const oToS = result.edges.find(
      (e) => e.sourceId === "Ødegaard" && e.targetId === "Saka",
    );
    const sToO = result.edges.find(
      (e) => e.sourceId === "Saka" && e.targetId === "Ødegaard",
    );
    expect(oToS?.passCount).toBe(2);
    expect(sToO?.passCount).toBe(1);
  });

  it("filters by team id", () => {
    const passes: PassEvent[] = [
      makePass({
        id: "1",
        teamId: "home",
        playerName: "A",
        recipient: "B",
        x: 20,
        y: 50,
        endX: 30,
        endY: 50,
      }),
      makePass({
        id: "2",
        teamId: "away",
        playerName: "Z",
        recipient: "Y",
        x: 20,
        y: 50,
        endX: 30,
        endY: 50,
      }),
    ];
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
    });
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["A", "B"]);
  });

  it("drops passes missing playerName, recipient, or coordinates", () => {
    const passes: PassEvent[] = [
      makePass({
        id: "1",
        playerName: "A",
        recipient: "B",
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
      }),
      // missing recipient → dropped
      {
        ...makePass({
          id: "2",
          playerName: "A",
          x: 50,
          y: 50,
          endX: 60,
          endY: 50,
        }),
        recipient: null,
      },
      // missing x → dropped
      {
        ...makePass({
          id: "3",
          playerName: "A",
          recipient: "B",
          x: 0,
          y: 50,
          endX: 60,
          endY: 50,
        }),
        x: null,
      },
    ];
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
    });
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.passCount).toBe(1);
  });
});

describe("aggregatePassNetwork — time windows", () => {
  const passes: PassEvent[] = [
    makePass({
      id: "1",
      minute: 5,
      playerName: "A",
      recipient: "B",
      x: 50,
      y: 50,
      endX: 60,
      endY: 50,
    }),
    makePass({
      id: "2",
      minute: 35,
      playerName: "A",
      recipient: "B",
      x: 50,
      y: 50,
      endX: 60,
      endY: 50,
    }),
    makePass({
      id: "3",
      minute: 70,
      playerName: "A",
      recipient: "B",
      x: 50,
      y: 50,
      endX: 60,
      endY: 50,
    }),
  ];

  it("includes all passes for the default fullMatch window", () => {
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
    });
    expect(result.edges[0]!.passCount).toBe(3);
    expect(result.window).toEqual([0, 120]);
  });

  it("restricts to [start, end] when given explicit bounds", () => {
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
      timeWindow: [0, 40],
    });
    expect(result.edges[0]!.passCount).toBe(2);
    expect(result.window).toEqual([0, 40]);
  });

  it("untilFirstSub uses the earliest substitution minute", () => {
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
      timeWindow: "untilFirstSub",
      substitutions: [
        { minute: 60, teamId: "home" },
        { minute: 80, teamId: "away" },
      ],
    });
    expect(result.edges[0]!.passCount).toBe(2);
    expect(result.window).toEqual([0, 60]);
  });

  it("untilFirstSub warns and falls back to full match when no substitutions supplied", () => {
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
      timeWindow: "untilFirstSub",
    });
    expect(result.edges[0]!.passCount).toBe(3);
    expect(result.warnings.some((w) => w.includes("untilFirstSub"))).toBe(true);
  });
});

describe("aggregatePassNetwork — thresholds", () => {
  it("drops players below minPassesForNode", () => {
    const passes: PassEvent[] = [
      makePass({
        id: "1",
        playerName: "A",
        recipient: "B",
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
      }),
      makePass({
        id: "2",
        playerName: "A",
        recipient: "B",
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
      }),
      makePass({
        id: "3",
        playerName: "A",
        recipient: "B",
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
      }),
      makePass({
        id: "4",
        playerName: "A",
        recipient: "B",
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
      }),
      makePass({
        id: "5",
        playerName: "A",
        recipient: "B",
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
      }),
      // C only has 2 passes — below default minPassesForNode=5
      makePass({
        id: "6",
        playerName: "C",
        recipient: "A",
        x: 30,
        y: 50,
        endX: 50,
        endY: 50,
      }),
      makePass({
        id: "7",
        playerName: "C",
        recipient: "A",
        x: 30,
        y: 50,
        endX: 50,
        endY: 50,
      }),
    ];
    const result = aggregatePassNetwork(passes, { teamId: "home" });
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["A", "B"]);
    // C→A edges are dropped because C is not a node
    expect(result.edges.every((e) => e.sourceId !== "C")).toBe(true);
  });

  it("drops edges below minPassesForEdge", () => {
    const passes: PassEvent[] = [
      ...Array.from({ length: 10 }, (_, i) =>
        makePass({
          id: `p${i}`,
          playerName: "A",
          recipient: "B",
          x: 20,
          y: 50,
          endX: 40,
          endY: 50,
        }),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makePass({
          id: `q${i}`,
          playerName: "A",
          recipient: "C",
          x: 20,
          y: 50,
          endX: 40,
          endY: 70,
        }),
      ),
      // single A→D pass
      makePass({
        id: "x",
        playerName: "A",
        recipient: "D",
        x: 20,
        y: 50,
        endX: 40,
        endY: 30,
      }),
      // Fill A so it's a node; fill D so it's a node (barely)
      ...Array.from({ length: 5 }, (_, i) =>
        makePass({
          id: `d${i}`,
          playerName: "D",
          recipient: "A",
          x: 40,
          y: 30,
          endX: 20,
          endY: 50,
        }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makePass({
          id: `b${i}`,
          playerName: "B",
          recipient: "A",
          x: 40,
          y: 50,
          endX: 20,
          endY: 50,
        }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makePass({
          id: `c${i}`,
          playerName: "C",
          recipient: "A",
          x: 40,
          y: 70,
          endX: 20,
          endY: 50,
        }),
      ),
    ];
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForEdge: 3,
    });
    // A→D has only 1 pass → dropped. D→A has 5 → kept.
    const aToD = result.edges.find((e) => e.sourceId === "A" && e.targetId === "D");
    const dToA = result.edges.find((e) => e.sourceId === "D" && e.targetId === "A");
    expect(aToD).toBeUndefined();
    expect(dToA?.passCount).toBe(5);
  });
});

describe("aggregatePassNetwork — xT resolvers", () => {
  it("uses xTForPlayer and xTForPair callbacks when provided", () => {
    const passes: PassEvent[] = Array.from({ length: 5 }, (_, i) =>
      makePass({
        id: `p${i}`,
        playerName: "A",
        recipient: "B",
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
      }),
    );
    const xTPlayer: Record<string, number> = { A: 0.3, B: 0.1 };
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
      xTForPlayer: (name) => xTPlayer[name] ?? null,
      xTForPair: (s, t) => (s === "A" && t === "B" ? 0.05 : null),
    });
    const a = result.nodes.find((n) => n.id === "A");
    const b = result.nodes.find((n) => n.id === "B");
    expect(a?.xT).toBe(0.3);
    expect(b?.xT).toBe(0.1);
    const edge = result.edges.find((e) => e.sourceId === "A" && e.targetId === "B");
    expect(edge?.xT).toBe(0.05);
  });
});

describe("aggregatePassNetwork — empty inputs", () => {
  it("returns empty arrays when no passes match the team", () => {
    const result = aggregatePassNetwork([], { teamId: "home" });
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });
});
```

- [ ] **Step 2: Wire the helper into the core barrel export**

Edit `packages/core/src/index.ts` and add after the existing `computePassNetwork` export block:

```typescript
export { aggregatePassNetwork } from "./aggregate-pass-network.js";
export type {
  AggregatePassNetworkOptions,
  AggregatePassNetworkResult,
  PassNetworkSubstitution,
  PassNetworkTimeWindow,
} from "./aggregate-pass-network.js";
```

- [ ] **Step 3: Run the failing tests**

Run: `pnpm exec vitest run packages/core/test/aggregate-pass-network.test.ts`

Expected: FAIL — the helper throws `not implemented`.

### Task D3: Implement `aggregatePassNetwork`

**Files:**

- Modify: `packages/core/src/aggregate-pass-network.ts`

- [ ] **Step 1: Replace the stub with the full implementation**

```typescript
import type { PassEvent } from "@withqwerty/campos-schema";
import type { PassNetworkEdge, PassNetworkNode } from "./pass-network.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PassNetworkTimeWindow =
  | "untilFirstSub"
  | "fullMatch"
  | readonly [number, number];

export type PassNetworkSubstitution = {
  minute: number;
  teamId?: string;
};

export type AggregatePassNetworkOptions = {
  teamId: string;
  timeWindow?: PassNetworkTimeWindow;
  substitutions?: readonly PassNetworkSubstitution[];
  minPassesForNode?: number;
  minPassesForEdge?: number;
  xTForPlayer?: (playerName: string) => number | null;
  xTForPair?: (sourceName: string, targetName: string) => number | null;
};

export type AggregatePassNetworkResult = {
  nodes: PassNetworkNode[];
  edges: PassNetworkEdge[];
  warnings: readonly string[];
  window: readonly [number, number];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveWindow(
  timeWindow: PassNetworkTimeWindow | undefined,
  substitutions: readonly PassNetworkSubstitution[] | undefined,
  teamId: string,
  warnings: string[],
): readonly [number, number] {
  if (timeWindow == null || timeWindow === "fullMatch") {
    return [0, 120];
  }
  if (Array.isArray(timeWindow)) {
    return [timeWindow[0] as number, timeWindow[1] as number];
  }
  // untilFirstSub
  if (!substitutions || substitutions.length === 0) {
    warnings.push(
      'timeWindow="untilFirstSub" was requested but no substitutions were supplied — falling back to fullMatch',
    );
    return [0, 120];
  }
  // Use the earliest substitution minute across BOTH teams (because a sub
  // for either side can change formation interpretation).
  const relevant = substitutions.filter(
    (s) => s.teamId == null || s.teamId === teamId || s.teamId !== teamId,
  );
  const earliest = Math.min(...relevant.map((s) => s.minute));
  if (!Number.isFinite(earliest)) {
    warnings.push(
      'timeWindow="untilFirstSub" could not determine the first-sub minute — falling back to fullMatch',
    );
    return [0, 120];
  }
  return [0, earliest];
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function aggregatePassNetwork(
  passes: readonly PassEvent[],
  options: AggregatePassNetworkOptions,
): AggregatePassNetworkResult {
  const warnings: string[] = [];
  const minPassesForNode = options.minPassesForNode ?? 5;
  const minPassesForEdge = options.minPassesForEdge ?? 0;
  const xTForPlayer = options.xTForPlayer ?? (() => null);
  const xTForPair = options.xTForPair ?? (() => null);
  const [windowStart, windowEnd] = resolveWindow(
    options.timeWindow,
    options.substitutions,
    options.teamId,
    warnings,
  );

  // Pre-filter: correct team, within window, usable coordinates + names.
  const usable = passes.filter((p) => {
    if (p.teamId !== options.teamId) return false;
    if (p.minute < windowStart || p.minute > windowEnd) return false;
    if (p.playerName == null || p.playerName.length === 0) return false;
    if (p.recipient == null || p.recipient.length === 0) return false;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
    if (!Number.isFinite(p.endX) || !Number.isFinite(p.endY)) return false;
    return true;
  }) as Array<
    PassEvent & {
      playerName: string;
      recipient: string;
      x: number;
      y: number;
      endX: number;
      endY: number;
    }
  >;

  // Pass counts per player (as passer)
  const outgoingCount = new Map<string, number>();
  // Position samples per player: (x, y) from every pass they were the
  // passer OR recipient of, per the mplsoccer convention.
  const positionSamples = new Map<string, { x: number; y: number }[]>();
  // Pair counts (directional A→B, merged below for undirected output)
  const pairCounts = new Map<string, Map<string, number>>();

  for (const p of usable) {
    outgoingCount.set(p.playerName, (outgoingCount.get(p.playerName) ?? 0) + 1);
    const passerSamples = positionSamples.get(p.playerName) ?? [];
    passerSamples.push({ x: p.x, y: p.y });
    positionSamples.set(p.playerName, passerSamples);
    const recipientSamples = positionSamples.get(p.recipient) ?? [];
    recipientSamples.push({ x: p.endX, y: p.endY });
    positionSamples.set(p.recipient, recipientSamples);
    const bucket = pairCounts.get(p.playerName) ?? new Map<string, number>();
    bucket.set(p.recipient, (bucket.get(p.recipient) ?? 0) + 1);
    pairCounts.set(p.playerName, bucket);
  }

  // Candidate players: anyone who appears as a passer or recipient.
  const candidateIds = new Set<string>();
  for (const p of usable) {
    candidateIds.add(p.playerName);
    candidateIds.add(p.recipient);
  }

  // Apply minPassesForNode. "Pass count" for this threshold is outgoing only
  // (consistent with how fans read "X passes made").
  const nodeIds = new Set<string>();
  for (const id of candidateIds) {
    const count = outgoingCount.get(id) ?? 0;
    if (count >= minPassesForNode) nodeIds.add(id);
  }

  // Build nodes
  const nodes: PassNetworkNode[] = [];
  for (const id of nodeIds) {
    const samples = positionSamples.get(id) ?? [];
    if (samples.length === 0) continue;
    const meanX = samples.reduce((sum, s) => sum + s.x, 0) / samples.length;
    const meanY = samples.reduce((sum, s) => sum + s.y, 0) / samples.length;
    const passCount = outgoingCount.get(id) ?? 0;
    const xT = xTForPlayer(id);
    const node: PassNetworkNode = {
      id,
      label: id,
      x: meanX,
      y: meanY,
      passCount,
    };
    if (xT != null) node.xT = xT;
    nodes.push(node);
  }
  nodes.sort((a, b) => b.passCount - a.passCount);

  // Build edges (directional; core will merge if the chart is undirected)
  const edges: PassNetworkEdge[] = [];
  for (const [source, bucket] of pairCounts) {
    if (!nodeIds.has(source)) continue;
    for (const [target, count] of bucket) {
      if (!nodeIds.has(target)) continue;
      if (count < minPassesForEdge) continue;
      const xT = xTForPair(source, target);
      const edge: PassNetworkEdge = {
        sourceId: source,
        targetId: target,
        passCount: count,
      };
      if (xT != null) edge.xT = xT;
      edges.push(edge);
    }
  }

  return {
    nodes,
    edges,
    warnings,
    window: [windowStart, windowEnd],
  };
}
```

- [ ] **Step 2: Run the helper tests**

Run: `pnpm exec vitest run packages/core/test/aggregate-pass-network.test.ts`

Expected: all tests pass. Expect ~12 tests total.

- [ ] **Step 3: Run the whole core suite**

Run: `pnpm exec vitest run packages/core/`

Expected: all previous tests plus the new helper tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/aggregate-pass-network.ts packages/core/src/index.ts packages/core/test/aggregate-pass-network.test.ts
git commit -m "feat(core): add aggregatePassNetwork helper

Reduces raw PassEvent[] into { nodes, edges } suitable for the
PassNetwork chart. Uses playerName as the node id so it works across
adapters without schema changes. Supports time windows (fullMatch,
untilFirstSub, [start, end]), minimum-pass thresholds, and optional
xT resolvers for per-player and per-pair colour encoding."
```

---

## Part E: Demo page additions

**Rationale:** Each of the four features needs a visible demo card so reviewers and users can see them without reading the tests.

### Task E1: Add raw-pass re-export to the fixture module

**Files:**

- Modify: `apps/site/src/data/passnetwork-demo.ts`

- [ ] **Step 1: Re-export the existing dense WhoScored pass sample**

Append to the bottom of `apps/site/src/data/passnetwork-demo.ts`:

```typescript
// Re-export the dense WhoScored pass sample from the PassMap fixture so the
// aggregate-helper demo can build a network from raw PassEvent[] without
// duplicating 314 pass rows. Source: Arsenal vs Wolves (WhoScored 1903484).
export { densePasses as whoScoredDensePasses } from "./passmap-demo";
```

### Task E2: Add the 4 new demo cards + 2 prop rows

**Files:**

- Modify: `apps/site/src/pages/passnetwork.astro`

- [ ] **Step 1: Update the imports**

Add to the existing data import:

```typescript
import {
  arsenalHeroNodes,
  arsenalHeroEdges,
  arsenalHeroPrimaryColour,
  arsenalHeroMeta,
  liverpoolHeroNodes,
  liverpoolHeroEdges,
  liverpoolHeroPrimaryColour,
  liverpoolHeroMeta,
  arsenalLateNodes,
  arsenalLateEdges,
  arsenalLatePrimaryColour,
  arsenalLateMeta,
  emptyNodes,
  emptyEdges,
  sparseNodes,
  sparseEdges,
  whoScoredDensePasses,
} from "../data/passnetwork-demo";
import { aggregatePassNetwork } from "@withqwerty/campos-core";
```

- [ ] **Step 2: Compute the helper-derived fixture at build time**

Below the imports, above `const code = ...`:

```ts
// Build a PassNetwork from the raw 1st-half WhoScored pass sample.
// WhoScored's team id for Arsenal in this match is "13".
const helperResult = aggregatePassNetwork(whoScoredDensePasses, {
  teamId: "13",
  minPassesForNode: 4,
});
```

- [ ] **Step 3: Add new prop rows to the props table**

Add these entries to the `props` array (insert before `pitchTheme`):

```typescript
  {
    name: "directed",
    type: "boolean",
    default: "false",
    description:
      "When true, reversed edges stay distinct and render as tapered polygons pointing from source to target.",
  },
  {
    name: "collisionPadding",
    type: "number",
    default: "0.5",
    description:
      "Minimum gap (in meters) between node edges after collision relaxation. Set to 0 to disable the nudge-apart pass for overlapping nodes.",
  },
  {
    name: "egoHighlight",
    type: "boolean",
    default: "true",
    description:
      "Hover/focus a node to dim everything except that node's connected edges and their counterparts.",
  },
```

- [ ] **Step 4: Add the 4 new demo cards inside the `<Fragment slot="states">`**

Insert these cards just before the existing `"Empty state"` card:

```astro
<DemoCard
  title="Ego highlight — hover to reveal"
  note="Hover or tab onto a node: related edges stay lit, the rest dim to 15%."
>
  <PassNetworkDemoPanel
    client:load
    nodes={arsenalHeroNodes}
    edges={arsenalHeroEdges}
    nodeColor={arsenalHeroPrimaryColour}
  />
</DemoCard>

<DemoCard
  title="Directed edges — tapered shafts"
  note="When directed, A→B and B→A are separate marks. The wide end of each shaft sits at the source; the narrow end points at the target."
>
  <PassNetworkDemoPanel
    client:load
    nodes={arsenalHeroNodes}
    edges={arsenalHeroEdges}
    nodeColor={arsenalHeroPrimaryColour}
    directed={true}
  />
</DemoCard>

<DemoCard
  title="Collision relaxation off"
  note="Setting collisionPadding={0} bypasses the nudge-apart pass; central midfielders may overlap."
>
  <PassNetworkDemoPanel
    client:load
    nodes={arsenalHeroNodes}
    edges={arsenalHeroEdges}
    nodeColor={arsenalHeroPrimaryColour}
    collisionPadding={0}
  />
</DemoCard>

<DemoCard
  title={`Built from raw passes via aggregatePassNetwork (${helperResult.nodes.length} players, ${helperResult.edges.length} connections)`}
  note="314-pass WhoScored fixture (Arsenal 1st half vs Wolves) fed through aggregatePassNetwork → PassNetwork. No pre-aggregated data."
>
  <PassNetworkDemoPanel
    client:load
    nodes={helperResult.nodes}
    edges={helperResult.edges}
    nodeColor="#EF0107"
  />
</DemoCard>
```

- [ ] **Step 5: Build the site to surface errors**

Run: `pnpm --filter @withqwerty/campos-site build`

Expected: `/passnetwork/index.html` builds successfully. If `aggregatePassNetwork` is missing from `@withqwerty/campos-core`'s dist, re-run `pnpm --filter @withqwerty/campos-core build` first, then retry.

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/data/passnetwork-demo.ts apps/site/src/pages/passnetwork.astro
git commit -m "feat(site): demo cards for passnetwork follow-ups

Adds 4 new cards to the passnetwork demo page:
- Ego hover highlight
- Directed edges with tapered shafts
- Collision relaxation off (for comparison)
- Network built via aggregatePassNetwork from 314 raw WhoScored passes"
```

---

## Part F: Spec + status updates + verification gate

### Task F1: Update the spec

**Files:**

- Modify: `docs/specs/passnetwork-spec.md`

- [ ] **Step 1: Flip the open questions 2, 3, 4 to "shipped"**

Find the "Open questions" section. Update entries:

- #2 "Should `nodeColor` accept an array for per-node overrides?" — leave as-is (still open).
- The relevant deferred features live under "Extension seams (future)". Do not remove the "future" note — instead, add a "Post-shipping updates (2026-04-10, part 2)" block at the very bottom of the spec:

```markdown
## Post-shipping updates (2026-04-10, part 2)

Four of the original deferred features landed as an additive follow-up packet. The v0.3 API now includes:

- **`egoHighlight` prop** (default `true`) — hovering or focusing a node dims non-connected marks. React-only change; no core model impact.
- **`collisionPadding` prop** (default `0.5` meters) — pairwise relaxation in `computePassNetwork` nudges overlapping nodes apart while preserving each pair's centroid. New `displaced` field on `PassNetworkRenderedNode`. Never force-directed — bounded iteration.
- **`directed` prop** (default `false`) — skips the undirected merge step and renders tapered polygons instead of lines. New `isDirected` field on `PassNetworkRenderedEdge`. Reversed pairs render with a small perpendicular offset to stay distinguishable.
- **`aggregatePassNetwork` helper** — new sibling export in `@withqwerty/campos-core` that converts `readonly PassEvent[]` into `{ nodes, edges }`. Uses `playerName` as the node id so it works across Opta/StatsBomb/WhoScored without schema changes. Supports `fullMatch` / `untilFirstSub` / `[start, end]` time windows, minimum-pass thresholds, and optional `xTForPlayer` / `xTForPair` resolvers.

The demo page has 4 new cards showing each feature, including one that starts from 314 raw WhoScored pass events.
```

### Task F2: Update the status matrix

**Files:**

- Modify: `docs/status/matrix.md`

- [ ] **Step 1: Bump the PassNetwork row's edge-case + review L2 markers**

Find the `PassNetwork` row:

```
| PassNetwork | done | done                      | done                     | done | done  | done      | done  | done             | done      | partial   | not-started | in-progress |
```

Change it to (review L2 stays partial until the adversarial loop runs, but quality improves):

```
| PassNetwork | done | done                      | done                     | done | done  | done      | done  | done             | done      | partial   | not-started | in-progress |
```

(No change in cell values — the follow-up work goes into review L2/L3 credit the next time they're run. Just update the row comment if present.)

### Task F3: Run the full verification gate

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`

Expected: exits 0, no errors.

- [ ] **Step 2: Full test suite**

Run: `pnpm test`

Expected: all tests pass. Count should be at least baseline 663 + 4 collision + 3 directed core + 2 directed react + 2 ego + ~12 aggregate = **~686 tests**.

- [ ] **Step 3: Lint**

Run: `pnpm lint`

Expected: 0 errors. Warnings may have grown slightly due to new code; acceptable if they are in pre-existing categories.

- [ ] **Step 4: Prettier check**

Run: `pnpm format:check`

Expected: exits 0. If it fails, run `pnpm format` and commit the fixes.

- [ ] **Step 5: Site build**

Run: `pnpm --filter @withqwerty/campos-site build`

Expected: 19 pages built including `/passnetwork/index.html`.

- [ ] **Step 6: Final commit for docs + status**

```bash
git add docs/specs/passnetwork-spec.md docs/status/matrix.md
git commit -m "docs(passnetwork): log follow-up packet shipping

Records ego highlight, collision relaxation, directed edges, and the
aggregatePassNetwork helper as shipped in the v0.3 follow-up packet."
```

---

## Self-review checklist

After executing the plan, verify:

1. **Spec coverage** — all four follow-ups from the previous report (ego highlight, collision, directed, aggregate helper) have tasks. ✓
2. **Placeholder scan** — every step shows actual code or runnable command. No "add appropriate error handling" or "similar to before" placeholders.
3. **Type consistency** —
   - `PassNetworkRenderedNode.displaced: boolean` (B2, B3, used in B1 tests)
   - `PassNetworkRenderedEdge.isDirected: boolean` (C2, C3, used in C1 tests)
   - `ComputePassNetworkInput.collisionPadding?: number` (B2, used in B1 tests + D demo)
   - `ComputePassNetworkInput.directed?: boolean` (C2, used in C1/C4 tests)
   - `PassNetworkProps.egoHighlight?: boolean` (A1, used in A3 tests)
   - `PassNetworkProps.directed?` and `PassNetworkProps.collisionPadding?` (C4, used in demo + tests)
   - `AggregatePassNetworkResult.window: readonly [number, number]` (D1, used in D2 tests)
4. **DRY** — the undirected merge code is only kept in one place (the `else` branch added in C3); the legacy merge code is removed, not duplicated.
5. **TDD** — every implementation task has a preceding failing-test task.
6. **Bite-sized** — each step is 2-5 minutes of work.
7. **Commits** — one commit per logical unit:
   - A: 1 commit (ego highlight)
   - B: 1 commit (collision)
   - C: 2 commits (core directed, renderer directed)
   - D: 1 commit (helper)
   - E: 1 commit (demo)
   - F: 1 commit (docs)

**Total: ~7 commits, each independently reviewable.**
