# Component Spec Template

**Status:** draft template

## Header

- Component / primitive:
- Status:
- Owner:
- Target version:
- Depends on:

## Purpose

- What user task this solves
- Why it belongs in Campos
- Why it should be a public chart component or remain an internal primitive

## Domain framing

- Football concept
  - what football concept or task the component models
  - what it explicitly is not
- Bounded-context ownership
  - which package/context owns the canonical vocabulary
  - which package/context owns translation from provider-specific models
  - which package/context owns chart/runtime behavior
  - which package/context owns supporting infrastructure only
- Canonical input model
  - what canonical Campos packet or shape the component expects
  - whether provider parsing must already be resolved upstream
- Invariants
  - what must stay true for the component to remain honest
  - what degrades safely vs what should fail loudly

## Public API

- Proposed public export
- Zero-config happy path
- Advanced customization points
- Filtering
  - if the component participates in shared filtering, reference `docs/standards/filtering-standard.md`
  - state which fields are canonical filter dimensions for this chart
  - state which chart options are view rules rather than end-user filters
- Explicit non-goals

## Required normalized data

List the minimum fields the component requires from adapters.

| Field   | Required | Why     | Fallback if missing |
| ------- | -------- | ------- | ------------------- |
| example | yes      | example | example             |

Also state:

- which providers are expected to support the component now
- which providers are partial or unsupported
- what lossy mappings are acceptable

## Default visual contract

- layout
- encodings
- legend behavior
- tooltip behavior
- empty state
- fallback mode when key fields are absent

## Internal primitives required

- coordinate space
- mark layers
- annotations
- layout containers
- utilities

State whether each is:

- existing
- needs extraction
- new

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo    | Why relevant | What it covers | What Campos should keep | What Campos should change |
| ------- | ------------ | -------------- | ----------------------- | ------------------------- |
| example | example      | example        | example                 | example                   |

If no relevant coverage exists in `/Volumes/WQ/ref_code`, say so explicitly rather than forcing a weak citation.

## Edge-case matrix

For each item, state expected behavior and the test shape needed.

- empty data
- one mark / one row
- dense overlap
- all-null encoded field
- mixed-null encoded field
- out-of-range coordinates or values
- long / multilingual text
- touch/mobile interaction
- degenerate legend or scale domain
- provider disagreement or ambiguous raw semantics

## Pre-implementation prep

Before opening the implementation packet for a chart:

- list every sensible demo/example the demo page should cover, not just baseline / empty / dense
- ask the user for reference images for that chart type so Campos has a concrete recreatability bar before coding
- prepare real-data fixtures, preferring fixture modules built from normalized adapter output instead of invented arrays
- record the source path or URL for each fixture
- if a planned demo or fixture needs fields current adapters cannot produce, widen or add the missing adapter functionality in the same packet instead of faking the data
- update `docs/standards/adapter-gap-matrix.md` if the prep work changes adapter expectations

## Demo requirements

- required page path under `apps/site/src/pages/`
- baseline scenario
- fallback scenario
- stress / dense scenario
- any additional scenario cards the demo page should ship with on day one

## Test requirements

- adapter tests
- core tests
- React tests
- accessibility checks
- regression fixtures

## Review plan

- loop 1 scope / spec adversarial review
- loop 2 implementation adversarial review
- loop 3 release-readiness adversarial review

## Open questions

- unresolved technical decisions
- known risks
- follow-up issues explicitly deferred
