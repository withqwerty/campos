import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  computePassNetwork,
  type ComputePassNetworkInput,
  type PassNetworkEdge,
  type PassNetworkLegendRow,
  type PassNetworkNode,
  type PassNetworkRenderedEdge,
  type PassNetworkRenderedNode,
} from "./compute/index.js";
import {
  Pitch,
  type ProjectFn,
  type Theme as PitchTheme,
  type PitchColors,
} from "@withqwerty/campos-stadia";

import { useTheme } from "./ThemeContext.js";
import { triggerButtonActionOnKeyDown } from "./keyboardActivation.js";
import { LIGHT_THEME, type UITheme } from "./theme.js";
import { resolveStyleValue, type StyleValue } from "./styleValue.js";
import {
  ChartLineMark,
  ChartPointMark,
  PitchChartFrame,
  ChartTooltip,
  EmptyState,
  type PointShape,
} from "./primitives/index.js";

export type PassNetworkProps = {
  nodes: ComputePassNetworkInput["nodes"];
  edges: ComputePassNetworkInput["edges"];
  minEdgePasses?: ComputePassNetworkInput["minEdgePasses"];
  showLabels?: ComputePassNetworkInput["showLabels"];
  attackingDirection?: ComputePassNetworkInput["attackingDirection"];
  directed?: ComputePassNetworkInput["directed"];
  collisionPadding?: ComputePassNetworkInput["collisionPadding"];
  pitchTheme?: PitchTheme;
  pitchColors?: PitchColors;
  /**
   * When true, hovering or focusing a node dims everything except that
   * node's edges and their counterparts. Default: true.
   */
  egoHighlight?: boolean;
  nodeStyle?: PassNetworkNodeStyle;
  edgeStyle?: PassNetworkEdgeStyle;
  /** Override frame padding in pixels. Default 16. Set to 0 for composites. */
  framePadding?: number;
  /** Override the chart frame max-width in pixels. Default varies by attackingDirection. */
  maxWidth?: number;
};

export type PassNetworkNodeStyleContext = {
  node: PassNetworkRenderedNode;
  rawNode: PassNetworkNode | undefined;
  theme: UITheme;
  active: boolean;
  dimmed: boolean;
};

export type PassNetworkNodeStyle = {
  show?: StyleValue<boolean, PassNetworkNodeStyleContext>;
  fill?: StyleValue<string, PassNetworkNodeStyleContext>;
  stroke?: StyleValue<string, PassNetworkNodeStyleContext>;
  strokeWidth?: StyleValue<number, PassNetworkNodeStyleContext>;
  opacity?: StyleValue<number, PassNetworkNodeStyleContext>;
  radius?: StyleValue<number, PassNetworkNodeStyleContext>;
  labelColor?: StyleValue<string, PassNetworkNodeStyleContext>;
  shape?: StyleValue<PointShape, PassNetworkNodeStyleContext>;
};

export type PassNetworkEdgeStyleContext = {
  edge: PassNetworkRenderedEdge;
  rawEdge: PassNetworkEdge | undefined;
  theme: UITheme;
  active: boolean;
  dimmed: boolean;
};

export type PassNetworkEdgeStyle = {
  show?: StyleValue<boolean, PassNetworkEdgeStyleContext>;
  stroke?: StyleValue<string, PassNetworkEdgeStyleContext>;
  strokeWidth?: StyleValue<number, PassNetworkEdgeStyleContext>;
  strokeDasharray?: StyleValue<string, PassNetworkEdgeStyleContext>;
  opacity?: StyleValue<number, PassNetworkEdgeStyleContext>;
};

type FocusTarget = { kind: "node"; id: string } | { kind: "edge"; id: string } | null;
type PassNetworkModel = ReturnType<typeof computePassNetwork>;

function edgeInputId(edge: { sourceId: string; targetId: string }) {
  return `${edge.sourceId}::${edge.targetId}`;
}

function nodeAriaLabel(node: PassNetworkRenderedNode): string {
  return node.tooltip.rows.map((row) => `${row.label}: ${row.value}`).join(", ");
}

function edgeAriaLabel(edge: PassNetworkRenderedEdge): string {
  return edge.tooltip.rows.map((row) => `${row.label}: ${row.value}`).join(", ");
}

