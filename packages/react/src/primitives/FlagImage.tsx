import { useId, type ReactElement } from "react";

import { registerCellSize } from "./measureProtocol.js";

/**
 * Circular flag image badge. Renders an `<image>` clipped to a circle
 * with a thin dark outline — drop-in replacement for the text-based
 * `MarkerIcon kind="flag"`.
 *
 * The caller provides the full URL to the flag SVG. Campos ships 261
 * circular flag SVGs in `assets/flags/{CODE}.svg` keyed by FIFA code;
 * resolve the code via `getCountryCode()` from `@withqwerty/campos-schema`
 * and build the URL for your deployment:
 *
 * ```tsx
 * import { getCountryCode } from "@withqwerty/campos-schema";
 *
 * const code = getCountryCode(player.nationality); // "ENG"
 * const flagUrl = `/flags/${code}.svg`;
 *
 * slots: ({ r }) => ({
 *   topLeft: <FlagImage r={r} src={flagUrl} />,
 * })
 * ```
 *
 * The flag SVGs are already circular (512×512 viewBox with a base
 * `<circle r="256">`), so the clip just trims any anti-aliased fringe
 * to keep the edge crisp at small scales.
 */
export type FlagImageProps = {
  /** Parent marker radius — drives the flag disc size. */
  r: number;
  /** URL to the flag SVG (e.g. `/flags/ENG.svg`). */
  src: string;
  /** Accessible label for the flag (e.g. "England"). */
  alt?: string;
  /** Outline stroke colour. */
  strokeColor?: string;
  /** Outline stroke width. */
  strokeWidth?: number;
};

/** Flag disc diameter as a fraction of the marker radius. */
const FLAG_SIZE = 0.7;

export function FlagImage({
  r,
  src,
  alt,
  strokeColor = "#1a202c",
  strokeWidth,
}: FlagImageProps): ReactElement {
  const reactId = useId();
  const clipId = `campos-flag-clip-${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const discR = (r * FLAG_SIZE) / 2;
  const effectiveStroke = strokeWidth ?? Math.max(r * 0.04, 0.1);

  return (
    <g data-testid="formation-flag">
      <defs>
        <clipPath id={clipId}>
          <circle r={discR} />
        </clipPath>
      </defs>
      {/* Flag image clipped to circle */}
      <image
        href={src}
        x={-discR}
        y={-discR}
        width={discR * 2}
        height={discR * 2}
        clipPath={`url(#${clipId})`}
        preserveAspectRatio="xMidYMid slice"
      >
        {alt != null ? <title>{alt}</title> : null}
      </image>
      {/* Crisp outline on top */}
      <circle r={discR} fill="none" stroke={strokeColor} strokeWidth={effectiveStroke} />
    </g>
  );
}

registerCellSize(FlagImage, (_props, r) => ({
  cellWidth: r * FLAG_SIZE,
  cellHeight: r * FLAG_SIZE,
}));
