import type { CSSProperties } from "react";
import type { ProjectFn } from "@withqwerty/campos-stadia";

import { pickContrast } from "../colorContrast.js";
import { projectPitchRect } from "../pitchGeometry.js";
import { LIGHT_THEME, type UITheme } from "../theme.js";

export type ChartHeatmapCellMark = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  opacity: number;
  stroke?: string;
  strokeWidth?: number;
  interactive?: boolean;
  role?: string;
  tabIndex?: number;
  ariaLabel?: string;
};

/**
 * Scoped focus-visible CSS. Cells are interactive (`role="button"`,
 * `tabIndex=0`) so the browser paints its default focus ring on click
 * and keyboard Tab. Click-focus is cosmetic noise, so suppress it on
 * `:focus:not(:focus-visible)` and emit a per-cell contrast-picked
 * Campos ring on `:focus-visible` (Tab navigation).
 *
 * Each cell sets `--campos-focus-ring` inline to the higher-contrast
 * option between `theme.contrast.onLight` and `theme.contrast.onDark`
 * against its own fill, so the ring stays visible even when the
 * user-supplied `colorStops` ramp peaks near `theme.focus.ring`.
 * Falls back to `theme.focus.ring` when the variable is unset.
 */
function focusStyles(theme: UITheme) {
  return `
    [data-campos="heatmap-cells"] > rect:focus { outline: none; }
    [data-campos="heatmap-cells"] > rect:focus-visible {
      outline: ${theme.focus.width}px solid var(--campos-focus-ring, ${theme.focus.ring});
      outline-offset: ${theme.focus.offset}px;
      border-radius: ${theme.radius.xs}px;
    }
  `;
}

export function ChartHeatmapCellLayer({
  cells,
  project,
  theme = LIGHT_THEME,
  activeKey,
  onCellEnter,
  onCellLeave,
  onCellClick,
}: {
  cells: ChartHeatmapCellMark[];
  project: ProjectFn;
  theme?: UITheme;
  activeKey?: string | null;
  onCellEnter?: (key: string) => void;
  onCellLeave?: (key: string) => void;
  onCellClick?: (key: string) => void;
}) {
  return (
    <g data-campos="heatmap-cells">
      <style>{focusStyles(theme)}</style>
      {cells.map((cell) => {
        const rect = projectPitchRect(project, cell);
        const interactive =
          cell.interactive ??
          (cell.role != null || cell.tabIndex != null || cell.ariaLabel != null);
        const focusRing = pickContrast(cell.fill, [
          theme.contrast.onLight,
          theme.contrast.onDark,
        ]);
        const baseStyle: CSSProperties & Record<"--campos-focus-ring", string> = {
          "--campos-focus-ring": focusRing,
          ...(interactive ? { cursor: "pointer" } : { pointerEvents: "none" }),
        };

        return (
          <rect
            key={cell.key}
            {...(cell.role != null ? { role: cell.role } : {})}
            {...(cell.tabIndex != null ? { tabIndex: cell.tabIndex } : {})}
            {...(cell.ariaLabel != null ? { "aria-label": cell.ariaLabel } : {})}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={cell.fill}
            {...(cell.stroke != null ? { stroke: cell.stroke } : {})}
            {...(cell.strokeWidth != null ? { strokeWidth: cell.strokeWidth } : {})}
            opacity={
              activeKey === cell.key ? Math.min(cell.opacity + 0.1, 1) : cell.opacity
            }
            style={baseStyle}
            {...(interactive
              ? {
                  onMouseEnter: () => {
                    onCellEnter?.(cell.key);
                  },
                  onFocus: () => {
                    onCellEnter?.(cell.key);
                  },
                  onMouseLeave: () => {
                    onCellLeave?.(cell.key);
                  },
                  onBlur: () => {
                    onCellLeave?.(cell.key);
                  },
                  onClick: () => {
                    onCellClick?.(cell.key);
                  },
                }
              : {})}
          />
        );
      })}
    </g>
  );
}
