# Component State Review Standard

**Status:** active
**Scope:** post-implementation alignment audits for public components and primitive families
**Purpose:** repeatable process for checking that component JSDoc, package docs, repo docs, and demo pages describe the same shipped behavior

Use this standard when reviewing an existing component or major primitive. It complements `component-ship-checklist.md`: the ship checklist says what must exist, while this document says how to audit alignment after the component has evolved.

## Review Unit

Review one public component or primitive family at a time.

For chart components, the unit is the public import such as `ShotMap`, `PassNetwork`, or `RadarChart`.

For primitive packages, the unit may be a package-level family when the components are inseparable. `@withqwerty/campos-stadia` is reviewed as one family because `Pitch`, `Goal`, projection helpers, theme colors, grass patterns, and tactical markings together define the pitch-surface contract.

## Required Inputs

Start from the active docs workflow:

1. `docs/README.md`
2. `docs/roadmap-v0.3.md`
3. `docs/status/matrix.md`
4. `docs/status/component-audit-matrix.md`
5. the component spec in `docs/specs/`, if one exists
6. package README and exported TypeScript entrypoints
7. demo page and preview wrapper components
8. relevant tests
9. `docs/standards/demo-page-standard.md`
10. latest relevant benchmark/review note when the component is in an active
    convergence or parity pass

For primitive-family audits, a dedicated component spec may not exist. In that case, treat the package README plus public exports as the current contract, and record any missing spec-level policy in the docs you touch.

## Audit Axes

### 1. Public Surface

Check the exported package entrypoint, not just implementation files.

Record:

- public components and helpers
- public prop types
- intentionally internal helpers that should not appear in docs
- deprecated or stale examples

Docs must not import unexported internals. If a low-level helper appears useful but is not exported, either intentionally export it with tests and docs or remove it from examples.

Also check whether the public prop surface grew where a preset/helper would
have been the more honest library seam.

### 1A. Anatomy And Stable Hooks

Check that the component’s documented anatomy and its real DOM/SVG structure
still match.

Record:

- stable regions such as `root`, `frame`, `plot`, `legend`, `scale-bar`,
  `empty-state`, `tooltip`, and `overlay`
- `data-slot`, `data-chart-kind`, `data-empty`, `data-static`, and
  `data-campos` hooks that are intentionally stable
- accidental wrappers or hook drift that leaked into examples/tests

The review goal is predictable anatomy, not maximal hook exposure.

### 1B. Public State Contract

Check whether the component exposes public interactive state at all.

Record:

- which state concepts stay internal, such as hover ids, tooltip bookkeeping,
  and focus plumbing
- any public state concepts and whether they use the shared named
  controlled/uncontrolled contract, e.g. `selectedSeries`,
  `defaultSelectedSeries`, `onSelectedSeriesChange`
- whether change handlers receive both the next value and a narrow details
  object with a `reason`
- whether docs or demos imply external control that the public API does not
  really support

The review goal is to avoid accidental chart-local interaction contracts, not
to force every chart to become controllable.

### 2. JSDoc

Every public prop or exported helper should explain:

- what the value controls
- default behavior
- coordinate or unit convention
- interaction and accessibility impact
- export/static-rendering impact when relevant
- how it composes with cross-cutting concerns such as theme, crop, orientation, labels, or legends

JSDoc should be concise enough to survive in generated declarations. Long design rationale belongs in docs, not prop comments.

### 3. Package And Repo Docs

Package READMEs should answer:

- when to use the component directly
- what the zero-config/default behavior is
- what data contract it expects
- what cross-cutting concerns it supports
- what it does not own
- when to use it instead of a neighboring Campos chart
- one best-practice TypeScript example containing only the component code

When presets or recipes are part of the intended workflow, docs should make
them discoverable instead of forcing users to reverse-engineer story code.

For published packages, the README must match the package exports exactly.

### 4. Demo Page

Evaluate the page against `demo-page-standard.md`, not just against the presence of `ComponentPage.astro`.

First classify the page archetype:

- pitch surface primitive
- pitch-based chart component
- non-pitch chart component
- primitive catalogue
- cross-cutting guide or utility

