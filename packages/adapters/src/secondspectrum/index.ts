import type {
  SequenceMomentSnapshot,
  TeamShapeSnapshot,
} from "@withqwerty/campos-schema";
import {
  physicalSummaryWindow,
  physicalSummaryWindows,
  physicalTeamSplitBlocks,
  physicalTeamSplitWindows,
  physicalWindow,
  physicalWindows,
} from "./physical-windows.js";
import {
  assertSecondSpectrumPitchDimensions,
  secondSpectrumMetricToCampos,
  trackingFrame,
  trackingFrames,
} from "./tracking-frame.js";
import type { SecondSpectrumPitchDimensions } from "./tracking-frame.js";
export type {
  SecondSpectrumPhysicalSplitMetric,
  SecondSpectrumPhysicalSummaryOptions,
  SecondSpectrumPhysicalSummaryRow,
  SecondSpectrumPhysicalWindowInput,
  SecondSpectrumPhysicalWindowOptions,
  SecondSpectrumTeamPhysicalSplitBlockInput,
  SecondSpectrumTeamPhysicalSplitOptions,
} from "./physical-windows.js";
export type {
  SecondSpectrumDirection,
  SecondSpectrumPitchDimensions,
  SecondSpectrumTrackingBall,
  SecondSpectrumTrackingFrame,
  SecondSpectrumTrackingFrameOptions,
  SecondSpectrumTrackingPlayer,
} from "./tracking-frame.js";

export type SecondSpectrumSequenceMomentInput = {
  id: string;
  title: string;
  period: number;
  minute: number;
  second: number;
  videoTimeSeconds?: number | null;
  eventIds?: readonly (string | number)[];
  trackingFrameId?: string | null;
  evidence?: readonly string[];
  caveat?: string | null;
  sourceMeta?: Record<string, unknown> | null;
};

export type SecondSpectrumSequenceMomentOptions = {
  matchId: string;
  provider?: string;
};

export type SecondSpectrumTeamShapeLineInput = {
  side: "home" | "away";
  line: "back" | "middle" | "front";
  x: number;
  evidence?: readonly string[];
  sourceMeta?: Record<string, unknown> | null;
};

export type SecondSpectrumTeamShapeCentroidInput = {
  side: "home" | "away";
  xy: readonly [number, number];
  evidence?: readonly string[];
  sourceMeta?: Record<string, unknown> | null;
};

export type SecondSpectrumTeamShapePolygonInput = {
  side: "home" | "away";
  method?: "convex-hull";
  points: readonly (readonly [number, number])[];
  evidence?: readonly string[];
  sourceMeta?: Record<string, unknown> | null;
};

export type SecondSpectrumTeamShapeMovementInput = {
  side: "home" | "away";
  playerId?: string | number | null;
  optaId?: string | number | null;
  shirtNumber?: string | number | null;
  start: readonly [number, number];
  end: readonly [number, number];
  speed?: number | null;
  seconds?: number | null;
  evidence?: readonly string[];
  sourceMeta?: Record<string, unknown> | null;
};

export type SecondSpectrumTeamShapeFacingHintInput = {
  side: "home" | "away";
  playerId?: string | number | null;
  optaId?: string | number | null;
  shirtNumber?: string | number | null;
  start: readonly [number, number];
  end: readonly [number, number];
  basis?: "movement-vector";
  speed?: number | null;
  evidence?: readonly string[];
  sourceMeta?: Record<string, unknown> | null;
};

export type SecondSpectrumTeamShapeCandidateLaneInput = {
  side: "home" | "away";
  receiverPlayerId?: string | number | null;
  receiverOptaId?: string | number | null;
  receiverShirtNumber?: string | number | null;
  start: readonly [number, number];
  end: readonly [number, number];
  clearance?: number | null;
  blockers?: number | null;
  length?: number | null;
  evidence?: readonly string[];
  sourceMeta?: Record<string, unknown> | null;
};

