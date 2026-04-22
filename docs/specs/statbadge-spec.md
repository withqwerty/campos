# StatBadge Component Spec

> Wave R1 update: the active customization surface is `styles?: StatBadgeStyles`, not `homeColor` / `awayColor`. Home and away bar fills now live under `styles.home.barColor` and `styles.away.barColor`, alongside value, label, bar-track, and chrome tokens.

**Status:** active
**Last updated:** 2026-04-16

## Header

- Component / primitive: `StatBadge` and `StatBadgeRow` (public layout primitive)
- Status: active spec
- Owner: campos team
- Target version: v0.3 (roadmap-v0.3 Lane 1, order 4)
- Depends on:
  - none — pure React + CSS, no compute, no adapter widening
  - consumed by: Showcase A (`apps/site/src/pages/showcase/match.astro`) match-header strip

## Purpose

- **What user task this solves:** Render the broadcast-style match-stat strip that appears at the top of every football match page on Sky Sports, BBC Sport, NBC, and Opta — "Possession 56% / 44%", "Shots 14 / 9", "xG 1.8 / 0.7", with the dominant side emphasised. Consumers pass already-formatted strings (or raw numbers when they want a proportional bar); StatBadge handles layout, typography, emphasis, and the optional split bar.
- **Why it belongs in Campos:** Every match-context surface needs this. Without a StatBadge primitive, every consumer rebuilds the same flex/grid layout, picks colors inconsistently, and forgets accessibility. Lane 1's Showcase A page is the immediate forcing function — the match header is the first thing a user sees on the deep-dive page and it needs to look broadcast-grade with no boilerplate.
- **Why it should be a public component:** It's a visual primitive, not internal infrastructure. Consumers will instantiate it directly in their own match pages, scouting cards, and reports. It also serves as a low-friction integration test for downstream apps — if you can render a StatBadgeRow, your build pipeline is wired up correctly.

## Domain framing

### Football concept

`StatBadge` models a **home-vs-away KPI comparison strip** for match context:
possession, shots, xG, corners, and similar already-computed metrics.

This is a football-facing surface, but it is not a strong canonical data model
in the same way `Shot`, `PassEvent`, or `FormationTeamData` are.

### Bounded-context ownership

- consumer/app code owns:
  - which KPIs exist
  - how they are computed
  - number formatting and rounding
  - whether a metric is higher-is-better or lower-is-better
- `react` owns:
  - comparison-strip layout
  - winner emphasis
  - optional proportional bar rendering
  - accessible row/badge presentation
- `adapters` and `schema` do **not** own a first-class `StatBadge` data product
  today

This is an intentional weak-fit case for the domain-modeling standard: the
component is football-specific in use, but most of its contract is still
presentation over consumer-owned metrics.

### Canonical input model

The canonical input for this component is intentionally small:

- a `Stat[]` array with display values
- optional raw numeric values for comparison-bar math

That is a UI-facing comparison packet, not a provider-normalized schema type.

### Invariants

- each badge compares one `home` value and one `away` value for one metric label
- `label` is the semantic identity of the metric inside the row
- raw numeric values are optional enrichment for bar sizing and winner emphasis,
  not a requirement for the component to remain honest
- the component never fetches, derives, or normalizes football data itself
- if Campos later introduces canonical match-summary products, `StatBadge`
  should consume them upstream rather than absorb that computation into the
  component

## Composition model

### Public components

- `StatBadge` — single stat (one row of `home value | label | away value`, optional bar)
- `StatBadgeRow` — container that lays out a list of stats horizontally (or in a stacked grid on narrow viewports)

Both live in the same file (`packages/react/src/StatBadge.tsx`) and are exported together. `StatBadgeRow` always renders `StatBadge` children internally; `StatBadge` is also exported standalone for one-off use cases (e.g. a single KPI tile).

### Internal layers

