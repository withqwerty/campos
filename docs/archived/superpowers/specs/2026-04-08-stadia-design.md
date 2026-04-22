# @withqwerty/campos-stadia — Design Spec

**Status:** archived
**Superseded by:** `docs/architecture-decision.md`

Reusable stadium surface primitives for football visualizations. Pitches, goals, and coordinate transforms that any visualization component draws on top of.

## Context

Every Campos visualization needs a surface — shot maps need a half-pitch, pass networks need a full pitch, shot placement maps need a goal mouth. Currently the pitch rendering is hardcoded inside ShotMap (~50 lines of SVG markup + coordinate mapping). As Campos adds more visualization types, this rendering should be shared, not duplicated.

Stadia extracts pitch and goal geometry into a standalone package that provides:

- Proportionally correct surfaces based on FIFA standard dimensions
- Coordinate projection (Campos 0-100 → SVG user units in meters)
- Crop variants (full pitch, half pitch, penalty area, goal)
- Theme-aware rendering with manual color overrides
- Children-based composition — consumers draw whatever they want on top
- SVG viewport clipping — out-of-crop content is hidden by the viewport, not filtered by the projection function

## Package Structure

Single package: `@withqwerty/campos-stadia`. Contains geometry (pure data), transforms (pure functions), and React renderer. The geometry and transform layers are framework-agnostic and exportable for Python/Canvas/WebGL consumers.

```
packages/stadia/
  src/
    geometry/
      pitch.ts        — pitch line definitions from FIFA constants
      goal.ts         — goal frame definitions
      constants.ts    — FIFA standard measurements in meters
    transforms/
      pitch-transform.ts  — Campos 0-100 → SVG user units for any crop/orientation
      goal-transform.ts   — GoalMouth Y/Z → SVG user units
    react/
      Pitch.tsx       — SVG pitch component
      Goal.tsx        — SVG goal component
      context.ts      — React context for project transform
    index.ts          — public exports
```

### Dependency Flow

```
Geometry (constants) → Transforms (pure functions) → React (thin SVG wrappers)
```

Geometry and Transforms have zero dependencies. React depends on React (peer). The package does NOT depend on `@withqwerty/campos-core`, `@withqwerty/campos-schema`, or `@withqwerty/campos-adapters`.

### Interactivity

The `interactive` boolean prop (default `true`) controls whether the SVG supports hover/click. When `false`, event handlers are stripped, producing pure SVG suitable for static embedding or image export (via headless renderers like resvg, sharp, or puppeteer).

### SVG/HTML Composition

`<Pitch>` and `<Goal>` render an SVG element. Children rendered inside them must be SVG elements (`<circle>`, `<line>`, `<g>`, etc.). The card shell around a visualization (header stats, scale bar, legend, tooltips) lives **outside** the stadia component in the parent's HTML. This matches how ShotMap already works — the SVG pitch is one element inside a larger card layout.

## Surfaces

### Pitch

Four surfaces based on crop:

| Crop               | Visible area                     | Use cases                                                |
| ------------------ | -------------------------------- | -------------------------------------------------------- |
| `"full"`           | Entire 105×68m pitch             | Pass networks, progressive actions, heatmaps, formations |
| `"half"`           | Attacking half (Campos x 50-100) | Shot maps, xG maps, penalty area analysis                |
| `"penalty-area"`   | 18-yard box + surrounds          | Dense shot clusters, set-piece delivery, box entries     |
| (future) `"third"` | Attacking/middle/defensive third | Third-specific analysis                                  |

Each crop with vertical or horizontal orientation.

### Goal

Front-view goal frame (7.32m × 2.44m):

| Facing         | Perspective               | Left post               |
| -------------- | ------------------------- | ----------------------- |
| `"striker"`    | Looking at the goal       | Screen-left             |
| `"goalkeeper"` | Looking out from the goal | Screen-right (mirrored) |

## Props

### Pitch

```ts
type PitchCrop = "full" | "half" | "penalty-area";
type Orientation = "vertical" | "horizontal";

type PitchMarkings = {
  halfSpaces?: boolean; // 5 vertical channels (wing / half-space / center)
  thirds?: boolean; // 3 horizontal bands (defensive / middle / attacking)
  zones?: boolean; // 14-zone grid (thirds × channels, wing zones merged in middle)
};

type PitchColors = {
  fill?: string; // pitch background
  lines?: string; // standard FIFA markings
  markings?: string; // optional tactical markings (half-spaces, thirds, zones)
};

type PitchProps = {
  crop: PitchCrop;
  orientation?: Orientation; // default "vertical"
  side?: "attack" | "defend"; // default "attack", for cropped pitches
  frame?: "crop" | "full"; // default "crop"
  theme?: "dark" | "light"; // default "dark"
  markings?: PitchMarkings; // default all off
  colors?: PitchColors; // overrides theme defaults
  padding?: number | { top: number; right: number; bottom: number; left: number };
  interactive?: boolean; // default true
  className?: string;
  style?: React.CSSProperties;
  children: (ctx: { project: ProjectFn }) => React.ReactNode;
};
```

