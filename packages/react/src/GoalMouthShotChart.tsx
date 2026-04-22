import type { CSSProperties, ReactNode } from "react";

import type { ShotEvent } from "@withqwerty/campos-schema";
import { Goal, type GoalProps } from "@withqwerty/campos-stadia";

import {
  GoalMouthShotLayer,
  type GoalMouthShotLayerMarkersStyle,
} from "./primitives/index.js";
import { useTheme } from "./ThemeContext.js";
import { useCursorTooltip } from "./primitives/index.js";
import type { UITheme } from "./theme.js";

export type GoalMouthShotChartProps = {
  shots: readonly ShotEvent[];
  goal?: Omit<GoalProps, "children">;
  markers?: GoalMouthShotLayerMarkersStyle;
  tooltip?:
    | false
    | {
        renderContent?: (shot: ShotEvent) => ReactNode;
      };
  className?: string;
  style?: CSSProperties;
};

function formatMetric(value: number | null | undefined, digits = 2) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : null;
}

function defaultTooltipContent(shot: ShotEvent, theme: UITheme) {
  const xg = formatMetric(shot.xg);
  const xgot = formatMetric(shot.xgot);

  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ fontWeight: 700 }}>{shot.playerName ?? "Unknown player"}</div>
      <div style={{ color: theme.text.muted, textTransform: "capitalize" }}>
        {shot.outcome}
      </div>
      {xg != null ? <div>xG: {xg}</div> : null}
      {xgot != null ? <div>xGOT: {xgot}</div> : null}
    </div>
  );
}

function defaultMarkerTitle(shot: ShotEvent) {
  const xgot = formatMetric(shot.xgot);
  return `${shot.playerName ?? "Unknown player"} - ${shot.outcome}${xgot != null ? ` - xGOT ${xgot}` : ""}`;
}

export function GoalMouthShotChart({
  shots,
  goal,
  markers,
  tooltip = {},
  className,
  style,
}: GoalMouthShotChartProps) {
  const theme = useTheme();
  const { containerRef, show, hide, element: tooltipElement } = useCursorTooltip(theme);
  const tooltipEnabled = tooltip !== false;
  const empty = shots.length === 0;
  const tooltipRenderer =
    tooltip === false
      ? undefined
      : (shot: ShotEvent) =>
          tooltip.renderContent?.(shot) ?? defaultTooltipContent(shot, theme);

  return (
    <div
      ref={containerRef}
      className={className}
      data-slot="frame"
      data-chart-kind="goal-mouth-shot-chart"
      data-empty={empty ? "true" : "false"}
      style={{ position: "relative", width: "100%", ...style }}
    >
      <div data-slot="plot">
        <Goal facing="striker" {...goal}>
          {({ project }) => (
            <GoalMouthShotLayer
              shots={shots}
              project={project}
              // Native SVG <title> is the hover fallback when no custom
              // tooltip is active. Suppressing it when the cursor tooltip
              // is enabled avoids the double-tooltip (custom pill + native
              // browser tooltip firing on the same hover).
              {...(tooltipEnabled ? {} : { markerTitle: defaultMarkerTitle })}
              {...(markers != null ? { markers } : {})}
              {...(tooltipEnabled
                ? {
                    onMarkerMouseEnter: (event, shot) => {
                      show(event, tooltipRenderer?.(shot) ?? null);
                    },
                    onMarkerMouseLeave: () => {
                      hide();
                    },
                  }
                : {})}
            />
          )}
        </Goal>
      </div>
      {tooltipEnabled ? tooltipElement : null}
    </div>
  );
}
