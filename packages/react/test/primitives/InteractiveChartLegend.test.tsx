import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";

afterEach(cleanup);

import {
  InteractiveChartLegend,
  nextInteractiveLegendValue,
  type InteractiveLegendItem,
} from "../../src/primitives/InteractiveChartLegend";
import { LIGHT_THEME } from "../../src/theme";

const twoItems: InteractiveLegendItem[] = [
  { key: "save", label: "Save", color: "#8d86b3", count: 94 },
  { key: "goal", label: "Goal", color: "#e2525d", count: 32 },
];

const threeItems: InteractiveLegendItem[] = [
  { key: "a", label: "A", color: "#1a1a1a" },
  { key: "b", label: "B", color: "#2b2b2b" },
  { key: "c", label: "C", color: "#3c3c3c" },
];

describe("nextInteractiveLegendValue", () => {
  const keys = ["save", "goal"];

  describe("focus mode", () => {
    it("focuses on the clicked item when all items are active", () => {
      const next = nextInteractiveLegendValue(
        { save: true, goal: true },
        keys,
        "save",
        "focus",
      );
      expect(next).toEqual({ save: true, goal: false });
    });

    it("clears the filter when re-clicking the currently-focused item", () => {
      const next = nextInteractiveLegendValue(
        { save: true, goal: false },
        keys,
        "save",
        "focus",
      );
      expect(next).toEqual({ save: true, goal: true });
    });

    it("switches focus when clicking a different item while focused", () => {
      const next = nextInteractiveLegendValue(
        { save: true, goal: false },
        keys,
        "goal",
        "focus",
      );
      expect(next).toEqual({ save: false, goal: true });
    });

    it("treats missing keys in `value` as active", () => {
      const next = nextInteractiveLegendValue({}, keys, "save", "focus");
      expect(next).toEqual({ save: true, goal: false });
    });
  });

  describe("multi-select mode", () => {
    const mkeys = ["a", "b", "c"];

    it("independently toggles the clicked item", () => {
      const next = nextInteractiveLegendValue(
        { a: true, b: true, c: true },
        mkeys,
        "b",
        "multi-select",
      );
      expect(next).toEqual({ a: true, b: false, c: true });
    });

    it("does not affect other items when toggling", () => {
      const next = nextInteractiveLegendValue(
        { a: false, b: true, c: false },
        mkeys,
        "a",
        "multi-select",
      );
      expect(next).toEqual({ a: true, b: true, c: false });
    });
  });
});

describe("<InteractiveChartLegend>", () => {
  function Harness({
    items,
    mode,
    initial,
  }: {
    items: InteractiveLegendItem[];
    mode?: "focus" | "multi-select";
    initial?: Record<string, boolean>;
  }) {
    const [value, setValue] = useState<Record<string, boolean>>(
      initial ?? Object.fromEntries(items.map((i) => [i.key, true])),
    );
    return (
      <InteractiveChartLegend
        items={items}
        value={value}
        onChange={setValue}
        {...(mode != null ? { mode } : {})}
        theme={LIGHT_THEME}
        testId="legend"
      />
    );
  }

  it("renders a labelled button per item with its count", () => {
    render(<Harness items={twoItems} />);
    const save = screen.getByRole("button", { name: /Save \(94\)/ });
    const goal = screen.getByRole("button", { name: /Goal \(32\)/ });
    expect(save).toHaveAttribute("aria-pressed", "true");
    expect(goal).toHaveAttribute("aria-pressed", "true");
  });

  it("defaults 2-item legends to focus mode", () => {
    render(<Harness items={twoItems} />);
    fireEvent.click(screen.getByRole("button", { name: /Save/ }));
    expect(screen.getByRole("button", { name: /Save/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Goal/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // Re-click Save → all on again
    fireEvent.click(screen.getByRole("button", { name: /Save/ }));
    expect(screen.getByRole("button", { name: /Save/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Goal/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("defaults 3+-item legends to multi-select mode", () => {
    render(<Harness items={threeItems} />);
    fireEvent.click(screen.getByRole("button", { name: /A/ }));
    expect(screen.getByRole("button", { name: /A/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /B/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /C/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("honours an explicit mode override", () => {
    render(<Harness items={threeItems} mode="focus" />);
    fireEvent.click(screen.getByRole("button", { name: /B/ }));
    expect(screen.getByRole("button", { name: /A/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /B/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /C/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
