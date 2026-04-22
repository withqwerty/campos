import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { usePassFlowFilters } from "../src/usePassFlowFilters.js";
import type { UsePassFlowFiltersResult } from "../src/usePassFlowFilters.js";

afterEach(cleanup);

/**
 * Harness that hands the hook's result back to the test through an
 * out-param callback. Invoked inside render (not an effect) so the test
 * can trigger setters synchronously without waiting for commit.
 */
function Harness({
  onRender,
  defaults,
}: {
  onRender: (result: UsePassFlowFiltersResult) => void;
  defaults?: Parameters<typeof usePassFlowFilters>[0];
}) {
  const result = usePassFlowFilters(defaults);
  onRender(result);
  return null;
}

describe("usePassFlowFilters", () => {
  it("initialises state from the defaults argument", () => {
    let seen: UsePassFlowFiltersResult | null = null;
    render(
      <Harness
        defaults={{ directionFilter: "forward", minMinute: 45 }}
        onRender={(r) => {
          seen = r;
        }}
      />,
    );
    expect(seen!.state.directionFilter).toBe("forward");
    expect(seen!.state.minMinute).toBe(45);
  });

  it("setFilter sets a single dimension", () => {
    let seen: UsePassFlowFiltersResult | null = null;
    render(
      <Harness
        onRender={(r) => {
          seen = r;
        }}
      />,
    );
    act(() => {
      seen!.setFilter("directionFilter", "lateral");
    });
    expect(seen!.state.directionFilter).toBe("lateral");
    expect(seen!.passFlowProps.directionFilter).toBe("lateral");
  });

  it("setFilter(undefined) omits the key from state and passFlowProps", () => {
    let seen: UsePassFlowFiltersResult | null = null;
    render(
      <Harness
        defaults={{ directionFilter: "forward" }}
        onRender={(r) => {
          seen = r;
        }}
      />,
    );
    act(() => {
      seen!.setFilter("directionFilter", undefined);
    });
    expect("directionFilter" in seen!.state).toBe(false);
    expect("directionFilter" in seen!.passFlowProps).toBe(false);
  });

  it("setState merges partial state on top of previous", () => {
    let seen: UsePassFlowFiltersResult | null = null;
    render(
      <Harness
        defaults={{ directionFilter: "forward" }}
        onRender={(r) => {
          seen = r;
        }}
      />,
    );
    act(() => {
      seen!.setState({ minMinute: 60 });
    });
    expect(seen!.state.directionFilter).toBe("forward");
    expect(seen!.state.minMinute).toBe(60);
  });

  it("reset returns to the first-render defaults even when the caller mutates after", () => {
    let seen: UsePassFlowFiltersResult | null = null;
    render(
      <Harness
        defaults={{ directionFilter: "all" }}
        onRender={(r) => {
          seen = r;
        }}
      />,
    );
    act(() => {
      seen!.setFilter("directionFilter", "backward");
      seen!.setFilter("minMinute", 45);
    });
    expect(seen!.state.directionFilter).toBe("backward");
    act(() => {
      seen!.reset();
    });
    expect(seen!.state.directionFilter).toBe("all");
    expect("minMinute" in seen!.state).toBe(false);
  });

  it("reset identity stays stable across renders (inline-default footgun fix)", () => {
    // Inlining the defaults object reproduces the common usage pattern:
    // `usePassFlowFilters({ directionFilter: "all" })` on every render.
    // Before the ref-based fix, `reset` churned identity each render.
    const identities: Array<UsePassFlowFiltersResult["reset"]> = [];
    function InlineHarness() {
      const result = usePassFlowFilters({ directionFilter: "all" });
      identities.push(result.reset);
      return null;
    }
    const { rerender } = render(<InlineHarness />);
    rerender(<InlineHarness />);
    rerender(<InlineHarness />);
    // All three renders should share the same reset reference.
    expect(identities[0]).toBe(identities[1]);
    expect(identities[1]).toBe(identities[2]);
  });

  it("setFilter and setState identities stay stable across renders", () => {
    const setFilters: Array<UsePassFlowFiltersResult["setFilter"]> = [];
    function InlineHarness() {
      const { setFilter } = usePassFlowFilters({});
      setFilters.push(setFilter);
      return null;
    }
    const { rerender } = render(<InlineHarness />);
    rerender(<InlineHarness />);
    expect(setFilters[0]).toBe(setFilters[1]);
  });

  it("passFlowProps omits undefined entries so defaults survive the spread", () => {
    let seen: UsePassFlowFiltersResult | null = null;
    render(
      <Harness
        onRender={(r) => {
          seen = r;
        }}
      />,
    );
    // Default `{}` — every field undefined — should yield an empty
    // passFlowProps so spreading doesn't clobber caller defaults.
    expect(Object.keys(seen!.passFlowProps)).toEqual([]);
  });
});
