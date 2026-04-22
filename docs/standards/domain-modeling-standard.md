# Domain Modeling Standard

**Status:** active
**Scope:** lightweight domain-modeling discipline for football-specific public surfaces in Campos
**Purpose:** apply the useful parts of domain-driven design where Campos encodes football semantics, without forcing full DDD ceremony onto generic UI or infrastructure work

## Why this exists

Campos is not a generic design system.

It is a football-specific component library with:

- canonical football schema types
- provider adapters
- task-shaped chart components
- a shared pitch-space contract
- export and composition surfaces that depend on football semantics

That means Campos benefits from domain-modeling discipline in places where the
library's value comes from football knowledge, not just from SVG rendering.

This standard adopts the parts of domain-driven design that help:

- consistent vocabulary
- clean ownership boundaries
- explicit translation of provider models
- stronger canonical types before public prop design

Campos does **not** adopt full DDD ceremony by default. No event-storming
process or aggregate theatre is required for routine component work.

## Applicability rule

Use this standard when the work is primarily about **football semantics**.

Strong fit:

- `@withqwerty/campos-schema`
- `@withqwerty/campos-adapters`
- canonical coordinate and event contracts
- compute/helper contracts that define semantic chart models
- public chart component names and data contracts
- export contracts that serialize chart semantics

Weak fit:

- generic layout wrappers
- CI and release automation
- local docs-site plumbing
- low-level renderer-only implementation details
- purely presentational utility code

If the work is mostly generic UI infrastructure, do not force domain language
onto it just to sound principled.

## Core concepts

Campos should use the following DDD-derived ideas.

### 1. Ubiquitous language

The same terms should mean the same things across:

- docs
- type names
- adapter outputs
- compute models
- public component props
- demo copy

Examples of terms that should stay stable:

- `Shot`
- `PassEvent`
- `MatchLineups`
- `bodyPart`
- `outcome`
- `attacking direction`
- `provider-normalized`
- `Campos canonical pitch space`

If two docs use the same word for two different concepts, or different words
for the same concept, that is a design problem, not just a docs problem.

### 2. Bounded contexts

Campos has multiple contexts where the same real-world data is described for
different purposes.

Current practical context map:

- `schema`
  Canonical football language and shared value types.
- `adapters`
  Translation layer from provider-specific models into Campos canonical models.
- `react`
  Public chart APIs, rendering behavior, and visual defaults.
- `stadia`
  Football-surface primitives and geometric infrastructure.
- `static`
  Serializable export and server-side render contracts.

These contexts should collaborate, but they should not silently absorb one
another's responsibilities.

### 3. Canonical model before public API

For domain-heavy work, define the canonical model and invariants before shaping
the public component props.

Examples:

- define what a canonical `Shot` is before extending `ShotMap`
- define what `formations()` returns before optimizing `Formation` props
- define export-safe chart semantics before widening `ExportFrameSpec`

### 4. Anti-corruption layer

Adapters are Campos's anti-corruption layer.

Provider models are external contexts with different:

- coordinate systems
- taxonomies
- attacking-direction assumptions
- completeness guarantees

Public chart APIs and canonical schema types should not inherit those provider
quirks directly unless they are deliberately exposed as provenance.

### 5. Invariants

Each domain-heavy surface should name what must stay true.

Examples in Campos:

- canonical pitch coordinates mean one thing across the library
- adapters own provider translation
- zero-config chart defaults must be publishable
- export-safe props may be narrower than interactive props
- `sourceMeta` is provenance, not a second canonical schema

## Campos rules

### Public API naming rule

Prefer task-shaped football names over renderer-shaped names.

Good:

- `ShotMap`
- `PassNetwork`
- `Formation`

Avoid:

- naming that exposes internal scene assembly as the primary public concept
- provider-specific terms in the main consumer API when a canonical football
  term already exists

### Ownership rule

When a rule belongs clearly to one context, keep it there.

Examples:

- provider taxonomies -> adapters
- canonical football types -> schema
- chart defaults and visual behavior -> react
- pitch-surface primitives -> stadia
- serializable export subset -> static/export contract

Do not move a rule across contexts just because one callsite happens to need it
today.

### Translation rule

External terms should be translated at the boundary, not leaked inward.

Examples:

- provider event labels map to canonical event kinds
- provider coordinate quirks map to Campos canonical pitch space
- provider-specific detail stays in provenance fields when it is useful but not
  canonical

### Infrastructure honesty rule

Not every useful package or file is itself a domain context.

For example:

- `stadia` is football-aware infrastructure, not the owner of canonical event
  semantics
- generic chart frames are reusable renderer infrastructure, not domain models

Do not fake domain depth where a simpler infrastructure description is more
honest.

## Lightweight workflow

For a domain-heavy component, adapter, or contract change:

1. Name the domain concept clearly.
2. State which bounded context owns the concept.
3. Define the canonical input/output model.
4. Name the invariants and non-goals.
5. Translate provider or external terminology at the boundary.
6. Design the public API in domain terms.
7. Record where Campos intentionally diverges from source providers or
   reference implementations.

## Required questions for domain-heavy work

When writing or reviewing a domain-heavy packet, answer:

1. What football concept is being modeled?
2. Which package/context owns it?
3. What is canonical vs provider-specific?
4. What invariants must stay true?
5. What terminology should appear in the public API?
6. What terminology must stay internal or provider-scoped?

If those answers are fuzzy, the packet is not ready.

## Component and adapter implications

### Component specs

When a component is domain-heavy, its spec should make explicit:

- the football concept being visualized
- the canonical input packet it expects
- any provider-derived assumptions that must already be resolved before render
- chart rules that are domain semantics vs renderer mechanics

### Adapter specs and reviews

Adapter work should explicitly state:

- the external provider context
- the canonical Campos concept being targeted
- what is mapped
- what is dropped
- what is preserved as provenance
- what cannot honestly be normalized yet

## Non-goals

This standard does **not** require:

- event storming sessions
- aggregate/entity/value-object formalism for every chart
- domain naming for generic infrastructure that is not actually domain-specific
- replacing practical architecture docs with DDD jargon

Campos should borrow discipline, not theatre.

## Relationship to other docs

- `architecture-decision.md` remains the source of truth for the package story
  and React-first architecture.
- `adapters-contract.md` remains the source of truth for adapter boundaries.
- `core-output-contract.md` remains the source of truth for renderer-neutral
  compute responsibilities.
- `component-composition-standard.md` remains the source of truth for how public
  chart components are structured internally.

This document is a cross-cutting lens over those docs, not a replacement for
them.
