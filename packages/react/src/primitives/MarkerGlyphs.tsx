import type { ReactElement } from "react";

import type { FormationPlayer } from "../compute/index.js";

import { PlayerAvatar } from "./PlayerBadges.js";

/**
 * Central glyph primitives for the player marker.
 *
 * The "glyph" is the circular (or otherwise) shape at the marker origin
 * that identifies the player. The slot system composes decorations
 * AROUND the glyph; the glyph itself is swappable so users can pick:
 *
 * - `<MarkerCircle>` — the default coloured disc with jersey number /
 *   initials. This matches the pre-refactor default marker shape.
 * - `<MarkerPhoto>` — a circular clipped photo with an initials
 *   fallback. Wraps the existing `PlayerAvatar` primitive. When the
 *   photo is showing, the jersey label renders invisible for a11y
 *   and testid preservation.
 * - `<MarkerShirt>` — a simple t-shirt silhouette for broadcast-style
 *   lineup cards. Basic shape; can be replaced with a more refined
 *   kit-design path later.
 *
 * All three receive a unified `MarkerGlyphContext` so a single
 * `glyph` prop on `Formation` can switch between them without
 * changing the FormationMarker internals.
 */

export type MarkerGlyphContext = {
  /** Marker radius in SVG user units. */
  r: number;
  /** Primary fill colour (team colour or per-player override). */
  teamColor: string;
  /** Jersey number or initials to render inside the glyph. */
  label: string;
  /** Whether the jersey label should be visible. Respects `Formation.showLabels`. */
  labelVisible: boolean;
  /** Outline stroke colour. Shared across all glyph presets. */
  strokeColor: string;
  /** Outline stroke width. When undefined each glyph uses its own default. */
  strokeWidth?: number | undefined;
  /** The player data this marker represents. Glyphs can read `photo`, etc. */
  player: FormationPlayer;
  /** Font size used for the jersey label. Matches the scale bundle. */
  labelFontSize: number;
  /** Label stroke width for the outlined text effect. */
  labelStrokeWidth: number;
};

/**
 * Default glyph — a coloured circle with a jersey/initials label inside.
 * Visually identical to the pre-refactor `FormationMarker` body, just
 * extracted into a primitive so the `glyph` prop can swap it out.
 */
/**
 * Internal helper for the jersey label rendered inside `MarkerCircle` and
 * `MarkerShirt`. Renders the visible centred text when `labelVisible`
 * is true, otherwise an opacity-0 element so test selectors and a11y
 * tooling can still find `formation-marker-label` in the DOM. Extracted
 * to remove the duplicated visible/invisible branch in both glyphs.
 */
function GlyphLabel({
  label,
  labelVisible,
  labelFontSize,
  strokeColor,
  labelStrokeWidth,
  y = 0,
}: {
  label: string;
  labelVisible: boolean;
  labelFontSize: number;
  strokeColor: string;
  labelStrokeWidth: number;
  y?: number;
}): ReactElement {
  if (!labelVisible) {
    return (
      <text
        data-testid="formation-marker-label"
        x={0}
        y={0}
        fontSize={labelFontSize}
        opacity={0}
        pointerEvents="none"
      >
        {label}
      </text>
    );
  }
  return (
    <text
      data-testid="formation-marker-label"
      x={0}
      y={y}
      fill="#ffffff"
      fontSize={labelFontSize}
      fontWeight={700}
      textAnchor="middle"
      dominantBaseline="central"
      stroke={strokeColor}
      strokeWidth={labelStrokeWidth}
      paintOrder="stroke"
      pointerEvents="none"
      style={{ userSelect: "none" }}
    >
      {label}
    </text>
  );
}

export function MarkerCircle(ctx: MarkerGlyphContext): ReactElement {
  const {
    r,
    teamColor,
    label,
    labelVisible,
    strokeColor,
    labelFontSize,
    labelStrokeWidth,
  } = ctx;
  return (
    <g data-testid="formation-marker-glyph" data-glyph-kind="circle">
      <circle r={r} fill={teamColor} stroke={strokeColor} strokeWidth={0.3} />
      <GlyphLabel
        label={label}
        labelVisible={labelVisible}
        labelFontSize={labelFontSize}
        strokeColor={strokeColor}
        labelStrokeWidth={labelStrokeWidth}
      />
    </g>
  );
}

/**
 * Photo glyph — circular clipped photo with initials fallback. Wraps
 * {@link PlayerAvatar} so the image loading, clip-path, and initials
 * logic stays in one place.
 *
 * The jersey label is still rendered, but at `opacity=0` so the photo
 * stays the visual focus while existing tests and a11y tooling can
 * still find the `formation-marker-label` element in the DOM.
 *
 * When the player has no `photo` URL the avatar renders its initials
 * fallback automatically — the glyph doesn't need to fall back to a
 * different primitive.
 */
