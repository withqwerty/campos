# Component Extension Standard

**Status:** active
**Purpose:** standardize how Campos components handle states, labels, defaults, static rendering, responsive degradation, and customization seams

## Why this exists

Campos components should not each invent their own answers to:

- what states must be specified
- how labels behave
- what “publishable defaults” means
- whether the chart can be rendered as a static image
- how the chart should degrade across small containers and mobile touch targets
- how users extend the chart without breaking the chart-shaped API

This standard defines those cross-cutting rules.

## 1. States are required spec surface

Every component spec must include an explicit `States` section.

At minimum, each component should account for:

- **default**: the intended zero-config happy path
- **empty**: no plottable data
- **sparse**: one mark / one row / one event
- **dense**: enough marks to expose overlap or performance pressure
- **fallback / degraded**: key optional field missing, but the chart remains valid
- **interactive**: hover, focus, selected, or pressed, if interaction exists

When relevant, also specify:

- loading
- unsupported provider / blocked adapter path
- error

If a state does not apply, say so explicitly.

## 2. Labels are a first-class chart policy

Every component spec must include a `Labels` section.

That section should define:

- what gets labeled by default
- what is tooltip-only vs always-visible
- collision policy
- truncation or wrapping rules
- mobile behavior
- long / multilingual text behavior

`LabelLayer` may be a shared internal concern, but label policy is chart-specific and must be specified per component.

## 3. Default colors and themes must be intentional

Every component spec must include a `Default colors and themes` section.

That section should define:

- the zero-config default theme
- semantic color meanings
- continuous scale defaults
- how the chart behaves in light vs dark contexts if both are supported
- contrast expectations and minimum marker visibility

Global tokens belong elsewhere, but every component still needs an explicit default visual contract.

## 4. Static rendering / export must be considered

Every component spec must include a `Static rendering / export` section.

The point is not to fully design export infrastructure per component. The point is to ensure the chart can survive a future “share as image” or static SVG/PNG path.

Campos should assume an SVG-first export path unless a component explicitly cannot support it. In practice that means the default chart should be serializable to SVG, with later infrastructure responsible for inlining fonts and raster assets, then optionally rasterizing to PNG or social presets.

Each component should specify:

- whether the default view is meaningful without hover
- whether labels/tooltips hide essential information
- whether fonts, patterns, masks, or filters create export risk
- whether the chart should render cleanly to static SVG
- any known constraints for later PNG export or social-card presets
- whether the component needs an export-safe fallback state or legend/header treatment

If a component depends heavily on interaction, the non-interactive fallback must be described.

## 5. Responsive behavior is required

Every component spec must include a `Responsive behavior` section.

That section should define:

- container-size tiers the chart is expected to support
- what must remain visible at each tier
- what degrades first: labels, legends, annotations, secondary controls, dense marks, or the chart form itself
- touch behavior when hover is unavailable
- whether the chart has a minimum honest size below which it must switch form or refuse

Use chart-specific degradation rules rather than a vague “responsive” claim.

Recommended default tiers:

- `S`: under `480px`
- `M`: `480px` to `767px`
- `L`: `768px` and above

Examples:

- `ShotMap`: keep pitch and markers, reduce legend density, move detail to tap tooltip
- `ScatterPlot`: keep points, reduce labels to outliers only, fade background points
- `RadarChart` / `PizzaChart`: may need a bar/table fallback at `S` if the circular form stops being honest
- `xGTimeline`: keep step lines and goals, reduce annotation density, preserve final totals

## 6. Customization must preserve the chart-shaped API

Every component spec must include an `Advanced customization / extension seams` section.

Campos should support extension, but not by collapsing into a public low-level scene API.

Customization should be described in layers:

### A. Safe prop-level customization

Examples:

- domain overrides
- orientation
- crop
- category or color mode switches
- optional titles / subtitles

These belong in the main public props surface.

### B. Overlay or annotation extension seams

Examples:

- median or threshold line on `ScatterPlot`
- halftime marker on `xGTimeline`
- custom note or badge in a chart header

These should be designed as clearly bounded extension seams, not as arbitrary drawing callbacks over the whole scene.

### C. Explicit non-goals

If a requested customization would effectively expose low-level chart assembly, it should remain out of scope until Campos deliberately supports that level of extension.

Examples:

- arbitrary scene graph children
- direct mutation of internal semantic models from the public renderer
- raw SVG element injection into core

## 7. Customization hierarchy

Use this order when deciding how to expose customization:

1. **default behavior**
2. **simple prop override**
3. **bounded extension seam** (overlay, annotation slot, guide line, renderer callback over a stable subregion)
4. **defer**

Do not jump from “default chart” to “arbitrary scene API.”

## 8. Review implications

Reviewers should challenge:

- whether required states are explicitly defined
- whether label behavior is actually specified
- whether defaults are publishable, not merely valid
- whether static rendering would lose essential meaning
- whether responsive degradation is honest and specified per tier
- whether a customization seam is too weak or too broad

## 9. Suggested spec section names

To keep specs consistent, use these section names:

- `States`
- `Labels`
- `Default colors and themes`
- `Static rendering / export`
- `Responsive behavior`
- `Advanced customization / extension seams`
