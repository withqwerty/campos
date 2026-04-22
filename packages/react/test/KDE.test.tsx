import { cleanup, fireEvent, render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KDEEvent } from "../src/compute/index.js";

import { KDE, ThemeProvider, DARK_THEME } from "../src/index";

afterEach(cleanup);

const events: KDEEvent[] = [
  { x: 50, y: 50 },
  { x: 55, y: 45 },
  { x: 60, y: 52 },
  { x: 70, y: 30 },
  { x: 75, y: 25 },
];

// Note: canvas-based rendering doesn't work in jsdom (no 2d context).
// Tests focus on the component shell, empty state, aria labels, and theme.

// ─── Rendering ──────────────────────────────────────────────────────

describe("<KDE /> — rendering", () => {
  it("renders the component shell with correct aria-label", () => {
    const { getByLabelText } = render(<KDE events={events} />);

    expect(getByLabelText("KDE density map: 5 events")).toBeInTheDocument();
  });

  it("renders the empty state with pill when there are no events", () => {
    const { getByText, getByLabelText } = render(<KDE events={[]} />);

    expect(getByLabelText("KDE density map: no events")).toBeInTheDocument();
    expect(getByText("No event data")).toBeInTheDocument();
  });

  it("renders a scale bar when events are present", () => {
    const { getByText } = render(<KDE events={events} />);

    expect(getByText("Density")).toBeInTheDocument();
  });

  it("hides scale bar in empty state", () => {
    const { queryByText } = render(<KDE events={[]} />);

    expect(queryByText("Density")).not.toBeInTheDocument();
  });

  it("shows an explicit low-confidence warning for sparse data", () => {
    const { getByTestId } = render(<KDE events={[{ x: 50, y: 50 }]} />);

    expect(getByTestId("kde-warning").textContent).toContain(
      "KDE smoothing may not be meaningful",
    );
  });

  it("labels the scale bar as Kernel sum when normalize is false", () => {
    const { getByText } = render(<KDE events={events} normalize={false} />);

    expect(getByText("Kernel sum")).toBeInTheDocument();
  });

  it("lets guides override the scale-bar label via callback", () => {
    const { getByText } = render(
      <KDE
        events={events}
        guides={{
          label: ({ model }) =>
            model.meta.validEvents > 3 ? "Touch Density" : "Sparse Density",
        }}
      />,
    );

    expect(getByText("Touch Density")).toBeInTheDocument();
  });

  it("lets guides hide the scale bar via callback", () => {
    const { queryByTestId } = render(
      <KDE events={events} guides={{ showScaleBar: () => false }} />,
    );

    expect(queryByTestId("kde-scale-bar")).not.toBeInTheDocument();
  });
});

// ─── Interaction ────────────────────────────────────────────────────

describe("<KDE /> — interaction", () => {
  it("shows a tooltip when hovering the density surface", () => {
    const { container, getByTestId } = render(<KDE events={events} />);

    const hitRect = container.querySelector('rect[fill="transparent"]');
    expect(hitRect).not.toBeNull();

    // The hit-rect lives inside Stadia's inner SVG (the one with explicit
    // width/height). readSvgPoint uses ownerSVGElement, so we must mock
    // getBoundingClientRect on the inner SVG, not the outer.
    const innerSvg = (hitRect as SVGRectElement).ownerSVGElement!;
    expect(innerSvg).toBeInstanceOf(SVGSVGElement);
    vi.spyOn(innerSvg, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 68,
      right: 105,
      width: 105,
      height: 68,
      toJSON: () => ({}),
    });

    // Hover near (svgX≈52, svgY≈34) → pitchX≈50, pitchY≈50 where events
    // cluster. With the mock matching the SVG viewBox (105×68), the fallback
    // path in readSvgPoint maps client coords 1:1 to SVG coords.
    fireEvent.mouseMove(hitRect as SVGRectElement, { clientX: 52, clientY: 34 });
    expect(getByTestId("kde-tooltip")).toBeInTheDocument();
  });
});

// ─── Theme context ──────────────────────────────────────────────────

describe("<KDE /> — theme context", () => {
  it("uses dark theme in empty state when wrapped in ThemeProvider", () => {
    const { getByText } = render(
      <ThemeProvider value={DARK_THEME}>
        <KDE events={[]} />
      </ThemeProvider>,
    );

    // The empty state pill should render with dark theme surface
    const pill = getByText("No event data");
    expect(pill).toHaveStyle({
      background: DARK_THEME.surface.tooltip,
    });
  });

  it("applies area opacity callbacks to the rendered density surface", () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({
        putImageData: vi.fn(),
      } as unknown as CanvasRenderingContext2D);
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue("data:image/png;base64,test");

    const { getByTestId } = render(
      <KDE
        events={events}
        areas={{
          opacity: ({ model }) => (model.meta.validEvents > 3 ? 0.4 : 1),
        }}
      />,
    );

    expect(getByTestId("kde-surface")).toHaveAttribute("opacity", "0.4");
    getContext.mockRestore();
    toDataURL.mockRestore();
  });
});

// ─── Accessibility ──────────────────────────────────────────────────

describe("<KDE /> — accessibility", () => {
  it("has no axe violations with event data", async () => {
    const { container } = render(<KDE events={events} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations in empty state", async () => {
    const { container } = render(<KDE events={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("container has an accessible label describing the chart", () => {
    const { container } = render(<KDE events={events} />);

    const section = container.querySelector("[aria-label]");
    expect(section).not.toBeNull();
    expect(section!.getAttribute("aria-label")).toMatch(/KDE density map: \d+ events/);
  });
});
