import { useState } from "react";

import type { TrackingFrameSnapshot } from "@withqwerty/campos-schema";
import type { ProjectFn } from "@withqwerty/campos-stadia";

import { buildTrackingFrameScene } from "../compute/tracking-frame-overlay.js";
import { useTheme } from "../ThemeContext.js";
import { ChartPointMark } from "./ChartPointMark.js";

export type TrackingFrameOverlayProps = {
  frame: TrackingFrameSnapshot;
  project: ProjectFn;
  playerRadius?: number;
  showShirtNumbers?: boolean;
  homeColor?: string;
  awayColor?: string;
  ballColor?: string;
  testId?: string;
};

/**
 * Render one canonical absolute-pitch tracking frame inside a Stadia Pitch.
 * It intentionally draws position only: possession, pressure, and tactical
 * interpretation remain outside this primitive.
 */
export function TrackingFrameOverlay({
  frame,
  project,
  playerRadius = 1.8,
  showShirtNumbers = true,
  homeColor,
  awayColor,
  ballColor,
  testId,
}: TrackingFrameOverlayProps) {
  const theme = useTheme();
  const scene = buildTrackingFrameScene(frame);
  const [focusedMarkId, setFocusedMarkId] = useState<string | null>(null);
  const colors = {
    home: homeColor ?? theme.accent.red,
    away: awayColor ?? theme.accent.blue,
    ball: ballColor ?? theme.accent.yellow,
  };

  return (
    <g
      {...(testId != null ? { "data-testid": testId } : {})}
      role="group"
      aria-label={scene.accessibleLabel}
    >
      {scene.players.map((player) => {
        const point = project(player.x, player.y);
        const color = player.side === "home" ? colors.home : colors.away;
        const isFocused = focusedMarkId === player.playerId;
        return (
          <g
            key={player.playerId}
            role="img"
            tabIndex={0}
            aria-label={player.ariaLabel}
            data-active={isFocused || undefined}
            onFocus={() => {
              setFocusedMarkId(player.playerId);
            }}
            onBlur={() => {
              setFocusedMarkId((current) =>
                current === player.playerId ? null : current,
              );
            }}
          >
            <ChartPointMark
              cx={point.x}
              cy={point.y}
              r={playerRadius}
              fill={color}
              stroke={isFocused ? theme.focus.ring : theme.contrast.halo.onLight}
              strokeWidth={isFocused ? theme.focus.width * 0.35 : 0.35}
            />
            {showShirtNumbers && player.shirtNumber != null ? (
              <text
                x={point.x}
                y={point.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={theme.contrast.onDark}
                fontSize={1.8}
                fontWeight={700}
                pointerEvents="none"
                aria-hidden="true"
              >
                {player.shirtNumber}
              </text>
            ) : null}
          </g>
        );
      })}
      {scene.ball
        ? (() => {
            const ballMarkId = "ball";
            const point = project(scene.ball.x, scene.ball.y);
            const speed =
              scene.ball.speed == null
                ? "speed unavailable"
                : `${scene.ball.speed} speed`;
            const isFocused = focusedMarkId === ballMarkId;
            return (
              <g
                role="img"
                tabIndex={0}
                aria-label={`Ball, ${speed}`}
                data-active={isFocused || undefined}
                onFocus={() => {
                  setFocusedMarkId(ballMarkId);
                }}
                onBlur={() => {
                  setFocusedMarkId((current) =>
                    current === ballMarkId ? null : current,
                  );
                }}
              >
                <ChartPointMark
                  cx={point.x}
                  cy={point.y}
                  r={Math.max(0.8, playerRadius * 0.55)}
                  fill={colors.ball}
                  stroke={isFocused ? theme.focus.ring : theme.contrast.halo.onLight}
                  strokeWidth={isFocused ? theme.focus.width * 0.3 : 0.3}
                />
              </g>
            );
          })()
        : null}
      {scene.emptyMessage ? <title>{scene.emptyMessage}</title> : null}
    </g>
  );
}