/**
 * Build a short id suffix for a hex color so each unique color gets its
 * own arrowhead marker in the shared <defs>. "#EF0107" -> "EF0107".
 */
function colorMarkerId(color: string): string {
  return `pn-arrow-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
}

const DIRECTED_PAIR_OFFSET = 0.8;

function directedPairKey(sourceId: string, targetId: string): string {
  return sourceId <= targetId ? `${sourceId}::${targetId}` : `${targetId}::${sourceId}`;
}

function buildDirectedPairOffsets(
  edges: readonly PassNetworkRenderedEdge[],
  projectedById: ReadonlyMap<string, { x: number; y: number }>,
): Map<string, { x: number; y: number }> {
  const seenPairKeys = new Set<string>();
  const reversedPairKeys = new Set<string>();

  for (const edge of edges) {
    if (!edge.isDirected) continue;
    const key = directedPairKey(edge.sourceId, edge.targetId);
    if (seenPairKeys.has(key)) reversedPairKeys.add(key);
    seenPairKeys.add(key);
  }

  const pairOffsets = new Map<string, { x: number; y: number }>();
  for (const key of reversedPairKeys) {
    const [a, b] = key.split("::") as [string, string];
    const pa = projectedById.get(a);
    const pb = projectedById.get(b);
    if (!pa || !pb) continue;

    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 1e-6) continue;

    pairOffsets.set(key, {
      x: (-dy / length) * DIRECTED_PAIR_OFFSET,
      y: (dx / length) * DIRECTED_PAIR_OFFSET,
    });
  }

  return pairOffsets;
}

function renderEdge(
  edge: PassNetworkRenderedEdge,
  rawEdge: PassNetworkEdge | undefined,
  project: ProjectFn,
  theme: UITheme,
  active: boolean,
  dimmed: boolean,
  sourceRadius: number,
  targetRadius: number,
  /**
   * Absolute perpendicular offset applied to both endpoints. The caller
   * computes this once per reversed pair from the canonical (lex-sorted)
   * direction so A→B and B→A always land on opposite visual sides.
   * `{ 0, 0 }` for non-reversed edges.
   */
  offsetX: number,
  offsetY: number,
  onEnter: () => void,
  onLeave: () => void,
  onFocus: () => void,
  onBlur: () => void,
  onClick: () => void,
  edgeStyle: PassNetworkEdgeStyle | undefined,
): ReactNode {
  const styleContext: PassNetworkEdgeStyleContext = {
    edge,
    rawEdge,
    theme,
    active,
    dimmed,
  };
  if (resolveStyleValue(edgeStyle?.show, styleContext) === false) {
    return null;
  }
  const raw1 = project(edge.sourceX, edge.sourceY);
  const raw2 = project(edge.targetX, edge.targetY);
  const baseOpacity = dimmed
    ? edge.opacity * 0.15
    : active
      ? Math.min(edge.opacity + 0.2, 1)
      : edge.opacity;
  const stroke = resolveStyleValue(edgeStyle?.stroke, styleContext) ?? edge.color;
  const strokeWidth =
    resolveStyleValue(edgeStyle?.strokeWidth, styleContext) ?? edge.width;
  const strokeDasharray = resolveStyleValue(edgeStyle?.strokeDasharray, styleContext);
  const opacity = resolveStyleValue(edgeStyle?.opacity, styleContext) ?? baseOpacity;

  // Trim the line endpoints by each node's radius so the line meets the
  // circle boundaries (not the centers). For directed edges the target
  // end is additionally pulled back by 0.3m so the arrowhead sits on the
  // node circumference without overlap. The caller-supplied (offsetX,
  // offsetY) is then added to both endpoints to separate reversed pairs.
  const dx = raw2.x - raw1.x;
  const dy = raw2.y - raw1.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  let x1 = raw1.x;
  let y1 = raw1.y;
  let x2 = raw2.x;
  let y2 = raw2.y;
  if (length >= 1e-6) {
    const ux = dx / length;
    const uy = dy / length;
    const headRoom = edge.isDirected ? 0.3 : 0;
    const startCut = sourceRadius + 0.1;
    const endCut = targetRadius + 0.1 + headRoom;
    x1 = raw1.x + ux * startCut + offsetX;
    y1 = raw1.y + uy * startCut + offsetY;
    x2 = raw2.x - ux * endCut + offsetX;
    y2 = raw2.y - uy * endCut + offsetY;
  }

  const markerId = edge.isDirected ? colorMarkerId(stroke) : null;

  return (
    <g
      key={edge.id}
      role="button"
      tabIndex={0}
      aria-label={edgeAriaLabel(edge)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick}
      onKeyDown={(event) => {
        triggerButtonActionOnKeyDown(event, onClick);
      }}
      style={{ cursor: "pointer", outline: "none" }}
    >
      {/* Invisible wider hit stroke */}
      <ChartLineMark
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="transparent"
        strokeWidth={Math.max(strokeWidth * 3, 2.2)}
        strokeLinecap="round"
      />
      {/* Visible edge */}
      <ChartLineMark
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        {...(strokeDasharray != null ? { strokeDasharray } : {})}
        opacity={opacity}
        {...(markerId != null ? { markerEnd: `url(#${markerId})` } : {})}
      />
    </g>
  );
}

