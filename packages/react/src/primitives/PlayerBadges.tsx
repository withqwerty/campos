import { useId, type ReactElement } from "react";

import { ratingPillCellSize } from "./markerLayout.js";
import { registerCellSize } from "./measureProtocol.js";

/**
 * Shared SVG badge primitives for rendering match-event markers on top of
 * player node markers (Formation, PassNetwork, any future lineup charts).
 *
 * **Why shared:** every lineup-style chart needs the same three primitives
 * — yellow card, red card, substitution — positioned consistently relative
 * to a circular player marker of arbitrary radius. Keeping them here
 * avoids Formation and PassNetwork diverging on colours, shapes, or
 * anchor points.
 *
 * **Sizing:** all badges are parameterised by `r` (the parent marker's
 * radius in SVG user units). Badge dimensions scale from `r`, so the
 * badges stay proportional across `SCALE_FULL` / `SCALE_HALF` /
 * `SCALE_DUAL` and any other future marker scale.
 *
 * **Positioning:** consumer components wrap badges in a `<g translate(...)>`
 * at the marker origin. The badges render around `(0, 0)` so callers can
 * anchor them at any corner of the marker. See `FormationMarker` for the
 * canonical layout.
 *
 * **Customisation:** colours are passed in by the consumer. The sensible
 * defaults (see {@link DEFAULT_CARD_STYLES}) can be spread in when the
 * caller doesn't need to override anything.
 */

export type PlayerBadgeStyles = {
  /** Fill colour for the yellow card rectangle. */
  yellowCardColor: string;
  /** Fill colour for the red card rectangle. */
  redCardColor: string;
  /** Fill colour for the "player coming on" arrow in the substitution badge. */
  subOnColor: string;
  /** Fill colour for the "player going off" arrow in the substitution badge. */
  subOffColor: string;
  /** Outline stroke colour used by all three badges for contrast. */
  strokeColor: string;
};

/**
 * Sensible defaults. Card colours match FIFA broadcast convention;
 * substitution arrows use vibrant red (player coming off) and green
 * (player coming on) — the standard football substitution pairing, and
 * saturated enough to stay visible without a white backing disc. The
 * sub-off red intentionally differs from the red-card red so the two
 * decorations read as distinct at a glance.
 */
export const DEFAULT_CARD_STYLES: PlayerBadgeStyles = {
  yellowCardColor: "#facc15",
  redCardColor: "#dc2626",
  subOnColor: "#22c55e",
  subOffColor: "#ef4444",
  strokeColor: "#1a202c",
};

type CardBadgeProps = {
  /** Parent marker radius in SVG user units — every dimension scales from this. */
  r: number;
  /** Card fill colour (yellow or red). */
  color: string;
  /** Outline colour for contrast against the pitch. */
  strokeColor?: string;
  /** Test id for targeted querySelector assertions. */
  testId?: string;
};

/**
 * Low-level primitive: a single football card (rectangle) shape. Used by
 * {@link YellowCardBadge} and {@link RedCardBadge}; exported for chart
 * authors who want a card at a custom position without the semantic
 * wrapper.
 */
export function CardBadge({
  r,
  color,
  strokeColor = DEFAULT_CARD_STYLES.strokeColor,
  testId,
}: CardBadgeProps): ReactElement {
  // Real football cards are ~9x6cm (3:2 aspect). Sized relative to the
  // marker radius so cards stay readable at SCALE_DUAL (~0.62x) without
  // dominating at SCALE_FULL.
  const width = r * 0.55;
  const height = r * 0.82;
  const strokeWidth = Math.max(r * 0.06, 0.12);
  const rx = width * 0.1;

  return (
    <g data-testid={testId ?? "formation-card"}>
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={rx}
        ry={rx}
        fill={color}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
    </g>
  );
}

/** Yellow card semantic wrapper — uses the default yellow colour. */
export function YellowCardBadge({
  r,
  yellowCardColor = DEFAULT_CARD_STYLES.yellowCardColor,
  strokeColor = DEFAULT_CARD_STYLES.strokeColor,
}: {
  r: number;
  yellowCardColor?: string;
  strokeColor?: string;
}): ReactElement {
  return (
    <CardBadge
      r={r}
      color={yellowCardColor}
      strokeColor={strokeColor}
      testId="formation-yellow-card"
    />
  );
}

/** Red card semantic wrapper. */
export function RedCardBadge({
  r,
  redCardColor = DEFAULT_CARD_STYLES.redCardColor,
  strokeColor = DEFAULT_CARD_STYLES.strokeColor,
}: {
  r: number;
  redCardColor?: string;
  strokeColor?: string;
}): ReactElement {
  return (
    <CardBadge
      r={r}
      color={redCardColor}
      strokeColor={strokeColor}
      testId="formation-red-card"
    />
  );
}

