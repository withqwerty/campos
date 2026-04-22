# Campos API Redesign — v2 Architecture

**Date:** 2026-04-06
**Status:** archived
**Superseded by:** `docs/architecture-decision.md`
**Motivation:** Current components are simple function calls with baked-in visual decisions. Real football viz needs configurable visual channels, continuous colour scales, and composable layouts. Target: "mplsoccer but modern — for web and mobile, not academic papers."

## Reference point: TeamsLab

The benchmark is [TeamsLab](https://teamslab.streamlit.app) — a Streamlit app that renders shot maps with 6 encodable dimensions per marker:

| Dimension     | What it encodes | How                                                                          |
| ------------- | --------------- | ---------------------------------------------------------------------------- |
| x, y position | Shot location   | Direct mapping                                                               |
| Colour fill   | xG (continuous) | Blue → cyan → yellow → orange → red gradient                                 |
| Marker shape  | Shot type       | Circle = foot, Hexagon = header, Triangle = through ball, Square = free kick |
| Outline style | Outcome         | White = goal, grey shades = saved/blocked/off-target, pink = own goal        |
| Size          | xG              | Larger = higher xG                                                           |
| Opacity       | Layering        | Overlapping shots build density                                              |

Our current shot_map uses 2 dimensions (binary colour + size). This is the gap.

## Design principles

1. **Simple by default, powerful when needed** — `shot_map(shots)` works in one line; `ShotMap(shots).encode(...).scale(...).render()` gives full control
2. **Return matplotlib Figures** — no type boundary between tiers; users' matplotlib knowledge transfers
3. **`ax=None` composability** — every component accepts an optional axes for embedding in layouts
4. **Theme via rcParams** — no custom theme objects; plain dicts that compose via `|` merge
5. **Data fields map to visual channels** — Altair-style `encode()` with auto-detected scale types

## Three-tier API

### Tier 1: Module-level function (one-liner)

```python
fig = campos.shot_map(
    shots,                        # list[Shot]
    color="xg",                   # field name → auto continuous gradient
    shape="body_part",            # field name → auto categorical markers
    size="xg",                    # field name → auto continuous sizing
    outline="outcome",            # field name → auto categorical edge styles
    pitch="dark",                 # pitch style preset
    title="Salah — Shot Map",
    ax=None,                      # pass axes for composition
)
```

All parameters optional except `shots`. Sensible defaults for everything.

### Tier 2: Mutate the returned Figure

```python
fig = campos.shot_map(shots)
ax = fig.axes[0]
ax.set_title("Custom title", fontsize=16, color="white")
fig.savefig("output.png", dpi=200)
```

This is free — the Figure is plain matplotlib.

### Tier 3: Builder for full control

```python
from campos import ShotMap, ContinuousScale, CategoricalScale, Pitch

fig = (
    ShotMap(shots)
    .pitch(Pitch(
        style="dark",           # or "light", "grass", custom dict
        crop="attacking_third", # or "half", "full"
        orientation="horizontal", # or "vertical"
        line_color="#2a2e38",
        bg_color="#12141a",
    ))
    .encode(
        color="xg",
        shape="body_part",
        size="xg",
        outline="outcome",
    )
    .scale(
        color=ContinuousScale(scheme="turbo", domain=(0, 0.8)),
        shape=CategoricalScale({
            "foot": "o",
            "head": "h",      # hexagon
            "other": "s",     # square
            None: "o",        # fallback
        }),
        size=ContinuousScale(range=(40, 600)),
        outline=CategoricalScale({
            "goal": {"color": "white", "width": 2.0},
            "saved": {"color": "#888888", "width": 0.8},
            "blocked": {"color": "#666666", "width": 0.5},
            "off_target": {"color": "#444444", "width": 0.5},
            "own_goal": {"color": "#ff6b6b", "width": 2.0},
            None: {"color": "#444444", "width": 0.5},
        }),
    )
    .legend(
        position="bottom",     # or "right", "top", "none"
        show_counts=True,      # "Goal (54)" vs just "Goal"
    )
    .stats(
        show=True,             # stats bar: total shots, goals, xG
        position="bottom",
    )
    .render(ax=None)           # returns matplotlib Figure
)
```

### Implementation: Tier 1 wraps Tier 3

```python
def shot_map(shots, *, color="outcome", size="xg", shape=None,
             outline=None, pitch="dark", title=None, ax=None, **kwargs):
    """One-line shot map with sensible defaults."""
    builder = ShotMap(shots)
    builder = builder.pitch(Pitch(style=pitch))
    builder = builder.encode(color=color, size=size, shape=shape, outline=outline)
    if title:
        builder = builder.title(title)
    return builder.render(ax=ax)
```

## Scale system

### Auto-detection

When a user writes `color="xg"`, the system:

1. Inspects the field values across all shots
2. If all numeric → `ContinuousScale` (gradient)
3. If all string/enum → `CategoricalScale` (discrete palette)
4. User can override by passing an explicit scale

### Scale types

```python
class ContinuousScale:
    """Maps numeric values to a continuous visual range."""
    def __init__(
        self,
        scheme: str = "turbo",         # matplotlib colormap name
        domain: tuple[float, float] | None = None,  # auto from data if None
        range: tuple[float, float] | None = None,    # for size: (min_size, max_size)
    ): ...

class CategoricalScale:
    """Maps categorical values to discrete visual properties."""
    def __init__(
        self,
        mapping: dict[str | None, Any] | None = None,  # explicit mapping
        palette: str | list[str] | None = None,          # colour palette name
    ): ...
```

### Built-in colour schemes for football

```python
# xG gradient (the TeamsLab style)
"xg_gradient"  # blue → cyan → yellow → orange → red

# Outcome categorical
"outcome_dark"  # goal=white, saved=grey, blocked=dark grey, off_target=dim
"outcome_light" # goal=green, saved=amber, blocked=grey, off_target=light grey

# Team-aware (club colours)
campos.scale.team_colors("Arsenal")  # returns CategoricalScale with club palette
```

## Pitch configuration

```python
class Pitch:
    def __init__(
        self,
        style: str = "dark",           # "dark" | "light" | "grass" | "minimal"
        crop: str = "half",            # "full" | "half" | "attacking_third" | "penalty_box"
        orientation: str = "vertical", # "vertical" | "horizontal"
        coordinate_system: str = "campos",  # "campos" (0-1) | "statsbomb" | "opta" | "wyscout"
        bg_color: str | None = None,   # override from style
        line_color: str | None = None,
        line_width: float = 1.5,
        show_goal: bool = True,
        show_grid: bool = False,
    ): ...
```

### Pitch styles

| Style     | Background     | Lines      | Best for                      |
| --------- | -------------- | ---------- | ----------------------------- |
| `dark`    | #12141a        | #2a2e38    | Social media, dark dashboards |
| `light`   | #f5f5f7        | #d1d5db    | Blog posts, light dashboards  |
| `grass`   | Green gradient | White      | Traditional, broadcast feel   |
| `minimal` | Transparent    | Very faint | Embedding in other designs    |

## Theming

### Global theme

```python
campos.use_theme("dark")   # sets rcParams globally
campos.use_theme("light")

# Context manager for temporary theme
with campos.theme("dark"):
    fig = campos.shot_map(shots)
```

### Theme tokens (tokens.json)

Themes are defined in `theme/tokens.json` (dark) and `theme/tokens_light.json` (light). The token structure:

```json
{
  "color": {
    "surface": { "base": "#0a0a0f", "card": "#12141a", "pitch": "#12141a" },
    "text": { "primary": "#f5f5f7", "secondary": "#6b7280", "dim": "#3b3f4a" },
    "accent": { "goal": "#34d399", "miss": "#818cf8", "highlight": "#f472b6" },
    "scale": {
      "xg": ["#1e3a5f", "#2980b9", "#27ae60", "#f1c40f", "#e74c3c"],
      "outcome": { "goal": "#ffffff", "saved": "#888888", "blocked": "#666666", "off_target": "#444444" }
    }
  },
  "typography": { ... },
  "spacing": { ... }
}
```

### Per-component theme override

```python
# Override specific tokens for one call
fig = campos.shot_map(shots, theme={"color.accent.goal": "#C8102E"})  # Liverpool red goals
```

## Composability

### ax= pattern (universal)

Every component accepts `ax=None`:

- `None` → creates its own Figure + Axes
- An Axes → renders into the provided axes (caller owns the layout)

```python
# Standalone
fig = campos.shot_map(shots)

# Composed with matplotlib
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 8))
campos.shot_map(shots, ax=ax1)
campos.radar_chart(cats, ax=ax2)

# Composed with campos.compose()
fig = campos.compose(
    [campos.shot_map(shots), campos.radar_chart(cats)],
    layout="horizontal",
)
```

### Dashboard layout helper

```python
# For complex layouts (like TeamsLab)
fig = campos.Dashboard(figsize=(16, 10), style="dark")
fig.add("shot_map", shots, position=(0, 0, 2, 2))   # row, col, rowspan, colspan
fig.add("xg_distribution", shots, position=(0, 2, 1, 1))
fig.add("stats_table", stats, position=(1, 2, 1, 1))
fig.render()
```

## Component inventory (v2)

| Component             | Tier 1 function                | Tier 3 builder      | Visual channels                       |
| --------------------- | ------------------------------ | ------------------- | ------------------------------------- |
| `shot_map`            | `campos.shot_map()`            | `ShotMap`           | color, shape, size, outline, position |
| `radar_chart`         | `campos.radar_chart()`         | `RadarChart`        | fill, stroke, labels                  |
| `percentile_ribbon`   | `campos.percentile_ribbon()`   | `PercentileRibbon`  | bar color, comparison marker, track   |
| `player_table`        | `campos.player_table()`        | `PlayerTable`       | cell color scale, sort, truncation    |
| `player_hero`         | `campos.player_hero()`         | `PlayerHero`        | photo, club accent, badges            |
| `percentile_group`    | `campos.percentile_group()`    | `PercentileGroup`   | aggregate, nested ribbons             |
| `category_score_card` | `campos.category_score_card()` | `CategoryScoreCard` | score, comparison, arc                |
| `ranked_list`         | `campos.ranked_list()`         | `RankedList`        | bar color, sort, truncation           |

## Research sources

### Libraries studied

| Library             | Key pattern adopted                                                      | What we improve                                         |
| ------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| **mplsoccer**       | `ax=` composability, Pitch coordinate systems, scatter/heatmap methods   | Theme system, visual channel mapping, modern aesthetics |
| **Altair**          | `encode()` with field + type + scale, registered themes                  | We're matplotlib-native, not Vega-Lite                  |
| **Seaborn Objects** | `so.Plot().add().scale().theme()` builder chain, `.on(ax)` composability | Football-domain-specific, not general-purpose           |
| **Plotly Express**  | Simple function wrapping full builder, same return type                  | We're static matplotlib, not interactive                |
| **Plotnine**        | Grammar of Graphics for Python, `aes()` mappings                         | Too verbose for football-specific use cases             |

### Key design decisions from research

1. **Altair's encoding-with-attached-scale** is the cleanest pattern for mapping fields to visual channels. Adopted for `encode()` + `scale()`.

2. **Plotly Express → Graph Objects** proves that Tier 1 and Tier 3 can return the same type with zero-cost progression. Adopted: both tiers return `matplotlib.figure.Figure`.

3. **Seaborn's `.theme()` as plain rcParams dict** avoids custom theme object complexity. Adopted: themes are dicts, compose via `|`.

4. **mplsoccer's `ax=` parameter** is the universal composability contract in the matplotlib ecosystem. Adopted for all components.

5. **Continuous colour gradients** (not binary) are essential for encoding xG. TeamsLab uses turbo-like gradient. We'll ship built-in football-specific colour scales.

6. **Multiple visual channels per marker** (6 in TeamsLab) is the quality bar. Shape, colour, size, outline, position, and opacity should all be independently mappable.

## Migration path

The current v1 API (`campos.shot_map(shots)`) continues to work — it becomes a Tier 1 wrapper around the new builder. No breaking changes for existing users. The builder API is additive.

## Open questions

1. **Should Pitch be its own reusable object?** mplsoccer's Pitch is the foundation. We could wrap it or build our own pitch renderer (more control over aesthetics but more work).

2. **TypeScript/React pivot?** For truly modern web/mobile viz, a React component library with D3/Canvas rendering would produce better output than matplotlib. The schema types would stay the same. Worth exploring after Python v2 ships.

3. **Should `encode()` accept arbitrary Shot fields or only known ones?** Strict (only `xg`, `outcome`, `body_part`, `minute`) is safer. Flexible (any attribute) is more powerful but risks runtime errors.

4. **Colorbar vs legend for continuous scales?** TeamsLab uses a gradient bar at the top. Matplotlib's colorbar is clunky. We may need a custom gradient legend.
