# Roadmap v0.2

**Status:** archived
**Supersedes:** the old untracked implementation plan as the coordination source of truth
**Superseded by:** `docs/roadmap-v0.3.md`
**Scope:** historical roadmap for the v0.2 component wave; retained for context only

## Goal

Ship the next Campos slice without letting planning, edge-case handling, or review quality drift into private notes.

v0.2 should:

- keep the public API chart-first;
- extract the internal primitives needed to support multiple charts cleanly;
- make adapter gaps explicit before chart work depends on them;
- require baseline demo pages, tests, and adversarial review loops for every shipped item.

## Public scope

The v0.2 public component targets were:

1. `PassMap` — **done**
2. `ScatterPlot` — **done**
3. `Heatmap` — **done**

`ShotMap` remains the proving baseline. Additionally, the following v0.3 targets were delivered early:

4. `KDE` — **done**
5. `PizzaChart` — **done**
6. `RadarChart` — **done**
7. `XGTimeline` — **done**

All 8 chart components now have core implementations, React renderers, demo pages, and test suites (522 tests across 37 files, 14 demo pages).

## Internal primitive scope

The internal work should extract reusable foundations without turning them into the primary public API.

v0.2 internal targets:

- on-pitch frame and viewport model
- shared point mark model and renderer
- shared line mark model and renderer
- shared heatmap cell model and renderer
- shared legend and continuous scale-bar model
- shared tooltip model and renderer
- shared Cartesian axes model and renderer

Originally deferred to v0.3 but delivered:

- polar axes — used by `PizzaChart` and `RadarChart`
- radar polygon / radial bar internals — used by `RadarChart` and `PizzaChart`
- KDE density surface — used by `KDE`

Still deferred:

- small multiples
- joint grids
- hexbin / Voronoi / sonar

## Parallel work lanes

Parallel work is allowed only when each lane has a spec packet and clear ownership.

### Lane A: adapters and data contracts

- maintain `standards/adapter-gap-matrix.md`
- tighten provider normalization contracts for data needed by `PassMap`, `ScatterPlot`, and `Heatmap`
- identify where adapters expose lossy or missing fields

### Lane B: core primitives

- extract reusable models from `ShotMap`
- add compute functions for line, heatmap, and Cartesian-axis-backed charts
- keep output semantic and renderer-neutral

### Lane C: React renderer foundations

- move repeated rendering concerns into shared internals
- reuse `@withqwerty/campos-stadia` instead of duplicating pitch geometry
- keep public exports chart-shaped

### Lane D: demo and docs surface

- add baseline demo page for each component before calling it implemented
- document examples, empty states, and known gaps
- keep `status/matrix.md` current

### Lane E: review and standards

- run loop 1 spec review before implementation
- run loop 2 implementation review after demo + tests exist
- run loop 3 release-readiness review before the component is considered done

## Delivery gates

No component or adapter work is done until all of the following are true:

- spec exists and follows `templates/component-spec.md`
- relevant rows are updated in `status/matrix.md`
- relevant adapter rows exist in `standards/adapter-gap-matrix.md`
- baseline demo page exists in `apps/site`
- core and renderer tests exist
- adversarial edge-case matrix exists
- review loops 1-3 are recorded

## Reference-code rule

Campos should not reinvent known football-viz patterns blindly, but it should also not inherit reference-library limitations without challenge.

For each component or primitive:

1. Start with `/Volumes/WQ/ref_code/INDEX.md`.
2. Only inspect repositories that actually cover the primitive, layer, or chart being worked on.
3. Use those references for:
   - scope validation
   - edge-case discovery
   - example expectations
4. Record why Campos diverges when:
   - the reference implementation is renderer-specific
   - the implementation is not accessible or responsive enough
   - the adapter assumptions are too loose
   - the API shape is not suitable for a headless-core library

Examples:

- `PassMap`, `Heatmap`, `RadarChart`, `PizzaChart`, `BumpyChart`: check `mplsoccer`
- interactive pitch overlays or linked views: check `d3-soccer`
- coordinate normalization or provider widening: check `kloppy`
- xT / action-value semantics: check `socceraction`

If a repo does not cover the thing being built, do not cite it for false authority.

## Documentation lifecycle

When a new tracked doc replaces an older planning note:

- keep the older doc if it has historical value;
- mark it as `superseded`, `archived`, or `internal`;
- point to the new active doc explicitly;
- do not leave multiple active roadmap documents in circulation.

See `standards/document-status-policy.md`.

## Immediate queue

### 1. ShotMap foundation cleanup

- replace inlined pitch drawing in React with `@withqwerty/campos-stadia` usage
- extract shared legend / tooltip / mark rendering seams
- confirm no `ShotMap` behavior regresses

### 2. PassMap packet

- write the component spec
- identify required pass fields and provider gaps
- ship demo page and tests

### 3. ScatterPlot packet

- write the component spec
- extract Cartesian axes and generic point plotting
- ship demo page and tests

### 4. Heatmap packet

- start with uniform grid only
- identify adapter and core requirements for future positional heatmap widening
- ship demo page and tests

## Non-goals for v0.2

- public low-level scene API
- Python renderer
- full composition framework
- full provider parity across all event kinds
- advanced density layers and tactical layout containers
