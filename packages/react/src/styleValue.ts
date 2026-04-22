/**
 * A keyed lookup map form of `StyleValue`. Resolves a string key from each datum
 * via `by`, then returns the matching entry from `values`, falling back to
 * `fallback` when the key is absent or null.
 */
export type StyleValueMap<TValue, TContext> = {
  by: (context: TContext) => string | number | null | undefined;
  values: Readonly<Record<string, TValue>>;
  fallback?: TValue;
};

/**
 * A style value that can be a constant, a keyed lookup map, or a per-datum callback.
 *
 * - **Constant** (`TValue`): the same value applied to every datum.
 * - **Map** (`StyleValueMap`): resolves a string key from each datum, then looks up
 *   the matching value in a record.
 * - **Callback** (`(context: TContext) => TValue | undefined`): called once per datum
 *   at render time. Receives the datum as `context`.
 *
 * ## SSR and export compatibility
 *
 * All three forms work for direct React rendering — interactive and server-side.
 *
 * **Callbacks and map `by` functions must be pure.** They must not read browser
 * globals (`window`, `document`, DOM measurements) or live component state.
 * Impure functions will throw or produce incorrect results when the component is
 * rendered in a Node.js export environment.
 *
 * **Callbacks and map resolvers cannot be used in `ExportFrameSpec`.** The
 * stable export spec is serialized, so only constant values are guaranteed
 * export-safe. Use constants when the output must pass through
 * `createExportFrameSpec`.
 */
export type StyleValue<TValue, TContext> =
  | TValue
  | StyleValueMap<TValue, TContext>
  | ((context: TContext) => TValue | undefined);

function isStyleValueMap<TValue, TContext>(
  value: StyleValue<TValue, TContext>,
): value is StyleValueMap<TValue, TContext> {
  return (
    typeof value === "object" &&
    value !== null &&
    "by" in value &&
    typeof value.by === "function" &&
    "values" in value &&
    typeof value.values === "object" &&
    value.values !== null
  );
}

export function resolveStyleValue<TValue, TContext>(
  value: StyleValue<TValue, TContext> | undefined,
  context: TContext,
): TValue | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === "function") {
    return (value as (context: TContext) => TValue | undefined)(context);
  }
  if (isStyleValueMap(value)) {
    const key = value.by(context);
    if (key == null) {
      return value.fallback;
    }
    return value.values[String(key)] ?? value.fallback;
  }
  return value as TValue;
}
