import { Children, useMemo, type ReactNode, type CSSProperties } from "react";

import {
  createPitchProjection,
  orientationFromDirection,
  type PitchCrop,
  type AttackingDirection,
  type Orientation,
  type ProjectFn,
  type PitchSide,
} from "../transforms/pitch-transform.js";
import { computeViewBox } from "../transforms/viewbox.js";
import {
  resolvePitchPreset,
  type PitchColors,
  type PitchPreset,
  type Theme,
} from "./theme.js";
import { PitchBackground, PitchLines, PitchMarkings } from "./PitchMarkings.js";
import { TacticalMarkings, type ZoneLayout } from "./TacticalMarkings.js";
import type { GrassPattern } from "./grass.js";

/** Optional tactical overlays rendered above the regulation pitch lines. */
export type PitchMarkingsConfig = {
  /** Draw the two half-space channel boundaries. */
  halfSpaces?: boolean;
  /** Draw thirds across the pitch length. */
  thirds?: boolean;
  /** Draw an 18-zone equal grid or a 20-zone positional-play grid. */
  zones?: ZoneLayout;
};

/**
 * Extra viewBox breathing room, expressed as a percentage of the reference pitch width.
 * Use this when marks near touchlines or goal lines would otherwise be clipped.
 */
export type PitchPadding =
  | number
  | { top: number; right: number; bottom: number; left: number };

export type PitchProps = {
  /**
   * Visible pitch surface. Projection still maps the full Campos 0..100 pitch;
   * the crop only changes the SVG viewport and rendered markings.
   */
  crop: PitchCrop;
  /**
   * The direction the attacker is facing. Controls both the pitch layout
   * (horizontal if "left"/"right", vertical if "up"/"down") and the side of
   * the screen the attacking goal appears on. Defaults to `"up"`.
   */
  attackingDirection?: AttackingDirection;
  /**
   * Visible end for cropped surfaces. `attack` is the end the attacker is
   * attacking (so its visual location depends on `attackingDirection`);
   * `defend` is the defensive end. Ignored for `crop="full"`.
   */
  side?: PitchSide;
  /**
   * Outer SVG frame. `crop` sizes the SVG to the visible crop; `full` keeps a
   * full-pitch frame and clips the selected crop inside it.
   */
  frame?: "crop" | "full";
  /**
   * High-level pitch look. Defaults to `outline` (white pitch, dark lines —
   * publishable for editorial / docs). Other options: `green` (broadcast
   * green) and `dark` (slate). Bundles theme + colors in one prop;
   * `theme` and `colors` win over the preset when supplied.
   */
  preset?: PitchPreset;
  /**
   * Lower-level theme switch used by some chart shorthands. `primary` ↔ light
   * theme family; `secondary` ↔ dark theme family. Most consumers should use
   * `preset` instead.
   */
  theme?: Theme;
  /** Tactical overlays for half-spaces, thirds, and zone-grid review views. */
  markings?: PitchMarkingsConfig;
  /**
   * Per-color overrides applied after the selected theme. Use this for team,
   * export, or high-contrast surfaces without changing geometry.
   */
  colors?: PitchColors;
  /** Grass mowing pattern rendered beneath the pitch markings. */
  grass?: GrassPattern | undefined;
  /**
   * Extra viewBox padding around the visible surface. Numeric values are
   * percentages of pitch width, not meters.
   */
  padding?: PitchPadding;
  /**
   * Whether the SVG should receive pointer events. Set `false` for static
   * export snapshots or when a parent component owns all interaction.
   */
  interactive?: boolean;
  /** Optional class name applied to the outer SVG. */
  className?: string;
  /** Optional inline styles merged after Stadia's responsive SVG sizing. */
  style?: CSSProperties;
  /** Optional ARIA role applied to the outer <svg> — set to "img" for standalone chart svgs. */
  role?: string;
  /** Optional accessible label applied to the outer <svg> when it is treated as an image/chart. */
  ariaLabel?: string;
  /** Content rendered between the pitch background and the pitch lines (e.g. heatmap cells, KDE surfaces). */
  underlay?: (ctx: { project: ProjectFn }) => ReactNode;
  /**
   * Foreground SVG marks rendered above pitch lines and tactical markings.
   * The `project` callback maps Campos 0..100 pitch coordinates to SVG
   * meter-scale user units.
   */
  children: (ctx: { project: ProjectFn }) => ReactNode;
};

