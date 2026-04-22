import type { ReactElement } from "react";

import {
  CardBadge,
  DEFAULT_CARD_STYLES,
  FlagBadge,
  SubstitutionBadge,
} from "./PlayerBadges.js";
import { MARKER_ICON_CELL_SIZES, type MarkerIconKind } from "./markerLayout.js";
import {
  BootFillIcon,
  BootOutlineIcon,
  FootballFillIcon,
  FootballOutlineIcon,
} from "./markerAssetIcons.js";
import { registerCellSize } from "./measureProtocol.js";
import { StarIcon } from "./StarIcon.js";
import { DotIndicator } from "./DotIndicator.js";
import { FlagImage } from "./FlagImage.js";

/**
 * Unified kind-discriminated player-marker icon.
 *
 * `MarkerIcon` is the user-facing primitive for every small decoration
 * that can slot into a player marker's 8-position layout. It dispatches
 * to the raw shape primitives in `PlayerBadges.tsx` — cards →
 * `CardBadge`, sub → `SubstitutionBadge`, flag → `FlagBadge` — plus
 * inline shapes for captain, goal, and assist, which are simple enough
 * to render directly here.
 *
 * Every kind uses the same `r` sizing parameter and renders centred on
 * `(0, 0)` so callers can wrap the icon in any `<g transform>` and have
 * it land at the correct slot anchor.
 *
 * **Testid preservation:** existing Formation tests (and downstream
 * consumers like `SubstitutesBench`) assert on specific `data-testid`
 * values. Each dispatch target keeps the same testid the old primitive
 * used, so assertions like
 * `container.querySelector('[data-testid="formation-yellow-card"]')`
 * continue to work without changes.
 *
 * **Cell sizes:** the layout engine needs to know an icon's footprint
 * before rendering, so it can pre-compute placements. Icon sizes are
 * exposed as `MARKER_ICON_CELL_SIZES` from `./markerLayout.ts` — callers
 * that measure a slot's content width/height lookup by kind there, not
 * here. This file only renders.
 */
export type MarkerIconProps = {
  /** Which icon to render. */
  kind: MarkerIconKind;
  /** Parent marker radius in SVG user units. Every dimension scales from this. */
  r: number;
  /**
   * Optional colour override. For cards, this sets the rectangle fill;
   * for the captain badge, it sets the backing disc colour. Ignored by
   * flag/sub (those use their own compound colours via
   * {@link DEFAULT_CARD_STYLES}).
   */
  color?: string;
  /**
   * For `kind="flag"`: the nationality label (emoji / ISO code / short
   * text). Ignored by other kinds. Provided as a prop rather than
   * reading from the player because the slot composition layer is
   * responsible for the data → visual binding.
   */
  label?: string;
  /** Outline stroke colour. Defaults to the shared dark stroke. */
  strokeColor?: string;
};

