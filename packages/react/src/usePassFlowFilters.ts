import { useCallback, useMemo, useRef, useState } from "react";

import type { ComputePassFlowInput } from "./compute/pass-flow.js";

/**
 * Filter state tracked by `usePassFlowFilters`. Every field is optional —
 * an `undefined` means "no filter on this dimension".
 *
 * Shape derived from `ComputePassFlowInput` so the hook and the compute
 * layer cannot drift on field names or value shapes.
 */
export type PassFlowFilters = Pick<
  ComputePassFlowInput,
  "directionFilter" | "periodFilter" | "completionFilter" | "minMinute" | "maxMinute"
>;

export type UsePassFlowFiltersResult = {
  /** Current filter state. Reference-stable per render. */
  state: PassFlowFilters;
  /** Replace one filter dimension at a time. Pass `undefined` to clear. */
  setFilter: <K extends keyof PassFlowFilters>(
    key: K,
    value: PassFlowFilters[K] | undefined,
  ) => void;
  /** Replace the entire filter state (merged over the previous). */
  setState: (next: Partial<PassFlowFilters>) => void;
  /** Reset to the original defaults passed to the hook on mount. */
  reset: () => void;
  /**
   * A spreadable object for `<PassFlow {...passFlowProps} />` that carries
   * the current filter state. Type-compatible with `PassFlowProps`.
   * Filters that are `undefined` are omitted from the spread so they don't
   * override caller-supplied defaults.
   */
  passFlowProps: PassFlowFilters;
};

/**
 * Hook that owns the per-filter state for a live-toggleable PassFlow
 * without shipping a toolbar component. Consumers build their own UI
 * (buttons, segmented controls, dropdowns) and call `setFilter` to
 * update — the spreadable `passFlowProps` flows the current state into
 * `<PassFlow>` without boilerplate.
 *
 * Pair with `filterTransition="morph"` on the chart for smooth
 * arrow-morphing between filter states.
 *
 * Defaults are captured on mount via a ref, so `reset()` remains
 * reference-stable and honours the first-render defaults even when the
 * caller inlines the defaults object literal (which is the common case).
 *
 * @example
 * ```tsx
 * const { passFlowProps, state, setFilter } = usePassFlowFilters({
 *   directionFilter: "all",
 * });
 * return (
 *   <>
 *     <button onClick={() => setFilter("directionFilter", "forward")}>
 *       Forward only
 *     </button>
 *     <PassFlow passes={passes} filterTransition="morph" {...passFlowProps} />
 *   </>
 * );
 * ```
 */
export function usePassFlowFilters(
  defaults: PassFlowFilters = {},
): UsePassFlowFiltersResult {
  const [state, setStateInternal] = useState<PassFlowFilters>(defaults);

  // Freeze defaults on first render so reset identity stays stable even if
  // the caller passes a new object literal each render. `useState` already
  // honours `defaults` only on mount, so this matches that semantic.
  const defaultsRef = useRef(defaults);

  const setFilter = useCallback(
    <K extends keyof PassFlowFilters>(key: K, value: PassFlowFilters[K] | undefined) => {
      setStateInternal((prev) => {
        // Omit the key entirely when value is undefined so the spread
        // doesn't clobber downstream defaults.
        if (value === undefined) {
          const entries = Object.entries(prev).filter(([k]) => k !== key) as [
            keyof PassFlowFilters,
            PassFlowFilters[keyof PassFlowFilters],
          ][];
          return Object.fromEntries(entries) as PassFlowFilters;
        }
        return { ...prev, [key]: value };
      });
    },
    [],
  );

  const setState = useCallback((next: Partial<PassFlowFilters>) => {
    setStateInternal((prev) => ({ ...prev, ...next }));
  }, []);

  const reset = useCallback(() => {
    setStateInternal(defaultsRef.current);
  }, []);

  // Spread-safe props: drop undefined entries so callers' explicit defaults
  // survive. Memoised on `state` so downstream `useMemo`s don't churn.
  const passFlowProps = useMemo<PassFlowFilters>(() => {
    const out: PassFlowFilters = {};
    if (state.directionFilter != null) out.directionFilter = state.directionFilter;
    if (state.periodFilter != null) out.periodFilter = state.periodFilter;
    if (state.completionFilter != null) out.completionFilter = state.completionFilter;
    if (state.minMinute != null) out.minMinute = state.minMinute;
    if (state.maxMinute != null) out.maxMinute = state.maxMinute;
    return out;
  }, [state]);

  return { state, setFilter, setState, reset, passFlowProps };
}
