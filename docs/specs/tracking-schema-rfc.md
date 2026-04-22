# Tracking Schema RFC

**Status:** draft
**Scope:** sequence the work that would eventually produce a canonical tracking-data contract, without prematurely locking in the shape
**Purpose:** capture the unresolved design questions an adapters-first exploration must answer, so the future canonical schema falls out of concrete evidence rather than speculation

## Why now

Every Campos event surface is currently "one event, one point in time, two axes." That is sufficient for shot maps, pass maps, press maps, and the other charts shipped through v0.3. But several natural next-gen surfaces need per-frame positional data:

- Freeze-frame overlays on shots (StatsBomb's `data/three-sixty/` freeze frames are not wired in; shot `freeze_frame` inside `ShotEvent.sourceMeta` is unstructured).
- Pressure maps with opponent positions, not just the presser's coordinate.
- Packing metrics (opponents-bypassed counts) that require the defender cloud, not just the passer.
- Average-position layouts driven by actual tracking rather than lineup position codes.
- Off-ball-run visualisations (SkillCorner surfaces these explicitly, but a canonical kind needs the tracking frame for context).

Two clones in `/Volumes/WQ/ref_code/` give this RFC its evidence base:

- `skillcorner-opendata` — broadcast tracking-only with derived tactical events. See `skillcorner-feasibility.md`.
- `sample-data` (Metrica Sports) — synchronised tracking + events in both legacy CSV and FIFA EPTS formats. See `metrica-feasibility.md`.

Kloppy (`/Volumes/WQ/ref_code/kloppy`) already offers a vendor-independent tracking loader across 12+ providers with solved cross-provider coordinate normalisation and SPADL-adjacent event models. This RFC should treat kloppy as prior art for the canonical shape, not as a dependency to replace.

## Why this RFC is staged adapters-first

An earlier draft of this RFC attempted to specify the canonical `TrackingFrame` shape up front and then land adapters against it in later stages. Adversarial review surfaced three load-bearing problems with that approach:

1. **StatsBomb 360 freeze frames cannot populate the required identity fields.** The 360 spec provides only `location`, `teammate`, `actor`, `keeper` — no `playerId`, no `teamId`, no absolute `frame` index, no `timestamp`. Making these required in the canonical shape forces fabrication on the first real consumer.
2. **Campos's attacker-frame coordinate invariant does not compose to a 22-player continuous frame.** An event has an acting team; a tracking frame does not. Applying per-frame rotation based on possession flips orientation on every turnover, which no tracking chart survives.
3. **The `mapPressure` / `counterpress` precedent** (landed this wave) demonstrates that Campos has tolerated adapter-first schema extraction for point events. Tracking is structurally different — N-player arrays, optional join keys, non-actor identities — so the precedent doesn't fully transfer. It does, however, show that deferring schema until an adapter forces concrete decisions produces better shapes than speculating.

This RFC therefore defines a **staging plan** rather than a schema. The canonical shape gets written at the end, after two concrete adapters (or adapter-equivalents) have produced evidence.

## What the evidence base already tells us

The two reference clones disagree on four properties worth naming now because they shape the eventual canonical contract:

| Concern               | SkillCorner                         | Metrica EPTS                                 | StatsBomb 360                                      |
| --------------------- | ----------------------------------- | -------------------------------------------- | -------------------------------------------------- |
| Coordinate frame      | metres, origin pitch-centre         | 0..1, origin top-left                        | Actor-relative 0..120 × 0..80 (attacker toward +x) |
| Frame rate            | 10 Hz                               | 25 Hz                                        | Event-anchored; no continuous frame                |
| Identity field        | `frame` monotonic int               | `frame` monotonic int                        | `event_uuid` (no frame index)                      |
| Time                  | `timestamp` HH:MM:SS.cs             | `Time [s]` float                             | Not present                                        |
| Per-player record     | `{x, y, player_id, is_detected}`    | wide-table columns OR semicolon-joined pairs | `{location, teammate, actor, keeper}` — no ID      |
| Per-team attribution  | `possession.player_id / group`      | Not in tracking; in events                   | Only via `teammate` boolean relative to actor      |
| Visible area          | `image_corners_projection` polygon  | Not present                                  | `visible_area` polygon                             |
| Event ↔ tracking join | Events carry `frame_start`          | Events carry `Start Frame` / `End Frame`     | Frames carry `event_uuid`                          |
| Sampling cadence      | Continuous, occasionally camera-off | Continuous, kickoff → final whistle          | Sparse, event-anchored (~326 frames/match)         |

The adversarial review made three structural observations from this table:

- StatsBomb 360 is not the same product as continuous tracking. A single `TrackingFrame` shape forcing both into one schema either fabricates fields or relaxes invariants to the point of uselessness. The two likely want to be **two canonical kinds** — `FreezeFrame` (event-anchored, actor-relative, no absolute identity) and `TrackingFrame` (continuous, frame-indexed, absolute coords).
- "Attacker-frame" as defined in `coordinate-invariants.md` assumes an acting team. Continuous tracking does not have one. The canonical contract for tracking coordinates probably needs a separate rule — something like `attackingTeamId: string` per frame, or a per-match convention like "home team attacks toward +x in period 1, flipped in period 2," with renderers handling per-team attacker orientation at render time instead of adapter time.
- Event ↔ tracking joins differ by provider (`frame` index vs `event_uuid`). Whatever the canonical shape becomes, the identity field cannot be a single data type pinned to one provider's convention.

## What this RFC does not do

- It does **not** specify `TrackingFrame` or `FreezeFrame` as finalised shapes. Specimen-driven design comes after the adapter work.
- It does **not** promise a tracking canonical kind in v0.3.
- It does **not** oblige any event-emitting adapter to thread tracking-join fields today. That decision depends on evidence from the prototypes in Stages 1–2.
- It does **not** cover the derived-event families SkillCorner exposes (`off_ball_run`, `passing_option`, `phase_of_play`). Those need their own schema RFCs — this RFC is about positional tracking only.

## Adapters-first staging plan

### Stage 1 — StatsBomb 360 prototype (highest-leverage first consumer)

**Goal**: Land `fromStatsBomb.freezeFrames(events, three360Frames, matchInfo)` against a **provisional internal type**, not a canonical schema export. The adapter reads `data/three-sixty/<match_id>.json`, joins on `event_uuid`, projects coordinates into Campos attacker-frame, and emits internal `StatsBombFreezeFrame` objects.

StatsBomb 360's `location` field is stored "oriented in the same direction as the linked event (i.e. the actor's team attacking 0 to 120 on the X axis)" — so the rotation anchor is the **event's team**, not a per-player actor. That means `fromStatsBomb.freezeFrames` applies `statsBombToCampos` (already shipped) via the matched event, and the actor-less frames the 360 spec warns about (events without a player marked `actor: true`) still rotate correctly via the event's `team.id`. The actor-less case is only a problem for consumers that want to highlight the presser — the rotation itself is well-defined.

