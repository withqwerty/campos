import type {
  FocusEvent,
  FocusEventHandler,
  MouseEvent,
  MouseEventHandler,
  ReactNode,
} from "react";
import type { ShotEvent } from "@withqwerty/campos-schema";
import type { GoalProjectFn } from "@withqwerty/campos-stadia";

import type { StyleValue } from "../styleValue.js";
import { resolveStyleValue } from "../styleValue.js";
import { ChartPointMark, type PointShape } from "./ChartPointMark.js";

export type GoalMouthShotLayerStyleContext = {
  shot: ShotEvent;
};

export type GoalMouthShotLayerMarkersStyle = {
  show?: StyleValue<boolean, GoalMouthShotLayerStyleContext>;
  fill?: StyleValue<string, GoalMouthShotLayerStyleContext>;
  fillOpacity?: StyleValue<number, GoalMouthShotLayerStyleContext>;
  stroke?: StyleValue<string, GoalMouthShotLayerStyleContext>;
  strokeWidth?: StyleValue<number, GoalMouthShotLayerStyleContext>;
  opacity?: StyleValue<number, GoalMouthShotLayerStyleContext>;
  size?: StyleValue<number, GoalMouthShotLayerStyleContext>;
  shape?: StyleValue<PointShape, GoalMouthShotLayerStyleContext>;
};

export type GoalMouthShotLayerProps = {
  shots: readonly ShotEvent[];
  project: GoalProjectFn;
  markers?: GoalMouthShotLayerMarkersStyle;
  markerTitle?: (shot: ShotEvent) => string | undefined;
  onMarkerMouseEnter?: (event: MouseEvent<SVGGElement>, shot: ShotEvent) => void;
  onMarkerMouseLeave?: MouseEventHandler<SVGGElement>;
  onMarkerFocus?: (event: FocusEvent<SVGGElement>, shot: ShotEvent) => void;
  onMarkerBlur?: FocusEventHandler<SVGGElement>;
  renderMarkerOverlay?: (shot: ShotEvent) => ReactNode;
};

function defaultFill(shot: ShotEvent) {
  switch (shot.outcome) {
    case "goal":
      return "#0f766e";
    case "saved":
      return "#c0841a";
    case "hit-woodwork":
      return "#7c3aed";
    case "blocked":
      return "#64748b";
    case "off-target":
      return "#475569";
    default:
      return "#334155";
  }
}

function defaultShape(shot: ShotEvent): PointShape {
  return shot.outcome === "goal" ? "diamond" : "circle";
}

function hasGoalMouthLocation(shot: ShotEvent) {
  return (
    typeof shot.goalMouthY === "number" &&
    Number.isFinite(shot.goalMouthY) &&
    typeof shot.goalMouthZ === "number" &&
    Number.isFinite(shot.goalMouthZ)
  );
}

export function GoalMouthShotLayer({
  shots,
  project,
  markers,
  markerTitle,
  onMarkerMouseEnter,
  onMarkerMouseLeave,
  onMarkerFocus,
  onMarkerBlur,
  renderMarkerOverlay,
}: GoalMouthShotLayerProps) {
  const plottableShots = shots.filter(hasGoalMouthLocation);

  if (plottableShots.length === 0) {
    return null;
  }

  return (
    <g data-campos="goalmouth-shot-layer" aria-hidden="true">
      {plottableShots.map((shot) => {
        const context: GoalMouthShotLayerStyleContext = { shot };
        if (resolveStyleValue(markers?.show, context) === false) {
          return null;
        }

        const point = project(shot.goalMouthY!, shot.goalMouthZ!);
        const shape = resolveStyleValue(markers?.shape, context) ?? defaultShape(shot);
        const size = resolveStyleValue(markers?.size, context) ?? 0.16;
        const fill = resolveStyleValue(markers?.fill, context) ?? defaultFill(shot);
        const fillOpacity = resolveStyleValue(markers?.fillOpacity, context);
        const stroke = resolveStyleValue(markers?.stroke, context);
        const strokeWidth = resolveStyleValue(markers?.strokeWidth, context);
        const opacity = resolveStyleValue(markers?.opacity, context);
        const title = markerTitle?.(shot);

        return (
          <g
            key={shot.id}
            data-campos-shot-id={shot.id}
            {...(onMarkerMouseEnter != null
              ? {
                  onMouseEnter: (event: MouseEvent<SVGGElement>) => {
                    onMarkerMouseEnter(event, shot);
                  },
                }
              : {})}
            {...(onMarkerMouseLeave != null ? { onMouseLeave: onMarkerMouseLeave } : {})}
            {...(onMarkerFocus != null
              ? {
                  onFocus: (event: FocusEvent<SVGGElement>) => {
                    onMarkerFocus(event, shot);
                  },
                }
              : {})}
            {...(onMarkerBlur != null ? { onBlur: onMarkerBlur } : {})}
            {...(onMarkerMouseEnter != null || onMarkerFocus != null
              ? { style: { cursor: "pointer" } }
              : {})}
          >
            {title ? <title>{title}</title> : null}
            <ChartPointMark
              cx={point.x}
              cy={point.y}
              r={size}
              shape={shape}
              fill={fill}
              {...(fillOpacity != null ? { fillOpacity } : {})}
              {...(stroke != null ? { stroke } : {})}
              {...(strokeWidth != null ? { strokeWidth } : {})}
              {...(opacity != null ? { opacity } : {})}
            />
            {renderMarkerOverlay?.(shot)}
          </g>
        );
      })}
    </g>
  );
}
