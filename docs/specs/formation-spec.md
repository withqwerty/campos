# Formation Component Spec

**Status:** active
**Last updated:** 2026-04-16

## Header

- Component / primitive: `Formation` (public chart component)
- Status: active spec
- Owner: Campos team
- Target version: v0.3 alpha
- Depends on:
  - `@withqwerty/campos-react` compute helpers (`parseFormationKey`, `layoutSingleTeam`, `layoutDualTeam`)
  - `@withqwerty/campos-react` renderer seams under `src/formation/`
  - `@withqwerty/campos-stadia` pitch surface primitives
  - `@withqwerty/campos-adapters` optionally, when provider lineup data is normalized upstream

## Purpose

- What user task this solves:
  - render lineup diagrams, scouting-card crops, and dual-team match cards with publishable zero-config defaults
- Why it belongs in Campos:
  - formation cards are one of the core football-native surfaces alongside shot maps and pass maps; consumers should not have to rebuild them from generic layout primitives
- Why it should be public:
  - formation parsing, slot ordering, crop/orientation semantics, bench layout, and marker-composition behavior are chart-level product behavior, not app glue

## Domain framing

### Football concept

`Formation` models a **lineup snapshot**: the canonical shape of an XI (or two
XIs in match-card mode) rendered on a football surface.

It is not:

- a tracking-data average-position chart
- a formation-timeline view
- a provider-specific lineup parser

### Bounded-context ownership

- `schema` owns the canonical formation vocabulary:
  - formation keys
  - slot semantics
  - team/player data shapes when shared across packages
- `adapters` may translate provider lineup products into `FormationTeamData`
  when upstream data honestly supports that
- `react` owns:
  - single-team vs dual-team chart behavior
  - crop/orientation/side view rules
  - placeholder, marker, badge, and label presentation
- `stadia` owns the football surface primitives, not lineup semantics

Raw provider terms such as Opta lineup events or WhoScored match-centre payload
belong in adapter docs and code, not in the public `Formation` API.

### Canonical input model

The public component accepts either:

- a canonical `formation` key plus optional player data for single-team mode, or
- two canonical team specs for dual-team mode

That means the component contract is built around **Campos lineup semantics**,
not provider payloads.

### Invariants

- a formation key must resolve to a known canonical slot table or the component
  fails loudly
- a missing player list does not remove the formation; it renders the canonical
  slot structure with placeholders
- `crop`, `orientation`, `side`, and `flip` are view rules over the same lineup
  snapshot, not different domain models
- dual-team mode remains a mirrored comparison of two lineup snapshots, not a
  live tactical state model
- provider parsing and provider disagreement resolution happen upstream of the
  component

## Public API

### Zero-config happy path

```tsx
import { Formation } from "@withqwerty/campos-react";

<Formation formation="4-3-3" />;
```

This renders a single-team vertical lineup with:

- 11 canonical formation slots
- position-code placeholders
- publishable pitch defaults
- no dependency on adapter output or player metadata

### Current public surface

`FormationProps` is a tagged union:

- `FormationSingleProps`
  - `formation`
  - `players`
  - `teamColor`
  - `teamLabel`
  - `orientation`
  - `crop`
  - `side`
  - `flip`
  - `substitutes`
  - `substitutesPlacement`
  - `substitutesLabel`
- `FormationDualProps`
  - `home`
  - `away`
  - `orientation`
  - `legendPlacement`
- shared live/runtime seams
  - `showLabels`
  - `showNames`
  - `labelStrategy`
  - `pitchTheme`
  - `pitchColors`
  - `markers`
  - `markerLabels`
  - `markerBadges`
  - `markerComposition`

### Advanced customization points

- `markers` is the first-class marker style surface:
  - `glyphKind`
  - `fill`
  - `stroke`
  - `strokeWidth`
- `markerLabels` owns below-marker name-pill treatment:
  - `nameFormat`
  - `background`
  - `color`
- `markerBadges` is the bounded badge-prefix seam:
  - `prefix`
- `markerComposition` is the React-only escape hatch for richer composition:
  - `glyph`
  - `slots`
- `substitutes` and `substitutesPlacement` are part of the live chart contract for lineup-card variants; they are not just demo glue
- `legendPlacement` matters only for dual-team mode and should stay explicit rather than inferred from outer layout chrome

### Export / static posture

- `Formation` is part of the stable `ExportFrameSpec` chart union
- the export-safe subset is narrower than the live React surface:
  - constant-only `markers`
  - constant-only `markerLabels`
  - `markerComposition.glyph` only when it is the serializable preset branch (`"circle"` or `"shirt"`)
- explicitly unsupported in the stable export contract:
  - `markerBadges`
  - `markerComposition.slots`
  - render-function glyphs
  - photo / cutout-photo glyphs
  - substitutes benches
- live `FormationStaticSvg` and `createExportFrameSpec()` remain the truth for export behavior; the docs site should not imply parity beyond that bounded subset

### Filtering

Formation does not participate in cross-chart filtering:

- it is a lineup snapshot, not an event-driven chart
- consumers pass the already-selected XI or team specs
- formation, crop, side, and orientation are configuration, not filter dimensions

### Explicit non-goals

- built-in click/selection handlers
- formation-timeline animation or substitution chronology
- tracking-data average-position behavior (belongs to PassNetwork or later tactical surfaces)
- generic child injection into the pitch scene graph
- automatic provider parsing inside the component

## Required normalized data

Formation accepts direct consumer data or adapter-produced normalized data. The canonical team shape is `FormationTeamData`; dual-team mode lifts that into two `FormationTeamSpec` objects.