export type SecondSpectrumTeamShapeSnapshotInput = {
  id?: string | null;
  sequenceMomentId?: string | null;
  trackingFrameId?: string | null;
  lines?: readonly SecondSpectrumTeamShapeLineInput[];
  centroids?: readonly SecondSpectrumTeamShapeCentroidInput[];
  polygons?: readonly SecondSpectrumTeamShapePolygonInput[];
  movements?: readonly SecondSpectrumTeamShapeMovementInput[];
  facingHints?: readonly SecondSpectrumTeamShapeFacingHintInput[];
  candidateLanes?: readonly SecondSpectrumTeamShapeCandidateLaneInput[];
  caveat?: string | null;
  sourceMeta?: Record<string, unknown> | null;
};

export type SecondSpectrumTeamShapeSnapshotOptions = {
  matchId: string;
  pitchDimensions: SecondSpectrumPitchDimensions;
  provider?: string;
};

function stableOverlaySubjectId(
  primary: string | number | null | undefined,
  fallback: string | number | null | undefined,
  side: "home" | "away",
  overlayKind: "movement" | "facing hint" | "candidate lane receiver",
): string {
  const value = primary ?? fallback;
  if (value == null || value === "") {
    throw new Error(
      `Second Spectrum ${side} ${overlayKind} requires a stable player identifier.`,
    );
  }
  return String(value);
}