function renderNode(
  node: PassNetworkRenderedNode,
  rawNode: PassNetworkNode | undefined,
  project: ProjectFn,
  theme: UITheme,
  active: boolean,
  dimmed: boolean,
  onEnter: () => void,
  onLeave: () => void,
  onFocus: () => void,
  onBlur: () => void,
  onClick: () => void,
  nodeStyle: PassNetworkNodeStyle | undefined,
): ReactNode {
  const styleContext: PassNetworkNodeStyleContext = {
    node,
    rawNode,
    theme,
    active,
    dimmed,
  };
  if (resolveStyleValue(nodeStyle?.show, styleContext) === false) {
    return null;
  }
  const { x: cx, y: cy } = project(node.x, node.y);
  const radius = resolveStyleValue(nodeStyle?.radius, styleContext) ?? node.radius;
  const fill = resolveStyleValue(nodeStyle?.fill, styleContext) ?? node.color;
  const labelColor =
    resolveStyleValue(nodeStyle?.labelColor, styleContext) ?? node.labelColor;
  const strokeColor =
    resolveStyleValue(nodeStyle?.stroke, styleContext) ??
    (labelColor === "#ffffff" ? "#1a202c" : "#ffffff");
  const strokeWidth =
    resolveStyleValue(nodeStyle?.strokeWidth, styleContext) ??
    Math.max(0.15, radius * 0.06);
  const opacity =
    resolveStyleValue(nodeStyle?.opacity, styleContext) ?? (dimmed ? 0.25 : 1);
  const shape = resolveStyleValue(nodeStyle?.shape, styleContext) ?? "circle";
  const fontSize = node.labelFontSize;
  return (
    <g
      key={node.id}
      role="button"
      tabIndex={0}
      aria-label={nodeAriaLabel(node)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick}
      onKeyDown={(event) => {
        triggerButtonActionOnKeyDown(event, onClick);
      }}
      opacity={opacity}
      style={{ cursor: "pointer", outline: "none" }}
    >
      {/* Subtle dark outline for contrast against pitch grass */}
      <ChartPointMark
        cx={cx}
        cy={cy}
        r={radius + radius * 0.08}
        shape={shape}
        fill="#0f172a"
        opacity={active ? 0.45 : 0.3}
      />
      <ChartPointMark
        cx={cx}
        cy={cy}
        r={radius}
        shape={shape}
        fill={fill}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        opacity={active ? 1 : 0.95}
      />
      {node.showLabel ? (
        <text
          x={cx}
          y={cy}
          fill={labelColor}
          fontSize={fontSize}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="central"
          stroke={strokeColor}
          strokeWidth={Math.max(0.15, fontSize * 0.08)}
          paintOrder="stroke"
          pointerEvents="none"
          style={{ userSelect: "none" }}
        >
          {node.label}
        </text>
      ) : null}
    </g>
  );
}

