import { useMemo, useState, type ReactNode } from "react";

import {
  computeHeatmap,
  type ComputeHeatmapInput,
  type HeatmapCell,
  type HeatmapColorScale,
  type HeatmapValueMode,
} from "./compute/index.js";
import type { ColorStop } from "./compute/index.js";
import {
  computeViewBox,
  Pitch,
  type PitchColors,
  type PitchMarkingsConfig,
  type ProjectFn,
  type Theme as PitchTheme,
} from "@withqwerty/campos-stadia";

import { useTheme } from "./ThemeContext.js";
import { pitchMarkingsForZonePreset, type PitchZonePreset } from "./pitchZonePresets.js";
import { resolveAutoPitchLineColors } from "./pitchContrast.js";
import { resolveStyleValue, type StyleValue } from "./styleValue.js";
import { LIGHT_THEME, type UITheme } from "./theme.js";
import {
  ChartHeatmapCellLayer,
  ChartScaleBar,
  ChartTooltip,
  EmptyState,
  PitchChartFrame,
  type ChartHeatmapCellMark,
} from "./primitives/index.js";
import {
  resolvePitchZonePresetEdges,
  ZONE_PRESET_EXPLICIT_EDGES_WARNING,
  zonePresetGridOverrideWarning,
} from "./compute/pitch-zone-presets.js";

export type HeatmapProps = {
  events: ComputeHeatmapInput["events"];
  gridX?: number;
  gridY?: number;
  /**
   * Explicit x-axis bin edges in Campos 0–100 space. Overrides `gridX`.
   * Use `zoneEdgesInCampos()` from `@withqwerty/campos-stadia` for
   * tactical-zone layouts (18 / 20 zones).
   */
  xEdges?: readonly number[];
  /** Explicit y-axis bin edges in Campos 0–100 space. Overrides `gridY`. */
  yEdges?: readonly number[];
  /**
   * Shared named pitch-zone preset. Overrides `gridX` / `gridY` unless
   * explicit `xEdges` / `yEdges` are supplied.
   */
  zonePreset?: PitchZonePreset;
  colorScale?: HeatmapColorScale;
  colorStops?: ColorStop[];
  attackingDirection?: "up" | "down" | "left" | "right";
  crop?: "full" | "half";
  /** Scale-bar label describing what the heatmap measures. @default "Events" */
  metricLabel?: string;
  /**
   * How scale-bar domain and tooltip values are expressed.
   * The color ramp is invariant across modes.
   * @default "count"
   */
  valueMode?: HeatmapValueMode;
  pitchTheme?: PitchTheme;
  pitchColors?: PitchColors;
  /**
   * Tactical pitch markings drawn beneath the cells (half-spaces, thirds,
   * or an 18/20-zone grid). When `pitchMarkings.zones` matches the
   * layout passed to `zoneEdgesInCampos(layout)`, the rendered cells
   * align exactly with the visible zone lines.
   */
  pitchMarkings?: PitchMarkingsConfig;
  /**
   * When true (default), dark colorscales (magma/inferno/viridis/dark custom)
   * automatically force the pitch lines to white so markings stay visible on
   * top of dark cells. The override takes precedence over any user-provided
   * `pitchColors.lines`. Set to `false` to disable and use the theme/preset
   * line colors unchanged.
   * @default true
   */
  autoPitchLines?: boolean;
  cells?: HeatmapCellsStyle;
  /** Scale-bar visibility. @default true */
  showScaleBar?: boolean;
  /** Override frame padding in pixels. Default 16. Set to 0 for composites. */
  framePadding?: number;
  /** Override the chart frame max-width in pixels. Default varies by orientation/crop. */
  maxWidth?: number;
  /**
   * Render custom SVG children on top of the heatmap cells. Receives the
   * same `project` function as `Pitch` children so markers align with the
   * pitch coordinate frame. Typical use: overlay event dots (pressures,
   * touches, defensive actions) on top of the density surface. Disable
   * `showCellTooltip` when the overlay supplies its own per-marker
   * tooltips, so the two don't fight each other.
   *
   * Paint order inside the pitch region is: underlay density cells →
   * pitch lines → tactical markings → overlay. Overlay markers therefore
   * sit above any `pitchMarkings` / `zonePreset` grid lines. When the
   * chart is in its empty state (`events=[]`), supplying `overlay`
   * suppresses the "No event data" pill so the overlay can stand in as
   * the only content — callers who want to keep the pill should leave
   * `overlay` unset for empty data.
   */
  overlay?: (ctx: { project: ProjectFn }) => ReactNode;
  /**
   * When true (default), hovering a heatmap cell shows a tooltip with
   * the count/intensity/share value and the cell captures pointer events.
   * Set to `false` when the chart uses an `overlay` with per-marker
   * tooltips so the cell hover doesn't interfere — cells become
   * non-interactive in that mode.
   * @default true
   */
  showCellTooltip?: boolean;
};