export function MarkerIcon(props: MarkerIconProps): ReactElement {
  const { kind, r, color, label, strokeColor = DEFAULT_CARD_STYLES.strokeColor } = props;

  switch (kind) {
    case "yellow-card":
      return (
        <CardBadge
          r={r}
          color={color ?? DEFAULT_CARD_STYLES.yellowCardColor}
          strokeColor={strokeColor}
          testId="formation-yellow-card"
        />
      );
    case "red-card":
      return (
        <CardBadge
          r={r}
          color={color ?? DEFAULT_CARD_STYLES.redCardColor}
          strokeColor={strokeColor}
          testId="formation-red-card"
        />
      );
    case "sub":
      return <SubstitutionBadge r={r} strokeColor={strokeColor} />;
    case "flag":
      // Render circular flag SVG when a FIFA code is provided, text pill fallback otherwise.
      if (label) {
        return (
          <FlagImage
            r={r}
            src={`/flags/${label}.svg`}
            alt={label}
            strokeColor={strokeColor}
          />
        );
      }
      return <FlagBadge r={r} nationality="" strokeColor={strokeColor} />;
    case "captain":
      return (
        <CaptainIcon
          r={r}
          strokeColor={strokeColor}
          {...(color !== undefined ? { color } : {})}
        />
      );
    case "goal": {
      const size = MARKER_ICON_CELL_SIZES.goal(r);
      // strokeWidth must be in viewBox units (0-72.371). Use a fixed 1.5%
      // of the viewBox width so the outline is scale-invariant regardless of r.
      return (
        <FootballFillIcon
          size={Math.min(size.cellWidth, size.cellHeight)}
          color={color ?? "#ffffff"}
          strokeColor={strokeColor}
          strokeWidth={1.1}
        />
      );
    }
    case "goal-outline": {
      const size = MARKER_ICON_CELL_SIZES["goal-outline"](r);
      // viewBox is 480×480 for the outline variant — 1.5% ≈ 7.2 units.
      return (
        <FootballOutlineIcon
          size={Math.min(size.cellWidth, size.cellHeight)}
          color={color ?? "#ffffff"}
          strokeColor={strokeColor}
          strokeWidth={12}
        />
      );
    }
    case "assist": {
      const size = MARKER_ICON_CELL_SIZES.assist(r);
      // viewBox is 60×60 — 1.5% ≈ 0.9 units.
      return (
        <BootFillIcon
          size={Math.min(size.cellWidth, size.cellHeight)}
          color={color ?? "#ffffff"}
          strokeColor={strokeColor}
          strokeWidth={0.9}
        />
      );
    }
    case "assist-outline": {
      const size = MARKER_ICON_CELL_SIZES["assist-outline"](r);
      // Same 60×60 viewBox as the fill variant.
      return (
        <BootOutlineIcon
          size={Math.min(size.cellWidth, size.cellHeight)}
          color={color ?? "#ffffff"}
          strokeColor={strokeColor}
          strokeWidth={1.5}
        />
      );
    }
    case "star":
      return (
        <StarIcon
          r={r}
          {...(color !== undefined ? { fill: color } : {})}
          strokeColor={strokeColor}
        />
      );
    case "dot":
      return <DotIndicator r={r} color={color ?? "#facc15"} strokeColor={strokeColor} />;
    default: {
      // Exhaustiveness check — TypeScript ensures every kind is handled.
      const _exhaustive: never = kind;
      throw new Error(`Unknown MarkerIcon kind: ${_exhaustive as string}`);
    }
  }
}

// Register MarkerIcon with the cell-size measurement protocol so the
// layout engine can size it correctly without depending on reference
// equality (which breaks under React.memo, HMR, or barrel re-exports).
registerCellSize(MarkerIcon, (props, r) => {
  const kind = (props as { kind?: MarkerIconKind }).kind;
  if (kind != null && kind in MARKER_ICON_CELL_SIZES) {
    return MARKER_ICON_CELL_SIZES[kind](r);
  }
  return { cellWidth: r, cellHeight: r };
});

// ---------------------------------------------------------------------------
// Inline shapes (captain). Goal and assist icons live in
// `markerAssetIcons.tsx` and use the football/boot SVG assets directly.
// ---------------------------------------------------------------------------

/**
 * Captain "C" badge — a small yellow disc with a bold "C" inside.
 * Extracted verbatim from the old inline captain render in
 * `FormationMarker`, so the visual stays identical to pre-refactor.
 */
function CaptainIcon({
  r,
  color = "#fbbf24",
  strokeColor,
}: {
  r: number;
  color?: string;
  strokeColor: string;
}): ReactElement {
  const discR = r * 0.36;
  const fontSize = r * 0.44;
  const strokeWidth = Math.max(r * 0.05, 0.1);
  return (
    <g data-testid="formation-captain" aria-label="captain">
      <circle r={discR} fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
      <text
        x={0}
        y={0}
        fill={strokeColor}
        fontSize={fontSize}
        fontWeight={800}
        textAnchor="middle"
        dominantBaseline="central"
        pointerEvents="none"
        style={{ userSelect: "none" }}
      >
        C
      </text>
    </g>
  );
}