function renderStaticEdge(
  edge: PassNetworkRenderedEdge,
  rawEdge: PassNetworkEdge | undefined,
  project: ProjectFn,
  theme: UITheme,
  sourceRadius: number,
  targetRadius: number,
  offsetX: number,
  offsetY: number,
  edgeStyle: PassNetworkEdgeStyle | undefined,
): ReactNode {
  const styleContext: PassNetworkEdgeStyleContext = {
    edge,
    rawEdge,
    theme,
    active: false,
    dimmed: false,
  };
  if (resolveStyleValue(edgeStyle?.show, styleContext) === false) {
    return null;
  }
  const raw1 = project(edge.sourceX, edge.sourceY);
  const raw2 = project(edge.targetX, edge.targetY);
  const dx = raw2.x - raw1.x;
  const dy = raw2.y - raw1.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  let x1 = raw1.x;
  let y1 = raw1.y;
  let x2 = raw2.x;
  let y2 = raw2.y;
  if (length >= 1e-6) {
    const ux = dx / length;
    const uy = dy / length;
    const headRoom = edge.isDirected ? 0.3 : 0;
    const startCut = sourceRadius + 0.1;
    const endCut = targetRadius + 0.1 + headRoom;
    x1 = raw1.x + ux * startCut + offsetX;
    y1 = raw1.y + uy * startCut + offsetY;
    x2 = raw2.x - ux * endCut + offsetX;
    y2 = raw2.y - uy * endCut + offsetY;
  }

  const stroke = resolveStyleValue(edgeStyle?.stroke, styleContext) ?? edge.color;
  const strokeWidth =
    resolveStyleValue(edgeStyle?.strokeWidth, styleContext) ?? edge.width;
  const strokeDasharray = resolveStyleValue(edgeStyle?.strokeDasharray, styleContext);
  const opacity = resolveStyleValue(edgeStyle?.opacity, styleContext) ?? edge.opacity;
  const markerId = edge.isDirected ? colorMarkerId(stroke) : null;
  return (
    <ChartLineMark
      key={edge.id}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      {...(strokeDasharray != null ? { strokeDasharray } : {})}
      opacity={opacity}
      {...(markerId != null ? { markerEnd: `url(#${markerId})` } : {})}
    />
  );
}

function renderStaticNode(
  node: PassNetworkRenderedNode,
  rawNode: PassNetworkNode | undefined,
  project: ProjectFn,
  theme: UITheme,
  nodeStyle: PassNetworkNodeStyle | undefined,
): ReactNode {
  const { x: cx, y: cy } = project(node.x, node.y);
  const styleContext: PassNetworkNodeStyleContext = {
    node,
    rawNode,
    theme,
    active: false,
    dimmed: false,
  };
  if (resolveStyleValue(nodeStyle?.show, styleContext) === false) {
    return null;
  }
  const radius = resolveStyleValue(nodeStyle?.radius, styleContext) ?? node.radius;
  const fill = resolveStyleValue(nodeStyle?.fill, styleContext) ?? node.color;
  const labelColor =
    resolveStyleValue(nodeStyle?.labelColor, styleContext) ?? node.labelColor;
  const strokeColor =
    resolveStyleValue(nodeStyle?.stroke, styleContext) ??
    (labelColor === "#ffffff" ? "#1a202c" : "#ffffff");
  const strokeWidth =
    resolveStyleValue(nodeStyle?.strokeWidth, styleContext) ??
    Math.max(0.15, radius * 0.06);
  const shape = resolveStyleValue(nodeStyle?.shape, styleContext) ?? "circle";
  const opacity = resolveStyleValue(nodeStyle?.opacity, styleContext) ?? 1;
  return (
    <g key={node.id} {...(opacity !== 1 ? { opacity } : {})}>
      <ChartPointMark
        cx={cx}
        cy={cy}
        r={radius + radius * 0.08}
        shape={shape}
        fill="#0f172a"
        opacity={0.3}
      />
      <ChartPointMark
        cx={cx}
        cy={cy}
        r={radius}
        shape={shape}
        fill={fill}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        opacity={0.95}
      />
      {node.showLabel ? (
        <text
          x={cx}
          y={cy}
          fill={labelColor}
          fontSize={node.labelFontSize}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="central"
          stroke={strokeColor}
          strokeWidth={Math.max(0.15, node.labelFontSize * 0.08)}
          paintOrder="stroke"
          pointerEvents="none"
        >
          {node.label}
        </text>
      ) : null}
    </g>
  );
}