type SubstitutionBadgeProps = {
  /** Parent marker radius in SVG user units. */
  r: number;
  /** "Player coming on" arrow colour (default teal). */
  onColor?: string;
  /** "Player going off" arrow colour (default orange). */
  offColor?: string;
  /** Outline colour for the backing disc. */
  strokeColor?: string;
};

/**
 * Substitution badge — two horizontal arrows stacked vertically. The
 * top arrow points right (player coming ON, green by default) and the
 * bottom arrow points left (player going OFF, red by default).
 *
 * **Rendering strategy:** no backing disc. The arrows render directly
 * on top of whatever sits behind them, with a thick dark stroke so the
 * shapes stay legible against bright pitches, dark pitches, or the team
 * marker itself. Dropping the disc keeps the badge visually lighter and
 * more "icon-like" — the earlier disc+inset arrangement looked muddy
 * at `SCALE_DUAL`. Visibility comes from the vivid red/green fill paired
 * with the dark stroke.
 *
 * The arrows are generously sized: shaft thickness ~45% of the badge
 * radius, head ~62% wide, arm length ~1.55× the badge radius. Tuning
 * goal: at `SCALE_DUAL` (~0.62× marker radius) a user at 200% zoom can
 * still tell on from off without squinting.
 */
export function SubstitutionBadge({
  r,
  onColor = DEFAULT_CARD_STYLES.subOnColor,
  offColor = DEFAULT_CARD_STYLES.subOffColor,
  strokeColor = DEFAULT_CARD_STYLES.strokeColor,
}: SubstitutionBadgeProps): ReactElement {
  // Nominal "badge radius" — no disc is rendered, but we still size the
  // arrows off this value so the primitive stays compatible with the
  // consumer positioning (PlayerStatusBadges anchors the badge at
  // `(-r*0.85, r*0.85)`, expecting a compact footprint around ~r*0.5).
  const badgeRadius = r * 0.55;
  // Outline stroke thick enough to silhouette the arrow against any
  // background without a disc.
  const strokeWidth = Math.max(r * 0.05, 0.1);

  const armLength = badgeRadius * 1.55;
  const shaftHeight = badgeRadius * 0.45;
  const headHalfHeight = badgeRadius * 0.62;
  const headLength = badgeRadius * 0.55;
  const armY = badgeRadius * 0.45;

  // Right-pointing arrow. Explicit segment construction keeps the head
  // sharp at every scale; matrixes would blur the tip with
  // `strokeLinejoin="round"`.
  const rightShaftLeft = -armLength / 2;
  const rightShaftRight = armLength / 2 - headLength;
  const rightHeadTipX = armLength / 2;
  const rightArrowPath = [
    `M ${rightShaftLeft} ${-shaftHeight / 2}`,
    `L ${rightShaftRight} ${-shaftHeight / 2}`,
    `L ${rightShaftRight} ${-headHalfHeight}`,
    `L ${rightHeadTipX} 0`,
    `L ${rightShaftRight} ${headHalfHeight}`,
    `L ${rightShaftRight} ${shaftHeight / 2}`,
    `L ${rightShaftLeft} ${shaftHeight / 2}`,
    "Z",
  ].join(" ");

  // Left-pointing arrow — mirror of the right arrow.
  const leftShaftRight = armLength / 2;
  const leftShaftLeft = -armLength / 2 + headLength;
  const leftHeadTipX = -armLength / 2;
  const leftArrowPath = [
    `M ${leftShaftRight} ${-shaftHeight / 2}`,
    `L ${leftShaftLeft} ${-shaftHeight / 2}`,
    `L ${leftShaftLeft} ${-headHalfHeight}`,
    `L ${leftHeadTipX} 0`,
    `L ${leftShaftLeft} ${headHalfHeight}`,
    `L ${leftShaftLeft} ${shaftHeight / 2}`,
    `L ${leftShaftRight} ${shaftHeight / 2}`,
    "Z",
  ].join(" ");

  return (
    <g data-testid="formation-substitution">
      {/* Top arrow: player coming on (green by default) */}
      <g transform={`translate(0 ${-armY})`}>
        <path
          d={rightArrowPath}
          fill={onColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>
      {/* Bottom arrow: player going off (red by default) */}
      <g transform={`translate(0 ${armY})`}>
        <path
          d={leftArrowPath}
          fill={offColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Avatar + rating + flag primitives. Building blocks for the slot system —
// composed via `MarkerIcon`, `MarkerPill`, `RatingPill`, and `MarkerGlyphs.tsx`.
// ---------------------------------------------------------------------------

/**
 * Derive two-letter initials from a player name. Takes the first letter of
 * the first and last word, upper-cased. "Mohamed Salah" → "MS".
 * "Alisson" → "A". Used by {@link PlayerAvatar} when a photo fails to
 * load and by consumers wanting a fallback label.
 */
export function deriveAvatarInitials(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    const only = parts[0] ?? "";
    return only.slice(0, 1).toUpperCase();
  }
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  return (first.slice(0, 1) + last.slice(0, 1)).toUpperCase();
}

type PlayerAvatarProps = {
  /** Marker radius in SVG user units. The avatar circle matches this radius. */
  r: number;
  /** Image URL. If omitted or the image errors, the initials fallback is shown. */
  photoUrl?: string | undefined;
  /** Accessible alt text / initials source. */
  label?: string;
  /** Fill colour for the initials fallback disc. Defaults to the team colour the caller provides. */
  fallbackColor: string;
  /** Stroke colour around the avatar. */
  strokeColor?: string;
  /** Stroke width (absolute units). Pass undefined to use the per-glyph default. */
  strokeWidth?: number | undefined;
  /**
   * When true the fallback disc and outer stroke become transparent,
   * leaving only the clipped photo visible — a "cutout" effect.
   * The circle still occupies the same space for layout purposes.
   */
  chromakey?: boolean;
};

/**
 * Circular player avatar. Renders an `<image>` clipped to a circle of
 * radius `r`, with a coloured disc + initials shown underneath so the
 * fallback is visible instantly before the image loads (and if it
 * 404s). Uses a unique clipPath per instance so multiple avatars on one
 * pitch don't collide.
 *
 * The clipPath id comes from React's `useId`. The previous slug-based
 * scheme collided across players who shared a label or had no photo
 * (every "no photo" player resolved to `campos-avatar-clip-anon`),
 * which broke clipping in Firefox/Safari for any broadcast-preset card
 * with partial photo coverage. `useId` guarantees uniqueness without
 * any label dependency.
 */
export function PlayerAvatar({
  r,
  photoUrl,
  label = "",
  fallbackColor,
  strokeColor = DEFAULT_CARD_STYLES.strokeColor,
  strokeWidth,
  chromakey = false,
}: PlayerAvatarProps): ReactElement {
  const reactId = useId();
  // Strip the colons React adds — they're not legal in SVG ids in some
  // strict parsers — and prefix for grep-ability.
  const clipId = `campos-avatar-clip-${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const effectiveStroke = strokeWidth ?? Math.max(r * 0.08, 0.18);
  const initials = deriveAvatarInitials(label);

  return (
    <g data-testid="formation-avatar">
      <defs>
        <clipPath id={clipId}>
          <circle r={r} />
        </clipPath>
      </defs>
      {/* Fallback disc + initials sit underneath the image so they
          render even while the image is loading or if it errors.
          In chromakey mode the disc is transparent — layout preserved,
          visuals removed so only the clipped photo shows. */}
      <circle
        r={r}
        fill={chromakey ? "transparent" : fallbackColor}
        stroke={chromakey ? "transparent" : strokeColor}
        strokeWidth={effectiveStroke}
      />
      {!chromakey && (
        <text
          x={0}
          y={0}
          fill="#ffffff"
          fontSize={r * 0.8}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="central"
          pointerEvents="none"
          style={{ userSelect: "none" }}
        >
          {initials}
        </text>
      )}
      {photoUrl ? (
        <image
          href={photoUrl}
          x={-r}
          y={-r}
          width={r * 2}
          height={r * 2}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        >
          <title>{label || initials}</title>
        </image>
      ) : null}
      {/* Re-stroke the circle on top so the border stays crisp over the image.
          Transparent in chromakey mode — the face floats without a ring. */}
      <circle
        r={r}
        fill="none"
        stroke={chromakey ? "transparent" : strokeColor}
        strokeWidth={effectiveStroke}
      />
    </g>
  );
}

export type RatingThresholds = {
  /** Ratings at or above this value render with `highColor` (green). */
  highMin: number;
  /** Ratings at or above this value but below `highMin` render with `midColor` (orange). */
  midMin: number;
};

export const DEFAULT_RATING_THRESHOLDS: RatingThresholds = {
  highMin: 7,
  midMin: 6,
};

type RatingPillProps = {
  /** Parent marker radius. The pill is sized ~85% of `r` tall. */
  r: number;
  /** Numeric rating, e.g. 7.2. Rendered with one decimal. */
  rating: number;
  /** Low-rating fill (< midMin). Defaults to red. */
  lowColor?: string;
  /** Mid-rating fill (midMin..highMin). Defaults to orange. */
  midColor?: string;
  /** High-rating fill (>= highMin). Defaults to green. */
  highColor?: string;
  /** Thresholds used to pick the pill colour. */
  thresholds?: RatingThresholds;
  /** Outline colour. */
  strokeColor?: string;
};

export const DEFAULT_RATING_COLORS = {
  low: "#dc2626",
  mid: "#f97316",
  high: "#16a34a",
} as const;

/**
 * Colour-graded rating pill. Wide enough to fit "10.0" comfortably; the
 * dimensions scale with the parent marker radius so the pill stays
 * proportional at every formation scale.
 */
export function RatingPill({
  r,
  rating,
  lowColor = DEFAULT_RATING_COLORS.low,
  midColor = DEFAULT_RATING_COLORS.mid,
  highColor = DEFAULT_RATING_COLORS.high,
  thresholds = DEFAULT_RATING_THRESHOLDS,
  strokeColor = DEFAULT_CARD_STYLES.strokeColor,
}: RatingPillProps): ReactElement {
  const fill =
    rating >= thresholds.highMin
      ? highColor
      : rating >= thresholds.midMin
        ? midColor
        : lowColor;
  const width = r * 1.35;
  const height = r * 0.62;
  const rx = height / 2;
  const fontSize = r * 0.52;
  const strokeWidth = Math.max(r * 0.06, 0.12);

  return (
    <g data-testid="formation-rating">
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={rx}
        ry={rx}
        fill={fill}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
      <text
        x={0}
        y={0}
        fill="#ffffff"
        fontSize={fontSize}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="central"
        pointerEvents="none"
        style={{ userSelect: "none" }}
      >
        {rating.toFixed(1)}
      </text>
    </g>
  );
}

// Cell-size protocol registration. Threshold-graded colour logic is
// internal to RatingPill, but the cell footprint stays constant per `r`.
registerCellSize(RatingPill, (_props, r) => ratingPillCellSize(r));

type FlagBadgeProps = {
  /** Parent marker radius. */
  r: number;
  /** Nationality label (emoji flag, ISO code, or arbitrary short string). */
  nationality: string;
  /** Backing fill colour. Defaults to white. */
  fill?: string;
  /** Outline colour. */
  strokeColor?: string;
};

/**
 * Small circular nationality badge. Campos does NOT ship a flag sprite
 * sheet — callers pass whatever string they want to display (emoji like
 * "🇧🇷", ISO code like "BR", or a short label). The string is centred
 * inside a white disc.
 */
export function FlagBadge({
  r,
  nationality,
  fill = "#ffffff",
  strokeColor = DEFAULT_CARD_STYLES.strokeColor,
}: FlagBadgeProps): ReactElement {
  const fontSize = r * 0.34;
  const strokeWidth = Math.max(r * 0.06, 0.12);
  const padX = fontSize * 0.55;
  const padY = fontSize * 0.4;
  const textW = nationality.length * fontSize * 0.65;
  const chipW = Math.max(textW + padX * 2, fontSize * 2);
  const chipH = fontSize + padY * 2;
  const rx = chipH * 0.3;

  return (
    <g data-testid="formation-flag">
      <rect
        x={-(chipW / 2)}
        y={-(chipH / 2)}
        width={chipW}
        height={chipH}
        rx={rx}
        ry={rx}
        fill={fill}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
      <text
        x={0}
        y={0}
        fontSize={fontSize}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="central"
        pointerEvents="none"
        style={{ userSelect: "none" }}
      >
        {nationality}
      </text>
    </g>
  );
}

/**
 * Estimate the rendered width of a small text pill for a given marker
 * radius and label. Used by `MarkerPill` (and the marker layout engine)
 * to reserve the correct horizontal space before the pill mounts —
 * walking DOM bboxes at layout time would race with React render.
 *
 * The char-width factor (0.62) is deliberately generous because
 * transfer-value labels use `€`, `$`, `£`, `M` — all noticeably wider
 * than the average lowercase glyph. A tighter factor (0.5) was used
 * initially and the `€140M` pill overflowed the rounded rect at
 * SCALE_FULL. Short labels like `"23"` still get a minimum-width floor
 * so they stay pill-shaped instead of squishing to a circle.
 */
export function estimateSmallPillWidth(r: number, text: string): number {
  const fontSize = r * 0.5;
  const charWidth = fontSize * 0.62;
  return Math.max(text.length * charWidth + fontSize * 0.9, r * 1.2);
}