- no canvas, no SVG — pure HTML + inline styles using the shared `UITheme` contract for neutral chrome
- accessible region semantics: `<section role="region">` for the row, `<div role="group">` for each badge
- comparison bar is a 2-segment `<div>` with percentage widths

### Shared encoding utilities

- none — there is no compute layer
- a tiny inline helper computes proportional split: `share = home / (home + away)` with NaN/zero guards

### Chart-specific logic

- visual emphasis on the winning side (configurable via `higherIsBetter` per stat)
- proportional bar rendering (only when raw numeric values are supplied AND `bar: true`)
- horizontal vs. vertical orientation
- empty / missing-value graceful handling

### Primitive extraction plan

- StatBadge **is** the primitive. There is nothing smaller to extract from it.
- A future `StatTile` (icon + single number, no comparison) could share the typography tokens, but that is a v0.4 concern.

### Explicit non-goals

- **No data fetching.** Consumers compute and format stats elsewhere and pass them in.
- **No adapter integration.** No `fromOpta.stats()`, no provider widening. Stats arrive pre-computed from the consumer's pipeline.
- **No trend sparkline / mini-chart inside the badge.** Save for v0.4 — would conflict visually with the comparison bar.
- **No icons by default.** A future `icon?: ReactNode` slot could be added in v0.4 if real consumers ask for it.
- **No tooltip, no click handlers.** Static, like Formation and Territory. Consumers wrap the badge themselves if they need interaction.
- **No filter/sort.** The row is just a render of the stats it receives.
- **No loading skeleton.** Consumers handle their own loading state.
- **No locale-aware number formatting.** The displayed values are strings supplied by the consumer; format upstream.
- **No automatic significant-figure rounding.** Same reason — consumer's responsibility.

### Filtering

StatBadge does not participate in cross-chart filtering. It is a pre-formatted display widget, not an event-driven chart.

## Public API

### Zero-config happy path

```tsx
import { StatBadgeRow } from "@withqwerty/campos-react";

<StatBadgeRow
  stats={[
    { label: "Possession", home: "56%", away: "44%" },
    { label: "Shots", home: "14", away: "9" },
    { label: "Shots on target", home: "6", away: "3" },
    { label: "xG", home: "1.8", away: "0.7" },
    { label: "Corners", home: "7", away: "2" },
  ]}
/>;
```

This produces a horizontal strip of 5 badges. Each badge shows `<home value> <label> <away value>` with the higher side bolded. Default neutral theme colors, no comparison bar, no extra chrome.

### Proposed public export

```ts
export type Stat = {
  /** Display label (e.g. "Possession", "Shots", "xG"). */
  label: string;
  /** Already-formatted display value for the home team (e.g. "56%", "1.8"). */
  home: string;
  /** Already-formatted display value for the away team. */
  away: string;
  /**
   * Optional raw numeric value for the home team. Only used for the
   * proportional bar and the bold-the-winner emphasis. If omitted,
   * the badge falls back to string-equality for the tie check and
   * suppresses the bar.
   */
  homeValue?: number;
  /** Optional raw numeric value for the away team. */
  awayValue?: number;
  /**
   * If false, lower values win (e.g. fouls committed, errors leading
   * to goals). Defaults to true.
   */
  higherIsBetter?: boolean;
  /**
   * If true, render a proportional split bar under the values.
   * Requires both `homeValue` and `awayValue` to be present and
   * non-negative; otherwise the bar is silently omitted.
   */
  bar?: boolean;
};

export type StatBadgeProps = {
  stat: Stat;
  styles?: StatBadgeStyles;
  /** @default "horizontal" */
  orientation?: "horizontal" | "vertical";
};

export type StatBadgeRowProps = {
  stats: Stat[];
  styles?: StatBadgeStyles;
  /** @default "horizontal" */
  orientation?: "horizontal" | "vertical";
  /** Override the section's accessible label. @default "Match statistics" */
  ariaLabel?: string;
};
```