**Deliverables (indicative, not committed paths)**:

- Provisional private type `StatsBombFreezeFrame` alongside `packages/adapters/src/statsbomb/parse.ts` (not exported from `@withqwerty/campos-schema`).
- `fromStatsBomb.freezeFrames()` public method, but typed against the internal shape for now.
- A compute helper `pairShotsWithFreezeFrames(shots, frames)` in the React compute layer, consuming the internal shape.
- A lightweight `FreezeFrameOverlay` renderer primitive to show opponent/teammate/keeper dots behind a shot. Expect this to be a chart-primitive-sized piece of work (~1 week), not a quick helper — legend, colour semantics, z-ordering, theming, and occlusion with shot markers all need deciding.
- One demo page using the pair to render opponent positions behind shots.

**What Stage 1 answers**:

- Does rendering opponent positions behind shots survive nullable identity (`playerId: null`, `teamId: null`, only `teammate` / `actor` / `keeper` booleans)? The scope is honest to the chart, not general: further null-identity questions wait on additional consumers.
- Does the `event_uuid` join suffice for a shot-pressure chart, or do consumers also want frame-index/timestamp fields?
- For frames with `actor` missing, what's the right default — drop the frame, render without highlighting anyone, or emit with `sourceMeta.actorMissing: true` so renderers can choose? The first real demo forces the decision.
- How many downstream consumers want a `role: "actor" | "teammate" | "opponent" | "keeper"` discriminant vs raw booleans?

### Stage 2 — Second consumer: continuous tracking

**Goal**: Prove the continuous-tracking coordinate problem against a real provider with 22-player per-frame data and no acting team. The vehicle is open: either `fromMetrica.frames()` as a dedicated adapter, or a kloppy-loaded Metrica fixture with a thin Campos-side shim. The Metrica feasibility doc (`metrica-feasibility.md`) leaves the vehicle choice open pending a ~1-day spike (open question 1 there).