The demo page must include:

- the required anatomy for its archetype
- a realistic hero/default story
- a collapsible best-practice TypeScript code example that omits boilerplate
- API and data-contract tables at the right level
- purposeful stories, not arbitrary variants
- usage guidance and neighboring-chart boundaries when confusion is plausible
- controls only when they map to public props or documented story variants
- layout choices that preserve readability for pitch, non-pitch, and primitive catalogue pages
- concrete cross-cutting support notes for static export, theming, accessibility, responsiveness, interaction, and composition

The code example should omit boilerplate, data fetching, and provider parsing. It should show only the component-level usage that a library consumer should copy.

Quality checks:

- Can a new user copy the code block without hidden imports or page state?
- Does each story title make a behavior claim?
- Are the real failure modes shown: empty, sparse, dense, fallback, extreme, responsive, theme, interaction, export/static, and composition where applicable?
- Are horizontal pitch charts and dense charts given enough width?
- Do primitive catalogue pages show both inventory and realistic host usage?
- Are cross-cutting notes supported by stories or concrete policy rather than generic claims?
- If the component has benchmark-recognizable idioms, does the page show at
  least one of them honestly?
- Are any page-specific layout hacks candidates for shared demo infrastructure?
- Does the page load without component-generated browser warnings or hydration mismatches?

### 5. Cross-Cutting Concerns

For each component, explicitly check:

- **Static rendering / export:** Does the default view work without hover? Are IDs deterministic? Are functions, external images, filters, masks, or canvas paths blocking export?
- **Deterministic SVG output:** Are SVG paths/coordinates stable across SSR and client hydration, or do tiny floating-point differences create browser warnings?
- **Accessibility:** Is there an accessible label or region policy? Is keyboard/focus parity documented for interactive elements?
- **Responsive behavior:** Does the component own sizing, aspect ratio, and mobile degradation, or does the wrapper?
- **Theme and colors:** Are default themes named, and do color overrides have clear precedence?
- **Composition:** Can the component live inside a larger chart card or export frame without global state collisions?
- **Anatomy and hooks:** Are stable slot/state hooks present where promised, and
  absent where the docs should not encourage reliance?
- **Public state contract:** If state is public, does it follow the shared
  controlled/uncontrolled naming and change-details rule? If not, is the state
  explicitly internal in the docs?
- **Preset discipline:** Did the component grow mode props where a preset or
  helper layer would be the cleaner contract?
- **Measured slot content:** For formation/marker systems, do custom slot items opt into the cell-size protocol instead of relying on raw unmeasured SVG fragments?
- **Data ownership:** Are adapter/core/renderer responsibilities still separated?

If a concern does not apply, say why instead of leaving it implicit.

## Output Checklist

For each reviewed component, leave the repo in this state:

- JSDoc matches the public prop and helper behavior
- package README matches package exports
- active repo docs reference the review standard if it changes future work
- demo page follows `ComponentPage.astro` and includes best-practice collapsible TS code
- demo page follows the appropriate `demo-page-standard.md` archetype
- demo states cover default, empty/sparse/dense/fallback where applicable
- cross-cutting concerns are visible in docs or demo copy
- usage guidance and neighboring-chart boundaries are visible where needed
- public state contract is either aligned or intentionally absent
- `docs/status/component-audit-matrix.md` records the review state and notable fixes
- verification commands are run or blocked reasons are recorded

## Review Notes Template

Use this shape in commit notes, PR descriptions, or follow-up docs:

```md
## Component State Review: ComponentName

- Public surface checked: `Package`, `Component`, `Props`
- Anatomy checked: slots, stable hooks, DOM/SVG regions
- State contract checked: internal vs public, controlled/uncontrolled naming
- Docs aligned: JSDoc, README, demo page, spec
- Demo states covered: default, empty, sparse, dense, fallback, export/static
- Cross-cutting concerns: accessibility, responsive, theme, export, composition
- Drift fixed:
  - ...
- Deferred risks:
  - ...
- Verification:
  - ...
```