### Advanced customization points

| Prop          | Type                         | Default                                | Purpose                                                                                          |
| ------------- | ---------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `styles`      | `StatBadgeStyles`            | theme-derived text + default bar fills | Semantic style tokens for home/away value colors, bar fills, label color, bar track, and chrome  |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"`                         | Horizontal: `home value \| label \| away value` on one row. Vertical: stacked for scouting cards |
| `ariaLabel`   | `string`                     | `"Match statistics"`                   | Section-level label for the row                                                                  |

Per-stat configuration (`bar`, `higherIsBetter`, `homeValue`, `awayValue`) lives on each `Stat` so different stats in the same row can mix bars + bold-only and high-is-better + low-is-better.

## Required normalized data

| Field            | Required | Why                                                   | Fallback if missing                                          |
| ---------------- | -------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| `label`          | yes      | Identifies the stat to the user and to assistive tech | throw at render time — no useful badge without it            |
| `home`           | yes      | Displayed value                                       | render an em-dash placeholder rather than crash              |
| `away`           | yes      | Displayed value                                       | render an em-dash placeholder rather than crash              |
| `homeValue`      | no       | Used for proportional bar + emphasis comparison       | fall back to string equality for the tie check; suppress bar |
| `awayValue`      | no       | Same                                                  | same                                                         |
| `higherIsBetter` | no       | Inverts the emphasis for "lower is better" stats      | defaults to `true`                                           |
| `bar`            | no       | Opt-in to render the proportional split bar           | defaults to `false`                                          |

### Provider readiness

Not applicable — StatBadge does not consume provider data. The match-page consumer is responsible for sourcing its own stats from whatever pipeline it uses (e.g. an aggregation over Opta events, a Postgres rollup, a static fixture). Showcase A will hand-author the first realistic stats fixture from a known Opta match.

### Lossy mappings

None — values are already strings.

## Default visual contract

### Layout

**Horizontal orientation** (default):

```
┌──────────────────────────────────────────────────────────────────┐
│ 56%       Possession       44%                                   │
│ ████████████░░░░░░░░  ← optional bar (only when bar: true)       │
└──────────────────────────────────────────────────────────────────┘
```

Each badge is a 3-column CSS grid: `1fr | auto | 1fr`. Home value left-aligned, label centered, away value right-aligned. The optional bar lives below as a single row spanning the full width.

`StatBadgeRow` lays out badges as a flex row with equal-width children (`flex: 1 1 0`). On viewports under ~640px the row collapses to a 2-column grid; under ~420px it stacks vertically. Layout collapse is CSS-only — no JS-driven breakpoints.

**Vertical orientation:**

```
┌─────────────┐
│   56%       │
│ Possession  │
│   44%       │
│  ████████░░ │
└─────────────┘
```

Each badge is a single-column flex column. Used for scouting card / dashboard grid layouts where each badge sits inside a small tile.

### Encodings

- **Position**: home always left/top, away always right/bottom — broadcast convention.
- **Typography emphasis**: the winning side is rendered with `font-weight: 800` (extra-bold) and the theme primary text color. The losing side uses `font-weight: 500` and the theme secondary text color. On a tie, both sides render with the same medium weight and primary color.
- **Bar color**: when `bar: true`, the bar is two adjacent `<div>` segments with percentage widths. Home and away fills default to neutral theme-adjacent colors and can be overridden with `styles.home.barColor` / `styles.away.barColor`.
- **Bar height**: 6px, rounded corners (3px). Lives below the values with 8px top margin.

### Color scale defaults

There is no scale. Neutral text and track chrome come from the active `UITheme`, while the home/away fills remain fixed defaults unless the consumer overrides them:

- `styles.home.barColor` default: `#1d4ed8` (mid blue)
- `styles.away.barColor` default: `#b91c1c` (mid red)