function buildPassNetworkModel({
  nodes,
  edges,
  minEdgePasses,
  showLabels,
  attackingDirection,
  directed,
  collisionPadding,
}: PassNetworkProps): PassNetworkModel {
  return computePassNetwork({
    nodes,
    edges,
    ...(minEdgePasses != null ? { minEdgePasses } : {}),
    ...(showLabels != null ? { showLabels } : {}),
    ...(attackingDirection != null ? { attackingDirection } : {}),
    ...(directed != null ? { directed } : {}),
    ...(collisionPadding != null ? { collisionPadding } : {}),
  });
}

function PassNetworkScene({
  model,
  rawNodesById,
  rawEdgesById,
  project,
  activeNodeId,
  activeEdgeId,
  egoRelated,
  setFocus,
  theme,
  nodeStyle,
  edgeStyle,
}: {
  model: PassNetworkModel;
  rawNodesById: ReadonlyMap<string, PassNetworkNode>;
  rawEdgesById: ReadonlyMap<string, PassNetworkEdge>;
  project: ProjectFn;
  activeNodeId?: string | null;
  activeEdgeId?: string | null;
  egoRelated: {
    relatedEdgeIds: Set<string>;
    relatedNodeIds: Set<string>;
  } | null;
  setFocus?: Dispatch<SetStateAction<FocusTarget>>;
  theme?: UITheme;
  nodeStyle: PassNetworkNodeStyle | undefined;
  edgeStyle: PassNetworkEdgeStyle | undefined;
}) {
  const resolvedTheme = theme ?? LIGHT_THEME;
  const visibleNodeIds = new Set(
    model.plot.nodes
      .filter((node) => {
        const active = activeNodeId === node.id;
        const dimmed = egoRelated != null && !egoRelated.relatedNodeIds.has(node.id);
        const rawNode = rawNodesById.get(node.id);
        return (
          resolveStyleValue(nodeStyle?.show, {
            node,
            rawNode,
            theme: resolvedTheme,
            active,
            dimmed,
          }) !== false
        );
      })
      .map((node) => node.id),
  );
  const radiusById = new Map(
    model.plot.nodes.map((node) => {
      const active = activeNodeId === node.id;
      const dimmed = egoRelated != null && !egoRelated.relatedNodeIds.has(node.id);
      const rawNode = rawNodesById.get(node.id);
      return [
        node.id,
        resolveStyleValue(nodeStyle?.radius, {
          node,
          rawNode,
          theme: resolvedTheme,
          active,
          dimmed,
        }) ?? node.radius,
      ] as const;
    }),
  );
  const projectedById = new Map(
    model.plot.nodes.map((node) => [node.id, project(node.x, node.y)] as const),
  );
  const visibleEdges = model.plot.edges.filter((edge) => {
    if (!visibleNodeIds.has(edge.sourceId) || !visibleNodeIds.has(edge.targetId)) {
      return false;
    }
    const active = activeEdgeId === edge.id;
    const dimmed = egoRelated != null && !egoRelated.relatedEdgeIds.has(edge.id);
    const rawEdge =
      rawEdgesById.get(edge.id) ??
      rawEdgesById.get(edgeInputId({ sourceId: edge.targetId, targetId: edge.sourceId }));
    return (
      resolveStyleValue(edgeStyle?.show, {
        edge,
        rawEdge,
        theme: resolvedTheme,
        active,
        dimmed,
      }) !== false
    );
  });
  const pairOffsets = buildDirectedPairOffsets(visibleEdges, projectedById);
  const directedEdgeColors = Array.from(
    new Set(
      visibleEdges
        .filter((edge) => edge.isDirected)
        .map((edge) => {
          const rawEdge =
            rawEdgesById.get(edge.id) ??
            rawEdgesById.get(
              edgeInputId({ sourceId: edge.targetId, targetId: edge.sourceId }),
            );
          return (
            resolveStyleValue(edgeStyle?.stroke, {
              edge,
              rawEdge,
              theme: resolvedTheme,
              active: activeEdgeId === edge.id,
              dimmed: egoRelated != null && !egoRelated.relatedEdgeIds.has(edge.id),
            }) ?? edge.color
          );
        }),
    ),
  );

  const makeFocusHandlers = (target: Exclude<FocusTarget, null>) => {
    if (setFocus == null) return null;

    const set = () => {
      setFocus(target);
    };
    const clear = () => {
      setFocus((current) =>
        current?.kind === target.kind && current.id === target.id ? null : current,
      );
    };
    const toggle = () => {
      setFocus((current) =>
        current?.kind === target.kind && current.id === target.id ? null : target,
      );
    };
    return { set, clear, toggle };
  };

  return (
    <>
      {directedEdgeColors.length > 0 ? (
        <defs>
          {directedEdgeColors.map((color) => {
            const id = colorMarkerId(color);
            return (
              <marker
                key={id}
                id={id}
                markerWidth="5"
                markerHeight="5"
                refX="4.5"
                refY="2.5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L5,2.5 L0,5 Z" fill={color} />
              </marker>
            );
          })}
        </defs>
      ) : null}

      {visibleEdges.map((edge) => {
        const sourceRadius = radiusById.get(edge.sourceId) ?? 0;
        const targetRadius = radiusById.get(edge.targetId) ?? 0;
        const rawEdge =
          rawEdgesById.get(edge.id) ??
          rawEdgesById.get(
            edgeInputId({ sourceId: edge.targetId, targetId: edge.sourceId }),
          );
        let offsetX = 0;
        let offsetY = 0;
        if (edge.isDirected) {
          const key = directedPairKey(edge.sourceId, edge.targetId);
          const off = pairOffsets.get(key);
          if (off) {
            const sign = edge.sourceId < edge.targetId ? 1 : -1;
            offsetX = off.x * sign;
            offsetY = off.y * sign;
          }
        }

        if (setFocus == null) {
          return renderStaticEdge(
            edge,
            rawEdge,
            project,
            resolvedTheme,
            sourceRadius,
            targetRadius,
            offsetX,
            offsetY,
            edgeStyle,
          );
        }

        const handlers = makeFocusHandlers({ kind: "edge", id: edge.id });
        const dimmed = egoRelated != null && !egoRelated.relatedEdgeIds.has(edge.id);

        return renderEdge(
          edge,
          rawEdge,
          project,
          resolvedTheme,
          activeEdgeId === edge.id,
          dimmed,
          sourceRadius,
          targetRadius,
          offsetX,
          offsetY,
          handlers?.set ?? (() => {}),
          handlers?.clear ?? (() => {}),
          handlers?.set ?? (() => {}),
          handlers?.clear ?? (() => {}),
          handlers?.toggle ?? (() => {}),
          edgeStyle,
        );
      })}

      {model.plot.nodes
        .filter((node) => visibleNodeIds.has(node.id))
        .map((node) => {
          const rawNode = rawNodesById.get(node.id);
          if (setFocus == null) {
            return renderStaticNode(node, rawNode, project, resolvedTheme, nodeStyle);
          }

          const handlers = makeFocusHandlers({ kind: "node", id: node.id });
          const dimmed = egoRelated != null && !egoRelated.relatedNodeIds.has(node.id);

          return renderNode(
            node,
            rawNode,
            project,
            resolvedTheme,
            activeNodeId === node.id,
            dimmed,
            handlers?.set ?? (() => {}),
            handlers?.clear ?? (() => {}),
            handlers?.set ?? (() => {}),
            handlers?.clear ?? (() => {}),
            handlers?.toggle ?? (() => {}),
            nodeStyle,
          );
        })}

      {setFocus == null && model.emptyState && theme != null ? (
        <text
          x={model.plot.pitch.attackingDirection === "right" ? 52.5 : 34}
          y={model.plot.pitch.attackingDirection === "right" ? 34 : 52.5}
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
  );
}

export function PassNetworkStaticSvg({
  nodes,
  edges,
  minEdgePasses,
  showLabels,
  attackingDirection,
  directed,
  collisionPadding,
  pitchTheme,
  pitchColors,
  theme = LIGHT_THEME,
  nodeStyle,
  edgeStyle,
}: PassNetworkProps & { theme?: UITheme }) {
  const rawNodesById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node] as const)),
    [nodes],
  );
  const rawEdgesById = useMemo(
    () => new Map(edges.map((edge) => [edgeInputId(edge), edge] as const)),
    [edges],
  );
  const model = buildPassNetworkModel({
    nodes,
    edges,
    ...(minEdgePasses != null ? { minEdgePasses } : {}),
    ...(showLabels != null ? { showLabels } : {}),
    ...(attackingDirection != null ? { attackingDirection } : {}),
    ...(directed != null ? { directed } : {}),
    ...(collisionPadding != null ? { collisionPadding } : {}),
  });

  return (
    <Pitch
      crop="full"
      attackingDirection={model.plot.pitch.attackingDirection}
      padding={3}
      interactive={false}
      role="img"
      ariaLabel={model.meta.accessibleLabel}
      {...(pitchTheme != null ? { theme: pitchTheme } : {})}
      {...(pitchColors != null ? { colors: pitchColors } : {})}
    >
      {({ project }) => (
        <PassNetworkScene
          model={model}
          rawNodesById={rawNodesById}
          rawEdgesById={rawEdgesById}
          project={project}
          egoRelated={null}
          theme={theme}
          nodeStyle={nodeStyle}
          edgeStyle={edgeStyle}
        />
      )}
    </Pitch>
  );
}

