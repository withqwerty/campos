import { useState } from "react";

import type { ProjectFn } from "@withqwerty/campos-stadia";

import {
  buildFreezeFrameScene,
  type EventFreezeFrame,
  type FreezeFramePoint,
} from "../compute/freeze-frame-overlay.js";
import { useTheme } from "../ThemeContext.js";
import { ChartPointMark } from "./ChartPointMark.js";

export type FreezeFrameOverlayProps = {
  /** Event-relative participant roles and optional camera-visible polygon. */
  frame: EventFreezeFrame;
  project: ProjectFn;
  participantRadius?: number;
  teammateColor?: string;
  opponentColor?: string;
  actorRingColor?: string;
  visibleAreaColor?: string;
  testId?: string;
};

function projectPolygon(points: readonly FreezeFramePoint[], project: ProjectFn): string {
  return points
    .map((point) => {
      const projected = project(point.x, point.y);
      return `${projected.x},${projected.y}`;
    })
    .join(" ");
}

/**
 * Render an event-linked positional freeze frame inside a Stadia `Pitch`.
 *
 * It visualises provider-declared teammate/opponent, actor, goalkeeper, and
 * camera-area semantics only. It does not infer player identity, possession,
 * pressure, or pitch control.
 */
export function FreezeFrameOverlay({
  frame,
  project,
  participantRadius = 1.9,
  teammateColor,
  opponentColor,
  actorRingColor,
  visibleAreaColor,
  testId,
}: FreezeFrameOverlayProps) {
  const theme = useTheme();
  const scene = buildFreezeFrameScene(frame);
  const [focusedParticipantId, setFocusedParticipantId] = useState<string | null>(null);
  const colors = {
    teammate: teammateColor ?? theme.accent.blue,
    opponent: opponentColor ?? theme.accent.red,
    actorRing: actorRingColor ?? theme.accent.yellow,
    visibleArea: visibleAreaColor ?? theme.accent.purple,
  };

  return (
    <g
      {...(testId != null ? { "data-testid": testId } : {})}
      role="group"
      aria-label={scene.accessibleLabel}
    >
      {scene.visibleArea != null ? (
        <polygon
          data-testid="freeze-frame-visible-area"
          points={projectPolygon(scene.visibleArea, project)}
          fill={colors.visibleArea}
          fillOpacity={0.1}
          stroke={colors.visibleArea}
          strokeOpacity={0.62}
          strokeWidth={0.35}
          strokeDasharray="1.2 0.9"
          pointerEvents="none"
          aria-hidden="true"
        />
      ) : null}
      {scene.participants.map((participant) => {
        const point = project(participant.x, participant.y);
        const isFocused = focusedParticipantId === participant.id;
        const color = colors[participant.side];
        const radius = participant.isActor ? participantRadius * 1.16 : participantRadius;
        const stroke = isFocused
          ? theme.focus.ring
          : participant.isActor
            ? colors.actorRing
            : theme.contrast.halo.onLight;
        const strokeWidth = isFocused
          ? theme.focus.width * 0.35
          : participant.isActor
            ? 0.72
            : 0.35;
        return (
          <g
            key={participant.id}
            role="img"
            tabIndex={0}
            aria-label={participant.ariaLabel}
            data-active={isFocused || undefined}
            data-role={
              participant.isActor ? "actor" : participant.isKeeper ? "keeper" : "player"
            }
            onFocus={() => {
              setFocusedParticipantId(participant.id);
            }}
            onBlur={() => {
              setFocusedParticipantId((current) =>
                current === participant.id ? null : current,
              );
            }}
          >
            <ChartPointMark
              cx={point.x}
              cy={point.y}
              r={radius}
              shape={participant.isKeeper ? "square" : "circle"}
              {...(participant.isKeeper ? { cornerRadius: radius * 0.28 } : {})}
              fill={color}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </g>
        );
      })}
      {scene.emptyMessage ? <title>{scene.emptyMessage}</title> : null}
    </g>
  );
}
