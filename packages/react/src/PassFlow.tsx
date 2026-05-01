import { useEffect, useId, useMemo, useState, type ReactNode } from "react";

import {
  computePassFlow,
  type ComputePassFlowInput,
  type PassFlowBinModel,
  type PassFlowLowDispersionGlyph,
  type PassFlowValueMode,
} from "./compute/pass-flow.js";
import type { ColorStop } from "./compute/color.js";
import {
  computeViewBox,
  Pitch,
  type PitchColors,
  type PitchMarkingsConfig,
  type PitchPreset,
  type ProjectFn,
  type Theme as PitchTheme,
} from "@withqwerty/campos-stadia";

import { useTheme } from "./ThemeContext.js";
import { pickContrast } from "./colorContrast.js";
import { resolveAutoPitchLineColors } from "./pitchContrast.js";
import { LIGHT_THEME, type UITheme } from "./theme.js";
import {
  ChartFlowArrowLayer,
  ChartFlowDestinationOverlay,
  ChartHeatmapCellLayer,
  ChartScaleBar,
  ChartTooltip,
  EmptyState,
  PitchChartFrame,
  type ChartHeatmapCellMark,
  type PassFlowAnimate,
  type PassFlowFilterTransition,
} from "./primitives/index.js";

export type PassFlowProps = {
  passes: ComputePassFlowInput["passes"];
  crop?: ComputePassFlowInput["crop"];
  attackingDirection?: ComputePassFlowInput["attackingDirection"];
  bins?: ComputePassFlowInput["bins"];
  xEdges?: ComputePassFlowInput["xEdges"];
  yEdges?: ComputePassFlowInput["yEdges"];
  completionFilter?: ComputePassFlowInput["completionFilter"];
  directionFilter?: ComputePassFlowInput["directionFilter"];
  minMinute?: number;
  maxMinute?: number;
  periodFilter?: ComputePassFlowInput["periodFilter"];
  valueMode?: PassFlowValueMode;
  colorScale?: ComputePassFlowInput["colorScale"];
  colorStops?: ColorStop[];
  arrowLengthMode?: ComputePassFlowInput["arrowLengthMode"];
  dispersionFloor?: number;
  minCountForArrow?: number;
  lowDispersionGlyph?: PassFlowLowDispersionGlyph;
  metricLabel?: string;
  /**
   * Fraction of `min(binW, binH)` that `magnitudeHint=1` arrows span. Clamped
   * to `[0.2, 1]`. @default 0.8
   */
  arrowContainment?: number;
  /**
   * Arrow colour. Three forms accepted:
   *   - any CSS colour string — a single colour for every arrow.
   *   - the literal sentinel `"contrast"` — auto-pick light vs dark per
   *     bin against `bin.fill` using WCAG relative luminance. Recommended
   *     when the chart uses a sequential or diverging colour scale where
   *     the background luminance varies sharply across cells.
   *   - callback `(bin) => string` for arbitrary per-bin logic.
   * Defaults to a theme-derived dark neutral.
   */
  arrowColor?: string | ((bin: PassFlowBinModel) => string);
  /**
   * Colour for the low-dispersion glyph (the circle / cross rendered when
   * a bin fails the arrow gate). Same scalar / `"contrast"` form as
   * `arrowColor`. Falls back to the resolved arrow colour. Use
   * `"contrast"` to keep glyphs readable on dense colour scales.
   */
  lowDispersionGlyphColor?: string;
  /**
   * Cartographic halo around arrows + glyphs — a thin contrasting stroke
   * rendered behind the foreground stroke that survives any background
   * colour without per-bin computation. `true` enables theme defaults
   * (auto-picks halo colour against `bin.fill`); pass an object to pin
   * a colour or width. Pairs nicely with `arrowColor: "contrast"` for
   * belt-and-braces readability over multi-tone scales.
   *
   * `color` accepts the same scalar / `"contrast"` sentinel form as
   * `arrowColor`.
   */
  arrowHalo?: boolean | { color?: string; width?: number };
  /**
   * Arrowhead width/height as a multiple of strokeWidth. @default 3
   */
  arrowheadScale?: number;
  /**
   * Marching-dashes animation. `"dashes"` animates every arrow;
   * `"dashes-on-hover"` animates only the arrow on the currently-hovered
   * bin. Honours `prefers-reduced-motion: reduce`. @default "none"
   */
  animate?: PassFlowAnimate;
  /**
   * When `"morph"`, arrows smoothly reposition to the new mean direction
   * on prop-driven filter changes (e.g. `directionFilter` flip), instead
   * of jump-cutting. Every bin is always rendered as both a line and a
   * glyph with opacity toggling, so transitions fire on geometry attrs.
   * Honours `prefers-reduced-motion: reduce`. @default "none"
   */
  filterTransition?: PassFlowFilterTransition;
  /**
   * When true, hovering a bin overlays every pass destination from that bin
   * as a small dot connected to the bin centre by a faint line. Answers
   * "where did these passes actually go?" — the spread that a single
   * mean-direction arrow hides. Turning this on implicitly opts the compute
   * layer into `captureDestinations: true`, allocating a per-pass object
   * per non-empty bin, so only enable it when the overlay is wanted.
   * @default false
   */
  showHoverDestinations?: boolean;
  /**
   * Colour for the hover-destination overlay marks. Accepts a scalar or
   * the `"contrast"` sentinel (picks against the active bin's fill —
   * single decision per hover, no salt-and-pepper risk). Falls back to
   * the resolved arrow colour (when scalar) or the theme's primary text
   * colour.
   */
  hoverDestinationColor?: string;
  /** Header stats row visibility. @default true */
  showHeaderStats?: boolean;
  /** Colourbar legend visibility. @default true */
  showLegend?: boolean;
  pitchPreset?: PitchPreset;
  pitchTheme?: PitchTheme;
  pitchColors?: PitchColors;
  /**
   * Tactical pitch markings drawn beneath the bins (half-spaces, thirds,
   * or an 18/20-zone grid). When `pitchMarkings.zones` matches the
   * layout passed to `zoneEdgesInCampos(layout)`, the rendered cells
   * align exactly with the visible zone lines.
   */
  pitchMarkings?: PitchMarkingsConfig;
  /**
   * Auto-invert pitch lines on dark colour scales (mirrors Heatmap). @default true
   */
  autoPitchLines?: boolean;
  /** Chart-frame padding override in pixels. */
  framePadding?: number;
  /** Chart-frame max-width override in pixels. */
  maxWidth?: number;
};

