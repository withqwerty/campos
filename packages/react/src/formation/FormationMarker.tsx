import type { ReactElement } from "react";

import {
  deriveFormationLabel,
  type FormationLabelStrategy,
  type RenderedFormationSlot,
} from "../compute/index.js";
import type { ProjectFn } from "@withqwerty/campos-stadia";

import type {
  FormationMarkerBadgesStyle,
  FormationMarkerComposition,
  FormationMarkerLabelsStyle,
  FormationMarkersStyle,
  MarkerSlotContext,
} from "../Formation.js";
import {
  MARKER_SLOT_NAMES,
  computeMarkerSlotLayout,
  resolveGlyph,
  type MarkerSlotName,
  type SlotItemSpec,
} from "../primitives/index.js";
import { resolveStyleValue } from "../styleValue.js";

import { normaliseSlotContent } from "./slotMeasurement.js";
import { STROKE_COLOR, truncateName, type MarkerScale } from "./shared.js";

export type FormationMarkerProps = {
  slot: RenderedFormationSlot;
  project: ProjectFn;
  teamColor: string;
  labelStrategy: FormationLabelStrategy;
  showLabels: boolean;
  showNames: boolean;
  scale: MarkerScale;
  markers?: FormationMarkersStyle;
  markerLabels?: FormationMarkerLabelsStyle;
  markerBadges?: FormationMarkerBadgesStyle;
  markerComposition?: FormationMarkerComposition;
  pitchSvgWidth: number;
  pitchSvgHeight: number;
  pitchSvgMinX?: number;
  pitchSvgMinY?: number;
};

