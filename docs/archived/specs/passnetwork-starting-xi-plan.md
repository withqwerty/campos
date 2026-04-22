# Starting XI pass network — small plan

**Status:** archived
**Superseded by:** `docs/specs/passnetwork-spec.md`
**Last updated:** 2026-04-10
**Scope:** one new core helper + one new adapter method. ~50 lines of code across 3 files + tests.

## Context

The user floated this during review:

> pass maps are typically limited to 'until the first sub for that team was made at half time or in the 2nd half' when not showing all player so it's just the 'starting xi' (ignoring any early subs). we should default to this while showing the full team pass map as an exception. it might be something to add as a utility or adapter function e.g. `fromOpta.passes(x).startingXI()` — not sure what the syntax is or should be

The default-time-window part has already shipped (`aggregatePassNetwork` now defaults to team-scoped `"untilFirstSub"`). What's left is **the ergonomics** — the common case of "Opta events → starting XI pass network" still takes four steps and the consumer has to extract substitutions themselves.

**Desired consumer flow (current):**

```ts
const events = fromOpta.events(raw, matchContext);
const passes = events.filter((e): e is PassEvent => e.kind === "pass");
const subs = events.filter((e): e is SubstitutionEvent => e.kind === "substitution");
const inferred = inferRecipientsFromNextPass(passes);
const { nodes, edges } = aggregatePassNetwork(inferred, {
  teamId: "abc123",
  timeWindow: "untilFirstSub",
  substitutions: subs.map((s) => ({ minute: s.minute, teamId: s.teamId })),
});
```

Five lines + a filter cast. Ugly.

**Desired consumer flow (after this plan):**

```ts
const events = fromOpta.events(raw, matchContext);
const { nodes, edges } = passNetworkFromEvents(events, { teamId: "abc123" });
```

Two lines. The filtering, recipient inference, substitution extraction, and team-scoped window resolution all happen inside the helper.

## Design

### Not recommended: a chainable class-based builder

The user's proposed syntax `fromOpta.passes(x).startingXI()` would require wrapping the `PassEvent[]` result in a class or builder object with methods. That's a bigger API change and a departure from the current flat-function style used everywhere else in the adapters (`fromOpta.shots()`, `fromOpta.events()` both return plain arrays). Adopting a builder pattern for one use case would create inconsistency.

### Recommended: a flat helper in `@withqwerty/campos-core` + a small adapter shortcut

Two additive pieces, each one function:

1. **`passNetworkFromEvents(events, options)`** in `@withqwerty/campos-core`. Takes a mixed `Event[]` stream, extracts passes + substitutions internally, runs recipient inference if needed, and returns `{ nodes, edges, warnings, window }`. Every option on `AggregatePassNetworkOptions` is forwarded so consumers can still tune thresholds, color mode, xT resolvers, etc.

2. **`fromOpta.passes(rawEvents, matchContext)`** in `@withqwerty/campos-adapters/opta`. Convenience projection that mirrors the existing `fromOpta.shots()` — returns only the `PassEvent[]` subset of the normalized event stream. Cheap and symmetric. **Note:** `passNetworkFromEvents` does NOT require this to exist, it works on any `Event[]`; `fromOpta.passes` is just a nice-to-have for consumers who want to work with passes directly.

The core helper is the important piece. `fromOpta.passes` is bonus ergonomics.

## Files to change

- `packages/core/src/pass-network-from-events.ts` — **NEW**. Houses `passNetworkFromEvents`. Separate file because it lives above `aggregate-pass-network.ts` in the dependency graph (consumes the aggregate helper + the inference transform) and it's a different abstraction level — closer to "convenience wrapper" than "primitive".
- `packages/core/test/pass-network-from-events.test.ts` — **NEW**. 5-6 tests covering: happy path, no subs (falls back to fullMatch), explicit teamId not in events, recipient inference on/off, pass-through of threshold/xT options.
- `packages/core/src/index.ts` — add the new export.
- `packages/adapters/src/opta/index.ts` — add `fromOpta.passes()` mirror of `fromOpta.shots()`. ~10 lines.
- `packages/adapters/test/opta/passes.test.ts` — **NEW**. 2-3 tests asserting the projection returns only `PassEvent`s and preserves the `teamId` / `minute` / etc. fields.
- `docs/specs/passnetwork-spec.md` — append a "Starting XI shortcut" subsection documenting the new flow.

## Implementation sketch