/**
 * The pitch markings (goal end, penalty arc, etc.) are drawn in SVG space
 * rooted at specific positions. `computePitchMarkings` knows the vertical/
 * horizontal layout via `orientation`, and which end to draw via `side`. For
 * reversed attacking directions ("left", "down") the attacker's attacking
 * half lands on the opposite side of the SVG from the default — so we flip
 * the `side` passed to the markings geometry to keep the drawn half aligned
 * with the visible viewBox.
 */
function markingsContext(direction: AttackingDirection, side: PitchSide) {
  const orientation: Orientation = orientationFromDirection(direction);
  const reversed = direction === "left" || direction === "down";
  const effectiveSide: PitchSide =
    reversed && side === "attack"
      ? "defend"
      : reversed && side === "defend"
        ? "attack"
        : side;
  return { orientation, side: effectiveSide };
}

function resolveFrameAspectRatio(
  frame: "crop" | "full",
  crop: PitchCrop,
  direction: AttackingDirection,
  side: PitchSide,
) {
  const viewBox =
    frame === "full"
      ? computeViewBox("full", direction)
      : computeViewBox(crop, direction, side);
  return `${viewBox.width} / ${viewBox.height}`;
}

export function Pitch({
  crop,
  attackingDirection = "up",
  side = "attack",
  frame = "crop",
  preset,
  theme,
  markings,
  colors: colorOverrides,
  grass,
  padding,
  interactive = true,
  className,
  style,
  role,
  ariaLabel,
  underlay,
  children,
}: PitchProps) {
  const project = useMemo(
    () => createPitchProjection(crop, attackingDirection),
    [crop, attackingDirection],
  );

  const cropViewBox = useMemo(
    () => computeViewBox(crop, attackingDirection, side, padding),
    [crop, attackingDirection, side, padding],
  );

  const frameViewBox = useMemo(
    () =>
      frame === "full"
        ? computeViewBox("full", attackingDirection, padding)
        : cropViewBox,
    [frame, attackingDirection, padding, cropViewBox],
  );

  const { colors } = useMemo(
    () => resolvePitchPreset(preset, theme, colorOverrides),
    [preset, theme, colorOverrides],
  );

  const frameAspectRatio = useMemo(
    () => resolveFrameAspectRatio(frame, crop, attackingDirection, side),
    [frame, crop, attackingDirection, side],
  );

  const { orientation: markingsOrientation, side: markingsSide } = useMemo(
    () => markingsContext(attackingDirection, side),
    [attackingDirection, side],
  );

  const frameVbString = `${frameViewBox.minX} ${frameViewBox.minY} ${frameViewBox.width} ${frameViewBox.height}`;
  const cropVbString = `${cropViewBox.minX} ${cropViewBox.minY} ${cropViewBox.width} ${cropViewBox.height}`;

  return (
    <svg
      viewBox={frameVbString}
      overflow="hidden"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      {...(role != null ? { role } : {})}
      {...(ariaLabel != null ? { "aria-label": ariaLabel } : {})}
      style={{
        width: "100%",
        aspectRatio: frameAspectRatio,
        display: "block",
        ...(interactive ? {} : { pointerEvents: "none" as const }),
        ...style,
      }}
    >
      <svg
        x={cropViewBox.minX}
        y={cropViewBox.minY}
        width={cropViewBox.width}
        height={cropViewBox.height}
        viewBox={cropVbString}
        overflow="hidden"
      >
        {underlay ? (
          <>
            <PitchBackground
              crop={crop}
              orientation={markingsOrientation}
              side={markingsSide}
              colors={colors}
              grass={grass}
            />
            {Children.toArray(underlay({ project }))}
            <PitchLines
              crop={crop}
              orientation={markingsOrientation}
              side={markingsSide}
              colors={colors}
            />
          </>
        ) : (
          <PitchMarkings
            crop={crop}
            orientation={markingsOrientation}
            side={markingsSide}
            colors={colors}
            grass={grass}
          />
        )}
        {markings && (
          <TacticalMarkings
            orientation={markingsOrientation}
            markings={markings}
            color={colors.markings}
          />
        )}
        {Children.toArray(children({ project }))}
      </svg>
    </svg>
  );
}