type HeatmapZoneResolution = {
  xEdges: readonly number[] | undefined;
  yEdges: readonly number[] | undefined;
  warnings: string[];
  pitchMarkings: PitchMarkingsConfig | undefined;
};

type HeatmapZoneInput = {
  gridX: number | undefined;
  gridY: number | undefined;
  xEdges: readonly number[] | undefined;
  yEdges: readonly number[] | undefined;
  zonePreset: PitchZonePreset | undefined;
  crop: "full" | "half" | undefined;
  pitchMarkings: PitchMarkingsConfig | undefined;
};

export type HeatmapCellStyleContext = {
  cell: HeatmapCell;
  theme: UITheme;
  active: boolean;
};

export type HeatmapCellsStyle = {
  show?: StyleValue<boolean, HeatmapCellStyleContext>;
  fill?: StyleValue<string, HeatmapCellStyleContext>;
  opacity?: StyleValue<number, HeatmapCellStyleContext>;
  stroke?: StyleValue<string, HeatmapCellStyleContext>;
  strokeWidth?: StyleValue<number, HeatmapCellStyleContext>;
};

function cellAriaLabel(cell: HeatmapCell, metricLabel: string): string {
  return `${metricLabel} heatmap cell row ${cell.row + 1} column ${cell.col + 1}: ${cell.count}`;
}

/**
 * Format a domain-space value according to the active value mode.
 * - `count`: integer, no unit
 * - `intensity` / `share`: percentage rounded to integer
 */
function formatScaleValue(value: number, valueMode: HeatmapValueMode): string {
  if (valueMode === "count") return String(value);
  return `${Math.round(value * 100)}%`;
}

/**
 * Pick the cell value a tooltip primary row should show for the active mode.
 * - `count` → raw integer
 * - `intensity` → `Math.round(intensity * 100)%`
 * - `share` → `Math.round(share * 100)%`
 */
function cellValueForMode(cell: HeatmapCell, valueMode: HeatmapValueMode): string {
  switch (valueMode) {
    case "count":
      return String(cell.count);
    case "intensity":
      return `${Math.round(cell.intensity * 100)}%`;
    case "share":
      return `${Math.round(cell.share * 100)}%`;
  }
}

/**
 * Build the tooltip rows for the active cell.
 * - Primary row: `{metricLabel}: value` for count/share, or `Intensity: X%` for intensity mode
 *   (intensity mode uses the literal "Intensity" label because the number isn't
 *   measuring the metric itself — it's measuring intensity *of* the metric).
 * - Secondary row: `Intensity: X%` — always shown UNLESS the primary row already is intensity.
 */
function buildTooltipRows(
  cell: HeatmapCell,
  metricLabel: string,
  valueMode: HeatmapValueMode,
): Array<{ label: string; value: string }> {
  const primaryLabel = valueMode === "intensity" ? "Intensity" : metricLabel;
  const primary = { label: primaryLabel, value: cellValueForMode(cell, valueMode) };
  if (valueMode === "intensity") {
    return [primary];
  }
  const intensityRow = {
    label: "Intensity",
    value: `${Math.round(cell.intensity * 100)}%`,
  };
  return [primary, intensityRow];
}

