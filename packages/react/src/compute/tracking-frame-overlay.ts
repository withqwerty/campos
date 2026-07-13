import type { TrackingFrameSnapshot } from "@withqwerty/campos-schema";

export type TrackingFramePlayerMark = TrackingFrameSnapshot["players"][number] & {
  ariaLabel: string;
};

export type TrackingFrameScene = {
  frameId: string;
  accessibleLabel: string;
  players: TrackingFramePlayerMark[];
  ball: TrackingFrameSnapshot["ball"];
  emptyMessage: string | null;
};

/**
 * Prepares renderer-safe canonical tracking marks. It deliberately preserves
 * absolute pitch coordinates and derives no tactical state.
 */
export function buildTrackingFrameScene(
  frame: TrackingFrameSnapshot,
): TrackingFrameScene {
  const seenPlayerIds = new Set<string>();
  const players = frame.players.map((player) => {
    if (seenPlayerIds.has(player.playerId)) {
      throw new Error(
        `TrackingFrameOverlay requires unique playerId values; duplicate ${player.playerId}.`,
      );
    }
    seenPlayerIds.add(player.playerId);
    const shirt =
      player.shirtNumber == null ? player.playerId : `shirt ${player.shirtNumber}`;
    const speed = player.speed == null ? "speed unavailable" : `${player.speed} speed`;
    return { ...player, ariaLabel: `${player.side} player ${shirt}, ${speed}` };
  });

  const ballLabel = frame.ball ? ", ball tracked" : ", ball untracked";
  const emptyMessage = players.length === 0 ? "No tracked players in this frame." : null;
  return {
    frameId: frame.frameId,
    accessibleLabel: `Tracking frame ${frame.frameId}, ${players.length} players${ballLabel}.${
      emptyMessage == null ? "" : ` ${emptyMessage}`
    }`,
    players,
    ball: frame.ball,
    emptyMessage,
  };
}