**Prerequisite — Stage 0 spike** (~1 day, blocks Stage 2 vehicle choice): load `Sample_Game_3` via kloppy, shim its tracking output into a Campos attacker-frame type, render one chart. Decide between "build `fromMetrica`" (option 3 in the Metrica doc) and "use kloppy fixtures" (option 2) based on what breaks.

**Deliverables (whichever vehicle Stage 0 picks)**:

- A provisional private type for continuous frames, not exported from `@withqwerty/campos-schema`.
- A public entry point (`fromMetrica.frames()` or the kloppy-shim equivalent) against the internal shape.
- For the events side, a pre-canonical `sourceMeta.frame` field on every emitted event so consumers can join tracking to events. **This is explicitly a pre-canonical seam that Stage 3 will either promote to a top-level optional (`trackingFrame?: number | null` on `base-event.schema.json`) or rename.** Consumers must expect that rename.
- A compute helper `resolveAttackingOrientation(frame, match)` that turns a continuous frame into a presser-relative view when a chart needs one.

**What Stage 2 answers**:

- What does "attacker-frame" mean for a continuous frame? (Concrete options: per-match home-attacks-toward convention, per-frame attackingTeamId, or no rotation in the canonical shape with renderers handling it.)
- Do `frame` and `timestamp` both need to be required, or is one derivable?
- Does the wire format need to be columnar for bundle-size reasons, even if the TS type is object-shaped?
- Does `sourceMeta.frame` on events want to stay in the bag, or get promoted to a top-level optional `trackingFrame` field on `base-event.schema.json`?

