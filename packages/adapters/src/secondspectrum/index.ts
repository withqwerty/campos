import type {
  PhysicalWindow,
  SequenceMomentSnapshot,
  TeamShapeSnapshot,
  TrackingFrameSnapshot,
} from "@withqwerty/campos-schema";
import { clampToCamposRange } from "@withqwerty/campos-schema";

export type SecondSpectrumPitchDimensions = {
  length: number;
  width: number;
};

export type SecondSpectrumDirection = "increasing-x" | "decreasing-x";

export type SecondSpectrumTrackingPlayer = {
  playerId?: string | number | null;
  ssiId?: string | number | null;
  optaId?: string | number | null;
  number?: string | number | null;
  shirtNumber?: string | number | null;
  xyz: readonly [number, number, number] | readonly [number, number];
  speed?: number | null;
  sourceMeta?: Record<string, unknown> | null;
};

export type SecondSpectrumTrackingBall = {
  xyz: readonly [number, number, number] | readonly [number, number];
  speed?: number | null;
};

export type SecondSpectrumTrackingFrame = {
  period: number;
  frameIdx?: string | number | null;
  frameId?: string | number | null;
  gameClock: number;
  wallClock?: number | null;
  homePlayers: readonly SecondSpectrumTrackingPlayer[];
  awayPlayers: readonly SecondSpectrumTrackingPlayer[];
  ball?: SecondSpectrumTrackingBall | null;
  live?: boolean | null;
  sourceMeta?: Record<string, unknown> | null;
};

export type SecondSpectrumTrackingFrameOptions = {
  matchId: string;
  pitchDimensions: SecondSpectrumPitchDimensions;
  homeAttacksToward?: SecondSpectrumDirection | null;
  provider?: string;
};

export type SecondSpectrumPhysicalWindowInput = {
  rowId?: string | number | null;
  subjectKind: "team" | "player";
  subjectId: string | number;
  subjectName?: string | null;
  side?: "home" | "away" | null;
  phase?: PhysicalWindow["phase"];
  label: string;
  startMinute?: number | null;
  endMinute?: number | null;
  distance?: number | null;
  highSpeedRunning?: number | null;
  sprinting?: number | null;
  highIntensityRuns?: number | null;
  highSpeedRunningCount?: number | null;
  sprintingCount?: number | null;
  topSpeed?: number | null;
  averageSpeed?: number | null;
  sourceMeta?: Record<string, unknown> | null;
};

export type SecondSpectrumPhysicalWindowOptions = {
  matchId: string;
  provider?: string;
};

export type SecondSpectrumPhysicalSummaryRow = {
  optaId: string | number;
  player?: string | null;
  playerName?: string | null;
  side?: "home" | "away" | null;
  teamSide?: "home" | "away" | null;
  minutes?: string | number | null;
  distance?: number | null;
  highSpeedRunning?: number | null;
  sprinting?: number | null;
  highIntensityRuns?: number | null;
  distanceTip?: number | null;
  distanceOtip?: number | null;
  distanceBop?: number | null;
  topSpeed?: number | null;
  averageSpeed?: number | null;
  sourceMeta?: Record<string, unknown> | null;
};

export type SecondSpectrumPhysicalSummaryOptions = SecondSpectrumPhysicalWindowOptions & {
  label?: string;
  phase?: PhysicalWindow["phase"];
};

export type SecondSpectrumPhysicalSplitMetric = {
  label: string;
  values: readonly (number | null | undefined)[];
};

export type SecondSpectrumTeamPhysicalSplitBlockInput = {
  subjectId: string | number;
  subjectName?: string | null;
  teamLabel?: string | null;
  side?: "home" | "away" | null;
  phase?: PhysicalWindow["phase"];
  minuteMarks: readonly string[];
  metrics: readonly SecondSpectrumPhysicalSplitMetric[];
  sourceMeta?: Record<string, unknown> | null;
};

