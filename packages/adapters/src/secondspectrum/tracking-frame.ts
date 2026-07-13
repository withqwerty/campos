import type { TrackingFrameSnapshot } from "@withqwerty/campos-schema";
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
  speed?: number | readonly [number] | readonly [] | null;
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

export function assertSecondSpectrumPitchDimensions(
  dimensions: SecondSpectrumPitchDimensions,
) {
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

function nullableBallSpeed(value: unknown): number | null {
  if (Array.isArray(value)) {
    return value.length === 1 ? nullableNumber(value[0]) : null;
  }
  return nullableNumber(value);
}

function numericShirt(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
  assertSecondSpectrumPitchDimensions(pitchDimensions);
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
  frameId: string,
): TrackingFrameSnapshot["players"][number] {
  const projected = secondSpectrumMetricToCampos(
    [player.xyz[0], player.xyz[1]],
    pitchDimensions,
  );
  const playerId = player.playerId ?? player.ssiId ?? player.optaId;
  if (playerId == null || playerId === "") {
    throw new Error(
      `Second Spectrum ${side} player in frame ${frameId} requires a stable player identifier.`,
    );
  }

  return {
    side,
    playerId: String(playerId),
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
  if (!ball || ball.xyz[2] === -10) return null;
  const projected = secondSpectrumMetricToCampos(
    [ball.xyz[0], ball.xyz[1]],
    pitchDimensions,
  );
  return {
    x: projected.x,
    y: projected.y,
    z: nullableNumber(ball.xyz[2]),
    speed: nullableBallSpeed(ball.speed),
  };
}

export function trackingFrame(
  frame: SecondSpectrumTrackingFrame,
  options: SecondSpectrumTrackingFrameOptions,
): TrackingFrameSnapshot {
  assertSecondSpectrumPitchDimensions(options.pitchDimensions);
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
        mapPlayer(player, "home", options.pitchDimensions, frameId),
      ),
      ...frame.awayPlayers.map((player) =>
        mapPlayer(player, "away", options.pitchDimensions, frameId),
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
