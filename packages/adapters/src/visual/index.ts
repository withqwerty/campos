import type {
  MatchLineups,
  PhaseMapSnapshot,
  PlayerSurfaceSnapshot,
} from "@withqwerty/campos-schema";
import { clampToCamposRange } from "@withqwerty/campos-schema";

type PlayerSurfaceWindowInput = PlayerSurfaceSnapshot["primaryWindow"];
type PhaseMapAxisInput = PhaseMapSnapshot["xAxis"];
type PhaseMapCalibrationStatus = PhaseMapSnapshot["calibrationStatus"];
type PhaseMapQuadrant = PhaseMapSnapshot["points"][number]["quadrant"];
type PhaseMapRepeatabilityLabel =
  PhaseMapSnapshot["points"][number]["repeatabilityLabel"];

export type PhaseMapPointInput = {
  id?: string | null;
  phaseId: string | number;
  side: "home" | "away";
  teamName: string;
  label: string;
  phaseType: string;
  period: number;
  startMinute: number;
  startSecond: number;
  endMinute: number;
  endSecond: number;
  outputScore: number;
  costScore: number;
  repeatabilityScore: number;
  repeatabilityLabel: PhaseMapRepeatabilityLabel;
  quadrant: PhaseMapQuadrant;
  evidence?: readonly string[];
  caveat: string;
  sourceMeta?: Record<string, unknown> | null;
};

export type PhaseMapCentroidInput = {
  side: "home" | "away";
  teamName: string;
  outputScore: number;
  costScore: number;
  count: number;
  evidence?: readonly string[];
  caveat: string;
  sourceMeta?: Record<string, unknown> | null;
};

export type PhaseMapSnapshotInput = {
  id?: string | null;
  xAxis?: PhaseMapAxisInput;
  yAxis?: PhaseMapAxisInput;
  calibrationStatus?: PhaseMapCalibrationStatus;
  points?: readonly PhaseMapPointInput[];
  centroids?: readonly PhaseMapCentroidInput[];
  caveat?: string | null;
  sourceMeta?: Record<string, unknown> | null;
};

export type PhaseMapSnapshotOptions = {
  matchId: string;
  provider?: string;
};

export type PlayerSurfaceAveragePositionInput = {
  side: "home" | "away";
  playerId: string | number;
  optaId?: string | number | null;
  playerName: string;
  shirtNumber?: string | number | null;
  position?: string | null;
  x: number;
  y: number;
  eventCount: number;
  passCount: number;
  windowLabel: string;
  evidence?: readonly string[];
  caveat: string;
  sourceMeta?: Record<string, unknown> | null;
};

export type PlayerSurfacePassingNetworkEdgeInput = {
  id: string;
  side: "home" | "away";
  fromPlayerId: string | number;
  fromOptaId?: string | number | null;
  fromShirtNumber?: string | number | null;
  fromPlayerName: string;
  toPlayerId: string | number;
  toOptaId?: string | number | null;
  toShirtNumber?: string | number | null;
  toPlayerName: string;
  x: number;
  y: number;
  endX: number;
  endY: number;
  count: number;
  inferred?: boolean;
  evidence?: readonly string[];
  caveat: string;
  sourceMeta?: Record<string, unknown> | null;
};

export type PlayerSurfaceRoleTagInput = {
  side: "home" | "away";
  playerId: string | number;
  optaId?: string | number | null;
  playerName: string;
  shirtNumber?: string | number | null;
  position?: string | null;
  label: string;
  score: number;
  evidence?: readonly string[];
  caveat: string;
  sourceMeta?: Record<string, unknown> | null;
};

export type PlayerSurfaceSnapshotInput = {
  id?: string | null;
  primaryWindow: PlayerSurfaceWindowInput;
  lineups?: MatchLineups | null;
  averagePositions?: readonly PlayerSurfaceAveragePositionInput[];
  passingNetworkEdges?: readonly PlayerSurfacePassingNetworkEdgeInput[];
  roleTags?: readonly PlayerSurfaceRoleTagInput[];
  caveat?: string | null;
  sourceMeta?: Record<string, unknown> | null;
};

export type PlayerSurfaceSnapshotOptions = {
  matchId: string;
  provider?: string;
};

