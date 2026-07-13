import type { TrackingFrameSnapshot } from "@withqwerty/campos-schema";
import { clampToCamposRange } from "@withqwerty/campos-schema";

export type MetricaKloppyCoordinate = readonly [number, number] | null;

/** A deliberately small serialisable projection of kloppy's tracking Frame. */
export type MetricaKloppyTrackingPlayer = {
  playerId: string | number;
  side: "home" | "away";
  coordinates: MetricaKloppyCoordinate;
  shirtNumber?: string | number | null;
  speed?: number | null;
  sourceMeta?: Record<string, unknown> | null;
};

export type MetricaKloppyTrackingBall = {
  coordinates: MetricaKloppyCoordinate;
  speed?: number | null;
  z?: number | null;
};

export type MetricaKloppyTrackingFrame = {
  frameId: string | number;
  period: number;
  gameClockSeconds: number;
  live?: boolean | null;
  players: readonly MetricaKloppyTrackingPlayer[];
  ball?: MetricaKloppyTrackingBall | null;
  sourceMeta?: Record<string, unknown> | null;
};

export type MetricaKloppyTrackingFrameOptions = {
  matchId: string;
  pitchDimensions: { length: number; width: number };
  /** EPTS metadata normalised to Campos's static absolute-pitch x axis. */
  homeAttacksTowardFirstHalf?: "increasing-x" | "decreasing-x" | null;
  provider?: string;
};

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numericShirt(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function flipDirection(
  direction: "increasing-x" | "decreasing-x",
): "increasing-x" | "decreasing-x" {
  return direction === "increasing-x" ? "decreasing-x" : "increasing-x";
}

/**
 * Projects kloppy's Metrica EPTS 0..1, top-left co-ordinates into Campos's
 * static absolute pitch. It intentionally does not rotate by possession:
 * both teams occupy the frame at once.
 */
export function metricaKloppyToCampos(
  coordinates: MetricaKloppyCoordinate,
): { x: number; y: number } | null {
  if (
    coordinates == null ||
    !finiteNumber(coordinates[0]) ||
    !finiteNumber(coordinates[1])
  ) {
    return null;
  }

  return {
    x: clampToCamposRange(coordinates[0] * 100),
    y: clampToCamposRange((1 - coordinates[1]) * 100),
  };
}

function homeAttacksToward(
  period: number,
  firstHalf: MetricaKloppyTrackingFrameOptions["homeAttacksTowardFirstHalf"],
): "increasing-x" | "decreasing-x" | null {
  if (firstHalf == null) return null;
  return period % 2 === 0 ? flipDirection(firstHalf) : firstHalf;
}

/**
 * Adapts a pre-loaded kloppy Metrica EPTS frame to the shipped tracking
 * snapshot. This is a fixture/integration seam, not a browser-side EPTS
 * parser and not a commitment to a standalone `fromMetrica` adapter.
 */
export function metricaTrackingFrameFromKloppy(
  frame: MetricaKloppyTrackingFrame,
  options: MetricaKloppyTrackingFrameOptions,
): TrackingFrameSnapshot {
  if (
    !Number.isFinite(options.pitchDimensions.length) ||
    !Number.isFinite(options.pitchDimensions.width) ||
    options.pitchDimensions.length <= 0 ||
    options.pitchDimensions.width <= 0
  ) {
    throw new Error("Metrica pitchDimensions must include positive length and width.");
  }

  const providerFrameId = String(frame.frameId);
  const seenPlayerIds = new Set<string>();
  const players: TrackingFrameSnapshot["players"] = [];

  for (const player of frame.players) {
    const projected = metricaKloppyToCampos(player.coordinates);
    if (projected == null) continue;

    const playerId = String(player.playerId);
    if (playerId === "") {
      throw new Error(
        `Metrica player in frame ${providerFrameId} requires a stable player identifier.`,
      );
    }
    if (seenPlayerIds.has(playerId)) {
      throw new Error(
        `Metrica frame ${providerFrameId} has duplicate playerId ${playerId}.`,
      );
    }
    seenPlayerIds.add(playerId);

    players.push({
      side: player.side,
      playerId,
      optaId: null,
      shirtNumber: numericShirt(player.shirtNumber),
      x: projected.x,
      y: projected.y,
      z: null,
      speed: finiteNumber(player.speed) ? player.speed : null,
      sourceMeta: player.sourceMeta ?? null,
    });
  }

  const ballPosition = metricaKloppyToCampos(frame.ball?.coordinates ?? null);
  const ball =
    ballPosition == null
      ? null
      : {
          ...ballPosition,
          z: finiteNumber(frame.ball?.z) ? frame.ball.z : null,
          speed: finiteNumber(frame.ball?.speed) ? frame.ball.speed : null,
        };

  return {
    id: `${options.matchId}:metrica-kloppy:frame:${providerFrameId}`,
    matchId: options.matchId,
    period: frame.period,
    frameId: providerFrameId,
    gameClockSeconds: frame.gameClockSeconds,
    wallClockSeconds: null,
    live: frame.live ?? false,
    coordinateFrame: "absolute-pitch",
    pitchDimensions: options.pitchDimensions,
    homeAttacksToward: homeAttacksToward(
      frame.period,
      options.homeAttacksTowardFirstHalf,
    ),
    players,
    ball,
    provider: options.provider ?? "metrica-kloppy",
    providerFrameId,
    sourceMeta: frame.sourceMeta ?? null,
  };
}