**Corpus-coverage risk**: The Metrica public sample is 3 matches: 2 legacy CSV + 1 EPTS. If Stage 2 targets EPTS only (per the Metrica doc's first-implementation recommendation), the adapter evidence comes from a single match. Thin. Option 2 (kloppy-sourced fixtures) would cover both formats for free.

### Stage 3 — Extract canonical shape

Only once Stages 1 and 2 are landed and at least one chart consumes each.

**Goal**: Write `tracking-frame.schema.json` (and possibly `freeze-frame.schema.json`) from the intersection of what both prototypes needed. Promote the internal types to `@withqwerty/campos-schema` exports. Migrate the Stage 1 + Stage 2 adapters to the canonical types. This is the schema RFC follow-up, not this RFC.

**Deliverables**:

- A follow-up RFC (`tracking-schema-finalisation.md` or similar) with empirically-grounded design decisions.
- Canonical JSON Schema files and generated TS types.
- Adapter migrations and a documented deprecation path for the internal types.
- **Concrete kloppy cross-check**: compare the draft canonical shape against `kloppy.domain.models.tracking`, `PitchDimensions`, and `Dataset.transform()`. Record where Campos intentionally diverges per the standing "record divergences" rule in the project's reference-code conventions. Converging quietly with kloppy where the design space allows is cheaper than a bespoke abstraction.
- **Decision on `sourceMeta.frame`**: promote to top-level `trackingFrame?: number | null` on `base-event.schema.json`, or leave in the bag with a written rationale for why the cross-provider-meaning invariant doesn't apply.

**What Stage 3 does not attempt**:

- Compatibility with SkillCorner tracking. SkillCorner's tracking corpus (10 matches, A-League-only) is too thin to drive canonical design; see Stage 4.
- A `TrackingClip` (bounded frame span) shape. Clip-level products can be served by `TrackingFrame[]` + a filter helper until evidence says otherwise.

### Stage 4 — Additional tracking adapters (conditional)

Once Stage 3 canonical types exist, additional tracking adapters can land against them without modifying the canonical shape further. SkillCorner is the first candidate (see `skillcorner-feasibility.md`), but its 10-match corpus currently doesn't justify the adapter maintenance; revisit only if SkillCorner's public release widens or if a specific chart requires A-League coverage. No work planned for v0.3.

## Open design questions the staging plan answers

The earlier draft of this RFC listed six open questions and treated them all as equal-weight. The review identified which are schema-blocking (cannot land the canonical shape with them open) and which are roll-forward. Staging adapters-first lets the concrete adapters answer them:

| Question                                                  | Previously open | How the plan addresses it                                                   |
| --------------------------------------------------------- | --------------- | --------------------------------------------------------------------------- |
| Required `playerId` / `teamId` vs nullable                | Q5 (blocking)   | Stage 1 uses an internal type with null-safe shapes; Stage 3 resolves       |
| `frame` vs `event_uuid` as identity                       | Implicit        | Stage 1 uses `event_uuid`; Stage 2 uses `frame`; Stage 3 picks the union    |
| Attacker-frame meaning for continuous frames              | Contradiction   | Stage 2 forces a concrete rule through `resolveAttackingOrientation`        |
| `sourceMeta.frame` on events — bag or top-level           | Q6 (blocking)   | Stage 2 implements via `sourceMeta`; Stage 3 promotes if consumers need it  |
| `frame` + `timestamp` redundancy                          | Not raised      | Stage 2 picks: derive one from the other or carry both with an invariant    |
| `TrackingFrame` vs `FreezeFrame` — one shape or two kinds | Q5 flavour      | Stage 3 decides based on whether 360's actor-relative model can share shape |
| Wire format columnar vs object-per-frame                  | Not raised      | Stage 2 surfaces volume: ~135k frames × 22 players per Metrica match        |
| `TrackingClip` bounded-span shape                         | Q1 (roll-fwd)   | Deferred until a chart needs it                                             |
| `ball.z = 0` vs `null` when untracked                     | Q3 (roll-fwd)   | Stage 2 picks; both providers present make this concrete                    |
| `visibleArea` as array vs `{points: [...]}`               | Q4 (roll-fwd)   | Stage 3 picks, ergonomic only                                               |
| Substitution / player-identity stability across frames    | Q2 (blocking)   | Stage 2 hits this immediately; Stage 3 records the honest answer            |

## Invariants the eventual canonical shape must uphold

Regardless of how Stages 1–3 play out, the final canonical contract should satisfy these properties (this is what we would push back on if a proposed shape violated any of them):

1. **Renderers stay naive.** Whatever rotation / projection rule is chosen, adapters own it. A renderer should not have to know "this is SkillCorner, flip for the away team in period 2."
2. **No cross-provider meaning hidden in `sourceMeta`.** If a field is canonical (e.g., an event-tracking join key), it belongs as a top-level optional on the schema, not in the bag. `base-event.schema.json`'s own description prohibits bag-based canonical meaning, and the eventual tracking schema should follow the same rule.
3. **Identity of a tracked participant is honestly expressible when the provider does not disclose it.** StatsBomb 360's anonymous opponents are a real pattern. `playerId: null` + a `role` discriminant is the minimum honest surface.
4. **Two structurally different products get two kinds.** If continuous tracking and event-anchored freeze frames turn out to be meaningfully different (the evidence says they are), the canonical shape should not paper over it with a shared loose schema. Two narrow kinds beat one broad one.
5. **Coordinate contract aligns with or explicitly diverges from `coordinate-invariants.md`.** Any divergence gets a one-paragraph update to the invariants doc stating why continuous tracking plays by different rules than events.

## Explicit non-goals

- **Not in scope for this RFC or its successor**: canonical kinds for `off-ball-run`, `passing-option`, `phase-of-play`, `predicted-pass`. These are derived tactical surfaces. They need their own schema RFCs, separate from the positional tracking problem this RFC stages.
- **Not in scope**: aggregate tracking products (PSV99, high-intensity counts). Those are season-level scouting metrics and belong in a scouting-aggregate RFC.
- **Not in scope**: tracking-side compute helpers (smoothing, velocity derivation, downsampling). Ship raw frames first; helpers can follow when evidence calls for them.

## Cross-references

- `docs/specs/skillcorner-feasibility.md` — SkillCorner's narrow landable surface and why SkillCorner tracking sits in Stage 4+ behind Metrica.
- `docs/specs/metrica-feasibility.md` — why Metrica is the right fixture for Stage 2 and what the adapter has to solve.
- `docs/standards/adapter-gap-matrix.md` — provider coverage baseline; the `Freeze-frame player positions` row will change status at the end of Stage 1.
- `docs/standards/coordinate-invariants.md` — the current rule; this RFC's Stage 2 will likely produce an amendment for continuous tracking.
- `packages/schema/schema/base-event.schema.json` — the base event shape; Stage 2 may discover we need an optional top-level tracking-join field here.
- `/Volumes/WQ/ref_code/kloppy/` — prior art for multi-provider tracking loaders; reference for Stage 3 design.
- `/Volumes/WQ/ref_code/statsbomb-open-data/doc/Open Data 360 Frames v1.0.0 (1).pdf` — 360 spec, the Stage 1 target.
