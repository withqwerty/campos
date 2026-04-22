import type { CSSProperties, ReactElement } from "react";

import type { FormationPlayer } from "../compute/index.js";

import { MarkerIcon } from "./MarkerIcon.js";

/**
 * Where the bench sits relative to its partner Pitch.
 *
 * - `"left"` / `"right"` — render as a narrow vertical column beside a
 *   vertical pitch.
 * - `"top"` / `"bottom"` — render as a shallow horizontal row above or
 *   below a horizontal pitch.
 *
 * For dual-team layouts the placement is picked automatically from the
 * pitch orientation (see the `Formation` dual-team branch), so most
 * consumers only set this for single-team mode.
 */
export type SubstitutesBenchPlacement = "left" | "right" | "top" | "bottom";

export type SubstitutesBenchProps = {
  /** Players on the bench. Renders each as a compact row or column entry. */
  players: FormationPlayer[];
  /** Placement relative to the pitch. See {@link SubstitutesBenchPlacement}. */
  placement: SubstitutesBenchPlacement;
  /** Fill colour for each bench marker disc. */
  teamColor: string;
  /** Optional heading (e.g. "Substitutes" or the team name). */
  label?: string;
  /**
   * Extra style overrides applied to the outer container. Use for width
   * constraints on corner placements; the component ships a sensible
   * default (~160px for vertical strips, full-width for horizontal).
   */
  style?: CSSProperties;
};

/**
 * HTML-based substitutes bench rendered alongside the pitch.
 *
 * Each bench entry is a compact row: a small coloured disc with the
 * shirt number, followed by the player's name, with the same shared
 * badge primitives (card, substitution) that the main pitch uses. The
 * entries use HTML/flex rather than SVG so wrapping, overflow and
 * typography inherit from the surrounding document — bench rendering
 * isn't inherently geometric, and forcing it into the pitch SVG would
 * fight both the Pitch viewBox clipping and the natural text wrapping
 * callers expect from a subs panel.
 *
 * Design note: the bench does NOT reuse `FormationMarker` because that
 * component is tied to a Pitch projection. Bench entries sit in plain
 * HTML flow, so they get their own lightweight renderer here. The
 * shared `PlayerStatusBadges` primitive is rendered inside a tiny SVG
 * per entry so cards / sub arrows keep visual parity with the pitch
 * markers.
 */
export function SubstitutesBench({
  players,
  placement,
  teamColor,
  label = "Substitutes",
  style,
}: SubstitutesBenchProps): ReactElement | null {
  if (players.length === 0) return null;

  const isVerticalStrip = placement === "left" || placement === "right";

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: isVerticalStrip ? "column" : "row",
    gap: isVerticalStrip ? 6 : 10,
    alignItems: isVerticalStrip ? "stretch" : "center",
    flexWrap: isVerticalStrip ? "nowrap" : "wrap",
    // Vertical strips cap width so names don't stretch arbitrarily.
    // Horizontal strips take the container width and wrap.
    ...(isVerticalStrip ? { minWidth: 140, maxWidth: 200 } : { width: "100%" }),
    padding: "8px 10px",
    fontSize: 12,
    fontFamily: "inherit",
    color: "inherit",
    ...style,
  };

  return (
    <aside
      data-testid="formation-subs-bench"
      data-placement={placement}
      aria-label={label}
      style={containerStyle}
    >
      {label ? (
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            opacity: 0.7,
            ...(isVerticalStrip ? {} : { width: "100%", marginBottom: 2 }),
          }}
        >
          {label}
        </div>
      ) : null}
      {players.map((player, i) => (
        <SubstituteRow
          key={player.playerId ?? player.slot ?? `sub-${i}`}
          player={player}
          teamColor={teamColor}
        />
      ))}
    </aside>
  );
}

type SubstituteRowProps = {
  player: FormationPlayer;
  teamColor: string;
};

function SubstituteRow({ player, teamColor }: SubstituteRowProps): ReactElement {
  const number = player.number;
  const name = player.label ?? player.positionCode ?? "";
  const color = player.color ?? teamColor;
  // Small SVG viewport for the marker disc + any status badges.
  // The disc radius is fixed in px terms because benches are rendered
  // outside the pitch and don't need to scale with a pitch projection.
  // viewSize must be wide enough to fit the sub icon — its cell extent
  // is `markerR * 1.2` centred at the corner anchor, so the icon's
  // outer edge sits at `markerR * 0.85 + markerR * 0.6 = markerR * 1.45`
  // from the centre, plus a stroke. `markerR * 3.6` (half-extent
  // `markerR * 1.8`) gives clear breathing room for the stroke.
  const markerR = 11;
  const viewSize = markerR * 3.6;

  return (
    <div
      data-testid="formation-subs-bench-entry"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
      }}
    >
      <svg
        width={viewSize}
        height={viewSize}
        viewBox={`${-viewSize / 2} ${-viewSize / 2} ${viewSize} ${viewSize}`}
        aria-hidden="true"
        style={{ flex: "0 0 auto" }}
      >
        <circle r={markerR} fill={color} stroke="#1a202c" strokeWidth={1} />
        {number != null ? (
          <text
            x={0}
            y={0}
            fill="#ffffff"
            fontSize={markerR * 1.15}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="central"
            stroke="#1a202c"
            strokeWidth={0.8}
            paintOrder="stroke"
          >
            {number}
          </text>
        ) : null}
        {/* Card and substitution badges. The bench mirrors the pitch's
            corner placement convention: cards bottom-right, sub bottom-left.
            Red wins over yellow when both are set. */}
        {player.redCard === true ? (
          <g transform={`translate(${markerR * 0.85} ${markerR * 0.85})`}>
            <MarkerIcon kind="red-card" r={markerR} />
          </g>
        ) : player.yellowCard === true ? (
          <g transform={`translate(${markerR * 0.85} ${markerR * 0.85})`}>
            <MarkerIcon kind="yellow-card" r={markerR} />
          </g>
        ) : null}
        {player.substituted === true ? (
          <g transform={`translate(${-markerR * 0.85} ${markerR * 0.85})`}>
            <MarkerIcon kind="sub" r={markerR} />
          </g>
        ) : null}
      </svg>
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          lineHeight: 1.2,
        }}
      >
        <span
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontWeight: 600,
          }}
          title={name}
        >
          {name}
        </span>
        {player.positionCode && player.label ? (
          <span style={{ opacity: 0.6, fontSize: 10 }}>{player.positionCode}</span>
        ) : null}
      </span>
    </div>
  );
}
