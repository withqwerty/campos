# Component Target Notes

**Status:** active
**Purpose:** capture shared-seam patterns learned from fresh W1a review loops that passed cleanly enough to reuse as targets for later component reviews

Only cite fresh reruns that ended with `"ship": "YES"` without needing a follow-up fix packet in the same slice.

## Current clean targets

### StatBadge (`docs/reviews/statbadge-2026-04-15.md`)

- Pure HTML comparison primitives should stay obviously outside the chart-renderer/export pipeline.
- The review target is contract honesty and layout robustness, not forced SVG-style parity.
- A clean pass for this class of component means:
  - semantic style-token surface is documented consistently in page/spec/tests
  - empty, placeholder, long-label, and orientation states are covered directly in tests
  - desktop/mobile page verification shows no console or hydration noise

### XGTimeline (`docs/reviews/xgtimeline-2026-04-15.md`)

- Wide cartesian charts should explain their export-safe and live-only seams directly in the page/API section rather than relying on implied parity.
- A clean pass for this class of component means:
  - methodology-note support is shown on the page, not just in tests
  - responsive pressure is demonstrated with compact and wide containers
  - static/export stories stay bounded to the dedicated export-only prop contract

### RadarChart / PizzaChart (`docs/reviews/radarchart-2026-04-15.md`, `docs/reviews/pizzachart-2026-04-15.md`)

- Single-profile radial charts need an explicit statement of what comparison/reference behavior is in scope versus intentionally unsupported.
- A clean pass for this class of component means:
  - page/spec language matches the current single-profile contract
  - bounded export-safe center-content / methodology-note rules are called out plainly
  - desktop/mobile verification confirms the label-first failure mode is handled honestly rather than hidden

## Documented divergences

### PassSonar — no `attackingDirection` prop (v1)

- All pitch-bound charts accept `attackingDirection` to control on-screen
  orientation; `PassSonar` deliberately does **not** in v1.
- Reason: `PassSonar` is a non-pitch radial summary. Sonar conventions across
  every published reference (mplsoccer, StatsBomb, Athletic, Twelve) draw
  `forward` at the top of the wheel regardless of how the underlying match was
  filmed. Adding `attackingDirection` rotates the wedges away from that
  convention without adding meaning.
- Reviewers should not flag this as drift; the divergence is documented in
  `docs/specs/passsonar-spec.md` ("`attackingDirection` posture (v1)") and is
  reopenable additively if a real composition demand surfaces.
