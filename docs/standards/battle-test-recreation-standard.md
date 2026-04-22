# Battle-Test Recreation Standard

**Status:** active
**Scope:** `apps/site/src/pages/showcase/battle-test.astro` and everything under `apps/site/src/components/showcase/`
**Purpose:** workflow for turning a real-world static football viz into an interactive, component-driven Campos recreation that stress-tests the library

## What a battle-test is

A battle-test takes a published composite chart (e.g. @R_by_Ryo match summaries, CannonStats player dashboards, StatsBomb scouting reports) and recreates it using Campos components. The goal is twofold:

1. **Prove the library can build publishable football viz.** If a recognised analyst's chart cannot be reproduced with our components, the library has a gap.
2. **Surface those gaps.** When a panel needs something the library does not expose, that is the signal. Fix it at the library level, not in demo code.

The output is always three panels in order:

1. **Target** — the original static image, credited and sourced.
2. **Component Breakdown** — the naked Campos components used, rendered without panel titles, stat rows, card chrome, or other reference-specific decoration. Each gets a small uppercase caption identifying the primitive (`PITCH + CONVEXHULLLAYER + CUSTOM SVG`, `KDE`, `PITCH + CUSTOM MARKERS`).
3. **Styled Recreation** — the same components composed and styled to match the reference, wrapped in whatever reference-specific chrome is needed (titles, stat rows, attribution footer). Includes a collapsible `CollapsibleCode` section with a representative code excerpt.

All three panels render one below the other inside the single active carousel entry. Only one battle-test entry is visible at a time; the carousel strip at the top swaps active content via a React state island (`BattleTestShell`).

## The one rule you must hold

When you hit a limitation in a chart, pitch, primitive, or adapter, **stop and propose a library fix**. Do not hack around it in demo code.

- **Library territory** (stop and discuss): marker shapes/sizes/colors that could be generalised, pitch rendering controls (crop, attacking direction, side, mirror, padding, max width), coordinate projection, event normalisation, any overlay that could be reused (convex hulls, tooltips, annotation layers).
- **Non-library UI** (fair game for inline demo code): panel titles, card backgrounds and borders, score headers, stat rows, attribution footers, reference-specific layout, any text chrome.

The litmus test: _"Would the next person recreating a viz benefit from this existing as a prop, primitive, or component?"_ If yes, propose it as a library change first. Examples from completed work:

- `ShotMap` `side`, `mirror`, `framePadding`, `maxWidth` props — added because the first two battle-tests needed them.
- `ConvexHullLayer` primitive — extracted after the first panel of the Jesus dashboard needed a shaded footprint polygon.
- `useCursorTooltip` primitive — extracted after two battle-tests both needed cursor-following tooltips that were not fixed-position like `ChartTooltip`.
- `framePadding` / `maxWidth` added to all pitch-based components (`KDE`, `Heatmap`, `Territory`, `PassMap`, `PassNetwork`, `ShotMap`) — added because composites need to override the default chart-frame chrome.
- `autoPitchLines={false}` — used existing prop after a KDE was placed on a light pitch.

See [`feedback_battle_test_hacks`](../../.claude/projects/-Users-rahulkeerthi-Work-campos/memory/feedback_battle_test_hacks.md) for the historical rationale if working in a future session.

## Workflow

### 1. Pick a target image

References live under `/Volumes/WQ/ref_code/football_viz/composites/`. Browse with the user and pick one they want to recreate. Prefer:

- Clear attribution (author handle or site watermark in the image).
- Canonical, well-known visualisation styles (match summaries, player dashboards, passing networks, season reports).
- Compositions that stress multiple components at once — a single radar is too easy.

Copy the image into `apps/site/public/showcase-targets/` with a slug name:

```
apps/site/public/showcase-targets/{slug}.{webp|png|jpg}
```

Example slugs: `ryo-liverpool-arsenal-2019`, `cannonstats-jesus-performance`.

### 2. Decompose the reference **before writing any code**

Describe back to the user what you see in the image, panel by panel. For each panel identify:

- Pitch: `crop` (`full` | `half`), `attackingDirection` (`up` | `down` | `left` | `right`), `side`, whether it is mirrored, theme (light / dark / outline), pitch-line color.
- Marks: shape, size encoding, color encoding, outline, stroke, any shape that is not a standard marker (stars, crosses, arrows, tapered comets).
- Overlays: density surfaces, convex hulls, flow arrows, carry lines, trajectories.
- Annotations: text labels, score strips, goal annotations, HT/FT guides, stat rows.
- Interactions: hover states, tooltips, ego highlighting (where applicable for the final styled version).
- Non-library chrome: panel titles, card borders, score headers, team crests, stat rows, legends, attribution footer.

Write this as a short paragraph or bullet list in the chat. Getting this wrong early (e.g. half-pitch vs full, dark vs light, arrows vs circles-at-destination) wastes the most time. Confirm with the user before moving on.

### 3. Check for library gaps

With the decomposition in hand, enumerate which Campos primitives / chart components each panel needs. For each, ask:

- Does the prop surface already support what the reference wants?
- If not, is it a one-off reference-specific detail (fine for inline demo SVG) or a reusable capability (must be a library change)?

Surface any library gaps to the user **now**, before writing the showcase component. Propose the fix (new prop, new primitive, new chart, adapter extension). Only after the user agrees to defer or build should you proceed.

### 4. Get the data

Real provider data is strongly preferred. Check `/Volumes/WQ/projects/www/src/data/opta/` (and any other provider directories the user mentions) for the match IDs that back the reference image. Use:

- `match-events/{matchId}.json` — raw Opta events
- `expected-goals/{matchId}.json` — xG annotations
- `match-stats/{matchId}.json` — team-level summary
- `pass-matrix/{matchId}.json` — aggregated pass network

When extracting, always convert from provider space to Campos canonical coordinates. **Prefer running raw events through the provider adapter (`fromOpta.*`, `fromStatsBomb.*`, etc.) rather than hand-converting** — adapter authors have already done this work and encoded all the provider quirks in one place.

If you must hand-convert:

- **Opta (F24 match events, absolute coordinates)**: when a team attacks toward increasing-x in the relevant period, both axes pass through unchanged (`x: optaX, y: optaY`). When they attack toward decreasing-x, apply a 180° rotation (`x: 100 - optaX, y: 100 - optaY`). Opta y is **bottom-to-top** (y=0 at the south touchline = attacker's right when facing east) per kloppy/mplsoccer — **never apply an unconditional `100 - y`**. Use `packages/adapters/src/opta/normalize.ts` as the reference.
- **Opta (expected-goals, attack-relative)**: both axes are already in attacker-perspective. Pass both `x` and `y` through unchanged.
- **StatsBomb**: use `statsBombToCampos` from the adapters package.
- **Other providers**: document the conversion inline in the data file.

See `docs/standards/coordinate-invariants.md` for the canonical Campos contract.

Store the extracted data at `apps/site/src/data/showcase-{slug}.ts` with:

- `{slug}MatchMeta` — player, teams, result, competition, date, attribution, data source.
- Typed event arrays (`PassEvent[]`, `ShotEvent[]`, `ReceiveEvent[]`, `DefensiveAction[]`, etc.) — shape matches only what this showcase needs, not the canonical Campos schema.
- Pre-computed stats objects (`passStats`, `receiveStats`, etc.) for the reference's stat rows.

If real data is not available or not feasible, synthesise data that **exactly matches the reference's published statistics** — shot counts, xG totals, on-target counts, pass completion percentages. Do not synthesise fake scorelines or totals. Document synthetic data clearly in the file header.

### 5. Register the entry

Two edits in `apps/site/src/data/showcase-battle-test.ts`:

```ts
export const battleTestEntries: BattleTestEntry[] = [
  // ...existing entries
  {
    id: "{slug}",
    title: "Visible short title",
    caption: "Attribution / subtitle",
    targetImage: "/showcase-targets/{slug}.webp",
    components: ["XGTimeline", "ShotMap", "KDE"], // primary Campos components used
  },
];
```

And one in `apps/site/src/components/showcase/BattleTestShell.tsx`:

```ts
import { YourRecreation } from "./YourRecreation";

const ENTRY_COMPONENTS: Record<string, React.ComponentType> = {
  // ...existing mappings
  "{slug}": YourRecreation,
};
```

### 6. Build the recreation component

File: `apps/site/src/components/showcase/{Name}.tsx`.

Required shape (copy `RyoMatchSummary.tsx` or `JesusPerformance.tsx` as a reference):

```tsx
import { useState } from "react";
import {
  ConvexHullLayer,
  KDE,
  ShotMap,
  XGTimeline,
  useCursorTooltip,
} from "@withqwerty/campos-react";
import { Pitch, type ProjectFn } from "@withqwerty/campos-stadia";
import { CollapsibleCode } from "../CollapsibleCode";
import {} from /* data */ "../../data/showcase-{slug}";

const PITCH_COLORS = { fill: "#fafafa", lines: "#222" };
const PITCH_THEME = "primary" as const;
// Constants for orientation, crop, side, colors, etc.

function tipContent(label: string, detail: string) {
  /* ... */
}

function TargetPanel() {
  /* image + attribution */
}

function ComponentBreakdown() {
  // Naked components only. No panel titles. No stat rows. No card chrome.
  // Uses ALL the same component invocations as the styled composite,
  // just without the surrounding demo decoration.
}

// One sub-component per panel in the styled composite, each wrapping
// a Pitch/KDE/chart in reference-specific chrome (title, stat row, card).
function PanelA() {
  /* ... */
}
function PanelB() {
  /* ... */
}
function PanelC() {
  /* ... */
}

function StyledComposite() {
  // Wraps PanelA/B/C in the reference's outer card (background, borders,
  // header, footer). No library logic here — just layout and typography.
}

const COMPOSITION_CODE = `...`;

export function YourRecreation() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <section>
        <h3>1. Target Visualization</h3>
        <TargetPanel />
      </section>
      <section>
        <h3>2. Component Breakdown</h3>
        <ComponentBreakdown />
      </section>
      <section>
        <h3>3. Styled Recreation</h3>
        <StyledComposite />
        <div style={{ marginTop: 16 }}>
          <CollapsibleCode title="How this was composed" code={COMPOSITION_CODE} />
        </div>
      </section>
    </div>
  );
}
```

#### Invariants inside the recreation component

- **Use bare `Pitch` from `@withqwerty/campos-stadia` when the reference layers multiple non-standard mark types on one surface** (e.g. pass arrows + shots + convex hull). Pass `project` into helper sub-components that render SVG marks.
- **Use full chart components (`ShotMap`, `KDE`, `PassMap`, `XGTimeline`, etc.) when a single-purpose chart fits a panel cleanly.** Prefer these over bare `Pitch` — they give you interactivity, empty states, and accessible labels for free.
- **For composites, set `framePadding={0}` and `maxWidth={9999}` (or some large sentinel) on pitch-based chart components** so they fill their grid cell instead of being capped by the default standalone maxWidth.
- **Tooltip choice is a taste call** — three patterns are valid, pick the one that reads best for the composite:
  - When a full chart component provides its own tooltip API (e.g. `GoalMouthShotChart.tooltip.renderContent`, `ShotMap` tooltip, KDE density sampling), use the chart's API. This is the default for single-chart panels.
  - When rendering bare `Pitch` + custom SVG marks (no built-in tooltip available), use `useCursorTooltip`.
  - When the composite is tight enough that a fixed-position chart tooltip would clutter adjacent panels, `useCursorTooltip` is also acceptable — the cursor-following pill stays inside the hovered panel and doesn't overlap neighbours. If unsure, ask.
  - `ChartTooltip` is a fixed-position card intended for standalone chart docs; rarely the right choice inside a composite.
- **Use `ConvexHullLayer`** for shaded point-set footprints. Accepts any `{x, y}[]` in Campos coordinates.
- **Hover dimming** pattern: keep a `hoverId` state; dim non-hovered marks to 0.15 opacity; keep the hovered mark at full opacity.

#### What must be in the Component Breakdown

- **No panel titles.** No stat rows. No card borders. No background colours beyond the pitch surface itself.
- A small uppercase caption above each bare component identifying the primitive (`PITCH + CONVEXHULLLAYER + CUSTOM SVG`, `KDE`, `PITCH + CUSTOM MARKERS`).
- The exact same chart / primitive invocations that appear in the styled composite. If the styled version adds hover interactions, the breakdown should too. The only thing different is chrome.
- **Campos-only.** If a piece of the styled composite is not a Campos component or primitive — e.g. hand-rolled HTML legends, stat rows, score headers — it must **not** appear in the Component Breakdown. The breakdown represents what the Campos library provides, not every building block of the final composite.

### 7. Style the composite

The styled composite wraps the three (or however many) panel sub-components in a card that visually matches the reference. Typical chrome:

- Outer card: background color, padding, border-radius, border.
- Header block: player/team name, date, match result.
- Panel chrome: title (often italic, uppercase, small), subtle border or background, stat row below.
- Legend bar at the bottom for shape/color keys.
- Footer: attribution on one side, data source + match info on the other.

All of this is non-library. Inline styles or scoped CSS is fine. Match the reference's fonts, sizes, colors, and spacing closely — this is where most iteration happens.

### 8. The collapsed code reference

Every recreation ends with a `CollapsibleCode` block showing a representative excerpt of how the composite was built. Not the whole file — a stripped, readable version (30-80 lines) that shows the key imports, the pitch config, one panel, and one or two tricks (convex hull, mirror, `framePadding={0}`). This is what a reader will copy when building their own.

### 9. Verify

Run before calling the recreation done:

```
pnpm format
pnpm typecheck
pnpm exec vitest run packages/react/test/{touched}.test.tsx
pnpm --filter @withqwerty/campos-site build
```

Open `/showcase/battle-test`, click through to the entry, and verify:

- Target image loads, attribution is correct.
- Breakdown panels render without chrome and with captions.
- Styled composite matches the reference image side-by-side — pitch orientation, marker types, colors, hover interactions, legend, attribution all present.
- Cursor tooltip appears on hover of any event mark.
- Responsive to container width (resize the browser).
- No console errors or hydration warnings.

### 10. Commit strategy

Split commits by scope:

1. **Library additions first.** New primitive, new prop, new chart — each as its own commit with tests. Example: `feat(react): add framePadding and maxWidth to all pitch components`.
2. **Showcase recreation second.** The data file, the recreation component, the shell/entry registration as one commit. Example: `feat(site): add Gabriel Jesus performance battle-test`.

If both land in the same branch, commit them in that order so library changes can be reviewed independently of demo consumption.

## Checklist

Before calling a battle-test shipped:

- [ ] Reference image decomposed and discussed with the user before any code was written
- [ ] Any library gaps proposed and resolved (new prop / new primitive) before implementation
- [ ] Real provider data used where possible; synthetic data exactly matches reference stats
- [ ] Data file is under `apps/site/src/data/showcase-{slug}.ts` with meta + typed events + pre-computed stats
- [ ] Carousel entry registered in `showcase-battle-test.ts` and `BattleTestShell.tsx`
- [ ] Recreation component renders Target + Breakdown + StyledComposite + CollapsibleCode
- [ ] Component Breakdown has no panel chrome — only naked primitives with uppercase captions
- [ ] Styled composite uses `framePadding={0}` / `maxWidth` overrides where needed, not CSS hacks
- [ ] Interactive charts have hover states and cursor tooltips
- [ ] Typecheck, lint, format, tests, and site build all pass
- [ ] Visual fidelity verified against the reference image in the browser
- [ ] Library changes (if any) are committed separately from the showcase consumption

## References

- Completed examples: `apps/site/src/components/showcase/RyoMatchSummary.tsx`, `apps/site/src/components/showcase/JesusPerformance.tsx`
- Primitives added during this workflow: `packages/react/src/primitives/ConvexHullLayer.tsx`, `packages/react/src/primitives/CursorTooltip.tsx`
- Reusable code block: `apps/site/src/components/CollapsibleCode.tsx`
- The central rule: [`feedback_battle_test_hacks`](../../.claude/projects/-Users-rahulkeerthi-Work-campos/memory/feedback_battle_test_hacks.md)
- Related standards: [`component-ship-checklist.md`](./component-ship-checklist.md), [`demo-page-standard.md`](./demo-page-standard.md), [`reference-code-usage.md`](./reference-code-usage.md)