export function MarkerPhoto(ctx: MarkerGlyphContext): ReactElement {
  const { r, teamColor, label, strokeColor, strokeWidth, player, labelFontSize } = ctx;
  // photoAlt fallback chain: explicit player.photoAlt → player.label →
  // a constructed "player N" string. Using `label` (jersey number) alone
  // produces an unhelpful "image: 7" in the a11y tree when no name is set.
  const photoAlt =
    player.photoAlt ??
    player.label ??
    (player.number != null ? `player ${player.number}` : `player`);

  return (
    <g data-testid="formation-marker-glyph" data-glyph-kind="photo">
      <PlayerAvatar
        r={r}
        photoUrl={player.photo}
        label={photoAlt}
        fallbackColor={teamColor}
        strokeColor={strokeColor}
        {...(strokeWidth != null ? { strokeWidth } : {})}
      />
      {/* Keep the jersey label in the DOM for tests + a11y, but invisible. */}
      <text
        data-testid="formation-marker-label"
        x={0}
        y={0}
        fontSize={labelFontSize}
        opacity={0}
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Shirt glyph — a simple t-shirt silhouette for broadcast-style cards.
 * The shape is built from a single SVG path with a rounded collar and
 * short sleeves, centred on `(0, 0)` and sized by the marker radius.
 *
 * This is a v1 shape: readable and recognisable as a shirt, but not
 * kit-design quality. A follow-up can replace the path with a refined
 * silhouette without changing the glyph API.
 */
export function MarkerShirt(ctx: MarkerGlyphContext): ReactElement {
  const {
    r,
    teamColor,
    label,
    labelVisible,
    strokeColor,
    labelFontSize,
    labelStrokeWidth,
  } = ctx;

  // Shirt geometry, all in units of r so the silhouette scales with the
  // marker radius. Values tuned by eye to read as a shirt at SCALE_FULL
  // down to SCALE_DUAL.
  const shoulderWidth = r * 1.8;
  const torsoWidth = r * 1.4;
  const height = r * 1.8;
  const topY = -height / 2;
  const bottomY = height / 2;
  const collarWidth = r * 0.5;
  const collarDepth = r * 0.25;
  const shoulderY = topY + r * 0.3;

  // Path: start top-left of collar, round across the collar dip, out
  // along the right shoulder, down to the right sleeve, under the arm,
  // down the right side, across the bottom, up the left side, under
  // the left arm, up the left shoulder, and close into the collar.
  const path = [
    `M ${-collarWidth / 2} ${topY}`,
    `Q 0 ${topY + collarDepth} ${collarWidth / 2} ${topY}`,
    `L ${shoulderWidth / 2} ${shoulderY}`,
    `L ${shoulderWidth / 2} ${shoulderY + r * 0.35}`,
    `L ${torsoWidth / 2} ${shoulderY + r * 0.55}`,
    `L ${torsoWidth / 2} ${bottomY}`,
    `L ${-torsoWidth / 2} ${bottomY}`,
    `L ${-torsoWidth / 2} ${shoulderY + r * 0.55}`,
    `L ${-shoulderWidth / 2} ${shoulderY + r * 0.35}`,
    `L ${-shoulderWidth / 2} ${shoulderY}`,
    "Z",
  ].join(" ");

  return (
    <g data-testid="formation-marker-glyph" data-glyph-kind="shirt">
      <path
        d={path}
        fill={teamColor}
        stroke={strokeColor}
        strokeWidth={Math.max(r * 0.08, 0.18)}
        strokeLinejoin="round"
      />
      <GlyphLabel
        label={label}
        labelVisible={labelVisible}
        labelFontSize={labelFontSize}
        strokeColor={strokeColor}
        labelStrokeWidth={labelStrokeWidth}
        y={r * 0.2}
      />
    </g>
  );
}

/**
 * Photo-cutout glyph — same as `MarkerPhoto` but with `chromakey`
 * enabled so the badge background and border are transparent.
 * The clipped photo floats without a visible ring while the circle
 * still occupies the same layout space for slot positioning.
 *
 * When the player has no photo, the fallback disc is also transparent
 * so the marker degrades to an invisible placeholder rather than a
 * coloured circle — callers who want a visible fallback should use
 * `"photo"` instead.
 */
export function MarkerPhotoCutout(ctx: MarkerGlyphContext): ReactElement {
  const { r, teamColor, label, strokeColor, strokeWidth, player, labelFontSize } = ctx;
  const photoAlt =
    player.photoAlt ??
    player.label ??
    (player.number != null ? `player ${player.number}` : `player`);

  return (
    <g data-testid="formation-marker-glyph" data-glyph-kind="photo-cutout">
      <PlayerAvatar
        r={r}
        photoUrl={player.photo}
        label={photoAlt}
        fallbackColor={teamColor}
        strokeColor={strokeColor}
        chromakey
        {...(strokeWidth != null ? { strokeWidth } : {})}
      />
      {/* Keep the jersey label in the DOM for tests + a11y, but invisible. */}
      <text
        data-testid="formation-marker-label"
        x={0}
        y={0}
        fontSize={labelFontSize}
        opacity={0}
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
}

/** Type union for the `marker.glyph` prop in Formation. */
export type MarkerGlyphPreset = "circle" | "photo" | "photo-cutout" | "shirt";

export type MarkerGlyphConfig =
  | MarkerGlyphPreset
  | ((ctx: MarkerGlyphContext) => ReactElement);

/**
 * Resolve a `glyph` config to a render function. String presets map to
 * the built-in glyphs; functions are passed through unchanged. Used by
 * `FormationMarker` to avoid switching on string literals inline.
 */
export function resolveGlyph(
  config: MarkerGlyphConfig | undefined,
): (ctx: MarkerGlyphContext) => ReactElement {
  if (config == null || config === "circle") return MarkerCircle;
  if (config === "photo") return MarkerPhoto;
  if (config === "photo-cutout") return MarkerPhotoCutout;
  if (config === "shirt") return MarkerShirt;
  return config;
}
