import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Pitch } from "@withqwerty/campos-stadia";

import { buildFreezeFrameScene, type EventFreezeFrame } from "../src/compute/index.js";
import { FreezeFrameOverlay } from "../src/primitives/index.js";

afterEach(cleanup);

const project = (x: number, y: number) => ({ x, y });

const frame: EventFreezeFrame = {
  participants: [
    { id: "frame-1:0", side: "teammate", isActor: true, isKeeper: false, x: 60, y: 40 },
    { id: "frame-1:1", side: "opponent", isActor: false, isKeeper: true, x: 80, y: 55 },
    { id: "frame-1:2", side: "opponent", isActor: false, isKeeper: false, x: 45, y: 70 },
  ],
  visibleArea: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ],
};

describe("FreezeFrameOverlay", () => {
  it("builds role-aware anonymous participant marks", () => {
    const scene = buildFreezeFrameScene(frame);

    expect(scene.participants).toHaveLength(3);
    expect(scene.participants[0]?.ariaLabel).toBe("teammate actor");
    expect(scene.participants[1]?.ariaLabel).toBe("opponent goalkeeper");
    expect(scene.accessibleLabel).toContain("camera area shown");
  });

  it("renders the camera area, actor ring, goalkeeper shape, and accessible roles", () => {
    const { container } = render(
      <svg>
        <FreezeFrameOverlay frame={frame} project={project} testId="freeze-frame" />
      </svg>,
    );

    expect(screen.getByTestId("freeze-frame")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("3 participants"),
    );
    expect(screen.getByTestId("freeze-frame-visible-area")).toHaveAttribute(
      "points",
      "0,0 100,0 100,100",
    );
    expect(screen.getByLabelText("teammate actor")).toHaveAttribute("data-role", "actor");
    expect(screen.getByLabelText("opponent goalkeeper")).toHaveAttribute(
      "data-role",
      "keeper",
    );
    expect(container.querySelectorAll("g[role='img']")).toHaveLength(3);
    expect(container.querySelectorAll("rect")).toHaveLength(1);
  });

  it("makes the focused participant visibly active", () => {
    render(
      <svg>
        <FreezeFrameOverlay frame={frame} project={project} />
      </svg>,
    );
    const actor = screen.getByLabelText("teammate actor");

    fireEvent.focus(actor);
    expect(actor).toHaveAttribute("data-active", "true");

    fireEvent.blur(actor);
    expect(actor).not.toHaveAttribute("data-active");
  });

  it("renders without a camera polygon and describes an empty frame honestly", () => {
    const empty: EventFreezeFrame = { participants: [], visibleArea: null };
    const { container } = render(
      <svg>
        <FreezeFrameOverlay frame={empty} project={project} />
      </svg>,
    );

    expect(
      screen.getByLabelText(
        /0 participants, camera area unavailable\. No participants in this freeze frame/,
      ),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("g[role='img']")).toHaveLength(0);
    expect(buildFreezeFrameScene(empty).emptyMessage).toBe(
      "No participants in this freeze frame.",
    );
  });

  it("composes with the existing pitch orientation contract", () => {
    const { container } = render(
      <Pitch crop="full" attackingDirection="up">
        {({ project }) => <FreezeFrameOverlay frame={frame} project={project} />}
      </Pitch>,
    );

    expect(container.querySelectorAll("g[role='img']")).toHaveLength(3);
  });

  it("rejects duplicate frame-local participant IDs", () => {
    expect(() =>
      buildFreezeFrameScene({
        ...frame,
        participants: [frame.participants[0]!, frame.participants[0]!],
      }),
    ).toThrow(/unique participant ids/i);
  });
});
