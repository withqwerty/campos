import { createElement, type ReactElement, type ReactNode } from "react";

import type { FormationPlayer } from "../compute/index.js";

import type { FormationMarkerPreset, MarkerSlotContent } from "../Formation.js";
import { CountBadge } from "./CountBadge.js";
import { MarkerBadge } from "./MarkerBadge.js";
import { MarkerIcon } from "./MarkerIcon.js";
import { MarkerPill } from "./MarkerPill.js";
import {
  DEFAULT_RATING_COLORS,
  DEFAULT_RATING_THRESHOLDS,
  RatingPill,
} from "./PlayerBadges.js";
import { FootballFillIcon, BootFillIcon, ArrowDownIcon } from "./markerAssetIcons.js";
import type { MarkerSlotName } from "./markerLayout.js";
import { registerCellSize } from "./measureProtocol.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Badge disc diameter as a fraction of the marker radius. */
const BADGE_SIZE = 0.75;
/** Icon size inside a badge (fraction of badge diameter). */
const ICON_SCALE = 0.78;
/** Captain icon size — 2x the previous value for visibility. */
const CAPTAIN_R_SCALE = 0.9;

/**
 * Wrap content in a tight circular white badge with dark outline.
 */
function badge(
  r: number,
  children: ReactNode,
  opts?: { fill?: string; testId?: string },
): ReactElement {
  return createElement(
    MarkerBadge,
    {
      size: r * BADGE_SIZE,
      ...(opts?.fill != null ? { fill: opts.fill } : {}),
      ...(opts?.testId != null ? { testId: opts.testId } : {}),
    },
    children,
  );
}

// ---------------------------------------------------------------------------
// Sub indicator: raw sub icon + minute text stacked above (no badge wrapper)
// ---------------------------------------------------------------------------

/**
 * Sub indicator rendered as a raw sub icon at the slot position with
 * the minute text floating above it. No badge/chip wrapper — sits
 * directly on the marker like the captain badge.
 */
type SubIndicatorProps = {
  player: FormationPlayer;
  r: number;
};

function maybeSubIndicator(player: FormationPlayer, r: number): ReactElement | null {
  if (player.subMinute == null && player.substituted !== true) return null;
  return createElement(SubIndicator, { player, r });
}

function SubIndicator({ player, r }: SubIndicatorProps): ReactElement | null {
  if (player.subMinute == null && player.substituted !== true) return null;
  const subIconR = r * 0.75;
  const hasMinute = player.subMinute != null;
  const textSize = r * 0.5;
  const chipW = textSize * 2.4;
  const chipH = textSize * 1.4;
  // SubstitutionBadge internally uses badgeRadius = r * 0.55; the arrow tips
  // reach (0.45 + 0.62) × badgeRadius ≈ r * 0.59 above centre.
  const arrowVisualTop = subIconR * 0.55 * (0.45 + 0.62);
  const textY = -(arrowVisualTop + chipH / 2 + r * 0.02);

  return createElement(
    "g",
    { "data-testid": "formation-sub-minute" },
    createElement(MarkerIcon, { kind: "sub", r: subIconR }),
    hasMinute
      ? createElement(
          "g",
          null,
          createElement("rect", {
            x: -(chipW / 2),
            y: textY - chipH / 2,
            width: chipW,
            height: chipH,
            rx: chipH / 2,
            fill: "#ffffff",
            stroke: "#1a202c",
            strokeWidth: 0.3,
          }),
          createElement("text", {
            x: 0,
            y: textY,
            fill: "#1a202c",
            fontSize: textSize,
            fontWeight: 700,
            textAnchor: "middle",
            dominantBaseline: "central",
            pointerEvents: "none",
            style: { userSelect: "none" },
            children: `${player.subMinute}'`,
          }),
        )
      : null,
  );
}

// Register cell size for the sub indicator (icon + text stack)
registerCellSize(SubIndicator, (props, r) => ({
  cellWidth: r * 1.5,
  cellHeight:
    props.player != null &&
    typeof props.player === "object" &&
    "subMinute" in props.player
      ? r * 2.0
      : r * 1.2,
}));

// ---------------------------------------------------------------------------
// Card badge (shaped card in white disc)
// ---------------------------------------------------------------------------