function toCellMark(
  cell: HeatmapCell,
  metricLabel: string,
  interactive: boolean,
  style: HeatmapCellsStyle | undefined,
  theme: UITheme,
): ChartHeatmapCellMark {
  const styleContext: HeatmapCellStyleContext = {
    cell,
    theme,
    active: false,
  };
  if (resolveStyleValue(style?.show, styleContext) === false) {
    return {
      key: `${cell.row}-${cell.col}`,
      x: cell.x,
      y: cell.y,
      width: cell.width,
      height: cell.height,
      fill: "transparent",
      opacity: 0,
      interactive: false,
    };
  }
  const fill = resolveStyleValue(style?.fill, styleContext) ?? cell.fill;
  const opacity = resolveStyleValue(style?.opacity, styleContext) ?? cell.opacity;
  const stroke = resolveStyleValue(style?.stroke, styleContext);
  const strokeWidth = resolveStyleValue(style?.strokeWidth, styleContext);
  const mark: ChartHeatmapCellMark = {
    key: `${cell.row}-${cell.col}`,
    x: cell.x,
    y: cell.y,
    width: cell.width,
    height: cell.height,
    fill,
    opacity,
    interactive: interactive && cell.count > 0,
    ...(interactive && cell.count > 0
      ? {
          role: "button",
          tabIndex: 0,
          ariaLabel: cellAriaLabel(cell, metricLabel),
        }
      : {}),
  };
  if (stroke != null) {
    mark.stroke = stroke;
  }
  if (strokeWidth != null) {
    mark.strokeWidth = strokeWidth;
  }
  return mark;
}

function HeatmapCells({
  cells,
  project,
  activeCell,
  onCellEnter,
  onCellLeave,
  metricLabel,
  style,
  theme,
}: {
  cells: HeatmapCell[];
  project: ProjectFn;
  activeCell: string | null;
  onCellEnter: (key: string) => void;
  onCellLeave: (key: string) => void;
  metricLabel: string;
  style: HeatmapCellsStyle | undefined;
  theme: UITheme;
}) {
  return (
    <ChartHeatmapCellLayer
      cells={cells
        .map((cell) => toCellMark(cell, metricLabel, true, style, theme))
        .filter((cell) => cell.opacity > 0 || cell.fill !== "transparent")}
      project={project}
      theme={theme}
      activeKey={activeCell}
      onCellEnter={onCellEnter}
      onCellLeave={onCellLeave}
      onCellClick={onCellEnter}
    />
  );
}

function StaticHeatmapCells({
  cells,
  project,
  style,
  theme,
}: {
  cells: HeatmapCell[];
  project: ProjectFn;
  style: HeatmapCellsStyle | undefined;
  theme: UITheme;
}) {
  return (
    <ChartHeatmapCellLayer
      cells={cells
        .map((cell) => toCellMark(cell, "Events", false, style, theme))
        .filter((cell) => cell.opacity > 0 || cell.fill !== "transparent")}
      project={project}
      theme={theme}
    />
  );
}

function buildHeatmapModel({
  events,
  gridX,
  gridY,
  xEdges,
  yEdges,
  zonePreset,
  colorScale,
  colorStops,
  attackingDirection,
  crop,
  metricLabel = "Events",
  valueMode = "count",
  pitchMarkings,
}: HeatmapProps) {
  const zoneResolution = resolveHeatmapZoneInputs({
    gridX,
    gridY,
    xEdges,
    yEdges,
    zonePreset,
    crop,
    pitchMarkings,
  });
  const computed = computeHeatmap({
    events,
    metricLabel,
    valueMode,
    ...(zoneResolution.xEdges != null ? { xEdges: zoneResolution.xEdges } : {}),
    ...(zoneResolution.yEdges != null ? { yEdges: zoneResolution.yEdges } : {}),
    ...(zoneResolution.xEdges == null && gridX != null ? { gridX } : {}),
    ...(zoneResolution.yEdges == null && gridY != null ? { gridY } : {}),
    ...(colorScale != null ? { colorScale } : {}),
    ...(colorStops != null ? { colorStops } : {}),
    ...(attackingDirection != null ? { attackingDirection } : {}),
    ...(crop != null ? { crop } : {}),
  });
  const model =
    zoneResolution.warnings.length === 0
      ? computed
      : {
          ...computed,
          meta: {
            ...computed.meta,
            warnings: [...computed.meta.warnings, ...zoneResolution.warnings],
          },
        };
  return { model, pitchMarkings: zoneResolution.pitchMarkings };
}

