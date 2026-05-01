import { useMemo } from "react";

import {
  computeTerritory,
  type ComputeTerritoryInput,
  type TerritoryCell,
  type TerritoryGrid,
  type TerritoryModel,
  type TerritoryZonePreset,
} from "./compute/index.js";
import type { ColorStop, HeatmapColorScale } from "./compute/index.js";
import {
  Pitch,
  resolvePitchPreset,
  type ProjectFn,
  type Theme as PitchTheme,
  type PitchColors,
  type PitchPreset,
} from "@withqwerty/campos-stadia";

import { hexLuminance } from "./colorUtils.js";
import { useTheme } from "./ThemeContext.js";
import { pickContrast } from "./colorContrast.js";
import { pitchMarkingsForZonePreset } from "./pitchZonePresets.js";
import { resolveAutoPitchLineColors } from "./pitchContrast.js";
import { projectPitchRect } from "./pitchGeometry.js";
import { resolveStyleValue, type StyleValue } from "./styleValue.js";
import { LIGHT_THEME, type UITheme } from "./theme.js";
import { EmptyState, PitchChartFrame } from "./primitives/index.js";

export type TerritoryProps = {
  events: ComputeTerritoryInput["events"];
  /** Grid resolution. @default "3x3" */
  grid?: TerritoryGrid;
  /**
   * Shared named pitch-zone preset. Overrides `grid` when supplied.
   * Use this for tactical 18 / 20 zone layouts.
   */
  zonePreset?: TerritoryZonePreset;
  /** Direction attacker is facing. @default "up" */
  attackingDirection?: "up" | "down" | "left" | "right";
  /** Pitch crop. @default "full" */
  crop?: "full" | "half";
  /** Show in-cell percentage labels. @default true */
  showLabels?: boolean;
  /**
   * How in-cell labels are placed to avoid overlapping structural pitch
   * lines. Broadcast 3×3 grids have their cell centers exactly on the
   * halfway line and penalty box edges, so a centered label without
   * decoration always intersects a pitch marking.
   *
   * - `"offset"` (default): labels shifted toward the inner-top corner of
   *   each cell. Keeps the graphic visually minimal.
   * - `"badge"`: labels stay centered but render over a rounded dark pill
   *   background. Bolder, broadcast-badge aesthetic.
   *
   * @default "offset"
   */
  labelStyle?: TerritoryLabelStyle;
  /** Filter events to a single team before binning. */
  teamFilter?: string;
  /** Sequential color scale. @default "magma" */
  colorScale?: HeatmapColorScale;
  /** Custom color stops when colorScale is "custom". */
  colorStops?: ColorStop[];
  /**
   * Noun describing what each event measures (e.g. "touches", "passes").
   * Flows into the accessible label and the per-cell aria descriptions.
   * @default "events"
   */
  metricLabel?: string;
  pitchPreset?: PitchPreset;
  pitchTheme?: PitchTheme;
  pitchColors?: PitchColors;
  /**
   * When true (default), Territory automatically sets white pitch lines over
   * dark color scales (magma/inferno/viridis/custom) so the pitch markings
   * remain visible through the dense cell fills. Set to false to pass
   * `pitchColors` through unchanged. Mirrors `Heatmap.autoPitchLines`.
   * @default true
   */
  autoPitchLines?: boolean;
  /** Override the section's accessible label. */
  ariaLabel?: string;
  cells?: TerritoryCellsStyle;
  labels?: TerritoryLabelsStyle;
  /** Override frame padding in pixels. Default 16. Set to 0 for composites. */
  framePadding?: number;
  /** Override the chart frame max-width in pixels. Default varies by attackingDirection/crop. */
  maxWidth?: number;
};

function defaultAriaLabel(model: TerritoryModel): string {
  if (model.meta.empty) {
    return `Territory: no ${model.meta.metricLabel}`;
  }
  const zoneCount = model.grid.cells.length;
  return `Territory: ${zoneCount} zones, ${model.meta.totalEvents} ${model.meta.metricLabel}`;
}

export type TerritoryLabelStyle = "offset" | "badge";

export type TerritoryCellStyleContext = {
  cell: TerritoryCell;
  theme: UITheme;
};