export function FormationMarker(props: FormationMarkerProps): ReactElement {
  const {
    slot,
    project,
    teamColor,
    labelStrategy,
    showLabels,
    showNames,
    scale,
    markers,
    markerLabels,
    markerBadges,
    markerComposition,
    pitchSvgWidth,
    pitchSvgHeight,
    pitchSvgMinX = 0,
    pitchSvgMinY = 0,
  } = props;
  const { x: cx, y: cy } = project(slot.x, slot.y);
  const label = deriveFormationLabel({ slot, strategy: labelStrategy });
  const r = scale.radius;
  const labelFs = scale.labelFontSize;
  const nameFs = scale.nameFontSize;
  const labelStroke = scale.labelStrokeWidth;
  const namePillRx = scale.namePillRx;

  if (slot.placeholder) {
    return (
      <g data-testid="formation-marker-placeholder" transform={`translate(${cx} ${cy})`}>
        <circle
          r={r}
          fill="none"
          stroke={STROKE_COLOR}
          strokeWidth={0.3}
          strokeDasharray="0.9 0.6"
          opacity={0.55}
        />
        {showLabels ? (
          <text
            data-testid="formation-marker-label"
            x={0}
            y={0}
            fill={STROKE_COLOR}
            fontSize={labelFs}
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="central"
            opacity={0.7}
            pointerEvents="none"
            style={{ userSelect: "none" }}
          >
            {slot.positionCode}
          </text>
        ) : null}
      </g>
    );
  }

  const player = slot.player;
  const markerCtx: MarkerSlotContext = { player: player ?? {}, r, teamColor };
  const color =
    resolveStyleValue(markers?.fill, markerCtx) ?? slot.player?.color ?? teamColor;
  const rawNameText =
    markerLabels?.nameFormat != null && player != null
      ? markerLabels.nameFormat(player)
      : (label.secondary ?? null);
  const truncated = rawNameText != null ? truncateName(rawNameText) : null;
  const showNameRendered = showNames && truncated != null;

  const glyphConfig =
    markerComposition?.glyph ??
    (markers?.glyphKind != null
      ? resolveStyleValue(markers.glyphKind, markerCtx)
      : undefined);
  const renderGlyph = resolveGlyph(glyphConfig);
  const resolvedGlyphStroke =
    resolveStyleValue(markers?.stroke, markerCtx) ?? STROKE_COLOR;
  const resolvedGlyphStrokeWidth = resolveStyleValue(markers?.strokeWidth, markerCtx);
  const glyphNode = renderGlyph({
    r,
    teamColor: color,
    label: label.primary,
    labelVisible: showLabels,
    strokeColor: resolvedGlyphStroke,
    strokeWidth: resolvedGlyphStrokeWidth,
    player: player ?? {},
    labelFontSize: labelFs,
    labelStrokeWidth: labelStroke,
  });

  const rawSlotMap =
    player != null && markerComposition?.slots != null
      ? markerComposition.slots({ player, r, teamColor: color })
      : undefined;

  const slotItemSpecs: Partial<Record<MarkerSlotName, SlotItemSpec[]>> = {};
  if (rawSlotMap != null) {
    for (const slotName of MARKER_SLOT_NAMES) {
      const items = normaliseSlotContent(rawSlotMap[slotName], r);
      if (items.length > 0) slotItemSpecs[slotName] = items;
    }
  }

  const pillCharWidth = nameFs * 0.6;
  const pillWidth =
    truncated != null ? Math.max(truncated.length * pillCharWidth, nameFs * 3) : 0;
  const pillHeight = nameFs * 1.5;
  const prefixCtx: MarkerSlotContext = { player: player ?? {}, r, teamColor: color };
  const prefixNode =
    showNameRendered && markerBadges?.prefix != null && player != null
      ? markerBadges.prefix(prefixCtx)
      : null;
  const resolvedNameBackground =
    resolveStyleValue(markerLabels?.background, prefixCtx) ?? STROKE_COLOR;
  const resolvedNameColor =
    resolveStyleValue(markerLabels?.color, prefixCtx) ?? "#ffffff";
  const prefixSize = prefixNode != null ? pillHeight : 0;
  const prefixGap = prefixNode != null ? nameFs * 0.06 : 0;
  const totalRowWidth = prefixSize + prefixGap + pillWidth;
  const pillOffsetX = prefixNode != null ? (prefixSize + prefixGap) / 2 : 0;

  const layout = computeMarkerSlotLayout({
    r,
    nameFontSize: nameFs,
    showName: showNameRendered,
    namePillWidth: pillWidth,
    markerCentreX: cx,
    markerCentreY: cy,
    pitchSvgWidth,
    pitchSvgHeight,
    pitchSvgMinX,
    pitchSvgMinY,
    slots: slotItemSpecs,
  });

  return (
    <g data-testid="formation-marker" transform={`translate(${cx} ${cy})`}>
      <g data-role="marker-glyph">{glyphNode}</g>
      <g
        data-role="marker-decorations"
        transform={`translate(${layout.groupShiftX} ${layout.groupShiftY})`}
      >
        {layout.placements.flatMap((placement) =>
          placement.items.map((item, i) => (
            <g
              key={`${placement.slot}-${i}`}
              data-testid={`formation-marker-slot-${placement.slot}`}
              transform={`translate(${item.translateX} ${item.translateY})`}
            >
              {item.node}
            </g>
          )),
        )}
        {showNameRendered ? (
          <g transform={`translate(0 ${layout.nameCentreY})`}>
            {prefixNode != null ? (
              <g transform={`translate(${-(totalRowWidth / 2 - prefixSize / 2)} 0)`}>
                {prefixNode}
              </g>
            ) : null}
            <rect
              x={pillOffsetX - pillWidth / 2}
              y={-pillHeight / 2}
              width={pillWidth}
              height={pillHeight}
              rx={namePillRx}
              ry={namePillRx}
              fill={resolvedNameBackground}
              opacity={0.82}
            />
            <text
              x={pillOffsetX}
              y={0}
              fill={resolvedNameColor}
              fontSize={nameFs}
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="central"
              pointerEvents="none"
              style={{ userSelect: "none" }}
            >
              {truncated}
            </text>
          </g>
        ) : null}
      </g>
    </g>
  );
}
