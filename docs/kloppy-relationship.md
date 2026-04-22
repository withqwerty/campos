# Campos And `kloppy`

**Status:** active
**Scope:** how Campos uses `kloppy` as a reference point, where parity matters, and where Campos should intentionally diverge
**Purpose:** keep adapter ambition, reference-code usage, and public positioning honest

## Statement

Campos has learned from `kloppy`, with thanks.

That includes:

- provider-specific normalization patterns
- coordinate-space cross-checks
- type and qualifier mapping references
- fixture and test-shape ideas

Campos should continue to use `kloppy` as an important reference for football data
normalization work. It should not treat `kloppy` as the product it is trying to
become.

## What Campos does aim for

Campos may pursue near parity with `kloppy` on the specific seams it intentionally
adopts.

Today that mainly means UI-relevant first-stage packets such as:

- `events()`
- `shots()`
- `passes()`
- `matchSummary()`
- `matchContext()`
- `matchLineups()`
- `formations()`

Likely future parity targets are still narrow and UI-led:

- `freezeFrames()` or equivalent shot/pass context packets
- additional event-provider coverage where it materially improves the chart and
  match-page surface

Parity here means:

- Campos should normalize the same football concepts honestly
- Campos should handle the same provider quirks where the adopted seam overlaps
- Campos should produce stable TypeScript-first packets that are directly useful
  to UI and application code

## What Campos does not aim for

Campos is not:

- a replacement for `kloppy`
- "`kloppy` for TypeScript"
- a commitment to match `kloppy` provider-for-provider across its whole surface
- a commitment to match `kloppy`'s event-plus-tracking scope
- a commitment to mirror `kloppy`'s API design, object model, or loader structure

No part of Campos should be described as a drop-in substitute for `kloppy`.

If Campos eventually reaches broad overlap on some event-adapter seams, that is a
useful outcome, not the product definition.

## Why Campos diverges

Campos is guided by football UI and visualization needs.

That changes what matters:

- adapters are judged by whether they produce stable first-stage packets for UI
  work, not by whether they cover every analytics or ETL workflow
- narrow match-page packets such as `matchSummary()` matter more in Campos than
  they do in a generic data-loader library
- chart-shaped or report-shaped aggregates still belong in core or app code, not
  adapters
- tracking, freeze-frame, and broader provider work should only expand when the
  chart surface genuinely needs them

Campos should borrow where the semantics are useful and diverge where Campos'
product boundaries demand it.

## Implementation stance

When Campos borrows from `kloppy`, it should:

- keep the borrowing explicit in nearby docs, tests, or provenance notes where it
  materially shaped the implementation
- preserve Campos' own canonical schema and package boundaries
- prefer clearer UI-usable contracts over generic vendor-independent abstractions
- avoid cargo-culting `kloppy` names, helper structure, or surface area when the
  Campos product does not need them

## Practical rule

Use `kloppy` as a strong reference for adapter correctness.

Do not use `kloppy` as the default answer to:

- which providers Campos must support next
- which data products belong in Campos adapters
- whether Campos should grow a tracking or loader abstraction layer
- how the public TypeScript API should be shaped

Those decisions remain Campos product decisions first.