export type TerritoryCellsStyle = {
  show?: StyleValue<boolean, TerritoryCellStyleContext>;
  fill?: StyleValue<string, TerritoryCellStyleContext>;
  opacity?: StyleValue<number, TerritoryCellStyleContext>;
  stroke?: StyleValue<string, TerritoryCellStyleContext>;
  strokeWidth?: StyleValue<number, TerritoryCellStyleContext>;
};

export type TerritoryLabelStyleContext = {
  cell: TerritoryCell;
  theme: UITheme;
  labelStyle: TerritoryLabelStyle;
};

export type TerritoryLabelsStyle = {
  show?: StyleValue<boolean, TerritoryLabelStyleContext>;
  fill?: StyleValue<string, TerritoryLabelStyleContext>;
  background?: StyleValue<string, TerritoryLabelStyleContext>;
  opacity?: StyleValue<number, TerritoryLabelStyleContext>;
  fontSize?: StyleValue<number, TerritoryLabelStyleContext>;
};

function TerritoryCells({
  cells,
  project,
  showLabels,
  badgeBg,
  badgeText,
  labelStyle,
  cellStyle,
  labels,
  theme,
}: {
  cells: TerritoryCell[];
  project: ProjectFn;
  showLabels: boolean;
  badgeBg: string;
  badgeText: string;
  labelStyle: TerritoryLabelStyle;
  cellStyle: TerritoryCellsStyle | undefined;
  labels: TerritoryLabelsStyle | undefined;
  theme: UITheme;
}) {
  return (
    <g data-campos="territory-cells">
      {cells.map((cell) => {
        const cellContext: TerritoryCellStyleContext = { cell, theme };
        if (resolveStyleValue(cellStyle?.show, cellContext) === false) {
          return null;
        }
        const rect = projectPitchRect(project, cell);
        const center = project(cell.centerX, cell.centerY);
        const key = `${cell.row}-${cell.col}`;

        // Compute label position and decorations based on labelStyle.
        //
        // The collision problem: on a vertical 3×3 grid the cell row centers
        // land at y≈17.5, 52.5, 87.5 in Campos coordinates, which coincide
        // almost exactly with the halfway line (52.5), the near penalty box
        // edge (16.5), and the far penalty box edge (88.5). Labels rendered
        // at geometric cell center always overlap a pitch line in the 3×3
        // case. Both offset and badge modes solve this differently:
        //
        // - "offset": shift the label toward the inner-top corner of each
        //   cell (rect x/y quadrant). Labels are offset from cell-center
        //   intersections so pitch lines pass beside them rather than
        //   through them. Keeps the graphic visually minimal.
        //
        // - "badge": keep the label at geometric cell center but draw a
        //   rounded dark pill behind it. The pill covers the pitch line
        //   locally. Bolder, broadcast-badge aesthetic.
        const labelContext: TerritoryLabelStyleContext = { cell, theme, labelStyle };
        const baseFontSize = Math.min(rect.width * 0.15, rect.height * 0.22);
        const fontSize =
          resolveStyleValue(labels?.fontSize, labelContext) ?? baseFontSize;
        const labelX = labelStyle === "offset" ? rect.x + rect.width * 0.28 : center.x;
        const labelY = labelStyle === "offset" ? rect.y + rect.height * 0.22 : center.y;

        // Badge background dimensions — generous enough for "100%" or "8%"
        // alike without measuring text width. Width = ~3 chars × avg glyph
        // width (fontSize * 0.6). Height = fontSize * 1.4 for padding.
        const badgeWidth = fontSize * 2.8;
        const badgeHeight = fontSize * 1.6;
        const badgeRadius = fontSize * 0.4;
        const resolvedFill = resolveStyleValue(cellStyle?.fill, cellContext) ?? cell.fill;
        const labelFill =
          resolveStyleValue(labels?.fill, labelContext) ??
          (labelStyle === "badge"
            ? badgeText
            : pickContrast(resolvedFill, [
                theme.contrast.onLight,
                theme.contrast.onDark,
              ]));
        const showLabel =
          showLabels &&
          cell.label != null &&
          resolveStyleValue(labels?.show, labelContext) !== false;

        return (
          <g key={key} data-testid="territory-cell">
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill={resolvedFill}
              opacity={resolveStyleValue(cellStyle?.opacity, cellContext) ?? cell.opacity}
              {...(resolveStyleValue(cellStyle?.stroke, cellContext) != null
                ? { stroke: resolveStyleValue(cellStyle?.stroke, cellContext) }
                : {})}
              {...(resolveStyleValue(cellStyle?.strokeWidth, cellContext) != null
                ? {
                    strokeWidth: resolveStyleValue(cellStyle?.strokeWidth, cellContext),
                  }
                : {})}
            />
            {showLabel && labelStyle === "badge" ? (
              <rect
                data-testid="territory-cell-badge"
                x={labelX - badgeWidth / 2}
                y={labelY - badgeHeight / 2}
                width={badgeWidth}
                height={badgeHeight}
                rx={badgeRadius}
                ry={badgeRadius}
                fill={resolveStyleValue(labels?.background, labelContext) ?? badgeBg}
                opacity={0.85}
                style={{ pointerEvents: "none" }}
              />
            ) : null}
            {showLabel ? (
              <text
                data-testid="territory-cell-label"
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fontSize}
                fontWeight={700}
                fill={labelFill}
                {...(() => {
                  const opacity = resolveStyleValue(labels?.opacity, labelContext) ?? 1;
                  return opacity !== 1 ? { opacity } : {};
                })()}
                style={{ pointerEvents: "none" }}
              >
                {cell.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

/**
 * Territory chart — broadcast-style fixed-grid pitch zone diagram.
 *
 * Bins events into a named pitch-zone preset and renders each cell as a
 * colored rectangle with an in-cell percentage label. Designed for editorial /
 * lineup-card / match-preview use cases where the answer to "where did the
 * team play?" should be readable at a glance.
 *
 * Reuses Heatmap's compute internally — Territory is a thin wrapper that
 * substitutes share-driven color and adds label strings.
 */
export function Territory({
  events,
  grid,
  zonePreset,
  attackingDirection,
  crop,
  showLabels = true,
  labelStyle = "offset",
  teamFilter,
  colorScale,
  colorStops,
  metricLabel = "events",
  pitchPreset,
  pitchTheme,
  pitchColors,
  autoPitchLines = true,
  ariaLabel,
  cells,
  labels,
  framePadding,
  maxWidth,
}: TerritoryProps) {
  const theme = useTheme();
  const model = useMemo(
    () =>
      computeTerritory({
        events,
        showLabels,
        metricLabel,
        ...(grid != null ? { grid } : {}),
        ...(zonePreset != null ? { zonePreset } : {}),
        ...(attackingDirection != null ? { attackingDirection } : {}),
        ...(crop != null ? { crop } : {}),
        ...(teamFilter != null ? { teamFilter } : {}),
        ...(colorScale != null ? { colorScale } : {}),
        ...(colorStops != null ? { colorStops } : {}),
      }),
    [
      events,
      grid,
      zonePreset,
      attackingDirection,
      crop,
      showLabels,
      teamFilter,
      colorScale,
      colorStops,
      metricLabel,
    ],
  );

  const computedAriaLabel = ariaLabel ?? defaultAriaLabel(model);

  // Look at the actual rendered pitch fill (preset/theme/colors merged) so
  // the autoPitchLines fallback reflects what the user will see, not a
  // hardcoded assumption. Critical for the white outline default — without
  // this, no-colorScale + outline would paint white-on-white lines.
  const resolvedPitchFill = useMemo(
    () => resolvePitchPreset(pitchPreset, pitchTheme, pitchColors).colors.fill,
    [pitchPreset, pitchTheme, pitchColors],
  );
  const fallbackIsDark = useMemo(
    () => hexLuminance(resolvedPitchFill) < 0.5,
    [resolvedPitchFill],
  );

  const resolvedPitchColors = useMemo<PitchColors | undefined>(
    () =>
      resolveAutoPitchLineColors(pitchColors, {
        autoPitchLines,
        colorScale,
        fallbackIsDark,
        stops: colorStops,
      }),
    [pitchColors, autoPitchLines, colorScale, colorStops, fallbackIsDark],
  );
  const resolvedPitchMarkings = useMemo(
    () => pitchMarkingsForZonePreset(zonePreset),
    [zonePreset],
  );

  return (
    <PitchChartFrame
      ariaLabel={computedAriaLabel}
      chartKind="territory"
      empty={model.emptyState != null}
      maxWidth={
        maxWidth ??
        (model.meta.attackingDirection === "up"
          ? model.meta.crop === "half"
            ? 320
            : 420
          : 640)
      }
      plot={
        <div style={{ position: "relative" }}>
          <Pitch
            crop={model.pitch.crop}
            attackingDirection={model.pitch.attackingDirection}
            {...(pitchPreset != null ? { preset: pitchPreset } : {})}
            {...(pitchTheme != null ? { theme: pitchTheme } : {})}
            {...(resolvedPitchColors != null ? { colors: resolvedPitchColors } : {})}
            {...(resolvedPitchMarkings != null
              ? { markings: resolvedPitchMarkings }
              : {})}
            underlay={({ project }) => (
              <TerritoryCells
                cells={model.grid.cells}
                project={project}
                showLabels={showLabels}
                badgeBg={theme.surface.badge}
                badgeText={theme.text.badge}
                labelStyle={labelStyle}
                cellStyle={cells}
                labels={labels}
                theme={theme}
              />
            )}
          >
            {() => null}
          </Pitch>

          {model.emptyState ? (
            <EmptyState message={model.emptyState.message} theme={theme} />
          ) : null}
        </div>
      }
      theme={theme}
      warnings={model.meta.warnings}
      {...(framePadding != null ? { padding: framePadding } : {})}
    />
  );
}

export function TerritoryStaticSvg({
  theme = LIGHT_THEME,
  ...props
}: TerritoryProps & { theme?: UITheme }) {
  const {
    events,
    grid,
    zonePreset,
    attackingDirection,
    crop,
    showLabels = true,
    labelStyle = "offset",
    teamFilter,
    colorScale,
    colorStops,
    metricLabel = "events",
    pitchPreset,
    pitchTheme,
    pitchColors,
    autoPitchLines = true,
    cells,
    labels,
  } = props;

  const model = computeTerritory({
    events,
    showLabels,
    metricLabel,
    ...(grid != null ? { grid } : {}),
    ...(zonePreset != null ? { zonePreset } : {}),
    ...(attackingDirection != null ? { attackingDirection } : {}),
    ...(crop != null ? { crop } : {}),
    ...(teamFilter != null ? { teamFilter } : {}),
    ...(colorScale != null ? { colorScale } : {}),
    ...(colorStops != null ? { colorStops } : {}),
  });

  const resolvedPitchFill = resolvePitchPreset(pitchPreset, pitchTheme, pitchColors)
    .colors.fill;
  const fallbackIsDark = hexLuminance(resolvedPitchFill) < 0.5;

  const resolvedPitchColors = resolveAutoPitchLineColors(pitchColors, {
    autoPitchLines,
    colorScale,
    fallbackIsDark,
    stops: colorStops,
  });
  const resolvedPitchMarkings = pitchMarkingsForZonePreset(zonePreset);

  return (
    <Pitch
      crop={model.pitch.crop}
      attackingDirection={model.pitch.attackingDirection}
      interactive={false}
      role="img"
      ariaLabel={props.ariaLabel ?? defaultAriaLabel(model)}
      {...(pitchPreset != null ? { preset: pitchPreset } : {})}
      {...(pitchTheme != null ? { theme: pitchTheme } : {})}
      {...(resolvedPitchColors != null ? { colors: resolvedPitchColors } : {})}
      {...(resolvedPitchMarkings != null ? { markings: resolvedPitchMarkings } : {})}
      underlay={({ project }) => (
        <TerritoryCells
          cells={model.grid.cells}
          project={project}
          showLabels={showLabels}
          badgeBg={theme.surface.badge}
          badgeText={theme.text.badge}
          labelStyle={labelStyle}
          cellStyle={cells}
          labels={labels}
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
              x={model.pitch.attackingDirection === "right" ? 52.5 : 34}
              y={model.pitch.attackingDirection === "right" ? 34 : 52.5}
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