function resolveHeatmapZoneInputs({
  gridX,
  gridY,
  xEdges,
  yEdges,
  zonePreset,
  crop,
  pitchMarkings,
}: HeatmapZoneInput): HeatmapZoneResolution {
  if (zonePreset == null) {
    return { xEdges, yEdges, warnings: [], pitchMarkings };
  }

  if (xEdges != null || yEdges != null) {
    return {
      xEdges,
      yEdges,
      warnings: [ZONE_PRESET_EXPLICIT_EDGES_WARNING],
      pitchMarkings,
    };
  }

  const resolution = resolvePitchZonePresetEdges(zonePreset, crop ?? "full");
  const warnings = [...resolution.warnings];
  if (resolution.xEdges != null && (gridX != null || gridY != null)) {
    warnings.push(zonePresetGridOverrideWarning("gridX/gridY"));
  }
  return {
    xEdges: resolution.xEdges,
    yEdges: resolution.yEdges,
    warnings,
    pitchMarkings:
      resolution.xEdges != null
        ? (pitchMarkings ?? pitchMarkingsForZonePreset(zonePreset))
        : pitchMarkings,
  };
}

export function HeatmapStaticSvg({
  theme = LIGHT_THEME,
  ...props
}: HeatmapProps & { theme?: UITheme }) {
  const { pitchTheme, pitchColors, autoPitchLines = true, cells } = props;
  const { model, pitchMarkings: resolvedPitchMarkings } = buildHeatmapModel(props);
  const resolvedPitchColors = resolveAutoPitchLineColors(pitchColors, {
    autoPitchLines,
    stops: model.scaleBar?.stops,
  });
  const viewBox = computeViewBox(model.pitch.crop, model.pitch.attackingDirection);

  return (
    <Pitch
      crop={model.pitch.crop}
      attackingDirection={model.pitch.attackingDirection}
      interactive={false}
      role="img"
      ariaLabel={
        model.meta.empty
          ? "Heatmap: no events"
          : `Heatmap: ${model.grid.columns}x${model.grid.rows} grid`
      }
      {...(pitchTheme != null ? { theme: pitchTheme } : {})}
      {...(resolvedPitchColors != null ? { colors: resolvedPitchColors } : {})}
      {...(resolvedPitchMarkings != null ? { markings: resolvedPitchMarkings } : {})}
      underlay={({ project }) => (
        <StaticHeatmapCells
          cells={model.grid.cells}
          project={project}
          style={cells}
          theme={theme}
        />
      )}
    >
      {() => (
        <>
          {model.meta.warnings.length > 0 ? (
            <desc>{model.meta.warnings.join(" ")}</desc>
          ) : null}
          {model.emptyState ? (
            <text
              x={viewBox.minX + viewBox.width / 2}
              y={viewBox.minY + viewBox.height / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill={theme.text.secondary}
              fontSize={4}
              fontWeight={700}
            >
              {model.emptyState.message}
            </text>
          ) : null}
        </>
      )}
    </Pitch>
  );
}

export function Heatmap({
  events,
  gridX,
  gridY,
  xEdges,
  yEdges,
  zonePreset,
  colorScale,
  colorStops,
  attackingDirection,
  crop,
  metricLabel = "Events",
  valueMode = "count",
  pitchTheme,
  pitchColors,
  pitchMarkings,
  autoPitchLines = true,
  cells,
  showScaleBar = true,
  framePadding,
  maxWidth,
  overlay,
  showCellTooltip = true,
}: HeatmapProps) {
  const theme = useTheme();
  const { model, pitchMarkings: resolvedPitchMarkings } = useMemo(
    () =>
      buildHeatmapModel({
        events,
        metricLabel,
        valueMode,
        ...(gridX != null ? { gridX } : {}),
        ...(gridY != null ? { gridY } : {}),
        ...(xEdges != null ? { xEdges } : {}),
        ...(yEdges != null ? { yEdges } : {}),
        ...(zonePreset != null ? { zonePreset } : {}),
        ...(colorScale != null ? { colorScale } : {}),
        ...(colorStops != null ? { colorStops } : {}),
        ...(attackingDirection != null ? { attackingDirection } : {}),
        ...(crop != null ? { crop } : {}),
        ...(pitchMarkings != null ? { pitchMarkings } : {}),
      }),
    [
      events,
      gridX,
      gridY,
      xEdges,
      yEdges,
      zonePreset,
      colorScale,
      colorStops,
      attackingDirection,
      crop,
      metricLabel,
      valueMode,
      pitchMarkings,
    ],
  );

  const resolvedPitchColors = useMemo(
    () =>
      resolveAutoPitchLineColors(pitchColors, {
        autoPitchLines,
        stops: model.scaleBar?.stops,
      }),
    [pitchColors, model.scaleBar?.stops, autoPitchLines],
  );

  const [activeCell, setActiveCell] = useState<string | null>(null);

  const activeCellModel =
    activeCell != null
      ? (model.grid.cells.find((c) => `${c.row}-${c.col}` === activeCell) ?? null)
      : null;

  const scaleBar: ReactNode =
    showScaleBar && model.scaleBar ? (
      <ChartScaleBar
        label={model.scaleBar.label}
        startLabel={formatScaleValue(model.scaleBar.domain[0], model.scaleBar.valueMode)}
        endLabel={formatScaleValue(model.scaleBar.domain[1], model.scaleBar.valueMode)}
        stops={model.scaleBar.stops}
        testId="heatmap-scale-bar"
        theme={theme}
      />
    ) : null;

  return (
    <PitchChartFrame
      ariaLabel={
        model.meta.empty
          ? "Heatmap: no events"
          : `Heatmap: ${model.grid.columns}x${model.grid.rows} grid`
      }
      chartKind="heatmap"
      empty={model.emptyState != null}
      maxWidth={
        maxWidth ??
        (model.meta.attackingDirection === "left" ||
        model.meta.attackingDirection === "right"
          ? 640
          : model.meta.crop === "half"
            ? 420
            : 360)
      }
      plot={
        <div style={{ position: "relative" }}>
          <Pitch
            crop={model.pitch.crop}
            attackingDirection={model.pitch.attackingDirection}
            {...(pitchTheme != null ? { theme: pitchTheme } : {})}
            {...(resolvedPitchColors != null ? { colors: resolvedPitchColors } : {})}
            {...(resolvedPitchMarkings != null
              ? { markings: resolvedPitchMarkings }
              : {})}
            underlay={({ project }) =>
              showCellTooltip ? (
                <HeatmapCells
                  cells={model.grid.cells}
                  project={project}
                  activeCell={activeCell}
                  onCellEnter={setActiveCell}
                  onCellLeave={(key) => {
                    setActiveCell((current) => (current === key ? null : current));
                  }}
                  metricLabel={metricLabel}
                  style={cells}
                  theme={theme}
                />
              ) : (
                <StaticHeatmapCells
                  cells={model.grid.cells}
                  project={project}
                  style={cells}
                  theme={theme}
                />
              )
            }
          >
            {({ project }) => <>{overlay?.({ project })}</>}
          </Pitch>

          {model.emptyState && overlay == null ? (
            <EmptyState message={model.emptyState.message} theme={theme} />
          ) : null}

          {showCellTooltip && activeCellModel ? (
            <ChartTooltip
              testId="heatmap-tooltip"
              rows={buildTooltipRows(activeCellModel, metricLabel, valueMode)}
              theme={theme}
            />
          ) : null}
        </div>
      }
      postPlot={scaleBar}
      theme={theme}
      warnings={model.meta.warnings}
      {...(framePadding != null ? { padding: framePadding } : {})}
    />
  );
}
