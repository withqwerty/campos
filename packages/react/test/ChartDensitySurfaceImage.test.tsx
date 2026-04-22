import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChartDensitySurfaceImage } from "../src/primitives/index.js";

afterEach(cleanup);

const identityProject = (x: number, y: number) => ({ x, y });

describe("ChartDensitySurfaceImage", () => {
  it("renders a pitch-sized image with projected bounds", () => {
    const { container } = render(
      <svg>
        <ChartDensitySurfaceImage
          href="data:image/png;base64,AAAA"
          project={identityProject}
          testId="surface"
        />
      </svg>,
    );

    const image = screen.getByTestId("surface");
    expect(image.getAttribute("href")).toBe("data:image/png;base64,AAAA");
    expect(image.getAttribute("x")).toBe("0");
    expect(image.getAttribute("y")).toBe("0");
    expect(image.getAttribute("width")).toBe("100");
    expect(image.getAttribute("height")).toBe("100");
    expect(container.innerHTML).toContain('preserveAspectRatio="none"');
  });

  it("returns null when no data URL is available", () => {
    const { container } = render(
      <svg>
        <ChartDensitySurfaceImage href={null} project={identityProject} />
      </svg>,
    );

    expect(container.querySelector("image")).toBeNull();
  });
});