function LegendRowView({ row }: { row: PassNetworkLegendRow }) {
  if (row.kind === "size") {
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          {row.label}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <svg width={36} height={16} aria-hidden="true">
            <circle cx={6} cy={8} r={3} fill={row.color} />
            <circle cx={26} cy={8} r={7} fill={row.color} />
          </svg>
          <span style={{ opacity: 0.8 }}>{row.minLabel}</span>
          <span aria-hidden="true" style={{ opacity: 0.4 }}>
            →
          </span>
          <span style={{ opacity: 0.8 }}>{row.maxLabel}</span>
        </div>
      </div>
    );
  }
  if (row.kind === "width") {
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          {row.label}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <svg width={36} height={16} aria-hidden="true">
            <line x1={2} y1={8} x2={16} y2={8} stroke={row.color} strokeWidth={1} />
            <line x1={20} y1={8} x2={34} y2={8} stroke={row.color} strokeWidth={3.5} />
          </svg>
          <span style={{ opacity: 0.8 }}>{row.minLabel}</span>
          <span aria-hidden="true" style={{ opacity: 0.4 }}>
            →
          </span>
          <span style={{ opacity: 0.8 }}>{row.maxLabel}</span>
        </div>
      </div>
    );
  }
  if (row.mode === "team") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: row.color,
          }}
        />
        <span>{row.label}</span>
      </div>
    );
  }
  // xT gradient
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          opacity: 0.7,
        }}
      >
        {row.label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 56,
            height: 8,
            borderRadius: 4,
            background: `linear-gradient(to right, ${row.gradient.join(", ")})`,
          }}
        />
        <span style={{ opacity: 0.8 }}>{row.minLabel}</span>
        <span aria-hidden="true" style={{ opacity: 0.4 }}>
          →
        </span>
        <span style={{ opacity: 0.8 }}>{row.maxLabel}</span>
      </div>
    </div>
  );
}