function nullableString(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

function numericShirt(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonNegativeNumber(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

const defaultPhaseMapXAxis: PhaseMapAxisInput = {
  key: "pheno-output",
  label: "pheno-output score",
  domain: [0, 100],
};

const defaultPhaseMapYAxis: PhaseMapAxisInput = {
  key: "geno-cost",
  label: "inferred geno-cost score",
  domain: [0, 100],
};

function boundedScore(value: number): number {
  return clampToCamposRange(value);
}

function nonNegativeInteger(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function boundedSecond(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(59, Math.floor(value)));
}

function boundedMinute(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(200, Math.floor(value)));
}

function boundedPeriod(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(5, Math.floor(value)));
}

export function phaseMapSnapshot(
  input: PhaseMapSnapshotInput,
  options: PhaseMapSnapshotOptions,
): PhaseMapSnapshot {
  const id = input.id ?? `${options.matchId}:phase-map:output-cost`;

  return {
    id,
    matchId: options.matchId,
    coordinateFrame: "diagnostic-score-space",
    xAxis: input.xAxis ?? defaultPhaseMapXAxis,
    yAxis: input.yAxis ?? defaultPhaseMapYAxis,
    calibrationStatus: input.calibrationStatus ?? "unknown",
    points: (input.points ?? []).map((point) => {
      const outputScore = boundedScore(point.outputScore);
      const costScore = boundedScore(point.costScore);
      return {
        id: point.id == null || point.id === "" ? String(point.phaseId) : point.id,
        phaseId: String(point.phaseId),
        side: point.side,
        teamName: point.teamName,
        label: point.label,
        phaseType: point.phaseType,
        period: boundedPeriod(point.period),
        startMinute: boundedMinute(point.startMinute),
        startSecond: boundedSecond(point.startSecond),
        endMinute: boundedMinute(point.endMinute),
        endSecond: boundedSecond(point.endSecond),
        x: outputScore,
        y: costScore,
        outputScore,
        costScore,
        repeatabilityScore: boundedScore(point.repeatabilityScore),
        repeatabilityLabel: point.repeatabilityLabel,
        quadrant: point.quadrant,
        evidence: [...(point.evidence ?? [])],
        caveat: point.caveat,
        sourceMeta: point.sourceMeta ?? null,
      };
    }),
    centroids: (input.centroids ?? []).map((centroid) => {
      const outputScore = boundedScore(centroid.outputScore);
      const costScore = boundedScore(centroid.costScore);
      return {
        side: centroid.side,
        teamName: centroid.teamName,
        x: outputScore,
        y: costScore,
        outputScore,
        costScore,
        count: nonNegativeInteger(centroid.count),
        evidence: [...(centroid.evidence ?? [])],
        caveat: centroid.caveat,
        sourceMeta: centroid.sourceMeta ?? null,
      };
    }),
    provider: options.provider ?? "visual",
    caveat: input.caveat ?? null,
    sourceMeta: input.sourceMeta ?? null,
  };
}

export function phaseMapSnapshots(
  inputs: readonly PhaseMapSnapshotInput[],
  options: PhaseMapSnapshotOptions,
): PhaseMapSnapshot[] {
  return inputs.map((input) => phaseMapSnapshot(input, options));
}

export function playerSurfaceSnapshot(
  input: PlayerSurfaceSnapshotInput,
  options: PlayerSurfaceSnapshotOptions,
): PlayerSurfaceSnapshot {
  const id = input.id ?? `${options.matchId}:player-surface:primary`;

  return {
    id,
    matchId: options.matchId,
    coordinateFrame: "absolute-pitch",
    primaryWindow: {
      ...input.primaryWindow,
      evidence: [...input.primaryWindow.evidence],
    },
    lineups: input.lineups ?? null,
    averagePositions: (input.averagePositions ?? []).map((position) => ({
      side: position.side,
      playerId: String(position.playerId),
      optaId: nullableString(position.optaId),
      playerName: position.playerName,
      shirtNumber: numericShirt(position.shirtNumber),
      position: position.position ?? null,
      x: clampToCamposRange(position.x),
      y: clampToCamposRange(position.y),
      eventCount: nonNegativeNumber(position.eventCount),
      passCount: nonNegativeNumber(position.passCount),
      windowLabel: position.windowLabel,
      evidence: [...(position.evidence ?? [])],
      caveat: position.caveat,
      sourceMeta: position.sourceMeta ?? null,
    })),
    passingNetworkEdges: (input.passingNetworkEdges ?? []).map((edge) => ({
      id: edge.id,
      side: edge.side,
      fromPlayerId: String(edge.fromPlayerId),
      fromOptaId: nullableString(edge.fromOptaId),
      fromShirtNumber: numericShirt(edge.fromShirtNumber),
      fromPlayerName: edge.fromPlayerName,
      toPlayerId: String(edge.toPlayerId),
      toOptaId: nullableString(edge.toOptaId),
      toShirtNumber: numericShirt(edge.toShirtNumber),
      toPlayerName: edge.toPlayerName,
      x: clampToCamposRange(edge.x),
      y: clampToCamposRange(edge.y),
      endX: clampToCamposRange(edge.endX),
      endY: clampToCamposRange(edge.endY),
      count: nonNegativeNumber(edge.count),
      inferred: edge.inferred ?? false,
      evidence: [...(edge.evidence ?? [])],
      caveat: edge.caveat,
      sourceMeta: edge.sourceMeta ?? null,
    })),
    roleTags: (input.roleTags ?? []).map((role) => ({
      side: role.side,
      playerId: String(role.playerId),
      optaId: nullableString(role.optaId),
      playerName: role.playerName,
      shirtNumber: numericShirt(role.shirtNumber),
      position: role.position ?? null,
      label: role.label,
      score: nonNegativeNumber(role.score),
      evidence: [...(role.evidence ?? [])],
      caveat: role.caveat,
      sourceMeta: role.sourceMeta ?? null,
    })),
    provider: options.provider ?? "visual",
    caveat: input.caveat ?? null,
    sourceMeta: input.sourceMeta ?? null,
  };
}

export function playerSurfaceSnapshots(
  inputs: readonly PlayerSurfaceSnapshotInput[],
  options: PlayerSurfaceSnapshotOptions,
): PlayerSurfaceSnapshot[] {
  return inputs.map((input) => playerSurfaceSnapshot(input, options));
}

export const fromVisual = {
  phaseMapSnapshot,
  phaseMapSnapshots,
  playerSurfaceSnapshot,
  playerSurfaceSnapshots,
};