### Goal

```ts
type GoalFacing = "striker" | "goalkeeper";

type GoalColors = {
  frame?: string; // posts + crossbar
  net?: string; // background fill
  ground?: string; // ground line
};

type GoalProps = {
  facing: GoalFacing;
  theme?: "dark" | "light";
  colors?: GoalColors;
  padding?: number | { top: number; right: number; bottom: number; left: number };
  interactive?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: (ctx: { project: GoalProjectFn }) => React.ReactNode;
};
```

### Coordinate Projection

```ts
// Pitch: Campos 0-100 coordinates → SVG user units (meter-scale)
type ProjectFn = (x: number, y: number) => { x: number; y: number };
// Always returns coordinates, even for points outside the visible crop.
// The SVG viewport clips out-of-bounds content via overflow="hidden".
// Returned values are SVG user units in meter scale (1 unit = 1 meter).
// Consumers using these for strokeWidth, fontSize, or radius must
// calibrate to this scale (e.g., a 2m radius circle: r={2}).

// Goal: goal-mouth coordinates → SVG user units
type GoalProjectFn = (goalY: number, goalZ: number) => { x: number; y: number };
// goalY: 0-100 across goal width (left post to right post)
// goalZ: 0-100 ground to crossbar
```

**Campos coordinates work on every pitch surface.** The same data renders on full, half, or penalty-area crops without modification. The crop determines the visible SVG viewport — content outside the crop is clipped by the SVG element (`overflow="hidden"`), not filtered by the projection function. This is a true camera/viewport pattern: consumers render everything, the viewport shows what's visible.

This eliminates null-check boilerplate. No `if (!point) return null;` in consumer code.

## Geometry

### FIFA Standard Dimensions

All pitch geometry uses FIFA standard measurements in meters. These are constants, not configurable — FIFA dimensions are the universal standard.

```ts
const PITCH = {
  length: 105,
  width: 68,
  centerCircleRadius: 9.15,
  penaltyAreaLength: 16.5,
  penaltyAreaWidth: 40.32,
  goalAreaLength: 5.5,
  goalAreaWidth: 18.32,
  penaltySpotDistance: 11,
  penaltyArcRadius: 9.15,
  cornerArcRadius: 1,
  goalWidth: 7.32,
  goalDepth: 2.44,
};
```

### Markings per Crop

| Marking         | Full      | Half                    | Penalty Area     |
| --------------- | --------- | ----------------------- | ---------------- |
| Boundary        | yes       | yes (3 sides + halfway) | yes              |
| Halfway line    | yes       | no                      | no               |
| Center circle   | yes       | arc only                | no               |
| Penalty area    | both ends | one                     | one (fills view) |
| 6-yard box      | both ends | one                     | one              |
| Penalty spot    | both      | one                     | one              |
| Penalty arc     | both      | one                     | one              |
| Corner arcs     | all 4     | 2                       | 0                |
| Goal line/posts | both ends | one                     | one              |

### Optional Tactical Markings

All off by default. Rendered as dashed lines at lower opacity than standard markings.

**Half spaces** (`markings.halfSpaces`): 5 vertical channels dividing the pitch width. Lines at approximately y=21.5 and y=78.5 (the edges of the penalty area width projected full-length) and the center line.

**Thirds** (`markings.thirds`): 3 horizontal bands. Lines at x=33.3 and x=66.7 (one-third and two-thirds of pitch length).

**Zones** (`markings.zones`): 14-zone grid. The grid is thirds (3 horizontal bands at x=33.3/66.7) × half-space channels (5 vertical channels). In the defensive and attacking thirds, all 5 channels are distinct (5+5 = 10 zones). In the middle third, the two wing channels on each side merge into one wider wing zone (left wing + right wing + left half-space + center + right half-space = 4 zones). Total: 5 + 4 + 5 = 14 zones. Renders as a grid overlay with the merged wing zones visually wider in the middle band.

### SVG ViewBox

Computed from crop + padding:

- Full pitch vertical: `viewBox="0 0 68 105"` (+ padding)
- Half pitch vertical: `viewBox="0 0 68 52.5"` (+ padding)
- Penalty area: viewBox centered on the 18-yard box with proportional padding
- Goal front: `viewBox="0 0 7.32 2.44"` (+ padding)

SVG scales responsively — consumer controls the outer container size. By default, `Pitch` is sized to the selected crop (`frame="crop"`). When a stable outer footprint is needed, `frame="full"` reserves the full-pitch aspect ratio for the chosen orientation and places the cropped surface inside it without resizing the crop itself. For cropped views, `side="attack"` anchors to the attacking end (top in vertical, right in horizontal) and `side="defend"` anchors to the defending end (bottom in vertical, left in horizontal).

### Padding