const DEFAULT_ARROW_CONTAINMENT = 0.8;
const DEFAULT_ARROWHEAD_SCALE = 3;

/** SVG-safe prefix from a React `useId()` output (strips colons). */
function svgSafeId(raw: string, prefix: string): string {
  return `${prefix}-${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
}

/**
 * Resolve a `string | "contrast" | (bin) => string` colour spec into the
 * shape the primitive accepts (scalar or callback). Scalar inputs stay
 * scalar so the layer's marker-id pooling keeps emitting one marker per
 * actual colour — only `"contrast"` and explicit callbacks become
 * functions. Returns `fallback` (a scalar) when `spec` is undefined.
 */
function resolveBinColor(
  spec: string | ((bin: PassFlowBinModel) => string) | undefined,
  fallback: string,
  contrastCandidates: readonly string[],
): string | ((bin: PassFlowBinModel) => string) {
  if (spec === "contrast") {
    return (bin) => pickContrast(bin.fill, contrastCandidates);
  }
  if (typeof spec === "function") return spec;
  return spec ?? fallback;
}

/**
 * Resolve `arrowHalo` (boolean or object) into the concrete shape the
 * arrow layer expects, or `undefined` when haloing is off.
 */
function resolveHalo(
  spec: PassFlowProps["arrowHalo"],
  contrastCandidates: readonly string[],
  haloColors: { onLight: string; onDark: string },
): { color: (bin: PassFlowBinModel) => string; width: number } | undefined {
  if (spec == null || spec === false) return undefined;
  const obj = spec === true ? {} : spec;
  // Halo defaults: pick the OPPOSITE end of the contrast pair against the
  // bin fill, so a dark arrow over a light cell gets a light halo (and
  // vice-versa). Width default is a multiplier on top of the bin's own
  // resolved stroke — the layer adds it on top.
  const colorSpec = obj.color;
  const colorFn: (bin: PassFlowBinModel) => string =
    typeof colorSpec === "function"
      ? colorSpec
      : colorSpec === "contrast" || colorSpec == null
        ? (bin) => pickContrast(bin.fill, [haloColors.onLight, haloColors.onDark])
        : () => colorSpec;
  // contrastCandidates is unused here — the halo always uses haloColors —
  // but kept in the signature to match the arrow-color resolver shape and
  // ease future refactors.
  void contrastCandidates;
  return { color: colorFn, width: obj.width ?? 2.5 };
}

function binAriaLabel(bin: PassFlowBinModel, metricLabel: string): string {
  const direction =
    bin.meanAngle != null
      ? `, direction ${Math.round((bin.meanAngle * 180) / Math.PI)}°`
      : "";
  return `${metricLabel} zone col ${bin.col + 1} row ${bin.row + 1}: ${bin.count} passes${direction}`;
}

function toCellMark(
  bin: PassFlowBinModel,
  interactive: boolean,
  metricLabel: string,
): ChartHeatmapCellMark {
  const base: ChartHeatmapCellMark = {
    key: bin.key,
    x: bin.x,
    y: bin.y,
    width: bin.width,
    height: bin.height,
    fill: bin.fill,
    opacity: bin.opacity,
    interactive: interactive && bin.count > 0,
  };
  if (interactive && bin.count > 0) {
    base.role = "button";
    base.tabIndex = 0;
    base.ariaLabel = binAriaLabel(bin, metricLabel);
  }
  return base;
}

function formatDomainValue(value: number, valueMode: PassFlowValueMode): string {
  switch (valueMode) {
    case "count":
      return value.toFixed(0);
    case "share":
      return `${(value * 100).toFixed(1)}%`;
    case "relative-frequency":
      return value.toFixed(2);
  }
}

function buildModel(props: PassFlowProps & { showHoverDestinations?: boolean }) {
  const input: ComputePassFlowInput = {
    passes: props.passes,
    ...(props.crop != null ? { crop: props.crop } : {}),
    ...(props.attackingDirection != null
      ? { attackingDirection: props.attackingDirection }
      : {}),
    ...(props.bins != null ? { bins: props.bins } : {}),
    ...(props.xEdges != null ? { xEdges: props.xEdges } : {}),
    ...(props.yEdges != null ? { yEdges: props.yEdges } : {}),
    ...(props.completionFilter != null
      ? { completionFilter: props.completionFilter }
      : {}),
    ...(props.directionFilter != null ? { directionFilter: props.directionFilter } : {}),
    ...(props.minMinute != null ? { minMinute: props.minMinute } : {}),
    ...(props.maxMinute != null ? { maxMinute: props.maxMinute } : {}),
    ...(props.periodFilter != null ? { periodFilter: props.periodFilter } : {}),
    ...(props.showHoverDestinations === true ? { captureDestinations: true } : {}),
    ...(props.valueMode != null ? { valueMode: props.valueMode } : {}),
    ...(props.colorScale != null ? { colorScale: props.colorScale } : {}),
    ...(props.colorStops != null ? { colorStops: props.colorStops } : {}),
    ...(props.arrowLengthMode != null ? { arrowLengthMode: props.arrowLengthMode } : {}),
    ...(props.dispersionFloor != null ? { dispersionFloor: props.dispersionFloor } : {}),
    ...(props.minCountForArrow != null
      ? { minCountForArrow: props.minCountForArrow }
      : {}),
    ...(props.lowDispersionGlyph != null
      ? { lowDispersionGlyph: props.lowDispersionGlyph }
      : {}),
    ...(props.metricLabel != null ? { metricLabel: props.metricLabel } : {}),
  };
  return computePassFlow(input);
}

function HeaderStatsRow({
  items,
  theme,
}: {
  items: Array<{ label: string; value: string }>;
  theme: UITheme;
}) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "grid", gap: 2 }}>
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: theme.text.muted,
            }}
          >
            {item.label}
          </span>
          <span style={{ fontSize: 20, fontWeight: 600 }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function PassFlowPlot({
  bins,
  project,
  arrowColor,
  glyphColor,
  halo,
  arrowContainment,
  lowDispersionGlyph,
  arrowheadId,
  arrowheadScale,
  animate,
  activeBinKey,
  filterTransition,
}: {
  bins: readonly PassFlowBinModel[];
  project: ProjectFn;
  arrowColor: string | ((bin: PassFlowBinModel) => string);
  glyphColor: string | ((bin: PassFlowBinModel) => string);
  halo: { color: (bin: PassFlowBinModel) => string; width: number } | undefined;
  arrowContainment: number;
  lowDispersionGlyph: PassFlowLowDispersionGlyph;
  arrowheadId: string;
  arrowheadScale: number;
  animate: PassFlowAnimate;
  activeBinKey: string | null;
  filterTransition: PassFlowFilterTransition;
}) {
  return (
    <ChartFlowArrowLayer
      bins={bins}
      project={project}
      arrowContainment={arrowContainment}
      lowDispersionGlyph={lowDispersionGlyph}
      color={arrowColor}
      glyphColor={glyphColor}
      {...(halo != null ? { halo } : {})}
      arrowheadId={arrowheadId}
      arrowheadScale={arrowheadScale}
      animate={animate}
      activeBinKey={activeBinKey}
      filterTransition={filterTransition}
    />
  );
}

// ---------------------------------------------------------------------------
// Static (stateless) export variant
// ---------------------------------------------------------------------------

export function PassFlowStaticSvg({
  theme = LIGHT_THEME,
  ...props
}: PassFlowProps & { theme?: UITheme }) {
  const model = buildModel(props);
  const {
    pitchPreset,
    pitchTheme,
    pitchColors,
    pitchMarkings,
    autoPitchLines = true,
    arrowContainment = DEFAULT_ARROW_CONTAINMENT,
    arrowColor,
    lowDispersionGlyphColor,
    arrowHalo,
    arrowheadScale = DEFAULT_ARROWHEAD_SCALE,
    animate = "none",
    filterTransition = "none",
  } = props;
  const contrastCandidates = [theme.contrast.onLight, theme.contrast.onDark];
  const arrowColorFn = resolveBinColor(
    arrowColor,
    theme.text.primary,
    contrastCandidates,
  );
  const glyphColorFn =
    lowDispersionGlyphColor != null
      ? resolveBinColor(lowDispersionGlyphColor, "", contrastCandidates)
      : arrowColorFn;
  const halo = resolveHalo(arrowHalo, contrastCandidates, theme.contrast.halo);
  const resolvedPitchColors = resolveAutoPitchLineColors(pitchColors, {
    autoPitchLines,
    stops: model.legend?.stops,
  });
  const viewBox = computeViewBox(
    model.plot.pitch.crop,
    model.plot.pitch.attackingDirection,
  );
  const metricLabel = model.legend?.title ?? "Passes";
  // Per-instance id so multiple static exports on the same page don't
  // collide on the shared `<marker>` id.
  const arrowheadId = svgSafeId(useId(), "passflow-static-arrow");

  return (
    <Pitch
      crop={model.plot.pitch.crop}
      attackingDirection={model.plot.pitch.attackingDirection}
      interactive={false}
      role="img"
      ariaLabel={model.meta.accessibleLabel}
      {...(pitchPreset != null ? { preset: pitchPreset } : {})}
      {...(pitchTheme != null ? { theme: pitchTheme } : {})}
      {...(resolvedPitchColors != null ? { colors: resolvedPitchColors } : {})}
      {...(pitchMarkings != null ? { markings: pitchMarkings } : {})}
      underlay={({ project }) => (
        <ChartHeatmapCellLayer
          cells={model.grid.bins
            .map((bin) => toCellMark(bin, false, metricLabel))
            .filter((mark) => mark.opacity > 0)}
          project={project}
          theme={theme}
        />
      )}
    >
      {({ project }) =>
        model.emptyState ? (
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
        ) : (
          <PassFlowPlot
            bins={model.grid.bins}
            project={project}
            arrowColor={arrowColorFn}
            glyphColor={glyphColorFn}
            halo={halo}
            arrowContainment={arrowContainment}
            lowDispersionGlyph={model.meta.lowDispersionGlyph}
            arrowheadId={arrowheadId}
            arrowheadScale={arrowheadScale}
            animate={animate}
            activeBinKey={null}
            filterTransition={filterTransition}
          />
        )
      }
    </Pitch>
  );
}

// ---------------------------------------------------------------------------
// Interactive variant
// ---------------------------------------------------------------------------

export function PassFlow(props: PassFlowProps) {
  const theme = useTheme();
  const {
    passes,
    crop,
    attackingDirection,
    bins,
    xEdges,
    yEdges,
    completionFilter,
    directionFilter,
    minMinute,
    maxMinute,
    periodFilter,
    valueMode,
    colorScale,
    colorStops,
    arrowLengthMode,
    dispersionFloor,
    minCountForArrow,
    lowDispersionGlyph,
    metricLabel,
    arrowContainment = DEFAULT_ARROW_CONTAINMENT,
    arrowColor,
    lowDispersionGlyphColor,
    arrowHalo,
    arrowheadScale = DEFAULT_ARROWHEAD_SCALE,
    animate = "none",
    filterTransition = "none",
    showHoverDestinations = false,
    hoverDestinationColor,
    showHeaderStats = true,
    showLegend = true,
    pitchPreset,
    pitchTheme,
    pitchColors,
    pitchMarkings,
    autoPitchLines = true,
    framePadding,
    maxWidth,
  } = props;

  const model = useMemo(
    () =>
      buildModel({
        passes,
        ...(crop != null ? { crop } : {}),
        ...(attackingDirection != null ? { attackingDirection } : {}),
        ...(bins != null ? { bins } : {}),
        ...(xEdges != null ? { xEdges } : {}),
        ...(yEdges != null ? { yEdges } : {}),
        ...(completionFilter != null ? { completionFilter } : {}),
        ...(directionFilter != null ? { directionFilter } : {}),
        ...(minMinute != null ? { minMinute } : {}),
        ...(maxMinute != null ? { maxMinute } : {}),
        ...(periodFilter != null ? { periodFilter } : {}),
        ...(valueMode != null ? { valueMode } : {}),
        ...(colorScale != null ? { colorScale } : {}),
        ...(colorStops != null ? { colorStops } : {}),
        ...(arrowLengthMode != null ? { arrowLengthMode } : {}),
        ...(dispersionFloor != null ? { dispersionFloor } : {}),
        ...(minCountForArrow != null ? { minCountForArrow } : {}),
        ...(lowDispersionGlyph != null ? { lowDispersionGlyph } : {}),
        ...(metricLabel != null ? { metricLabel } : {}),
        ...(showHoverDestinations ? { showHoverDestinations: true } : {}),
      }),
    [
      passes,
      crop,
      attackingDirection,
      bins,
      xEdges,
      yEdges,
      completionFilter,
      directionFilter,
      minMinute,
      maxMinute,
      periodFilter,
      valueMode,
      colorScale,
      colorStops,
      arrowLengthMode,
      dispersionFloor,
      minCountForArrow,
      lowDispersionGlyph,
      metricLabel,
      showHoverDestinations,
    ],
  );

  const contrastCandidates = useMemo(
    () => [theme.contrast.onLight, theme.contrast.onDark],
    [theme.contrast.onLight, theme.contrast.onDark],
  );
  const arrowColorFn = useMemo(
    () => resolveBinColor(arrowColor, theme.text.primary, contrastCandidates),
    [arrowColor, theme.text.primary, contrastCandidates],
  );
  const glyphColorFn = useMemo(() => {
    if (lowDispersionGlyphColor != null) {
      return resolveBinColor(lowDispersionGlyphColor, "", contrastCandidates);
    }
    return arrowColorFn;
  }, [lowDispersionGlyphColor, arrowColorFn, contrastCandidates]);
  const halo = useMemo(
    () => resolveHalo(arrowHalo, contrastCandidates, theme.contrast.halo),
    [arrowHalo, contrastCandidates, theme.contrast.halo],
  );
  const resolvedPitchColors = useMemo(
    () =>
      resolveAutoPitchLineColors(pitchColors, {
        autoPitchLines,
        stops: model.legend?.stops,
      }),
    [pitchColors, autoPitchLines, model.legend?.stops],
  );
  // Per-instance id so multiple interactive `<PassFlow>` on the same page
  // keep distinct `<marker>` ids and distinct CSS animation scopes.
  const arrowheadId = svgSafeId(useId(), "passflow-arrow");

  const [activeBinKey, setActiveBinKey] = useState<string | null>(null);
  // activeBin is derived from the CURRENT model's bins. If the model
  // recomputes (e.g. filter toggle) while a bin is hovered, any stale key
  // that doesn't match a non-empty bin in the new model resolves to null
  // in the same render — no one-frame wrong-data tooltip flash. Hovering
  // over a bin that survives the recompute keeps the tooltip live, which
  // is the intent of `filterTransition="morph"`.
  const activeBin = useMemo(() => {
    if (activeBinKey == null) return null;
    const match = model.grid.bins.find(
      (bin) => bin.key === activeBinKey && bin.count > 0,
    );
    return match ?? null;
  }, [activeBinKey, model.grid.bins]);
  // When the user is pointing at an empty cell post-recompute, clear the
  // stored key so a subsequent hover can re-acquire. The setState-in-effect
  // is intentional: we need a commit to happen with the stale key (which
  // renders nothing because activeBin is already null), and only then
  // clear it so the next hover fires a fresh mouseEnter.
  useEffect(() => {
    if (activeBinKey != null && activeBin == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-recompute reset
      setActiveBinKey(null);
    }
  }, [activeBinKey, activeBin]);

  const resolvedMetricLabel = metricLabel ?? model.legend?.title ?? "Passes";

  const plot: ReactNode = (
    <div
      style={{ position: "relative", minHeight: 0 }}
      onMouseLeave={() => {
        // Catch the orphan-hover case — pointer leaves the plot area
        // without a corresponding per-cell mouseleave (layout shift,
        // alt-tab, fast exit across the chart edge). Without this, a
        // stale activeBinKey keeps the tooltip open under no cursor.
        setActiveBinKey(null);
      }}
    >
      <Pitch
        crop={model.plot.pitch.crop}
        attackingDirection={model.plot.pitch.attackingDirection}
        {...(pitchPreset != null ? { preset: pitchPreset } : {})}
        {...(pitchTheme != null ? { theme: pitchTheme } : {})}
        {...(resolvedPitchColors != null ? { colors: resolvedPitchColors } : {})}
        {...(pitchMarkings != null ? { markings: pitchMarkings } : {})}
        underlay={({ project }) => (
          <ChartHeatmapCellLayer
            cells={model.grid.bins
              .map((bin) => toCellMark(bin, true, resolvedMetricLabel))
              .filter((mark) => mark.opacity > 0 || mark.fill !== "rgba(0,0,0,0)")}
            project={project}
            theme={theme}
            activeKey={activeBinKey}
            onCellEnter={setActiveBinKey}
            onCellLeave={(key) => {
              setActiveBinKey((current) => (current === key ? null : current));
            }}
            onCellClick={setActiveBinKey}
          />
        )}
      >
        {({ project }) => (
          <>
            <PassFlowPlot
              bins={model.grid.bins}
              project={project}
              arrowColor={arrowColorFn}
              glyphColor={glyphColorFn}
              halo={halo}
              arrowContainment={arrowContainment}
              lowDispersionGlyph={model.meta.lowDispersionGlyph}
              arrowheadId={arrowheadId}
              arrowheadScale={arrowheadScale}
              animate={animate}
              activeBinKey={activeBinKey}
              filterTransition={filterTransition}
            />
            {showHoverDestinations && activeBin && activeBin.destinations.length > 0 ? (
              <ChartFlowDestinationOverlay
                bin={activeBin}
                project={project}
                color={
                  // Resolve hoverDestinationColor against the active bin's
                  // fill — single decision per hover, no salt-and-pepper risk.
                  hoverDestinationColor === "contrast"
                    ? pickContrast(activeBin.fill, contrastCandidates)
                    : (hoverDestinationColor ??
                      (typeof arrowColorFn === "function"
                        ? arrowColorFn(activeBin)
                        : arrowColorFn))
                }
              />
            ) : null}
          </>
        )}
      </Pitch>

      {model.emptyState ? (
        <EmptyState message={model.emptyState.message} theme={theme} />
      ) : null}

      {activeBin ? (
        <ChartTooltip
          testId="passflow-tooltip"
          rows={activeBin.tooltip.rows.map((row) => ({
            label: row.label,
            value: row.value,
          }))}
          theme={theme}
        />
      ) : null}
    </div>
  );

  const legend: ReactNode =
    showLegend && model.legend ? (
      <ChartScaleBar
        label={model.legend.title}
        startLabel={formatDomainValue(model.legend.domain[0], model.legend.valueMode)}
        endLabel={formatDomainValue(model.legend.domain[1], model.legend.valueMode)}
        stops={model.legend.stops}
        testId="passflow-scale-bar"
        theme={theme}
      />
    ) : null;

  return (
    <PitchChartFrame
      ariaLabel={model.meta.accessibleLabel}
      chartKind="pass-flow"
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
      prePlot={
        showHeaderStats && model.headerStats ? (
          <HeaderStatsRow items={model.headerStats.items} theme={theme} />
        ) : null
      }
      plot={plot}
      postPlot={legend}
      theme={theme}
      warnings={model.meta.warnings}
      {...(framePadding != null ? { padding: framePadding } : {})}
    />
  );
}