export type SecondSpectrumTeamPhysicalSplitOptions =
  SecondSpectrumPhysicalWindowOptions & {
    splitMinutes?: number;
  };

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

type TeamShapePolygonPoints = TeamShapeSnapshot["polygons"][number]["points"];

function assertPitchDimensions(dimensions: SecondSpectrumPitchDimensions) {
  if (
    !Number.isFinite(dimensions.length) ||
    !Number.isFinite(dimensions.width) ||
    dimensions.length <= 0 ||
    dimensions.width <= 0
  ) {
    throw new Error(
      "Second Spectrum pitchDimensions must include positive length and width.",
    );
  }
}

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

function providerFrameId(frame: SecondSpectrumTrackingFrame): string {
  const value = frame.frameId ?? frame.frameIdx;
  if (value == null || value === "") {
    return `${frame.period}:${frame.gameClock.toFixed(3)}`;
  }
  return String(value);
}

/**
 * Convert Second Spectrum centred metric coordinates to absolute full-pitch
 * Campos percentages. This is not attacker-relative event space; it is the
 * stable frame needed for freeze views containing both teams at once.
 */
export function secondSpectrumMetricToCampos(
  point: readonly [number, number],
  pitchDimensions: SecondSpectrumPitchDimensions,
): { x: number; y: number } {
  assertPitchDimensions(pitchDimensions);
  return {
    x: clampToCamposRange(
      ((point[0] + pitchDimensions.length / 2) / pitchDimensions.length) * 100,
    ),
    y: clampToCamposRange(
      ((point[1] + pitchDimensions.width / 2) / pitchDimensions.width) * 100,
    ),
  };
}

function mapPlayer(
  player: SecondSpectrumTrackingPlayer,
  side: "home" | "away",
  pitchDimensions: SecondSpectrumPitchDimensions,
): TrackingFrameSnapshot["players"][number] {
  const projected = secondSpectrumMetricToCampos(
    [player.xyz[0], player.xyz[1]],
    pitchDimensions,
  );
  const playerId = player.playerId ?? player.ssiId ?? player.optaId;
  return {
    side,
    playerId: playerId == null ? `${side}:unknown` : String(playerId),
    optaId: player.optaId == null ? null : String(player.optaId),
    shirtNumber: numericShirt(player.shirtNumber ?? player.number),
    x: projected.x,
    y: projected.y,
    z: nullableNumber(player.xyz[2]),
    speed: nullableNumber(player.speed),
    sourceMeta: player.sourceMeta ?? null,
  };
}