Extends the SVG viewBox beyond the pitch boundary. The pitch markings render in the same position — extra space is empty canvas for badges, labels, stat panels, or breathing room.

```tsx
// Uniform (percentage of pitch width)
<Pitch crop="full" padding={5}>

// Per-side
<Pitch crop="half" padding={{ top: 2, right: 10, bottom: 2, left: 2 }}>
```

`project()` is unaffected by padding — it maps Campos 0-100 to the pitch area only. Content in the padding zone is positioned with absolute SVG coordinates by the consumer.

## Theme Integration

Stadia consumes existing theme tokens from `theme/tokens.json` and `theme/tokens_light.json`.

### Default Colors

| Element             | Dark theme                       | Light theme                      |
| ------------------- | -------------------------------- | -------------------------------- |
| Pitch fill          | `surface.hero` (#12141a)         | `surface.hero` (#f5f5f7)         |
| Pitch lines         | `border.hairline` (#2a2e38)      | `border.hairline` (#d1d5db)      |
| Optional markings   | `border.hairline` at 50% opacity | `border.hairline` at 50% opacity |
| Goal posts/crossbar | `text.primary` (#f5f5f7)         | `text.primary` (#1a1a1a)         |
| Goal net background | `surface.hero` at 30% opacity    | `surface.hero` at 30% opacity    |

### Line Weights

- Pitch boundary: 0.5 units
- Internal markings (penalty area, center circle, etc.): 0.5 units
- Optional tactical markings (half-spaces, thirds, zones): 0.3 units, dashed
- Goal frame: 0.8 units

### Color Overrides

The `colors` prop overrides theme defaults per-field. Partial overrides work — unspecified fields fall back to theme.

```tsx
// Green pitch with white lines (traditional broadcast look)
<Pitch crop="full" theme="dark" colors={{
  fill: "#1a472a",
  lines: "#ffffff33",
  markings: "#ffffff1a",
}}>
```

## Consumer API Examples

### Pass network on full pitch

```tsx
<Pitch crop="full" orientation="vertical">
  {({ project }) => (
    <>
      {connections.map((c) => {
        const from = project(c.fromX, c.fromY);
        const to = project(c.toX, c.toY);
        return <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
      })}
      {players.map((p) => {
        const pos = project(p.avgX, p.avgY);
        return <circle cx={pos.x} cy={pos.y} r={p.size} />;
      })}
    </>
  )}
</Pitch>
```

### Shot map on half pitch

```tsx
<Pitch crop="half" orientation="vertical">
  {({ project }) =>
    shots.map((s) => {
      const p = project(s.x, s.y);
      return <circle cx={p.x} cy={p.y} r={s.size} fill={s.color} />;
    })
  }
</Pitch>
```

### Goal-mouth shot placement

```tsx
<Goal facing="striker" theme="dark">
  {({ project }) =>
    shots.map((s) => {
      const p = project(s.goalMouthY, s.goalMouthZ);
      return <circle cx={p.x} cy={p.y} r={3} fill={s.color} />;
    })
  }
</Goal>
```

### Static export

```tsx
<Pitch crop="full" interactive={false} padding={3}>
  {({ project }) => <PassNetworkOverlay data={network} project={project} />}
</Pitch>
```

## ShotMap Migration Path

Stadia ships independently. ShotMap migration is a follow-up task, not a v1 requirement:

1. `@withqwerty/campos-react` adds `@withqwerty/campos-stadia` as a dependency
2. ShotMap replaces its inline pitch SVG with `<Pitch crop="half" orientation="vertical">`
3. ShotMap's `mapPitchYToSvgX` / `mapPitchXToSvgY` functions are deleted — `project()` replaces them
4. Visual output is identical — the same pitch proportions, same colors (theme defaults match current hardcoded values)

## Testing Strategy

### Geometry tests (pure functions, no DOM)

- Pitch dimensions produce correct SVG paths for each marking type
- Crop viewBox calculations correct for full, half, penalty-area
- Goal frame dimensions proportionally correct
- Optional markings (half-spaces, thirds, zones) produce correct line positions

### Transform tests (pure functions)

- `project` maps Campos (0,0) and (100,100) to correct SVG boundaries per crop
- `project` returns valid coordinates for out-of-crop values (e.g., x=30 on half-pitch maps to a negative SVG position — clipped by viewport)
- Orientation flip (vertical vs horizontal) swaps x/y correctly
- Goal transform maps (0,0) to bottom-left post and (100,100) to top-right post
- Striker vs goalkeeper facing mirrors correctly
- Padding extends viewBox without moving pitch coordinate mapping

### React rendering tests (vitest + jsdom)

- Each surface renders correct SVG elements per crop
- Optional markings toggle with props
- Children receive working `project` function
- Theme prop switches colors
- Color overrides take precedence over theme
- Padding extends viewBox
- `interactive={false}` strips event handlers

### Visual regression (deferred)

- Screenshot comparison across crops, orientations, themes — not in v1
