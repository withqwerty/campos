import type React from "react";
import { PITCH } from "../geometry/constants.js";
import type { PitchOrientation } from "../geometry/pitch.js";

export type ZoneLayout = "18" | "20";

type MarkingsConfig = {
  halfSpaces?: boolean;
  thirds?: boolean;
  zones?: ZoneLayout;
};

type Props = {
  orientation: PitchOrientation;
  markings: MarkingsConfig;
  color: string;
};

const lineProps = {
  strokeWidth: 0.25,
  strokeDasharray: "1.5 1",
  fill: "none" as const,
};

// Half-space boundaries (in pitch-width dimension)
const hsLeft = (PITCH.width - PITCH.penaltyAreaWidth) / 2;
const hsRight = PITCH.width - hsLeft;

// Third boundaries (in pitch-length dimension)
const t1 = PITCH.length / 3;
const t2 = (2 * PITCH.length) / 3;

// ── 18-zone grid: 6 equal rows × 3 equal columns ──
const ZONE_18_ROWS = Array.from({ length: 5 }, (_, i) => ((i + 1) * PITCH.length) / 6);
const ZONE_18_COLS = Array.from({ length: 2 }, (_, i) => ((i + 1) * PITCH.width) / 3);

// ── 20-zone grid: 4 equal rows × 5 positional columns ──
// Rows: quarter divisions along pitch length
const ZONE_20_ROWS = Array.from({ length: 3 }, (_, i) => ((i + 1) * PITCH.length) / 4);
// Columns: wide | half-space | center | half-space | wide
// Outer boundaries align to penalty-area edges; PA interior split into equal thirds
const paInnerThird = PITCH.penaltyAreaWidth / 3;
const ZONE_20_COLS = [
  hsLeft, // wide-left → half-space-left
  hsLeft + paInnerThird, // half-space-left → center
  hsRight - paInnerThird, // center → half-space-right
  hsRight, // half-space-right → wide-right
];

export function TacticalMarkings({ orientation, markings, color }: Props) {
  const lines: React.JSX.Element[] = [];
  let k = 0;

  const isV = orientation === "vertical";
  // In vertical: svgX = pitch width (68), svgY = pitch length (105)
  // In horizontal: svgX = pitch length (105), svgY = pitch width (68)
  const maxX = isV ? PITCH.width : PITCH.length;
  const maxY = isV ? PITCH.length : PITCH.width;

  // Half-space lines run parallel to the length axis (vertical = vertical lines, horizontal = horizontal lines)
  if (markings.halfSpaces) {
    const channels = [hsLeft, hsRight];
    for (const c of channels) {
      if (isV) {
        // Vertical: lines at x = c, from y=0 to y=maxY
        lines.push(
          <line key={k++} x1={c} y1={0} x2={c} y2={maxY} stroke={color} {...lineProps} />,
        );
      } else {
        // Horizontal: lines at y = c, from x=0 to x=maxX
        lines.push(
          <line key={k++} x1={0} y1={c} x2={maxX} y2={c} stroke={color} {...lineProps} />,
        );
      }
    }
  }

  // Third lines run perpendicular to the length axis
  if (markings.thirds) {
    const thirds = [t1, t2];
    for (const t of thirds) {
      if (isV) {
        // Vertical: horizontal lines at y = t
        lines.push(
          <line key={k++} x1={0} y1={t} x2={maxX} y2={t} stroke={color} {...lineProps} />,
        );
      } else {
        // Horizontal: vertical lines at x = t
        lines.push(
          <line key={k++} x1={t} y1={0} x2={t} y2={maxY} stroke={color} {...lineProps} />,
        );
      }
    }
  }

  // Zone grids: "18" (6×3 equal) or "20" (4×5 positional)
  if (markings.zones) {
    const rows = markings.zones === "18" ? ZONE_18_ROWS : ZONE_20_ROWS;
    const cols = markings.zones === "18" ? ZONE_18_COLS : ZONE_20_COLS;

    for (const r of rows) {
      if (isV) {
        lines.push(
          <line key={k++} x1={0} y1={r} x2={maxX} y2={r} stroke={color} {...lineProps} />,
        );
      } else {
        lines.push(
          <line key={k++} x1={r} y1={0} x2={r} y2={maxY} stroke={color} {...lineProps} />,
        );
      }
    }

    for (const c of cols) {
      if (isV) {
        lines.push(
          <line key={k++} x1={c} y1={0} x2={c} y2={maxY} stroke={color} {...lineProps} />,
        );
      } else {
        lines.push(
          <line key={k++} x1={0} y1={c} x2={maxX} y2={c} stroke={color} {...lineProps} />,
        );
      }
    }
  }

  if (lines.length === 0) return null;
  return <g data-stadia="tactical-markings">{lines}</g>;
}
