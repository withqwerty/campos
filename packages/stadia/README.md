# @withqwerty/campos-stadia

React pitch and goal primitives for Campos: regulation football surfaces, goal-mouth frames, coordinate projection, responsive SVG sizing, themes, grass patterns, tactical markings, and export-safe static rendering.

Stadia is the shared surface layer beneath Campos pitch charts. It has no provider or event assumptions: it renders the surface and gives callers projection functions for their own SVG marks.

## Public Surface

- `<Pitch />` renders a full, half, or penalty-area pitch in vertical or horizontal orientation.
- `<Goal />` renders a goal-mouth frame from striker or goalkeeper perspective, with a recessed box-net by default and optional flat-net geometry.
- `createPitchProjection()` maps Campos pitch coordinates (`x: 0..100`, `y: 0..100`) to SVG meter units.
- `createGoalProjection()` maps goal-mouth coordinates (`goalY: 0..100`, `goalZ: 0..100`) to SVG meter units.
- `computeViewBox()` returns the SVG viewport for pitch crops and goal surfaces.
- `computePitchMarkings()` and `computeGoalMarkings()` expose framework-neutral geometry for non-React renderers.
- `PitchColors`, `GoalColors`, `GrassPattern`, `PitchMarkingsConfig`, and `ZoneLayout` describe supported visual customization.

`PitchBackground`, `PitchLines`, `PitchMarkings`, `TacticalMarkings`, `GoalFrame`, and grass renderers are implementation details. Use `<Pitch underlay={...}>` when a chart needs to draw a heatmap, density surface, or other layer between the pitch fill and pitch lines.

## Coordinate Contract

Pitch children receive a `project(x, y)` callback.

- `x: 0..100` runs from own goal to opposition goal.
- `y: 0..100` runs across the pitch width.
- Projection always maps the full pitch. `crop`, `side`, and `frame` affect what the SVG viewport shows, not the input coordinate convention.
- `orientation="vertical"` means the team attacks upward.
- `orientation="horizontal"` means the team attacks rightward.
- `side="attack"` selects the attacking crop: top in vertical, right in horizontal.
- `side="defend"` selects the defensive crop: bottom in vertical, left in horizontal.

Goal children receive a `project(goalY, goalZ)` callback.

- `goalY: 0..100` runs across the goal width.
- `goalZ: 0..100` runs from ground to crossbar.
- `facing="striker"` keeps left post on screen-left.
- `facing="goalkeeper"` mirrors the view horizontally.

## Cross-Cutting Support

- **Static export:** `<Pitch>` and `<Goal>` render deterministic SVG. Set `interactive={false}` for export snapshots or when a parent owns interaction. Avoid function-based `grass={{ type: "formula" }}` and custom pattern renderers in serialized chart specs unless the export pipeline explicitly supports functions.
- **Accessibility:** set `role="img"` and `ariaLabel` when using Stadia as a standalone chart. Higher-level Campos charts usually own the accessible label and pass plain SVG marks into Stadia.
- **Responsive sizing:** the outer SVG uses `width: 100%` and an aspect ratio derived from the selected frame. Parent layout controls max width.
- **Themes:** `theme="primary"` is green/white. `theme="secondary"` is dark/muted. `colors` overrides are applied after the selected theme.
- **Goal net geometry:** `netShape="box"` draws a recessed broadcast-style back frame and side panels while preserving the same `project(goalY, goalZ)` contract for foreground marks. Use `netBackInset`, `netBackOffsetTop`, and `netBackOffsetBottom` to tune the fake-3D depth.
- **Composition:** render plot marks as SVG children. Use `underlay` for surfaces that must sit below pitch lines and regular `children` for foreground marks.

## Best-Practice Usage

```tsx
import { Pitch, Goal } from "@withqwerty/campos-stadia";
import type { PitchColors } from "@withqwerty/campos-stadia";

type EventPoint = {
  id: string;
  x: number;
  y: number;
  value: number;
  goalMouthY?: number;
  goalMouthZ?: number;
};

type SurfaceExampleProps = {
  events: readonly EventPoint[];
  exportMode?: boolean;
};

const pitchColors: PitchColors = {
  fill: "#17462a",
  lines: "#ffffffd9",
  markings: "#ffffff66",
};

export function SurfaceExample({ events, exportMode = false }: SurfaceExampleProps) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Pitch
        crop="half"
        orientation="vertical"
        side="attack"
        frame="crop"
        colors={pitchColors}
        grass={{ type: "stripes", opacity: 0.35 }}
        markings={{ halfSpaces: true, thirds: true }}
        interactive={!exportMode}
        role="img"
        ariaLabel={`${events.length} attacking-half events`}
      >
        {({ project }) =>
          events.map((event) => {
            const point = project(event.x, event.y);
            return (
              <circle
                key={event.id}
                cx={point.x}
                cy={point.y}
                r={1.2 + event.value * 2}
                fill="#f6c945"
                stroke="#141414"
                strokeWidth={0.25}
              />
            );
          })
        }
      </Pitch>

      <Goal
        facing="striker"
        interactive={!exportMode}
        role="img"
        ariaLabel="Goal-mouth placement"
      >
        {({ project }) =>
          events
            .filter((event) => event.goalMouthY != null && event.goalMouthZ != null)
            .map((event) => {
              const point = project(event.goalMouthY!, event.goalMouthZ!);
              return <circle key={event.id} cx={point.x} cy={point.y} r={0.08} />;
            })
        }
      </Goal>
    </div>
  );
}
```

## What Stadia Does Not Own

- provider normalization
- event filtering
- legends, tooltips, headers, captions, or chart cards
- marker semantics such as shot outcome, pass direction, player identity, or xG scales
- static export frames or social-card layouts

Higher-level packages such as `@withqwerty/campos-react` compose Stadia with core models, legends, tooltips, and accessibility copy to ship complete chart components.