These can be overridden per-row or per-badge. The defaults are intentionally generic. When consumers have real team colors, they should pass them through the semantic styles object rather than through ad hoc color props.

### Legend / scale bar behavior

No legend. The values themselves are the legend. The label sits between the values precisely so the home/away identity is unambiguous from position alone.

### Empty state

- When `stats` is `[]` or `undefined`: the row renders as an empty `<section>` with the same `ariaLabel` and a `data-empty="true"` attribute. No visual chrome, no error. Consumers can detect via the attribute or ignore.
- When an individual `Stat` has missing `home` or `away` strings: the badge renders an em-dash (`—`) in place of the missing value. The badge does not crash.

### Fallback mode

- When `bar: true` is requested but `homeValue` / `awayValue` are missing or non-finite: the bar is silently omitted, and the rest of the badge renders normally. No warning, no console noise.
- When `homeValue + awayValue === 0`: the bar renders as a 50/50 split with reduced opacity to signal "no data" without disappearing entirely.

## States

- **default:** horizontal row of 5 badges with bold-on-winner emphasis
- **with bars:** same row with proportional bars under each badge
- **dominant home:** lopsided stats (e.g. 75% / 25%) — bars communicate dominance at a glance
- **close match:** near-50/50 splits — emphasis still picks a winner per stat
- **tie:** `home === away` — neither side bold, neutral coloring
- **lower is better:** `higherIsBetter: false` flips the emphasis (e.g. fouls committed)
- **vertical:** stacked layout for scouting card use
- **long labels:** wraps gracefully without breaking the 3-column grid
- **empty stats:** renders an empty section with no children

## Labels

- the label sits in the center column, `font-size: 0.75rem`, `text-transform: uppercase`, `letter-spacing: 0.06em`, and uses the theme secondary text color
- values are `font-size: 1.25rem`, `font-variant-numeric: tabular-nums` so digits align across rows
- the bar has no in-bar text — values above are sufficient

## Default colors and themes

- text and neutral chrome use `UITheme.text` and `UITheme.border` so the component follows the same light/dark contract as the chart renderers
- badge background is transparent — the consumer's wrapping card supplies any surface color
- bar default colors are intentionally neutral (mid blue / mid red); pass `styles.home.barColor` and `styles.away.barColor` to override

## Static rendering / export

- 100% server-renderable HTML — no client JS needed for the static case
- Phase 1 export support: not in scope for v0.3 (the export packet covers chart components, not layout primitives). A future Phase 2 packet could add a `share-card` preset that bakes a StatBadgeRow into a hero block.

## Responsive behavior

- `L` (`>=768px`): horizontal flex row, all badges side by side
- `M` (`480px-767px`): 2- or 3-column grid (CSS `grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))`), badges wrap as needed
- `S` (`<480px`): badges still wrap via the same grid; on the narrowest viewports (under ~360px) they end up stacked one per row
- vertical orientation always renders as a column regardless of viewport width
- the bar always sits under the values inside the badge — the bar never wraps to a separate row

## Edge cases

| Case                                 | Behavior                                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `stats: []`                          | Renders an empty `<section>` with `data-empty="true"`. No crash, no children                                                     |
| `stat.home === stat.away` (string)   | Tie — neither side bold, both use primary text color                                                                             |
| `homeValue === awayValue` (numeric)  | Tie via numeric comparison. String comparison only applies when raw values are missing                                           |
| `homeValue` or `awayValue` is `NaN`  | Treated as "missing" — falls back to string comparison and suppresses the bar                                                    |
| `homeValue + awayValue === 0`        | Bar renders 50/50 with `opacity: 0.4` instead of disappearing                                                                    |
| Negative raw values                  | Bar suppressed (negative shares are not meaningful); emphasis still falls through to string comparison                           |
| Very long labels (e.g. 30+ chars)    | Label wraps inside its grid cell; the badge grows vertically but never breaks horizontally. Tested in the demo "long label" card |
| Very large values (e.g. "1,234,567") | Tabular-nums keeps digit alignment; values may overflow on narrow viewports — that is consumer-acceptable, the row will wrap     |
| Missing `home` or `away` string      | Renders em-dash (`—`) in the missing slot                                                                                        |
| `higherIsBetter: false` and a tie    | Tie still wins — no side gets emphasis                                                                                           |
| `orientation` not in expected union  | Type-checked; runtime fall-through treats anything other than `"vertical"` as `"horizontal"`                                     |

