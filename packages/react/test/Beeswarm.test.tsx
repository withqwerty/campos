import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Beeswarm } from "../src/index";

afterEach(() => {
  cleanup();
});

describe("<Beeswarm />", () => {
  it("renders an accessible svg with group labels and axis ticks", () => {
    const { container } = render(
      <Beeswarm
        groups={[
          {
            id: "s1",
            label: "22-23",
            values: [
              { id: "a", value: 0.1 },
              { id: "b", value: 0.3 },
              { id: "c", value: 0.5, label: "Star", highlight: {} },
            ],
          },
        ]}
        metric={{ label: "xG / 90" }}
      />,
    );
    expect(container.firstElementChild).toHaveAttribute("data-slot", "frame");
    expect(container.firstElementChild).toHaveAttribute("data-chart-kind", "beeswarm");
    expect(container.firstElementChild).toHaveAttribute("data-empty", "false");
    // SVG is labelled with the axis metric.
    const svg = screen.getByRole("img");
    expect(svg).toHaveAttribute("data-slot", "plot");
    expect(svg.getAttribute("aria-label")).toContain("xG / 90");
    // Group label is rendered.
    expect(screen.getByText("22-23")).toBeInTheDocument();
    // Highlight label.
    expect(screen.getByText("Star")).toBeInTheDocument();
  });

  it("renders an empty-state message when no values", () => {
    render(
      <Beeswarm
        groups={[{ id: "g", label: "G", values: [] }]}
        metric={{ label: "m" }}
        emptyMessage="nothing here"
      />,
    );
    expect(screen.getByText("nothing here")).toBeInTheDocument();
  });

  it("shows a cursor tooltip when hovering a dot", () => {
    render(
      <Beeswarm
        groups={[
          {
            id: "g",
            label: "G",
            values: [{ id: "a", value: 0.5, label: "Alice" }],
          },
        ]}
        metric={{ label: "m" }}
      />,
    );
    const circles = document.querySelectorAll("circle");
    expect(circles.length).toBeGreaterThan(0);
    fireEvent.mouseEnter(circles[0]!, { clientX: 50, clientY: 50 });
    // Tooltip node exists
    expect(document.querySelector('[data-testid="cursor-tooltip"]')).not.toBeNull();
  });

  it("renders reference lines with labels", () => {
    render(
      <Beeswarm
        groups={[
          {
            id: "g",
            label: "G",
            values: [
              { id: "a", value: 0.2 },
              { id: "b", value: 0.8 },
            ],
          },
        ]}
        metric={{ label: "m" }}
        referenceLines={[{ value: 0.5, label: "median" }]}
      />,
    );
    expect(screen.getByText("median")).toBeInTheDocument();
  });

  it("renders a legend for quantile colouring", () => {
    render(
      <Beeswarm
        groups={[
          {
            id: "g",
            label: "G",
            values: [
              { id: "a", value: 0.1 },
              { id: "b", value: 0.9 },
            ],
          },
        ]}
        metric={{ label: "m" }}
        populationColor={{
          mode: "byQuantile",
          bands: [{ threshold: 0.5, color: "#ff0000", label: "lo" }],
          aboveColor: "#00ff00",
          aboveLabel: "hi",
        }}
      />,
    );
    expect(screen.getByText("lo")).toBeInTheDocument();
    expect(screen.getByText("hi")).toBeInTheDocument();
  });
});
