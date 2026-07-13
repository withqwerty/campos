import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { TrackingFrameSnapshot } from "@withqwerty/campos-schema";
import { Pitch } from "@withqwerty/campos-stadia";

import { buildTrackingFrameScene } from "../src/compute/index.js";
import { TrackingFrameOverlay } from "../src/primitives/index.js";

afterEach(cleanup);

const project = (x: number, y: number) => ({ x, y });

const frame: TrackingFrameSnapshot = {
  id: "match-1:second-spectrum:frame:1",
  matchId: "match-1",
  period: 1,
  frameId: "1",
  gameClockSeconds: 12,
  live: true,
  coordinateFrame: "absolute-pitch",
  pitchDimensions: { length: 105, width: 68 },
  homeAttacksToward: "increasing-x",
  players: [
    {
      side: "home",
      playerId: "home-1",
      optaId: null,
      shirtNumber: 9,
      x: 20,
      y: 30,
      speed: 0,
    },
    {
      side: "away",
      playerId: "away-1",
      optaId: null,
      shirtNumber: null,
      x: 80,
      y: 70,
      speed: null,
    },
  ],
  ball: { x: 50, y: 50, z: 0, speed: 0 },
  provider: "second-spectrum",
  providerFrameId: "1",
};

const fullFrame: TrackingFrameSnapshot = {
  ...frame,
  frameId: "22-player",
  players: [
    ...Array.from({ length: 11 }, (_, index) => ({
      side: "home" as const,
      playerId: `home-${index + 1}`,
      optaId: null,
      shirtNumber: index + 1,
      x: 8 + index * 4,
      y: 10 + index * 7,
      speed: index === 0 ? 0 : 4,
    })),
    ...Array.from({ length: 11 }, (_, index) => ({
      side: "away" as const,
      playerId: `away-${index + 1}`,
      optaId: null,
      shirtNumber: index + 1,
      x: 52 + index * 4,
      y: 10 + index * 7,
      speed: 4,
    })),
  ],
};

describe("TrackingFrameOverlay", () => {
  it("builds absolute-pitch marks while preserving zero speed", () => {
    const scene = buildTrackingFrameScene(frame);

    expect(scene.players).toHaveLength(2);
    expect(scene.players[0]?.ariaLabel).toContain("0 speed");
    expect(scene.accessibleLabel).toContain("ball tracked");
  });

  it("renders player and ball marks with accessible labels", () => {
    const { container } = render(
      <svg>
        <TrackingFrameOverlay frame={frame} project={project} testId="tracking-frame" />
      </svg>,
    );

    expect(screen.getByTestId("tracking-frame")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("2 players"),
    );
    expect(screen.getByLabelText("home player shirt 9, 0 speed")).toBeInTheDocument();
    expect(screen.getByLabelText("Ball, 0 speed")).toBeInTheDocument();
    expect(container.querySelectorAll("g[role='img']")).toHaveLength(3);
  });

  it("makes the focused player mark visibly active", () => {
    render(
      <svg>
        <TrackingFrameOverlay frame={frame} project={project} />
      </svg>,
    );
    const player = screen.getByLabelText("home player shirt 9, 0 speed");

    fireEvent.focus(player);
    expect(player).toHaveAttribute("data-active", "true");

    fireEvent.blur(player);
    expect(player).not.toHaveAttribute("data-active");
  });

  it("keeps all 22 canonical player identities as distinct SVG marks", () => {
    const { container } = render(
      <svg>
        <TrackingFrameOverlay frame={fullFrame} project={project} />
      </svg>,
    );

    expect(screen.getByLabelText(/22 players/)).toBeInTheDocument();
    expect(container.querySelectorAll("g[role='img']")).toHaveLength(23);
  });

  it("composes with both Stadia pitch orientations without changing the frame", () => {
    const { container, rerender } = render(
      <Pitch crop="full" attackingDirection="up">
        {({ project }) => <TrackingFrameOverlay frame={frame} project={project} />}
      </Pitch>,
    );
    expect(container.querySelectorAll("g[role='img']")).toHaveLength(3);

    rerender(
      <Pitch crop="full" attackingDirection="right">
        {({ project }) => <TrackingFrameOverlay frame={frame} project={project} />}
      </Pitch>,
    );
    expect(container.querySelectorAll("g[role='img']")).toHaveLength(3);
  });

  it("reports an honest empty player state without inventing a lineup", () => {
    const empty = { ...frame, players: [], ball: null };
    const { container } = render(
      <svg>
        <TrackingFrameOverlay frame={empty} project={project} />
      </svg>,
    );

    expect(
      screen.getByLabelText(
        /0 players, ball untracked\. No tracked players in this frame/,
      ),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("circle")).toHaveLength(0);
    expect(buildTrackingFrameScene(empty).emptyMessage).toBe(
      "No tracked players in this frame.",
    );
  });

  it("omits an untracked ball and rejects duplicate identities", () => {
    const noBall = { ...frame, ball: null };
    const { container } = render(
      <svg>
        <TrackingFrameOverlay frame={noBall} project={project} />
      </svg>,
    );
    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect(buildTrackingFrameScene(noBall).accessibleLabel).toContain("ball untracked");

    expect(() =>
      buildTrackingFrameScene({
        ...frame,
        players: [frame.players[0]!, { ...frame.players[0]!, side: "away" }],
      }),
    ).toThrow(/unique playerId/i);
  });
});
