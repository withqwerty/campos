# Component Defaults

**Status:** active

This document defines the zero-config output contract for shipped components.

## Shared rules

- No title by default.
- Light theme by default via shared theme context.
- Defaults should look publishable, not generic.
- Empty states keep the component shell where possible.
- Non-informative legends and scale bars should auto-hide.

## ShotMap

`<ShotMap shots={shots} />`

- vertical attacking half-pitch
- portrait card, outer aspect ratio around `4:5`
- top stats bar shown: `Shots`, `Goals`, `xG` when xG data exists
- continuous xG scale bar shown when domain is meaningful
- marker size = `xg`
- marker fill = sequential `xg`
- marker shape = `bodyPart`
- marker outline emphasis = goal vs non-goal
- legend row shown for present shape categories and goal-outline treatment
- empty state: muted pitch, zeroed stats, `No shot data`, no legend, no scale bar

### ShotMap fallback when xG is absent

If all `xg` values are `null`:

- marker size falls back to a constant minimum
- marker fill switches to categorical outcome colour
- scale bar is hidden
- stats bar shows `Shots` and `Goals` only
- tooltip omits xG rather than showing placeholder values

Suggested v0 outcome palette should map the canonical normalized outcomes:

- `goal`
- `saved`
- `blocked`
- `off-target`
- `hit-woodwork`
- `other`

This is a degraded but still valid default. Missing xG should not make the component unusable.

## PassMap

`<PassMap passes={passes} />`

- full pitch by default
- landscape card, outer aspect ratio around `16:10`
- top stats bar shown: `Passes`, `Completion`
- arrows show pass origin, destination, and direction
- arrow color default = completion status
- arrow weight stays light and precise rather than expressive by default
- compact legend shown only when the encoding needs explanation
- empty state: pitch shell plus `No passing data`

## ScatterPlot

`<ScatterPlot points={points} x="..." y="..." />`

- landscape card, outer aspect ratio around `4:3`
- no header stats by default unless a summary is intrinsic to the configured metric set
- axes, grid, and labels shown by default
- point size default = constant unless a size channel is provided
- point color default = single accent unless a color channel is provided
- legend shown only when a categorical color or shape encoding is active
- empty state: axes shell plus `No data`

## Default tooltip principle

Tooltips should answer:

- who or what this mark is;
- the encoded values currently visible;
- one or two domain-specific secondary fields when available.

Tooltips should not dump every raw field by default.

## Blocking specs still to write / maintain

Before core implementation expands further, the component set still needs:

- region-by-region layout specs where still missing;
- tooltip field specs per primitive where still missing;
- legend content and grouping specs where still missing.