## Advanced customization / extension seams

- safe prop-level customization:
  - `styles`
  - `orientation`
  - per-stat `bar`, `homeValue`, `awayValue`, `higherIsBetter`
  - `ariaLabel` on the row
- bounded extension seams (deferred):
  - per-stat `icon` slot
  - per-stat `format` callback (signature TBD)
  - sparkline overlay (v0.4 if real consumers ask)
- intentionally unsupported:
  - render-prop / children-as-function APIs
  - per-row sort or filter
  - hover tooltip system
  - inline editing

## Internal primitives required

| Primitive | Status | Notes                                                                          |
| --------- | ------ | ------------------------------------------------------------------------------ |
| (none)    | —      | StatBadge is the primitive. No core compute, no shared layer extraction needed |

## Demo requirements

The demo page at `apps/site/src/pages/statbadge.astro` must include at least 6 cards (we ship 8):

1. **Zero-config match header** — 5 realistic Premier League stats
2. **With proportional bars** — same stats, `bar: true` on each
3. **Home team dominant** — lopsided 75/25-style match
4. **Close match** — near-even split
5. **Lower is better** — fouls, yellow cards, errors with `higherIsBetter: false`
6. **Vertical orientation** — stacked layout for scouting card use
7. **Long labels stress test** — verify wrap behavior
8. **Empty state** — `stats={[]}` renders without crash
9. **Composed with Formation** (bonus) — preview of how the match-header strip will sit above the lineup card in Showcase A

Demo data lives in `apps/site/src/data/statbadge-demo.ts` as exported `Stat[]` constants. Realistic numbers should be hand-authored from a known Premier League match (Arsenal v Liverpool 2024/25 makes sense given Lane 1's Opta fixture).

## Test requirements

`packages/react/test/StatBadge.test.tsx` covers ~12 cases:

1. Renders a basic row with multiple stats
2. Renders home and away values correctly in each badge
3. Bolds the home side when home is higher (default `higherIsBetter: true`)
4. Bolds the away side when away is higher
5. Neither side bold on a tie (string equality)
6. `higherIsBetter: false` inverts the emphasis (lower wins)
7. Renders the proportional bar when `bar: true` and raw values are present
8. Omits the bar when raw values are missing
9. Handles empty stats array gracefully (no crash, empty section)
10. Long labels do not break layout (renders without throwing)
11. `aria-label` present on the row and on each badge
12. Axe-clean for the zero-config row

Edge cases tested inline (NaN, missing strings, negative values) where they don't deserve their own `it()`.

## Open questions

1. **Theme color coupling.** Neutral text and track chrome now come from the active `UITheme`. The default home/away bar fills remain hard-coded blue/red for v0.3; consumers can still pass real team colors when they have them.
2. **Accessible value description.** The current aria-label encodes `${label}: home ${home}, away ${away}`. Should it announce the winner explicitly ("home leading")? Decision: no — screen reader users can compare the values themselves; volunteering an interpretation feels paternalistic.
3. **Bar tooltip.** Should hovering the bar show the percentage split? Decision: no for v0.3 — would force a tooltip system into a layout primitive. Consumers can wrap the badge in their own tooltip if they want.
4. **`StatBadgeRow` empty-state pill.** Should the empty state render visible "No stats" text instead of just an empty section? Decision: silent for v0.3 — empty stats is a consumer-state, not a data-error. Consumers handle the messaging if they need to.
