import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CellLabel } from "../src/SmallMultiples";

afterEach(cleanup);

describe("<CellLabel />", () => {
  it("renders all three slots when provided", () => {
    const { getByText } = render(
      <CellLabel title="Spurs" eyebrow="32 shots" caption="1.8 xG" />,
    );

    expect(getByText("Spurs")).toBeInTheDocument();
    expect(getByText("32 shots")).toBeInTheDocument();
    expect(getByText("1.8 xG")).toBeInTheDocument();
  });

  it("omits eyebrow and caption when not provided", () => {
    const { container, getByText } = render(<CellLabel title="Spurs" />);

    expect(getByText("Spurs")).toBeInTheDocument();
    expect(container.querySelector("[data-slot='eyebrow']")).toBeNull();
    expect(container.querySelector("[data-slot='caption']")).toBeNull();
  });

  it("accepts JSX in every slot", () => {
    const { getByText } = render(
      <CellLabel
        title={<strong>Spurs</strong>}
        eyebrow={<em>32 shots</em>}
        caption={<span>1.8 xG</span>}
      />,
    );

    expect(getByText("Spurs").tagName).toBe("STRONG");
    expect(getByText("32 shots").tagName).toBe("EM");
    expect(getByText("1.8 xG").tagName).toBe("SPAN");
  });

  it("derives an aria-label from string title content", () => {
    const { getByLabelText } = render(<CellLabel title="Arsenal" />);
    expect(getByLabelText("Arsenal")).toBeInTheDocument();
  });

  it("prefers an explicit ariaLabel override", () => {
    const { getByLabelText } = render(
      <CellLabel title="Arsenal" ariaLabel="Team label" />,
    );
    expect(getByLabelText("Team label")).toBeInTheDocument();
  });
});