export function PassNetwork({
  nodes,
  edges,
  minEdgePasses,
  showLabels,
  attackingDirection,
  directed,
  collisionPadding,
  pitchTheme,
  pitchColors,
  egoHighlight = true,
  nodeStyle,
  edgeStyle,
  framePadding,
  maxWidth,
}: PassNetworkProps) {
  const theme = useTheme();
  const rawNodesById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node] as const)),
    [nodes],
  );
  const rawEdgesById = useMemo(
    () => new Map(edges.map((edge) => [edgeInputId(edge), edge] as const)),
    [edges],
  );
  const model = useMemo(
    () =>
      buildPassNetworkModel({
        nodes,
        edges,
        ...(minEdgePasses != null ? { minEdgePasses } : {}),
        ...(showLabels != null ? { showLabels } : {}),
        ...(attackingDirection != null ? { attackingDirection } : {}),
        ...(directed != null ? { directed } : {}),
        ...(collisionPadding != null ? { collisionPadding } : {}),
      }),
    [
      nodes,
      edges,
      minEdgePasses,
      showLabels,
      attackingDirection,
      directed,
      collisionPadding,
    ],
  );

  const [focus, setFocus] = useState<FocusTarget>(null);
  const renderKey = useMemo(
    () => `${nodes.map((n) => n.id).join("|")}::${edges.length}`,
    [nodes, edges],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when data changes
    setFocus(null);
  }, [nodes, edges]);

  const activeNode =
    focus && focus.kind === "node"
      ? (model.plot.nodes.find((n) => n.id === focus.id) ?? null)
      : null;
  const activeEdge =
    focus && focus.kind === "edge"
      ? (model.plot.edges.find((e) => e.id === focus.id) ?? null)
      : null;

  // Ego-network highlight: when a node is focused and egoHighlight is on,
  // compute the set of related edges + counterpart nodes so non-related
  // marks can dim. Memoised to avoid work when focus hasn't moved.
  const egoRelated = useMemo(() => {
    if (!egoHighlight || !activeNode) return null;
    const relatedEdgeIds = new Set<string>();
    const relatedNodeIds = new Set<string>([activeNode.id]);
    for (const edge of model.plot.edges) {
      if (edge.sourceId === activeNode.id || edge.targetId === activeNode.id) {
        relatedEdgeIds.add(edge.id);
        relatedNodeIds.add(edge.sourceId);
        relatedNodeIds.add(edge.targetId);
      }
    }
    return { relatedEdgeIds, relatedNodeIds };
  }, [egoHighlight, activeNode, model.plot.edges]);

  const tooltipRows = activeNode
    ? activeNode.tooltip.rows.map((r) => ({ label: r.label, value: r.value }))
    : activeEdge
      ? activeEdge.tooltip.rows.map((r) => ({ label: r.label, value: r.value }))
      : null;

  const regions: Record<(typeof model.layout.order)[number], ReactNode | null> = {
    headerStats: model.headerStats ? (
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {model.headerStats.items.map((item) => (
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
            <span style={{ fontSize: 18, fontWeight: 600 }}>{item.value}</span>
          </div>
        ))}
      </div>
    ) : null,
    plot: (
      <div style={{ position: "relative", minHeight: 0 }}>
        <Pitch
          crop="full"
          attackingDirection={model.plot.pitch.attackingDirection}
          // ~3% padding gives max-radius node circles (~3.7m) clearance at
          // all four edges so nodes near the touchline/goalline stay fully
          // inside the viewBox and don't get clipped by overflow="hidden".
          padding={3}
          {...(pitchTheme != null ? { theme: pitchTheme } : {})}
          {...(pitchColors != null ? { colors: pitchColors } : {})}
        >
          {({ project }) => (
            <PassNetworkScene
              model={model}
              rawNodesById={rawNodesById}
              rawEdgesById={rawEdgesById}
              project={project}
              activeNodeId={activeNode?.id ?? null}
              activeEdgeId={activeEdge?.id ?? null}
              egoRelated={egoRelated}
              setFocus={setFocus}
              theme={theme}
              nodeStyle={nodeStyle}
              edgeStyle={edgeStyle}
            />
          )}
        </Pitch>

        {model.emptyState ? (
          <EmptyState message={model.emptyState.message} theme={theme} />
        ) : null}

        {tooltipRows ? (
          <ChartTooltip testId="passnetwork-tooltip" rows={tooltipRows} theme={theme} />
        ) : null}
      </div>
    ),
    legend: model.legend ? (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 18,
          alignItems: "center",
          color: theme.text.secondary,
        }}
      >
        {model.legend.rows.map((row, i) => (
          <LegendRowView key={`${row.kind}-${i}`} row={row} />
        ))}
      </div>
    ) : null,
  };

  // Horizontal-wide pitches (105×68) get the widest canvas; portrait
  // verticals (68×105) are capped tighter so the section doesn't grow to
  // absurd heights.
  const sectionMaxWidth =
    maxWidth ?? (model.meta.attackingDirection === "right" ? 640 : 400);
  const prePlot = model.layout.order
    .filter((region) => region !== "plot" && region !== "legend")
    .map((region) => <div key={region}>{regions[region]}</div>);
  const postPlot = model.layout.order
    .filter((region) => region === "legend")
    .map((region) => <div key={region}>{regions[region]}</div>);

  return (
    <PitchChartFrame
      key={renderKey}
      ariaLabel={model.meta.accessibleLabel}
      chartKind="pass-network"
      empty={model.emptyState != null}
      maxWidth={sectionMaxWidth}
      prePlot={<>{prePlot}</>}
      plot={regions.plot ?? null}
      postPlot={<>{postPlot}</>}
      theme={theme}
      warnings={model.meta.warnings}
      {...(framePadding != null ? { padding: framePadding } : {})}
    />
  );
}