function cardBadge(player: FormationPlayer, r: number): ReactElement | null {
  if (player.redCard === true) {
    return badge(
      r,
      createElement(MarkerIcon, {
        kind: "red-card",
        r: r * BADGE_SIZE * ICON_SCALE,
      }),
    );
  }
  if (player.yellowCard === true) {
    return badge(
      r,
      createElement(MarkerIcon, {
        kind: "yellow-card",
        r: r * BADGE_SIZE * ICON_SCALE,
      }),
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Goal/assist stacked badges (broadcast/matchEvents)
// White-filled icons with dark outlines for visibility on white badges.
// ---------------------------------------------------------------------------

function statBadges(
  player: FormationPlayer,
  r: number,
  field: "goals" | "assists",
): ReactNode[] | null {
  const n = player[field] ?? 0;
  if (n <= 0) return null;

  const iconKind = field === "goals" ? "goal" : "assist";
  const iconR = r * BADGE_SIZE * ICON_SCALE;
  const badgeSize = r * BADGE_SIZE;

  if (n > 3) {
    const textSize = badgeSize * 0.45;
    return [
      badge(
        r,
        createElement(
          "g",
          { key: `${field}-collapsed` },
          createElement(MarkerIcon, {
            kind: iconKind,
            r: iconR * 0.6,
            color: "#1a202c",
          }),
          createElement("text", {
            x: iconR * 0.5,
            y: iconR * 0.35,
            fill: "#1a202c",
            fontSize: textSize,
            fontWeight: 700,
            textAnchor: "middle",
            dominantBaseline: "central",
            pointerEvents: "none",
            style: { userSelect: "none" },
            children: `×${n}`,
          }),
        ),
        { testId: `formation-${field}-badge-0` },
      ),
    ];
  }

  const overlapFactor = n === 1 ? 1.0 : n === 2 ? 0.55 : 0.4;
  return Array.from({ length: n }, (_, i) => {
    const b = badge(
      r,
      createElement(MarkerIcon, {
        kind: iconKind,
        r: iconR,
        color: "#1a202c",
        key: `${field[0]}i-${i}`,
      }),
      { testId: `formation-${field}-badge-${i}` },
    );
    return createElement(OverlapBadge, {
      key: `${field}-${i}`,
      cellWidth: badgeSize * overlapFactor,
      cellHeight: badgeSize,
      children: b,
    });
  });
}

function OverlapBadge({
  children,
}: {
  cellWidth: number;
  cellHeight: number;
  children: ReactNode;
}): ReactElement {
  return createElement("g", null, children);
}

registerCellSize(OverlapBadge, (props) => ({
  cellWidth: (props as { cellWidth: number }).cellWidth,
  cellHeight: (props as { cellHeight: number }).cellHeight,
}));

function goalBadges(player: FormationPlayer, r: number): ReactNode[] | null {
  return statBadges(player, r, "goals");
}

function assistBadges(player: FormationPlayer, r: number): ReactNode[] | null {
  return statBadges(player, r, "assists");
}

// ---------------------------------------------------------------------------
// CountBadge helpers (LiveScore/SofaScore — icon + count pip)
// White icon fill for visibility against white badge.
// ---------------------------------------------------------------------------

const ASSET_ICON_SIZE = BADGE_SIZE * ICON_SCALE;

function goalCountBadge(player: FormationPlayer, r: number): ReactElement | null {
  const n = player.goals ?? 0;
  if (n <= 0) return null;
  return createElement(CountBadge, {
    r,
    count: n,
    icon: createElement(FootballFillIcon, {
      size: r * ASSET_ICON_SIZE,
      color: "#1a202c",
      strokeColor: "#1a202c",
      strokeWidth: Math.max(r * 0.15, 0.3),
    }),
    testId: "formation-goals-count",
  });
}

function assistCountBadge(player: FormationPlayer, r: number): ReactElement | null {
  const n = player.assists ?? 0;
  if (n <= 0) return null;
  return createElement(CountBadge, {
    r,
    count: n,
    icon: createElement(BootFillIcon, {
      size: r * ASSET_ICON_SIZE,
      color: "#1a202c",
      strokeColor: "#1a202c",
      strokeWidth: Math.max(r * 0.15, 0.3),
    }),
    testId: "formation-assists-count",
  });
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// LiveScore card rect — small rounded rectangle, like a physical card
// ---------------------------------------------------------------------------

type LiveScoreCardProps = {
  r: number;
  color: string;
};

function LiveScoreCard({ r, color }: LiveScoreCardProps): ReactElement {
  const w = r * 0.52;
  const h = r * 0.72;
  return createElement("rect", {
    x: -(w / 2),
    y: -(h / 2),
    width: w,
    height: h,
    rx: r * 0.06,
    ry: r * 0.06,
    fill: color,
    stroke: "#1a202c",
    strokeWidth: Math.max(r * 0.04, 0.08),
  });
}

registerCellSize(LiveScoreCard, (props) => {
  const { r } = props as LiveScoreCardProps;
  return {
    cellWidth: r * 0.52,
    cellHeight: r * 0.72,
  };
});

function liveScoreCard(r: number, color: string): ReactElement {
  return createElement(LiveScoreCard, { r, color });
}

// ---------------------------------------------------------------------------
// LiveScore sub-off indicator — red downward arrow asset
// ---------------------------------------------------------------------------

type LiveScoreSubOffProps = {
  r: number;
};

function LiveScoreSubOff({ r }: LiveScoreSubOffProps): ReactElement {
  return createElement(ArrowDownIcon, {
    size: r * 0.7,
    color: "#ef4444",
    strokeColor: "#1a202c",
    strokeWidth: 0,
  });
}

registerCellSize(LiveScoreSubOff, (props) => {
  const { r } = props as LiveScoreSubOffProps;
  const size = r * 0.7;
  return {
    cellWidth: size,
    cellHeight: size,
  };
});

function liveScoreSubOff(r: number): ReactElement {
  return createElement(LiveScoreSubOff, { r });
}

// ---------------------------------------------------------------------------
// Rating colour helper
// ---------------------------------------------------------------------------

function ratingColor(rating: number | undefined): string {
  if (rating == null) return "#1a202c";
  if (rating >= DEFAULT_RATING_THRESHOLDS.highMin) return DEFAULT_RATING_COLORS.high;
  if (rating >= DEFAULT_RATING_THRESHOLDS.midMin) return DEFAULT_RATING_COLORS.mid;
  return DEFAULT_RATING_COLORS.low;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const formationMarkerPresets = {
  // =========================================================================
  // FOTMOB — FotMob/DAZN post-match style
  // =========================================================================
  fotmob: (): FormationMarkerPreset => ({
    markerComposition: {
      glyph: "photo",
      slots: ({ player, r }) => {
        const map: Partial<Record<MarkerSlotName, MarkerSlotContent>> = {};

        const sub = maybeSubIndicator(player, r);
        if (sub != null) map.topLeft = sub;

        if (player.rating != null) {
          map.topRight = createElement(RatingPill, { r, rating: player.rating });
        }

        const card = cardBadge(player, r);
        if (card != null) map.left = card;

        const goals = goalBadges(player, r);
        if (goals != null) map.bottomRight = goals;

        const assists = assistBadges(player, r);
        if (assists != null) map.bottomLeft = assists;

        return map;
      },
    },
    markerBadges: {
      prefix: ({ player, r }) =>
        player.captain === true
          ? createElement(MarkerIcon, { kind: "captain", r: r * CAPTAIN_R_SCALE })
          : null,
    },
  }),

  // =========================================================================
  // MATCH EVENTS — circle glyph, same layout as broadcast
  // =========================================================================
  // DEFAULT — primary format, circle glyph + full event decoration
  // =========================================================================
  default: (): FormationMarkerPreset => ({
    markerComposition: {
      glyph: "circle",
      slots: ({ player, r }) => {
        const map: Partial<Record<MarkerSlotName, MarkerSlotContent>> = {};

        const sub = maybeSubIndicator(player, r);
        if (sub != null) {
          map.topLeft = sub;
        } else if (player.captain === true) {
          map.topLeft = createElement(MarkerIcon, {
            kind: "captain",
            r: r * CAPTAIN_R_SCALE,
          });
        }

        if (player.rating != null) {
          map.topRight = createElement(RatingPill, { r, rating: player.rating });
        }

        const card = cardBadge(player, r);
        if (card != null) map.left = card;

        const goals = goalBadges(player, r);
        if (goals != null) map.bottomRight = goals;

        const assists = assistBadges(player, r);
        if (assists != null) map.bottomLeft = assists;

        return map;
      },
    },
  }),

  // =========================================================================
  // MINIMAL — dual-team broadcast cards
  // =========================================================================
  minimal: (): FormationMarkerPreset => ({
    markerComposition: {
      glyph: "circle",
      slots: ({ player, r }) => {
        const map: Partial<Record<MarkerSlotName, MarkerSlotContent>> = {};

        const sub = maybeSubIndicator(player, r);
        if (sub != null) {
          map.topLeft = sub;
        } else if (player.captain === true) {
          map.topLeft = createElement(MarkerIcon, {
            kind: "captain",
            r: r * CAPTAIN_R_SCALE,
          });
        }

        const card = cardBadge(player, r);
        if (card != null) map.left = card;

        return map;
      },
    },
  }),

  // =========================================================================
  // STATS — scouting card (shirt glyph + flag SVGs)
  // =========================================================================
  stats: (): FormationMarkerPreset => ({
    markerComposition: {
      glyph: "shirt",
      slots: ({ player, r }) => {
        const map: Partial<Record<MarkerSlotName, MarkerSlotContent>> = {};

        // topLeft: flag (circular SVG via FIFA code, text pill fallback)
        if (player.nationality != null) {
          map.topLeft = createElement(MarkerIcon, {
            kind: "flag",
            r,
            label: player.nationality,
          });
        }

        if (player.age != null) {
          map.topRight = createElement(MarkerPill, { r, text: player.age });
        }

        const bottomStack: ReactNode[] = [];
        if (player.transferValue != null) {
          bottomStack.push(
            createElement(MarkerPill, {
              r,
              text: player.transferValue,
              key: "value",
            }),
          );
        }
        if (bottomStack.length > 0) map.bottom = bottomStack;

        return map;
      },
    },
  }),

  // =========================================================================
  // LIVESCORE — clean numbered circles, goals top-left, cards top-right,
  //             sub-off chevron bottom-right
  // =========================================================================
  livescore: (): FormationMarkerPreset => ({
    markerComposition: {
      glyph: "circle",
      slots: ({ player, r }) => {
        const map: Partial<Record<MarkerSlotName, MarkerSlotContent>> = {};

        const goals = goalCountBadge(player, r);
        if (goals != null) map.topLeft = goals;

        if (player.redCard === true) {
          map.topRight = liveScoreCard(r, "#dc2626");
        } else if (player.yellowCard === true) {
          map.topRight = liveScoreCard(r, "#facc15");
        }

        if (player.substituted === true || player.subMinute != null) {
          map.bottomRight = liveScoreSubOff(r);
        }

        return map;
      },
    },
  }),

  // =========================================================================
  // SOFASCORE — rating-graded photo border, number+name format
  // =========================================================================
  sofascore: (): FormationMarkerPreset => ({
    markers: {
      stroke: ({ player }) => ratingColor(player.rating),
      strokeWidth: ({ r }) => Math.max(r * 0.14, 0.35),
    },
    markerLabels: {
      nameFormat: (player) => {
        const parts: string[] = [];
        if (player.number != null) parts.push(String(player.number));
        if (player.captain === true) parts.push("(c)");
        if (player.label != null) parts.push(player.label);
        return parts.length > 0 ? parts.join(" ") : null;
      },
    },
    markerComposition: {
      glyph: "photo",
      slots: ({ player, r }) => {
        const map: Partial<Record<MarkerSlotName, MarkerSlotContent>> = {};

        // topLeft: card rect inside white chip
        if (player.redCard === true) {
          map.topLeft = badge(r, liveScoreCard(r, "#dc2626"));
        } else if (player.yellowCard === true) {
          map.topLeft = badge(r, liveScoreCard(r, "#facc15"));
        }

        // topRight: goals
        const goals = goalCountBadge(player, r);
        if (goals != null) map.topRight = goals;

        // left: sub arrows, no minute
        if (player.substituted === true || player.subMinute != null) {
          map.left = createElement(MarkerIcon, { kind: "sub", r: r * 0.75 });
        }

        // right: assists
        const assists = assistCountBadge(player, r);
        if (assists != null) map.right = assists;

        // bottom: rating pill
        if (player.rating != null) {
          map.bottom = createElement(RatingPill, { r, rating: player.rating });
        }

        // bottomLeft: MOTM star
        if (player.motm === true) {
          map.bottomLeft = createElement(MarkerIcon, { kind: "star", r: r * 0.4 });
        }

        return map;
      },
    },
  }),

  // =========================================================================
  // FLASHSCORE — photo, rating bottom-right, left stack: goals/cards/sub
  // =========================================================================
  flashscore: (): FormationMarkerPreset => ({
    markerLabels: {
      nameFormat: (player) => {
        const parts: string[] = [];
        if (player.number != null) parts.push(String(player.number));
        if (player.label != null) parts.push(player.label);
        return parts.length > 0 ? parts.join(" ") : null;
      },
    },
    markerComposition: {
      glyph: "photo-cutout",
      slots: ({ player, r }) => {
        const map: Partial<Record<MarkerSlotName, MarkerSlotContent>> = {};

        // Rating floats to the bottom-right
        if (player.rating != null) {
          map.bottomRight = createElement(RatingPill, { r, rating: player.rating });
        }

        // Left vertical stack (bottom → top): sub, card, goals
        const goals = goalCountBadge(player, r);
        if (goals != null) map.topLeft = goals;

        const card = cardBadge(player, r);
        if (card != null) map.left = card;

        if (player.substituted === true || player.subMinute != null) {
          map.bottomLeft = createElement(MarkerIcon, {
            kind: "sub",
            r: r * 0.75,
          });
        }

        return map;
      },
    },
  }),
} as const;