```ts
// packages/core/src/pass-network-from-events.ts
import type { Event, PassEvent, SubstitutionEvent } from "@withqwerty/campos-schema";

import {
  aggregatePassNetwork,
  type AggregatePassNetworkOptions,
  type AggregatePassNetworkResult,
} from "./aggregate-pass-network.js";
import { inferRecipientsFromNextPass } from "./pass-network-transforms.js";

export type PassNetworkFromEventsOptions = Omit<
  AggregatePassNetworkOptions,
  "substitutions"
> & {
  /**
   * Whether to fill in missing `recipient` values using
   * `inferRecipientsFromNextPass`. Default: true.
   */
  inferRecipients?: boolean;
};

/**
 * One-shot convenience: take a full Event[] stream (from any adapter) and
 * produce a starting XI pass network. Extracts passes + substitutions
 * internally, runs recipient inference when enabled, and delegates to
 * `aggregatePassNetwork` with the team-scoped `"untilFirstSub"` window.
 */
export function passNetworkFromEvents(
  events: readonly Event[],
  options: PassNetworkFromEventsOptions,
): AggregatePassNetworkResult {
  const { inferRecipients = true, ...rest } = options;

  const passes: PassEvent[] = [];
  const substitutions: { minute: number; teamId: string }[] = [];
  for (const e of events) {
    if (e.kind === "pass") passes.push(e);
    else if (e.kind === "substitution") {
      substitutions.push({ minute: e.minute, teamId: e.teamId });
    }
  }

  const prepared = inferRecipients ? inferRecipientsFromNextPass(passes) : passes;

  return aggregatePassNetwork(prepared, {
    ...rest,
    substitutions,
  });
}
```

And the adapter shortcut:

```ts
// packages/adapters/src/opta/index.ts — add to the fromOpta object
passes(events: readonly OptaEvent[], matchContext: MatchContext): PassEvent[] {
  const all = fromOpta.events(events, matchContext);
  return all.filter((e): e is PassEvent => e.kind === "pass");
},
```

## What's intentionally NOT in scope

- A fluent builder. If consumers start chaining lots of transforms (`.startingXI().between(45, 60).withMinPasses(8)`), we can revisit. For v0.3 the flat helper is enough.
- A "starting XI" filter that bans substitute players entirely. The current `"untilFirstSub"` window already handles this — any substitute who came on after the first sub simply won't appear because their passes fall outside the window. No additional filtering needed.
- Provider parity. `fromOpta.passes` is added because Opta is the primary adapter and the user explicitly referenced it. StatsBomb / Wyscout / WhoScored already emit passes via `fromStatsBomb.events(...)` etc., and `passNetworkFromEvents` works with any of them. Adding `.passes()` to the other adapters is a separate mechanical packet (5 mins each) if the user wants it.
- An "early injury sub" filter. The user mentioned "half time or in the 2nd half" — the current default uses the literal first sub, injury or not. Distinguishing tactical vs. injury subs requires richer event metadata that isn't in the `SubstitutionEvent` schema today. The consumer can pre-filter the substitutions array themselves if they care.

## Verification

1. **Unit tests** for `passNetworkFromEvents`:
   - Empty `events` → empty `{nodes, edges}`, no warnings
   - Happy path with passes + substitutions → expected nodes/edges, window matches the first team-scoped sub
   - No substitutions in the event stream → silent fallback to fullMatch (no warning, since default window was implicit)
   - `inferRecipients: false` drops passes that had null recipients
   - Options passthrough: `minPassesForNode` forwards correctly
2. **Adapter test** for `fromOpta.passes`:
   - Mixed raw Opta event list → only `kind === "pass"` returned
   - Team ids preserved
   - No shots / tackles / cards in the output
3. **Backwards compatibility:** existing `aggregatePassNetwork` tests keep passing unchanged.
4. **Full gate:** `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm --filter @withqwerty/campos-site build`.

## Estimated scope

- Core helper: ~40 lines + 6 tests
- Adapter shortcut: ~10 lines + 2 tests
- Exports + docs: ~15 lines
- **Total: ~70 lines of code, one commit.**

## Decision points for the user

1. **`passNetworkFromEvents` or `startingXIPassNetwork` as the helper name?** The former is more precise (events → network); the latter reads more naturally but is longer. Either works.
2. **Add `fromOpta.passes` this packet or defer?** The core helper works without it. If deferred, the doc example would show `events.filter((e): e is PassEvent => e.kind === "pass")` explicitly.
3. **Infer recipients by default?** Current plan says yes (matches what the demo page now does). Consumers can opt out with `inferRecipients: false`. The alternative is `false` default + consumers opt in, but most real-world data benefits from it.
