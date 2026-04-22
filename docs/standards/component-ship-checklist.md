# Component Ship Checklist

**Status:** active
**Scope:** ship gate for every component and major primitive extraction
**Purpose:** required ship gate for every component and major primitive extraction

This checklist translates the quality bar in [`../testing.md`](../testing.md) into the TS workspace and adds the documentation, demo, and review requirements needed for parallel work.

## Required packet before implementation

- spec file exists and follows [`../templates/component-spec.md`](../templates/component-spec.md)
- relevant rows are added to [`../status/matrix.md`](../status/matrix.md)
- required adapter fields are called out in [`adapter-gap-matrix.md`](./adapter-gap-matrix.md)
- reference-code coverage is checked through `/Volumes/WQ/ref_code/INDEX.md`
- official web docs/source coverage is checked too when local refs are thin, the
  behavior may have changed, or the task is explicitly benchmark/research-led
- only relevant reference repos are inspected
- the spec records where Campos should diverge from those references
- the intended anatomy/stable-hook contract is explicit when the packet touches
  public renderer structure
- the packet explains why any new prop is a public chart concept rather than a
  preset/helper candidate
- if the packet exposes public interaction state, the named
  controlled/uncontrolled contract is explicit up front rather than invented
  ad hoc during implementation
- adversarial review loop 1 is completed

## Required artefacts before merge

- core compute implementation
- React renderer implementation
- baseline demo page in `apps/site`
- core tests
- renderer tests
- fixture provenance for adapter-backed examples
- adversarial edge-case matrix
- adversarial review loop 2
- usage guidance and neighboring-chart boundaries where confusion is plausible

## Required artefacts before calling the component done

- review loop 3 completed
- docs updated
- status matrix updated
- open risks recorded explicitly

## Quality axes

Every component must show evidence for these cases:

1. `Empty`
   Graceful empty shell, not a crash and not a collapsed layout.
2. `Sparse`
   One mark or one row still renders intentionally.
3. `Dense`
   High-density data does not become unreadable or pathologically slow.
4. `Missing`
   Null or absent fields trigger explicit fallbacks.
5. `Extreme`
   Out-of-range coordinates, odd metric values, and degenerate domains are clamped or degraded safely.
6. `Text edges`
   Long names, Unicode, CJK, RTL, and label crowding are considered.
7. `Responsive`
   Check narrow and wide containers; note any allowed simplifications.
8. `Themeable`
   Dark and light remain valid; color is not the only encoding when semantic distinction matters.
9. `Composable`
   The component can live alongside other components without requiring bespoke page hacks.
10. `Accessibility`
    Labels, focus, contrast, and non-color encoding are explicit.
11. `Reference-aware`
    Relevant prior-art behavior and failure modes from `/Volumes/WQ/ref_code`
    and official web docs/source pages are considered.
12. `Tested`
    The cases above have direct tests or explicit, justified gaps.
13. `API-disciplined`
    Public props, presets/helpers, and stable renderer anatomy were considered
    intentionally rather than growing ad hoc.

## Adversarial edge-case matrix

Each component spec must include concrete notes for:

- zero rows / marks
- one row / mark
- dense overlap
- all-null encoded field
- mixed-null encoded field
- degenerate legend or scale domain
- clipped or out-of-bounds coordinates
- weird provider-normalized values
- mobile/touch interaction
- long text / multilingual text
- ambiguous or conflicting adapter semantics

## Reference-code rule

Use `/Volumes/WQ/ref_code/INDEX.md` to find relevant repositories.

Do:

- inspect `mplsoccer` for football-viz primitives it already covers
- inspect `d3-soccer` for interactive browser patterns
- inspect `kloppy` when widening or validating coordinate and provider semantics
- inspect `socceraction` when chart behavior depends on xT or SPADL-like assumptions
- inspect official package docs/source pages when local references do not cover
  the question honestly or the work is explicitly benchmark-led

Do not:

- cite repos that do not cover the primitive or chart in question
- cargo-cult API shapes that conflict with Campos architecture
- assume the reference implementation handled accessibility, responsiveness, or adapter ambiguity well enough for Campos

## Review loops

### Loop 1: spec review

Look for:

- undefined terms
- contradictory docs
- missing adapter fields
- untestable claims
- public API drift toward low-level scene assembly
- mode/boolean prop drift where a preset/helper would be cleaner
- state-prop drift away from the shared controlled/uncontrolled naming rule

### Loop 2: implementation review

Look for:

- renderer/core leakage
- adapter assumptions hidden in the UI layer
- missing demo coverage
- missing edge-case tests
- regressions in empty/fallback behavior
- anatomy/hook drift that makes docs, tests, and export inspection less stable

### Loop 3: release-readiness review

Look for:

- docs and demos out of sync
- unrecorded risks
- review comments that were closed without evidence
- missing follow-up issues for deferred gaps
- “use this vs that” guidance still missing where users can plausibly choose the
  wrong chart