function mapBall(
  ball: SecondSpectrumTrackingBall | null | undefined,
  pitchDimensions: SecondSpectrumPitchDimensions,
): TrackingFrameSnapshot["ball"] {
  if (!ball) return null;
  const projected = secondSpectrumMetricToCampos(
    [ball.xyz[0], ball.xyz[1]],
    pitchDimensions,
  );
  return {
    x: projected.x,
    y: projected.y,
    z: nullableNumber(ball.xyz[2]),
    speed: nullableNumber(ball.speed),
  };
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

export function trackingFrame(
  frame: SecondSpectrumTrackingFrame,
  options: SecondSpectrumTrackingFrameOptions,
): TrackingFrameSnapshot {
  assertPitchDimensions(options.pitchDimensions);
  const frameId = providerFrameId(frame);
  return {
    id: `${options.matchId}:second-spectrum:frame:${frameId}`,
    matchId: options.matchId,
    period: frame.period,
    frameId,
    gameClockSeconds: frame.gameClock,
    wallClockSeconds: nullableNumber(frame.wallClock),
    live: frame.live ?? false,
    coordinateFrame: "absolute-pitch",
    pitchDimensions: options.pitchDimensions,
    homeAttacksToward: options.homeAttacksToward ?? null,
    players: [
      ...frame.homePlayers.map((player) =>
        mapPlayer(player, "home", options.pitchDimensions),
      ),
      ...frame.awayPlayers.map((player) =>
        mapPlayer(player, "away", options.pitchDimensions),
      ),
    ],
    ball: mapBall(frame.ball, options.pitchDimensions),
    provider: options.provider ?? "second-spectrum",
    providerFrameId: frameId,
    sourceMeta: frame.sourceMeta ?? null,
  };
}

export function trackingFrames(
  frames: readonly SecondSpectrumTrackingFrame[],
  options: SecondSpectrumTrackingFrameOptions,
): TrackingFrameSnapshot[] {
  return frames.map((frame) => trackingFrame(frame, options));
}

export function physicalWindow(
  row: SecondSpectrumPhysicalWindowInput,
  options: SecondSpectrumPhysicalWindowOptions,
): PhysicalWindow {
  const providerRowId =
    row.rowId == null ? `${row.subjectId}:${row.label}` : String(row.rowId);
  return {
    id: `${options.matchId}:second-spectrum:physical:${providerRowId}`,
    matchId: options.matchId,
    subjectKind: row.subjectKind,
    subjectId: String(row.subjectId),
    subjectName: row.subjectName ?? null,
    side: row.side ?? null,
    phase: row.phase ?? "all",
    label: row.label,
    startMinute: nullableNumber(row.startMinute),
    endMinute: nullableNumber(row.endMinute),
    metrics: {
      distance: nullableNumber(row.distance),
      highSpeedRunning: nullableNumber(row.highSpeedRunning),
      sprinting: nullableNumber(row.sprinting),
      highIntensityRuns: nullableNumber(row.highIntensityRuns),
      highSpeedRunningCount: nullableNumber(row.highSpeedRunningCount),
      sprintingCount: nullableNumber(row.sprintingCount),
      topSpeed: nullableNumber(row.topSpeed),
      averageSpeed: nullableNumber(row.averageSpeed),
    },
    provider: options.provider ?? "second-spectrum",
    providerRowId,
    sourceMeta: row.sourceMeta ?? null,
  };
}

export function physicalWindows(
  rows: readonly SecondSpectrumPhysicalWindowInput[],
  options: SecondSpectrumPhysicalWindowOptions,
): PhysicalWindow[] {
  return rows.map((row) => physicalWindow(row, options));
}

export function physicalSummaryWindow(
  row: SecondSpectrumPhysicalSummaryRow,
  options: SecondSpectrumPhysicalSummaryOptions,
): PhysicalWindow {
  const label = options.label ?? "full match";
  return physicalWindow(
    {
      rowId: `${row.optaId}:${label.replace(/\s+/g, "-")}`,
      subjectKind: "player",
      subjectId: row.optaId,
      subjectName: row.playerName ?? row.player ?? null,
      side: row.side ?? row.teamSide ?? null,
      phase: options.phase ?? "all",
      label,
      distance: nullableNumber(row.distance),
      highSpeedRunning: nullableNumber(row.highSpeedRunning),
      sprinting: nullableNumber(row.sprinting),
      highIntensityRuns: nullableNumber(row.highIntensityRuns),
      topSpeed: nullableNumber(row.topSpeed),
      averageSpeed: nullableNumber(row.averageSpeed),
      sourceMeta: {
        source: "Second Spectrum PhysicalSummary CSV",
        minutes: row.minutes ?? null,
        distanceTip: nullableNumber(row.distanceTip),
        distanceOtip: nullableNumber(row.distanceOtip),
        distanceBop: nullableNumber(row.distanceBop),
        ...(row.sourceMeta ?? {}),
      },
    },
    options,
  );
}

export function physicalSummaryWindows(
  rows: readonly SecondSpectrumPhysicalSummaryRow[],
  options: SecondSpectrumPhysicalSummaryOptions,
): PhysicalWindow[] {
  return rows.map((row) => physicalSummaryWindow(row, options));
}

function splitMetricValue(
  block: SecondSpectrumTeamPhysicalSplitBlockInput,
  label: string,
  index: number,
): number | null {
  const value = block.metrics.find((metric) => metric.label === label)?.values[index];
  return nullableNumber(value);
}

function splitWindowBounds(
  minuteMarks: readonly string[],
  index: number,
  splitMinutes: number,
): { startMinute: number | null; endMinute: number | null; label: string } {
  const endMinute = Number.parseFloat(minuteMarks[index] ?? "");
  if (!Number.isFinite(endMinute)) {
    return {
      startMinute: null,
      endMinute: null,
      label: minuteMarks[index] ?? `split ${index + 1}`,
    };
  }
  const previous = Number.parseFloat(minuteMarks[index - 1] ?? "");
  const startMinute =
    index === 0
      ? Math.max(0, endMinute - splitMinutes)
      : Number.isFinite(previous) && endMinute > previous
        ? previous
        : Math.max(0, endMinute - splitMinutes);
  return {
    startMinute,
    endMinute,
    label: `${startMinute}-${endMinute}`,
  };
}

export function physicalTeamSplitWindows(
  block: SecondSpectrumTeamPhysicalSplitBlockInput,
  options: SecondSpectrumTeamPhysicalSplitOptions,
): PhysicalWindow[] {
  const splitMinutes = options.splitMinutes ?? 5;
  const subjectLabel = block.teamLabel ?? block.subjectName ?? String(block.subjectId);

  return block.minuteMarks.map((_, index) => {
    const { startMinute, endMinute, label } = splitWindowBounds(
      block.minuteMarks,
      index,
      splitMinutes,
    );

    return physicalWindow(
      {
        rowId: `${block.side ?? block.subjectId}:team-split:${index}`,
        subjectKind: "team",
        subjectId: block.subjectId,
        subjectName: block.subjectName ?? block.teamLabel ?? null,
        side: block.side ?? null,
        phase: block.phase ?? "all",
        label,
        startMinute,
        endMinute,
        distance: splitMetricValue(block, "Total Distance", index),
        highSpeedRunning: splitMetricValue(block, "High Speed Running Distance", index),
        sprinting: splitMetricValue(block, "Sprinting Distance", index),
        highSpeedRunningCount: splitMetricValue(block, "High Speed Running Count", index),
        sprintingCount: splitMetricValue(block, "Sprinting Count", index),
        sourceMeta: {
          source: "Second Spectrum PhysicalSplits CSV",
          providerIndex: index,
          evidence: [
            `Second Spectrum PhysicalSplits CSV row ${subjectLabel}, provider split ${index + 1}`,
            "Metrics preserve total distance, HSR distance, sprint distance, HSR count, and sprint count where present.",
          ],
          caveat:
            "Second Spectrum split marks include a half-time separator and repeated minute labels. Use providerIndex/source metadata when aligning ambiguous split windows to video or event time.",
          ...(block.sourceMeta ?? {}),
        },
      },
      options,
    );
  });
}

export function physicalTeamSplitBlocks(
  blocks: readonly SecondSpectrumTeamPhysicalSplitBlockInput[],
  options: SecondSpectrumTeamPhysicalSplitOptions,
): PhysicalWindow[] {
  return blocks.flatMap((block) => physicalTeamSplitWindows(block, options));
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
  assertPitchDimensions(options.pitchDimensions);
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
      const playerId = movement.playerId ?? movement.optaId;
      return {
        side: movement.side,
        playerId: playerId == null ? `${movement.side}:unknown` : String(playerId),
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
      const playerId = hint.playerId ?? hint.optaId;
      return {
        side: hint.side,
        playerId: playerId == null ? `${hint.side}:unknown` : String(playerId),
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
      const receiverPlayerId = lane.receiverPlayerId ?? lane.receiverOptaId;
      return {
        side: lane.side,
        receiverPlayerId:
          receiverPlayerId == null
            ? `${lane.side}:unknown-receiver`
            : String(receiverPlayerId),
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