type TeamShapePolygonPoints = TeamShapeSnapshot["polygons"][number]["points"];

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numericShirt(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableString(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

function nonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.floor(value);
}

function projectPolygonPoints(
  points: readonly (readonly [number, number])[],
  pitchDimensions: SecondSpectrumPitchDimensions,
): TeamShapePolygonPoints | null {
  const projected = points.map((point) =>
    secondSpectrumMetricToCampos(point, pitchDimensions),
  );
  const [first, second, third, ...rest] = projected;
  if (!first || !second || !third) return null;
  return [first, second, third, ...rest];
}

export function sequenceMoment(
  moment: SecondSpectrumSequenceMomentInput,
  options: SecondSpectrumSequenceMomentOptions,
): SequenceMomentSnapshot {
  return {
    id: moment.id,
    matchId: options.matchId,
    title: moment.title,
    period: moment.period,
    minute: moment.minute,
    second: moment.second,
    videoTimeSeconds: nullableNumber(moment.videoTimeSeconds),
    eventIds: (moment.eventIds ?? []).map(String),
    trackingFrameId: moment.trackingFrameId ?? null,
    evidence: [...(moment.evidence ?? [])],
    caveat: moment.caveat ?? null,
    provider: options.provider ?? "second-spectrum",
    sourceMeta: moment.sourceMeta ?? null,
  };
}

export function sequenceMoments(
  moments: readonly SecondSpectrumSequenceMomentInput[],
  options: SecondSpectrumSequenceMomentOptions,
): SequenceMomentSnapshot[] {
  return moments.map((moment) => sequenceMoment(moment, options));
}

export function teamShapeSnapshot(
  snapshot: SecondSpectrumTeamShapeSnapshotInput,
  options: SecondSpectrumTeamShapeSnapshotOptions,
): TeamShapeSnapshot {
  assertSecondSpectrumPitchDimensions(options.pitchDimensions);
  const id =
    snapshot.id ??
    `${options.matchId}:second-spectrum:team-shape:${
      snapshot.sequenceMomentId ?? snapshot.trackingFrameId ?? "snapshot"
    }`;

  return {
    id,
    matchId: options.matchId,
    sequenceMomentId: snapshot.sequenceMomentId ?? null,
    trackingFrameId: snapshot.trackingFrameId ?? null,
    coordinateFrame: "absolute-pitch",
    lines: (snapshot.lines ?? []).map((line) => ({
      side: line.side,
      line: line.line,
      x: secondSpectrumMetricToCampos([line.x, 0], options.pitchDimensions).x,
      evidence: [...(line.evidence ?? [])],
      sourceMeta: line.sourceMeta ?? null,
    })),
    centroids: (snapshot.centroids ?? []).map((centroid) => {
      const point = secondSpectrumMetricToCampos(centroid.xy, options.pitchDimensions);
      return {
        side: centroid.side,
        x: point.x,
        y: point.y,
        evidence: [...(centroid.evidence ?? [])],
        sourceMeta: centroid.sourceMeta ?? null,
      };
    }),
    polygons: (snapshot.polygons ?? []).flatMap((polygon) => {
      const points = projectPolygonPoints(polygon.points, options.pitchDimensions);
      if (!points) return [];
      return [
        {
          side: polygon.side,
          method: polygon.method ?? "convex-hull",
          points,
          evidence: [...(polygon.evidence ?? [])],
          sourceMeta: polygon.sourceMeta ?? null,
        },
      ];
    }),
    movements: (snapshot.movements ?? []).map((movement) => {
      const start = secondSpectrumMetricToCampos(movement.start, options.pitchDimensions);
      const end = secondSpectrumMetricToCampos(movement.end, options.pitchDimensions);
      return {
        side: movement.side,
        playerId: stableOverlaySubjectId(
          movement.playerId,
          movement.optaId,
          movement.side,
          "movement",
        ),
        optaId: nullableString(movement.optaId),
        shirtNumber: numericShirt(movement.shirtNumber),
        x: start.x,
        y: start.y,
        endX: end.x,
        endY: end.y,
        speed: nullableNumber(movement.speed),
        seconds: nullableNumber(movement.seconds),
        evidence: [...(movement.evidence ?? [])],
        sourceMeta: movement.sourceMeta ?? null,
      };
    }),
    facingHints: (snapshot.facingHints ?? []).map((hint) => {
      const start = secondSpectrumMetricToCampos(hint.start, options.pitchDimensions);
      const end = secondSpectrumMetricToCampos(hint.end, options.pitchDimensions);
      return {
        side: hint.side,
        playerId: stableOverlaySubjectId(
          hint.playerId,
          hint.optaId,
          hint.side,
          "facing hint",
        ),
        optaId: nullableString(hint.optaId),
        shirtNumber: numericShirt(hint.shirtNumber),
        x: start.x,
        y: start.y,
        endX: end.x,
        endY: end.y,
        basis: hint.basis ?? "movement-vector",
        speed: nullableNumber(hint.speed),
        evidence: [...(hint.evidence ?? [])],
        sourceMeta: hint.sourceMeta ?? null,
      };
    }),
    candidateLanes: (snapshot.candidateLanes ?? []).map((lane) => {
      const start = secondSpectrumMetricToCampos(lane.start, options.pitchDimensions);
      const end = secondSpectrumMetricToCampos(lane.end, options.pitchDimensions);
      return {
        side: lane.side,
        receiverPlayerId: stableOverlaySubjectId(
          lane.receiverPlayerId,
          lane.receiverOptaId,
          lane.side,
          "candidate lane receiver",
        ),
        receiverOptaId: nullableString(lane.receiverOptaId),
        receiverShirtNumber: numericShirt(lane.receiverShirtNumber),
        x: start.x,
        y: start.y,
        endX: end.x,
        endY: end.y,
        clearance: nullableNumber(lane.clearance),
        blockers: nonNegativeInteger(lane.blockers),
        length: nullableNumber(lane.length),
        evidence: [...(lane.evidence ?? [])],
        sourceMeta: lane.sourceMeta ?? null,
      };
    }),
    provider: options.provider ?? "second-spectrum",
    caveat: snapshot.caveat ?? null,
    sourceMeta: snapshot.sourceMeta ?? null,
  };
}

export function teamShapeSnapshots(
  snapshots: readonly SecondSpectrumTeamShapeSnapshotInput[],
  options: SecondSpectrumTeamShapeSnapshotOptions,
): TeamShapeSnapshot[] {
  return snapshots.map((snapshot) => teamShapeSnapshot(snapshot, options));
}

export const fromSecondSpectrum = {
  metricToCampos: secondSpectrumMetricToCampos,
  trackingFrame,
  trackingFrames,
  physicalWindow,
  physicalWindows,
  physicalSummaryWindow,
  physicalSummaryWindows,
  physicalTeamSplitWindows,
  physicalTeamSplitBlocks,
  sequenceMoment,
  sequenceMoments,
  teamShapeSnapshot,
  teamShapeSnapshots,
};