| Field                    | Required | Why it matters                         | Fallback if missing                         |
| ------------------------ | -------- | -------------------------------------- | ------------------------------------------- |
| `formation`              | yes      | slot layout cannot exist without it    | throw on invalid / unknown key              |
| `players`                | no       | fills the formation with real players  | render placeholders                         |
| `players[].slot`         | no       | explicit slot ownership                | assign by array order                       |
| `players[].positionCode` | no       | explicit position-code override        | derive from the canonical formation table   |
| `players[].label`        | no       | visible name pill / label semantics    | use number, initials, or position code      |
| `players[].number`       | no       | jersey-number label path               | fall back to name initials or position code |
| `players[].color`        | no       | per-player fill override in live React | fall back to `teamColor` / team spec color  |
| `substitutes`            | no       | bench rendering                        | omit the bench strip                        |
| `home` / `away` labels   | no       | dual-team legend copy                  | suppress legend when labels are absent      |

Also state:

- provider support now:
  - adapters may normalize lineup data into `FormationTeamData`, but the component does not depend on adapters at runtime
- partial / unsupported:
  - no cross-provider comparison semantics at the chart layer
  - no mid-match formation timeline
- acceptable lossy mappings:
  - kickoff / lineup-snapshot semantics are acceptable; later tactical changes are intentionally out of scope for v0.3 alpha

## Default visual contract

### Layout

- single-team defaults to a vertical full-pitch lineup card
- dual-team defaults to a full-pitch mirrored match card
- half-pitch crops are single-team only
- dual-team legends render only when they have real labels to explain

### Encodings

- slot position encodes the formation shape
- marker label encodes position code, jersey number, initials, or name according to `labelStrategy`
- fill/stroke/glyph encode emphasis only through the explicit style surface
- badges and slot decorations are additive composition, not a hidden data contract

### Interaction / accessibility behavior

- the root SVG is an image-like surface with an explicit `aria-label`
- this is not a clickable chart by default
- marker semantics should remain meaningful without hover-only UI

### Empty / placeholder behavior

- no players:
  - render 11 placeholders in canonical slots
- sparse players:
  - keep the real players in their slots and leave the rest as placeholders
- invalid formation:
  - throw loudly rather than silently guessing a fallback shape

### Fallback / degraded behavior

- multilingual and long labels should remain legible before rich decoration survives
- rich marker presets may hide the in-glyph jersey label intentionally when a photo glyph becomes the primary affordance
- export/static mode must degrade to the documented bounded subset rather than best-effort hidden branches

## Internal primitives required

| Primitive / seam         | Status   | Notes                                                                  |
| ------------------------ | -------- | ---------------------------------------------------------------------- |
| `parseFormationKey`      | existing | normalizes hyphenated and compact formation strings                    |
| `layoutSingleTeam`       | existing | owns slot ordering, crop, flip, and placeholder semantics              |
| `layoutDualTeam`         | existing | owns half mirroring and dual-team orientation semantics                |
| `FormationMarker`        | existing | resolves style surfaces and composition seams                          |
| `FormationSingle`        | existing | single-team render path including bench composition                    |
| `FormationDual`          | existing | dual-team render path including legend and mirrored halves             |
| `FormationStaticSvg`     | existing | deterministic static/export renderer                                   |
| `SubstitutesBench`       | existing | bench strip used by single and dual-team live rendering                |
| formation marker presets | existing | site/demo convenience layer; not the same thing as the export contract |

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / source                          | Why relevant                                                            | What it covers                                           | What Campos should keep                                             | What Campos should change                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/Volumes/WQ/ref_code/INDEX.md` survey | checked whether this rerun required a fresh external formation analogue | no new direct reference was needed for this honesty pass | keep the formation-slot semantics and football-native lineup layout | diverge from the older extraction plan: keep the React-first public contract explicit and active |

## Edge-case matrix

- zero-config:
  - 11 placeholders in canonical slots
- sparse player arrays:
  - partial real lineup plus placeholders
- multilingual / long labels:
  - labels stay readable under mixed-script pressure
- crop / flip:
  - goalkeeper stays inside the visible penalty area under half-pitch defaults
- dual-team mirroring:
  - forward lines face each other on the full pitch
- rich marker composition:
  - slot decorations stack intentionally without implying generic child injection
- benches:
  - placement follows orientation defaults but remains overrideable
- export/static:
  - supported only through the bounded subset documented above

## Demo requirements

- required page path:
  - `apps/site/src/pages/formation.astro`
- minimum story coverage:
  - hero/default
  - zero-config
  - half-pitch crop
  - real adapter-fed lineup
  - dual-team match card
  - rich marker presets
  - multilingual stress
  - themeability
  - static export
  - bench composition
  - responsive pressure

## Test requirements

- React tests:
  - zero-config and sparse placeholders
  - label strategies and name-pill behavior
  - captain / card / sub-minute badges
  - marker style injection and composition seams
  - crop / side / flip semantics
  - single-team and dual-team bench placement
  - dual-team legend behavior
  - invalid-formation error path
  - accessibility / axe checks
- export tests:
  - reject unsupported `markerBadges`
  - reject slot-renderer composition branches
  - reject photo / cutout-photo export branches
  - reject substitutes in the stable export contract
- site verification:
  - page builds cleanly and the demo wrapper does not introduce Astro hydration drift

## Review plan

- loop 1:
  - keep the spec aligned with the live React-first surface and bounded export-safe subset
- loop 2:
  - verify page stories, API table, and demo wrapper behavior match the shipped component
- loop 3:
  - re-run tests, site build, and browser verification on current standards

## Open questions

- whether a later showcase/small-multiples packet should extract a shared compact lineup-card wrapper around Formation rather than adding more page-local responsive wrappers
